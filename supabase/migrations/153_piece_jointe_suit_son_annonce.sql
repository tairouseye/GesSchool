-- =====================================================================
--  153 — Une pièce jointe suit son annonce, et elle seule
--
--  Découvert en éprouvant la migration 152 avec de vraies sessions parent.
--
--  La migration 151 a ouvert une deuxième voie de lecture dans
--  `fichiers_ecole` : un texte de portée « familles » est lisible par tout
--  membre de l'établissement. C'était le but — un règlement intérieur que
--  les familles ne peuvent pas lire ne sert à rien.
--
--  ⚠️ MAIS CETTE VOIE NE DISTINGUAIT PAS LES PIÈCES JOINTES. Un fichier
--  rattaché à une annonce ciblée « Préscolaire » mais portant
--  `portee = 'familles'` devenait lisible par TOUS les parents de l'école —
--  ligne et octet. Le ciblage, correct au niveau de l'annonce, était
--  contourné par son propre fichier.
--
--  Aujourd'hui l'interface ne produit pas ce cas : `televerserFichier`
--  force `portee = 'interne'` dès qu'il y a une annonce. Mais une règle de
--  sécurité qui tient parce que le client choisit bien la valeur d'une
--  colonne n'est pas une règle de sécurité — c'est une convention, et une
--  convention se perd. (Même leçon que l'audit bibliothèque : ne jamais
--  faire garder au client ce que la RLS doit garantir.)
--
--  Deux audiences, deux voies, aucun recouvrement :
--    • pièce jointe (`annonce_id` renseigné) → l'audience de son annonce ;
--    • document libre (`annonce_id` nul)     → sa portée.
--
--  Prérequis : migrations 150, 151.
-- =====================================================================

drop policy if exists fichiers_ecole_select on fichiers_ecole;
create policy fichiers_ecole_select on fichiers_ecole for select using (
  est_super_admin()
  or (ecole_id = ecole_courante()
      and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  -- Une pièce jointe suit l'audience de son annonce (mig. 150, 152).
  or (annonce_id is not null and _annonce_visible_par(annonce_id))
  -- Un document libre suit sa portée — et lui seul.
  or (annonce_id is null and portee = 'familles' and est_membre_ecole(ecole_id))
);

--  Même raisonnement pour le rayon réglementaire : il ne liste que des
--  documents déposés pour eux-mêmes. Le filtre de catégorie l'écartait déjà
--  en pratique (une pièce jointe reçoit `categorie = 'annonce'`), mais là
--  encore c'est l'application qui le décidait, pas la base.
create or replace function public.textes_reference()
returns table (id uuid, titre text, categorie text, reference text,
               date_texte date, nom_fichier text, chemin text,
               taille bigint, ecole text)
language sql stable security definer set search_path = public as $$
  select f.id, f.titre, f.categorie, f.reference, f.date_texte,
         f.nom_fichier, f.chemin, f.taille, ec.nom
    from fichiers_ecole f
    join ecoles ec on ec.id = f.ecole_id
   where f.annonce_id is null
     and f.portee = 'familles'
     and f.categorie in ('reglement', 'texte_officiel', 'convention', 'procedure')
     and est_membre_ecole(f.ecole_id)
   order by case f.categorie
              when 'reglement' then 1 when 'procedure' then 2
              when 'convention' then 3 else 4 end,
            f.date_texte desc nulls last, f.titre;
$$;
revoke execute on function public.textes_reference() from public, anon;
grant execute on function public.textes_reference() to authenticated;

--  ⚠️ Rien à changer côté Storage : `_doc_peut_lire` est en SECURITY INVOKER
--  et s'appuie sur CETTE policy (mig. 150). Le droit de lire l'octet suit
--  donc le droit de lire la ligne, sans qu'on ait à le redire.

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • pièce jointe d'une annonce « Préscolaire » forcée en portée
--     « familles » → refusée au parent d'un élève d'Élémentaire, ligne
--     comme octet ;
--   • pièce jointe d'une annonce qui le concerne → toujours lisible ;
--   • règlement intérieur déposé librement en portée « familles » → toujours
--     lisible, et toujours listé par `textes_reference()`.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- (réappliquer la policy `fichiers_ecole_select` et `textes_reference()`
--  de la migration 151.)
