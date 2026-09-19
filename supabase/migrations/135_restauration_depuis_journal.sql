-- =====================================================================
--  135 — PHASE 1b : restaurer une ligne supprimée par erreur
--
--  La phase 1b devait être un « soft delete » généralisé. L'examen des
--  neuf suppressions de données sensibles a montré que c'était le mauvais
--  remède :
--
--   1. Deux d'entre elles ne détruisent rien — elles RECONSTRUISENT.
--      `notes_lmd` (superieur.js : on efface les notes d'une UE avant de
--      réécrire la saisie) et `bulletin_lignes` (bulletins.js : on vide
--      avant de régénérer). Les passer en soft delete casserait la saisie
--      de notes et la génération des bulletins, et accumulerait des lignes
--      fantômes en conflit avec les index uniques.
--
--   2. Masquer une ligne par RLS ne la masque PAS aux fonctions
--      SECURITY DEFINER ni aux triggers d'agrégat, qui s'exécutent comme
--      propriétaire. Une facture « supprimée » continuerait de compter dans
--      les totaux. Le remède serait pire que le mal.
--
--  Or la migration 134 conserve déjà `details->'ligne_supprimee'` :
--  la ligne ENTIÈRE est dans le journal. La réversibilité est donc atteinte
--  sans toucher au modèle — il ne manquait qu'un moyen de la rejouer.
--
--  ⚠️ LIMITE À CONNAÎTRE : cette fonction restaure UNE ligne, pas une
--  cascade. Supprimer un élève efface aussi ses inscriptions, notes et
--  factures par `on delete cascade` ; celles qui portent un trigger sont
--  dans le journal et se restaurent une à une, les autres (liens tuteurs,
--  pièces jointes, absences) sont perdues. La suppression d'un ÉLÈVE reste
--  donc l'acte le plus destructeur de l'application.
--
--  Prérequis : migration 134.
-- =====================================================================

create or replace function public.restaurer_depuis_journal(p_journal uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  j        journal_audit;
  ligne    jsonb;
  v_id     uuid;
  existe   boolean;
  -- Liste blanche : jamais de table arbitraire, même pour un promoteur.
  -- Une fonction SECURITY DEFINER acceptant un nom de table libre serait
  -- une porte d'escalade de privilèges.
  permises constant text[] := array[
    'eleves', 'inscriptions_sup', 'factures', 'paiements',
    'bulletins', 'releves', 'notes', 'notes_lmd'
  ];
begin
  select * into j from journal_audit where id = p_journal;
  if j is null then raise exception 'Entrée de journal introuvable.'; end if;

  -- Restaurer est un acte de promoteur : il réintroduit une donnée que
  -- quelqu'un a volontairement supprimée.
  if not (est_super_admin() or (j.ecole_id = ecole_courante() and est_admin())) then
    raise exception 'Réservé au promoteur de l''établissement.';
  end if;

  if j.operation <> 'DELETE' then
    raise exception 'Cette entrée est une % : il n''y a rien à restaurer.', j.operation;
  end if;
  if not (j.entite = any(permises)) then
    raise exception 'Restauration non autorisée pour « % ».', j.entite;
  end if;

  ligne := j.details -> 'ligne_supprimee';
  if ligne is null then raise exception 'Le journal ne contient pas la ligne supprimée.'; end if;

  v_id := (ligne ->> 'id')::uuid;

  -- Garde-fou : ne jamais écraser une ligne recréée depuis.
  execute format('select exists (select 1 from public.%I where id = $1)', j.entite)
    into existe using v_id;
  if existe then
    raise exception 'Une ligne portant cet identifiant existe déjà : restauration annulée.';
  end if;

  execute format(
    'insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, $1)',
    j.entite) using ligne;

  -- La restauration est elle-même un acte à tracer.
  insert into journal_audit (ecole_id, utilisateur, entite, entite_id, operation, details)
  values (j.ecole_id, auth.uid(), j.entite, v_id, 'RESTORE',
          jsonb_build_object('depuis_journal', p_journal));

  return v_id;
end $$;

revoke execute on function public.restaurer_depuis_journal(uuid) from public, anon;
grant execute on function public.restaurer_depuis_journal(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  MODE D'EMPLOI
-- =====================================================================
-- 1. Retrouver la suppression :
--    select id, created_at, entite, entite_id,
--           details -> 'ligne_supprimee' as ligne
--      from journal_audit
--     where operation = 'DELETE' and entite = 'factures'
--     order by created_at desc limit 20;
--
-- 2. Restaurer :
--    select restaurer_depuis_journal('<id de la ligne de journal>');

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.restaurer_depuis_journal(uuid);
