# GesSchool

SaaS multi-tenant de **gestion scolaire** (Sénégal / Afrique de l'Ouest) — préscolaire à université.

**Stack :** React (Vite) + Tailwind CSS en **PWA** · Supabase (Postgres + Auth + RLS + Storage).

## Développement

```bash
npm install            # si erreur TLS d'entreprise : NODE_OPTIONS=--use-system-ca npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

## Module RH & Paie

Paie « régime réel » configurable **par école** (multi-pays) :

- **Personnel & dossier 360°** : identité civile, champs fiscaux (matricule, parts IR/TRIMF, N° IPRES, taux horaires), historique des contrats, avances/prêts, bulletins.
- **Paie dynamique** : bulletin composé en lignes (base × taux horaire, gains soumis / **non soumis**, retenues) ; **net = Σ gains − Σ retenues**, arrondi au franc.
- **Régime configurable** : cotisations (taux salarial/patronal, plafond, forfait), **barème IR + TRIMF** chargé par école (mensuel + annuel), **modèles de pays** (Sénégal validé ; RDC, Mali, Côte d'Ivoire indicatifs), mode **simplifié / complet**.
- **Cycle** : préparation (heures/absences + proratisation embauche/départ + contrôle des entêtes) → **workflow** brouillon → validé → payé (verrouillé) → intégration comptable (dépense idempotente).
- **Contrôle interne** : **piste d'audit** des montants, garde de suppression hors brouillon, **séparation des tâches** optionnelle, **diagnostic santé** de l'installation.
- **Avances & prêts** (échéancier, solde réversible, déduction auto), **congés** (demande → approbation → solde) & **absences**.
- **Rapports** : bulletin officiel imprimable, **livre de paie** et **récapitulatif** (net + institutions), avec **export Excel**.

Détail technique : migrations [`074`→`093`](supabase/migrations) ; couches [`src/lib/rh.js`](src/lib/rh.js), [`src/lib/paie.js`](src/lib/paie.js), [`src/lib/bareme.js`](src/lib/bareme.js), [`src/lib/regimes.js`](src/lib/regimes.js).

## Base de données

Migrations dans [`supabase/migrations/`](supabase/migrations) — à exécuter dans le SQL Editor Supabase, dans l'ordre.

## Documentation

- [`CHANGELOG.md`](CHANGELOG.md) — journal des modifications par version
- [`docs/schema_gestion_scolaire.sql`](docs/schema_gestion_scolaire.sql) — schéma de référence (11 domaines, RLS multi-tenant)
- [`docs/maquette_gestion_scolaire.jsx`](docs/maquette_gestion_scolaire.jsx) — identité visuelle & écrans MVP
- [`docs/plan_phases_developpement.md`](docs/plan_phases_developpement.md) — plan par phases

## Déploiement

Build automatique vers **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`) à chaque push sur `main`.
