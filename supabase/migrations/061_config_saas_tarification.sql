-- =====================================================================
--  061 — Hypothèses de tarification (console super-admin)
--
--  Objectif : bâtir les offres à partir des COÛTS, CHARGES et MARGES
--  réels plutôt qu'au doigt mouillé. Le simulateur de la console
--  super-admin calcule le prix de chaque palier et le seuil de
--  rentabilité ; ses hypothèses (coûts fixes, taux horaire, marge visée)
--  sont stockées ici pour suivre d'un appareil à l'autre.
--
--  Données strictement internes à GesPro : aucune école n'y accède.
-- =====================================================================

create table if not exists public.config_saas (
  cle         text primary key,
  valeur      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.config_saas is
  'Réglages internes GesPro (hors tenant). Lecture/écriture super-admin uniquement.';

alter table public.config_saas enable row level security;

-- Aucun accès pour les membres des écoles : ni lecture, ni écriture.
drop policy if exists config_saas_admin on public.config_saas;
create policy config_saas_admin on public.config_saas
  for all using (est_super_admin()) with check (est_super_admin());

-- ---------------------------------------------------------------------
--  RPC : appliquer un tarif à un plan depuis le simulateur.
--  Passe par une fonction plutôt qu'un update direct pour garder la
--  vérification du rôle en base (les policies de plans_abonnement
--  autorisent déjà le super-admin, mais on veut un point d'entrée
--  explicite et traçable).
-- ---------------------------------------------------------------------
drop function if exists public.admin_set_plan_tarif(text, numeric, numeric, int);
create or replace function public.admin_set_plan_tarif(
  p_code         text,
  p_prix_mensuel numeric,
  p_prix_annuel  numeric,
  p_max_eleves   int default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  update plans_abonnement
     set prix_mensuel = coalesce(p_prix_mensuel, prix_mensuel),
         prix_annuel  = coalesce(p_prix_annuel, prix_annuel),
         max_eleves   = coalesce(p_max_eleves, max_eleves)
   where code = p_code;
  if not found then
    raise exception 'Plan « % » introuvable.', p_code;
  end if;
end $$;

revoke execute on function public.admin_set_plan_tarif(text, numeric, numeric, int) from public, anon;
grant execute on function public.admin_set_plan_tarif(text, numeric, numeric, int) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION (retour à l'état d'avant 061)
--
--    drop function if exists public.admin_set_plan_tarif(text, numeric, numeric, int);
--    drop table if exists public.config_saas;
--    notify pgrst, 'reload schema';
--
--  Sans risque : `config_saas` ne stocke que des hypothèses de calcul
--  (aucune donnée d'école), et la fonction n'est appelée que par le
--  simulateur. Les prix déjà appliqués aux plans restent en place — les
--  remettre à 0 si souhaité :
--    update plans_abonnement set prix_mensuel = 0, prix_annuel = 0;
-- =====================================================================
