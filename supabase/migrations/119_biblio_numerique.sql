-- =====================================================================
--  119 — Bibliothèque NUMÉRIQUE : fichiers, droits d'accès, bucket sécurisé
--
--  PRINCIPE DE SÉCURITÉ : la règle d'accès de CHAQUE document est appliquée
--  DANS LA POLICY STORAGE elle-même (jointure du chemin de l'objet sur
--  `biblio_numeriques.fichier_chemin`). Conséquence : même en connaissant le
--  chemin, un utilisateur d'une autre institution — ou un étudiant non ciblé —
--  ne peut PAS obtenir d'URL signée. La sécurité n'est pas dans l'interface.
--
--  Niveaux d'accès (`biblio_numeriques.acces`) :
--    institution : tout membre de l'établissement
--    cible       : uniquement ceux qui satisfont une règle (faculté /
--                  département / filière / niveau / rôle) — cf. biblio_acces_regles
--    restreint   : gestion bibliothèque uniquement
--    public      : réservé à une ouverture externe FUTURE ; traité aujourd'hui
--                  comme « institution » (le bucket est privé).
--
--  Prérequis : migrations 115, 116, 117, 118.
-- =====================================================================

-- --- Ressources numériques --------------------------------------------------
create table if not exists biblio_numeriques (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  ressource_id   uuid not null references biblio_ressources(id) on delete cascade,
  fichier_chemin text not null,
  fichier_nom    text,
  format         text,                      -- pdf | epub | docx | video | audio …
  taille         bigint,
  mime           text,
  licence        text,                      -- open_access | creative_commons | institutionnelle | domaine_public | tous_droits | inconnue
  copyright      text,
  acces          text not null default 'institution'
                 check (acces in ('public','institution','cible','restreint')),
  telechargeable boolean not null default false,
  expire_le      timestamptz,
  cree_par       uuid references profils(id) on delete set null,
  created_at     timestamptz not null default now()
);
create unique index if not exists biblio_numeriques_chemin_idx on biblio_numeriques(fichier_chemin);
create index if not exists biblio_numeriques_ecole_idx on biblio_numeriques(ecole_id);
create index if not exists biblio_numeriques_res_idx on biblio_numeriques(ressource_id);
-- Lookup par chemin depuis la policy storage (doit être rapide).
create index if not exists biblio_ressources_couverture_idx
  on biblio_ressources(couverture_chemin) where couverture_chemin is not null;

-- --- Règles d'accès ciblé ---------------------------------------------------
create table if not exists biblio_acces_regles (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  numerique_id   uuid not null references biblio_numeriques(id) on delete cascade,
  faculte_id     uuid references facultes(id) on delete cascade,
  departement_id uuid references departements(id) on delete cascade,
  filiere_id     uuid references filieres(id) on delete cascade,
  niveau         text,
  role           text,                      -- comparé en TEXTE (pas de cast d'enum : évite une erreur si valeur inconnue)
  created_at     timestamptz not null default now()
);
create index if not exists biblio_acces_regles_ecole_idx on biblio_acces_regles(ecole_id);
create index if not exists biblio_acces_regles_num_idx on biblio_acces_regles(numerique_id);

-- =====================================================================
--  Helpers d'autorisation
-- =====================================================================

-- Extrait l'ecole_id du 1er segment du chemin. IMMUTABLE et FAIL-CLOSED :
-- renvoie NULL si le chemin n'est pas conforme (évite une erreur de cast en
-- policy). Modèle : `_preuve_eleve` (072).
create or replace function public._biblio_ecole(p_name text)
returns uuid language sql immutable as $$
  select case
    when p_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      then substring(p_name from 1 for 36)::uuid
    else null
  end;
$$;

-- Ce document numérique est-il lisible par l'utilisateur courant ?
create or replace function public._biblio_peut_lire(p_numerique uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from biblio_numeriques n
    where n.id = p_numerique
      and est_membre_ecole(n.ecole_id)                       -- cloisonnement institution
      and (n.expire_le is null or n.expire_le > now())       -- péremption
      and (
        _biblio_gestion(n.ecole_id)                          -- la gestion voit tout
        or n.acces in ('public', 'institution')
        or (n.acces = 'cible' and exists (
              select 1 from biblio_acces_regles r
              where r.numerique_id = n.id and (
                   (r.role is not null and exists (
                      select 1 from profil_roles pr
                      where pr.profil_id = auth.uid() and pr.role::text = r.role))
                or (r.filiere_id is not null and exists (
                      select 1 from inscriptions_sup i join eleves e on e.id = i.eleve_id
                      where e.profil_id = auth.uid() and i.statut = 'active'
                        and i.filiere_id = r.filiere_id
                        and (r.niveau is null or i.niveau = r.niveau)))
                or (r.departement_id is not null and exists (
                      select 1 from inscriptions_sup i join eleves e on e.id = i.eleve_id
                      join filieres f on f.id = i.filiere_id
                      where e.profil_id = auth.uid() and i.statut = 'active'
                        and f.departement_id = r.departement_id))
                or (r.faculte_id is not null and exists (
                      select 1 from inscriptions_sup i join eleves e on e.id = i.eleve_id
                      join filieres f on f.id = i.filiere_id
                      join departements d on d.id = f.departement_id
                      where e.profil_id = auth.uid() and i.statut = 'active'
                        and d.faculte_id = r.faculte_id))
              )))
      )
  );
