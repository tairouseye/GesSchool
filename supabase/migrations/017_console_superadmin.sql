-- =====================================================================
--  017 — Console super-admin (pilotage SaaS des écoles clientes)
--  Rétablit dans le versionnement les RPC introduites en v2.9.0 mais
--  jamais committées comme migration. Toutes sont protégées par
--  est_super_admin() (sinon : exception). Appelées par src/lib/superadmin.js.
--
--  ⚠️ RECONSTRUCTION fidèle au contrat observé côté front
--  (src/pages/SuperAdmin.jsx + src/lib/superadmin.js). Si des versions
--  existent déjà en production, vérifie qu'elles correspondent AVANT
--  d'appliquer ce fichier (create or replace écrase la version en place) :
--
--    select pg_get_functiondef(p.oid)
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('admin_ecoles','admin_set_abonnement',
--                        'admin_set_statut','admin_set_modules');
-- =====================================================================

-- ---------------------------------------------------------------------
--  Liste consolidée des écoles clientes (+ abonnement courant + modules)
--  Contrat de retour attendu par SuperAdmin.jsx :
--    ecole_id, nom, sigle, effectif, plan_code, plan_libelle,
--    statut, fin, modules
-- ---------------------------------------------------------------------
create or replace function public.admin_ecoles()
returns table(
  ecole_id     uuid,
  nom          text,
  sigle        text,
  effectif     bigint,
  plan_code    text,
  plan_libelle text,
  statut       statut_abonnement,
  fin          date,
  modules      text[]
)
language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  return query
    select
      e.id, e.nom, e.sigle,
      (select count(*) from eleves el where el.ecole_id = e.id),
      pa.code, pa.libelle, ab.statut, ab.fin, e.modules_actifs
    from ecoles e
    left join lateral (
      select a.* from abonnements a
      where a.ecole_id = e.id
      order by a.debut desc, a.created_at desc
      limit 1
    ) ab on true
    left join plans_abonnement pa on pa.id = ab.plan_id
    order by e.nom;
end $$;

-- ---------------------------------------------------------------------
--  Définir / mettre à jour l'abonnement d'une école.
--  « Appliquer un plan active automatiquement ses modules » : si le plan
--  porte une liste de modules (plans_abonnement.fonctions->'modules'),
--  elle est recopiée sur l'école.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_abonnement(
  p_ecole  uuid,
  p_plan   uuid,
  p_statut statut_abonnement,
  p_fin    date default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_abo uuid; v_mods text[];
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;

  select id into v_abo from abonnements
   where ecole_id = p_ecole
   order by debut desc, created_at desc
   limit 1;

  if v_abo is null then
    insert into abonnements (ecole_id, plan_id, statut, fin)
    values (p_ecole, p_plan, p_statut, p_fin);
  else
    update abonnements set plan_id = p_plan, statut = p_statut, fin = p_fin
     where id = v_abo;
  end if;

  -- Modules portés par le plan (optionnel)
  select case
           when jsonb_typeof(pa.fonctions -> 'modules') = 'array'
           then array(select jsonb_array_elements_text(pa.fonctions -> 'modules'))
         end
    into v_mods
  from plans_abonnement pa where pa.id = p_plan;

  if v_mods is not null then
    update ecoles set modules_actifs = v_mods where id = p_ecole;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  Changer uniquement le statut de l'abonnement courant.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_statut(
  p_ecole  uuid,
  p_statut statut_abonnement
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  update abonnements set statut = p_statut
   where id = (
     select id from abonnements where ecole_id = p_ecole
     order by debut desc, created_at desc limit 1
   );
end $$;

-- ---------------------------------------------------------------------
--  Ajustement fin des modules d'une école (override manuel).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_modules(
  p_ecole   uuid,
  p_modules text[]
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  update ecoles set modules_actifs = p_modules where id = p_ecole;
end $$;

grant execute on function public.admin_ecoles() to authenticated;
grant execute on function public.admin_set_abonnement(uuid, uuid, statut_abonnement, date) to authenticated;
grant execute on function public.admin_set_statut(uuid, statut_abonnement) to authenticated;
grant execute on function public.admin_set_modules(uuid, text[]) to authenticated;
