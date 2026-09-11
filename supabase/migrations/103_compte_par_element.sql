-- =====================================================================
--  103 — RH & PAIE (P6 audit) : compte comptable par élément de paie
--  Chaque élément (prime, indemnité, retenue) peut porter son compte du
--  plan comptable. poster_salaire_charge répartit alors les charges (débit)
--  et les retenues (crédit) sur ces comptes, avec repli sur les comptes par
--  défaut (661 rémunérations, 423 retenues, mapping organismes/État).
--  L'équilibre Σdébit = Σcrédit reste garanti.
-- =====================================================================

alter table elements_paie add column if not exists compte_pc_id uuid references plan_comptable(id) on delete set null;

create or replace function poster_salaire_charge(p_salaire uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s        salaires%rowtype;
  v_g      numeric := 0; v_p numeric := 0; v_r numeric := 0; v_net numeric;
  v_date   date;
  v_lignes jsonb := '[]'::jsonb;
  v_c661   uuid; v_c664 uuid; v_c422 uuid;
  rec      record;
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

  -- DÉBITS : charges (gains) réparties par compte d'élément, repli sur 661.
  for rec in
    select coalesce(ep.compte_pc_id, v_c661) as compte, sum(sl.montant) as m
    from salaire_lignes sl left join elements_paie ep on ep.id = sl.element_id
    where sl.salaire_id = p_salaire and sl.sens = 'gain'
    group by 1
  loop
    v_lignes := v_lignes || jsonb_build_object('compte', rec.compte::text, 'debit', rec.m, 'libelle', 'Charges de personnel');
  end loop;
  if v_p > 0 and v_c664 is not null then
    v_lignes := v_lignes || jsonb_build_object('compte', v_c664::text, 'debit', v_p, 'libelle', 'Charges patronales');
  end if;

  -- CRÉDIT : net à payer (422)
  v_lignes := v_lignes || jsonb_build_object('compte', v_c422::text, 'credit', v_net,
                'tiers_type', 'personnel', 'tiers_id', s.personnel_id::text, 'libelle', 'Net à payer');

  -- CRÉDITS : retenues + patronales, par compte cible (organisme/État/élément), regroupées.
  for rec in
    select coalesce(
             case when sl.sens = 'patronal' or sl.nature in ('cotisation','impot','remboursement')
                  then _compte_ligne_salaire(s.ecole_id, sl.sens, sl.nature, sl.libelle)
                  else coalesce(ep.compte_pc_id, _compte_ligne_salaire(s.ecole_id, sl.sens, sl.nature, sl.libelle))
             end) as compte, sum(sl.montant) as m
    from salaire_lignes sl left join elements_paie ep on ep.id = sl.element_id
    where sl.salaire_id = p_salaire and sl.sens in ('retenue', 'patronal')
    group by 1
  loop
    if rec.compte is not null and rec.m > 0 then
      v_lignes := v_lignes || jsonb_build_object('compte', rec.compte::text, 'credit', rec.m);
    end if;
  end loop;

  v_date := (s.periode || '-01')::date;
  return _compta_poster(s.ecole_id, 'SA', v_date, 'Paie ' || s.periode, v_lignes, s.periode, 'salaire_charge', p_salaire, auth.uid());
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- (revenir à poster_salaire_charge de 098 puis)
-- alter table elements_paie drop column if exists compte_pc_id;
