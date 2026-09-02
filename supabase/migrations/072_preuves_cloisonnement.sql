-- 072 — Cloisonnement du bucket privé 'preuves' (preuves de paiement).
--
-- Avant : les policies étaient permissives (`bucket_id = 'preuves'` seulement)
-- → TOUT utilisateur authentifié pouvait lister et lire les preuves de
-- N'IMPORTE QUELLE école (captures Wave/OM : noms, montants, téléphones).
-- Seule « protection » : l'obscurité des UUID de chemin. Fuite inter-tenant.
--
-- Chemin des objets : "<eleve_id>/<fichier>". On restreint :
--   - insert : un parent ne dépose QUE sous un élève qu'il possède ;
--   - select : parent propriétaire OU staff de l'école de l'élève.

-- eleve_id (uuid) extrait du 1er segment du chemin, ou null si non conforme
-- (fail-closed : un chemin invalide n'autorise rien).
create or replace function public._preuve_eleve(p_name text)
returns uuid language sql immutable set search_path = public, storage as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(p_name))[1])::uuid
    else null
  end;
$$;

drop policy if exists preuves_insert on storage.objects;
create policy preuves_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'preuves'
    and public._parent_possede(public._preuve_eleve(name))
  );

drop policy if exists preuves_select on storage.objects;
create policy preuves_select on storage.objects
  for select to authenticated using (
    bucket_id = 'preuves'
    and (
      public._parent_possede(public._preuve_eleve(name))
      or exists (
        select 1 from public.eleves e
        where e.id = public._preuve_eleve(name)
          and (public.est_super_admin() or e.ecole_id = public.ecole_courante())
      )
    )
  );

-- ANNULATION (revenir à l'état permissif — NE PAS utiliser sauf incident) :
-- drop policy if exists preuves_insert on storage.objects;
-- create policy preuves_insert on storage.objects for insert to authenticated with check (bucket_id = 'preuves');
-- drop policy if exists preuves_select on storage.objects;
-- create policy preuves_select on storage.objects for select to authenticated using (bucket_id = 'preuves');
-- drop function if exists public._preuve_eleve(text);
