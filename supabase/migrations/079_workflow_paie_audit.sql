-- =====================================================================
--  079 — PHASE E : workflow de paie (brouillon→validé→payé) + traçabilité
--  - salaires.statut : 'brouillon' | 'valide' | 'paye' | 'archive'.
--  - Verrouillage : on ne peut éditer les lignes QUE si statut = 'brouillon'.
--  - RPC valider/devalider ; payer exige 'valide' ; annuler repasse à 'valide'.
--  - journal_audit : trace des transitions (utilisateur, dates, détails, motif).
--  paye (bool) reste synchronisé pour compat (KPIs, état).
-- =====================================================================

alter table salaires add column if not exists statut text not null default 'brouillon'
  check (statut in ('brouillon', 'valide', 'paye', 'archive'));
update salaires set statut = case when paye then 'paye' else 'brouillon' end;

-- ---- Journal d'audit ----
create table if not exists journal_audit (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  utilisateur uuid,
  entite      text not null,
  entite_id   uuid,
  operation   text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists journal_audit_ecole_idx on journal_audit(ecole_id, created_at desc);

alter table journal_audit enable row level security;
drop policy if exists journal_audit_tenant on journal_audit;
create policy journal_audit_tenant on journal_audit
  using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh') or a_role('comptable'))))
  with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh') or a_role('comptable'))));

-- ---- Verrouillage des lignes hors brouillon ----
create or replace function trg_lock_salaire_lignes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_statut text;
begin
  select statut into v_statut from salaires where id = coalesce(new.salaire_id, old.salaire_id);
  if v_statut is distinct from 'brouillon' and not est_super_admin() then
    raise exception 'Bulletin verrouillé (statut %). Dévalidez-le pour le modifier.', v_statut;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists salaire_lignes_lock on salaire_lignes;
create trigger salaire_lignes_lock
  before insert or update or delete on salaire_lignes
  for each row execute function trg_lock_salaire_lignes();

-- ---- Transitions de statut (RH / promoteur, cloisonné école) ----
create or replace function valider_salaire(p_salaire uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_s record;
begin
  select * into v_s from salaires where id = p_salaire;
  if v_s is null then raise exception 'Fiche introuvable.'; end if;
  if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;
  if v_s.statut <> 'brouillon' then raise exception 'Seul un brouillon peut être validé.'; end if;
  update salaires set statut = 'valide' where id = p_salaire;
  insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
    values (v_s.ecole_id, auth.uid(), 'salaire', p_salaire, 'validation',
            jsonb_build_object('net', v_s.montant_net, 'periode', v_s.periode));
end $$;

create or replace function devalider_salaire(p_salaire uuid, p_motif text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_s record;
begin
  select * into v_s from salaires where id = p_salaire;
  if v_s is null then raise exception 'Fiche introuvable.'; end if;
  if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;
  if v_s.statut = 'paye' then raise exception 'Annulez d''abord le paiement.'; end if;
  if v_s.statut <> 'valide' then raise exception 'Seul un bulletin validé peut être dévalidé.'; end if;
  update salaires set statut = 'brouillon' where id = p_salaire;
  insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
    values (v_s.ecole_id, auth.uid(), 'salaire', p_salaire, 'devalidation',
            jsonb_build_object('net', v_s.montant_net, 'periode', v_s.periode, 'motif', p_motif));
end $$;

-- payer_salaire : EXIGE 'valide', passe à 'paye' + audit (garde compte/école 074).
create or replace function payer_salaire(
  p_salaire uuid, p_date date default current_date,
  p_mode public.mode_paiement default null, p_compte uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_s record;
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

-- annuler_salaire : paye → valide, retire la dépense + audit.
create or replace function annuler_salaire(p_salaire uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_s record;
begin
  select * into v_s from salaires where id = p_salaire;
  if v_s is null then raise exception 'Fiche de paie introuvable.'; end if;
  if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;

  delete from depenses where ref_salaire_id = p_salaire;
  update salaires set paye = false, statut = 'valide', date_paiement = null where id = p_salaire;
  insert into journal_audit(ecole_id, utilisateur, entite, entite_id, operation, details)
    values (v_s.ecole_id, auth.uid(), 'salaire', p_salaire, 'annulation_paiement',
            jsonb_build_object('net', v_s.montant_net, 'periode', v_s.periode));
end $$;

grant execute on function valider_salaire(uuid) to authenticated;
grant execute on function devalider_salaire(uuid, text) to authenticated;
grant execute on function payer_salaire(uuid, date, public.mode_paiement, uuid) to authenticated;
grant execute on function annuler_salaire(uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists salaire_lignes_lock on salaire_lignes;
-- drop function if exists trg_lock_salaire_lignes();
-- drop function if exists valider_salaire(uuid);
-- drop function if exists devalider_salaire(uuid, text);
-- drop table if exists journal_audit;
-- alter table salaires drop column if exists statut;
-- (restaurer payer_salaire / annuler_salaire depuis la migration 074 si besoin.)
