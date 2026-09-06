-- =====================================================================
--  096 — COMPTABILITÉ (étape 3) : branchement des opérations
--  Chaque opération déjà saisie génère automatiquement son écriture en
--  partie double, SANS double comptage et SANS bloquer l'opération métier.
--  Méthode retenue : ENGAGEMENT (facturation → 411 → règlement).
--    • parametres_compta : activation par école (opt-in)
--    • regles_ecriture : mapping configurable (comptes de tiers, produit,
--      trésorerie, charge par catégorie)
--    • comptes.compte_pc_id : lien portefeuille de trésorerie → plan
--    • _compta_poster() : insertion d'une pièce équilibrée (ecole explicite)
--    • poster_facture / poster_paiement / poster_depense (idempotents)
--    • comptabiliser_exercice() : reprise de l'exercice courant
--    • triggers défensifs (jamais bloquants) sur factures/paiements/depenses
--  Les salaires seront branchés en 097.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ACTIVATION + RÈGLES + LIEN TRÉSORERIE
-- ---------------------------------------------------------------------
create table if not exists parametres_compta (
  ecole_id      uuid primary key references ecoles(id) on delete cascade,
  compta_active boolean not null default false,
  updated_at    timestamptz not null default now()
);
alter table parametres_compta enable row level security;
drop policy if exists parametres_compta_tenant on parametres_compta;
create policy parametres_compta_tenant on parametres_compta
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))));

create table if not exists regles_ecriture (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  cle          text not null,                    -- 'client','produit_scolarite','caisse','banque','mobile','charge_defaut','charge:<Catégorie>'
  compte_pc_id uuid not null references plan_comptable(id) on delete cascade,
  unique (ecole_id, cle)
);
create index if not exists regles_ecriture_ecole_idx on regles_ecriture(ecole_id);
alter table regles_ecriture enable row level security;
drop policy if exists regles_ecriture_tenant on regles_ecriture;
create policy regles_ecriture_tenant on regles_ecriture
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))));

alter table comptes add column if not exists compte_pc_id uuid references plan_comptable(id) on delete set null;

