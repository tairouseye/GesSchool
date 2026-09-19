-- =====================================================================
--  124 — Bibliothèque : INVENTAIRE (récolement)
--
--  Une campagne délimite un PÉRIMÈTRE (toute la bibliothèque, une salle, un
--  rayon…). On scanne les codes-barres au fil des rayons, puis on compare le
--  réel au catalogue.
--
--  Nuance métier importante : un exemplaire EMPRUNTÉ n'est pas « manquant ».
--  Il est légitimement absent du rayon — le confondre avec une perte ferait
--  paniquer pour rien. Le rapport les compte séparément.
--
--  Le rapprochement est fait EN BASE (`rapport_inventaire`) : sur 500 000
--  exemplaires, comparer deux listes au navigateur n'est pas envisageable.
--
--  Prérequis : migrations 117 → 123.
-- =====================================================================

create table if not exists biblio_inventaires (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  libelle         text not null,
  bibliotheque_id uuid references biblio_bibliotheques(id) on delete set null,
  localisation_id uuid references biblio_localisations(id) on delete set null,
  statut          text not null default 'en_cours' check (statut in ('en_cours','cloture')),
  debut           date not null default current_date,
  fin             date,
  note            text,
  cree_par        uuid references profils(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists biblio_inventaires_ecole_idx on biblio_inventaires(ecole_id, statut, created_at desc);

--  Un scan par exemplaire et par campagne : repasser deux fois devant le même
--  livre ne doit pas le compter deux fois. Les codes INCONNUS (exemplaire_id
--  null) sont conservés tels quels — ce sont des anomalies à examiner.
create table if not exists biblio_inventaire_scans (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  inventaire_id   uuid not null references biblio_inventaires(id) on delete cascade,
  exemplaire_id   uuid references biblio_exemplaires(id) on delete cascade,
  code_barres     text,
  agent_profil_id uuid references profils(id) on delete set null,
  scanne_le       timestamptz not null default now()
);
create unique index if not exists biblio_inv_scans_unique
  on biblio_inventaire_scans(inventaire_id, exemplaire_id) where exemplaire_id is not null;
create index if not exists biblio_inv_scans_inv_idx on biblio_inventaire_scans(inventaire_id);
create index if not exists biblio_inv_scans_ecole_idx on biblio_inventaire_scans(ecole_id);

-- =====================================================================
--  RLS — gestion uniquement (opération interne)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['biblio_inventaires','biblio_inventaire_scans']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (_biblio_gestion(ecole_id));$p$, t, t);
    execute format($p$create policy %I_ecrire on %I for all
      using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));$p$, t, t);
  end loop;
end $$;

