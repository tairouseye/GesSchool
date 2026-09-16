-- =====================================================================
--  110 — Supérieur (LMD) : notes & évaluation
--
--  Note d'un étudiant pour un ECUE (ou l'UE directement si elle n'a pas
--  d'ECUE), décomposée en contrôle continu (cc) et examen, par session
--  (normale ou rattrapage). Le calcul (ECUE→UE→semestre, capitalisation,
--  compensation) est fait côté application (moteur pur `lib/lmd.js`).
--
--  Additif et isolé. RLS multi-établissement.
-- =====================================================================

create table if not exists notes_lmd (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  inscription_id uuid not null references inscriptions_sup(id) on delete cascade,
  ue_id          uuid not null references ue(id) on delete cascade,
  ecue_id        uuid references ecue(id) on delete cascade,     -- null = note au niveau UE
  session        text not null default 'normale' check (session in ('normale','rattrapage')),
  cc             numeric(5,2),
  examen         numeric(5,2),
  created_at     timestamptz not null default now()
);
create index if not exists notes_lmd_ecole_idx on notes_lmd(ecole_id);
create index if not exists notes_lmd_insc_idx on notes_lmd(inscription_id, session);
create index if not exists notes_lmd_ue_idx on notes_lmd(ue_id, session);

-- Unicité par (inscription, UE, ECUE, session). L'ECUE nul (note UE) est
-- neutralisé via un sentinel pour que « une seule note UE » soit garantie.
create unique index if not exists notes_lmd_unique_idx on notes_lmd
  (inscription_id, ue_id, coalesce(ecue_id, '00000000-0000-0000-0000-000000000000'::uuid), session);

alter table notes_lmd enable row level security;

drop policy if exists notes_lmd_select on notes_lmd;
create policy notes_lmd_select on notes_lmd for select using (
  est_super_admin() or ecole_id = ecole_courante()
);

-- Écriture : promoteur, responsable pédagogique ou enseignant.
drop policy if exists notes_lmd_ecrire on notes_lmd;
create policy notes_lmd_ecrire on notes_lmd for all using (
  est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('direction') or a_role('enseignant')))
) with check (
  est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('direction') or a_role('enseignant')))
);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists notes_lmd cascade;
