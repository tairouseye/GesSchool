-- =====================================================================
--  105 — Fournitures : indicateur explicite « fourni par l'école »
--  Remplace la détection par mot-clé (note) par une vraie case à cocher.
--  Backfill : les articles dont la note mentionne l'école sont cochés.
-- =====================================================================

alter table fournitures add column if not exists fourni_ecole boolean not null default false;

update fournitures
   set fourni_ecole = true
 where fourni_ecole = false
   and (lower(coalesce(note, '')) like '%école%' or lower(coalesce(note, '')) like '%ecole%');

-- RPC parent : renvoyer aussi fourni_ecole
drop function if exists public.enfant_fournitures(uuid);
create or replace function public.enfant_fournitures(p_eleve uuid)
returns table(libelle text, quantite int, obligatoire boolean, note text, fourni_ecole boolean)
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid; v_niveau uuid;
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select c.niveau_id into v_niveau
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
    join classes c on c.id = ins.classe_id
    where ins.eleve_id = p_eleve
    limit 1;
  return query
    select fr.libelle, fr.quantite::int, fr.obligatoire, fr.note, fr.fourni_ecole
    from fournitures fr
    where fr.ecole_id = v_ecole
      and (fr.niveau_id is null or fr.niveau_id = v_niveau)
    order by fr.libelle;
end $$;
grant execute on function public.enfant_fournitures(uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- (restaurer enfant_fournitures de 045, sans fourni_ecole)
-- alter table fournitures drop column if exists fourni_ecole;
