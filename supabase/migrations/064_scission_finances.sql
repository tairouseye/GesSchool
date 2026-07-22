-- =====================================================================
--  064 — Scission du module « finances »
--
--  « finances » regroupait paiements + recouvrement + comptabilité, et
--  n'était disponible qu'à partir de la formule Confort. L'encaissement
--  et la relance des impayés étant un argument d'achat majeur, on les
--  sort dans un module « encaissement » accessible dès l'offre Essentiel,
--  et on garde la « comptabilité » (back-office) pour Confort.
--
--  Côté application, le module est défini dans src/lib/modules.js — rien
--  à faire en base pour ça. Cette migration se limite à CONVERTIR les
--  données existantes : toute école (ou plan) qui référence encore
--  l'ancien id « finances » dans sa liste de modules doit pointer vers
--  les deux nouveaux, sinon ses pages Paiements/Compta se verrouillent.
-- =====================================================================

-- Écoles : remplacer 'finances' par 'encaissement' + 'comptabilite' (dédoublonné).
update public.ecoles
set modules_actifs = (
  select array(select distinct unnest(
    array_remove(modules_actifs, 'finances') || array['encaissement', 'comptabilite']
  ))
)
where modules_actifs @> array['finances'];

-- Plans (défensif : aucune offre n'a encore de modules au moment de la
-- migration, mais on couvre le cas où 'finances' y figurerait).
update public.plans_abonnement
set fonctions = jsonb_set(
  fonctions, '{modules}',
  to_jsonb(
    (select array(select distinct unnest(
      array_remove(mods, 'finances') || array['encaissement', 'comptabilite']
    ))
    from (select array(select jsonb_array_elements_text(fonctions -> 'modules')) as mods) s)
  )
)
where jsonb_typeof(fonctions -> 'modules') = 'array'
  and fonctions -> 'modules' ? 'finances';

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION (retour à l'ancien module « finances »)
--
--    update public.ecoles
--    set modules_actifs = (
--      select array(select distinct unnest(
--        array_remove(array_remove(modules_actifs, 'encaissement'), 'comptabilite')
--        || array['finances']
--      ))
--    )
--    where modules_actifs @> array['encaissement']
--       or modules_actifs @> array['comptabilite'];
--    notify pgrst, 'reload schema';
--
--  Idempotent : rejouer la migration ne change rien (aucun 'finances' ne
--  subsiste après le premier passage).
-- =====================================================================
