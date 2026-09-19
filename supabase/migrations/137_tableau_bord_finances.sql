-- =====================================================================
--  137 — PHASE 2 : agrégats financiers du tableau de bord
--
--  `dashboard.js` fait déjà bien deux choses sur quatre : l'effectif par un
--  `count` sans transfert de lignes, et la moyenne des notes par RPC. Mais
--  il rapatrie TOUTES les factures de l'année et TOUS les paiements des six
--  derniers mois… pour n'en faire que des sommes. À 10 000 élèves, c'est
--  plusieurs dizaines de milliers de lignes transférées à chaque ouverture
--  d'une page qui n'affiche que trois chiffres et un histogramme.
--
--  Une somme se calcule là où sont les données.
--
--  Sécurité : comme la 136, la garde reproduit la RLS posée sur `factures`
--  et `paiements` par la migration 133 — `SECURITY DEFINER` la contourne.
--
--  Prérequis : migration 133.
-- =====================================================================

create or replace function public.tableau_bord_finances(
  p_ecole uuid,
  p_annee uuid default null,
  p_mois  integer default 6          -- profondeur de l'histogramme
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_facture numeric := 0;
  v_paye    numeric := 0;
  v_serie   jsonb;
  v_n       integer := least(greatest(coalesce(p_mois, 6), 1), 24);
  v_debut   date := date_trunc('month', current_date) - ((v_n - 1) || ' months')::interval;
begin
  if not (est_super_admin()
          or (p_ecole = ecole_courante()
              and (est_admin() or a_role('comptable') or a_role('secretaire')))) then
    raise exception 'Réservé à la gestion de l''établissement.';
  end if;

  -- Facturé / encaissé de l'année : deux sommes, zéro ligne transférée.
  select coalesce(sum(montant_total), 0), coalesce(sum(montant_paye), 0)
    into v_facture, v_paye
    from factures
   where ecole_id = p_ecole
     and (p_annee is null or annee_id = p_annee);

  -- Encaissements par mois. `generate_series` garantit les mois VIDES :
  -- un histogramme qui saute les mois sans paiement serait mensonger.
  select coalesce(jsonb_agg(t order by t.cle), '[]'::jsonb) into v_serie
    from (
      select to_char(m.mois, 'YYYY-MM') as cle,
             (select coalesce(sum(p.montant), 0) from paiements p
               where p.ecole_id = p_ecole
                 and p.date_paiement >= m.mois
                 and p.date_paiement < m.mois + interval '1 month') as montant
        from generate_series(v_debut, date_trunc('month', current_date), interval '1 month') as m(mois)
    ) t;

  return jsonb_build_object('facture', v_facture, 'paye', v_paye, 'serie', v_serie);
end $$;

revoke execute on function public.tableau_bord_finances(uuid, uuid, integer) from public, anon;
grant execute on function public.tableau_bord_finances(uuid, uuid, integer) to authenticated;

-- Le découpage mensuel lit les paiements par date : sans index, chaque
-- ouverture du tableau de bord parcourt toute la table.
create index if not exists paiements_date_idx on paiements(ecole_id, date_paiement);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.tableau_bord_finances(uuid, uuid, integer);
-- drop index if exists paiements_date_idx;
