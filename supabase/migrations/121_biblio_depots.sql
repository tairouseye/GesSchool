-- =====================================================================
--  121 — Bibliothèque : DÉPÔT INSTITUTIONNEL (mémoires, thèses, publications)
--        + pénalités de circulation
--
--  Workflow :
--    brouillon → soumis → verification → (a_corriger ⟲) → valide → publie
--                                                        └→ rejete / archive
--
--  À la PUBLICATION, le dépôt devient une vraie notice du catalogue
--  (`biblio_ressources` + `biblio_numeriques`) : la RPC `publier_depot()` fait
--  les trois écritures de façon ATOMIQUE.
--
--  ⚠️ Changement de sécurité Storage : jusqu'ici SEULE la gestion pouvait
--  téléverser. Un étudiant doit pouvoir déposer son mémoire → on ouvre
--  l'écriture aux membres, mais UNIQUEMENT sous le préfixe
--  `<ecole_id>/depots/…`, et la lecture reste limitée au déposant + gestion.
--
--  Prérequis : migrations 115 → 120.
-- =====================================================================

-- --- Dépôts (workflow) ------------------------------------------------------
create table if not exists biblio_depots (
  id                  uuid primary key default gen_random_uuid(),
  ecole_id            uuid not null references ecoles(id) on delete cascade,
  type                text not null default 'memoire'
                      check (type in ('memoire','these','rapport','pfe','publication')),
  titre               text not null,
  resume              text,
  mots_cles           text[] not null default '{}',
  annee_academique    text,
  deposant_profil_id  uuid references profils(id) on delete set null,
  deposant_eleve_id   uuid references eleves(id) on delete set null,
  fichier_chemin      text,
  fichier_nom         text,
  taille              bigint,
  statut              text not null default 'brouillon'
                      check (statut in ('brouillon','soumis','verification','a_corriger','valide','publie','archive','rejete')),
  commentaire         text,                       -- retour du validateur
  validateur_profil_id uuid references profils(id) on delete set null,
  ressource_id        uuid references biblio_ressources(id) on delete set null,  -- notice créée à la publication
  soumis_le           timestamptz,
  decide_le           timestamptz,
  publie_le           timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists biblio_depots_ecole_idx on biblio_depots(ecole_id, statut, created_at desc);
create index if not exists biblio_depots_deposant_idx on biblio_depots(deposant_profil_id);
create index if not exists biblio_depots_chemin_idx on biblio_depots(fichier_chemin) where fichier_chemin is not null;

-- --- Métadonnées académiques (mémoires & thèses) ---------------------------
create table if not exists biblio_theses (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  depot_id       uuid not null references biblio_depots(id) on delete cascade,
  directeur      text,
  co_directeur   text,
  jury           jsonb,                    -- [{nom, role}]
  faculte_id     uuid references facultes(id) on delete set null,
  departement_id uuid references departements(id) on delete set null,
  filiere_id     uuid references filieres(id) on delete set null,
  mention        text,
  soutenu_le     date,
  unique (depot_id)
);
create index if not exists biblio_theses_ecole_idx on biblio_theses(ecole_id);

-- --- Publications scientifiques --------------------------------------------
create table if not exists biblio_publications (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  depot_id     uuid not null references biblio_depots(id) on delete cascade,
  revue        text,
  volume       text,
  numero       text,
  pages        text,
  doi          text,
  laboratoire  text,
  indexation   text,                        -- Scopus, WoS, DOAJ…
  unique (depot_id)
);
create index if not exists biblio_publications_ecole_idx on biblio_publications(ecole_id);

-- --- Pénalités de circulation ----------------------------------------------
create table if not exists biblio_penalites (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  emprunt_id uuid references biblio_emprunts(id) on delete set null,
  type       text not null default 'retard' check (type in ('retard','perte','dommage')),
  montant    numeric(12,2) not null default 0,
  statut     text not null default 'due' check (statut in ('due','payee','annulee')),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists biblio_penalites_ecole_idx on biblio_penalites(ecole_id, statut);

-- =====================================================================
--  RLS
-- =====================================================================
alter table biblio_depots       enable row level security;
alter table biblio_theses       enable row level security;
alter table biblio_publications enable row level security;
alter table biblio_penalites    enable row level security;

-- Dépôts : la gestion voit tout ; le déposant voit les siens ; les dépôts
-- PUBLIÉS sont visibles de tout membre.
drop policy if exists biblio_depots_select on biblio_depots;
create policy biblio_depots_select on biblio_depots for select using (
  _biblio_gestion(ecole_id)
  or deposant_profil_id = auth.uid()
  or (statut = 'publie' and est_membre_ecole(ecole_id))
);
-- Création : par soi-même (membre) ou par la gestion.
drop policy if exists biblio_depots_insert on biblio_depots;
create policy biblio_depots_insert on biblio_depots for insert with check (
  _biblio_gestion(ecole_id)
  or (est_membre_ecole(ecole_id) and deposant_profil_id = auth.uid())
);
-- Modification : la gestion à tout moment ; le déposant seulement tant que le
-- dossier est modifiable (brouillon ou renvoyé pour correction).
drop policy if exists biblio_depots_update on biblio_depots;
create policy biblio_depots_update on biblio_depots for update using (
  _biblio_gestion(ecole_id)
  or (deposant_profil_id = auth.uid() and statut in ('brouillon','a_corriger'))
) with check (
  _biblio_gestion(ecole_id) or deposant_profil_id = auth.uid()
);
drop policy if exists biblio_depots_delete on biblio_depots;
create policy biblio_depots_delete on biblio_depots for delete using (
  _biblio_gestion(ecole_id)
  or (deposant_profil_id = auth.uid() and statut = 'brouillon')
);

-- Métadonnées liées : mêmes droits que le dépôt parent.
do $$
declare t text;
begin
  foreach t in array array['biblio_theses','biblio_publications']
  loop
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      exists (select 1 from biblio_depots d where d.id = depot_id and (
        _biblio_gestion(d.ecole_id) or d.deposant_profil_id = auth.uid()
        or (d.statut = 'publie' and est_membre_ecole(d.ecole_id))))
    );$p$, t, t);

    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_ecrire on %I for all using (
      exists (select 1 from biblio_depots d where d.id = depot_id and (
        _biblio_gestion(d.ecole_id) or d.deposant_profil_id = auth.uid()))
    ) with check (
      exists (select 1 from biblio_depots d where d.id = depot_id and (
        _biblio_gestion(d.ecole_id) or d.deposant_profil_id = auth.uid()))
    );$p$, t, t);
  end loop;
