-- =====================================================================
--  088 — PHASE 1 : contrôle interne & traçabilité de la paie
--  (1) Piste d'audit des MONTANTS : triggers qui historisent dans journal_audit
--      les changements de montant de ligne, de salaire de base (contrat) et de
--      taux horaire (personnel) — inviolables (côté base, quelle que soit la source).
--  (2) Garde de suppression : un bulletin hors 'brouillon' ne peut plus être supprimé.
--  (3) Séparation des tâches (optionnelle, par école) : le valideur ne peut pas
--      payer le bulletin qu'il a validé.
--  Ne modifie aucun calcul. Journalise seulement les lignes SAISIES (les lignes
--  statutaires recalculées — cotisations/IR/TRIMF/patronal — sont ignorées).
-- =====================================================================

-- (1a) Audit des lignes de salaire (montant modifié / ligne supprimée) ----
create or replace function trg_audit_salaire_lignes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    if coalesce(new.montant,0) <> coalesce(old.montant,0)
       and (new.nature is null or new.nature not in ('cotisation','impot','patronal')) then
      insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
      values (new.ecole_id, auth.uid(), 'salaire_ligne', new.salaire_id, 'modif_montant',
              jsonb_build_object('libelle', new.libelle, 'ancien', old.montant, 'nouveau', new.montant));
    end if;
  elsif TG_OP = 'DELETE' then
    if (old.nature is null or old.nature not in ('cotisation','impot','patronal')) then
      insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
      values (old.ecole_id, auth.uid(), 'salaire_ligne', old.salaire_id, 'suppr_ligne',
              jsonb_build_object('libelle', old.libelle, 'montant', old.montant));
    end if;
  end if;
  return null;
end $$;

drop trigger if exists salaire_lignes_audit on salaire_lignes;
create trigger salaire_lignes_audit
  after update or delete on salaire_lignes
  for each row execute function trg_audit_salaire_lignes();

-- (1b) Audit du salaire de base (contrat) ----
create or replace function trg_audit_contrats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.salaire_base,0) <> coalesce(old.salaire_base,0) then
    insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
    values (new.ecole_id, auth.uid(), 'contrat', new.id, 'modif_salaire_base',
            jsonb_build_object('personnel_id', new.personnel_id, 'ancien', old.salaire_base, 'nouveau', new.salaire_base));
  end if;
  return null;
end $$;

drop trigger if exists contrats_audit on contrats;
create trigger contrats_audit after update on contrats
  for each row execute function trg_audit_contrats();

-- (1c) Audit des taux horaires (personnel) ----
create or replace function trg_audit_personnels()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.taux_horaire,0) <> coalesce(old.taux_horaire,0)
     or coalesce(new.taux_sursalaire,0) <> coalesce(old.taux_sursalaire,0) then
    insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
    values (new.ecole_id, auth.uid(), 'personnel', new.id, 'modif_taux',
            jsonb_build_object('taux_horaire', jsonb_build_object('ancien', old.taux_horaire, 'nouveau', new.taux_horaire),
                               'taux_sursalaire', jsonb_build_object('ancien', old.taux_sursalaire, 'nouveau', new.taux_sursalaire)));
  end if;
  return null;
end $$;

drop trigger if exists personnels_audit on personnels;
create trigger personnels_audit after update on personnels
  for each row execute function trg_audit_personnels();

-- (2) Garde de suppression : bulletin hors 'brouillon' non supprimable ----
create or replace function trg_no_delete_salaire()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.statut is distinct from 'brouillon' and not est_super_admin() then
    raise exception 'Suppression impossible : bulletin « % ». Annulez le paiement / dévalidez d''abord.', old.statut;
  end if;
  return old;
end $$;

drop trigger if exists salaires_no_delete on salaires;
create trigger salaires_no_delete before delete on salaires
  for each row execute function trg_no_delete_salaire();

-- (3) payer_salaire + séparation des tâches optionnelle (parametres.paie_sod) --
create or replace function payer_salaire(
  p_salaire uuid, p_date date default current_date,
  p_mode public.mode_paiement default null, p_compte uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_s record; v_sod boolean;
begin
  select s.*, pe.prenom, pe.nom into v_s
  from salaires s join personnels pe on pe.id = s.personnel_id where s.id = p_salaire;
  if v_s is null then raise exception 'Fiche de paie introuvable.'; end if;
  if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;
  if v_s.statut = 'brouillon' then raise exception 'Validez le bulletin avant de le payer.'; end if;
  if p_compte is not null and not exists (select 1 from comptes c where c.id = p_compte and c.ecole_id = v_s.ecole_id) then
    raise exception 'Compte de trésorerie invalide pour cette école.';
  end if;

  -- Séparation des tâches : si activée, le valideur ne peut pas payer.
  select (valeur->>'actif')::boolean into v_sod from parametres
    where ecole_id = v_s.ecole_id and cle = 'paie_sod';
  if coalesce(v_sod, false) and not est_super_admin()
     and exists (select 1 from journal_audit where entite = 'salaire' and entite_id = p_salaire
                 and operation = 'validation' and utilisateur = auth.uid()) then
    raise exception 'Séparation des tâches : le valideur ne peut pas payer ce bulletin. Demandez à un autre utilisateur.';
  end if;

  update salaires set paye = true, statut = 'paye', date_paiement = coalesce(p_date, current_date), mode = p_mode
    where id = p_salaire;

  if not exists (select 1 from depenses where ref_salaire_id = p_salaire) then
    insert into depenses (ecole_id, compte_id, libelle, categorie, montant, mode,
                          date_depense, beneficiaire, ref_salaire_id, saisi_par)
    values (v_s.ecole_id, p_compte, 'Salaire ' || v_s.periode || ' — ' || v_s.prenom || ' ' || v_s.nom,
            'Salaires', v_s.montant_net, p_mode, coalesce(p_date, current_date),
            v_s.prenom || ' ' || v_s.nom, p_salaire, auth.uid());
  end if;
  insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
    values (v_s.ecole_id, auth.uid(), 'salaire', p_salaire, 'paiement',
            jsonb_build_object('net', v_s.montant_net, 'mode', p_mode, 'compte', p_compte, 'date', coalesce(p_date, current_date)));
end $$;

grant execute on function payer_salaire(uuid, date, public.mode_paiement, uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists salaire_lignes_audit on salaire_lignes;
-- drop trigger if exists contrats_audit on contrats;
-- drop trigger if exists personnels_audit on personnels;
-- drop trigger if exists salaires_no_delete on salaires;
-- drop function if exists trg_audit_salaire_lignes(); drop function if exists trg_audit_contrats();
-- drop function if exists trg_audit_personnels(); drop function if exists trg_no_delete_salaire();
-- (payer_salaire : restaurer la version 086 sans le bloc séparation des tâches.)
