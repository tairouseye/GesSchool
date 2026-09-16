-- =====================================================================
--  114 — Consentement d'accès parent aux notes (supérieur) — A2 + A3
--
--  L'étudiant majeur contrôle l'accès de ses parents à ses notes :
--   • A2 : le parent (déjà lié) DEMANDE l'accès ; l'étudiant AUTORISE/REFUSE.
--   • A3 : au SUPÉRIEUR, les RPC parent (notes, bulletins) ne renvoient les
--          données QUE si un accès autorisé existe. À l'école : inchangé.
-- =====================================================================

create table if not exists acces_parent_etudiant (
  id                uuid primary key default gen_random_uuid(),
  ecole_id          uuid not null references ecoles(id) on delete cascade,
  eleve_id          uuid not null references eleves(id) on delete cascade,
  parent_profil_id  uuid not null references profils(id) on delete cascade,
  statut            text not null default 'en_attente'
                    check (statut in ('en_attente','autorise','refuse','revoque')),
  demande_le        timestamptz not null default now(),
  decide_le         timestamptz,
  unique (eleve_id, parent_profil_id)
);
create index if not exists acces_pe_eleve_idx on acces_parent_etudiant(eleve_id);
create index if not exists acces_pe_parent_idx on acces_parent_etudiant(parent_profil_id);

alter table acces_parent_etudiant enable row level security;
-- Lecture par le personnel de l'école (parent/étudiant passent par les RPC).
drop policy if exists acces_pe_staff on acces_parent_etudiant;
create policy acces_pe_staff on acces_parent_etudiant for select using (
  est_super_admin() or ecole_id = ecole_courante()
);

-- Accès aux notes autorisé ? (école ordinaire = toujours ; supérieur = selon consentement)
create or replace function public._acces_notes_autorise(p_eleve uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    coalesce((select e.type_etablissement from eleves el join ecoles e on e.id = el.ecole_id where el.id = p_eleve), 'ecole') <> 'superieur'
    or exists (
      select 1 from acces_parent_etudiant a
      where a.eleve_id = p_eleve and a.parent_profil_id = auth.uid() and a.statut = 'autorise'
    );
$$;

-- Le parent demande l'accès aux notes d'un étudiant auquel il est déjà lié.
create or replace function public.demander_acces_notes(p_eleve uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ecole uuid;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select ecole_id into v_ecole from eleves where id = p_eleve;
  insert into acces_parent_etudiant (ecole_id, eleve_id, parent_profil_id, statut, demande_le)
  values (v_ecole, p_eleve, v_uid, 'en_attente', now())
  on conflict (eleve_id, parent_profil_id) do update
    set statut = case when acces_parent_etudiant.statut = 'autorise' then 'autorise' else 'en_attente' end,
        demande_le = now(),
        decide_le = case when acces_parent_etudiant.statut = 'autorise' then acces_parent_etudiant.decide_le else null end;
  return (select statut from acces_parent_etudiant where eleve_id = p_eleve and parent_profil_id = v_uid);
end $$;

-- État de l'accès pour le parent (pour piloter l'UI).
create or replace function public.mon_acces_notes(p_eleve uuid)
returns table(requiert boolean, statut text)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select e.type_etablissement from eleves el join ecoles e on e.id = el.ecole_id where el.id = p_eleve), 'ecole') = 'superieur',
    (select a.statut from acces_parent_etudiant a where a.eleve_id = p_eleve and a.parent_profil_id = auth.uid());
$$;

