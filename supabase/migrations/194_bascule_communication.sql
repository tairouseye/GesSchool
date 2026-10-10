-- =====================================================================
--  194 — Communication : annonces et messagerie
--
--  🔴 `annonces` ÉTAIT LA DERNIÈRE TABLE DONT L'ÉCRITURE RESTAIT OUVERTE À
--  TOUT LE PERSONNEL. `annonces_tenant` était `for all` sur le seul
--  établissement : un enseignant, un surveillant, un bibliothécaire pouvait
--  **publier une annonce au nom de l'établissement** — lue par toutes les
--  familles visées — ou **supprimer** celles de la direction. L'écran, lui,
--  est réservé à la direction, au comptable et au secrétariat
--  (`ACCES.annonces`).
--
--  `messages` était déjà correctement restreinte (`est_admin() or direction
--  or comptable or secretaire`) : c'est exactement `ACCES.messagerie`, donc
--  une traduction 1 pour 1.
--
--  ⚠️ LES FAMILLES NE PASSENT PAR AUCUNE DE CES DEUX POLICIES, vérifié avant :
--  `annonces_enfant`, `annonces_parent`, `ecole_fil_parent`,
--  `ecole_envoyer_parent`, `etudiant_envoyer`,
--  `mes_messages_non_lus_etudiant` sont toutes `security definer` et
--  contournent la RLS. Et aucun accueil ne lit ces tables en direct : le
--  compteur d'annonces de l'espace parent vient de `mes_enfants`.
-- =====================================================================

-- --- 1. Les annonces --------------------------------------------------
--
--  ⚠️ LE PÉRIMÈTRE EST PLUS SUBTIL ICI QUE PARTOUT AILLEURS, parce qu'une
--  annonce se cible de quatre façons : l'établissement entier (aucune des
--  trois colonnes), un cycle, un niveau, ou une classe. Une responsable
--  cloisonnée doit voir **son cycle ET les annonces générales** — sinon elle
--  perdrait les communications de l'école, ce qui n'a aucun sens.
--
--  Un `classe_id`/`niveau_id`/`cycle_id` tous nuls signifie donc « tout
--  l'établissement » et reste visible. Les trois autres cas sont comparés au
--  périmètre, le niveau par remontée vers son cycle.
drop policy if exists annonces_tenant on public.annonces;
drop policy if exists annonces_select on public.annonces;
drop policy if exists annonces_acces on public.annonces;
create policy annonces_acces on public.annonces
  for all
  using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and (select a_acces('annonces'))
        and ((select classes_autorisees()) is null
             or (classe_id is null and niveau_id is null and cycle_id is null)
             or classe_id = any((select classes_autorisees())::uuid[])
             or cycle_id = any((select cycles_autorises())::uuid[])
             or exists (select 1 from niveaux n
                         where n.id = annonces.niveau_id
                           and n.cycle_id = any((select cycles_autorises())::uuid[]))))
  )
  with check (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and (select a_acces('annonces'))
        and ((select classes_autorisees()) is null
             or (classe_id is null and niveau_id is null and cycle_id is null)
             or classe_id = any((select classes_autorisees())::uuid[])
             or cycle_id = any((select cycles_autorises())::uuid[])
             or exists (select 1 from niveaux n
                         where n.id = annonces.niveau_id
                           and n.cycle_id = any((select cycles_autorises())::uuid[]))))
  );

-- --- 2. La messagerie -------------------------------------------------
--
--  ⚠️ UN FIL SE RATTACHE SOIT À UN ÉLÈVE, SOIT À UN TUTEUR — les deux
--  colonnes sont nullables, et c'est ce qui rend le périmètre non trivial.
--  Pour un fil de parent (`tuteur_id` renseigné, `eleve_id` nul), le
--  cloisonnement se résout en remontant aux ENFANTS de ce tuteur : si l'un
--  d'eux est dans le périmètre, la conversation y est aussi. Sans cette
--  remontée, une responsable cloisonnée aurait vu TOUS les fils de parents de
--  l'école — c'est-à-dire l'essentiel de la table.
drop policy if exists messages_gestion on public.messages;
drop policy if exists messages_acces on public.messages;
create policy messages_acces on public.messages
  for all
  using (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and (select a_acces('messagerie'))
        and ((select classes_autorisees()) is null
             or (eleve_id is not null and peut_voir_eleve(eleve_id))
             or (tuteur_id is not null
                 and exists (select 1 from eleve_tuteurs et
                              where et.tuteur_id = messages.tuteur_id
                                and peut_voir_eleve(et.eleve_id)))))
  )
  with check (
    (select est_super_admin())
    or (ecole_id = (select ecole_courante())
        and (select a_acces('messagerie'))
        and ((select classes_autorisees()) is null
             or (eleve_id is not null and peut_voir_eleve(eleve_id))
             or (tuteur_id is not null
                 and exists (select 1 from eleve_tuteurs et
                              where et.tuteur_id = messages.tuteur_id
                                and peut_voir_eleve(et.eleve_id)))))
  );

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop policy if exists annonces_acces on public.annonces;
-- create policy annonces_tenant on public.annonces for all
--   using (est_super_admin() or (ecole_id = ecole_courante()))
--   with check (est_super_admin() or (ecole_id = ecole_courante()));
-- drop policy if exists messages_acces on public.messages;
-- create policy messages_gestion on public.messages for all
--   using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--          or a_role('direction') or a_role('comptable') or a_role('secretaire'))))
--   with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--          or a_role('direction') or a_role('comptable') or a_role('secretaire'))));
-- ⚠️ Annuler rouvre la publication d'annonces au nom de l'établissement à
-- tout le personnel.
-- notify pgrst, 'reload schema';
