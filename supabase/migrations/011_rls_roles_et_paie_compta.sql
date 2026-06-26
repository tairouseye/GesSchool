-- =====================================================================
--  011 — Sécurité : RLS par rôle sur les tables sensibles (RH & compta)
--        + lien Paie → Dépense comptable (RPC sécurisée)
-- =====================================================================

-- Helper : l'utilisateur fait-il partie de la "gestion" (voit tout) ?
create or replace function est_gestion()
returns boolean language sql stable security definer set search_path = public as $$
  select est_super_admin() or a_role('admin_ecole') or a_role('direction')
$$;

-- ---------------------------------------------------------------------
-- RH : salaires / contrats / personnels → gestion ou rôle 'rh'
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['salaires', 'contrats', 'personnels'] loop
    execute format('drop policy if exists %1$s_tenant on %1$I;', t);
    execute format($f$
      create policy %1$s_tenant on %1$I
      using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh'))))
      with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('rh'))));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Comptabilité : comptes / depenses / recettes → gestion ou rôle 'comptable'
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['comptes', 'depenses', 'recettes'] loop
    execute format('drop policy if exists %1$s_tenant on %1$I;', t);
    execute format($f$
      create policy %1$s_tenant on %1$I
      using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))))
      with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role('comptable'))));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Lien Paie → Comptabilité : un salaire payé crée une dépense (catégorie
-- Salaires). RPC SECURITY DEFINER : autorise la RH à écrire la dépense
-- sans avoir le rôle comptable, et évite les doublons.
-- ---------------------------------------------------------------------
alter table depenses add column if not exists ref_salaire_id uuid references salaires(id) on delete set null;

create or replace function payer_salaire(
  p_salaire uuid,
  p_date    date default current_date,
  p_mode    mode_paiement default null,
  p_compte  uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid := ecole_courante();
  v_s     record;
begin
  select s.*, pe.prenom, pe.nom into v_s
  from salaires s join personnels pe on pe.id = s.personnel_id
  where s.id = p_salaire;
  if v_s is null then raise exception 'Fiche de paie introuvable.'; end if;
  if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_gestion() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;

  update salaires
    set paye = true, date_paiement = coalesce(p_date, current_date), mode = p_mode
    where id = p_salaire;

  -- Une seule dépense par salaire
  if not exists (select 1 from depenses where ref_salaire_id = p_salaire) then
    insert into depenses (ecole_id, compte_id, libelle, categorie, montant, mode,
                          date_depense, beneficiaire, ref_salaire_id, saisi_par)
    values (v_s.ecole_id, p_compte,
            'Salaire ' || v_s.periode || ' — ' || v_s.prenom || ' ' || v_s.nom,
            'Salaires', v_s.montant_net, p_mode,
            coalesce(p_date, current_date), v_s.prenom || ' ' || v_s.nom,
            p_salaire, auth.uid());
  end if;
end $$;

create or replace function annuler_salaire(p_salaire uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_e uuid;
begin
  select ecole_id into v_e from salaires where id = p_salaire;
  if v_e is null then raise exception 'Fiche de paie introuvable.'; end if;
  if not est_super_admin() and v_e <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_gestion() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;

  delete from depenses where ref_salaire_id = p_salaire;
  update salaires set paye = false, date_paiement = null where id = p_salaire;
end $$;

grant execute on function payer_salaire(uuid, date, mode_paiement, uuid) to authenticated;
grant execute on function annuler_salaire(uuid) to authenticated;
