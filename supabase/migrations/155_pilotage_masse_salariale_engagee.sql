-- =====================================================================
--  155 — Pilotage : la masse salariale comptait des BROUILLONS
--
--  Signalé dans le prolongement de la 154 : « je ne reconnais pas la masse
--  salariale, ça ne colle pas avec ce qui est dans Gestion ».
--
--  Un bulletin de paie a un cycle de vie, posé par la migration 079 :
--        brouillon → validé → payé → archivé
--  Un BROUILLON est un calcul en cours. Il peut être recalculé, corrigé,
--  jeté. Ce n'est pas un engagement de l'école.
--
--  Or `pilotage_synthese` sommait tous les bulletins du mois, sans regarder
--  leur statut. Constaté au 28/09/2026 : la TOTALITÉ des bulletins de la
--  base sont en brouillon et aucun n'est payé. La tuile annonçait donc
--    Tut'Tank       300 000   (2 brouillons)
--    TutTank_Demo 2 622 999   (12 brouillons)
--    UCAD           650 000   (3 brouillons)
--  soit 3 572 999 de masse salariale dont pas un franc n'est engagé.
--
--  ⚠️ CE N'EST PAS UN DÉTAIL D'AFFICHAGE. Un promoteur lit cette tuile à
--  côté de sa trésorerie pour décider s'il peut payer. Annoncer une charge
--  qui n'existe pas encore est aussi trompeur que d'en oublier une.
--
--  Correctif : la masse salariale du mois ne compte que les bulletins
--  ENGAGÉS — validés, payés ou archivés. Et comme un promoteur ne doit pas
--  pour autant ignorer ce qui se prépare, le montant en brouillon est rendu
--  à part : l'écran peut alors dire « 2 bulletins à valider » au lieu de
--  faire passer un brouillon pour une charge.
--
--  Prérequis : migrations 010, 079, 154.
-- =====================================================================

--  Ajout de `masse_brouillon` ⇒ le type de retour change ⇒ 42P13 sur un
--  simple `create or replace`. Il faut dropper d'abord.
drop function if exists public.pilotage_synthese();
create or replace function public.pilotage_synthese()
returns table(
  ecole_id uuid, ecole text, sigle text, devise text,
  effectif bigint,
  total_facture numeric, total_paye numeric,
  tresorerie numeric,
  masse_salariale numeric, masse_brouillon numeric, bulletins_brouillon bigint,
  recettes_annee numeric, depenses_annee numeric, scolarite_annee numeric
)
language sql stable security definer set search_path = public as $$
  select
    e.id, e.nom, e.sigle, coalesce(e.devise, 'XOF'),
    (select count(*) from eleves el where el.ecole_id = e.id),
    -- Une facture annulée n'est ni due ni encaissée (règle de la mig. 143).
    coalesce((select sum(f.montant_total) from factures f
              where f.ecole_id = e.id and f.statut <> 'annulee'), 0),
    coalesce((select sum(f.montant_paye)  from factures f
              where f.ecole_id = e.id and f.statut <> 'annulee'), 0),
    -- Trésorerie : tout ce qui est entré, scolarité comprise (mig. 154).
      coalesce((select sum(c.solde_initial) from comptes c where c.ecole_id = e.id), 0)
    + coalesce((select sum(r.montant) from recettes  r where r.ecole_id = e.id), 0)
    + coalesce((select sum(p.montant) from paiements p where p.ecole_id = e.id), 0)
    - coalesce((select sum(d.montant) from depenses  d where d.ecole_id = e.id), 0),
    -- Masse salariale ENGAGÉE du mois : ni les brouillons, ni le vide.
    coalesce((select sum(s.montant_net) from salaires s
              where s.ecole_id = e.id
                and s.periode = to_char(current_date, 'YYYY-MM')
                and s.statut in ('valide', 'paye', 'archive')), 0),
    -- Ce qui se prépare, rendu à part plutôt que confondu avec la charge.
    coalesce((select sum(s.montant_net) from salaires s
              where s.ecole_id = e.id
                and s.periode = to_char(current_date, 'YYYY-MM')
                and s.statut = 'brouillon'), 0),
    (select count(*) from salaires s
      where s.ecole_id = e.id
        and s.periode = to_char(current_date, 'YYYY-MM')
        and s.statut = 'brouillon'),
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
--  CONTRÔLE (données du 28/09/2026, où tout est en brouillon)
--   • masse salariale engagée : 0 partout — et c'est la vérité, aucun
--     bulletin n'est validé ;
--   • masse en brouillon : Tut'Tank 300 000 (2), TutTank_Demo 2 622 999
--     (12), UCAD 650 000 (3) ;
--   • valider un bulletin de 140 000 chez Tut'Tank ⇒ engagée 140 000,
--     brouillon 160 000 (1). Le total des deux ne bouge pas : l'argent
--     change de colonne, il n'apparaît pas.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.pilotage_synthese();
-- (puis réappliquer la définition de la migration 154.)
