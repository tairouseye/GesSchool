-- =====================================================================
--  212 — Détail des paiements d'un élève : date et mode de paiement,
--  et les autres frais facturés (sortie pédagogique…).
--
--  Demande du promoteur (Tut'Tank, 26/10/2026) : à côté du « Total payé »,
--  le parent ouvre un détail « Description · Montant · Statut · Date ·
--  Mode de paiement » : inscription, chaque mois, puis les autres frais.
--
--  Seul `_echeancier_json` change (corps de la 211, + 3 informations) :
--    • chaque ligne payée porte `date_paiement` (dernier paiement) et
--      `mode` (modes des paiements, séparés par « , ») ;
--    • `autres` : les lignes des factures de l'élève (ni brouillon, ni
--      annulée) qui ne sont pas dans l'échéancier — frais optionnels
--      facturés (sortie, tenue…). Elles ne changent PAS le statut.
--  Les gardes ne changent pas : `eleve_echeancier` (personnel habilité) et
--  `enfant_echeancier` (parent, `_parent_possede` + coalesce, mig. 209)
--  appellent cette fonction, qui reste fermée à `authenticated` et `anon`.
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
                 'mode', case when x.etat in ('paye', 'partiel') then pay.modes end)
                 order by x.ordre, x.libelle)
               from ech x left join pay on pay.libelle = x.libelle), '[]'::jsonb),
    'autres', coalesce((select jsonb_agg(jsonb_build_object(
                 'libelle', a.libelle, 'montant', a.montant, 'echeance', a.echeance,
                 'etat', case when a.regle then 'paye'
                              when a.echeance < current_date then 'en_retard'
                              when a.entame then 'partiel'
                              else 'a_venir' end,
                 'date_paiement', case when a.regle then pay.date_paiement end,
                 'mode', case when a.entame then pay.modes end)
                 order by a.echeance nulls last, a.libelle)
               from autres a left join pay on pay.libelle = a.libelle), '[]'::jsonb));
$fn$;
revoke execute on function public._echeancier_json(uuid, uuid) from public, anon, authenticated;
