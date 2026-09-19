-- =====================================================================
--  141 — `ecoles.type_etablissement` : une colonne, deux significations
--
--  ⚠️ BUG EN PRODUCTION, mesuré le 19/09/2026 sur les 7 écoles de la base :
--  SIX d'entre elles — dont Tut'Tank, client réel — perdaient de leur menu
--  Appel, Cahier de textes, Progression, Emploi du temps, Niveaux & classes,
--  Notes, Bulletins, Classement, Vie scolaire, Assiduité et Fournitures.
--
--  Cause. La migration 001 a créé `type_etablissement` pour le STATUT
--  JURIDIQUE (« Privé », « Public », « Confessionnel », « Franco-arabe ») ;
--  c'est ce qu'écrit encore la page d'onboarding. La migration 108 a voulu en
--  faire la bascule école / supérieur :
--
--      alter table ecoles add column if not exists type_etablissement text
--        not null default 'ecole' check (type_etablissement in (...));
--
--  La colonne existait déjà : `if not exists` a rendu TOUTE l'instruction
--  inopérante. Ni le défaut, ni le NOT NULL, ni la contrainte n'ont été posés,
--  et personne ne s'en est aperçu — la migration s'est exécutée sans erreur.
--  Les écoles sont restées à « Privé », et le filtre de menu
--  `["ecole"].includes("Privé")` a commencé à les exclure dès que le gating
--  par type est arrivé (v2.171.0, élargi en v2.185.0).
--
--  Leçon : `add column if not exists` ne DIT PAS « mets la colonne dans cet
--  état », il dit « crée-la si elle manque ». Pour changer défaut, nullité ou
--  contrainte d'une colonne qui peut déjà exister, il faut des `alter column`
--  et `add constraint` explicites — comme ci-dessous.
--
--  Le correctif applicatif (normaliserType) est déjà en ligne : tout ce qui
--  n'est pas 'superieur' vaut 'ecole'. Cette migration remet la DONNÉE d'aplomb
--  pour que la colonne redevienne fiable, sans perdre le statut juridique.
-- =====================================================================

-- 1) Sauvegarder l'ancienne signification avant de normaliser. Elle n'est lue
--    nulle part dans l'application, mais l'écraser serait une perte sèche.
alter table ecoles add column if not exists statut_juridique text;

update ecoles
   set statut_juridique = type_etablissement
 where statut_juridique is null
   and type_etablissement is not null
   and type_etablissement not in ('ecole', 'superieur');

-- 2) Normaliser : la colonne ne porte plus que la bascule pédagogique.
update ecoles
   set type_etablissement = 'ecole'
 where type_etablissement is distinct from 'superieur';

-- 3) Poser enfin l'état que la migration 108 croyait avoir posé.
alter table ecoles alter column type_etablissement set default 'ecole';
alter table ecoles alter column type_etablissement set not null;

alter table ecoles drop constraint if exists ecoles_type_etablissement_chk;
alter table ecoles
  add constraint ecoles_type_etablissement_chk
  check (type_etablissement in ('ecole', 'superieur'));

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--    select nom, type_etablissement, statut_juridique from ecoles order by nom;
--  → type_etablissement vaut 'ecole' partout sauf l'UCAD ('superieur'),
--    et statut_juridique a recueilli « Privé » / « Collège ».
--  Puis, dans l'application : le menu Pédagogie d'une école doit à nouveau
--  montrer Appel, Notes, Bulletins et Emploi du temps.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table ecoles drop constraint if exists ecoles_type_etablissement_chk;
-- alter table ecoles alter column type_etablissement drop not null;
-- update ecoles set type_etablissement = statut_juridique
--  where statut_juridique is not null;
-- alter table ecoles drop column if exists statut_juridique;
