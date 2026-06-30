-- =====================================================================
--  025 — Bulletins dans l'espace parent
--  L'école publie le bulletin (persisté dans bulletins/bulletin_lignes) ;
--  le parent le consulte/imprime via des RPC sécurisées.
-- =====================================================================

create or replace function public.enfant_bulletins(p_eleve uuid)
returns table(
  id uuid, periode text, ordre int, moyenne numeric, rang int, effectif int, mention text,
  ecole text, sigle text, classe text, eleve_prenom text, eleve_nom text, matricule text, annee text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select b.id, p.libelle, p.ordre, b.moyenne_generale, b.rang, b.effectif, b.mention,
           ec.nom, ec.sigle, c.libelle, e.prenom, e.nom, e.matricule, an.libelle
    from bulletins b
    join periodes p on p.id = b.periode_id
    join eleves e on e.id = b.eleve_id
    left join classes c on c.id = b.classe_id
    left join ecoles ec on ec.id = b.ecole_id
    left join annees_scolaires an on an.id = p.annee_id
    where b.eleve_id = p_eleve
    order by p.ordre;
end $$;

create or replace function public.enfant_bulletin_lignes(p_bulletin uuid)
returns table(matiere text, moyenne numeric, coefficient numeric)
language plpgsql security definer set search_path = public as $$
declare v_eleve uuid;
begin
  select eleve_id into v_eleve from bulletins where id = p_bulletin;
  if v_eleve is null then raise exception 'Bulletin introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select m.libelle, l.moyenne, l.coefficient
    from bulletin_lignes l join matieres m on m.id = l.matiere_id
    where l.bulletin_id = p_bulletin order by m.libelle;
end $$;

revoke execute on function public.enfant_bulletins(uuid) from public, anon;
grant execute on function public.enfant_bulletins(uuid) to authenticated;
revoke execute on function public.enfant_bulletin_lignes(uuid) from public, anon;
grant execute on function public.enfant_bulletin_lignes(uuid) to authenticated;
