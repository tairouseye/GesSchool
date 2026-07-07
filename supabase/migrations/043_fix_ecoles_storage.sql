-- =====================================================================
--  043 — Correctif : upload logo/cachet/signature bloqué par la RLS Storage
--  Le bucket 'ecoles' (branding) n'avait plus de policy d'écriture en base
--  → « new row violates row-level security policy » à l'upload du logo.
--  On (re)crée insert/update/select, écriture limitée au dossier de l'école.
-- =====================================================================

-- S'assure que le bucket existe et est public (branding).
insert into storage.buckets (id, name, public)
values ('ecoles', 'ecoles', true)
on conflict (id) do update set public = true;

drop policy if exists "ecoles_assets_lecture" on storage.objects;
create policy "ecoles_assets_lecture" on storage.objects
  for select using (bucket_id = 'ecoles');

drop policy if exists "ecoles_assets_upload" on storage.objects;
create policy "ecoles_assets_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ecoles' and (storage.foldername(name))[1] = ecole_courante()::text);

drop policy if exists "ecoles_assets_maj" on storage.objects;
create policy "ecoles_assets_maj" on storage.objects
  for update to authenticated
  using (bucket_id = 'ecoles' and (storage.foldername(name))[1] = ecole_courante()::text);

drop policy if exists "ecoles_assets_suppr" on storage.objects;
create policy "ecoles_assets_suppr" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ecoles' and (storage.foldername(name))[1] = ecole_courante()::text);
