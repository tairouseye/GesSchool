-- =====================================================================
--  198 — Une déclaration de paiement sans preuve ne doit pas partir
--
--  🔴 LE DÉFAUT, SIGNALÉ PAR LE PROMOTEUR ET VÉRIFIÉ EN BASE. Une déclaration
--  de 65 000 F existe chez Tut'Tank (Nafissatou KANE, Wave, 09/10 09h37) avec
--  **aucune preuve ET une référence de transaction vide** : rien ne permet de
--  la vérifier, et elle attend validation. La caisse n'a qu'un montant et un
--  nom.
--
--  ⚠️ CE N'EST PAS UN CONTOURNEMENT, C'EST L'APPLICATION QUI L'INVITE : le
--  formulaire parent étiquette le fichier « Preuve de paiement (capture /
--  photo — **optionnel**) », et son seul contrôle est `!montant`. Côté base,
--  `declarer_paiement` n'exigeait rien du tout — pas même un montant positif,
--  alors que la version étudiante le vérifie. On corrige les DEUX versants,
--  parce qu'un contrôle d'écran ne protège rien (règle du projet).
--
--  Quatre règles, côté serveur :
--    1. une PREUVE est obligatoire ;
--    2. le montant doit être positif ;
--    3. il ne peut pas dépasser le reste dû de la facture ;
--    4. une déclaration identique déjà en attente est refusée — c'est le cas
--       réel du parent qui, ne voyant rien se passer, déclare deux fois.
--
--  ⚠️ ET UN SECOND DÉFAUT TROUVÉ EN MESURANT : **un étudiant ne pouvait pas
--  joindre de preuve, du tout.** `declarer_mon_paiement` n'avait aucun
--  paramètre pour ça, et la policy `preuves_insert` exige
--  `_parent_possede(...)` — or un étudiant n'est pas un parent. Exiger la
--  preuve sans ouvrir ce chemin aurait rendu TOUTE déclaration étudiante
--  impossible. Les deux sont corrigés ici, sinon le correctif serait un
--  blocage.
--
--  ⚠️ LA DÉCLARATION EXISTANTE N'EST PAS TOUCHÉE. Elle reste `en_attente` et
--  devient **non validable** — ce qui est précisément demandé. L'école la
--  traite avec `rejeter_declaration` (qui existe déjà), et le parent la
--  refait avec sa capture. Aucune donnée n'est supprimée ni réécrite.
-- =====================================================================

-- --- 1. Un étudiant peut déposer SA preuve ----------------------------
--
--  Sans cette policy, exiger la preuve rendrait les déclarations étudiantes
--  impossibles. `_eleve_courant()` est le dossier de l'appelant : un étudiant
--  ne peut donc écrire que dans SON dossier, jamais dans celui d'un autre.
--  `_preuve_eleve(name)` est fail-closed (NULL si le chemin n'est pas conforme),
--  donc un chemin bricolé ne passe pas.
drop policy if exists preuves_insert on storage.objects;
create policy preuves_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'preuves'
    and (_parent_possede(_preuve_eleve(name))
         or _preuve_eleve(name) = _eleve_courant())
  );

--  Et il relit la sienne — même raisonnement, et c'est son propre fichier.
drop policy if exists preuves_select on storage.objects;
create policy preuves_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'preuves'
    and (_parent_possede(_preuve_eleve(name))
         or _preuve_eleve(name) = _eleve_courant()
         or exists (select 1 from eleves e
                     where e.id = _preuve_eleve(storage.objects.name)
                       and (est_super_admin() or e.ecole_id = ecole_courante())))
  );

-- --- 2. Le garde commun, pour ne pas écrire la règle deux fois --------
--
--  Les deux versants (parent, étudiant) doivent appliquer les MÊMES règles.
--  Les écrire deux fois, c'est accepter qu'elles divergent — et elles avaient
--  déjà divergé : la version étudiante vérifiait le montant, la version
--  parent non.
create or replace function public._verifier_declaration(
  p_facture uuid, p_montant numeric, p_preuve text)
returns void
language plpgsql stable security definer set search_path = public as $fn$
declare v_reste numeric; v_attente numeric;
begin
  --  1. La preuve. C'est la demande du promoteur : sans elle, la caisse n'a
  --  rien à vérifier.
  if coalesce(trim(p_preuve), '') = '' then
    raise exception 'Joignez la capture ou la photo de votre paiement : sans preuve, l''école ne peut pas le vérifier.';
  end if;
  --  2. Le montant.
  if coalesce(p_montant, 0) <= 0 then
    raise exception 'Montant invalide.';
  end if;
  --  3. Le reste dû. Déclarer plus que ce qui reste n'a pas de sens, et la
  --  validation créerait un paiement supérieur à la facture.
  select greatest(coalesce(f.montant_total, 0) - coalesce(f.montant_paye, 0), 0)
    into v_reste from factures f where f.id = p_facture;
  if p_montant > v_reste then
    raise exception 'Le reste dû sur cette facture est de %.', trunc(v_reste);
  end if;
  --  4. Le doublon. Cas réel : le parent ne voit rien se passer (la validation
  --  est manuelle) et déclare une deuxième fois. Les deux seraient validées.
  select coalesce(sum(d.montant), 0) into v_attente
    from declarations_paiement d
   where d.facture_id = p_facture and d.statut = 'en_attente';
  if v_attente + p_montant > v_reste then
    raise exception 'Une déclaration de % est déjà en attente de validation sur cette facture.',
                    trunc(v_attente);
  end if;
