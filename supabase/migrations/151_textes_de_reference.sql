-- =====================================================================
--  151 — « Textes de référence » : le rayon réglementaire de l'école
--
--  La Documentation accueille désormais les pièces jointes des annonces et
--  les dépôts libres (mig. 150). Il y manque un rayon distinct : celui des
--  textes qui RÉGISSENT l'établissement — règlement intérieur, codes et
--  décrets relatifs à l'enseignement, arrêtés, conventions, chartes.
--
--  Pourquoi un rayon à part plutôt qu'une catégorie de plus : ces documents
--  ne se consultent pas comme une circulaire ponctuelle. On y revient, on
--  les cite, ils font autorité, et surtout ils survivent aux années
--  scolaires. Les mélanger au tout-venant reviendrait à les perdre.
--
--  ⚠️ DEUXIÈME BESOIN, MOINS ÉVIDENT : un règlement intérieur que les
--  familles ne peuvent pas lire ne sert à rien. La migration 150 réservait
--  les dépôts libres au personnel. On introduit donc une PORTÉE explicite :
--  « interne » par défaut, « familles » lorsque l'école veut que parents et
--  étudiants puissent consulter le texte. C'est une décision de publication,
--  pas un réglage technique — d'où un champ, et non une convention de nom.
--
--  Prérequis : migration 150.
-- =====================================================================

-- --- 1. Catégories du rayon réglementaire ---------------------------------
--  `add constraint` n'a pas de variante `if not exists` : on précède d'un
--  drop, pour que la migration reste rejouable.
alter table fichiers_ecole drop constraint if exists fichiers_ecole_categorie_check;
alter table fichiers_ecole
  add constraint fichiers_ecole_categorie_check
  check (categorie in (
    -- Rayon « Textes de référence »
    'reglement',        -- règlement intérieur de l'établissement
    'texte_officiel',   -- code, décret, arrêté, circulaire ministérielle
    'convention',       -- statuts, conventions, agréments, autorisations
    'procedure',        -- charte, note de service, procédure interne
    -- Bibliothèque générale
    'annonce', 'circulaire', 'formulaire', 'calendrier', 'autre'
  ));

-- --- 2. Portée : qui peut consulter le texte ------------------------------
alter table fichiers_ecole
  add column if not exists portee text not null default 'interne'
  check (portee in ('interne', 'familles'));

--  Un texte publié aux familles gagne à porter sa référence et sa date : un
--  décret se cite, un règlement intérieur a une version.
alter table fichiers_ecole add column if not exists reference text;
alter table fichiers_ecole add column if not exists date_texte date;

create index if not exists fichiers_ecole_portee_idx
  on fichiers_ecole(ecole_id, portee, categorie);

-- --- 3. La portée entre dans le contrôle d'accès --------------------------
--  Trois voies de lecture, et une seule règle par voie :
--   • le personnel de gestion voit toute la documentation ;
--   • une pièce jointe suit l'audience de son annonce (mig. 150) ;
--   • un texte de portée « familles » est lisible par tout membre de
--     l'établissement — parents et étudiants compris, dont le
--     `profils.ecole_id` est NULL, d'où `est_membre_ecole()` (mig. 116).
drop policy if exists fichiers_ecole_select on fichiers_ecole;
create policy fichiers_ecole_select on fichiers_ecole for select using (
  est_super_admin()
  or (ecole_id = ecole_courante()
      and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  or (annonce_id is not null and _annonce_visible_par(annonce_id))
  or (portee = 'familles' and est_membre_ecole(ecole_id))
);

--  ⚠️ Rien à changer côté Storage : `_doc_peut_lire` est en SECURITY INVOKER
--  et s'appuie sur CETTE policy. Le droit de lire l'octet suit donc
--  automatiquement le droit de lire la ligne — y compris pour la portée
--  « familles » qu'on vient d'ajouter. C'est tout l'intérêt d'avoir écrit la
--  règle à un seul endroit.

-- --- 4. Les textes publiés, vus des familles ------------------------------
--  RPC plutôt que lecture directe : elle borne le résultat au rayon
--  réglementaire et trie dans l'ordre où l'on consulte ces textes.
create or replace function public.textes_reference()
returns table (id uuid, titre text, categorie text, reference text,
               date_texte date, nom_fichier text, chemin text,
               taille bigint, ecole text)
language sql stable security definer set search_path = public as $$
  select f.id, f.titre, f.categorie, f.reference, f.date_texte,
         f.nom_fichier, f.chemin, f.taille, ec.nom
    from fichiers_ecole f
    join ecoles ec on ec.id = f.ecole_id
   where f.portee = 'familles'
     and f.categorie in ('reglement', 'texte_officiel', 'convention', 'procedure')
     and est_membre_ecole(f.ecole_id)
   order by case f.categorie
              when 'reglement' then 1 when 'procedure' then 2
              when 'convention' then 3 else 4 end,
            f.date_texte desc nulls last, f.titre;
$$;
revoke execute on function public.textes_reference() from public, anon;
grant execute on function public.textes_reference() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • gestion : dépose un règlement en portée « familles » → il apparaît
--     dans l'espace parent ET dans l'espace étudiant ;
--   • le même en portée « interne » → invisible des familles, ligne comme
--     fichier ;
--   • parent d'un AUTRE établissement : `textes_reference()` ne renvoie
--     que les textes de son école.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.textes_reference();
-- alter table fichiers_ecole drop column if exists date_texte;
-- alter table fichiers_ecole drop column if exists reference;
-- alter table fichiers_ecole drop column if exists portee;
-- (puis réappliquer la policy fichiers_ecole_select et la contrainte
--  de catégorie de la migration 150.)
