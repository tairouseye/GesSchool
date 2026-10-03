-- =====================================================================
--  170 — Savoir si une famille est à jour, SANS voir ses montants
--
--  Demandé à la visite, et précisé par l'école : « à jour signifie
--  paiement ». Le besoin est de voir, sur la liste d'une classe, qui est en
--  retard — pour agir.
--
--  ⚠️ CE QUE LA MIGRATION 133 A ÉTABLI, ET QU'ON NE DÉFAIT PAS.
--  Elle a purgé toutes les policies de `factures`, `facture_lignes` et
--  `paiements` pour les reposer sur `est_admin() or comptable or
--  secretaire`. Motif mesuré à l'époque : un enseignant d'UCAD lisait les
--  factures par simple appel REST, l'interface masquant ce que la base
--  autorisait. Vérifié à nouveau aujourd'hui avec de vraies sessions : la
--  direction et le responsable RH ne lisent RIEN de `factures`. Le
--  cloisonnement tient, et il est volontaire.
--
--  ⚠️ D'OÙ UNE RPC QUI NE REND QUE LE STATUT. On n'élargit pas l'accès à la
--  table : la fonction rend trois états et un compte de factures échues —
--  jamais un montant, jamais un numéro, jamais une échéance. Le
--  responsable pédagogique apprend qu'une famille est en retard ; il
--  n'apprend pas de combien. C'est précisément ce que le moindre privilège
--  demande ici.
--
--  ⚠️ ET PAS D'ACCÈS POUR L'ENSEIGNANT NI LE SURVEILLANT. Décision
--  explicite : ils n'ont aucune action à mener sur un impayé, et savoir
--  quelles familles sont en retard crée un risque de traitement différencié
--  de l'ENFANT. L'information ne leur apporte rien et peut lui coûter.
--
--  ⚠️ TROIS ÉTATS, PAS DEUX. Relevé en production : 8 factures pour
--  96 élèves inscrits. Un indicateur à deux états afficherait donc « en
--  retard » pour 88 familles qui n'ont simplement jamais été facturées —
--  une information fausse, et accusatrice. D'où l'état « non facturé »,
--  qui dit la vérité : le travail reste à faire du côté de l'école.
--
--  Prérequis : migrations 001, 033, 133.
-- =====================================================================

drop function if exists public.statut_paiement_classe(uuid, uuid);
create or replace function public.statut_paiement_classe(p_classe uuid, p_annee uuid)
returns table(eleve_id uuid, statut text, factures bigint, echues bigint)
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid;
begin
  --  ⚠️ EN SECURITY DEFINER, LA RLS NE NOUS PROTÈGE PLUS : le cloisonnement
  --  entre établissements doit être écrit ici, explicitement. Sans ce
  --  contrôle, n'importe quel membre d'une école lirait le statut des
  --  familles d'une autre. Même leçon qu'à la migration 167.
  select c.ecole_id into v_ecole from classes c where c.id = p_classe;
  if v_ecole is null then
    raise exception 'Classe introuvable.';
  end if;
  if not (est_super_admin() or (v_ecole = ecole_courante()
          and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))) then
    raise exception 'Accès refusé.';
  end if;

  return query
  with f as (
    select fa.eleve_id,
           --  Une facture annulée n'engage plus personne.
           count(*) filter (where fa.statut <> 'annulee') as total,
           --  🔴 ÉCHUE ET IMPAYÉE. Deux précautions :
           --   • `date_echeance is not null` : une facture sans échéance
             --     n'est pas « en retard », elle est indatée. Compter
             --     l'inconnu comme un retard serait accuser à tort ;
           --   • `montant_total > montant_paye` plutôt que le statut, car
           --     `statut` est saisi à la main et peut mentir — le solde,
           --     lui, est tenu par un déclencheur sur les paiements.
           count(*) filter (
             where fa.statut <> 'annulee'
               and fa.montant_total > fa.montant_paye
               and fa.date_echeance is not null
               and fa.date_echeance < current_date
           ) as en_retard
      from factures fa
     where fa.annee_id = p_annee
     group by fa.eleve_id
  )
  select i.eleve_id,
         case
           when coalesce(f.total, 0) = 0 then 'non_facture'
           when coalesce(f.en_retard, 0) > 0 then 'en_retard'
           else 'a_jour'
         end,
         coalesce(f.total, 0),
         coalesce(f.en_retard, 0)
    from inscriptions i
    left join f on f.eleve_id = i.eleve_id
   where i.classe_id = p_classe
     and i.annee_id = p_annee;
end $fn$;
revoke execute on function public.statut_paiement_classe(uuid, uuid) from public, anon;
grant execute on function public.statut_paiement_classe(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • promoteur, comptable, secrétaire, direction → obtiennent les statuts ;
--   • 🔴 enseignant, surveillant, RH → « Accès refusé » ;
--   • 🔴 un membre d'une AUTRE école → « Classe introuvable » ou refus, et
--     jamais le statut des familles d'autrui ;
--   • parent, étudiant, anonyme → refusés ;
--   • aucun montant, aucune échéance, aucun numéro ne sort de la fonction ;
--   • un élève jamais facturé → « non_facture » (le cas de 88 élèves sur 96
--     chez Tut'Tank à ce jour), et non « en retard » ;
--   • une facture impayée SANS date d'échéance → l'élève reste « a_jour » :
--     on ne traite pas l'inconnu comme une faute ;
--   • une facture annulée n'entre dans aucun compte.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.statut_paiement_classe(uuid, uuid);
