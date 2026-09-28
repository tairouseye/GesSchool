-- =====================================================================
--  157 — Les annonces quittent l'accueil parent : un repère par enfant
--
--  Demandé : « sur le profil parent, je voudrais que les annonces soient
--  liées à l'enfant, je ne voudrais pas les voir dès que j'accède à
--  l'appli ». Légitime : l'accueil affichait la liste complète, toutes
--  écoles confondues, avant même d'avoir choisi un enfant.
--
--  ⚠️ MAIS LES RETIRER SANS RIEN METTRE À LA PLACE LES RENDRAIT INVISIBLES.
--  Vérifié : il n'existe AUCUN déclencheur sur `annonces` — publier une
--  annonce ne crée pas de notification (la migration 146 le dit : « les
--  annonces ne se dupliquent pas »). L'accueil ÉTAIT le mécanisme de
--  distribution. Sans repère, l'école publierait une circulaire que personne
--  n'ouvrirait, puisqu'il faudrait entrer dans chaque enfant pour la voir.
--
--  On ajoute donc un compteur sur la carte de chaque enfant, et la liste
--  n'apparaît plus que dans sa page.
--
--  ⚠️ POURQUOI UN COMPTE RÉCENT ET NON UN TOTAL. Il n'existe pas d'état
--  « lu » sur les annonces (contrairement aux notifications). Un total
--  resterait affiché pour toujours dès la première publication : ce serait
--  du bruit, pas un signal. Une fenêtre de 7 jours s'efface d'elle-même et
--  répond à la seule question utile — « y a-t-il du nouveau pour cet
--  enfant ? ». Construire un état de lecture serait plus juste, mais c'est
--  un autre chantier ; ce choix-là ne coûte aucune table.
--
--  ⚠️ LA RÈGLE DE VISIBILITÉ N'EST PAS RECOPIÉE. La migration 152 prévient
--  qu'elle vit déjà à QUATRE endroits et qu'il faut les modifier ensemble.
--  On n'en fait pas un cinquième : `mes_enfants()` APPELLE
--  `annonces_enfant(e.id)`, qui reste la seule source. Elle revérifie au
--  passage `_parent_possede` pour chaque enfant — redondant ici, mais c'est
--  précisément ce qu'on veut d'un contrôle d'accès.
--
--  Prérequis : migrations 069, 145, 152.
-- =====================================================================

--  Ajouter une colonne au retour impose un DROP (CREATE OR REPLACE refuse un
--  changement de signature → 42P13).
drop function if exists public.mes_enfants();

create function public.mes_enfants()
returns table(
  eleve_id uuid, prenom text, nom text, matricule text, classe text,
  ecole text, ecole_id uuid, logo text, annonces_nouvelles bigint
)
language sql security definer set search_path = public as $$
  select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom, ec.id, ec.logo_url,
         (select count(*) from annonces_enfant(e.id) a
           where a.publie_le >= now() - interval '7 days')
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

revoke execute on function public.mes_enfants() from public, anon;
grant execute on function public.mes_enfants() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • un parent dont un enfant est en CM1 et l'autre en TPS voit le compteur
--     bouger sur le SEUL enfant visé par une annonce « CM1 » ;
--   • une annonce « toute l'école » incrémente les deux ;
--   • une annonce publiée il y a plus de 7 jours ne compte plus, mais reste
--     dans la page de l'enfant ;
--   • le compteur ne fait apparaître aucune annonce que `annonces_enfant`
--     ne renverrait pas : c'est la même fonction qui décide.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.mes_enfants();
-- (puis réappliquer la définition de la migration 069.)
