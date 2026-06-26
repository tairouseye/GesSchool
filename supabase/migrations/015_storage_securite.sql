-- =====================================================================
--  015 — Durcissement du stockage
--  eleves & justificatifs : buckets PRIVÉS, accès limité à l'école
--  (dossier = ecole_id) → lecture via URL signée uniquement.
--  ecoles (logos/cachets) : reste public mais NON listable.
-- =====================================================================

-- Passe les buckets sensibles en privé
update storage.buckets set public = false where id in ('eleves', 'justificatifs');

-- Supprime les anciennes policies (lecture/écriture trop larges)
drop policy if exists "eleves_photos_lecture" on storage.objects;
drop policy if exists "eleves_photos_upload" on storage.objects;
drop policy if exists "eleves_photos_maj" on storage.objects;
drop policy if exists "eleves_photos_suppr" on storage.objects;
drop policy if exists "justificatifs_lecture" on storage.objects;
drop policy if exists "justificatifs_upload" on storage.objects;
drop policy if exists "justificatifs_maj" on storage.objects;
drop policy if exists "justificatifs_suppr" on storage.objects;
drop policy if exists "ecoles_assets_lecture" on storage.objects;

-- eleves & justificatifs : accès réservé aux membres de l'école (1er dossier = ecole_id)
do $$
declare b text;
begin
  foreach b in array array['eleves', 'justificatifs'] loop
    execute format($f$
      create policy %1$s_select on storage.objects for select to authenticated
        using (bucket_id = %1$L and (storage.foldername(name))[1] = ecole_courante()::text);
    $f$, b);
    execute format($f$
      create policy %1$s_insert on storage.objects for insert to authenticated
        with check (bucket_id = %1$L and (storage.foldername(name))[1] = ecole_courante()::text);
    $f$, b);
    execute format($f$
      create policy %1$s_update on storage.objects for update to authenticated
        using (bucket_id = %1$L and (storage.foldername(name))[1] = ecole_courante()::text);
    $f$, b);
    execute format($f$
      create policy %1$s_delete on storage.objects for delete to authenticated
        using (bucket_id = %1$L and (storage.foldername(name))[1] = ecole_courante()::text);
    $f$, b);
  end loop;
end $$;

-- ecoles : public (branding) mais on garde seulement l'écriture authentifiée
-- (pas de policy SELECT large → plus de listing ; l'URL publique sert quand même).

-- Petit durcissement : trigger recalc_facture non exposé en RPC + search_path
revoke execute on function public.recalc_facture() from public;
create or replace function libelle_cycle(p type_cycle)
returns text language sql immutable set search_path = public as $$
  select case p
    when 'prescolaire'   then 'Préscolaire'
    when 'premier_cycle' then 'Élémentaire'
    when 'second_cycle'  then 'Collège'
    when 'lycee'         then 'Lycée'
    when 'formation_pro' then 'Formation professionnelle'
    when 'universite'    then 'Université'
  end
$$;
