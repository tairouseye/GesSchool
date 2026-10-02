-- =====================================================================
--  160 — Supprimer une évaluation : refuser quand elle porte des notes
--
--  Demandé après une visite d'établissement. L'audit a montré que la
--  capacité n'existait pas dans l'interface — mais qu'un fusil chargé
--  l'attendait dans la couche métier : `supprimerEvaluation()` faisait un
--  `delete` brut, sans aucun appelant.
--
--  ⚠️ POURQUOI C'ÉTAIT DANGEREUX : `notes.evaluation_id` est déclarée
--  `on delete cascade` (mig. 001). Supprimer une évaluation efface donc
--  TOUTES ses notes, sans avertissement et sans retour possible. Mesuré au
--  01/10/2026 : 28 évaluations sur 31 portent des notes, 171 notes au total.
--  Brancher un bouton sur cette fonction aurait suffi à perdre un trimestre.
--
--  Règle retenue : une évaluation NOTÉE ne se supprime pas, elle s'ARCHIVE.
--  Seule une évaluation créée par erreur — donc vierge — part réellement.
--
--  ⚠️ ARCHIVER DOIT AVOIR UN EFFET SUR LES MOYENNES, sinon le mot est creux.
--  `calculerBulletins()` lit les évaluations via `getEvaluations()` : c'est
--  le seul chemin, et il filtre désormais `actif`. Une évaluation archivée
--  disparaît donc du calcul comme de la saisie, et ses notes restent en base
--  — on peut la réactiver et retrouver l'état d'avant.
--
--  ⚠️ LES DEUX RPC SONT EN `SECURITY INVOKER`, VOLONTAIREMENT. Leur rôle est
--  d'ajouter une règle MÉTIER, pas de contourner la RLS : le droit d'écrire
--  sur `evaluations` est déjà défini (mig. 018 : gestion ou enseignant) et
--  l'enseignant est cloisonné à ses classes (mig. 058). En `SECURITY
--  DEFINER`, ces deux garde-fous sauteraient — exactement le défaut attrapé
--  sur `_doc_peut_lire` en mig. 150. On contrôle donc `found` : si la RLS
--  masque la ligne, l'opération touche 0 ligne et doit le DIRE, pas réussir
--  en silence.
--
--  Prérequis : migrations 001, 018, 058.
-- =====================================================================

-- --- 1. Le marqueur d'archivage -----------------------------------------
--  ⚠️ `add column if not exists` est un NO-OP si la colonne existe : il
--  n'appliquerait alors ni le défaut ni le NOT NULL (piège des mig. 108/141).
--  On pose donc les contraintes séparément, pour rester rejouable.
alter table evaluations add column if not exists actif boolean;
update evaluations set actif = true where actif is null;
alter table evaluations alter column actif set default true;
alter table evaluations alter column actif set not null;

comment on column evaluations.actif is
  'false = archivée : exclue des moyennes et de la saisie, notes conservées (mig. 160).';

create index if not exists evaluations_actif_idx
  on evaluations(ecole_id, classe_id, periode_id, actif);

-- --- 2. Supprimer : seulement si aucune note ------------------------------
create or replace function public.supprimer_evaluation(p_eval uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_notes int;
begin
  --  Compté AVANT, pour pouvoir dire combien. Un refus qui n'explique pas
  --  pousse l'utilisateur à chercher un contournement.
  select count(*) into v_notes from notes n where n.evaluation_id = p_eval;
  if v_notes > 0 then
    raise exception
      'Cette évaluation porte % note(s) : elle ne peut pas être supprimée. Archivez-la pour la retirer des moyennes sans perdre les notes.', v_notes
      using errcode = 'restrict_violation';
  end if;

  delete from evaluations where id = p_eval;
  if not found then
    --  Soit elle n'existe plus, soit la RLS la masque (autre école, ou
    --  enseignant non affecté à cette classe). On ne distingue pas : le dire
    --  renseignerait sur l'existence d'une donnée qu'on n'a pas le droit de voir.
    raise exception 'Évaluation introuvable ou accès refusé.';
  end if;
end $$;
revoke execute on function public.supprimer_evaluation(uuid) from public, anon;
grant execute on function public.supprimer_evaluation(uuid) to authenticated;

-- --- 3. Archiver / réactiver ---------------------------------------------
create or replace function public.archiver_evaluation(p_eval uuid, p_actif boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update evaluations set actif = coalesce(p_actif, false) where id = p_eval;
  if not found then
    raise exception 'Évaluation introuvable ou accès refusé.';
  end if;
end $$;
revoke execute on function public.archiver_evaluation(uuid, boolean) from public, anon;
grant execute on function public.archiver_evaluation(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • les 31 évaluations existantes passent à `actif = true` : aucun
--     bulletin, aucune moyenne ne bouge ;
--   • supprimer une évaluation NOTÉE → refus, avec le nombre de notes ;
--   • supprimer une évaluation VIERGE (3 en base) → part réellement ;
--   • archiver une évaluation notée → elle sort des moyennes, ses notes
--     restent ; la réactiver rend exactement la moyenne d'avant ;
--   • un enseignant non affecté à la classe, ou d'une autre école → refus
--     (c'est la RLS qui le dit, pas la RPC) ;
--   • un compte sans droit d'écriture sur `evaluations` → refus.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.archiver_evaluation(uuid, boolean);
-- drop function if exists public.supprimer_evaluation(uuid);
-- drop index if exists evaluations_actif_idx;
-- alter table evaluations drop column if exists actif;
