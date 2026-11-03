-- =====================================================================
--  227 — La structure type, en un clic (prise en main, lot 2)
--
--  LE CONSTAT (audit du 03/11/2026) : deux écoles inscrites sur quatre n'ont
--  rien créé après l'assistant — 0 niveau, 0 classe. Une troisième s'est
--  arrêtée à 3 classes et 1 matière. Chaque niveau, chaque classe, chaque
--  matière se tapait à la main : une soixantaine de saisies avant d'inscrire
--  le premier élève.
--
--  `appliquer_structure_type(p_cycles)` remplit, pour les cycles de l'école
--  (tous, ou ceux de `p_cycles`) :
--    - les niveaux officiels (TPS → GS, CI → CM2, 6e → 3e, Seconde → Terminale) ;
--    - une classe par niveau pour l'année courante (renommable, dédoublable) ;
--    - les matières du programme, rattachées au cycle ;
--    - au collège, les coefficients usuels par niveau ;
--    - les dates des trimestres (ou semestres), s'ils n'en ont aucune.
--
--  🔴 ELLE NE REMPLIT QUE CE QUI EST VIDE. Un cycle qui a déjà un niveau est
--  laissé tel quel (Tut'Tank, en Montessori, regroupe « TPS/PS ») ; les
--  matières ne sont posées que pour un cycle qui n'en a aucune ; une période
--  n'est datée que si aucune ne l'est. On peut donc la relancer sans risque.
--  Formation professionnelle et université : pas de modèle (trop variables,
--  et le supérieur passe par les filières).
--
--  Droits : ceux de la structure (`a_acces('structure')`, comme les règles
--  des tables) ; les dates des périodes, ceux de leurs règles (promoteur,
--  direction) — sinon elles sont simplement laissées.
-- =====================================================================

create or replace function public._structure_type_modele()
returns jsonb language sql immutable set search_path = public as $fn$
  select jsonb_build_object(
    'prescolaire', jsonb_build_object(
      'niveaux', jsonb_build_array('TPS', 'PS', 'MS', 'GS'),
      'matieres', jsonb_build_array(
        jsonb_build_object('libelle', 'Langage et communication'),
        jsonb_build_object('libelle', 'Activités mathématiques'),
        jsonb_build_object('libelle', 'Découverte du monde'),
        jsonb_build_object('libelle', 'Éducation psychomotrice et artistique'),
        jsonb_build_object('libelle', 'Développement socioaffectif'))),
    'premier_cycle', jsonb_build_object(
      'niveaux', jsonb_build_array('CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'),
      'matieres', jsonb_build_array(
        jsonb_build_object('libelle', 'Langue et communication'),
        jsonb_build_object('libelle', 'Mathématiques'),
        jsonb_build_object('libelle', 'ESVS — Éducation à la science et à la vie sociale'),
        jsonb_build_object('libelle', 'EPSA — Éducation physique, sportive et artistique'))),
    'second_cycle', jsonb_build_object(
      'niveaux', jsonb_build_array('6e', '5e', '4e', '3e'),
      'matieres', jsonb_build_array(
        jsonb_build_object('libelle', 'Français', 'coef', 4),
        jsonb_build_object('libelle', 'Mathématiques', 'coef', 4),
        jsonb_build_object('libelle', 'Anglais', 'coef', 2),
        jsonb_build_object('libelle', 'Histoire-Géographie', 'coef', 2),
        jsonb_build_object('libelle', 'Sciences de la vie et de la Terre', 'coef', 2),
        jsonb_build_object('libelle', 'Sciences physiques', 'coef', 2),
        jsonb_build_object('libelle', 'Langue vivante 2', 'coef', 2),
        jsonb_build_object('libelle', 'Éducation civique', 'coef', 1),
        jsonb_build_object('libelle', 'EPS', 'coef', 1))),
    'lycee', jsonb_build_object(
      'niveaux', jsonb_build_array('Seconde', 'Première', 'Terminale'),
      --  Au lycée, les coefficients dépendent de la SÉRIE (L, S…) : on les
      --  laisse à l'école (Paramètres → Structure académique → Coefficients).
      'matieres', jsonb_build_array(
        jsonb_build_object('libelle', 'Français'),
        jsonb_build_object('libelle', 'Philosophie'),
        jsonb_build_object('libelle', 'Mathématiques'),
        jsonb_build_object('libelle', 'Anglais'),
        jsonb_build_object('libelle', 'Langue vivante 2'),
        jsonb_build_object('libelle', 'Histoire-Géographie'),
        jsonb_build_object('libelle', 'Sciences de la vie et de la Terre'),
        jsonb_build_object('libelle', 'Sciences physiques'),
        jsonb_build_object('libelle', 'EPS')))
  )
$fn$;

create or replace function public.appliquer_structure_type(p_cycles text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_ecole uuid := ecole_courante();
  v_annee annees_scolaires;
  v_modele jsonb := public._structure_type_modele();
  cy record; m jsonb; v_niv uuid; v_mat uuid; v_lib text; v_ordre int;
  n_niv int := 0; n_cls int := 0; n_mat int := 0; n_coef int := 0; n_per int := 0;
  v_nb_per int; v_debut date; v_fin date; v_an int;
begin
  if v_ecole is null then raise exception 'Aucun établissement courant.'; end if;
  if not (est_super_admin() or a_acces('structure')) then
    raise exception 'Réservé à qui gère la structure académique.';
  end if;
  select * into v_annee from annees_scolaires where ecole_id = v_ecole and courante limit 1;
  if v_annee.id is null then raise exception 'Aucune année scolaire courante.'; end if;

  select coalesce(max(ordre), 0) into v_ordre from niveaux where ecole_id = v_ecole;

  for cy in
    select c.* from cycles c
     where c.ecole_id = v_ecole
       and v_modele ? c.type::text
       and (p_cycles is null or c.type::text = any(p_cycles))
     order by c.ordre nulls last, c.libelle
  loop
    -- Niveaux et classes : seulement pour un cycle encore vide.
    if not exists (select 1 from niveaux n where n.cycle_id = cy.id) then
      for v_lib in select jsonb_array_elements_text(v_modele -> cy.type::text -> 'niveaux') loop
        v_ordre := v_ordre + 1;
        insert into niveaux (ecole_id, cycle_id, libelle, ordre)
        values (v_ecole, cy.id, v_lib, v_ordre) returning id into v_niv;
        n_niv := n_niv + 1;
        insert into classes (ecole_id, niveau_id, annee_id, libelle)
        values (v_ecole, v_niv, v_annee.id, v_lib);
        n_cls := n_cls + 1;
      end loop;
    end if;

    -- Matières : seulement pour un cycle qui n'en a AUCUNE (ni propre, ni
    -- commune à toute l'école). Sinon on doublerait celles que l'école a
    -- nommées à sa façon (« Langue et communication » / « Langage et … »).
    if not exists (select 1 from matieres x where x.ecole_id = v_ecole
                    and (x.cycle_id is null or x.cycle_id = cy.id)) then
      for m in select * from jsonb_array_elements(v_modele -> cy.type::text -> 'matieres') loop
        insert into matieres (ecole_id, libelle, cycle_id)
        values (v_ecole, m ->> 'libelle', cy.id) returning id into v_mat;
        n_mat := n_mat + 1;
        -- Coefficient par niveau du cycle (collège).
        if m ? 'coef' then
          insert into coefficients_matieres (ecole_id, matiere_id, niveau_id, coefficient)
          select v_ecole, v_mat, n.id, (m ->> 'coef')::numeric
            from niveaux n where n.cycle_id = cy.id;
          get diagnostics v_nb_per = row_count;
          n_coef := n_coef + v_nb_per;
        end if;
      end loop;
    end if;
  end loop;

  -- Dates des périodes : seulement si AUCUNE n'est datée, et pour qui en a le droit.
  if (est_super_admin() or est_admin() or a_role('direction'))
     and v_annee.date_debut is not null and v_annee.date_fin is not null
     and not exists (select 1 from periodes p where p.annee_id = v_annee.id
                      and (p.date_debut is not null or p.date_fin is not null)) then
    select count(*) into v_nb_per from periodes where annee_id = v_annee.id;
    v_an := extract(year from v_annee.date_debut)::int;
    if v_nb_per = 3 then
      update periodes p set
        date_debut = case p.ordre when 1 then v_annee.date_debut when 2 then make_date(v_an + 1, 1, 1) else make_date(v_an + 1, 4, 1) end,
        date_fin   = case p.ordre when 1 then make_date(v_an, 12, 31) when 2 then make_date(v_an + 1, 3, 31) else v_annee.date_fin end
       where p.annee_id = v_annee.id and p.ordre in (1, 2, 3);
      get diagnostics n_per = row_count;
    elsif v_nb_per = 2 then
      v_debut := make_date(v_an + 1, 3, 1);
      v_fin := v_debut - 1;
      update periodes p set
        date_debut = case p.ordre when 1 then v_annee.date_debut else v_debut end,
        date_fin   = case p.ordre when 1 then v_fin else v_annee.date_fin end
       where p.annee_id = v_annee.id and p.ordre in (1, 2);
      get diagnostics n_per = row_count;
    end if;
  end if;

  return jsonb_build_object('niveaux', n_niv, 'classes', n_cls, 'matieres', n_mat,
                            'coefficients', n_coef, 'periodes', n_per);
end $fn$;

revoke execute on function public.appliquer_structure_type(text[]) from public, anon;
grant execute on function public.appliquer_structure_type(text[]) to authenticated;
revoke execute on function public._structure_type_modele() from public, anon;
grant execute on function public._structure_type_modele() to authenticated;

-- --- Retour arrière ---------------------------------------------------------------
-- drop function public.appliquer_structure_type(text[]);
-- drop function public._structure_type_modele();
-- (Les niveaux, classes et matières créés restent : ils se suppriment depuis
--  Paramètres → Structure académique.)
