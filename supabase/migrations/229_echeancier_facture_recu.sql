-- =====================================================================
--  229 — Paiements mois par mois côté parent : la facture et le reçu de
--        chaque mois (maquette de Mme Kane, Tut'Tank, 05/11/2026).
--
--  Un parent compte en mois (« j'ai payé novembre ? »), pas en numéros de
--  facture. La rubrique Paiements affiche donc l'échéancier mois par mois,
--  avec sur chaque ligne les boutons « Facture » et « Reçu ». Pour cela,
--  chaque ligne de `_echeancier_json` porte désormais :
--    • `facture_id`  : la dernière facture (ni brouillon, ni annulée) qui
--                      contient ce libellé ;
--    • `paiement_id` : le dernier paiement encaissé sur cette facture-là,
--                      pour ouvrir son reçu.
--  Même chose pour les `autres` frais.
--
--  Seul `_echeancier_json` change : corps de la 212, + ces 2 informations.
--  Les gardes ne bougent pas : `enfant_echeancier` (parent,
--  `_parent_possede`) et `eleve_echeancier` (personnel habilité) appellent
--  cette fonction, qui reste fermée à `authenticated` et `anon`. Ouvrir la
--  facture ou le reçu passe ensuite par `enfant_facture_detail`, qui vérifie
--  à nouveau que l'enfant est bien celui du parent.
--
--  ANNULATION : rejouer la définition de la migration 212.
-- =====================================================================

create or replace function public._echeancier_json(p_eleve uuid, p_annee uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
  with ech as (
    select * from public._echeancier(p_eleve, p_annee)
  ),
  --  Les paiements de l'élève sur l'année, par libellé de ligne de facture.
  pay as (
    select fl.libelle,
           max(p.date_paiement) as date_paiement,
           string_agg(distinct p.mode::text, ',') as modes
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
      join paiements p on p.facture_id = fa.id
     where fa.eleve_id = p_eleve and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
     group by fl.libelle
  ),
  --  La facture de chaque libellé (la plus récente), et son dernier paiement.
  fac as (
    select distinct on (fl.libelle) fl.libelle, fa.id as facture_id,
           (select p.id from paiements p where p.facture_id = fa.id
             order by p.date_paiement desc, p.created_at desc limit 1) as paiement_id
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
     where fa.eleve_id = p_eleve and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
     order by fl.libelle, fa.date_emission desc, fa.created_at desc
  ),
  autres as (
    select fl.libelle, sum(fl.montant) as montant,
           bool_and(fa.montant_paye >= fa.montant_total) as regle,
           bool_or(fa.montant_paye > 0) as entame,
           min(fa.date_echeance) as echeance
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
     where fa.eleve_id = p_eleve and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
       and not exists (select 1 from ech where ech.libelle = fl.libelle)
     group by fl.libelle
  )
  select jsonb_build_object(
    'statut', public._statut_paiement(p_eleve, p_annee),
    'tarif', (select jsonb_build_object(
                'tarif_niveau', t.tarif_niveau, 'montant', t.montant,
                'mensualite', i.mensualite, 'motif', i.motif_tarif, 'exonere', i.exonere,
                'nouveau', t.nouveau, 'nouveau_saisi', i.nouveau)
                from inscriptions i
                left join lateral public._tarif_scolarite(p_eleve, p_annee) t on true
               where i.eleve_id = p_eleve and i.annee_id = p_annee limit 1),
    'lignes', coalesce((select jsonb_agg(jsonb_build_object(
                 'mois', x.mois, 'libelle', x.libelle, 'recurrent', x.recurrent,
                 'montant', x.montant, 'echeance', x.echeance, 'paye', x.paye,
                 'etat', x.etat,
                 'date_paiement', case when x.etat = 'paye' then pay.date_paiement end,
                 'mode', case when x.etat in ('paye', 'partiel') then pay.modes end,
                 'facture_id', fac.facture_id,
                 'paiement_id', fac.paiement_id)
                 order by x.ordre, x.libelle)
               from ech x left join pay on pay.libelle = x.libelle
                          left join fac on fac.libelle = x.libelle), '[]'::jsonb),
    'autres', coalesce((select jsonb_agg(jsonb_build_object(
                 'libelle', a.libelle, 'montant', a.montant, 'echeance', a.echeance,
                 'etat', case when a.regle then 'paye'
                              when a.echeance < current_date then 'en_retard'
                              when a.entame then 'partiel'
                              else 'a_venir' end,
                 'date_paiement', case when a.regle then pay.date_paiement end,
                 'mode', case when a.entame then pay.modes end,
                 'facture_id', fac.facture_id,
                 'paiement_id', fac.paiement_id)
                 order by a.echeance nulls last, a.libelle)
               from autres a left join pay on pay.libelle = a.libelle
                             left join fac on fac.libelle = a.libelle), '[]'::jsonb));
$fn$;
revoke execute on function public._echeancier_json(uuid, uuid) from public, anon, authenticated;