end $$;

-- Pénalités : gestion en écriture ; l'usager voit les siennes.
drop policy if exists biblio_penalites_select on biblio_penalites;
create policy biblio_penalites_select on biblio_penalites for select using (
  _biblio_gestion(ecole_id)
  or exists (select 1 from biblio_emprunts e where e.id = emprunt_id and (
       e.emprunteur_profil_id = auth.uid()
       or exists (select 1 from eleves el where el.id = e.emprunteur_eleve_id and el.profil_id = auth.uid())))
);
drop policy if exists biblio_penalites_ecrire on biblio_penalites;
create policy biblio_penalites_ecrire on biblio_penalites for all
  using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));

-- =====================================================================
--  STORAGE — ouvrir le dépôt aux membres, sous le préfixe `depots/` UNIQUEMENT
-- =====================================================================

-- Lecture : on ajoute le cas « fichier de dépôt » (déposant ou gestion).
create or replace function public._biblio_peut_lire_chemin(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select
      _biblio_gestion(_biblio_ecole(p_name))
   or exists (select 1 from biblio_numeriques n
              where n.fichier_chemin = p_name and _biblio_peut_lire(n.id))
   or exists (select 1 from biblio_ressources r
              where r.couverture_chemin = p_name and est_membre_ecole(r.ecole_id))
      -- dépôt institutionnel : son auteur peut relire son propre fichier
   or exists (select 1 from biblio_depots d
              where d.fichier_chemin = p_name and d.deposant_profil_id = auth.uid());
$$;

-- Écriture : gestion partout ; membre uniquement dans `<ecole_id>/depots/…`.
drop policy if exists bibliotheque_insert on storage.objects;
create policy bibliotheque_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bibliotheque' and (
      public._biblio_gestion(public._biblio_ecole(name))
      or (public.est_membre_ecole(public._biblio_ecole(name))
          and (storage.foldername(name))[2] = 'depots')
    )
  );

