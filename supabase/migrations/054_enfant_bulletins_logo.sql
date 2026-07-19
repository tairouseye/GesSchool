-- =====================================================================
--  054 — Logo de l'école sur le bulletin imprimé par le parent
--
--  enfant_bulletins() renvoyait le nom et le sigle mais pas le logo : le
--  bulletin imprimé depuis l'espace parent n'affichait donc pas le logo de
--  l'établissement (contrairement à celui imprimé côté école). On ajoute la
--  colonne `logo` en fin de signature.
-- =====================================================================

drop function if exists public.enfant_bulletins(uuid);
create or replace function public.enfant_bulletins(p_eleve uuid)
returns table(
  id uuid, periode text, ordre int, moyenne numeric, rang int, effectif int, mention text,
  ecole text, sigle text, classe text, eleve_prenom text, eleve_nom text, matricule text, annee text,
  logo text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select b.id, p.libelle, p.ordre, b.moyenne_generale, b.rang, b.effectif, b.mention,
           ec.nom, ec.sigle, c.libelle, e.prenom, e.nom, e.matricule, an.libelle,
           ec.logo_url
    from bulletins b
    join periodes p on p.id = b.periode_id
    join eleves e on e.id = b.eleve_id
    left join classes c on c.id = b.classe_id
    left join ecoles ec on ec.id = b.ecole_id
    left join annees_scolaires an on an.id = p.annee_id
    where b.eleve_id = p_eleve
    order by p.ordre;
end $$;

revoke execute on function public.enfant_bulletins(uuid) from public, anon;
grant execute on function public.enfant_bulletins(uuid) to authenticated;
