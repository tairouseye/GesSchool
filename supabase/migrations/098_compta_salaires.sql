-- =====================================================================
--  098 — COMPTABILITÉ (P1 audit RH&Paie) : comptabilisation des salaires
--  Une paie VALIDÉE génère l'écriture de constatation ; le PAIEMENT génère
--  le règlement. Non bloquant (compta_erreurs), idempotent, réversible.
--
--  Constatation (journal SA), à la validation :
--    Débit  661  Rémunérations du personnel      = Σ gains
--    Débit  664  Charges sociales patronales      = Σ patronal
--    Crédit 422  Personnel — net à payer          = net
--    Crédit 431/432/438  Organismes sociaux        (cotis. sal. + patronales)
--    Crédit 441  État — impôts sur salaires        (IR + TRIMF)
--    Crédit 447  État (CFCE patronal)
--    Crédit 421  Avances/prêts (remboursements)
--    Crédit 423  Retenues diverses
--  Règlement (journal trésorerie), au paiement :
--    Débit  422 / Crédit 5x (caisse/banque/mobile du paiement)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Règles de mapping complémentaires (comptes déjà présents au plan 094)
-- ---------------------------------------------------------------------
do $$
declare e record; m jsonb; v_cle text; v_num text; v_cpt uuid;
begin
  m := $j$ {"ipm":"438","cfce":"447","avance":"421","retenue_div":"423"} $j$::jsonb;
  for e in select id from ecoles loop
    for v_cle in select jsonb_object_keys(m) loop
      v_num := m->>v_cle;
      select id into v_cpt from plan_comptable where ecole_id = e.id and numero = v_num;
      if v_cpt is not null then
        insert into regles_ecriture(ecole_id, cle, compte_pc_id)
        values (e.id, v_cle, v_cpt) on conflict (ecole_id, cle) do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Compte de crédit d'une ligne de retenue / patronale
