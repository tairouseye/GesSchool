-- =====================================================================
--  062 — Paiement en ligne : fondation (indépendante du prestataire)
--
--  Aujourd'hui le parent paie HORS de l'application (numéro Wave/OM
--  affiché), téléverse une preuve, et l'école valide à la main
--  (declarations_paiement + declarer_paiement). Double saisie, délai,
--  erreurs de rapprochement.
--
--  Objectif : le parent règle depuis l'app, et la facture se solde SEULE
--  — le trigger `recalc_facture` s'en charge dès qu'une ligne entre dans
--  `paiements`. Le webhook du prestataire n'a donc qu'à insérer là.
--
--  Choix structurants :
--   · L'argent va DIRECTEMENT à l'école → chaque établissement a son
--     propre compte marchand, donc ses propres clés (psp_config).
--   · Les clés sont des SECRETS : aucune policy de lecture pour les
--     utilisateurs. Seule l'Edge Function (service_role, qui contourne
--     RLS) y accède. Le client ne voit jamais qu'un résumé sans clés.
--   · La commission est à la charge de l'école OU du parent, au choix
--     de chaque établissement.
--   · `reference_psp` est UNIQUE : c'est ce qui garantit qu'un webhook
--     rejoué (les prestataires réessaient) ne crédite pas deux fois.
--
--  ⚠️ Cette migration est INERTE : tant qu'aucune école n'a de
--  configuration active, rien ne change — le flux manuel continue.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Configuration prestataire, par école (SECRETS)
-- ---------------------------------------------------------------------
create table if not exists public.psp_config (
  ecole_id            uuid primary key references ecoles(id) on delete cascade,
  prestataire         text not null default 'cinetpay',
  api_key             text,
  site_id             text,
  secret_webhook      text,
  actif               boolean not null default false,
  commission_a_charge text not null default 'ecole'
                      check (commission_a_charge in ('ecole', 'parent')),
  commission_taux     numeric(5,4) not null default 0.035,  -- 3,5 % : estimation affichée
  updated_at          timestamptz not null default now()
);

comment on table public.psp_config is
  'Clés marchandes du prestataire de paiement, par école. SECRET : lisible uniquement par les Edge Functions (service_role).';
comment on column public.psp_config.commission_a_charge is
  '« ecole » = l''école absorbe la commission ; « parent » = elle est ajoutée au montant payé.';
comment on column public.psp_config.commission_taux is
  'Taux estimé, sert à AFFICHER les frais au parent. Le montant réellement prélevé reste celui du prestataire.';

alter table public.psp_config enable row level security;
-- Aucune policy : personne ne lit ni n'écrit directement. Tout passe par
-- les RPC ci-dessous (écriture) et les Edge Functions (lecture).

-- ---------------------------------------------------------------------
--  2) Transactions — traçabilité et IDEMPOTENCE
-- ---------------------------------------------------------------------
create table if not exists public.transactions_paiement (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  facture_id     uuid not null references factures(id) on delete cascade,
  eleve_id       uuid references eleves(id) on delete set null,
  montant        numeric(12,2) not null,       -- montant imputé à la facture
  frais          numeric(12,2) not null default 0,  -- commission ajoutée si à charge du parent
  prestataire    text not null default 'cinetpay',
  reference_psp  text not null,
  statut         text not null default 'initiee'
                 check (statut in ('initiee', 'reussie', 'echouee', 'expiree')),
  payload        jsonb,                        -- réponse brute du prestataire (diagnostic)
  paiement_id    uuid references paiements(id) on delete set null,
  initiee_par    uuid references profils(id) on delete set null,
  created_at     timestamptz not null default now(),
  reglee_le      timestamptz
);

-- LE garde-fou anti-double-crédit : un webhook rejoué retombe sur la même ligne.
create unique index if not exists transactions_paiement_ref_uniq
  on public.transactions_paiement (prestataire, reference_psp);
create index if not exists transactions_paiement_ecole_idx
  on public.transactions_paiement (ecole_id, created_at desc);

alter table public.transactions_paiement enable row level security;

-- Lecture : le personnel de gestion suit les transactions de son école.
-- (Écriture réservée aux Edge Functions : aucune policy insert/update.)
drop policy if exists transactions_paiement_lecture on public.transactions_paiement;
create policy transactions_paiement_lecture on public.transactions_paiement
  for select using (
    est_super_admin()
    or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable') or a_role('secretaire')))
  );

