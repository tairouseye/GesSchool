-- =====================================================================
--  042 — Champs personnalisés sur la fiche élève (par école)
--  L'école définit ses propres champs (Paramètres → « Champs élève »),
--  stockés dans parametres (cle='champs_eleve'). Les valeurs par élève vont
--  dans eleves.champs_perso (jsonb : { cle -> valeur }).
-- =====================================================================

alter table eleves add column if not exists champs_perso jsonb not null default '{}'::jsonb;
