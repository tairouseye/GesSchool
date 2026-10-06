-- =====================================================================
--  187 — 🔴 ESCALADE DE PRIVILÈGES : n'importe qui pouvait se nommer
--        promoteur de son école
--
--  TROUVÉ EN BALAYANT LES TABLES RESTANTES après la bascule du dernier
--  domaine (mig. 186), et c'est de loin le défaut le plus grave du chantier :
--  il annulait TOUT le reste.
--
--  `profil_roles` portait UNE policy `for all` :
--      est_super_admin() OR (ecole_id = ecole_courante())
--  — aucun contrôle de rôle. Tout membre du personnel pouvait donc écrire
--  dans la table qui DÉFINIT les rôles, et donc s'accorder le sien :
--
--      insert into profil_roles (profil_id, ecole_id, role)
--      values (auth.uid(), <son école>, 'admin_ecole');
--
--  ⚠️ ÉPROUVÉ, PAS SUPPOSÉ. Dans une transaction annulée, avec la session
--  d'un simple enseignant :
--      AVANT  : 1 élève lu, 0 salaire, 0 ligne de barème
--      INSERT admin_ecole sur lui-même : **PASSE**
--      APRÈS  : 4 salaires, 14 832 lignes de barème, et il MODIFIE un élève
--
--  🔴 ET C'EST PIRE QUE CELA EN APPARENCE : il n'avait même pas besoin des
--  cases. `a_acces()` commence par `est_super_admin() or a_role('admin_ecole')`
--  — le rôle de promoteur ouvre tout, quel que soit le contenu de
--  `personnel_acces`. Les huit migrations de bascule reposaient donc sur une
--  table que leurs propres utilisateurs pouvaient réécrire.
--
--  ⚠️ LA MÊME CHOSE SUR `profils` : `profils_tenant` était aussi `for all` sur
--  le seul établissement. On pouvait donc modifier le profil de n'importe quel
--  collègue — son `ecole_id`, son `actif` — c'est-à-dire l'exclure, ou le
--  déplacer dans une autre école.
--
--  ⚠️ VÉRIFIÉ AVANT DE FERMER, et c'est ce qui rend le correctif sans risque :
--  AUCUN chemin de l'application n'écrit dans ces deux tables depuis le
--  client. Les quatre seuls accès trouvés dans `src/` sont des SELECT
--  (`AuthContext.jsx` lignes 46-47, `journal.js` ligne 79, `rh.js` ligne 1211).
--  Toutes les écritures légitimes passent par des fonctions
--  `security definer` — `rejoindre` (mig. 030), `accorder_modele` et
--  `revoquer_role` (mig. 176), `suspendre_membre`, le déclencheur
--  `trg_acces_suit_roles`, et les RPC `admin_*` de la console — qui
--  contournent la RLS par construction. Leur retirer le droit d'écrire en
--  direct ne retire donc rien à personne.
--
--  ⚠️ LA LECTURE EST CONSERVÉE À L'IDENTIQUE. Ce n'est pas le sujet, et la
--  resserrer ici risquerait de casser `membres_ecole`, le journal ou
--  l'affichage des noms. Un seul défaut à la fois.
-- =====================================================================

-- --- 1. `profil_roles` : lire comme avant, n'écrire qu'en console ------
drop policy if exists profil_roles_tenant on public.profil_roles;
drop policy if exists profil_roles_self on public.profil_roles;
drop policy if exists profil_roles_select on public.profil_roles;
drop policy if exists profil_roles_ecrire on public.profil_roles;

create policy profil_roles_select on public.profil_roles
  for select using (
    (select est_super_admin())
    or profil_id = (select auth.uid())
    or ecole_id = (select ecole_courante())
  );

--  Écriture : la console de la plateforme seule. Tout le reste passe par les
--  fonctions `security definer` nommées en en-tête.
create policy profil_roles_ecrire on public.profil_roles
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

comment on table public.profil_roles is
  'Rôles d''un profil dans une école. ⚠️ N''EST JAMAIS ÉCRITE EN DIRECT par le '
  'client : seules les fonctions security definer (rejoindre, accorder_modele, '
  'revoquer_role, suspendre_membre, trg_acces_suit_roles, admin_*) y touchent. '
  'Une policy d''écriture ouverte ici vaut escalade de privilèges — un simple '
  'enseignant s''accordait `admin_ecole` et obtenait tout (mig. 187).';

-- --- 2. `profils` : idem --------------------------------------------
drop policy if exists profils_tenant on public.profils;
drop policy if exists profils_self_select on public.profils;
drop policy if exists profils_select on public.profils;
drop policy if exists profils_ecrire on public.profils;

create policy profils_select on public.profils
  for select using (
    (select est_super_admin())
    or id = (select auth.uid())
    or ecole_id = (select ecole_courante())
  );

create policy profils_ecrire on public.profils
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

comment on table public.profils is
  'Profil applicatif d''un compte. ⚠️ Même règle que profil_roles : aucune '
  'écriture directe depuis le client. Une policy ouverte permettait de changer '
  'l''`ecole_id` ou l''`actif` d''un collègue — donc de l''exclure (mig. 187).';

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  ⚠️ NE PAS ANNULER CETTE MIGRATION. Rétablir les policies d'origine
--  réouvre l'escalade de privilèges décrite en en-tête. Si une écriture
--  directe devient nécessaire, ajouter une policy CIBLÉE (une colonne, un
--  rôle précis) plutôt que de revenir à `for all` sur le seul établissement.
--
-- -- Pour mémoire, l'état d'avant :
-- -- create policy profil_roles_tenant on public.profil_roles for all
-- --   using (est_super_admin() or (ecole_id = ecole_courante()))
-- --   with check (est_super_admin() or (ecole_id = ecole_courante()));
-- -- create policy profil_roles_self on public.profil_roles for select
-- --   using (profil_id = auth.uid());
-- -- create policy profils_tenant on public.profils for all
-- --   using (est_super_admin() or (ecole_id = ecole_courante()))
-- --   with check (est_super_admin() or (ecole_id = ecole_courante()));
-- -- create policy profils_self_select on public.profils for select
-- --   using (id = auth.uid());
