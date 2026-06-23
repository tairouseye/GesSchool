# GesSchool — Plan de développement par phases

SaaS multi-tenant de gestion scolaire (Sénégal / Afrique de l'Ouest).
**Stack cible :** React (Vite) + Tailwind CSS en **PWA** (web + mobile installable, code unique) · Backend **Supabase** (Postgres + Auth + RLS + Storage).

> Règle d'or : on avance **module par module**, validation avant de passer au suivant. On ne construit **que Phase 0 + Phase 1** pour le MVP vendable. Les phases 2 à 4 sont planifiées mais **pas développées maintenant**.

---

## Identité produit (constante sur toutes les phases)

- **Palette** : navy `#0B1F3A` + or `#C9A227`, fonds crème `#F7F5EF`.
- **Motif cachet** : sceau circulaire estampillé (autorité institutionnelle).
- **Typographies** : Space Grotesk (titres/chiffres), Inter (UI), JetBrains Mono (matricules/montants/réfs).
- **Métier en français** dans le code (variables/fonctions), commentaires clairs.
- **Multi-tenant** : isolation stricte par `ecole_id` via RLS.

Référence visuelle : [`maquette_gestion_scolaire.jsx`](./maquette_gestion_scolaire.jsx).
Référence données : [`schema_gestion_scolaire.sql`](./schema_gestion_scolaire.sql).

---

## Phase 0 — Fondations (socle technique)

> Objectif : un squelette d'app qui démarre, se connecte à Supabase, authentifie, et applique l'isolation multi-tenant. **Aucune fonctionnalité métier visible** au-delà de l'auth et de l'onboarding minimal.

### 0.1 Initialisation projet
- [ ] Scaffold **Vite + React + Tailwind** dans `GesSchool/`.
- [ ] Config **PWA** : `manifest.webmanifest` (nom, icônes, thème navy), service worker basique (cache shell, offline fallback).
- [ ] Thème Tailwind : couleurs `navy/or/creme`, polices `display/sans/mono`, import des fontes.
- [ ] Structure dossiers : `src/{lib,composants,pages,modules,hooks,contextes}`.
- [ ] Qualité : ESLint + Prettier, alias `@/`.

### 0.2 Connexion Supabase
- [ ] Client Supabase (`src/lib/supabase.js`), variables `.env` (URL + anon key).
- [ ] Appliquer le schéma : migration dérivée de `schema_gestion_scolaire.sql` dans `supabase/migrations/`.
- [ ] Vérifier que **RLS est active** sur toutes les tables tenant + fonctions `ecole_courante()`, `a_role()`, `est_super_admin()`.

### 0.3 Authentification & rôles
- [ ] Auth Supabase (email/mot de passe). Rôles : `super_admin, admin_ecole, direction, enseignant, comptable, rh, surveillant, parent`.
- [ ] Contexte `AuthProvider` (session, profil, rôles, école courante).
- [ ] Routes protégées + garde par rôle (`<RequireRole>`).
- [ ] Pages : login, mot de passe oublié, déconnexion.

### 0.4 Onboarding établissement
- [ ] Écran **création d'école** : nom, sigle, logo, cachet (upload Storage), sélection des **cycles actifs** (préscolaire / premier cycle / second cycle / lycée / formation pro / université), couleurs.
- [ ] Création du profil `admin_ecole` rattaché, via fonction `SECURITY DEFINER` (contourne RLS pour le 1er enregistrement).
- [ ] Création de l'**année scolaire courante** + périodes (trimestres/semestres).

### 0.5 Structure académique configurable
- [ ] Assistant **cycles → niveaux → classes** pour l'école.
- [ ] CRUD matières, affectation des coefficients par défaut.

**✅ Sortie de Phase 0 :** je me connecte, je crée mon école, je configure mes cycles/niveaux/classes, l'isolation tenant est vérifiée.

---

## Phase 1 — MVP vendable (4 modules)

> Reprend **fidèlement** le design de la maquette, branché sur les vraies données Supabase. **Un module à la fois, validé avant le suivant.**

### Module 1 — Élèves & inscriptions
- [ ] CRUD élèves (matricule auto par école, photo, état civil, tuteurs).
- [ ] Gestion **tuteurs** + lien élève↔tuteur (responsable légal / paiement).
- [ ] **Inscriptions** : élève → classe → année, statut, réinscription/redoublement.
- [ ] Liste filtrable/recherche, fiche élève 360°.

### Module 2 — Notes & bulletins
- [ ] Saisie des **évaluations** (par classe/matière/période) et **notes**.
- [ ] Calcul **moyenne par matière** (pondérée coef), **moyenne générale**, **rang/effectif**, mention.
- [ ] **Génération PDF du bulletin** fidèle à la maquette (cachet, identité).
- [ ] Verrouillage de période / conseil de classe (appréciation, décision).

### Module 3 — Paiements parents
- [ ] **Grille tarifaire** (frais : inscription, scolarité, cantine… par niveau/année).
- [ ] **Factures** (génération depuis la grille) + lignes.
- [ ] **Encaissements** multi-modes (espèces, **Wave / Orange Money / Free Money**, virement, chèque).
- [ ] Statut facture **dérivé du cumul payé** (trigger), reçu PDF, solde par élève.

### Module 4 — Tableau de bord
- [ ] KPIs **réels** calculés depuis la base : effectifs, taux de recouvrement, encaissé du mois, moyenne générale.
- [ ] Graphe encaissements (6 mois), raccourcis, état de l'établissement.

**✅ Sortie de Phase 1 :** une école peut gérer élèves, bulletins et paiements de bout en bout → **produit vendable**.

---

## Phases ultérieures (planifiées, **non développées maintenant**)

### Phase 2 — Vie scolaire & communication
Absences/retards, incidents/sanctions, emplois du temps, annonces, notifications parents (SMS/WhatsApp/push PWA), espace parent.

### Phase 3 — RH, paie & comptabilité
Personnels, contrats, paie, présence staff ; comptabilité (comptes, dépenses, budgets, écritures), états financiers.

### Phase 4 — Pilotage & extensions
Performance enseignants, analytics multi-écoles (super_admin), facturation SaaS & plans d'abonnement, import/export massif, API/intégrations, mode hors-ligne avancé.

---

## Conventions de travail

- **Validation par module** : démo + résumé court (fait / reste) à chaque fin d'étape.
- **Ambiguïté → question** avant de décider.
- **Design** : ne jamais retomber sur du générique ; respecter palette/typos/cachet.
- **Sécurité** : toute nouvelle table tenant ⇒ `ecole_id` + RLS + policy standard.
- **Commits** : convention `feat: …`, versionnage produit.