end $fn$;

revoke execute on function public._verifier_declaration(uuid, numeric, text)
  from public, anon;
grant execute on function public._verifier_declaration(uuid, numeric, text)
  to authenticated;

-- --- 3. Le versant PARENT ---------------------------------------------
create or replace function public.declarer_paiement(
  p_facture uuid, p_montant numeric, p_mode text, p_reference text,
  p_preuve text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_eleve uuid; v_ecole uuid;
begin
  select eleve_id, ecole_id into v_eleve, v_ecole from factures where id = p_facture;
  if v_eleve is null then raise exception 'Facture introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  perform public._verifier_declaration(p_facture, p_montant, p_preuve);

  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin)
  values (v_ecole, p_facture, v_eleve, p_montant, p_mode::mode_paiement, p_reference, p_preuve);
end $fn$;

-- --- 4. Le versant ÉTUDIANT -------------------------------------------
--
--  ⚠️ `drop` PUIS `create`, ET C'EST ESSENTIEL : ajouter un paramètre crée une
--  SURCHARGE, elle ne remplace pas. L'ancienne signature à 4 arguments
--  resterait appelable — c'est-à-dire que le chemin SANS preuve resterait
--  grand ouvert, et le correctif ne protégerait rien. Un paramètre avec
--  `default` ne résoudrait pas le problème non plus : l'appel à 4 arguments
--  deviendrait ambigu.
drop function if exists public.declarer_mon_paiement(uuid, numeric, text, text);
create function public.declarer_mon_paiement(
  p_facture uuid, p_montant numeric, p_mode text, p_reference text, p_preuve text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_eleve uuid; v_ecole uuid; v_moi uuid := _eleve_courant();
begin
  if v_moi is null then raise exception 'Compte étudiant non rattaché à une fiche.'; end if;

  select f.eleve_id, f.ecole_id into v_eleve, v_ecole from factures f where f.id = p_facture;
  if v_eleve is null then raise exception 'Facture introuvable.'; end if;
  if v_eleve <> v_moi then raise exception 'Cette facture ne vous concerne pas.'; end if;
  perform public._verifier_declaration(p_facture, p_montant, p_preuve);

  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin)
  values (v_ecole, p_facture, v_moi, p_montant, p_mode::mode_paiement, p_reference, p_preuve);
end $fn$;

revoke execute on function public.declarer_mon_paiement(uuid, numeric, text, text, text)
  from public, anon;
grant execute on function public.declarer_mon_paiement(uuid, numeric, text, text, text)
  to authenticated;

-- --- 5. La caisse ne valide pas une déclaration invérifiable ----------
--
--  Le dernier maillon : sans ce contrôle, les déclarations déjà déposées sans
--  preuve (dont celle de Tut'Tank) resteraient validables, et deviendraient
--  de vrais paiements. L'école les traite avec `rejeter_declaration`.
--
--  ⚠️ LE CONTRÔLE DE MONTANT EST AJOUTÉ ICI AUSSI, et pas seulement au dépôt :
--  une déclaration peut avoir été déposée avant cette migration, quand rien
--  n'était vérifié. Le valider créerait un paiement supérieur à la facture.
create or replace function public.valider_declaration(p_decl uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare d record; v_reste numeric;
begin
  select * into d from declarations_paiement where id = p_decl;
  if d is null then raise exception 'Déclaration introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (a_acces('encaissement')) then raise exception 'Réservé à la comptabilité.'; end if;
  if d.statut <> 'en_attente' then raise exception 'Déclaration déjà traitée.'; end if;
  if coalesce(trim(d.preuve_chemin), '') = '' then
    raise exception 'Cette déclaration ne porte aucune preuve : refusez-la et demandez la capture du paiement.';
  end if;
  select greatest(coalesce(f.montant_total, 0) - coalesce(f.montant_paye, 0), 0)
    into v_reste from factures f where f.id = d.facture_id;
  if d.montant > v_reste then
    raise exception 'Le montant déclaré (%) dépasse le reste dû (%).', trunc(d.montant), trunc(v_reste);
  end if;

  insert into paiements (ecole_id, facture_id, montant, mode, reference, encaisse_par)
  values (d.ecole_id, d.facture_id, d.montant, d.mode, d.reference_tx, auth.uid());

  update declarations_paiement set statut = 'valide', validee_par = auth.uid(), validee_le = now() where id = p_decl;
end $fn$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  ⚠️ Annuler rouvre le dépôt de déclarations invérifiables ET leur
--  validation en vrais paiements.
-- drop function if exists public._verifier_declaration(uuid, numeric, text);
-- drop function if exists public.declarer_mon_paiement(uuid, numeric, text, text, text);
-- -- puis restaurer `declarer_paiement`, `declarer_mon_paiement` (4 arguments),
-- -- `valider_declaration` et les deux policies `preuves_*` depuis les
-- -- migrations qui les ont créées (072 pour le storage, 113 pour l'étudiant).
-- notify pgrst, 'reload schema';