-- Demandes reçues par l'étudiant (propriétaire de la fiche).
create or replace function public.mes_demandes_acces()
returns table(id uuid, parent text, statut text, demande_le timestamptz, decide_le timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(nullif(trim(coalesce(pr.prenom,'') || ' ' || coalesce(pr.nom,'')), ''), 'Parent'),
         a.statut, a.demande_le, a.decide_le
  from acces_parent_etudiant a
  join eleves el on el.id = a.eleve_id
  left join profils pr on pr.id = a.parent_profil_id
  where el.profil_id = auth.uid()
  order by (a.statut = 'en_attente') desc, a.demande_le desc;
$$;

-- L'étudiant décide (autorise / refuse / révoque) une demande le concernant.
create or replace function public.decider_acces(p_acces uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if p_decision not in ('autorise','refuse','revoque') then raise exception 'Décision invalide.'; end if;
  update acces_parent_etudiant a
    set statut = p_decision, decide_le = now()
    from eleves el
    where a.id = p_acces and el.id = a.eleve_id and el.profil_id = v_uid;
  if not found then raise exception 'Demande introuvable ou non autorisée.'; end if;
end $$;

grant execute on function public.demander_acces_notes(uuid) to authenticated;
grant execute on function public.mon_acces_notes(uuid) to authenticated;
grant execute on function public.mes_demandes_acces() to authenticated;
grant execute on function public.decider_acces(uuid, text) to authenticated;

-- =====================================================================
--  A3 — Cloisonnement : notes & bulletins gatés par le consentement
--  (renvoi VIDE si non autorisé au supérieur, pour une UI propre).
-- =====================================================================

create or replace function public.enfant_notes(p_eleve uuid)
returns table(periode text, ordre int, matiere text, type text, valeur numeric, bareme numeric, coefficient numeric, date_eval date)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;
  return query
    select p.libelle, p.ordre, m.libelle, ev.type::text, n.valeur, ev.bareme, ev.coefficient, ev.date_eval
    from notes n
    join evaluations ev on ev.id = n.evaluation_id
    join periodes p on p.id = ev.periode_id
    join matieres m on m.id = ev.matiere_id
    where n.eleve_id = p_eleve and n.absent = false and n.valeur is not null
    order by p.ordre, m.libelle;
end $$;

-- Signature ACTUELLE (cf. 054) : + colonne `logo`.
drop function if exists public.enfant_bulletins(uuid);
create or replace function public.enfant_bulletins(p_eleve uuid)
returns table(
  id uuid, periode text, ordre int, moyenne numeric, rang int, effectif int, mention text,
  ecole text, sigle text, classe text, eleve_prenom text, eleve_nom text, matricule text, annee text,
  logo text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;
  return query
    select b.id, p.libelle, p.ordre, b.moyenne_generale, b.rang, b.effectif, b.mention,
           ec.nom, ec.sigle, c.libelle, e.prenom, e.nom, e.matricule, an.libelle,
           ec.logo_url
    from bulletins b
    join periodes p on p.id = b.periode_id
    join eleves e on e.id = b.eleve_id
    left join classes c on c.id = b.classe_id
    left join ecoles ec on ec.id = b.ecole_id
    left join annees_scolaires an on an.id = p.annee_id
    where b.eleve_id = p_eleve
    order by p.ordre;
end $$;
revoke execute on function public.enfant_bulletins(uuid) from public, anon;
grant execute on function public.enfant_bulletins(uuid) to authenticated;

-- Signature ACTUELLE (cf. 026) : + colonne `appreciation`.
drop function if exists public.enfant_bulletin_lignes(uuid);
create or replace function public.enfant_bulletin_lignes(p_bulletin uuid)
returns table(matiere text, moyenne numeric, coefficient numeric, appreciation text)
language plpgsql security definer set search_path = public as $$
declare v_eleve uuid;
begin
  select eleve_id into v_eleve from bulletins where id = p_bulletin;
  if v_eleve is null then raise exception 'Bulletin introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(v_eleve) then return; end if;
  return query
    select m.libelle, l.moyenne, l.coefficient, l.appreciation
    from bulletin_lignes l join matieres m on m.id = l.matiere_id
    where l.bulletin_id = p_bulletin order by m.libelle;
end $$;
revoke execute on function public.enfant_bulletin_lignes(uuid) from public, anon;
grant execute on function public.enfant_bulletin_lignes(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- Réappliquer 004 (enfant_notes) et 025 (enfant_bulletins/lignes) pour retirer
-- le gate, puis :
-- drop function if exists public.demander_acces_notes(uuid), public.mon_acces_notes(uuid),
--   public.mes_demandes_acces(), public.decider_acces(uuid,text), public._acces_notes_autorise(uuid);
-- drop table if exists acces_parent_etudiant;
