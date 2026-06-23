-- =====================================================================
--  004 — Espace parent (accès restreint à ses propres enfants)
--  Principe de sécurité : le compte parent n'a PAS d'ecole_id (donc les
--  policies tenant ne lui exposent rien). Tout l'accès aux données de
--  ses enfants passe par des fonctions SECURITY DEFINER qui vérifient
--  le lien parent → enfant.
-- =====================================================================

-- Code de liaison (généré par l'admin, communiqué au parent)
alter table public.tuteurs add column if not exists code_acces text;

-- Le parent doit pouvoir lire SES rôles (ecole_courante() est null pour lui)
drop policy if exists profil_roles_self on public.profil_roles;
create policy profil_roles_self on public.profil_roles
  for select using (profil_id = auth.uid());

-- Vérifie que l'utilisateur courant est tuteur de l'élève
create or replace function public._parent_possede(p_eleve uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tuteurs t
    join eleve_tuteurs et on et.tuteur_id = t.id
    where t.profil_id = auth.uid() and et.eleve_id = p_eleve
  )
$$;

-- Liste des enfants du parent (+ classe courante)
create or replace function public.mes_enfants()
returns table(eleve_id uuid, prenom text, nom text, matricule text, classe text, ecole text)
language sql security definer set search_path = public as $$
  select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom
  from tuteurs t
  join eleve_tuteurs et on et.tuteur_id = t.id
  join eleves e on e.id = et.eleve_id
  left join ecoles ec on ec.id = e.ecole_id
  left join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
  left join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
  left join classes c on c.id = ins.classe_id
  where t.profil_id = auth.uid()
  order by e.nom, e.prenom
$$;

-- Notes d'un enfant
create or replace function public.enfant_notes(p_eleve uuid)
returns table(periode text, ordre int, matiere text, type text, valeur numeric, bareme numeric, coefficient numeric, date_eval date)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select p.libelle, p.ordre, m.libelle, ev.type::text, n.valeur, ev.bareme, ev.coefficient, ev.date_eval
    from notes n
    join evaluations ev on ev.id = n.evaluation_id
    join periodes p on p.id = ev.periode_id
    join matieres m on m.id = ev.matiere_id
    where n.eleve_id = p_eleve and n.absent = false and n.valeur is not null
    order by p.ordre, m.libelle;
end $$;

-- Factures / paiements d'un enfant
create or replace function public.enfant_factures(p_eleve uuid)
returns table(numero text, date_emission date, date_echeance date, montant_total numeric, montant_paye numeric, statut text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select f.numero, f.date_emission, f.date_echeance, f.montant_total, f.montant_paye, f.statut::text
    from factures f where f.eleve_id = p_eleve order by f.date_emission desc;
end $$;

-- Absences d'un enfant
create or replace function public.enfant_absences(p_eleve uuid)
returns table(date_abs date, type text, statut text, motif text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select a.date_abs, a.type::text, a.statut::text, a.motif
    from absences a where a.eleve_id = p_eleve order by a.date_abs desc;
end $$;

-- Liaison du compte parent via un code
create or replace function public.lier_parent(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_t from tuteurs where code_acces = p_code limit 1;
  if v_t is null then raise exception 'Code invalide.'; end if;

  select email into v_email from auth.users where id = v_uid;

  -- Profil parent SANS ecole_id (aucune exposition via les policies tenant)
  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, null, coalesce(v_t.prenom, 'Parent'), coalesce(v_t.nom, ''), v_email)
  on conflict (id) do update set prenom = excluded.prenom, nom = excluded.nom, email = excluded.email;

  update tuteurs set profil_id = v_uid where id = v_t.id;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_t.ecole_id, 'parent')
  on conflict (profil_id, ecole_id, role) do nothing;

  return v_t.id;
end $$;

-- Génération d'un code de liaison par l'admin de l'école
create or replace function public.generer_code_tuteur(p_tuteur uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from tuteurs where id = p_tuteur;
  if v_ecole is null then raise exception 'Tuteur introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and a_role('admin_ecole')) then
    raise exception 'Réservé à l''administrateur de l''école.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update tuteurs set code_acces = v_code where id = p_tuteur;
  return v_code;
end $$;

grant execute on function public.mes_enfants() to authenticated;
grant execute on function public.enfant_notes(uuid) to authenticated;
grant execute on function public.enfant_factures(uuid) to authenticated;
grant execute on function public.enfant_absences(uuid) to authenticated;
grant execute on function public.lier_parent(text) to authenticated;
grant execute on function public.generer_code_tuteur(uuid) to authenticated;
