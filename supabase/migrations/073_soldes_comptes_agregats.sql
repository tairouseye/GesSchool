-- 073 — Soldes des comptes agrégés côté serveur (perf comptabilité).
--
-- Avant : getSoldes chargeait TOUTES les recettes + TOUTES les dépenses de
-- l'école dans le navigateur pour sommer par compte (croît sans fin). Ici,
-- Postgres renvoie une ligne par compte avec ses totaux entrées/sorties.
--
-- Sécurité : SECURITY DEFINER restreint à l'école du demandeur (ou super-admin).

create or replace function public.soldes_comptes(p_ecole uuid)
returns table(compte_id uuid, entrees numeric, sorties numeric)
language sql security definer set search_path = public stable as $$
  select c.id,
    coalesce((select sum(r.montant) from recettes r where r.compte_id = c.id and r.ecole_id = p_ecole), 0)::numeric,
    coalesce((select sum(d.montant) from depenses d where d.compte_id = c.id and d.ecole_id = p_ecole), 0)::numeric
  from comptes c
  where c.ecole_id = p_ecole
    and (public.est_super_admin() or public.ecole_courante() = p_ecole);
$$;

grant execute on function public.soldes_comptes(uuid) to authenticated;

-- ANNULATION
-- drop function if exists public.soldes_comptes(uuid);
