-- =====================================================================
--  191 — Cinq tables qu'aucun écran n'écrit, et que tout le monde pouvait
--        écrire quand même
--
--  Suite du balayage de la migration 186. Ces cinq-là ne sont pas de la
--  pédagogie : elles portent la piste d'audit, l'abonnement commercial, le
--  calendrier scolaire et les notifications des familles. Toutes avaient
--  UNE policy `for all` avec pour seul prédicat `ecole_id = ecole_courante()`.
--
--  🔴 CE QUE N'IMPORTE QUEL MEMBRE DU PERSONNEL POUVAIT FAIRE :
--    • `audit_log`         → SUPPRIMER la piste d'audit, donc effacer ses
--                            propres traces ;
--    • `abonnements`       → changer l'abonnement de son école, donc
--                            débloquer les modules payants ou repousser la
--                            date de fin ;
--    • `annees_scolaires`  → supprimer une année scolaire, avec ce qu'elle
--                            entraîne en cascade ;
--    • `notifications`     → LIRE toutes les notifications de l'école, y
--                            compris celles adressées aux parents — qui
--                            contiennent des notes, des rappels d'impayés et
--                            des faits de discipline ;
--    • `matricule_compteurs` → consommer ou réinitialiser la numérotation.
--
--  ⚠️ VÉRIFIÉ AVANT DE FERMER, et c'est ce qui rend ce lot sans risque :
--  AUCUN écran n'écrit dans ces tables. Mesuré, pas supposé :
--    - `audit_log`, `abonnements`, `matricule_compteurs` : zéro occurrence
--      dans tout `src/` ;
--    - `annees_scolaires` : deux occurrences, toutes deux des `.select("*")` ;
--    - `notifications` : lue par `parent.js` et `etudiant.js`, toujours
--      bornée à `destinataire_id = auth.uid()` (explicitement, ou par la
--      policy `notifications_self`), et le personnel ne la lit PAS du tout —
--      il n'y a pas de cloche côté Gestion.
--  Toutes les écritures légitimes passent par des fonctions
--  `security definer` : `admin_set_abonnement`, `admin_set_statut`,
--  `ouvrir_annee_scolaire`, `supprimer_annee_scolaire`,
--  `creer_ecole_et_admin`, `prochain_matricule`, et les neuf émetteurs de
--  notifications (`_notifier_parents`, `executer_relances`, `relancer_eleve`,
--  `traiter_demande`, `transport_notifier`…). Elles contournent la RLS par
--  construction.
-- =====================================================================

-- --- 1. `audit_log` : une table MORTE, laissée ouverte ----------------
--
--  ⚠️ ELLE EST VIDE ET PLUS PERSONNE NE L'ÉCRIT : 0 ligne, aucune fonction
--  ne la mentionne, aucun écran ne la lit. La journalisation réelle est dans
--  `journal_audit` (249 lignes, migration 134), qui est correctement
--  restreinte par rôle. `audit_log` est un reste de la première version.
--
--  On ne la SUPPRIME pas — effacer une table n'est pas la même décision que
--  la fermer, et rien ne presse. On la verrouille et on dit pourquoi.
drop policy if exists audit_log_tenant on public.audit_log;
create policy audit_log_console on public.audit_log
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

comment on table public.audit_log is
  'OBSOLÈTE : remplacée par `journal_audit` (mig. 134), qui porte la vraie '
  'journalisation et sa restriction par rôle. Vide et sans écrivain depuis. '
  'Verrouillée à la console en mig. 191 — elle était modifiable par tout '
  'membre du personnel, qui pouvait donc effacer une piste d''audit.';

-- --- 2. `abonnements` : le contrat commercial ------------------------
--
--  La lecture reste ouverte à l'établissement : l'écran « Mon abonnement »
--  passe par `mon_abonnement()` (DEFINER), mais d'autres lectures peuvent
--  en dépendre et la fermer n'apporterait rien. L'ÉCRITURE, elle, est un
--  acte commercial : elle appartient à la console de la plateforme.
drop policy if exists abonnements_tenant on public.abonnements;
create policy abonnements_select on public.abonnements
  for select using ((select est_super_admin()) or ecole_id = (select ecole_courante()));
