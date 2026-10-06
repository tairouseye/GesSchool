-- =====================================================================
--  179 — Troisième domaine basculé sur les cases : Documents & Demandes
--
--  Suite des migrations 177 (Comptabilité) et 178 (Cantine/Transport).
--  Même règle : on REMPLACE `a_role('x')` par `a_acces('clé')`, on ne met
--  pas les deux côte à côte.
--
--  ⚠️ CE DOMAINE EST LE PREMIER QUI N'EST PAS UNIFORME. `documents` porte
--  QUATRE policies, toutes différentes, et c'est voulu :
--    - lire   : la gestion, OU la personne qui doit signer ;
--    - créer  : beaucoup plus large — direction, RH, enseignant compris ;
--    - modifier : le signataire seul (c'est l'acte de validation) ;
--    - supprimer : la gestion.
--  Les écraser sous une seule garde aurait cassé trois choses. Chacune est
--  donc traitée pour ce qu'elle est.
-- =====================================================================

-- --- 1. Lire un document : la gestion, ou celui qui doit le signer -----
--
--  ⚠️ C'EST CETTE POLICY QUI A FAIT DE « À signer » UNE DÉRIVÉE ET NON UNE
--  CASE. `ACCES.signatures` vaut `"*"` : tout le personnel voit l'entrée
--  « À signer », et ce qu'il y voit est borné par
--  `signataire_profil = auth.uid()`. Fusionner « Documents » et « À signer »
--  en une case aurait donné l'écran Documents à tout enseignant pouvant
--  signer. La base distingue déjà les deux : on garde sa distinction.
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (a_acces('certificats') or signataire_profil = auth.uid()))
  );

-- --- 2. Créer un document : QUATRE domaines, et un verrou de statut ----
--
--  ⚠️ POURQUOI L'INSERTION EST SI LARGE, vérifié avant d'y toucher. Elle ne
--  sert pas qu'à l'écran « Documents » : `archiverDocument()`
--  ([src/lib/documents.js]) dépose une trace dans le registre GED depuis
--  QUATRE écrans — les bulletins (`bulletins.js`, donc direction et
--  enseignant), les paiements (`paiements.js`), la paie (`rh.js`) et les
--  certificats. D'où `direction`, `rh` et `enseignant` dans la policy
--  d'origine.
--
--  🔴 ET CET ARCHIVAGE EST « BEST-EFFORT » : il est appelé sans `await` et
--  ses erreurs sont AVALÉES. Resserrer cette insertion à la seule case
--  `certificats` n'aurait donc produit aucun message d'erreur — l'archivage
--  se serait simplement arrêté, en silence, pour les bulletins et la paie.
--  C'est le genre de régression qu'on ne découvre que des mois plus tard,
--  en cherchant un document qui n'a jamais été archivé.
--
--  La disjonction des quatre cases reproduit EXACTEMENT l'ensemble des rôles
--  d'avant, vérifié un par un contre `boites_du_modele` :
--    comptable → certificats · secretaire → certificats · direction →
--    notes_bulletins · enseignant → notes_bulletins · rh → rh.
--  Et ceux qui ne pouvaient pas insérer ne peuvent toujours pas :
--  `surveillant` (cahier, eleves, presence_vie) et `bibliothecaire` n'ont
--  aucune des quatre cases.
--
--  🔴 LE VERROU DE STATUT — un défaut trouvé en inventoriant ce domaine.
--  `verifier_document()` (le QR public d'authenticité) déclare authentique
--  tout document dont le statut vaut `valide`, `archive` ou `genere`. Or
--  l'insertion était ouverte à tout enseignant SANS contrainte de statut :
--  un appel REST direct permettait de créer un document déjà « validé »,
--  avec un titre, une référence et un montant choisis, que le QR public
--  présentait ensuite comme un document officiel de l'école.
--
--  VÉRIFIÉ AVANT DE CONTRAINDRE, dans la base et dans le code : aucun
--  chemin légitime n'insère `valide` ni `genere`. `creerDocument()` laisse
--  le défaut (`en_attente`) et `archiverDocument()` pose `archive` ; la
--  validation est un UPDATE fait par le signataire
--  ([documents.js](src/lib/documents.js) lignes 99 et 107), et
--  `documents_update` la réserve déjà à `signataire_profil = auth.uid()`.
--  La contrainte ci-dessous ne retire donc rien à personne.
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert with check (
    est_super_admin()
    or (ecole_id = ecole_courante()
        --  Un document ne NAÎT jamais déjà authentifiable.
        and statut in ('en_attente', 'archive')
        and (a_acces('certificats')      -- écran Documents officiels
          or a_acces('rh')               -- attestations de la paie
          or a_acces('notes_bulletins')  -- archivage des bulletins
          or a_acces('encaissement')))   -- archivage des factures et reçus
  );

-- --- 3. Supprimer : la gestion -----------------------------------------
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete using (
    est_super_admin() or (ecole_id = ecole_courante() and a_acces('certificats'))
  );

--  ⚠️ `documents_update` N'EST PAS TOUCHÉE, et c'est délibéré. Elle vaut
--  `est_admin() or signataire_profil = auth.uid()` : aucun rôle métier à
--  remplacer, et c'est elle qui porte l'acte de validation. La réécrire
--  pour « uniformiser » serait un refactoring sans nécessité.

-- --- 4. Les demandes de documents : aucune garde de rôle ---------------
--
--  🔴 TROUVÉ EN INVENTORIANT LE DOMAINE. `demandes_tenant` était
--  `for all` sur le seul `ecole_id = ecole_courante()`, SANS aucun prédicat
--  de rôle. Tout membre du personnel — enseignant, surveillant,
--  bibliothécaire — pouvait donc LIRE toutes les demandes de documents de
--  l'école et les MODIFIER : changer un statut, écrire une réponse, en
--  créer ou en supprimer. L'écran, lui, est réservé au comptable et au
--  secrétariat (`ACCES.demandes`). Encore un contrôle frontend pris pour
--  une sécurité, exactement comme le grand livre à la migration 177.
--
--  ⚠️ CECI RESSERRE DONC UN ACCÈS, et il faut le dire. Vérifié avant :
--  aucun compteur de tableau de bord ne lit cette table, et les familles ne
--  passent pas par elle — `demander_document` (parent, gardée par
--  `_parent_possede`), `demander_mon_document` et `mes_demandes_documents`
--  (étudiant, bornées par `_eleve_courant()`) et `mes_demandes` sont toutes
--  `security definer` et contournent la RLS par construction. Les resserrer
--  ici ne leur retire rien.
drop policy if exists demandes_tenant on public.demandes_documents;
drop policy if exists demandes_documents_acces on public.demandes_documents;
create policy demandes_documents_acces on public.demandes_documents
  for all
  using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('demandes')))
  with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('demandes')));

