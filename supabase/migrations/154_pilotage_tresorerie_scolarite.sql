-- =====================================================================
--  154 — Pilotage : la trésorerie oubliait la scolarité encaissée
--
--  Signalé : « des montants qui ne font pas de sens » dans Pilotage →
--  vue d'ensemble. Constaté sur les données réelles :
--
--    TutTank_Demo : 10 102 500 encaissés  →  trésorerie affichée  −370 000
--    UCAD         :     60 000 encaissés  →  trésorerie affichée  −435 000
--
--  La trésorerie ne comptait QUE les sorties. Et la page se contredisait :
--  le même argent figurait dans « Résultat (année) » — qui additionne bien
--  les paiements — mais pas dans « Trésorerie ». C'est ce grand écart entre
--  deux tuiles voisines qui rendait la page illisible.
--
--  ⚠️ LE DIAGNOSTIC AVAIT DÉJÀ ÉTÉ POSÉ. La migration 075 s'appelle
--  « Trésorerie : la scolarité encaissée alimente la caisse » et décrit
--  exactement ce symptôme (« structurellement sous-évalué et incohérent
--  avec le résultat »). Mais elle n'a corrigé que `soldes_comptes` ; cette
--  fonction-ci, écrite en 010, n'a jamais été reprise. Une même règle
--  métier vivait à deux endroits, et un seul a été réparé.
--
--  ⚠️ POURQUOI COMPTER LES PAIEMENTS PAR ÉCOLE, ET NON PAR COMPTE.
--  `soldes_comptes` joint sur `paiements.compte_id` — c'est juste pour un
--  solde de caisse. Mais au niveau de l'ÉTABLISSEMENT, un encaissement non
--  imputé reste de l'argent entré. Or il n'existe aujourd'hui que 2 comptes
--  de caisse dans toute la base, et la totalité des paiements existants ont
--  `compte_id` nul (075 les avait laissés ainsi par rétro-compatibilité) :
--  raisonner par compte reviendrait à effacer tout ce qui est encaissé.
--
--  Deux corrections de plus, au passage :
--   • les factures ANNULÉES gonflaient le dénominateur du taux de
--     recouvrement — la migration 143 avait posé la règle pour le tableau
--     de bord des finances, Pilotage ne la suivait pas ;
--   • la devise de chaque école est désormais rendue : l'écran appliquait
--     celle de l'école active à toutes les cartes, ce qui étiquette faux
--     dès qu'un promoteur a une école en USD ou en CDF (démo RDC).
--
--  Prérequis : migrations 010, 075, 143.
-- =====================================================================

--  `create or replace` ne peut pas changer le type de retour d'un
--  `returns table(...)` → 42P13. On ajoute `devise` : il faut donc dropper.
drop function if exists public.pilotage_synthese();
create or replace function public.pilotage_synthese()
returns table(
  ecole_id uuid, ecole text, sigle text, devise text,
  effectif bigint,
  total_facture numeric, total_paye numeric,
  tresorerie numeric,
  masse_salariale numeric,
  recettes_annee numeric, depenses_annee numeric, scolarite_annee numeric
)
language sql stable security definer set search_path = public as $$
  select
    e.id, e.nom, e.sigle, coalesce(e.devise, 'XOF'),
    (select count(*) from eleves el where el.ecole_id = e.id),
    -- Une facture annulée n'est ni due ni encaissée : elle ne doit peser sur
    -- aucun des deux termes du taux de recouvrement (règle de la mig. 143).
    coalesce((select sum(f.montant_total) from factures f
              where f.ecole_id = e.id and f.statut <> 'annulee'), 0),
    coalesce((select sum(f.montant_paye)  from factures f
              where f.ecole_id = e.id and f.statut <> 'annulee'), 0),
    -- Trésorerie = solde de départ + TOUT ce qui est entré − ce qui est sorti.
    -- Les paiements de scolarité sont l'entrée principale d'une école : les
    -- omettre ne sous-estimait pas le solde, il l'inversait.
      coalesce((select sum(c.solde_initial) from comptes c where c.ecole_id = e.id), 0)
    + coalesce((select sum(r.montant) from recettes  r where r.ecole_id = e.id), 0)
    + coalesce((select sum(p.montant) from paiements p where p.ecole_id = e.id), 0)
    - coalesce((select sum(d.montant) from depenses  d where d.ecole_id = e.id), 0),
    coalesce((select sum(s.montant_net) from salaires s
              where s.ecole_id = e.id and s.periode = to_char(current_date, 'YYYY-MM')), 0),
    coalesce((select sum(r.montant) from recettes r
              where r.ecole_id = e.id and r.date_recette >= date_trunc('year', current_date)), 0),
    coalesce((select sum(d.montant) from depenses d
              where d.ecole_id = e.id and d.date_depense >= date_trunc('year', current_date)), 0),
    coalesce((select sum(p.montant) from paiements p
              where p.ecole_id = e.id and p.date_paiement >= date_trunc('year', current_date)), 0)
  from ecoles e
  where e.id in (select ecole_id from proprietaires where profil_id = auth.uid())
  order by e.nom;
$$;
revoke execute on function public.pilotage_synthese() from public, anon;
grant execute on function public.pilotage_synthese() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE (valeurs attendues après application, données du 28/09/2026)
--   • TutTank_Demo : trésorerie 9 732 500 au lieu de −370 000
--     (0 solde initial + 0 recette + 10 102 500 encaissés − 370 000 dépensés)
--   • UCAD         : trésorerie −375 000 au lieu de −435 000
--     (100 000 + 0 + 60 000 − 535 000) — négatif, mais c'est la réalité :
--     535 000 de dépenses pour 60 000 encaissés.
--   • Trésorerie et Résultat racontent désormais la même histoire.
--   • Chaque carte porte la devise de SON école.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.pilotage_synthese();
-- (puis réappliquer la définition de la migration 010.)
