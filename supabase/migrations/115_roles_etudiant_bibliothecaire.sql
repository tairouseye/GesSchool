-- =====================================================================
--  115 — Rôles manquants : 'etudiant' (CORRECTIF BLOQUANT) + 'bibliothecaire'
--
--  PROBLÈME (bloquant, découvert à l'audit) :
--  L'enum `role_systeme` (001) ne contient PAS 'etudiant', alors que la
--  migration 113 (`lier_etudiant`) insère ce rôle dans `profil_roles.role`.
--  Le corps d'une fonction n'étant pas validé à sa création, la migration 113
--  est passée SANS erreur — mais `lier_etudiant` ÉCHOUE À L'EXÉCUTION :
--      invalid input value for enum role_systeme: "etudiant"
--  Conséquence : AUCUN étudiant ne peut activer son compte (espace étudiant et
--  consentement d'accès parent aux notes, livrés en 113/114, inutilisables).
--
--  On ajoute aussi 'bibliothecaire', rôle métier du futur module Bibliothèque
--  universitaire (profiter du même passage évite un second ALTER TYPE isolé).
--
--  ⚠️ À EXÉCUTER SEULE, AVANT TOUTE AUTRE MIGRATION.
--  `ALTER TYPE ... ADD VALUE` ajoute la valeur, mais celle-ci ne peut pas être
--  UTILISÉE dans la même transaction. Les migrations qui s'en servent
--  (policies avec a_role('bibliothecaire'), etc.) doivent être lancées dans une
--  EXÉCUTION SÉPARÉE, après celle-ci.
-- =====================================================================

alter type public.role_systeme add value if not exists 'etudiant';
alter type public.role_systeme add value if not exists 'bibliothecaire';

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
--  PostgreSQL ne permet PAS de retirer une valeur d'un enum.
--  Pour annuler, il faudrait recréer le type et toutes ses dépendances :
--    - créer un nouvel enum sans les valeurs,
--    - migrer la colonne profil_roles.role,
--    - supprimer l'ancien type.
--  En pratique : ne pas annuler (l'ajout est inoffensif et attendu par 113).
