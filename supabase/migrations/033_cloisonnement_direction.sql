-- =====================================================================
--  033 — Cloisonnement du responsable pédagogique (direction) en base
--
--  Problème : est_gestion() = super_admin OR admin_ecole OR direction. Toutes
--  les tables/RPC du domaine GESTION (finances, compta, paie, dossier élève)
--  s'appuient dessus → le responsable pédagogique conserve, par appel API
--  direct, un accès complet aux finances/paie alors que l'UI le lui interdit.
--
--  Correctif chirurgical : on introduit est_admin() (= promoteur seul) et on
--  bascule UNIQUEMENT les prédicats du domaine Gestion sur est_admin(). Les
--  tables pédagogiques (notes, bulletins, absences…) gardent est_gestion()
--  → le responsable pédagogique conserve exactement son périmètre.
-- =====================================================================

create or replace function est_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select est_super_admin() or a_role('admin_ecole')
$$;

-- ---- Dossier élève + facturation : promoteur / comptable / secrétaire ----
do $$
declare t text; pred text := '(est_admin() or a_role(''comptable'') or a_role(''secretaire''))';
begin
  foreach t in array array[
    'eleves','inscriptions','eleve_tuteurs','tuteurs','documents_eleve',
    'paiements','factures','facture_lignes'
  ] loop
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);
    execute format('create policy %1$s_ins on public.%1$I for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
    execute format('create policy %1$s_upd on public.%1$I for update using (est_super_admin() or (ecole_id = ecole_courante() and %2$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
    execute format('create policy %1$s_del on public.%1$I for delete using (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
  end loop;
end $$;

-- ---- Grille tarifaire (frais) : promoteur / comptable ----
do $$
declare t text; pred text := '(est_admin() or a_role(''comptable''))';
begin
  foreach t in array array['frais'] loop
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);
    execute format('create policy %1$s_ins on public.%1$I for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
    execute format('create policy %1$s_upd on public.%1$I for update using (est_super_admin() or (ecole_id = ecole_courante() and %2$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
    execute format('create policy %1$s_del on public.%1$I for delete using (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
  end loop;
end $$;

-- ---- Comptabilité (lecture + écriture) : promoteur / comptable ----
do $$
declare t text;
begin
  foreach t in array array['comptes','depenses','recettes'] loop
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('create policy %1$s_tenant on public.%1$I using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable'')))) with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable''))));', t);
  end loop;
end $$;

-- ---- Paie / RH (lecture + écriture) : promoteur / rh ----
do $$
declare t text;
begin
  foreach t in array array['salaires','contrats','personnels'] loop
    execute format('drop policy if exists %1$s_tenant on public.%1$I;', t);
    execute format('create policy %1$s_tenant on public.%1$I using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''rh'')))) with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''rh''))));', t);
  end loop;
end $$;

-- ---- RPC paie (SECURITY DEFINER) : direction exclue ----
create or replace function payer_salaire(
  p_salaire uuid,
  p_date    date default current_date,
  p_mode    public.mode_paiement default null,
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
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;

  update salaires
    set paye = true, date_paiement = coalesce(p_date, current_date), mode = p_mode
    where id = p_salaire;

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
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;

  delete from depenses where ref_salaire_id = p_salaire;
  update salaires set paye = false, date_paiement = null where id = p_salaire;
end $$;

grant execute on function payer_salaire(uuid, date, public.mode_paiement, uuid) to authenticated;
grant execute on function annuler_salaire(uuid) to authenticated;
