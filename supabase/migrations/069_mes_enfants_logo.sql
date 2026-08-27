-- 069 — Espace parent : mes_enfants() expose aussi le LOGO et l'ID de l'école.
-- But : afficher le logo de l'établissement de chaque enfant dans l'espace
-- parent (un parent peut avoir des enfants dans plusieurs écoles).
-- Le logo (ecoles.logo_url) est une URL publique ; la fonction étant
-- SECURITY DEFINER, elle peut le lire alors que le parent n'a aucun accès
-- « tenant » à la table ecoles.
--
-- Ajouter des colonnes au type de retour impose un DROP + CREATE
-- (CREATE OR REPLACE refuse un changement de signature).

drop function if exists public.mes_enfants();

create function public.mes_enfants()
returns table(
  eleve_id uuid, prenom text, nom text, matricule text, classe text,
  ecole text, ecole_id uuid, logo text
)
language sql security definer set search_path = public as $$
  select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom, ec.id, ec.logo_url
  from tuteurs t
  join eleve_tuteurs et on et.tuteur_id = t.id
  join eleves e on e.id = et.eleve_id
  left join ecoles ec on ec.id = e.ecole_id
  left join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
  left join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
  left join classes c on c.id = ins.classe_id
  where t.profil_id = auth.uid()
  order by e.nom, e.prenom
$$;

grant execute on function public.mes_enfants() to authenticated;

-- ANNULATION
-- drop function if exists public.mes_enfants();
-- create function public.mes_enfants()
-- returns table(eleve_id uuid, prenom text, nom text, matricule text, classe text, ecole text)
-- language sql security definer set search_path = public as $$
--   select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom
--   from tuteurs t
--   join eleve_tuteurs et on et.tuteur_id = t.id
--   join eleves e on e.id = et.eleve_id
--   left join ecoles ec on ec.id = e.ecole_id
--   left join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
--   left join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
--   left join classes c on c.id = ins.classe_id
--   where t.profil_id = auth.uid()
--   order by e.nom, e.prenom
-- $$;
-- grant execute on function public.mes_enfants() to authenticated;