-- =====================================================================
--  Scanner un code-barres dans une campagne
-- =====================================================================
--  Renvoie un jsonb décrivant ce qui vient d'être scanné, pour un retour
--  immédiat au bibliothécaire :
--    resultat = 'ok' | 'deja' | 'hors_perimetre' | 'inconnu'
create or replace function public.scanner_inventaire(p_inventaire uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv biblio_inventaires;
  ex  biblio_exemplaires;
  v_titre text;
  v_dans_perimetre boolean;
  v_deja boolean;
begin
  select * into inv from biblio_inventaires where id = p_inventaire;
  if inv is null then raise exception 'Campagne introuvable.'; end if;
  if not _biblio_gestion(inv.ecole_id) then
    raise exception 'Réservé à la gestion de la bibliothèque.';
  end if;
  if inv.statut <> 'en_cours' then raise exception 'Cette campagne est clôturée.'; end if;

  p_code := nullif(btrim(coalesce(p_code, '')), '');
  if p_code is null then raise exception 'Code-barres vide.'; end if;

  select * into ex from biblio_exemplaires
   where ecole_id = inv.ecole_id and code_barres = p_code;

  -- Code inconnu : on trace quand même, c'est une anomalie à traiter.
  if ex is null then
    insert into biblio_inventaire_scans (ecole_id, inventaire_id, code_barres, agent_profil_id)
    values (inv.ecole_id, p_inventaire, p_code, auth.uid());
    return jsonb_build_object('resultat', 'inconnu', 'code_barres', p_code);
  end if;

  select r.titre into v_titre from biblio_ressources r where r.id = ex.ressource_id;

  v_dans_perimetre :=
       (inv.bibliotheque_id is null or ex.bibliotheque_id = inv.bibliotheque_id)
   and (inv.localisation_id is null or ex.localisation_id = inv.localisation_id);

  select exists (select 1 from biblio_inventaire_scans s
                  where s.inventaire_id = p_inventaire and s.exemplaire_id = ex.id)
    into v_deja;

  if not v_deja then
    insert into biblio_inventaire_scans (ecole_id, inventaire_id, exemplaire_id, code_barres, agent_profil_id)
    values (inv.ecole_id, p_inventaire, ex.id, p_code, auth.uid());
  end if;

  return jsonb_build_object(
    'resultat', case when v_deja then 'deja'
                     when not v_dans_perimetre then 'hors_perimetre'
                     else 'ok' end,
    'exemplaire_id', ex.id, 'code_barres', p_code, 'titre', v_titre,
    'cote', ex.cote, 'statut', ex.statut);
end $$;

revoke execute on function public.scanner_inventaire(uuid, text) from public, anon;
grant execute on function public.scanner_inventaire(uuid, text) to authenticated;

-- =====================================================================
--  Rapport de récolement
-- =====================================================================
--  `manquants` = attendus au rayon, jamais scannés, et NI empruntés NI
--  retirés. Ce sont les vrais introuvables.
create or replace function public.rapport_inventaire(p_inventaire uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  inv biblio_inventaires;
  v jsonb;
begin
  select * into inv from biblio_inventaires where id = p_inventaire;
  if inv is null then raise exception 'Campagne introuvable.'; end if;
  if not _biblio_gestion(inv.ecole_id) then
    raise exception 'Réservé à la gestion de la bibliothèque.';
  end if;

  with perimetre as (
    select e.* from biblio_exemplaires e
     where e.ecole_id = inv.ecole_id
       and (inv.bibliotheque_id is null or e.bibliotheque_id = inv.bibliotheque_id)
       and (inv.localisation_id is null or e.localisation_id = inv.localisation_id)
  ),
  scannes as (
    select s.exemplaire_id from biblio_inventaire_scans s
     where s.inventaire_id = p_inventaire and s.exemplaire_id is not null
  ),
  absents as (
    select p.* from perimetre p
     where p.id not in (select exemplaire_id from scannes)
  )
  select jsonb_build_object(
    'attendus',   (select count(*) from perimetre),
    'scannes',    (select count(*) from scannes),
    'empruntes',  (select count(*) from absents where statut = 'emprunte'),
    'retires',    (select count(*) from absents where statut in ('retire','perdu')),
    'manquants',  (select count(*) from absents where statut not in ('emprunte','retire','perdu')),
    'inconnus',   (select count(*) from biblio_inventaire_scans s
                    where s.inventaire_id = p_inventaire and s.exemplaire_id is null),
    'hors_perimetre', (select count(*) from biblio_inventaire_scans s
                        join biblio_exemplaires e on e.id = s.exemplaire_id
                       where s.inventaire_id = p_inventaire
                         and not ((inv.bibliotheque_id is null or e.bibliotheque_id = inv.bibliotheque_id)
                              and (inv.localisation_id is null or e.localisation_id = inv.localisation_id))),
    -- Les 100 premiers manquants, pour partir les chercher en rayon.
    'liste_manquants', coalesce((
      select jsonb_agg(t) from (
        select a.id, a.code_barres, a.cote, r.titre
          from absents a
          left join biblio_ressources r on r.id = a.ressource_id
         where a.statut not in ('emprunte','retire','perdu')
         order by a.cote nulls last, r.titre
         limit 100
      ) t), '[]'::jsonb)
  ) into v;

  return v;
end $$;

revoke execute on function public.rapport_inventaire(uuid) from public, anon;
grant execute on function public.rapport_inventaire(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.rapport_inventaire(uuid);
-- drop function if exists public.scanner_inventaire(uuid, text);
-- drop table if exists biblio_inventaire_scans, biblio_inventaires cascade;
