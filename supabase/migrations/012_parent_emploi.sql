-- =====================================================================
--  012 — Espace parent : emploi du temps de l'enfant (RPC sécurisée)
-- =====================================================================

create or replace function public.enfant_emploi(p_eleve uuid)
returns table(jour int, heure_debut time, heure_fin time, matiere text, enseignant text, salle text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select edt.jour, edt.heure_debut, edt.heure_fin,
           m.libelle,
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

grant execute on function public.enfant_emploi(uuid) to authenticated;
