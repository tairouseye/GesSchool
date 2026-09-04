-- =====================================================================
--  075 — Trésorerie : la scolarité encaissée alimente la caisse
--  Problème : les paiements (scolarité) ne touchaient aucun compte, alors
--  que les dépenses (dont salaires) en sortaient → le solde de trésorerie
--  était structurellement sous-évalué et incohérent avec le « résultat ».
--  Correctif : on rattache un encaissement à un compte de trésorerie
--  (comme une recette) et on l'ajoute aux ENTRÉES du compte.
--  Rétro-compat : les paiements existants restent à compte_id = null
--  (non imputés) — sans impact sur l'unicité ni sur les factures.
-- =====================================================================

-- 1) Rattachement d'un encaissement à un compte de trésorerie.
alter table paiements
  add column if not exists compte_id uuid references comptes(id) on delete set null;

create index if not exists paiements_compte_idx on paiements(compte_id);

-- 2) soldes_comptes : ENTRÉES = recettes + paiements (scolarité) du compte.
create or replace function public.soldes_comptes(p_ecole uuid)
returns table(compte_id uuid, entrees numeric, sorties numeric)
language sql security definer set search_path = public stable as $$
  select c.id,
    ( coalesce((select sum(r.montant) from recettes  r where r.compte_id = c.id and r.ecole_id = p_ecole), 0)
    + coalesce((select sum(p.montant) from paiements p where p.compte_id = c.id and p.ecole_id = p_ecole), 0)
    )::numeric,
    coalesce((select sum(d.montant) from depenses d where d.compte_id = c.id and d.ecole_id = p_ecole), 0)::numeric
  from comptes c
  where c.ecole_id = p_ecole
    and (public.est_super_admin() or public.ecole_courante() = p_ecole);
$$;

grant execute on function public.soldes_comptes(uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- create or replace function public.soldes_comptes(p_ecole uuid)
-- returns table(compte_id uuid, entrees numeric, sorties numeric)
-- language sql security definer set search_path = public stable as $$
--   select c.id,
--     coalesce((select sum(r.montant) from recettes r where r.compte_id = c.id and r.ecole_id = p_ecole), 0)::numeric,
--     coalesce((select sum(d.montant) from depenses d where d.compte_id = c.id and d.ecole_id = p_ecole), 0)::numeric
--   from comptes c
--   where c.ecole_id = p_ecole
--     and (public.est_super_admin() or public.ecole_courante() = p_ecole);
-- $$;
-- alter table paiements drop column if exists compte_id;
