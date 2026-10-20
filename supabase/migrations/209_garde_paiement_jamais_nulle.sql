-- =====================================================================
--  209 — Garde « qui peut payer pour cet élève » : jamais NULL
--
--  ⚠️ FAILLE CONSTATÉE (essai_208_parent.sql + diagnostic_208_avance.sql,
--  20/10/2026) : un parent obtenait `avance_options` d'un élève d'une
--  AUTRE famille.
--
--  Cause : pour un compte qui n'est pas un élève, `_eleve_courant()` vaut
--  NULL, donc `_eleve_courant() = p_eleve` vaut NULL, et
--      false OR NULL OR false  =  NULL.
--  `if not NULL then raise …` n'est pas vrai : l'exception « Accès refusé »
--  n'était JAMAIS levée. La garde échouait OUVERTE.
--
--  Touchés :
--   - `_peut_payer_pour` (mig. 202) → `avance_options` : lecture des mois
--     et des tarifs restant dus d'un élève quelconque (uuid connu) ;
--   - `declarer_avance` (mig. 202, reprise en 208) : même test en ligne →
--     déclaration d'un paiement anticipé pour l'enfant d'une autre famille.
--     La 208 exige une preuve dans le dossier de cet élève, mais elle ne
--     vérifie pas l'existence du fichier : le chemin seul suffisait.
--
--  Correctif : `coalesce(…, false)` sur la comparaison ET sur le résultat.
--  Aucun changement de règle métier : les mêmes quatre ayants droit
--  (parent lié, élève lui-même, super-admin, caisse dans son périmètre).
--  Non destructif : deux `create or replace`, mêmes signatures, mêmes droits.
-- =====================================================================

-- --- 1. Qui peut voir et payer pour cet élève (corps de la 202) ---------
create or replace function public._peut_payer_pour(p_eleve uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(p_eleve is not null and (
    public._parent_possede(p_eleve)
    --  NULL pour un compte qui n'est pas un élève : sans coalesce, tout
    --  le OR devenait NULL et la garde laissait passer.
    or coalesce(public._eleve_courant() = p_eleve, false)
    or exists (
      select 1 from eleves e
       where e.id = p_eleve
         and (public.est_super_admin()
              or (e.ecole_id = public.ecole_courante()
                  and public.a_acces('encaissement')
                  and public.peut_voir_eleve(p_eleve))))
  ), false);
$fn$;
revoke execute on function public._peut_payer_pour(uuid) from public, anon, authenticated;


-- --- 2. Déclarer un paiement anticipé (corps de la 208) -----------------
create or replace function public.declarer_avance(
  p_eleve uuid, p_mois text[], p_mode text, p_reference text, p_preuve text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_lignes jsonb; v_total numeric;
begin
  --  ⚠️ `coalesce` : sans lui, un parent d'une autre famille donnait
  --  `false OR NULL` = NULL, et `if not NULL` ne levait rien (mig. 209).
  if not coalesce(public._parent_possede(p_eleve) or public._eleve_courant() = p_eleve, false) then
    raise exception 'Accès refusé.';
  end if;
  if coalesce(trim(p_preuve), '') = '' then
    raise exception 'Joignez la capture ou la photo de votre paiement : sans preuve, l''école ne peut pas le vérifier.';
  end if;
  if not public._preuve_de_eleve(p_preuve, p_eleve) then
    raise exception 'La preuve jointe n''est pas valide : téléversez à nouveau la capture du paiement.';
  end if;

  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  v_lignes := public._lignes_des_mois(p_eleve, p_mois);
  select sum((x->>'montant')::numeric) into v_total from jsonb_array_elements(v_lignes) x;
  if coalesce(v_total, 0) <= 0 then raise exception 'Montant invalide.'; end if;

  insert into declarations_paiement
    (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin, avance_lignes, declare_par)
  values
    (v_ecole, null, p_eleve, v_total, p_mode::mode_paiement, p_reference, p_preuve, v_lignes, auth.uid());
end $fn$;
revoke execute on function public.declarer_avance(uuid, text[], text, text, text) from public, anon;
grant execute on function public.declarer_avance(uuid, text[], text, text, text) to authenticated;


-- =====================================================================
--  CONTRÔLE (lecture seule)
--   Relancer supabase/tests/diagnostic_208_avance.sql :
--     « => _peut_payer_pour » doit valoir false (et non plus null).
--   Relancer supabase/tests/essai_208_parent.sql : verdict « OK ».
--
--  ANNULATION
--   Réappliquer `_peut_payer_pour` de la 202 et `declarer_avance` de la 208
--   (ce qui rouvre la faille : à ne faire qu'en connaissance de cause).
-- =====================================================================