-- ---------------------------------------------------------------------
--  3) Écriture de la configuration — promoteur uniquement
--     Les clés transitent par une RPC : la table reste inaccessible.
--     Une clé passée à NULL est CONSERVÉE (permet de modifier un réglage
--     sans avoir à ressaisir les secrets).
-- ---------------------------------------------------------------------
create or replace function public.set_psp_config(
  p_prestataire         text,
  p_api_key             text default null,
  p_site_id             text default null,
  p_secret_webhook      text default null,
  p_actif               boolean default null,
  p_commission_a_charge text default null,
  p_commission_taux     numeric default null
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

  insert into psp_config as c (ecole_id, prestataire, api_key, site_id, secret_webhook,
                               actif, commission_a_charge, commission_taux)
  values (v_ecole, coalesce(p_prestataire, 'cinetpay'), p_api_key, p_site_id, p_secret_webhook,
          coalesce(p_actif, false), coalesce(p_commission_a_charge, 'ecole'),
          coalesce(p_commission_taux, 0.035))
  on conflict (ecole_id) do update set
    prestataire         = coalesce(p_prestataire, c.prestataire),
    api_key             = coalesce(nullif(p_api_key, ''), c.api_key),
    site_id             = coalesce(nullif(p_site_id, ''), c.site_id),
    secret_webhook      = coalesce(nullif(p_secret_webhook, ''), c.secret_webhook),
    actif               = coalesce(p_actif, c.actif),
    commission_a_charge = coalesce(p_commission_a_charge, c.commission_a_charge),
    commission_taux     = coalesce(p_commission_taux, c.commission_taux),
    updated_at          = now();
end $$;

revoke execute on function public.set_psp_config(text, text, text, text, boolean, text, numeric)
  from public, anon;
grant execute on function public.set_psp_config(text, text, text, text, boolean, text, numeric)
  to authenticated;

-- ---------------------------------------------------------------------
--  4) Résumé SANS SECRETS — côté école
--     Indique si c'est configuré, jamais avec quoi.
-- ---------------------------------------------------------------------
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
           'commission_a_charge', c.commission_a_charge,
           'commission_taux', c.commission_taux,
           'cles_saisies', (c.api_key is not null and c.site_id is not null),
           'secret_saisi', (c.secret_webhook is not null),
           'updated_at', c.updated_at)
    into v
    from psp_config c where c.ecole_id = v_ecole;
  return coalesce(v, jsonb_build_object('actif', false, 'cles_saisies', false));
end $$;

revoke execute on function public.psp_etat() from public, anon;
grant execute on function public.psp_etat() to authenticated;

-- ---------------------------------------------------------------------
--  5) Résumé SANS SECRETS — côté parent
--     Permet d'afficher (ou non) le bouton « Payer en ligne » et le
--     détail des frais. Même garde que les autres RPC parent.
-- ---------------------------------------------------------------------
create or replace function public.psp_etat_eleve(p_eleve uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ecole uuid; v jsonb;
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select ecole_id into v_ecole from eleves where id = p_eleve;
  select jsonb_build_object(
           'actif', c.actif,
           'prestataire', c.prestataire,
           'commission_a_charge', c.commission_a_charge,
           'commission_taux', c.commission_taux)
    into v
    from psp_config c
   where c.ecole_id = v_ecole and c.actif and c.api_key is not null;
  return coalesce(v, jsonb_build_object('actif', false));
end $$;

revoke execute on function public.psp_etat_eleve(uuid) from public, anon;
grant execute on function public.psp_etat_eleve(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION (retour complet à l'état d'avant 062)
--
--    drop function if exists public.psp_etat_eleve(uuid);
--    drop function if exists public.psp_etat();
--    drop function if exists public.set_psp_config(text, text, text, text, boolean, text, numeric);
--    drop table if exists public.transactions_paiement;
--    drop table if exists public.psp_config;
--    notify pgrst, 'reload schema';
--
--  Sans effet sur l'existant : aucune table préexistante n'est modifiée,
--  le flux manuel (declarations_paiement) est intact, et les paiements
--  déjà enregistrés ne sont pas touchés.
--  ⚠️ Vérifier d'abord qu'aucune transaction réelle n'y est consignée :
--    select statut, count(*) from transactions_paiement group by statut;
-- =====================================================================
