-- =====================================================================
--  051 — Passage d'année scolaire : ouverture d'une nouvelle année
--
--  Crée une nouvelle année (qui devient « courante ») et recopie, au choix,
--  le squelette de l'année courante précédente :
--    - la STRUCTURE (classes : mêmes niveaux/sections, effectif remis à zéro),
--    - les AFFECTATIONS prof↔classe↔matière (sur les classes équivalentes),
--    - la GRILLE TARIFAIRE (frais de l'année),
--    - les EMPLOIS DU TEMPS (créneaux des classes équivalentes).
--  Les élèves ne sont PAS réinscrits ici : la promotion se fait ensuite dans
--  un écran dédié (avec revue/ajustements). Tout est réservé au promoteur.
--
--  Le mapping ancienne→nouvelle classe se fait par (niveau_id, serie_id,
--  libelle), stable au sein d'une école.
-- =====================================================================

create or replace function public.ouvrir_annee_scolaire(
  p_libelle text, p_debut date, p_fin date,
  p_classes boolean default true,
  p_affectations boolean default true,
  p_frais boolean default true,
  p_edt boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_new uuid; v_src uuid;
begin
  if not (est_super_admin() or a_role('admin_ecole')) then
    raise exception 'Réservé au promoteur.';
  end if;
  if coalesce(trim(p_libelle), '') = '' then raise exception 'Libellé de l''année requis.'; end if;

  select id into v_src from annees_scolaires where ecole_id = v_ecole and courante = true limit 1;

  -- Nouvelle année → courante (on retire le drapeau à l'ancienne)
  update annees_scolaires set courante = false where ecole_id = v_ecole and courante = true;
  insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante)
  values (v_ecole, trim(p_libelle), p_debut, p_fin, true)
  returning id into v_new;

  if v_src is null then return v_new; end if; -- rien à recopier (1re année)

  if p_classes then
    insert into classes (ecole_id, niveau_id, serie_id, annee_id, libelle, effectif_max)
    select ecole_id, niveau_id, serie_id, v_new, libelle, effectif_max
    from classes where ecole_id = v_ecole and annee_id = v_src;
  end if;

  if p_affectations and p_classes then
    insert into affectations (ecole_id, enseignant_id, classe_id, matiere_id, coefficient, annee_id)
    select a.ecole_id, a.enseignant_id, nc.id, a.matiere_id, a.coefficient, v_new
    from affectations a
    join classes oc on oc.id = a.classe_id
    join classes nc on nc.ecole_id = v_ecole and nc.annee_id = v_new
      and nc.niveau_id = oc.niveau_id
      and coalesce(nc.serie_id::text, '∅') = coalesce(oc.serie_id::text, '∅')
      and nc.libelle = oc.libelle
    where a.ecole_id = v_ecole and a.annee_id = v_src;
  end if;

  if p_frais then
    insert into frais (ecole_id, libelle, montant, recurrent, obligatoire, niveau_id, cycle_id, annee_id)
    select ecole_id, libelle, montant, recurrent, obligatoire, niveau_id, cycle_id, v_new
    from frais where ecole_id = v_ecole and annee_id = v_src;
  end if;

  if p_edt and p_classes then
    insert into emplois_du_temps (ecole_id, classe_id, jour, heure_debut, heure_fin, matiere_id, enseignant_id, salle)
    select e.ecole_id, nc.id, e.jour, e.heure_debut, e.heure_fin, e.matiere_id, e.enseignant_id, e.salle
    from emplois_du_temps e
    join classes oc on oc.id = e.classe_id
    join classes nc on nc.ecole_id = v_ecole and nc.annee_id = v_new
      and nc.niveau_id = oc.niveau_id
      and coalesce(nc.serie_id::text, '∅') = coalesce(oc.serie_id::text, '∅')
      and nc.libelle = oc.libelle
    where e.ecole_id = v_ecole and oc.annee_id = v_src;
  end if;

  return v_new;
end $$;

revoke execute on function public.ouvrir_annee_scolaire(text, date, date, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.ouvrir_annee_scolaire(text, date, date, boolean, boolean, boolean, boolean) to authenticated;
