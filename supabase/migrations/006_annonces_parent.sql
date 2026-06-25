-- =====================================================================
--  006 — Annonces : accès parent via RPC SECURITY DEFINER
--  (le parent n'a pas d'ecole_id ; il ne voit que les annonces des écoles
--   de ses enfants, ciblées « tous »/« parents » ou sa classe).
-- =====================================================================

create or replace function public.annonces_parent()
returns table(id uuid, titre text, contenu text, cible text, ecole text, publie_le timestamptz, classe text)
language sql security definer set search_path = public as $$
  select distinct a.id, a.titre, a.contenu, a.cible, ec.nom, a.publie_le, c.libelle
  from annonces a
  join ecoles ec on ec.id = a.ecole_id
  left join classes c on c.id = a.classe_id
  where a.ecole_id in (
    select distinct e.ecole_id
    from tuteurs t
    join eleve_tuteurs et on et.tuteur_id = t.id
    join eleves e on e.id = et.eleve_id
    where t.profil_id = auth.uid()
  )
  and (
    a.cible in ('tous', 'parents')
    or (
      a.cible = 'classe' and a.classe_id in (
        select ins.classe_id
        from tuteurs t
        join eleve_tuteurs et on et.tuteur_id = t.id
        join eleves e on e.id = et.eleve_id
        join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
        join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
        where t.profil_id = auth.uid()
      )
    )
  )
  order by a.publie_le desc;
$$;

grant execute on function public.annonces_parent() to authenticated;
