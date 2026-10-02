-- =====================================================================
--  168 — Ce que l'établissement couvre réellement, et sa pédagogie
--
--  Demandé : pouvoir déclarer « Élémentaire (incluant le préscolaire) »,
--  « Collège », « Lycée », « Université » ET LEURS COMBINAISONS — du plus
--  simple (Élémentaire seul) au plus étendu (Élémentaire-Collège-Lycée-
--  Université). Plus, pour l'élémentaire, le choix entre pédagogie
--  classique et Montessori.
--
--  ⚠️ POURQUOI UNE COLONNE NEUVE, ET NON `type_etablissement`.
--  Ce champ porte DÉJÀ deux significations successives : la migration 001 y
--  stockait le statut juridique (« Privé », « Public »), la 108 en a fait la
--  bascule école / supérieur — et son `add column if not exists` n'ayant
--  rien appliqué, SIX écoles sur sept ont perdu Appel, Notes, Bulletins et
--  Emploi du temps de leur menu. Y poser une troisième signification, avec
--  une quinzaine de combinaisons, rejouerait ce défaut en pire.
--
--  ⚠️ ET POURQUOI PAS `cycles_actifs`, QUI SEMBLAIT FAITE POUR ÇA.
--  Parce que sa donnée n'est pas fiable pour cette question. Relevé en
--  production : l'Université Cheikh Anta Diop porte
--  `type_etablissement = 'superieur'` mais `cycles_actifs =
--  {prescolaire, premier_cycle, second_cycle, lycee, formation_pro}` —
--  SANS `universite`. Ce sont des cycles d'école, hérités des valeurs par
--  défaut de l'inscription. En faire la source de vérité du menu aurait
--  privé UCAD de toutes ses pages « supérieur ». On garde donc
--  `cycles_actifs` pour ce qu'elle est, et on ouvre un champ dont le sens
--  est clair et unique.
--
--  ⚠️ UNE COMBINAISON N'EST PAS UNE VALEUR, C'EST UN ENSEMBLE. Énumérer
--  « elementaire_college », « elementaire_college_lycee »… demanderait
--  quinze valeurs pour quatre paliers, et vingt-six pour cinq. Un tableau
--  de paliers dit la même chose sans explosion, et l'écran se charge de
--  rendre le choix simple (cas courants en un clic, cases à cocher pour
--  l'exact).
--
--  ⚠️ NULL OU VIDE = « NON DÉCLARÉ », PAS « AUCUN PALIER ». Le repli est
--  volontairement SÛR : une école qui n'a rien déclaré continue de se
--  comporter comme aujourd'hui. Un défaut à `'{}'` aurait vidé le menu des
--  écoles existantes — un écran blanc est une panne, pas une précaution.
--
--  Prérequis : migrations 001, 108.
-- =====================================================================

-- --- 1. Les paliers couverts ----------------------------------------------
alter table ecoles add column if not exists paliers text[];

comment on column ecoles.paliers is
  'Paliers couverts : elementaire (incl. prescolaire), college, lycee, formation_pro, universite. NULL/vide = non declare, repli sur type_etablissement (mig. 168).';

-- --- 2. Reprise de l'existant ---------------------------------------------
--  On ne demande pas aux sept écoles de se redéclarer : on déduit leur
--  palier de la meilleure preuve disponible, école par école, de sorte que
--  AUCUN menu ne change tant que personne n'y touche.
--
--  ⚠️ L'ORDRE DES DEUX RÈGLES COMPTE. `type_etablissement = 'superieur'`
--  l'emporte sur `cycles_actifs`, précisément à cause du cas UCAD décrit
--  plus haut : sa donnée de cycles la ferait passer pour une école.
update ecoles set paliers = array['universite']
 where paliers is null and type_etablissement = 'superieur';

update ecoles set paliers = (
  select coalesce(array_agg(distinct p order by p), '{}')
    from (
      select case
               when c = 'prescolaire'   then 'elementaire'
               when c = 'premier_cycle' then 'elementaire'
               when c = 'second_cycle'  then 'college'
               when c = 'lycee'         then 'lycee'
               when c = 'formation_pro' then 'formation_pro'
               when c = 'universite'    then 'universite'
             end as p
        from unnest(ecoles.cycles_actifs) as c
    ) t
   where p is not null
)
 where paliers is null and coalesce(array_length(cycles_actifs, 1), 0) > 0;

--  Une école sans aucune indication reste à NULL : le repli du front la
--  traite comme une école, exactement comme aujourd'hui.

-- --- 3. Les valeurs permises ----------------------------------------------
--  ⚠️ `formation_pro` FIGURE DANS LA LISTE bien qu'il n'ait pas été demandé.
--  Raison : le « CENTRE DE FORMATION PROFESSIONNEL DIAMNIADIO » existe en
--  production et ne couvre QUE ce palier. L'omettre lui aurait laissé un
--  ensemble vide, donc aucun menu.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ecoles_paliers_chk') then
    alter table ecoles add constraint ecoles_paliers_chk check (
      paliers is null or paliers <@ array['elementaire','college','lycee','formation_pro','universite']::text[]
    );
  end if;
end $$;

-- --- 4. La pédagogie de l'élémentaire -------------------------------------
--  Remonté avec la demande : « pour l'élémentaire il y a le choix entre
--  classique et Montessori, et ce dernier est à l'image de l'école de
--  Mme Kane, elle est la pionnière au Sénégal. »
--
--  NULL = non déclaré. On ne suppose pas « classique » par défaut : ce
--  serait affirmer quelque chose de l'école qu'elle n'a pas dit. Le champ
--  ne vaut d'ailleurs que si l'élémentaire est couvert.
alter table ecoles add column if not exists pedagogie_elementaire text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ecoles_pedagogie_chk') then
    alter table ecoles add constraint ecoles_pedagogie_chk check (
      pedagogie_elementaire is null or pedagogie_elementaire in ('classique','montessori')
    );
  end if;
end $$;

comment on column ecoles.pedagogie_elementaire is
  'classique | montessori. Montessori = classes multi-niveaux, cf. sous_niveaux (mig. 164). NULL = non declare (mig. 168).';

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • `select nom, type_etablissement, cycles_actifs, paliers from ecoles`
--     → UCAD en {universite} (et non en école, malgré ses cycles_actifs) ;
--       le centre de formation en {formation_pro} ; les cinq autres en
--       {elementaire} ou {elementaire,college} ;
--   • AUCUN menu ne change tant qu'un promoteur ne modifie rien ;
--   • une valeur hors liste → refusée par la contrainte ;
--   • `paliers = '{}'` reste possible et se comporte comme NULL côté front
--     (non déclaré), jamais comme « aucun palier » ;
--   • seul le promoteur (`admin_ecole`) peut écrire : la policy `ecoles_admin`
--     de la migration 001 l'exige déjà, rien à ajouter ;
--   • une école déclarée {elementaire, universite} voit les DEUX jeux de
--     pages — c'est le besoin que la demande a révélé, et que la bascule
--     binaire interdisait.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table ecoles drop constraint if exists ecoles_pedagogie_chk;
-- alter table ecoles drop constraint if exists ecoles_paliers_chk;
-- alter table ecoles drop column if exists pedagogie_elementaire;
-- alter table ecoles drop column if exists paliers;