create table if not exists compta_erreurs (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid,
  source_type text,
  source_id   uuid,
  message     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. AMORÇAGE des règles + du lien trésorerie par école
-- ---------------------------------------------------------------------
do $$
declare
  e     record;
  m     jsonb;
  v_cle text;
  v_num text;
  v_cpt uuid;
begin
  -- Mapping par défaut clé -> numéro de compte du plan
  m := $j$ {
    "client":"411","produit_scolarite":"7060","fournisseur":"401",
    "caisse":"571","banque":"521","mobile":"531","virement_interne":"585",
    "perso_net":"422","ipres":"431","css":"432","ir":"441",
    "charge_perso":"661","charge_patronale":"664","charge_defaut":"638",
    "charge:Fournitures":"601","charge:Loyer":"622","charge:Électricité / Eau":"6052",
    "charge:Transport":"611","charge:Maintenance":"624","charge:Entretien":"624",
    "charge:Communication":"628","charge:Internet":"628","charge:Restauration":"6053",
    "charge:Fournisseurs":"601","charge:Impôts / Taxes":"641","charge:Divers":"638"
  } $j$::jsonb;

  for e in select id from ecoles loop
    -- Paramètres (inactif par défaut)
    insert into parametres_compta(ecole_id) values (e.id) on conflict (ecole_id) do nothing;

    -- Compte de détail imputable pour la scolarité (706 est une rubrique).
    if not exists (select 1 from plan_comptable where ecole_id = e.id and numero = '7060') then
      insert into plan_comptable(ecole_id, numero, libelle, classe, type, systeme, imputable, parent_id)
      values (e.id, '7060', 'Frais de scolarité', 7, 'produit', true, true,
              (select id from plan_comptable where ecole_id = e.id and numero = '706'));
    end if;

    -- Règles (si l'école n'en a pas encore)
    if not exists (select 1 from regles_ecriture where ecole_id = e.id) then
      for v_cle in select jsonb_object_keys(m) loop
        v_num := m->>v_cle;
        select id into v_cpt from plan_comptable where ecole_id = e.id and numero = v_num;
        if v_cpt is not null then
          insert into regles_ecriture(ecole_id, cle, compte_pc_id)
          values (e.id, v_cle, v_cpt) on conflict (ecole_id, cle) do nothing;
        end if;
      end loop;
    end if;

    -- Lien portefeuilles de trésorerie -> compte du plan (par type, si absent)
    update comptes c set compte_pc_id = (
      select id from plan_comptable p where p.ecole_id = e.id and p.numero =
        case c.type when 'banque' then '521' when 'mobile' then '531' else '571' end)
    where c.ecole_id = e.id and c.compte_pc_id is null;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Résolution de la trésorerie (compte + journal) d'une opération
-- ---------------------------------------------------------------------
create or replace function _compta_tresorerie(p_ecole uuid, p_compte_id uuid, p_mode text)
returns table(compte_id uuid, journal_code text)
language plpgsql security definer set search_path = public as $$
declare v_type text; v_pc uuid;
begin
  if p_compte_id is not null then
    select type, compte_pc_id into v_type, v_pc from comptes where id = p_compte_id;
  end if;
  if v_type is null or v_type = 'autre' then
    v_type := case
      when p_mode in ('wave','orange_money','free_money') then 'mobile'
      when p_mode in ('virement','cheque','carte') then 'banque'
      else 'caisse' end;
  end if;
  if v_pc is null then
    select compte_pc_id into v_pc from regles_ecriture
      where ecole_id = p_ecole
        and cle = case v_type when 'banque' then 'banque' when 'mobile' then 'mobile' else 'caisse' end;
  end if;
  compte_id := v_pc;
  journal_code := case v_type when 'banque' then 'BQ' when 'mobile' then 'MM' else 'CA' end;
  return next;
end $$;

-- ---------------------------------------------------------------------
-- 4. Moteur interne : insère une pièce équilibrée (école explicite).
--    Renvoie NULL si non comptabilisable (école inactive, hors exercice,
--    période clôturée) — sans lever d'exception.
-- ---------------------------------------------------------------------
create or replace function _compta_poster(
  p_ecole uuid, p_journal_code text, p_date date, p_libelle text,
  p_lignes jsonb, p_ref text, p_source_type text, p_source_id uuid, p_created_by uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_journal  journaux%rowtype;
  v_exercice uuid; v_periode uuid; v_piece uuid; v_existing uuid;
  ligne jsonb; v_compte uuid; v_deb numeric; v_cre numeric;
  v_sumd numeric := 0; v_sumc numeric := 0; v_n int; v_num text;
  v_annee int := extract(year from p_date)::int;
begin
  -- École activée ?
  if not exists (select 1 from parametres_compta where ecole_id = p_ecole and compta_active) then
    return null;
  end if;
  -- Idempotence
  if p_source_id is not null then
    select id into v_existing from pieces
      where ecole_id = p_ecole and source_type = p_source_type and source_id = p_source_id;
    if found then return v_existing; end if;
  end if;

  select * into v_journal from journaux where ecole_id = p_ecole and code = p_journal_code;
  if not found then return null; end if;

  select id into v_exercice from exercices
    where ecole_id = p_ecole and p_date between date_debut and date_fin and statut = 'ouvert'
    order by date_debut desc limit 1;
  if v_exercice is null then return null; end if;

  select id into v_periode from periodes_compta
    where exercice_id = v_exercice and annee = v_annee and mois = extract(month from p_date)::int;
  if v_periode is not null
     and exists (select 1 from periodes_compta where id = v_periode and statut = 'cloturee') then
    return null;
  end if;

  -- Équilibre (garde-fou ; les appelants fournissent des lignes équilibrées)
  for ligne in select * from jsonb_array_elements(p_lignes) loop
    v_deb := coalesce(nullif(ligne->>'debit','')::numeric, 0);
    v_cre := coalesce(nullif(ligne->>'credit','')::numeric, 0);
    v_sumd := v_sumd + v_deb; v_sumc := v_sumc + v_cre;
  end loop;
  if round(v_sumd,2) <> round(v_sumc,2) or v_sumd = 0 then
    raise exception 'Pièce déséquilibrée (% / %) pour % %', v_sumd, v_sumc, p_source_type, p_source_id;
  end if;

  select count(*) + 1 into v_n from pieces
    where ecole_id = p_ecole and journal_id = v_journal.id
      and extract(year from date_piece)::int = v_annee;
  v_num := v_journal.code || '-' || v_annee || '-' || lpad(v_n::text, 4, '0');

  insert into pieces(ecole_id, exercice_id, periode_id, journal_id, numero, date_piece,
                     libelle, reference, statut, source_type, source_id, created_by)
  values (p_ecole, v_exercice, v_periode, v_journal.id, v_num, p_date,
          p_libelle, p_ref, 'validee', p_source_type, p_source_id, p_created_by)
  returning id into v_piece;

  for ligne in select * from jsonb_array_elements(p_lignes) loop
    if (ligne->>'compte') ~ '^[0-9a-fA-F-]{36}$' then
      v_compte := (ligne->>'compte')::uuid;
    else
      select id into v_compte from plan_comptable
        where ecole_id = p_ecole and numero = (ligne->>'compte');
    end if;
    if v_compte is null
       or not exists (select 1 from plan_comptable
                      where id = v_compte and ecole_id = p_ecole and imputable = true and actif = true) then
      raise exception 'Compte "%" introuvable, non imputable ou inactif (%).', ligne->>'compte', p_source_type;
    end if;
    insert into ecritures(ecole_id, piece_id, compte_pc_id, libelle, debit, credit,
                          date_ecriture, reference, tiers_type, tiers_id)
    values (p_ecole, v_piece, v_compte, coalesce(nullif(ligne->>'libelle',''), p_libelle),
            coalesce(nullif(ligne->>'debit','')::numeric,0),
            coalesce(nullif(ligne->>'credit','')::numeric,0),
            p_date, p_ref, nullif(ligne->>'tiers_type',''), nullif(ligne->>'tiers_id','')::uuid);
  end loop;

  return v_piece;
end $$;

-- ---------------------------------------------------------------------
-- 5. Fonctions de comptabilisation par opération (idempotentes)
-- ---------------------------------------------------------------------
-- Facture émise : Débit 411 Famille / Crédit 706 Scolarité
create or replace function poster_facture(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare f factures%rowtype; v_client uuid; v_produit uuid; v_lignes jsonb; v_lib text;
begin
  select * into f from factures where id = p_id;
  if not found or f.statut = 'annulee' or coalesce(f.montant_total,0) <= 0 then return null; end if;
  select compte_pc_id into v_client  from regles_ecriture where ecole_id = f.ecole_id and cle = 'client';
  select compte_pc_id into v_produit from regles_ecriture where ecole_id = f.ecole_id and cle = 'produit_scolarite';
  if v_client is null or v_produit is null then return null; end if;
  v_lib := 'Facture ' || coalesce(f.numero, '') ;
  v_lignes := jsonb_build_array(
    jsonb_build_object('compte', v_client::text,  'debit',  f.montant_total, 'tiers_type','eleve','tiers_id', f.eleve_id::text),
    jsonb_build_object('compte', v_produit::text, 'credit', f.montant_total)
  );
  return _compta_poster(f.ecole_id, 'VE', f.date_emission, v_lib, v_lignes, f.numero, 'facture', f.id, null);
end $$;

-- Règlement : Débit trésorerie / Crédit 411 Famille
create or replace function poster_paiement(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p paiements%rowtype; f factures%rowtype; v_client uuid; v_tres record; v_lignes jsonb;
begin
  select * into p from paiements where id = p_id;
  if not found or coalesce(p.montant,0) <= 0 then return null; end if;
  select * into f from factures where id = p.facture_id;
  select compte_pc_id into v_client from regles_ecriture where ecole_id = p.ecole_id and cle = 'client';
  select * into v_tres from _compta_tresorerie(p.ecole_id, p.compte_id, p.mode::text);
  if v_client is null or v_tres.compte_id is null then return null; end if;
  v_lignes := jsonb_build_array(
    jsonb_build_object('compte', v_tres.compte_id::text, 'debit',  p.montant),
    jsonb_build_object('compte', v_client::text,        'credit', p.montant, 'tiers_type','eleve','tiers_id', f.eleve_id::text)
  );
  return _compta_poster(p.ecole_id, v_tres.journal_code, p.date_paiement,
    'Règlement facture ' || coalesce(f.numero,''), v_lignes, p.reference, 'paiement', p.id, null);
end $$;

-- Dépense (hors salaires) : Débit charge / Crédit trésorerie
create or replace function poster_depense(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare d depenses%rowtype; v_charge uuid; v_tres record; v_lignes jsonb;
begin
  select * into d from depenses where id = p_id;
  if not found or d.ref_salaire_id is not null or coalesce(d.montant,0) <= 0 then return null; end if;
  select compte_pc_id into v_charge from regles_ecriture
    where ecole_id = d.ecole_id and cle = 'charge:' || coalesce(d.categorie,'');
  if v_charge is null then
    select compte_pc_id into v_charge from regles_ecriture where ecole_id = d.ecole_id and cle = 'charge_defaut';
  end if;
  select * into v_tres from _compta_tresorerie(d.ecole_id, d.compte_id, d.mode::text);
  if v_charge is null or v_tres.compte_id is null then return null; end if;
  v_lignes := jsonb_build_array(
    jsonb_build_object('compte', v_charge::text,        'debit',  d.montant),
    jsonb_build_object('compte', v_tres.compte_id::text, 'credit', d.montant)
  );
  return _compta_poster(d.ecole_id, v_tres.journal_code, d.date_depense,
    coalesce(d.libelle,'Dépense'), v_lignes, null, 'depense', d.id, d.saisi_par);
end $$;

-- ---------------------------------------------------------------------
-- 6. Reprise de l'exercice courant (ou d'un exercice donné)
-- ---------------------------------------------------------------------
create or replace function comptabiliser_exercice(p_exercice_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid := ecole_courante();
  ex exercices%rowtype;
  r record; nf int := 0; np int := 0; nd int := 0;
begin
  if not (est_super_admin() or est_gestion() or a_role('comptable')) then
    raise exception 'Non autorisé.';
  end if;
  if p_exercice_id is not null then
    select * into ex from exercices where id = p_exercice_id and ecole_id = v_ecole;
  else
    select * into ex from exercices where ecole_id = v_ecole and statut = 'ouvert'
      order by date_debut desc limit 1;
  end if;
  if not found then raise exception 'Aucun exercice cible.'; end if;

  -- Active la comptabilité de l'école (sinon _compta_poster ne fait rien)
  insert into parametres_compta(ecole_id, compta_active) values (v_ecole, true)
    on conflict (ecole_id) do update set compta_active = true, updated_at = now();

  for r in select id from factures where ecole_id = v_ecole and statut <> 'annulee'
             and date_emission between ex.date_debut and ex.date_fin loop
    if poster_facture(r.id) is not null then nf := nf + 1; end if;
  end loop;
  for r in select p.id from paiements p where p.ecole_id = v_ecole
             and p.date_paiement between ex.date_debut and ex.date_fin loop
    if poster_paiement(r.id) is not null then np := np + 1; end if;
  end loop;
  for r in select id from depenses where ecole_id = v_ecole and ref_salaire_id is null
             and date_depense between ex.date_debut and ex.date_fin loop
    if poster_depense(r.id) is not null then nd := nd + 1; end if;
  end loop;

  return jsonb_build_object('factures', nf, 'paiements', np, 'depenses', nd, 'exercice', ex.libelle);
end $$;
grant execute on function comptabiliser_exercice(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Triggers défensifs — ne bloquent JAMAIS l'opération métier
-- ---------------------------------------------------------------------
create or replace function trg_poster_facture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin perform poster_facture(new.id);
  exception when others then
    insert into compta_erreurs(ecole_id, source_type, source_id, message)
    values (new.ecole_id, 'facture', new.id, sqlerrm);
  end;
  return null;
end $$;

create or replace function trg_poster_paiement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin perform poster_paiement(new.id);
  exception when others then
    insert into compta_erreurs(ecole_id, source_type, source_id, message)
    values (new.ecole_id, 'paiement', new.id, sqlerrm);
  end;
  return null;
end $$;

create or replace function trg_poster_depense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin perform poster_depense(new.id);
  exception when others then
    insert into compta_erreurs(ecole_id, source_type, source_id, message)
    values (new.ecole_id, 'depense', new.id, sqlerrm);
  end;
  return null;
end $$;

drop trigger if exists poster_facture_ins  on factures;
drop trigger if exists poster_paiement_ins on paiements;
drop trigger if exists poster_depense_ins  on depenses;
-- Facture : à l'insertion et quand le total passe > 0 (l'idempotence évite les doublons)
create trigger poster_facture_ins  after insert or update of montant_total on factures
  for each row execute function trg_poster_facture();
create trigger poster_paiement_ins after insert on paiements
  for each row execute function trg_poster_paiement();
create trigger poster_depense_ins  after insert on depenses
  for each row execute function trg_poster_depense();

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists poster_depense_ins on depenses;
-- drop trigger if exists poster_paiement_ins on paiements;
-- drop trigger if exists poster_facture_ins on factures;
-- drop function if exists trg_poster_depense(); drop function if exists trg_poster_paiement(); drop function if exists trg_poster_facture();
-- drop function if exists comptabiliser_exercice(uuid);
-- drop function if exists poster_depense(uuid); drop function if exists poster_paiement(uuid); drop function if exists poster_facture(uuid);
-- drop function if exists _compta_poster(uuid,text,date,text,jsonb,text,text,uuid,uuid);
-- drop function if exists _compta_tresorerie(uuid,uuid,text);
-- alter table comptes drop column if exists compte_pc_id;
-- drop table if exists compta_erreurs; drop table if exists regles_ecriture; drop table if exists parametres_compta;
