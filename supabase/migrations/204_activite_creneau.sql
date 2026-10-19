-- =====================================================================
--  204 — Une ACTIVITÉ sur chaque créneau d'emploi du temps, distincte de la
--        matière
--
--  Demandé le 19/10/2026 pour charger les emplois du temps de Tut'Tank.
--  À l'élémentaire, la matière est le DOMAINE du bulletin (Langue et
--  communication, Mathématiques, Découverte du monde, EDD) ; l'emploi du
--  temps, lui, affiche le détail de la séance (Conjugaison, Activités de
--  mesure, IST…). Un créneau ne portait qu'une matière : charger les domaines
--  faisait perdre ce détail aux parents.
--
--   • `activite` est un libellé libre, FACULTATIF. Vide, l'affichage retombe
--     sur la matière : les emplois du temps existants ne changent pas, et le
--     générateur automatique continue d'écrire sans activité ;
--   • la matière reste la référence (bulletin, volumes horaires, charge des
--     enseignants) ;
--   • `enfant_emploi` rend l'activité au parent (le type de retour change :
--     drop + create, droits rétablis à l'identique) ;
--   • `ouvrir_annee_scolaire` recopie l'activité avec le reste du créneau.
--
--  Prérequis : 012 (enfant_emploi), 051 (ouvrir_annee_scolaire).
-- =====================================================================

alter table emplois_du_temps add column if not exists activite text;

-- Espace parent ---------------------------------------------------------------
drop function if exists public.enfant_emploi(uuid);
create function public.enfant_emploi(p_eleve uuid)
returns table(jour int, heure_debut time, heure_fin time, matiere text, activite text, enseignant text, salle text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select edt.jour, edt.heure_debut, edt.heure_fin,
           m.libelle,
           edt.activite,
           case when e.id is not null then e.prenom || ' ' || e.nom else null end,
           edt.salle
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
    join emplois_du_temps edt on edt.classe_id = ins.classe_id
    left join matieres m on m.id = edt.matiere_id
    left join enseignants e on e.id = edt.enseignant_id
    where ins.eleve_id = p_eleve
    order by edt.jour, edt.heure_debut;
end $$;

revoke all on function public.enfant_emploi(uuid) from public, anon;
grant execute on function public.enfant_emploi(uuid) to authenticated;

-- Ouverture d'année : l'activité suit le créneau -----------------------------
create or replace function public.ouvrir_annee_scolaire(p_libelle text, p_debut date, p_fin date, p_classes boolean DEFAULT true, p_affectations boolean DEFAULT true, p_frais boolean DEFAULT true, p_edt boolean DEFAULT true)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    insert into emplois_du_temps (ecole_id, classe_id, jour, heure_debut, heure_fin, matiere_id, activite, enseignant_id, salle)
    select e.ecole_id, nc.id, e.jour, e.heure_debut, e.heure_fin, e.matiere_id, e.activite, e.enseignant_id, e.salle
    from emplois_du_temps e
    join classes oc on oc.id = e.classe_id
    join classes nc on nc.ecole_id = v_ecole and nc.annee_id = v_new
      and nc.niveau_id = oc.niveau_id
      and coalesce(nc.serie_id::text, '∅') = coalesce(oc.serie_id::text, '∅')
      and nc.libelle = oc.libelle
    where e.ecole_id = v_ecole and oc.annee_id = v_src;
  end if;

  return v_new;
end $function$;
