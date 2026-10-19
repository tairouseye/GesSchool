-- =====================================================================
--  207 — Une facture annulée ne se paie plus, côté base aussi
--
--  Demandé le 19/10/2026, à la suite de la mig. 206 : l'espace parent ne
--  propose plus de payer une facture annulée, mais la BASE l'acceptait encore.
--  Un appel direct à la RPC, ou un écran ancien resté en cache, pouvait donc
--  déclarer un paiement sur une facture annulée ; la caisse aurait ensuite pu
--  le valider et encaisser sur une dette qui n'existe plus.
--
--  Deux garde-fous :
--   • `_verifier_declaration` (mig. 198), le contrôle COMMUN aux déclarations
--     parent (`declarer_paiement`) et étudiant (`declarer_mon_paiement`) :
--     refuse une facture annulée ou encore en brouillon. Les deux appelants
--     en profitent sans être réécrits.
--   • `valider_declaration` (mig. 202) : une déclaration déposée AVANT
--     l'annulation ne peut plus être validée — la caisse la rejette, avec un
--     motif. Le reste de la fonction est repris à l'identique.
--
--  Le paiement en ligne (fonction `paiement`, action « initier ») porte le
--  même refus, côté TypeScript : il lit la facture lui-même.
--
--  🔴 UN DROIT EST RETIRÉ, AUCUN N'EST AJOUTÉ. `_verifier_declaration`
--  était exécutable par tout utilisateur connecté (mig. 198). Appelée
--  directement avec un montant énorme, elle répondait « Le reste dû sur cette
--  facture est de … » pour N'IMPORTE QUELLE facture, d'une autre école
--  comprise — et, avec le contrôle ajouté ici, aurait dit en plus si elle est
--  annulée. Elle n'est qu'une brique interne : ses deux appelants vérifient
--  l'accès AVANT de l'appeler, et s'exécutent avec les droits de leur
--  propriétaire. On lui retire donc l'exécution pour `authenticated`.
--  `valider_declaration` garde ses droits (create or replace les conserve).
--  Aucune policy RLS n'est touchée.
-- =====================================================================

create or replace function public._verifier_declaration(
  p_facture uuid, p_montant numeric, p_preuve text)
returns void
language plpgsql stable security definer set search_path = public as $fn$
declare v_reste numeric; v_attente numeric; v_statut text;
begin
  --  0. La facture elle-même. Annulée, elle ne doit plus rien ; en brouillon,
  --  elle n'a pas encore été émise. Dans les deux cas, rien à payer.
  select f.statut::text into v_statut from factures f where f.id = p_facture;
  if v_statut = 'annulee' then
    raise exception 'Cette facture a été annulée : elle ne se paie plus.';
  end if;
  if v_statut = 'brouillon' then
    raise exception 'Cette facture n''a pas encore été émise par l''école.';
  end if;
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

create or replace function public.valider_declaration(p_decl uuid)
returns void
language plpgsql security definer set search_path = public as $function$
declare d record; v_reste numeric; v_fac uuid; v_statut text;
begin
  select * into d from declarations_paiement where id = p_decl;
  if d is null then raise exception 'Déclaration introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (a_acces('encaissement')) then raise exception 'Réservé à la comptabilité.'; end if;
  if d.statut <> 'en_attente' then raise exception 'Déclaration déjà traitée.'; end if;
  if coalesce(trim(d.preuve_chemin), '') = '' then
    raise exception 'Cette déclaration ne porte aucune preuve : refusez-la et demandez la capture du paiement.';
  end if;

  --  Paiement anticipé : la facture naît ici, déjà réglée.
  if d.facture_id is null then
    if d.avance_lignes is null then raise exception 'Déclaration sans objet.'; end if;
    v_fac := public._creer_facture_avance(d.eleve_id, d.avance_lignes, d.mode, d.reference_tx, null);
    update declarations_paiement
       set statut = 'valide', facture_id = v_fac, validee_par = auth.uid(), validee_le = now()
     where id = p_decl;
    return;
  end if;

  --  🔴 Mig. 207 : la facture a pu être annulée APRÈS la déclaration.
  select f.statut::text into v_statut from factures f where f.id = d.facture_id;
  if v_statut = 'annulee' then
    raise exception 'La facture de cette déclaration a été annulée : refusez la déclaration, en indiquant le motif au parent.';
  end if;

  select greatest(coalesce(f.montant_total, 0) - coalesce(f.montant_paye, 0), 0)
    into v_reste from factures f where f.id = d.facture_id;
  if d.montant > v_reste then
    raise exception 'Le montant déclaré (%) dépasse le reste dû (%).', trunc(d.montant), trunc(v_reste);
  end if;

  insert into paiements (ecole_id, facture_id, montant, mode, reference, encaisse_par)
  values (d.ecole_id, d.facture_id, d.montant, d.mode, d.reference_tx, auth.uid());

  update declarations_paiement set statut = 'valide', validee_par = auth.uid(), validee_le = now() where id = p_decl;
end $function$;

-- Brique interne : plus d'appel direct depuis l'application. ------------------
revoke execute on function public._verifier_declaration(uuid, numeric, text)
  from public, anon, authenticated;
