-- =====================================================================
--  144 — Fournitures : une vraie colonne « catégorie »
--
--  Même évolution que `fourni_ecole` (mig. 105) : ce que les écoles
--  exprimaient par convention devient un champ.
--
--  Constat sur les listes réelles : faute de champ, les écoles écrivent la
--  catégorie DANS le libellé, avec un tiret cadratin —
--      « Livres — BLED CM1/CM2 »
--      « Cahiers — Cahiers de 100 pages (PM) »
--      « Petit matériel — Taille-crayon avec réservoir »
--      « Autres — Gourde »
--  L'espace parent devine déjà cette convention pour grouper la liste
--  (v2.203.0). La deviner marche ; la SAISIR est mieux : l'école corrige ce
--  qu'elle veut, et un article mal rangé cesse de l'être définitivement.
--
--  Le rattrapage déplace le préfixe du libellé vers la colonne. C'est une
--  RÉÉCRITURE de `libelle` : on ne touche qu'aux lignes qui portent
--  clairement le motif, et l'original reste lisible dans le bloc ANNULATION
--  puisque la reconstruction est exacte (catégorie + « — » + libellé).
--
--  ⚠️ Le séparateur est le tiret CADRATIN (—) ou demi-cadratin (–) entouré
--  d'espaces, JAMAIS le trait d'union : « Taille-crayon avec réservoir »
--  serait coupé en deux.
--
--  Prérequis : migration 105.
-- =====================================================================

alter table fournitures add column if not exists categorie text;

-- Rattrapage : « Catégorie — Article » → categorie + libellé nettoyé.
--  • le préfixe fait 2 à 28 caractères (au-delà, c'est une phrase, pas une
--    catégorie) et ne contient pas lui-même de tiret cadratin ;
--  • on ne traite que les lignes dont la catégorie est encore vide.
update fournitures
   set categorie = btrim((regexp_match(libelle, '^\s*([^—–]{2,28}?)\s+[—–]\s+(.+)$'))[1]),
       libelle   = btrim((regexp_match(libelle, '^\s*([^—–]{2,28}?)\s+[—–]\s+(.+)$'))[2])
 where categorie is null
   and libelle ~ '^\s*[^—–]{2,28}?\s+[—–]\s+.+$';

-- « Autres » est un fourre-tout : on l'uniformise en « Divers », que
-- l'interface place toujours en dernier.
update fournitures
   set categorie = 'Divers'
 where lower(btrim(coalesce(categorie, ''))) in ('autres', 'autre', 'divers', 'reste');

create index if not exists fournitures_categorie_idx on fournitures(ecole_id, categorie);

-- --- RPC parent : renvoyer aussi la catégorie -----------------------------
--  `create or replace` ne peut PAS changer le type de retour d'une fonction
--  `returns table(...)` → 42P13. Il faut la supprimer d'abord (piège déjà
--  rencontré en migrations 114 et 131).
drop function if exists public.enfant_fournitures(uuid);
create or replace function public.enfant_fournitures(p_eleve uuid)
returns table(libelle text, quantite int, obligatoire boolean, note text,
              fourni_ecole boolean, categorie text)
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
    select fr.libelle, fr.quantite::int, fr.obligatoire, fr.note,
           fr.fourni_ecole, fr.categorie
    from fournitures fr
    where fr.ecole_id = v_ecole
      and (fr.niveau_id is null or fr.niveau_id = v_niveau)
    order by fr.libelle;
end $$;
revoke execute on function public.enfant_fournitures(uuid) from public, anon;
grant execute on function public.enfant_fournitures(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   select categorie, count(*) from fournitures group by 1 order by 2 desc;
--   → « Petit matériel », « Cahiers », « Livres », « Maison », « Divers »…
--   select libelle from fournitures where libelle like '%—%';
--   → doit être VIDE : plus aucun préfixe resté dans un libellé
--   select libelle from fournitures where libelle ilike 'taille-crayon%';
--   → « Taille-crayon avec réservoir » intact, non coupé
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- update fournitures
--    set libelle = categorie || ' — ' || libelle
--  where categorie is not null;
-- alter table fournitures drop column if exists categorie;
-- (puis réappliquer enfant_fournitures de la migration 105, sans categorie.)
