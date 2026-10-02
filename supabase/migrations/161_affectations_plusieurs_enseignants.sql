-- =====================================================================
--  161 — Plusieurs enseignants par classe, et l'enseignant « toutes matières »
--
--  Remonté en visite : au préscolaire, une classe de TPS/PS compte jusqu'à
--  TROIS maîtresses, et chacune enseigne l'ensemble des domaines. Au collège
--  et au lycée, l'affectation reste enseignant → matière → classe. Le modèle
--  doit porter les deux.
--
--  ⚠️ DEUX VERROUS L'EN EMPÊCHAIENT, ET UN SEUL ÉTAIT VISIBLE.
--    • `matiere_id NOT NULL` : impossible d'affecter une maîtresse à une
--      classe « pour tout ». Mesuré : 0 affectation sans matière en base,
--      et pour cause.
--    • `unique (classe_id, matiere_id, annee_id)` : UN SEUL enseignant par
--      matière et par classe. Deux maîtresses se partageant le Langage sont
--      donc refusées.
--
--  ⚠️ NUANCE QUE L'AUDIT AVAIT D'ABORD MANQUÉE : plusieurs enseignants par
--  classe fonctionnent DÉJÀ quand ils se répartissent des matières
--  différentes — 12 classes sont dans ce cas aujourd'hui. Ce n'est donc pas
--  le modèle collège qu'il faut réparer, mais le cas Montessori, où les
--  maîtresses ne se répartissent rien : elles font tout, ensemble.
--
--  Règle retenue : `matiere_id` à NULL signifie « toutes les matières de
--  cette classe ». C'est la lecture la plus simple, et elle évite une table
--  de liaison de plus pour exprimer une absence de découpage.
--
--  ⚠️ AUCUNE DONNÉE N'EST TOUCHÉE. Les 134 affectations existantes gardent
--  leur matière et restent valides : on ne fait que LEVER des interdits.
--
--  Prérequis : migrations 001, 058.
-- =====================================================================

-- --- 1. Une affectation peut ne viser aucune matière ----------------------
alter table affectations alter column matiere_id drop not null;

comment on column affectations.matiere_id is
  'NULL = l''enseignant couvre TOUTES les matières de la classe (cas du préscolaire/élémentaire, mig. 161).';

-- --- 2. Plusieurs enseignants sur une même matière ------------------------
--  L'ancienne contrainte portait sur (classe, matière, année) sans
--  l'enseignant : elle faisait de l'affectation une propriété de la MATIÈRE,
--  alors qu'elle décrit un lien entre une personne et une classe.
--
--  On la retrouve dynamiquement plutôt que par son nom : une contrainte posée
--  à la main ou renommée porterait un autre identifiant, et un `drop ... if
--  exists` sur le mauvais nom échouerait en silence — l'interdit resterait.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'affectations'
       and con.contype = 'u'
       and (
         select array_agg(att.attname::text order by att.attname)
           from unnest(con.conkey) k
           join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
       ) = array['annee_id','classe_id','matiere_id']
  loop
    execute format('alter table affectations drop constraint %I', c.conname);
    raise notice 'Contrainte % retirée.', c.conname;
  end loop;
end $$;

--  Deux index partiels plutôt qu'un seul avec `nulls not distinct` : ce
--  dernier n'existe qu'à partir de PostgreSQL 15, et la version du projet
--  n'est pas lisible depuis l'API. Deux index sont explicites et portables.
--
--  Ce qu'on interdit désormais, c'est le DOUBLON PUR : le même enseignant,
--  deux fois, sur la même classe et la même matière.
drop index if exists affectations_unique_matiere;
create unique index affectations_unique_matiere
  on affectations (classe_id, matiere_id, enseignant_id, annee_id)
  where matiere_id is not null;

drop index if exists affectations_unique_toutes_matieres;
create unique index affectations_unique_toutes_matieres
  on affectations (classe_id, enseignant_id, annee_id)
  where matiere_id is null;

-- --- 3. La RLS doit comprendre « toutes matières » ------------------------
--  ⚠️ LE POINT LE PLUS DÉLICAT DE CETTE MIGRATION.
--  `enseigne_classe_matiere()` exigeait `a.matiere_id = p_matiere`. Une
--  maîtresse affectée sans matière n'aurait donc satisfait AUCUNE matière :
--  elle aurait obtenu la classe (`enseigne_classe` ne filtre pas la matière)
--  mais se serait vu refuser notes, bulletins et cahier de textes. La
--  fonctionnalité aurait semblé livrée, et n'aurait pas marché.
--
--  Une affectation sans matière couvre donc toutes les matières de la classe
--  — exactement comme le professeur principal, dont la clause suivante
--  n'est pas modifiée.
create or replace function public.enseigne_classe_matiere(p_classe uuid, p_matiere uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from affectations a
      join enseignants e on e.id = a.enseignant_id
      where a.classe_id = p_classe
        and (a.matiere_id = p_matiere or a.matiere_id is null)
        and e.profil_id = auth.uid()
    )
    or exists (
      select 1 from classes c
      join enseignants e on e.id = c.prof_principal_id
      where c.id = p_classe and e.profil_id = auth.uid()
    );
$$;
revoke execute on function public.enseigne_classe_matiere(uuid, uuid) from public, anon;
grant execute on function public.enseigne_classe_matiere(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • les 134 affectations existantes sont intactes et toujours valides ;
--   • trois maîtresses affectées à TPS/PS A sans matière → acceptées ;
--   • la même maîtresse deux fois sur la même classe sans matière → refusée
--     par `affectations_unique_toutes_matieres` ;
--   • deux enseignants différents sur la MÊME matière d'une classe →
--     désormais acceptés (c'était l'interdit principal) ;
--   • le même enseignant deux fois sur la même matière → toujours refusé ;
--   • une maîtresse « toutes matières » peut saisir les notes de N'IMPORTE
--     quelle matière de sa classe — c'est le point 3 ci-dessus ;
--   • un enseignant d'une autre classe reste refusé.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- ⚠️ Supprimer d'abord les affectations sans matière, sinon le NOT NULL
--    échouera :  delete from affectations where matiere_id is null;
-- drop index if exists affectations_unique_toutes_matieres;
-- drop index if exists affectations_unique_matiere;
-- alter table affectations add constraint affectations_classe_id_matiere_id_annee_id_key
--   unique (classe_id, matiere_id, annee_id);
-- alter table affectations alter column matiere_id set not null;
-- (puis réappliquer `enseigne_classe_matiere` de la migration 058.)
