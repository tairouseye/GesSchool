# Migrations Supabase — source de vérité du schéma

Ce dossier est **la référence unique** du schéma GeScola : tables, RLS, fonctions
(RPC), triggers, enums, buckets. Ce qui tourne en base **doit** correspondre à ce
qui est ici.

## ⛓️ La règle (non négociable)

> **Tout changement en base passe par un fichier de migration ici, commité.**

Ne **jamais** créer/modifier une fonction, une table ou une policy directement dans
l'éditeur SQL de Supabase sans coller le SQL correspondant dans un nouveau fichier
de migration. Un changement appliqué « à la main » et non versionné devient invisible
au dépôt : le code semble sain alors que la base tourne une autre version.

### Pourquoi
Des fonctions avaient été éditées directement en base sans migration (les numéros
`020` / `021` n'ont jamais été sauvegardés). Résultat : deux bugs
`column reference "id" is ambiguous` en production (paiements, puis messagerie),
impossibles à diagnostiquer depuis le seul code.
Correctifs : `045` (RPC paiement parent), `046` (`conversation_messages`),
`047` (remise sous version des 3 RPC de déclaration de paiement mobile).

## Convention

- Nom : `NNN_description.sql` (NNN séquentiel sur 3 chiffres).
- Idempotent quand c'est possible : `create or replace`, `create table if not exists`,
  `drop function if exists` avant recréation si la signature change.
- Un fichier = un sujet cohérent.

## Appliquer

Exécuter les fichiers **dans l'ordre** dans l'éditeur SQL Supabase (ou via la CLI).
Tenir un suivi « appliqué / non appliqué » par environnement.

## Vérifier l'absence de dérive (base ↔ dépôt)

Exporter toutes les fonctions réelles et comparer au dépôt :

```sql
select p.proname as nom, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname;
```

Points à contrôler sur l'export :
- toute fonction en base est bien définie par une migration ici (pas de « fantôme ») ;
- chaque fonction `SECURITY DEFINER` fixe `set search_path = public` ;
- pas de colonne ambiguë (`id` non qualifié dans une requête à plusieurs tables).

Dernière vérification complète : **12 juillet 2026** — 68 fonctions, base et dépôt
alignés, aucune dérive.
