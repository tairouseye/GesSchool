-- =====================================================================
--  143 — Supprimer ou annuler une facture
--
--  Constat : `supprimerFacture()` existe dans la couche données depuis le
--  début… et AUCUNE page ne l'appelle. Une facture émise par erreur ne peut
--  donc ni être retirée, ni être annulée. C'est le même défaut que
--  `journaliser()` ou `creerAuteur()` en bibliothèque : une fonction livrée
--  sans porte d'entrée.
--
--  Mais « ajouter un bouton Supprimer » serait la mauvaise réponse :
--
--   1. `paiements.facture_id` est en `on delete cascade` (mig. 001). Effacer
--      une facture réglée effacerait AUSSI ses encaissements — de l'argent
--      encaissé disparaîtrait des livres sans laisser de ligne.
--   2. `factures.numero` est une numérotation séquentielle unique par école.
--      On ne supprime pas une pièce numérotée : on l'ANNULE, pour que la
--      suite reste continue et que la trace subsiste.
--
--  Le statut `annulee` existe déjà dans l'enum `statut_facture` (mig. 001) et
--  il est DÉJÀ honoré partout où il compte : relances (019), recouvrement,
--  comptabilité (096, 098). Il n'était simplement jamais posé par personne.
--
--  D'où la règle retenue :
--   • facture SANS aucun encaissement → suppression possible ;
--   • facture AVEC au moins un encaissement → annulation seulement.
--
--  La suppression passe par une RPC gardée plutôt que par un trigger sur la
--  table : un trigger se déclencherait aussi sur la cascade venant de
--  `eleves`, et bloquerait la suppression d'un élève — un effet de bord que
--  personne n'a demandé.
--
--  Prérequis : migrations 001, 133, 134 (le journal trace déjà ces deux actes).
-- =====================================================================

create or replace function public.supprimer_facture(p_facture uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_f      factures%rowtype;
  v_nb     integer;
  v_montant numeric;
begin
  select * into v_f from factures where id = p_facture;
  if not found then
    raise exception 'Facture introuvable.';
  end if;

  if not (est_super_admin()
          or (v_f.ecole_id = ecole_courante()
              and (est_admin() or a_role('comptable') or a_role('secretaire')))) then
    raise exception 'Réservé à la gestion de l''établissement.';
  end if;

  select count(*), coalesce(sum(montant), 0) into v_nb, v_montant
    from paiements where facture_id = p_facture;

  if v_nb > 0 then
    raise exception
      'Cette facture porte % encaissement(s) pour % : elle ne peut pas être supprimée. Annulez-la pour en conserver la trace.',
      v_nb, v_montant;
  end if;

  -- Le déclencheur de journalisation (mig. 134) enregistre la ligne complète
  -- avant sa disparition : l'acte reste restaurable par `restaurer_depuis_journal`.
  delete from factures where id = p_facture;
end $$;

revoke execute on function public.supprimer_facture(uuid) from public, anon;
grant execute on function public.supprimer_facture(uuid) to authenticated;

-- =====================================================================
--  Correctif : une facture annulée ne doit plus compter comme facturée
-- =====================================================================
--  `tableau_bord_finances` (mig. 137 — la mienne) somme TOUTES les factures
--  sans regarder leur statut. Une facture annulée y resterait comptée, et le
--  taux de recouvrement afficherait un impayé fantôme. Partout ailleurs
--  (relances 019, recouvrement, comptabilité 096/098) `annulee` est déjà exclu.
create or replace function public.tableau_bord_finances(
  p_ecole uuid,
  p_annee uuid default null,
  p_mois  integer default 6
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

  select coalesce(sum(montant_total), 0), coalesce(sum(montant_paye), 0)
    into v_facture, v_paye
    from factures
   where ecole_id = p_ecole
     and (p_annee is null or annee_id = p_annee)
     and statut <> 'annulee';                       -- ajouté en 143

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

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • supprimer une facture sans encaissement → elle disparaît, et le
--     journal (mig. 134) en garde la ligne complète
--   • supprimer une facture réglée → exception nommant le nombre et le montant
--   • annuler une facture → statut 'annulee', elle sort du recouvrement,
--     des relances et du tableau de bord, mais reste visible dans la liste
--   • un enseignant → « Réservé à la gestion de l'établissement. »
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.supprimer_facture(uuid);
-- (et réappliquer le corps de `tableau_bord_finances` de la migration 137.)
