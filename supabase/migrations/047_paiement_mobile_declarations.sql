-- =====================================================================
--  047 — Paiement mobile : déclarations (mise sous version)
--
--  Ces 3 fonctions existaient en base mais n'avaient jamais été versionnées
--  (les migrations 020/021 n'ont pas été sauvegardées). Elles sont ici
--  reproduites À L'IDENTIQUE de la base de production, sans modification de
--  comportement, pour resynchroniser dépôt ↔ base.
--
--    declarer_paiement    — le parent déclare un paiement mobile (crée la
--                           déclaration en attente).
--    valider_declaration  — la comptabilité valide → encaisse (insère un
--                           paiement, le trigger recalc_facture solde la
--                           facture) et marque la déclaration 'valide'.
--    rejeter_declaration  — la comptabilité rejette la déclaration.
--
--  Dépendances : declarations_paiement (035/…), factures/paiements (001),
--  enum mode_paiement, helpers est_super_admin/est_gestion/a_role/
--  ecole_courante/_parent_possede.
-- =====================================================================

-- Déclaration par le parent --------------------------------------------------
create or replace function public.declarer_paiement(
  p_facture uuid, p_montant numeric, p_mode text, p_reference text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_eleve uuid; v_ecole uuid;
begin
  select eleve_id, ecole_id into v_eleve, v_ecole from factures where id = p_facture;
  if v_eleve is null then raise exception 'Facture introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx)
  values (v_ecole, p_facture, v_eleve, p_montant, p_mode::mode_paiement, p_reference);
end $$;

-- Validation (encaissement) par la comptabilité ------------------------------
create or replace function public.valider_declaration(p_decl uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from declarations_paiement where id = p_decl;
  if d is null then raise exception 'Déclaration introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (est_gestion() or a_role('comptable')) then raise exception 'Réservé à la comptabilité.'; end if;
  if d.statut <> 'en_attente' then raise exception 'Déclaration déjà traitée.'; end if;

  insert into paiements (ecole_id, facture_id, montant, mode, reference, encaisse_par)
  values (d.ecole_id, d.facture_id, d.montant, d.mode, d.reference_tx, auth.uid());

  update declarations_paiement set statut = 'valide', validee_par = auth.uid(), validee_le = now()
  where id = p_decl;
end $$;

-- Rejet par la comptabilité --------------------------------------------------
create or replace function public.rejeter_declaration(p_decl uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from declarations_paiement where id = p_decl;
  if d is null then raise exception 'Déclaration introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (est_gestion() or a_role('comptable')) then raise exception 'Réservé à la comptabilité.'; end if;
  update declarations_paiement set statut = 'rejete', validee_par = auth.uid(), validee_le = now()
  where id = p_decl;
end $$;

revoke execute on function public.declarer_paiement(uuid, numeric, text, text) from public, anon;
revoke execute on function public.valider_declaration(uuid) from public, anon;
revoke execute on function public.rejeter_declaration(uuid) from public, anon;
grant execute on function public.declarer_paiement(uuid, numeric, text, text) to authenticated;
grant execute on function public.valider_declaration(uuid) to authenticated;
grant execute on function public.rejeter_declaration(uuid) to authenticated;
