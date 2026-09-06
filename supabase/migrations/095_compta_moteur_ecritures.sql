-- =====================================================================
--  095 — COMPTABILITÉ (étape 2) : moteur d'écritures en partie double
--    • pieces : un lot d'écritures équilibré (date, journal, n°, statut)
--    • ecritures : enrichie (rattachée à une pièce + compte du plan)
--    • comptabiliser_piece() : contrôle Σdébit = Σcrédit, période ouverte,
--      compte imputable, idempotence par (source_type, source_id)
--    • supprimer_piece() : suppression d'une pièce MANUELLE (période ouverte)
--  Aucune opération n'est encore branchée automatiquement (étape 3).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PIÈCES COMPTABLES
-- ---------------------------------------------------------------------
create table if not exists pieces (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  exercice_id  uuid references exercices(id) on delete set null,
  periode_id   uuid references periodes_compta(id) on delete set null,
  journal_id   uuid not null references journaux(id) on delete restrict,
  numero       text,                       -- ex. VE-2025-0001
  date_piece   date not null default current_date,
  libelle      text,
  reference    text,
  statut       text not null default 'validee' check (statut in ('brouillon','validee','annulee')),
  source_type  text not null default 'manuel',  -- manuel | paiement | depense | salaire | transfert | fournisseur | immobilisation | ouverture
  source_id    uuid,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists pieces_ecole_idx on pieces(ecole_id);
create index if not exists pieces_journal_idx on pieces(journal_id);
create index if not exists pieces_date_idx on pieces(ecole_id, date_piece);
-- Idempotence : une même opération source n'est comptabilisée qu'une fois.
create unique index if not exists pieces_source_uidx
  on pieces(ecole_id, source_type, source_id) where source_id is not null;

-- ---------------------------------------------------------------------
-- 2. ÉCRITURES (enrichissement de la table existante, non destructif)
--    L'ancienne colonne compte_id (→ comptes trésorerie) reste, inutilisée.
-- ---------------------------------------------------------------------
alter table ecritures add column if not exists piece_id     uuid references pieces(id) on delete cascade;
alter table ecritures add column if not exists compte_pc_id uuid references plan_comptable(id) on delete restrict;
alter table ecritures add column if not exists tiers_type   text;
alter table ecritures add column if not exists tiers_id     uuid;
create index if not exists ecritures_piece_idx     on ecritures(piece_id);
create index if not exists ecritures_compte_pc_idx on ecritures(compte_pc_id);

-- ---------------------------------------------------------------------
-- 3. RLS (lecture réservée gestion/comptable ; l'écriture passe par RPC)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pieces','ecritures'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_tenant on %I', t, t);
    execute format(
      'create policy %I_tenant on %I using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role(''comptable'')))) with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role(''comptable''))))',
      t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. MOTEUR : comptabiliser_piece()
--    p_lignes : [{ "compte":"706"|uuid, "libelle":..., "debit":n, "credit":n,
--                  "tiers_type":..., "tiers_id":uuid }]
-- ---------------------------------------------------------------------
create or replace function comptabiliser_piece(
  p_journal_id  uuid,
  p_date        date,
  p_libelle     text,
  p_lignes      jsonb,
  p_reference   text default null,
  p_source_type text default 'manuel',
  p_source_id   uuid default null,
  p_statut      text default 'validee'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ecole    uuid := ecole_courante();
  v_exercice uuid;
  v_periode  uuid;
  v_journal  journaux%rowtype;
  v_piece    uuid;
  v_existing uuid;
  ligne      jsonb;
  v_compte   uuid;
  v_deb      numeric;
  v_cre      numeric;
  v_sumd     numeric := 0;
  v_sumc     numeric := 0;
  v_n        int;
  v_num      text;
  v_annee    int := extract(year from p_date)::int;
begin
  if not (est_super_admin() or est_gestion() or a_role('comptable')) then
    raise exception 'Non autorisé.';
  end if;
  if v_ecole is null then raise exception 'École introuvable.'; end if;

  select * into v_journal from journaux where id = p_journal_id and ecole_id = v_ecole;
  if not found then raise exception 'Journal introuvable.'; end if;

  -- Idempotence
  if p_source_id is not null then
    select id into v_existing from pieces
      where ecole_id = v_ecole and source_type = p_source_type and source_id = p_source_id;
    if found then return v_existing; end if;
  end if;

  -- Exercice ouvert couvrant la date
  select id into v_exercice from exercices
    where ecole_id = v_ecole and p_date between date_debut and date_fin and statut = 'ouvert'
    order by date_debut desc limit 1;
  if v_exercice is null then
    raise exception 'Aucun exercice ouvert ne couvre le %.', p_date;
  end if;

  -- Période (verrou si clôturée)
  select id into v_periode from periodes_compta
    where exercice_id = v_exercice and annee = v_annee and mois = extract(month from p_date)::int;
  if v_periode is not null
     and exists (select 1 from periodes_compta where id = v_periode and statut = 'cloturee') then
    raise exception 'Période comptable clôturée : saisie impossible.';
  end if;

  -- Contrôle des lignes + équilibre
  if p_lignes is null or jsonb_array_length(p_lignes) < 2 then
    raise exception 'Une pièce comptable exige au moins deux lignes.';
  end if;
  for ligne in select * from jsonb_array_elements(p_lignes) loop
    v_deb := coalesce(nullif(ligne->>'debit','')::numeric, 0);
    v_cre := coalesce(nullif(ligne->>'credit','')::numeric, 0);
    if v_deb < 0 or v_cre < 0 then raise exception 'Montant négatif interdit.'; end if;
    if (v_deb > 0) = (v_cre > 0) then
      raise exception 'Chaque ligne doit porter soit un débit, soit un crédit (pas les deux, pas zéro).';
    end if;
    v_sumd := v_sumd + v_deb; v_sumc := v_sumc + v_cre;
  end loop;
  if round(v_sumd, 2) <> round(v_sumc, 2) then
    raise exception 'Pièce déséquilibrée : débit % ≠ crédit %.', v_sumd, v_sumc;
  end if;

  -- Numéro : CODE-AAAA-NNNN par journal et par an
  select count(*) + 1 into v_n from pieces
    where ecole_id = v_ecole and journal_id = p_journal_id
      and extract(year from date_piece)::int = v_annee;
  v_num := v_journal.code || '-' || v_annee || '-' || lpad(v_n::text, 4, '0');

  insert into pieces(ecole_id, exercice_id, periode_id, journal_id, numero, date_piece,
                     libelle, reference, statut, source_type, source_id, created_by)
  values (v_ecole, v_exercice, v_periode, p_journal_id, v_num, p_date,
          p_libelle, p_reference, coalesce(p_statut,'validee'), coalesce(p_source_type,'manuel'),
          p_source_id, auth.uid())
  returning id into v_piece;

  for ligne in select * from jsonb_array_elements(p_lignes) loop
    -- Résolution du compte : uuid direct ou numéro du plan
    if (ligne->>'compte') ~ '^[0-9a-fA-F-]{36}$' then
      v_compte := (ligne->>'compte')::uuid;
    else
      select id into v_compte from plan_comptable
        where ecole_id = v_ecole and numero = (ligne->>'compte');
    end if;
    if v_compte is null
       or not exists (select 1 from plan_comptable
                      where id = v_compte and ecole_id = v_ecole and imputable = true and actif = true) then
      raise exception 'Compte "%" introuvable, non imputable ou inactif.', ligne->>'compte';
    end if;

    insert into ecritures(ecole_id, piece_id, compte_pc_id, libelle, debit, credit,
                          date_ecriture, reference, tiers_type, tiers_id)
    values (v_ecole, v_piece, v_compte, coalesce(nullif(ligne->>'libelle',''), p_libelle),
            coalesce(nullif(ligne->>'debit','')::numeric, 0),
            coalesce(nullif(ligne->>'credit','')::numeric, 0),
            p_date, p_reference, nullif(ligne->>'tiers_type',''), nullif(ligne->>'tiers_id','')::uuid);
  end loop;

  return v_piece;
end $$;
grant execute on function comptabiliser_piece(uuid,date,text,jsonb,text,text,uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Suppression d'une pièce MANUELLE (période ouverte uniquement)
--    Les pièces générées par une opération (paiement, salaire…) ne se
--    suppriment pas ici : on annule l'opération d'origine (étapes suivantes).
-- ---------------------------------------------------------------------
create or replace function supprimer_piece(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid := ecole_courante();
  v_p pieces%rowtype;
begin
  if not (est_super_admin() or est_gestion() or a_role('comptable')) then
    raise exception 'Non autorisé.';
  end if;
  select * into v_p from pieces where id = p_id and ecole_id = v_ecole;
  if not found then raise exception 'Pièce introuvable.'; end if;
  if v_p.source_type <> 'manuel' then
    raise exception 'Cette pièce provient d''une opération : annulez l''opération d''origine.';
  end if;
  if v_p.periode_id is not null
     and exists (select 1 from periodes_compta where id = v_p.periode_id and statut = 'cloturee') then
    raise exception 'Période clôturée : suppression impossible.';
  end if;
  delete from pieces where id = p_id and ecole_id = v_ecole;  -- ecritures supprimées en cascade
end $$;
grant execute on function supprimer_piece(uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists supprimer_piece(uuid);
-- drop function if exists comptabiliser_piece(uuid,date,text,jsonb,text,text,uuid,text);
-- alter table ecritures drop column if exists tiers_id;
-- alter table ecritures drop column if exists tiers_type;
-- alter table ecritures drop column if exists compte_pc_id;
-- alter table ecritures drop column if exists piece_id;
-- drop table if exists pieces;