-- --- 5. La RPC du domaine ---------------------------------------------
--
--  Substitution explicite, qui ÉCHOUE bruyamment si la garde attendue n'est
--  pas trouvée (patron des migrations 177 et 178). `traiter_demande` garde
--  son contrôle d'établissement, qui est écrit à la main dans son corps.
do $$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'traiter_demande';
  if v_def is null then
    raise exception 'traiter_demande introuvable : ne pas basculer à l''aveugle.';
  end if;
  v_new := replace(v_def,
    'est_admin() or a_role(''comptable'') or a_role(''secretaire'')',
    'a_acces(''demandes'')');
  if v_new = v_def then
    raise exception 'Garde attendue introuvable dans traiter_demande.';
  end if;
  execute v_new;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop policy if exists documents_select on public.documents;
-- create policy documents_select on public.documents for select using (
--   est_super_admin() or ((ecole_id = ecole_courante()) and (est_admin()
--     or a_role('comptable') or a_role('secretaire') or signataire_profil = auth.uid())));
-- drop policy if exists documents_insert on public.documents;
-- create policy documents_insert on public.documents for insert with check (
--   est_super_admin() or ((ecole_id = ecole_courante()) and (est_admin()
--     or a_role('comptable') or a_role('secretaire') or a_role('direction')
--     or a_role('rh') or a_role('enseignant'))));
-- drop policy if exists documents_delete on public.documents;
-- create policy documents_delete on public.documents for delete using (
--   est_super_admin() or ((ecole_id = ecole_courante()) and (est_admin()
--     or a_role('comptable') or a_role('secretaire'))));
-- drop policy if exists demandes_documents_acces on public.demandes_documents;
-- create policy demandes_tenant on public.demandes_documents for all
--   using (est_super_admin() or (ecole_id = ecole_courante()))
--   with check (est_super_admin() or (ecole_id = ecole_courante()));
-- -- puis rétablir la garde de traiter_demande en remplaçant
-- -- a_acces('demandes') par est_admin() or a_role('comptable') or a_role('secretaire').
-- notify pgrst, 'reload schema';
