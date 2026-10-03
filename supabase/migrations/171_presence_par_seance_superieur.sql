-- =====================================================================
--  171 — La présence par SÉANCE, au supérieur
--
--  Précisé par l'école : « la présence est journalière pour le préscolaire
--  et l'élémentaire, et par séance — c'est-à-dire par matière — pour le
--  supérieur. »
--
--  Le besoin n'est donc pas une seconde feuille de présence, c'est une
--  CLÉ différente : à l'école on pointe un élève pour une JOURNÉE ; à
--  l'université on pointe un étudiant pour UNE SÉANCE (ce CM de ce jeudi,
--  cette UE, ce groupe de TD).
--
--  ⚠️ `absences.classe_id` NE PEUT PAS SERVIR. L'université n'a pas de
--  classes : ses étudiants sont inscrits par FILIÈRE et par SEMESTRE
--  (`inscriptions_sup`), et suivent des UE (`inscriptions_ue`). La colonne
--  resterait NULL, et deux séances du même jour seraient indiscernables.
--
--  ⚠️ AUCUN CHANGEMENT DE DROITS N'EST NÉCESSAIRE, et je l'ai vérifié avant
--  d'en écrire un. La migration 018 autorise l'écriture d'`absences` à
--  `est_gestion() or surveillant or enseignant`, SANS restriction de classe
--  — la 058 a cloisonné les notes et les bulletins, pas les absences. Un
--  enseignant du supérieur peut donc déjà faire son appel. Toucher à cette
--  policy aurait été un risque gratuit.
--
--  ⚠️ CE QUI SÉPARE LES DEUX FEUILLES. L'appel « école » travaille sur
--  (classe_id, date_abs) ; l'appel « supérieur » sur (seance_sup_id,
--  date_abs). Les lignes du supérieur ont `classe_id` NULL, donc l'appel
--  d'une classe ne les voit pas et ne peut pas les effacer — et
--  réciproquement. Les deux circuits coexistent sans se marcher dessus.
--
--  Prérequis : migrations 001, 018, 109 (inscriptions_sup/_ue), 138 (emplois_sup).
-- =====================================================================

-- --- 1. Rattacher une absence à sa séance ---------------------------------
alter table absences add column if not exists seance_sup_id uuid
  references emplois_sup(id) on delete set null;
create index if not exists absences_seance_sup_idx on absences(seance_sup_id, date_abs);

comment on column absences.seance_sup_id is
  'Seance du superieur concernee (emplois_sup). NULL pour les absences journalieres de l''ecole (mig. 171).';

-- --- 2. Qui doit être présent à cette séance ------------------------------
--  ⚠️ EN SECURITY DEFINER, LA RLS NE PROTÈGE PLUS : le cloisonnement entre
--  établissements est écrit explicitement ici. Sans lui, un membre d'une
--  école lirait la liste des étudiants d'une autre. Leçon de la mig. 167.
drop function if exists public.etudiants_seance(uuid);
create or replace function public.etudiants_seance(p_seance uuid)
returns table(eleve_id uuid, prenom text, nom text, matricule text, niveau text)
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_ue uuid; v_filiere uuid; v_annee uuid;
begin
  select es.ecole_id, es.ue_id, es.filiere_id, es.annee_id
    into v_ecole, v_ue, v_filiere, v_annee
    from emplois_sup es where es.id = p_seance;
  if v_ecole is null then
    raise exception 'Séance introuvable.';
  end if;
  if not (est_super_admin() or (v_ecole = ecole_courante()
          and (est_gestion() or a_role('enseignant') or a_role('surveillant') or a_role('secretaire')))) then
    raise exception 'Accès refusé.';
  end if;

  return query
  select e.id, e.prenom, e.nom, e.matricule, i.niveau
    from inscriptions_sup i
    join eleves e on e.id = i.eleve_id
   where i.ecole_id = v_ecole
     and i.filiere_id = v_filiere
     and i.statut = 'active'
     and (v_annee is null or i.annee_id = v_annee)
     --  ⚠️ SI LA SÉANCE PORTE UNE UE, on ne convoque QUE les étudiants
     --  inscrits à cette UE. C'est tout l'intérêt du pointage par séance :
     --  une UE optionnelle ne concerne pas toute la filière, et marquer
     --  absents ceux qui ne la suivent pas serait une faute de compte.
     --  Si la séance n'a pas d'UE (cas permis par la mig. 138), on prend
     --  toute la filière — faute de mieux, et c'est visible à l'écran.
     and (v_ue is null or exists (
       select 1 from inscriptions_ue iu
        where iu.inscription_id = i.id and iu.ue_id = v_ue
          and iu.statut in ('inscrit', 'valide', 'en_dette')
     ))
   order by e.nom, e.prenom;
end $fn$;
revoke execute on function public.etudiants_seance(uuid) from public, anon;
grant execute on function public.etudiants_seance(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • une séance avec UE → seuls les étudiants inscrits à CETTE UE ;
--   • une séance sans UE → toute la filière du semestre ;
--   • un étudiant dont l'inscription est suspendue ou annulée → absent de
--     la liste (on ne le marque pas absent d'un cours qu'il ne suit plus) ;
--   • 🔴 un membre d'une AUTRE école → refusé ;
--   • parent, étudiant, anonyme → refusés ;
--   • pointer deux séances le MÊME jour pour le même étudiant → deux
--     lignes distinctes, puisque la clé est la séance et non la journée ;
--   • l'appel d'une CLASSE (école) ne voit ni n'efface les lignes du
--     supérieur : elles ont `classe_id` NULL ;
--   • réciproquement, l'appel d'une séance ne touche pas les absences
--     journalières de l'école.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.etudiants_seance(uuid);
-- alter table absences drop column if exists seance_sup_id;
