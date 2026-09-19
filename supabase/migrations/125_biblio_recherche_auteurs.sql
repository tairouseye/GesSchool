-- =====================================================================
--  125 — Bibliothèque : indexer les AUTEURS dans la recherche plein texte
--
--  ⚠️ CORRECTIF. Depuis la migration 117, `biblio_maj_recherche` n'indexe que
--  titre, sous-titre, éditeur, discipline, résumé et mots-clés. Or l'interface
--  annonce « Titre, auteur, éditeur, mot-clé… » : chercher « Senghor » ne
--  renvoyait RIEN, alors que les auteurs sont bien saisis. Les auteurs vivent
--  dans une table de liaison (`biblio_ressource_auteurs`), ils ne sont donc pas
--  visibles depuis un trigger `before` posé sur la seule notice.
--
--  Deux triggers sont nécessaires, car l'information arrive en deux temps :
--    1. sur la NOTICE : recalcule en incluant les auteurs déjà liés ;
--    2. sur la LIAISON : « touche » la notice pour la faire recalculer quand
--       un auteur est ajouté, retiré ou remplacé — c'est le cas le plus
--       fréquent, puisqu'on lie les auteurs APRÈS avoir créé la notice.
--
--  Pas de récursion : « toucher » la notice ne réécrit jamais la liaison.
--
--  Prérequis : migration 117.
-- =====================================================================

create or replace function public.biblio_maj_recherche()
returns trigger language plpgsql set search_path = public as $$
declare v_auteurs text;
begin
  select string_agg(trim(coalesce(a.prenom, '') || ' ' || a.nom), ' ')
    into v_auteurs
    from biblio_ressource_auteurs ra
    join biblio_auteurs a on a.id = ra.auteur_id
   where ra.ressource_id = new.id;

  new.recherche := to_tsvector('french',
    coalesce(new.titre, '') || ' ' ||
    coalesce(new.sous_titre, '') || ' ' ||
    coalesce(new.editeur, '') || ' ' ||
    coalesce(new.discipline, '') || ' ' ||
    coalesce(new.resume, '') || ' ' ||
    coalesce(array_to_string(new.mots_cles, ' '), '') || ' ' ||
    coalesce(v_auteurs, '')
  );
  return new;
end $$;

-- Quand la liaison change, on force le recalcul de la notice concernée.
create or replace function public.biblio_touche_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update biblio_ressources set titre = titre
   where id = coalesce(new.ressource_id, old.ressource_id);
  return null;
end $$;

drop trigger if exists trg_biblio_recherche_auteurs on biblio_ressource_auteurs;
create trigger trg_biblio_recherche_auteurs
  after insert or update or delete on biblio_ressource_auteurs
  for each row execute function public.biblio_touche_notice();

-- Rattrapage : réindexe les notices qui ont au moins un auteur.
update biblio_ressources r set titre = r.titre
 where exists (select 1 from biblio_ressource_auteurs ra where ra.ressource_id = r.id);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists trg_biblio_recherche_auteurs on biblio_ressource_auteurs;
-- drop function if exists public.biblio_touche_notice();
-- (puis réappliquer la version de `biblio_maj_recherche` de la migration 117)
