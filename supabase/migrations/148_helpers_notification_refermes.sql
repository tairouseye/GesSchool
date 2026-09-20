-- =====================================================================
--  148 — 🔴 Les fabriques de notifications étaient appelables par n'importe
--        quel utilisateur connecté
--
--  Trouvé en éprouvant la migration 147 avec une VRAIE session de parent.
--  Résultats du sondage (compte parent, aucun rôle de gestion) :
--
--     _notifier_parents ......... 204  🔴 autorisé
--     _notifier_etudiant ........ 204  🔴 autorisé
--     executer_relances ......... 200  🔴 autorisé
--     _notifier_parents_ecole ... 200  🔴 autorisé
--     relancer_eleve ............ 400  ✓ « Réservé au comptable. »
--     transport_notifier ........ (garde interne « Réservé à la Gestion »)
--
--  Concrètement, un parent pouvait forger une notification adressée à
--  n'importe quel parent de n'importe quel établissement, ou déclencher la
--  campagne de relances d'une autre école.
--
--  DEUX CAUSES, dont une est la mienne :
--
--   • `create function` accorde EXECUTE à PUBLIC par défaut. Les helpers
--     internes `_notifier_parents` (mig. 013/112) et `_notifier_etudiant`
--     (mig. 130) n'ont jamais été révoqués. Défaut ancien.
--
--   • `executer_relances` avait été DÉLIBÉRÉMENT révoquée en migration 019
--     (« NON exposé à authenticated : la version paramétrable traverse les
--     tenants »), avec un wrapper `relancer_tout()` gardé pour l'interface.
--     Ma migration 147 l'a rouverte avec un `grant … to authenticated`
--     ajouté « par sécurité ». Reposer des droits sans vérifier ce qu'ils
--     étaient, c'est les inventer.
--
--  Règle : un helper préfixé `_` n'est JAMAIS appelé par le client. Il est
--  invoqué depuis des déclencheurs et des fonctions `SECURITY DEFINER`, qui
--  s'exécutent avec les droits du propriétaire — la révocation ne les gêne
--  donc pas. Aucun appel applicatif à ces quatre fonctions n'existe (vérifié
--  dans `src/`), le retrait est sans effet de bord.
--
--  Prérequis : migrations 013, 019, 112, 130, 147.
-- =====================================================================

-- --- 1. Refermer les helpers internes -------------------------------------
revoke execute on function public._notifier_parents(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public._notifier_etudiant(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public._notifier_parents_ecole(uuid, text, text, text)
  from public, anon, authenticated;

-- --- 2. Refermer `executer_relances`, rouverte par erreur en 147 ----------
--  L'interface passe par `relancer_tout()` (mig. 019), qui contrôle le rôle
--  puis restreint à `ecole_courante()`. Le cron, lui, s'exécute sans session
--  et n'a pas besoin de ce droit.
revoke execute on function public.executer_relances(uuid)
  from public, anon, authenticated;

-- --- 3. Défense en profondeur sur la primitive d'école --------------------
--  La révocation suffit aujourd'hui. Mais un `grant` distrait — celui que je
--  viens de faire — ne doit pas suffire à rouvrir la brèche : la garde de
--  rôle vit désormais DANS la fonction.
create or replace function public._notifier_parents_ecole(
  p_ecole uuid, p_titre text, p_msg text, p_categorie text default null)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n integer;
begin
  -- `auth.uid() is null` = appel système (cron, clé de service) : pas de
  -- session à contrôler. Sinon, l'appelant doit gérer CETTE école.
  if auth.uid() is not null
     and not (est_super_admin()
              or (p_ecole = ecole_courante()
                  and (est_admin() or a_role('direction')
                       or a_role('comptable') or a_role('secretaire')))) then
    raise exception 'Réservé à l''administration de l''établissement.';
  end if;

  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  select distinct p_ecole, t.profil_id, p_titre, p_msg, null::uuid, p_categorie
    from tuteurs t
   where t.ecole_id = p_ecole
     and t.profil_id is not null
     and exists (select 1 from eleve_tuteurs et where et.tuteur_id = t.id);
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

revoke execute on function public._notifier_parents_ecole(uuid, text, text, text)
  from public, anon, authenticated;

-- --- 4. Nettoyage des notifications créées pendant le sondage -------------
delete from notifications where titre like 'SONDAGE%';

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE — à rejouer avec une session de PARENT :
--    _notifier_parents, _notifier_etudiant, _notifier_parents_ecole,
--    executer_relances  → doivent TOUTES renvoyer 404 (fonction non exposée)
--  Et avec un compte de gestion :
--    relancer_tout()      → fonctionne toujours (wrapper de la mig. 019)
--    transport_notifier() → fonctionne toujours (garde interne)
--  Enfin : une note saisie doit continuer de notifier les parents — les
--  déclencheurs s'exécutent avec les droits du propriétaire.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- grant execute on function public._notifier_parents(uuid, uuid, text, text, text) to authenticated;
-- grant execute on function public._notifier_etudiant(uuid, text, text) to authenticated;
-- grant execute on function public._notifier_parents_ecole(uuid, text, text, text) to authenticated;
-- grant execute on function public.executer_relances(uuid) to authenticated;
--  (déconseillé : c'est exactement l'état qui rendait ces fonctions
--   appelables par tout compte connecté.)
