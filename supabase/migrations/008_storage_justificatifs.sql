-- 008 — Bucket Storage pour les justificatifs (dépenses / recettes)
insert into storage.buckets (id, name, public)
values ('justificatifs', 'justificatifs', true)
on conflict (id) do nothing;

drop policy if exists "justificatifs_lecture" on storage.objects;
create policy "justificatifs_lecture" on storage.objects
  for select using (bucket_id = 'justificatifs');

drop policy if exists "justificatifs_upload" on storage.objects;
create policy "justificatifs_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'justificatifs');

drop policy if exists "justificatifs_maj" on storage.objects;
create policy "justificatifs_maj" on storage.objects
  for update to authenticated using (bucket_id = 'justificatifs');

drop policy if exists "justificatifs_suppr" on storage.objects;
create policy "justificatifs_suppr" on storage.objects
  for delete to authenticated using (bucket_id = 'justificatifs');
