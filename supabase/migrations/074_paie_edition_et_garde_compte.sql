-- =====================================================================
--  074 — Paie : édition d'un salaire (même payé) + garde compte/école
--  (1) payer_salaire vérifie que le compte de règlement appartient bien
--      à l'école (SECURITY DEFINER contourne la RLS → garde explicite).
--  (2) maj_salaire : édite brut/prime/retenue, recalcule le net ET
--      resynchronise la dépense comptable liée quand le salaire est payé
--      (permet de corriger un salaire déjà réglé sans désynchroniser la
--      comptabilité). Réservé à la RH / admin, cloisonné par école.
-- =====================================================================

-- (1) --------------------------------------------------------------------
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

  -- Le compte de règlement doit appartenir à la même école.
  if p_compte is not null
     and not exists (select 1 from comptes c where c.id = p_compte and c.ecole_id = v_s.ecole_id) then
    raise exception 'Compte de trésorerie invalide pour cette école.';
  end if;

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

-- (2) --------------------------------------------------------------------
create or replace function maj_salaire(
  p_salaire uuid,
  p_brut    numeric,
  p_prime   numeric default 0,
  p_retenue numeric default 0
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid := ecole_courante();
  v_s     record;
  v_net   numeric;
begin
  select s.*, pe.prenom, pe.nom into v_s
  from salaires s join personnels pe on pe.id = s.personnel_id
  where s.id = p_salaire;
  if v_s is null then raise exception 'Fiche de paie introuvable.'; end if;
  if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;

  v_net := coalesce(p_brut, 0) + coalesce(p_prime, 0) - coalesce(p_retenue, 0);

  update salaires
    set montant_brut = coalesce(p_brut, 0),
        prime        = coalesce(p_prime, 0),
        retenue      = coalesce(p_retenue, 0),
        montant_net  = v_net
    where id = p_salaire;

  -- Resynchronise la dépense comptable liée (n'affecte rien si non payé).
  update depenses
    set montant = v_net,
        libelle = 'Salaire ' || v_s.periode || ' — ' || v_s.prenom || ' ' || v_s.nom
    where ref_salaire_id = p_salaire;
end $$;

grant execute on function payer_salaire(uuid, date, public.mode_paiement, uuid) to authenticated;
grant execute on function maj_salaire(uuid, numeric, numeric, numeric) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists maj_salaire(uuid, numeric, numeric, numeric);
-- -- Rétablir payer_salaire sans la garde compte/école :
-- create or replace function payer_salaire(
--   p_salaire uuid, p_date date default current_date,
--   p_mode public.mode_paiement default null, p_compte uuid default null
-- ) returns void language plpgsql security definer set search_path = public as $$
-- declare v_ecole uuid := ecole_courante(); v_s record;
-- begin
--   select s.*, pe.prenom, pe.nom into v_s from salaires s
--     join personnels pe on pe.id = s.personnel_id where s.id = p_salaire;
--   if v_s is null then raise exception 'Fiche de paie introuvable.'; end if;
--   if not est_super_admin() and v_s.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
--   if not (est_admin() or a_role('rh')) then raise exception 'Réservé à la RH.'; end if;
--   update salaires set paye = true, date_paiement = coalesce(p_date, current_date), mode = p_mode where id = p_salaire;
--   if not exists (select 1 from depenses where ref_salaire_id = p_salaire) then
--     insert into depenses (ecole_id, compte_id, libelle, categorie, montant, mode,
--                           date_depense, beneficiaire, ref_salaire_id, saisi_par)
--     values (v_s.ecole_id, p_compte, 'Salaire ' || v_s.periode || ' — ' || v_s.prenom || ' ' || v_s.nom,
--             'Salaires', v_s.montant_net, p_mode, coalesce(p_date, current_date),
--             v_s.prenom || ' ' || v_s.nom, p_salaire, auth.uid());
--   end if;
-- end $$;
