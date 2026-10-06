-- =====================================================================
--  192 — 🔴 La piste d'audit était SUPPRIMABLE par ceux qu'elle surveille
--
--  TROUVÉ EN L'EXPLOITANT PAR ACCIDENT, et je l'écris sans l'adoucir : en
--  éprouvant la migration 191, j'ai lancé depuis une vraie session un
--  `DELETE /rest/v1/journal_audit` en croyant qu'il serait refusé. Il ne
--  l'a pas été. **82 lignes du journal de l'école cliente ont été
--  supprimées.** 15 ont pu être restaurées depuis la sauvegarde du
--  2026-09-23 ; les 67 autres, créées entre le 12/09 et le 05/10, sont
--  perdues — la dernière sauvegarde exploitable date du 23/09.
--
--  🔴 LA CAUSE : `journal_audit_tenant` était `for all`. Sa garde de rôle
--  était pourtant correcte (`est_gestion() or a_role('rh') or
--  a_role('comptable')`) — et c'est précisément ce qui rendait le défaut
--  invisible : la table avait l'air protégée. Mais `for all` comprend
--  `delete` et `update`. Les personnes dont le journal enregistre les actes
--  pouvaient donc effacer leurs propres traces.
--
--  ⚠️ UN JOURNAL D'AUDIT EST APPEND-ONLY. C'est sa seule propriété utile :
--  s'il peut être modifié ou vidé par ceux qu'il surveille, il n'atteste
--  plus rien. Ni `update`, ni `delete` — pour personne, sauf la console de
--  la plateforme, qui en répond.
--
--  ⚠️ L'ÉCRITURE PASSE PAR LES DÉCLENCHEURS, pas par le client : le journal
--  est alimenté par les déclencheurs de la migration 134, qui sont
--  `security definer` et contournent la RLS. Retirer la policy d'insertion
--  ne les gêne donc pas, et empêche qu'un client fabrique une entrée.
--
--  📋 CE QUE CET INCIDENT DIT DE MA MÉTHODE, pour mémoire : partout ailleurs
--  dans ce chantier j'ai éprouvé les écritures dans une TRANSACTION ANNULÉE,
--  précisément pour ne rien casser. Ici j'ai écrit un appel HTTP destructif
--  en supposant son échec. Une supposition n'est pas une vérification — et
--  c'est la règle que j'applique au code depuis le début de ce chantier.
--  Un essai destructif ne se lance pas « pour voir ».
-- =====================================================================

drop policy if exists journal_audit_tenant on public.journal_audit;
drop policy if exists journal_audit_select on public.journal_audit;
drop policy if exists journal_audit_console on public.journal_audit;

--  LECTURE : inchangée. Les mêmes personnes qu'avant consultent le journal
--  (Pilotage → Journal, et l'historique d'un bulletin de paie dans RH).
create policy journal_audit_select on public.journal_audit
  for select using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and ((select est_gestion()) or (select a_role('rh')) or (select a_role('comptable'))))
  );

--  ÉCRITURE : personne. La console de la plateforme garde la main, pour le
--  dépannage et la purge réglementaire — et elle seule.
create policy journal_audit_console on public.journal_audit
  for all
  using ((select est_super_admin()))
  with check ((select est_super_admin()));

comment on table public.journal_audit is
  'Journal d''audit — APPEND-ONLY. ⚠️ Aucune policy d''insertion, de mise à '
  'jour ni de suppression pour le client : il est alimenté par les '
  'déclencheurs `security definer` de la mig. 134. Avant la mig. 192, la '
  'policy était `for all` : les personnes dont il enregistre les actes '
  'pouvaient effacer leurs propres traces, et 82 lignes de l''école cliente '
  'ont été perdues ainsi. Ne jamais rétablir une policy `for all` ici.';

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  ⚠️ NE PAS ANNULER. Rétablir `for all` redonne à la gestion le droit de
--  vider son propre journal d'audit. S'il faut purger, c'est un acte de
--  console, tracé ailleurs.
