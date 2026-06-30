-- =====================================================================
--  024 — Justificatifs d'absence en ligne
--  Le parent justifie une absence (texte) → statut 'en_attente' ;
--  l'administration valide (statut 'justifie') ou refuse.
-- =====================================================================

alter table public.absences add column if not exists justification text;

-- enfant_absences : on renvoie l'id + la justification (pour cibler/afficher)
drop function if exists public.enfant_absences(uuid);
create function public.enfant_absences(p_eleve uuid)
returns table(id uuid, date_abs date, type text, statut text, motif text, justification text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select a.id, a.date_abs, a.type::text, a.statut::text, a.motif, a.justification
    from absences a where a.eleve_id = p_eleve order by a.date_abs desc;
end $$;

-- Le parent soumet une justification
create or replace function public.justifier_absence_parent(p_absence uuid, p_texte text)
returns void language plpgsql security definer set search_path = public as $$
declare v_eleve uuid;
begin
  select eleve_id into v_eleve from absences where id = p_absence;
  if v_eleve is null then raise exception 'Absence introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  if coalesce(trim(p_texte), '') = '' then return; end if;
  update absences set justification = p_texte, statut = 'en_attente' where id = p_absence;
end $$;

revoke execute on function public.enfant_absences(uuid) from public, anon;
grant execute on function public.enfant_absences(uuid) to authenticated;
revoke execute on function public.justifier_absence_parent(uuid, text) from public, anon;
grant execute on function public.justifier_absence_parent(uuid, text) to authenticated;
