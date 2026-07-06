-- =====================================================================
--  037 — Correctif : recalc_facture() castait un CASE texte vers l'enum
--  statut_facture → erreur « column "statut" is of type statut_facture but
--  expression is of type text » à chaque encaissement / validation de paiement.
--  Fix : caster explicitement le résultat du CASE en statut_facture.
-- =====================================================================

create or replace function recalc_facture() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_facture uuid := coalesce(new.facture_id, old.facture_id);
  v_total numeric(12,2);
  v_paye  numeric(12,2);
  v_echeance date;
begin
  select montant_total, date_echeance into v_total, v_echeance
  from factures where id = v_facture;

  select coalesce(sum(montant),0) into v_paye
  from paiements where facture_id = v_facture;

  update factures set
    montant_paye = v_paye,
    statut = (case
      when v_paye <= 0 and v_echeance is not null and v_echeance < current_date then 'en_retard'
      when v_paye <= 0 then 'emise'
      when v_paye >= v_total then 'payee'
      else 'partiellement_payee'
    end)::public.statut_facture
  where id = v_facture;
  return null;
end;
$$;

revoke execute on function public.recalc_facture() from public;
