-- =====================================================================
--  065 — Mode test/production pour le paiement en ligne
--
--  Complète la fondation (062) : chaque école doit pouvoir brancher son
--  compte prestataire en BAC À SABLE d'abord, puis passer en production.
--  On ajoute `mode` ('test' | 'live') à psp_config, et on l'expose dans
--  les RPC de configuration.
-- =====================================================================

alter table public.psp_config
  add column if not exists mode text not null default 'test'
  check (mode in ('test', 'live'));

comment on column public.psp_config.mode is
  'test = bac à sable du prestataire ; live = production. On démarre TOUJOURS en test.';

-- set_psp_config : nouvelle signature avec p_mode (on remplace l'ancienne).
drop function if exists public.set_psp_config(text, text, text, text, boolean, text, numeric);
create or replace function public.set_psp_config(
  p_prestataire         text,
  p_api_key             text default null,
  p_site_id             text default null,
  p_secret_webhook      text default null,
  p_actif               boolean default null,
  p_commission_a_charge text default null,
  p_commission_taux     numeric default null,
  p_mode                text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante();
begin
  if v_ecole is null then raise exception 'Aucun établissement courant.'; end if;
  if not (est_super_admin() or a_role('admin_ecole')) then
    raise exception 'Réservé au promoteur.';
  end if;
  if p_commission_a_charge is not null
     and p_commission_a_charge not in ('ecole', 'parent') then
    raise exception 'Valeur invalide pour la prise en charge de la commission.';
  end if;
  if p_mode is not null and p_mode not in ('test', 'live') then
    raise exception 'Mode invalide (test | live).';
  end if;

  insert into psp_config as c (ecole_id, prestataire, api_key, site_id, secret_webhook,
                               actif, commission_a_charge, commission_taux, mode)
  values (v_ecole, coalesce(p_prestataire, 'cinetpay'), p_api_key, p_site_id, p_secret_webhook,
          coalesce(p_actif, false), coalesce(p_commission_a_charge, 'ecole'),
          coalesce(p_commission_taux, 0.035), coalesce(p_mode, 'test'))
  on conflict (ecole_id) do update set
    prestataire         = coalesce(p_prestataire, c.prestataire),
    api_key             = coalesce(nullif(p_api_key, ''), c.api_key),
    site_id             = coalesce(nullif(p_site_id, ''), c.site_id),
    secret_webhook      = coalesce(nullif(p_secret_webhook, ''), c.secret_webhook),
    actif               = coalesce(p_actif, c.actif),
    commission_a_charge = coalesce(p_commission_a_charge, c.commission_a_charge),
    commission_taux     = coalesce(p_commission_taux, c.commission_taux),
    mode                = coalesce(p_mode, c.mode),
    updated_at          = now();
end $$;

revoke execute on function public.set_psp_config(text, text, text, text, boolean, text, numeric, text)
  from public, anon;
grant execute on function public.set_psp_config(text, text, text, text, boolean, text, numeric, text)
  to authenticated;

-- psp_etat : expose aussi le mode (sans jamais les clés).
create or replace function public.psp_etat()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v jsonb;
begin
  if v_ecole is null then return '{}'::jsonb; end if;
  if not (est_super_admin() or a_role('admin_ecole')) then
    raise exception 'Réservé au promoteur.';
  end if;
  select jsonb_build_object(
           'prestataire', c.prestataire,
           'actif', c.actif,
           'mode', c.mode,
           'commission_a_charge', c.commission_a_charge,
           'commission_taux', c.commission_taux,
           'cles_saisies', (c.api_key is not null and c.site_id is not null),
           'secret_saisi', (c.secret_webhook is not null),
           'updated_at', c.updated_at)
    into v
    from psp_config c where c.ecole_id = v_ecole;
  return coalesce(v, jsonb_build_object('actif', false, 'mode', 'test', 'cles_saisies', false));
end $$;

revoke execute on function public.psp_etat() from public, anon;
grant execute on function public.psp_etat() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
--    drop function if exists public.set_psp_config(text, text, text, text, boolean, text, numeric, text);
--    -- puis rejouer set_psp_config / psp_etat de la migration 062
--    alter table public.psp_config drop column if exists mode;
--    notify pgrst, 'reload schema';
-- =====================================================================
