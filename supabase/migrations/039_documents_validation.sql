-- =====================================================================
--  039 — Documents officiels avec validation par le signataire
--  Un document (certificat / attestation) est créé côté Gestion et ASSIGNÉ à
--  un signataire (qui a un compte). Il reste « en_attente » (non imprimable)
--  jusqu'à ce que le signataire le VALIDE depuis son espace → « valide »
--  (imprimable, avec sa signature) ; ou « rejete » (avec motif).
-- =====================================================================

create table if not exists documents (
  id                  uuid primary key default gen_random_uuid(),
  ecole_id            uuid not null references ecoles(id) on delete cascade,
  eleve_id            uuid references eleves(id) on delete set null,
  type                text not null,               -- scolarite | inscription | frequentation | autre
  titre               text not null,
  corps               text,                        -- texte du document (figé à la création)
  ville               text,
  date_doc            date,
  reference           text,
  signataire_fonction text,                        -- copie (ex. « Le Directeur »)
  signataire_nom      text,
  signataire_profil   uuid references profils(id) on delete set null, -- à qui valider
  signature_url       text,                        -- signature à apposer une fois validé
  statut              text not null default 'en_attente' check (statut in ('en_attente','valide','rejete')),
  motif_rejet         text,
  cree_par            uuid references profils(id) on delete set null,
  valide_le           timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists documents_ecole_idx on documents(ecole_id);
create index if not exists documents_signataire_idx on documents(signataire_profil, statut);

alter table documents enable row level security;

-- Lecture : la Gestion + le signataire assigné.
drop policy if exists documents_select on documents;
create policy documents_select on documents for select using (
  est_super_admin() or (ecole_id = ecole_courante() and (
    est_admin() or a_role('comptable') or a_role('secretaire') or signataire_profil = auth.uid()
  ))
);

-- Création : Gestion (promoteur / comptable / secrétaire).
drop policy if exists documents_insert on documents;
create policy documents_insert on documents for insert with check (
  est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('comptable') or a_role('secretaire')))
);

-- Modification : le signataire (valide/rejette) OU la Gestion.
drop policy if exists documents_update on documents;
create policy documents_update on documents for update using (
  est_super_admin() or (ecole_id = ecole_courante() and (
    est_admin() or a_role('comptable') or a_role('secretaire') or signataire_profil = auth.uid()
  ))
) with check (
  est_super_admin() or (ecole_id = ecole_courante() and (
    est_admin() or a_role('comptable') or a_role('secretaire') or signataire_profil = auth.uid()
  ))
);

-- Suppression : Gestion.
drop policy if exists documents_delete on documents;
create policy documents_delete on documents for delete using (
  est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('comptable') or a_role('secretaire')))
);
