# GesSchool

SaaS multi-tenant de **gestion scolaire** (Sénégal / Afrique de l'Ouest) — préscolaire à université.

**Stack :** React (Vite) + Tailwind CSS en **PWA** · Supabase (Postgres + Auth + RLS + Storage).

## Développement

```bash
npm install            # si erreur TLS d'entreprise : NODE_OPTIONS=--use-system-ca npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

## Base de données

Migrations dans [`supabase/migrations/`](supabase/migrations) — à exécuter dans le SQL Editor Supabase, dans l'ordre.

## Documentation

- [`docs/schema_gestion_scolaire.sql`](docs/schema_gestion_scolaire.sql) — schéma de référence (11 domaines, RLS multi-tenant)
- [`docs/maquette_gestion_scolaire.jsx`](docs/maquette_gestion_scolaire.jsx) — identité visuelle & écrans MVP
- [`docs/plan_phases_developpement.md`](docs/plan_phases_developpement.md) — plan par phases

## Déploiement

Build automatique vers **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`) à chaque push sur `main`.
