-- =====================================================================
--  044 — Upload branding (logo/cachet/signature) : policy permissive
--  La version « scoped » (043) échouait (ecole_courante() indisponible dans
--  le contexte Storage selon les cas). Le bucket 'ecoles' étant PUBLIC
--  (branding), on autorise l'écriture à tout utilisateur authentifié.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('ecoles', 'ecoles', true)
on conflict (id) do update set public = true;

drop policy if exists "ecoles_assets_upload" on storage.objects;
create policy "ecoles_assets_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'ecoles');

drop policy if exists "ecoles_assets_maj" on storage.objects;
create policy "ecoles_assets_maj" on storage.objects
  for update to authenticated using (bucket_id = 'ecoles');

drop policy if exists "ecoles_assets_suppr" on storage.objects;
create policy "ecoles_assets_suppr" on storage.objects
  for delete to authenticated using (bucket_id = 'ecoles');

drop policy if exists "ecoles_assets_lecture" on storage.objects;
create policy "ecoles_assets_lecture" on storage.objects
  for select using (bucket_id = 'ecoles');
