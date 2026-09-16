-- =====================================================================
--  109 — Supérieur (LMD) : inscriptions administrative & pédagogique
--
--  • Inscription ADMINISTRATIVE (IA) : rattache un étudiant (table `eleves`)
--    à une filière + niveau pour une année ; peut porter la facture de
--    droits (réutilise le module finances).
--  • Inscription PÉDAGOGIQUE (IP) : les UE choisies par l'étudiant pour
--    l'année (une ligne par UE).
--
--  Additif et isolé. RLS multi-établissement identique au reste.
-- =====================================================================

create table if not exists inscriptions_sup (
  id                uuid primary key default gen_random_uuid(),
  ecole_id          uuid not null references ecoles(id) on delete cascade,
  eleve_id          uuid not null references eleves(id) on delete cascade,
  filiere_id        uuid not null references filieres(id) on delete cascade,
  niveau            text,                                   -- L1…M2
  annee_id          uuid references annees_scolaires(id) on delete set null,
  date_inscription  date not null default current_date,
  statut            text not null default 'active'
                    check (statut in ('active','suspendue','annulee')),
  droits_facture_id uuid references factures(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (eleve_id, filiere_id, annee_id)
);
create index if not exists inscriptions_sup_ecole_idx on inscriptions_sup(ecole_id);
create index if not exists inscriptions_sup_filiere_idx on inscriptions_sup(filiere_id, annee_id);

create table if not exists inscriptions_ue (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  inscription_id uuid not null references inscriptions_sup(id) on delete cascade,
  ue_id          uuid not null references ue(id) on delete cascade,
  statut         text not null default 'inscrit'
                 check (statut in ('inscrit','valide','ajourne','en_dette')),
  created_at     timestamptz not null default now(),
  unique (inscription_id, ue_id)
);
create index if not exists inscriptions_ue_ecole_idx on inscriptions_ue(ecole_id);
create index if not exists inscriptions_ue_insc_idx on inscriptions_ue(inscription_id);

-- RLS : lecture = membre de l'école ; écriture = promoteur, direction ou gestion
-- (l'inscription administrative relève aussi du secrétariat / de la caisse).
do $$
declare t text;
begin
  foreach t in array array['inscriptions_sup','inscriptions_ue']
  loop
    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      est_super_admin() or ecole_id = ecole_courante()
    );$p$, t, t);

    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_ecrire on %I for all using (
      est_super_admin() or (ecole_id = ecole_courante() and (
        est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')
      ))
    ) with check (
      est_super_admin() or (ecole_id = ecole_courante() and (
        est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')
      ))
    );$p$, t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists inscriptions_ue, inscriptions_sup cascade;
