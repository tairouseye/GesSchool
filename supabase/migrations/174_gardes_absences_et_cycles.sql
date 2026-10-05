-- =====================================================================
--  174 — Deux gardes manquantes, trouvées en préparant les accès par cases
--
--  Prérequis du chantier « accès du personnel » : le périmètre par cycle
--  va s'appuyer sur la table `cycles`, qui n'est aujourd'hui protégée par
--  rien. Et `absences_periode` sera dans le domaine à cloisonner, alors
--  qu'elle est ouverte à tout le monde. On ferme les deux d'abord.
--
--  Aucune donnée modifiée.
-- =====================================================================

-- --- 1. `absences_periode` n'était gardée par RIEN ---------------------
--
--  🔴 LE DÉFAUT. La fonction est `security definer`, et elle était
--  `grant`ée à `authenticated` sans aucun contrôle : ni `ecole_courante()`,
--  ni rôle, ni lien de filiation. N'IMPORTE QUEL COMPTE CONNECTÉ — un
--  parent, un étudiant — pouvait donc lire le compte d'absences de
--  n'importe quel élève, de n'importe quelle école, en appelant
--  `rpc('absences_periode', { p_eleve, p_periode })`.
--
--  Exploitation peu probable : il faut connaître DEUX uuid non
--  énumérables. Mais c'est la même famille que la migration 173, et on ne
--  laisse pas une porte ouverte parce qu'elle est étroite.
--
--  ⚠️ LE CORRECTIF N'EST PAS UN CONTRÔLE, C'EST UN RETRAIT DE DROIT, et
--  c'est important : cette fonction est appelée DEPUIS `enfant_bulletins`
--  (mig. 166), le chemin parent. Or pour un parent `ecole_courante()` vaut
--  NULL — un contrôle d'établissement aurait cassé l'affichage des
--  absences sur le bulletin des familles, exactement le piège que la
--  migration 167 a documenté.
--
--  Vérifié avant d'écrire : AUCUN appel direct, ni dans `src/`, ni
--  ailleurs en base. La fonction est un détail d'implémentation de
--  `enfant_bulletins`, pas une API. On la rend donc interne : un appelant
--  `security definer` l'atteint toujours (il s'exécute sous son
--  propriétaire), un client authentifié ne l'atteint plus.
revoke execute on function public.absences_periode(uuid, uuid) from authenticated;

--  Et on le dit dans le schéma, pour que personne ne la « rouvre » par
--  commodité en la croyant oubliée.
comment on function public.absences_periode(uuid, uuid) is
  'INTERNE. Appelée par enfant_bulletins uniquement. Ne pas accorder à authenticated : '
  'elle ne porte aucun contrôle d''établissement (mig. 174). Pour le personnel, '
  'utiliser absences_classe_periode, qui est gardée.';

-- --- 2. Les cycles ne se créent plus par un appel direct ---------------
--
--  L'interface affirme « Les cycles sont fixés à la création de l'école »
--  (Structure.jsx) et n'offre aucun bouton — mais la policy de la
--  migration 001 est un `for all` sur `ecole_id = ecole_courante()`, sans
--  prédicat de rôle : tout membre du personnel pouvait créer ou SUPPRIMER
--  un cycle par l'API. Un contrôle frontend pris pour une sécurité.
--
--  ⚠️ Et cela devient structurant : le périmètre par cycle à venir
--  s'appuiera sur cette table. Supprimer un cycle y effacerait des
--  périmètres (`on delete cascade`), donc des restrictions.
--
--  La lecture reste ouverte à tout membre : le menu, les sélecteurs et
--  `bulletin_affiche_absences` en ont besoin.
drop policy if exists cycles_tenant on public.cycles;

create policy cycles_select on public.cycles
  for select using (est_super_admin() or ecole_id = ecole_courante());

--  Écriture : le promoteur seul, comme pour les responsables de cycle
--  (mig. 166). L'onboarding passe par `creer_ecole_et_admin`, qui est
--  `security definer` et n'est donc pas concerné.
create policy cycles_ecrire on public.cycles
  for all
  using (est_super_admin() or (ecole_id = ecole_courante() and est_admin()))
  with check (est_super_admin() or (ecole_id = ecole_courante() and est_admin()));

--  ⚠️ `niveaux` et `classes` NE SONT PAS touchées : la page Structure les
--  crée et les modifie, et c'est le travail normal de la direction. Seuls
--  les cycles sont « fixés à la création ».

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- grant execute on function public.absences_periode(uuid, uuid) to authenticated;
-- comment on function public.absences_periode(uuid, uuid) is null;
-- drop policy if exists cycles_select on public.cycles;
-- drop policy if exists cycles_ecrire on public.cycles;
-- create policy cycles_tenant on public.cycles for all
--   using (est_super_admin() or ecole_id = ecole_courante())
--   with check (est_super_admin() or ecole_id = ecole_courante());
-- notify pgrst, 'reload schema';
