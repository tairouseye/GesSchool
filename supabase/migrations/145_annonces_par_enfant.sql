-- =====================================================================
--  145 — Annonces : les rattacher à un enfant, et à son établissement
--
--  Constat de l'utilisateur : dans l'espace parent, les annonces ne sont
--  « pas cloisonnées par école/enfant ».
--
--  ⚠️ Précision importante après vérification : le CLOISONNEMENT DE SÉCURITÉ
--  est correct. `annonces_parent()` (mig. 006) filtre déjà sur
--  `a.ecole_id in (les écoles où ce profil a un enfant)`, et les annonces
--  ciblées « classe » sur les classes de ses propres enfants. Aucune fuite
--  inter-établissement — c'est la LISIBILITÉ qui manque :
--
--   • les annonces s'affichent en une liste unique sur l'accueil parent ;
--   • un parent ayant des enfants dans plusieurs établissements (cas réel
--     en base : un profil rattaché à trois écoles) les voit mélangées ;
--   • la page d'un enfant n'affiche AUCUNE annonce, alors que c'est là
--     qu'on la cherche.
--
--  Cause technique : la RPC ne renvoie que le NOM de l'école et de la
--  classe, jamais leurs identifiants. Le client ne peut donc rattacher une
--  annonce ni à une école ni à un enfant.
--
--  Cette migration rend l'attribution possible, sans toucher au filtrage.
--
--  Prérequis : migrations 001, 006.
-- =====================================================================

-- --- 1. `annonces_parent` : ajouter les identifiants -----------------------
--  `create or replace` ne peut PAS changer le type de retour d'un
--  `returns table(...)` → 42P13. On supprime d'abord (piège des mig. 114,
--  131 et 144).
drop function if exists public.annonces_parent();
create or replace function public.annonces_parent()
returns table(id uuid, titre text, contenu text, cible text,
              ecole text, ecole_id uuid, publie_le timestamptz,
              classe text, classe_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct a.id, a.titre, a.contenu, a.cible,
         ec.nom, a.ecole_id, a.publie_le, c.libelle, a.classe_id
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
revoke execute on function public.annonces_parent() from public, anon;
grant execute on function public.annonces_parent() to authenticated;

-- --- 2. Les annonces d'UN enfant ------------------------------------------
--  Même garde que les autres `enfant_*` : `_parent_possede()`. Le filtrage
--  se fait ici sur l'école DE CET ENFANT et sur SA classe — pas sur
--  l'ensemble des classes de la fratrie, contrairement à la vue globale.
create or replace function public.annonces_enfant(p_eleve uuid)
returns table(id uuid, titre text, contenu text, cible text,
              publie_le timestamptz, classe text)
language plpgsql stable security definer set search_path = public as $$
declare v_ecole uuid; v_classe uuid;
begin
  if not public._parent_possede(p_eleve) then
    raise exception 'Accès refusé.';
  end if;

  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;

  select ins.classe_id into v_classe
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
   where ins.eleve_id = p_eleve
   limit 1;

  return query
    select a.id, a.titre, a.contenu, a.cible, a.publie_le, c.libelle
      from annonces a
      left join classes c on c.id = a.classe_id
     where a.ecole_id = v_ecole
       and (a.cible in ('tous', 'parents')
            or (a.cible = 'classe' and v_classe is not null and a.classe_id = v_classe))
     order by a.publie_le desc;
end $$;
revoke execute on function public.annonces_enfant(uuid) from public, anon;
grant execute on function public.annonces_enfant(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • parent : annonces_enfant(<son enfant>) → annonces de SON école
--   • parent : annonces_enfant(<un autre élève>) → « Accès refusé. »
--   • parent multi-écoles : annonces_parent() renvoie désormais `ecole_id`,
--     ce qui permet de grouper l'accueil par établissement
--   • une annonce ciblée 'etudiants' ou 'enseignants' ne doit JAMAIS
--     apparaître chez un parent
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.annonces_enfant(uuid);
-- (et réappliquer annonces_parent de la migration 006, sans les identifiants.)
