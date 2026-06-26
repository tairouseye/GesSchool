-- =====================================================================
--  010 — Espace Pilotage (promoteur multi-écoles)
--  Un promoteur possède 1..N écoles (table proprietaires). Il peut voir
--  une synthèse consolidée et « entrer » dans une école pour la gérer.
-- =====================================================================

-- Liens promoteur → écoles possédées
create table if not exists proprietaires (
  profil_id   uuid not null references profils(id) on delete cascade,
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profil_id, ecole_id)
);

alter table proprietaires enable row level security;
drop policy if exists proprietaires_self on proprietaires;
create policy proprietaires_self on proprietaires
  for select using (profil_id = auth.uid() or est_super_admin());

-- Amorçage : les admins/directions existants deviennent propriétaires de leur école
insert into proprietaires (profil_id, ecole_id)
  select distinct pr.profil_id, pr.ecole_id
  from profil_roles pr
  where pr.role in ('admin_ecole', 'direction') and pr.ecole_id is not null
on conflict do nothing;

-- Synthèse consolidée des écoles possédées (KPIs par établissement)
create or replace function public.pilotage_synthese()
returns table(
  ecole_id uuid, ecole text, sigle text,
  effectif bigint,
  total_facture numeric, total_paye numeric,
  tresorerie numeric,
  masse_salariale numeric,
  recettes_annee numeric, depenses_annee numeric, scolarite_annee numeric
)
language sql security definer set search_path = public as $$
  select
    e.id, e.nom, e.sigle,
    (select count(*) from eleves el where el.ecole_id = e.id),
    coalesce((select sum(f.montant_total) from factures f where f.ecole_id = e.id), 0),
    coalesce((select sum(f.montant_paye)  from factures f where f.ecole_id = e.id), 0),
    coalesce((select sum(c.solde_initial) from comptes c where c.ecole_id = e.id), 0)
      + coalesce((select sum(r.montant) from recettes r where r.ecole_id = e.id), 0)
      - coalesce((select sum(d.montant) from depenses d where d.ecole_id = e.id), 0),
    coalesce((select sum(s.montant_net) from salaires s
              where s.ecole_id = e.id and s.periode = to_char(current_date, 'YYYY-MM')), 0),
    coalesce((select sum(r.montant) from recettes r
              where r.ecole_id = e.id and r.date_recette >= date_trunc('year', current_date)), 0),
    coalesce((select sum(d.montant) from depenses d
              where d.ecole_id = e.id and d.date_depense >= date_trunc('year', current_date)), 0),
    coalesce((select sum(p.montant) from paiements p
              where p.ecole_id = e.id and p.date_paiement >= date_trunc('year', current_date)), 0)
  from ecoles e
  where e.id in (select ecole_id from proprietaires where profil_id = auth.uid())
  order by e.nom;
$$;
grant execute on function public.pilotage_synthese() to authenticated;

-- « Entrer » dans une école : bascule l'école active du promoteur.
create or replace function public.entrer_ecole(p_ecole uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from proprietaires where profil_id = auth.uid() and ecole_id = p_ecole) then
    raise exception 'Accès refusé à cette école.';
  end if;
  update profils set ecole_id = p_ecole where id = auth.uid();
end $$;
grant execute on function public.entrer_ecole(uuid) to authenticated;

-- Onboarding revu : autorise un promoteur à créer des écoles supplémentaires
-- et rattache chaque nouvelle école au promoteur (proprietaires).
create or replace function creer_ecole_et_admin(
  p_nom                text,
  p_sigle              text,
  p_type_etablissement text,
  p_cycles             type_cycle[],
  p_couleur_primaire   text,
  p_couleur_secondaire text,
  p_logo_url           text,
  p_cachet_url         text,
  p_prenom             text,
  p_nom_admin          text,
  p_annee_libelle      text,
  p_annee_debut        date,
  p_annee_fin          date,
  p_decoupage          text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_ecole  uuid;
  v_annee  uuid;
  v_cycle  type_cycle;
  v_ordre  int := 0;
  v_nb     int;
  i        int;
begin
  if v_uid is null then
    raise exception 'Non authentifié.';
  end if;

  -- Bloque uniquement si déjà rattaché ET pas (encore) promoteur.
  if exists (select 1 from profils where id = v_uid and ecole_id is not null)
     and not exists (select 1 from proprietaires where profil_id = v_uid) then
    raise exception 'Ce compte est déjà rattaché à un établissement.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into ecoles (nom, sigle, type_etablissement, cycles_actifs,
                      couleur_primaire, couleur_secondaire, logo_url, cachet_url, email)
  values (p_nom, p_sigle, p_type_etablissement, coalesce(p_cycles, '{}'),
          coalesce(p_couleur_primaire, '#0B1F3A'),
          coalesce(p_couleur_secondaire, '#C9A227'),
          p_logo_url, p_cachet_url, v_email)
  returning id into v_ecole;

  foreach v_cycle in array coalesce(p_cycles, '{}') loop
    v_ordre := v_ordre + 1;
    insert into cycles (ecole_id, type, libelle, ordre)
    values (v_ecole, v_cycle, libelle_cycle(v_cycle), v_ordre);
  end loop;

  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, v_ecole, coalesce(p_prenom, 'Admin'), coalesce(p_nom_admin, ''), v_email)
  on conflict (id) do update
    set ecole_id = excluded.ecole_id, prenom = excluded.prenom,
        nom = excluded.nom, email = excluded.email;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_ecole, 'admin_ecole')
  on conflict (profil_id, ecole_id, role) do nothing;

  -- Rattache la nouvelle école au promoteur
  insert into proprietaires (profil_id, ecole_id)
  values (v_uid, v_ecole)
  on conflict do nothing;

  insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante)
  values (v_ecole, p_annee_libelle, p_annee_debut, p_annee_fin, true)
  returning id into v_annee;

  v_nb := case when p_decoupage = 'semestre' then 2 else 3 end;
  for i in 1..v_nb loop
    insert into periodes (ecole_id, annee_id, libelle, ordre)
    values (v_ecole, v_annee,
      case when p_decoupage = 'semestre' then 'Semestre ' else 'Trimestre ' end || i, i);
  end loop;

  return v_ecole;
end;
$$;