-- Mise à jour / suppression : gestion, ou le déposant sur SON propre fichier.
drop policy if exists bibliotheque_update on storage.objects;
create policy bibliotheque_update on storage.objects for update to authenticated
  using (
    bucket_id = 'bibliotheque' and (
      public._biblio_gestion(public._biblio_ecole(name))
      or exists (select 1 from biblio_depots d
                 where d.fichier_chemin = name and d.deposant_profil_id = auth.uid()
                   and d.statut in ('brouillon','a_corriger'))
    )
  );

drop policy if exists bibliotheque_delete on storage.objects;
create policy bibliotheque_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'bibliotheque' and (
      public._biblio_gestion(public._biblio_ecole(name))
      or exists (select 1 from biblio_depots d
                 where d.fichier_chemin = name and d.deposant_profil_id = auth.uid()
                   and d.statut = 'brouillon')
    )
  );

-- =====================================================================
--  Publication d'un dépôt → notice de catalogue (ATOMIQUE)
-- =====================================================================
create or replace function public.publier_depot(p_depot uuid, p_acces text default 'institution')
returns uuid language plpgsql security definer set search_path = public as $$
declare d biblio_depots; v_res uuid;
begin
  select * into d from biblio_depots where id = p_depot;
  if d is null then raise exception 'Dépôt introuvable.'; end if;
  if not _biblio_gestion(d.ecole_id) then raise exception 'Réservé à la gestion de la bibliothèque.'; end if;
  if d.statut = 'publie' then return d.ressource_id; end if;
  if d.fichier_chemin is null then raise exception 'Aucun fichier joint à ce dépôt.'; end if;

  -- 1) la notice
  insert into biblio_ressources (ecole_id, titre, type_ressource, resume, mots_cles, annee_pub, visible)
  values (d.ecole_id, d.titre,
          case d.type when 'publication' then 'article' when 'these' then 'these' else 'memoire' end,
          d.resume, d.mots_cles,
          nullif(regexp_replace(coalesce(d.annee_academique, ''), '\D', '', 'g'), '')::int, true)
  returning id into v_res;

  -- 2) le document numérique (réutilise le fichier déjà déposé)
  insert into biblio_numeriques (ecole_id, ressource_id, fichier_chemin, fichier_nom, taille, format, acces, licence)
  values (d.ecole_id, v_res, d.fichier_chemin, d.fichier_nom, d.taille,
          lower(coalesce(substring(d.fichier_nom from '\.([^.]+)$'), 'pdf')),
          coalesce(p_acces, 'institution'), 'institutionnelle');

  -- 3) le dépôt devient publié
  update biblio_depots
     set statut = 'publie', ressource_id = v_res, publie_le = now(),
         decide_le = coalesce(decide_le, now()), validateur_profil_id = coalesce(validateur_profil_id, auth.uid())
   where id = p_depot;

  return v_res;
end $$;

revoke execute on function public.publier_depot(uuid, text) from public, anon;
grant execute on function public.publier_depot(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.publier_depot(uuid, text);
-- drop table if exists biblio_penalites, biblio_publications, biblio_theses, biblio_depots cascade;
-- (puis réappliquer 119 pour restaurer les policies storage d'origine)
