-- =====================================================================
--  116 — Helper GÉNÉRIQUE d'appartenance à un établissement + index manquants
--
--  POURQUOI :
--  Pour un ÉTUDIANT (comme pour un PARENT), `profils.ecole_id` est NULL
--  (cf. 113 `lier_etudiant` et 004 `lier_parent`). Par conséquent
--  `ecole_courante()` renvoie NULL pour eux, et TOUTE policy fondée uniquement
--  sur « ecole_id = ecole_courante() » les exclut.
--  Leur rattachement n'existe que dans `profil_roles(profil_id, ecole_id, role)`.
--
--  `est_membre_ecole()` répond à « cet utilisateur appartient-il à cette
--  école ? » en s'appuyant sur `profil_roles` — utilisable par TOUT module
--  ouvert aux étudiants/parents (pas seulement la bibliothèque).
--
--  FAIL-CLOSED : sans utilisateur authentifié, sans école, ou si le profil est
--  désactivé → FALSE (aucun accès). Même durcissement que `a_role()` (032).
--
--  ⚠️ À N'UTILISER QUE SUR LES NOUVEAUX OBJETS qui doivent être accessibles aux
--  étudiants/parents. NE PAS l'injecter dans les policies existantes : ce serait
--  un élargissement d'accès, avec risque de fuite entre établissements.
--
--  PERF : l'index UNIQUE `profil_roles(profil_id, ecole_id, role)` (001) sert
--  déjà de préfixe (profil_id, ecole_id) → aucun index supplémentaire requis.
--  La fonction est STABLE : PostgreSQL la mémoïse au sein d'une même requête.
--
--  Prérequis : exécuter la migration 115 AVANT (valeurs d'enum).
-- =====================================================================

create or replace function public.est_membre_ecole(p_ecole uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_ecole is not null
     and auth.uid() is not null
     and exists (
       select 1
       from profil_roles pr
       join profils p on p.id = pr.profil_id
       where pr.profil_id = auth.uid()
         and pr.ecole_id = p_ecole
         and p.actif
     );
$$;

comment on function public.est_membre_ecole(uuid) is
  'Appartenance d''un utilisateur à une école via profil_roles (fail-closed). '
  'Nécessaire car profils.ecole_id est NULL pour les étudiants et les parents.';

grant execute on function public.est_membre_ecole(uuid) to authenticated;

-- --- Index manquants relevés à l'audit (comptes étudiants, migration 113) ----
-- `eleves.profil_id` est interrogé par la RLS du consentement (114) et
-- `eleves.code_acces` par `lier_etudiant` — aucun index n'avait été créé.
create index if not exists eleves_profil_idx on eleves(profil_id) where profil_id is not null;
create unique index if not exists eleves_code_acces_idx on eleves(code_acces) where code_acces is not null;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.est_membre_ecole(uuid);
-- drop index if exists eleves_profil_idx;
-- drop index if exists eleves_code_acces_idx;
