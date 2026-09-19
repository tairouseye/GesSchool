-- =====================================================================
--  134 — PHASE 1a de l'audit : tracer les actes sensibles
--
--  Constat : aucune trace n'existait sur la modification d'une note, la
--  suppression d'un élève, l'annulation d'un paiement, le changement de rôle
--  ou de statut d'inscription — précisément les actes qu'un établissement
--  peut avoir à justifier devant une famille ou un auditeur.
--
--  Trois journaux coexistaient : `audit_log` (migration 001) sans AUCUN
--  écrivain depuis l'origine, `journal_audit` (079/086) utilisé par le
--  workflow de paie, et `biblio_journal` pour la bibliothèque. On étend le
--  seul qui vive plutôt que d'en créer un quatrième.
--
--  Choix assumés :
--   • UPDATE et DELETE seulement, pas INSERT. Une création est rarement
--     contestée et serait très bruyante (saisie de notes en masse) ; ce
--     qu'on conteste, c'est une note MODIFIÉE ou un paiement DISPARU.
--   • Le détail ne garde que les champs RÉELLEMENT changés, avec leur
--     valeur avant et après. Copier la ligne entière rendrait le journal
--     illisible et volumineux.
--   • SECURITY DEFINER : sans cela, la RLS de `journal_audit` empêcherait
--     un enseignant d'y écrire, et sa modification passerait sans trace.
--   • Le trigger NE RATTRAPE PAS ses erreurs. Une exception annule
--     l'opération : mieux vaut refuser une modification que l'accepter sans
--     trace. Seul le cas prévisible (ecole_id absent) est neutralisé.
--
--  Aucun fichier applicatif n'est modifié.
--  Prérequis : migrations 001 et 086.
-- =====================================================================

create or replace function public.trg_journaliser_acte()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ecole   uuid;
  v_id      uuid;
  v_avant   jsonb;
  v_apres   jsonb;
  v_detail  jsonb := '{}'::jsonb;
  k         text;
begin
  if tg_op = 'DELETE' then
    v_ecole := to_jsonb(old) ->> 'ecole_id';
    v_id    := (to_jsonb(old) ->> 'id')::uuid;
    -- À la suppression, la ligne entière EST l'information à conserver :
    -- sans elle, on saurait qu'on a supprimé, pas quoi.
    v_detail := jsonb_build_object('ligne_supprimee', to_jsonb(old));
  else
    v_ecole := to_jsonb(new) ->> 'ecole_id';
    v_id    := (to_jsonb(new) ->> 'id')::uuid;
    v_avant := to_jsonb(old);
    v_apres := to_jsonb(new);
    for k in select jsonb_object_keys(v_apres)
    loop
      if v_avant -> k is distinct from v_apres -> k then
        v_detail := v_detail || jsonb_build_object(
          k, jsonb_build_object('avant', v_avant -> k, 'apres', v_apres -> k));
      end if;
    end loop;
    -- Mise à jour sans changement réel (ré-enregistrement d'un formulaire) :
    -- inutile de polluer le journal.
    if v_detail = '{}'::jsonb then return null; end if;
  end if;

  -- `journal_audit.ecole_id` est NOT NULL. Sans école (cas d'un super_admin
  -- sur une ligne hors tenant), on renonce à tracer plutôt que de bloquer
  -- l'opération métier.
  if v_ecole is null then return null; end if;

  insert into journal_audit (ecole_id, utilisateur, entite, entite_id, operation, details)
  values (v_ecole, auth.uid(), tg_table_name, v_id, tg_op, v_detail);
  return null;
end $$;

-- --- Pose du trigger sur les actes contestables ---------------------------
--  notes / notes_lmd / releves : la note d'un étudiant.
--  factures / paiements        : l'argent.
--  eleves / inscriptions_sup   : le statut scolaire.
--  profil_roles                : qui a reçu quel pouvoir.
do $$
declare t text;
begin
  foreach t in array array[
    'notes', 'notes_lmd', 'releves', 'bulletins',
    'factures', 'paiements',
    'eleves', 'inscriptions_sup', 'profil_roles'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'Table % absente, ignorée.', t;
      continue;
    end if;
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$I;', t);
    execute format(
      'create trigger trg_audit_%1$s after update or delete on public.%1$I
         for each row execute function public.trg_journaliser_acte();', t);
    raise notice 'Traçabilité posée sur %', t;
  end loop;
end $$;

-- --- Index de consultation -------------------------------------------------
--  On consulte un journal par établissement et par date, ou pour retrouver
--  l'historique d'une entité précise.
create index if not exists journal_audit_ecole_idx
  on journal_audit(ecole_id, created_at desc);
create index if not exists journal_audit_entite_idx
  on journal_audit(entite, entite_id, created_at desc);

-- --- `audit_log` : table morte depuis la migration 001 ---------------------
--  Zéro écrivain, zéro lecteur. On ne la supprime PAS ici — une suppression
--  est irréversible et cette migration doit rester sans risque. On la marque,
--  la décision reste à prendre.
comment on table audit_log is
  'OBSOLÈTE — aucun écrivain depuis la migration 001. La traçabilité vit dans journal_audit (voir migration 134). À supprimer après vérification qu''elle est bien vide en production.';

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
-- =====================================================================
-- select entite, operation, count(*) from journal_audit group by 1,2 order by 3 desc;
-- select created_at, entite, operation, details from journal_audit
--   order by created_at desc limit 20;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- do $$ declare t text; begin
--   foreach t in array array['notes','notes_lmd','releves','bulletins','factures',
--                            'paiements','eleves','inscriptions_sup','profil_roles'] loop
--     execute format('drop trigger if exists trg_audit_%1$s on public.%1$I;', t);
--   end loop;
-- end $$;
-- drop function if exists public.trg_journaliser_acte();
