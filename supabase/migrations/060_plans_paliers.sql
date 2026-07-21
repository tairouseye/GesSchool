-- =====================================================================
--  060 — Forfait par PALIER D'EFFECTIF (et non « par élève »)
--
--  Contexte commercial : la facturation « au prorata du nombre d'élèves »
--  a été contestée par un prospect — elle punit la croissance et se
--  budgétise mal. On bascule sur un forfait par tranche d'effectif, que
--  la table `plans_abonnement` supporte déjà (`max_eleves`) mais qui
--  n'était pas renseigné : les 3 plans existants sont à prix 0 et sans
--  aucun plafond.
--
--  Cette migration pose la STRUCTURE (paliers + colonne prix annuel).
--  Les MONTANTS restent à 0 : ils se règlent depuis la console
--  super-admin (simulateur de tarification), pas en dur ici.
--
--  ⚠️ Aucun blocage n'est introduit : `max_eleves` sert à afficher un
--  quota et une alerte à 90 %. Jamais à couper l'accès d'une école en
--  cours d'année scolaire.
-- =====================================================================

-- 1) Prix annuel (le prix mensuel existant reste utilisable)
alter table public.plans_abonnement
  add column if not exists prix_annuel numeric(12,2) not null default 0;

comment on column public.plans_abonnement.prix_annuel is
  'Forfait annuel du palier. 0 = non tarifé (à définir dans la console super-admin).';
comment on column public.plans_abonnement.max_eleves is
  'Plafond d''effectif du palier (null = illimité). Indicatif : alerte à 90 %, jamais de blocage.';

-- 2) Paliers d'effectif sur les plans existants
update public.plans_abonnement set max_eleves = 150 where code = 'socle'    and max_eleves is null;
update public.plans_abonnement set max_eleves = 400 where code = 'standard' and max_eleves is null;
update public.plans_abonnement set max_eleves = 800 where code = 'premium'  and max_eleves is null;

-- 3) Palier « Campus » (grands groupes scolaires, sur devis)
insert into public.plans_abonnement (code, libelle, prix_mensuel, prix_annuel, max_eleves, actif)
values ('campus', 'Campus', 0, 0, null, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
--  4) RPC : le promoteur consulte SON abonnement
--     Aujourd'hui il ne voit nulle part son plan, son échéance ni son
--     quota. SECURITY DEFINER car `abonnements` et `plans_abonnement`
--     ne sont pas lisibles librement.
-- ---------------------------------------------------------------------
drop function if exists public.mon_abonnement();
create or replace function public.mon_abonnement()
returns table(
  plan_code text, plan_libelle text,
  prix_mensuel numeric, prix_annuel numeric,
  max_eleves int, max_classes int,
  statut text, debut date, fin date,
  effectif bigint, nb_classes bigint,
  modules_actifs text[]
)
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante();
begin
  if v_ecole is null then raise exception 'Aucun établissement courant.'; end if;
  -- Réservé au promoteur de l'établissement (ou au super-admin).
  if not (est_super_admin() or a_role('admin_ecole')) then
    raise exception 'Réservé au promoteur.';
  end if;

  return query
    select p.code, p.libelle, p.prix_mensuel, p.prix_annuel,
           p.max_eleves, p.max_classes,
           a.statut::text, a.debut, a.fin,
           (select count(*) from eleves el where el.ecole_id = v_ecole),
           (select count(*) from classes c
              join annees_scolaires an on an.id = c.annee_id
             where c.ecole_id = v_ecole and an.courante),
           e.modules_actifs
      from ecoles e
      left join abonnements a on a.ecole_id = e.id
      left join plans_abonnement p on p.id = a.plan_id
     where e.id = v_ecole
     order by a.debut desc nulls last
     limit 1;
end $$;

revoke execute on function public.mon_abonnement() from public, anon;
grant execute on function public.mon_abonnement() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION (retour à l'état d'avant 060)
--
--    drop function if exists public.mon_abonnement();
--    delete from public.plans_abonnement where code = 'campus';
--    update public.plans_abonnement set max_eleves = null
--      where code in ('socle','standard','premium');
--    alter table public.plans_abonnement drop column if exists prix_annuel;
--    notify pgrst, 'reload schema';
--
--  Sans risque : `prix_annuel` et le palier « Campus » ne sont référencés
--  par aucune autre table. Le `delete` ne peut pas emporter d'abonnement
--  existant — aucune école n'est sur « Campus » au moment de la migration
--  (le plan vient d'être créé). Vérifier malgré tout avant de le jouer :
--    select count(*) from abonnements a
--      join plans_abonnement p on p.id = a.plan_id where p.code = 'campus';
-- =====================================================================