create policy abonnements_ecrire on public.abonnements
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

-- --- 3. `annees_scolaires` : lire partout, n'écrire qu'en haut --------
--
--  ⚠️ LA LECTURE DOIT RESTER LARGE : l'année courante est lue par presque
--  tous les écrans (inscriptions, bulletins, factures, appel…). La fermer
--  casserait l'application entière. L'écriture appartient au promoteur, qui
--  ouvre et clôture les années depuis Passage d'année.
drop policy if exists annees_scolaires_tenant on public.annees_scolaires;
create policy annees_scolaires_select on public.annees_scolaires
  for select using ((select est_super_admin()) or ecole_id = (select ecole_courante()));
create policy annees_scolaires_ecrire on public.annees_scolaires
  for all
  using ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and (select est_admin())))
  with check ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and (select est_admin())));

-- --- 4. `matricule_compteurs` : la numérotation ----------------------
--
--  Écrite uniquement par `prochain_matricule()` (DEFINER), elle-même
--  cloisonnée depuis la migration 186. Personne n'a à y toucher en direct :
--  réinitialiser un compteur ferait doublonner des matricules.
drop policy if exists matricule_compteurs_tenant on public.matricule_compteurs;
create policy matricule_compteurs_console on public.matricule_compteurs
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

-- --- 5. `notifications` : chacun les siennes -------------------------
--
--  🔴 LE DÉFAUT LE PLUS SENSIBLE DU LOT. `notifications_tenant` était
--  `for all` sur le seul établissement : tout membre du personnel lisait
--  donc TOUTES les notifications de l'école, y compris celles adressées aux
--  familles — « Votre enfant a obtenu 12/20 », « 45 000 F restent dus »,
--  « votre enfant a été pris en charge par le bus ». Une secrétaire, un
--  bibliothécaire, un enseignant : tous.
--
--  Les deux policies `self` existaient déjà et suffisent : chacun lit et
--  marque comme lues SES notifications. On retire celle de trop.
--
--  ⚠️ IL N'Y A PLUS DE POLICY D'INSERTION, et c'est volontaire : les neuf
--  émetteurs sont tous `security definer`. Un écran qui voudrait créer une
--  notification en direct devrait passer par une RPC — ce qui est la bonne
--  façon, puisqu'une notification désigne un destinataire qu'on n'a pas à
--  choisir librement.
drop policy if exists notifications_tenant on public.notifications;
drop policy if exists notifications_self on public.notifications;
drop policy if exists notifications_self_maj on public.notifications;

create policy notifications_self on public.notifications
  for select using (destinataire_id = (select auth.uid()));
create policy notifications_self_maj on public.notifications
  for update using (destinataire_id = (select auth.uid()))
         with check (destinataire_id = (select auth.uid()));
--  La console de la plateforme garde la main, pour le dépannage.
create policy notifications_console on public.notifications
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

comment on table public.notifications is
  'Notifications in-app. ⚠️ Chacun ne lit QUE les siennes '
  '(`destinataire_id = auth.uid()`) : une policy ouverte à l''établissement '
  'laissait tout le personnel lire les notes, les impayés et les faits de '
  'discipline adressés aux familles (mig. 191). Les émetteurs sont tous '
  '`security definer` — pas de policy d''insertion, et c''est voulu.';

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; begin
--   foreach t in array array['audit_log','abonnements','annees_scolaires',
--                            'matricule_compteurs','notifications'] loop
--     execute format('drop policy if exists %1$s_console on public.%1$I;', t);
--     execute format('drop policy if exists %1$s_select on public.%1$I;', t);
--     execute format('drop policy if exists %1$s_ecrire on public.%1$I;', t);
--     execute format($p$create policy %1$s_tenant on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante()))
--       with check (est_super_admin() or (ecole_id = ecole_courante()));$p$, t);
--   end loop; end $$;
-- -- ⚠️ Annuler rouvre la lecture des notifications des familles à tout le
-- -- personnel, et la suppression de la piste d'audit.
-- notify pgrst, 'reload schema';