-- ---------------------------------------------------------------------
create or replace function _compte_ligne_salaire(p_ecole uuid, p_sens text, p_nature text, p_libelle text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cle text;
begin
  if p_nature = 'impot' then
    v_cle := 'ir';
  elsif p_nature = 'remboursement' then
    v_cle := 'avance';
  elsif p_nature in ('cotisation') or p_sens = 'patronal' then
    v_cle := case
      when p_libelle ilike '%IPRES%' then 'ipres'
      when p_libelle ilike '%CSS%'   then 'css'
      when p_libelle ilike '%IPM%'   then 'ipm'
      when p_libelle ilike '%CFCE%'  then 'cfce'
      else 'ipres' end;
  else
    v_cle := 'retenue_div';
  end if;
  return (select compte_pc_id from regles_ecriture where ecole_id = p_ecole and cle = v_cle);
end $$;

-- ---------------------------------------------------------------------
-- 3. Constatation de la paie (à la validation)
-- ---------------------------------------------------------------------
create or replace function poster_salaire_charge(p_salaire uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s        salaires%rowtype;
  v_g      numeric := 0;   -- Σ gains
  v_p      numeric := 0;   -- Σ patronal
  v_r      numeric := 0;   -- Σ retenues
  v_net    numeric;
  v_date   date;
  v_lignes jsonb := '[]'::jsonb;
  v_c661   uuid; v_c664 uuid; v_c422 uuid;
  rec      record;
  v_lib    text;
begin
  select * into s from salaires where id = p_salaire;
  if not found then return null; end if;
  if s.statut is null or s.statut = 'brouillon' then return null; end if;

  select coalesce(sum(montant) filter (where sens = 'gain'), 0),
         coalesce(sum(montant) filter (where sens = 'patronal'), 0),
         coalesce(sum(montant) filter (where sens = 'retenue'), 0)
    into v_g, v_p, v_r
  from salaire_lignes where salaire_id = p_salaire;
  if v_g <= 0 then return null; end if;
  v_net := v_g - v_r;

  select compte_pc_id into v_c661 from regles_ecriture where ecole_id = s.ecole_id and cle = 'charge_perso';
  select compte_pc_id into v_c664 from regles_ecriture where ecole_id = s.ecole_id and cle = 'charge_patronale';
  select compte_pc_id into v_c422 from regles_ecriture where ecole_id = s.ecole_id and cle = 'perso_net';
  if v_c661 is null or v_c422 is null then return null; end if;

  -- Débits : 661 (rémunérations) + 664 (patronal)
  v_lignes := jsonb_build_array(jsonb_build_object('compte', v_c661::text, 'debit', v_g, 'libelle', 'Rémunérations'));
  if v_p > 0 and v_c664 is not null then
    v_lignes := v_lignes || jsonb_build_object('compte', v_c664::text, 'debit', v_p, 'libelle', 'Charges patronales');
  end if;

  -- Crédits : net à payer (422)
  v_lignes := v_lignes || jsonb_build_object('compte', v_c422::text, 'credit', v_net,
                'tiers_type', 'personnel', 'tiers_id', s.personnel_id::text, 'libelle', 'Net à payer');

  -- Crédits : retenues + patronales, regroupées par compte
  for rec in
    select _compte_ligne_salaire(s.ecole_id, sens, nature, libelle) as compte, sum(montant) as m
    from salaire_lignes
    where salaire_id = p_salaire and sens in ('retenue', 'patronal')
    group by 1
  loop
    if rec.compte is not null and rec.m > 0 then
      v_lignes := v_lignes || jsonb_build_object('compte', rec.compte::text, 'credit', rec.m);
    end if;
  end loop;

  v_date := (s.periode || '-01')::date;
  v_lib := 'Paie ' || s.periode;
  return _compta_poster(s.ecole_id, 'SA', v_date, v_lib, v_lignes, s.periode, 'salaire_charge', p_salaire, auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- 4. Règlement de la paie (au paiement) — depuis la dépense salaire
-- ---------------------------------------------------------------------
create or replace function poster_salaire_reglement(p_depense uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare d depenses%rowtype; v_c422 uuid; v_tres record; v_lignes jsonb;
begin
  select * into d from depenses where id = p_depense;
  if not found or d.ref_salaire_id is null or coalesce(d.montant,0) <= 0 then return null; end if;
  select compte_pc_id into v_c422 from regles_ecriture where ecole_id = d.ecole_id and cle = 'perso_net';
  select * into v_tres from _compta_tresorerie(d.ecole_id, d.compte_id, d.mode::text);
  if v_c422 is null or v_tres.compte_id is null then return null; end if;
  v_lignes := jsonb_build_array(
    jsonb_build_object('compte', v_c422::text,          'debit',  d.montant, 'libelle', 'Règlement salaire'),
    jsonb_build_object('compte', v_tres.compte_id::text, 'credit', d.montant)
  );
  -- source = le salaire (idempotence règlement liée au salaire)
  return _compta_poster(d.ecole_id, v_tres.journal_code, d.date_depense,
    coalesce(d.libelle, 'Règlement salaire'), v_lignes, null, 'salaire_reglement', d.ref_salaire_id, auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- 5. Suppression d'une pièce salaire (dévalidation / annulation paiement)
--    Uniquement si la période comptable n'est pas clôturée.
-- ---------------------------------------------------------------------
create or replace function _annuler_piece_source(p_ecole uuid, p_source_type text, p_source_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from pieces p
   where p.ecole_id = p_ecole and p.source_type = p_source_type and p.source_id = p_source_id
     and (p.periode_id is null
          or not exists (select 1 from periodes_compta pc where pc.id = p.periode_id and pc.statut = 'cloturee'));
end $$;

-- ---------------------------------------------------------------------
-- 6. Triggers (défensifs, jamais bloquants)
-- ---------------------------------------------------------------------
-- 6.a Sur salaires : constatation à la validation, annulation au retour brouillon.
create or replace function trg_compta_salaire()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.statut in ('valide', 'paye') then
      perform poster_salaire_charge(new.id);
    elsif new.statut = 'brouillon' and old.statut in ('valide', 'paye') then
      perform _annuler_piece_source(new.ecole_id, 'salaire_charge', new.id);
      perform _annuler_piece_source(new.ecole_id, 'salaire_reglement', new.id);
    end if;
  exception when others then
    insert into compta_erreurs(ecole_id, source_type, source_id, message)
    values (new.ecole_id, 'salaire', new.id, sqlerrm);
  end;
  return null;
end $$;

drop trigger if exists compta_salaire_upd on salaires;
create trigger compta_salaire_upd after update of statut on salaires
  for each row when (new.statut is distinct from old.statut)
  execute function trg_compta_salaire();

-- 6.b Sur depenses : la dépense salaire génère le RÈGLEMENT (pas une charge).
--     (remplace le comportement « skip » de 096 pour les dépenses de salaire)
create or replace function trg_poster_depense()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.ref_salaire_id is not null then
      perform poster_salaire_reglement(new.id);
    else
      perform poster_depense(new.id);
    end if;
  exception when others then
    insert into compta_erreurs(ecole_id, source_type, source_id, message)
    values (new.ecole_id, 'depense', new.id, sqlerrm);
  end;
  return null;
end $$;

-- 6.c Suppression de la dépense salaire (annulation paiement) → annule le règlement.
create or replace function trg_suppr_depense_salaire()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if old.ref_salaire_id is not null then
      perform _annuler_piece_source(old.ecole_id, 'salaire_reglement', old.ref_salaire_id);
    end if;
  exception when others then null;
  end;
  return null;
end $$;

drop trigger if exists suppr_depense_salaire on depenses;
create trigger suppr_depense_salaire after delete on depenses
  for each row execute function trg_suppr_depense_salaire();

-- ---------------------------------------------------------------------
-- 7. Reprise d'exercice : inclure les salaires (constatation + règlement)
-- ---------------------------------------------------------------------
create or replace function comptabiliser_exercice(p_exercice_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid := ecole_courante();
  ex exercices%rowtype;
  r record; nf int := 0; np int := 0; nd int := 0; ns int := 0;
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
  -- Salaires : constatation (bulletins validés/payés de l'exercice)
  for r in select id from salaires where ecole_id = v_ecole and statut in ('valide','paye')
             and (periode || '-01')::date between ex.date_debut and ex.date_fin loop
    if poster_salaire_charge(r.id) is not null then ns := ns + 1; end if;
  end loop;
  -- Salaires : règlement (dépenses de salaire payées)
  for r in select id from depenses where ecole_id = v_ecole and ref_salaire_id is not null
             and date_depense between ex.date_debut and ex.date_fin loop
    perform poster_salaire_reglement(r.id);
  end loop;

  return jsonb_build_object('factures', nf, 'paiements', np, 'depenses', nd, 'salaires', ns, 'exercice', ex.libelle);
end $$;
grant execute on function comptabiliser_exercice(uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists suppr_depense_salaire on depenses;
-- drop trigger if exists compta_salaire_upd on salaires;
-- drop function if exists trg_suppr_depense_salaire();
-- drop function if exists trg_compta_salaire();
-- drop function if exists _annuler_piece_source(uuid,text,uuid);
-- drop function if exists poster_salaire_reglement(uuid);
-- drop function if exists poster_salaire_charge(uuid);
-- drop function if exists _compte_ligne_salaire(uuid,text,text,text);
-- Restaurer trg_poster_depense de 096 (sans la branche salaire) si nécessaire.