$$;

-- Version « par chemin d'objet », utilisée par la policy Storage.
create or replace function public._biblio_peut_lire_chemin(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select
      -- la gestion lit tout le dossier de SON école (y compris un fichier
      -- fraîchement téléversé, avant création de la fiche)
      _biblio_gestion(_biblio_ecole(p_name))
      -- document numérique référencé : on applique SA règle d'accès
   or exists (select 1 from biblio_numeriques n
              where n.fichier_chemin = p_name and _biblio_peut_lire(n.id))
      -- couverture d'une notice (peu sensible) : tout membre
   or exists (select 1 from biblio_ressources r
              where r.couverture_chemin = p_name and est_membre_ecole(r.ecole_id));
$$;

grant execute on function public._biblio_ecole(text) to authenticated;
grant execute on function public._biblio_peut_lire(uuid) to authenticated;
grant execute on function public._biblio_peut_lire_chemin(text) to authenticated;

-- =====================================================================
--  RLS des tables
-- =====================================================================
alter table biblio_numeriques   enable row level security;
alter table biblio_acces_regles enable row level security;

-- Métadonnées : visibles aux membres, sauf « restreint » (gestion seulement).
drop policy if exists biblio_numeriques_select on biblio_numeriques;
create policy biblio_numeriques_select on biblio_numeriques for select using (
  est_super_admin()
  or (est_membre_ecole(ecole_id) and (acces <> 'restreint' or _biblio_gestion(ecole_id)))
);
drop policy if exists biblio_numeriques_ecrire on biblio_numeriques;
create policy biblio_numeriques_ecrire on biblio_numeriques for all
  using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));

drop policy if exists biblio_acces_regles_select on biblio_acces_regles;
create policy biblio_acces_regles_select on biblio_acces_regles for select
  using (est_super_admin() or est_membre_ecole(ecole_id));
drop policy if exists biblio_acces_regles_ecrire on biblio_acces_regles;
create policy biblio_acces_regles_ecrire on biblio_acces_regles for all
  using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));

-- =====================================================================
--  STORAGE — bucket privé `bibliotheque`
--  Arborescence : <ecole_id>/<categorie>/<uuid>.<ext>
--  (categorie ∈ ouvrages | articles | theses | memoires | publications |
--   couvertures | multimedia)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('bibliotheque', 'bibliotheque', false, 52428800)   -- 50 Mo/fichier
on conflict (id) do update set public = false;

-- ⚠️ Toujours filtrer `bucket_id` : une policy non filtrée affecterait les
-- autres buckets (précédent : 043 avait cassé le bucket `ecoles`, corrigé en 044).
drop policy if exists bibliotheque_select on storage.objects;
create policy bibliotheque_select on storage.objects for select to authenticated
  using (bucket_id = 'bibliotheque' and public._biblio_peut_lire_chemin(name));

drop policy if exists bibliotheque_insert on storage.objects;
create policy bibliotheque_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'bibliotheque' and public._biblio_gestion(public._biblio_ecole(name)));

drop policy if exists bibliotheque_update on storage.objects;
create policy bibliotheque_update on storage.objects for update to authenticated
  using (bucket_id = 'bibliotheque' and public._biblio_gestion(public._biblio_ecole(name)));

drop policy if exists bibliotheque_delete on storage.objects;
create policy bibliotheque_delete on storage.objects for delete to authenticated
  using (bucket_id = 'bibliotheque' and public._biblio_gestion(public._biblio_ecole(name)));

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop policy if exists bibliotheque_select on storage.objects;
-- drop policy if exists bibliotheque_insert on storage.objects;
-- drop policy if exists bibliotheque_update on storage.objects;
-- drop policy if exists bibliotheque_delete on storage.objects;
-- delete from storage.buckets where id = 'bibliotheque';   -- vider les objets d'abord
-- drop table if exists biblio_acces_regles, biblio_numeriques cascade;
-- drop function if exists public._biblio_peut_lire_chemin(text), public._biblio_peut_lire(uuid), public._biblio_ecole(text);
