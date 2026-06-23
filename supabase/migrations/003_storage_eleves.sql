-- 003 — Bucket Storage pour les photos d'élèves
insert into storage.buckets (id, name, public)
values ('eleves', 'eleves', true)
on conflict (id) do nothing;

drop policy if exists "eleves_photos_lecture" on storage.objects;
create policy "eleves_photos_lecture" on storage.objects
  for select using (bucket_id = 'eleves');

drop policy if exists "eleves_photos_upload" on storage.objects;
create policy "eleves_photos_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'eleves');

drop policy if exists "eleves_photos_maj" on storage.objects;
create policy "eleves_photos_maj" on storage.objects
  for update to authenticated using (bucket_id = 'eleves');

drop policy if exists "eleves_photos_suppr" on storage.objects;
create policy "eleves_photos_suppr" on storage.objects
  for delete to authenticated using (bucket_id = 'eleves');
