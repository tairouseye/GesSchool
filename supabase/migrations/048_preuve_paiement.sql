-- =====================================================================
--  048 — Preuve de paiement jointe par le parent
--
--  Le parent peut joindre une image (capture Wave/OM, photo de bordereau
--  bancaire, reçu) à sa déclaration de paiement. La caisse la consulte avant
--  de valider. Fichiers dans le bucket privé 'preuves', consultés via URL
--  signée. La déclaration référence le chemin du fichier.
-- =====================================================================

-- Bucket privé pour les preuves de paiement -----------------------------------
insert into storage.buckets (id, name, public) values ('preuves', 'preuves', false)
on conflict (id) do nothing;

-- Policies (permissives, alignées sur le bucket 'ecoles' de la migration 044) :
-- tout utilisateur authentifié peut déposer une preuve et la relire (le parent
-- pour déclarer, la caisse pour vérifier).
drop policy if exists preuves_insert on storage.objects;
create policy preuves_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'preuves');

drop policy if exists preuves_select on storage.objects;
create policy preuves_select on storage.objects
  for select to authenticated using (bucket_id = 'preuves');

-- Chemin de la preuve sur la déclaration --------------------------------------
alter table declarations_paiement add column if not exists preuve_chemin text;

-- RPC : declarer_paiement accepte désormais une preuve (5e argument optionnel).
-- Remplace la signature à 4 arguments de la migration 047.
drop function if exists public.declarer_paiement(uuid, numeric, text, text);
create or replace function public.declarer_paiement(
  p_facture uuid, p_montant numeric, p_mode text, p_reference text, p_preuve text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_eleve uuid; v_ecole uuid;
begin
  select eleve_id, ecole_id into v_eleve, v_ecole from factures where id = p_facture;
  if v_eleve is null then raise exception 'Facture introuvable.'; end if;
  if not public._parent_possede(v_eleve) then raise exception 'Accès refusé.'; end if;
  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin)
  values (v_ecole, p_facture, v_eleve, p_montant, p_mode::mode_paiement, p_reference, p_preuve);
end $$;

revoke execute on function public.declarer_paiement(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.declarer_paiement(uuid, numeric, text, text, text) to authenticated;
