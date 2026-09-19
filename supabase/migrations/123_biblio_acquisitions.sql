-- =====================================================================
--  123 — Bibliothèque : ACQUISITIONS (fournisseurs, commandes, suggestions)
--
--  Chaîne : suggestion d'achat → commande → réception → exemplaires créés.
--
--  Choix structurants :
--   • `biblio_exemplaires.fournisseur` (texte libre, migration 117) est CONSERVÉ
--     tel quel pour ne rien casser ; on ajoute un `fournisseur_id` nullable à
--     côté. Les deux cohabitent : l'ancien pour l'historique, le nouveau pour
--     les commandes passées depuis l'application.
--   • Une ligne de commande peut porter soit une notice existante
--     (`ressource_id`), soit un simple titre — on commande souvent un ouvrage
--     AVANT de l'avoir catalogué.
--   • Le montant total n'est PAS stocké : il se recalcule depuis les lignes
--     (une valeur dénormalisée finit toujours par diverger).
--
--  Prérequis : migrations 117 → 122.
-- =====================================================================

-- --- Fournisseurs ----------------------------------------------------------
create table if not exists biblio_fournisseurs (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  nom        text not null,
  contact    text,
  email      text,
  telephone  text,
  adresse    text,
  note       text,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists biblio_fournisseurs_ecole_idx on biblio_fournisseurs(ecole_id, actif);

-- Lien optionnel depuis l'exemplaire (le texte libre historique reste en place).
alter table biblio_exemplaires
  add column if not exists fournisseur_id uuid references biblio_fournisseurs(id) on delete set null;

-- --- Commandes -------------------------------------------------------------
create table if not exists biblio_acquisitions (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  reference      text,
  fournisseur_id uuid references biblio_fournisseurs(id) on delete set null,
  statut         text not null default 'brouillon'
                 check (statut in ('brouillon','commandee','partielle','recue','annulee')),
  date_commande  date,
  date_reception date,
  note           text,
  cree_par       uuid references profils(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists biblio_acquisitions_ecole_idx on biblio_acquisitions(ecole_id, statut, created_at desc);

create table if not exists biblio_acquisitions_lignes (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  acquisition_id uuid not null references biblio_acquisitions(id) on delete cascade,
  ressource_id   uuid references biblio_ressources(id) on delete set null,
  titre          text not null,
  auteur         text,
  isbn           text,
  quantite       integer not null default 1 check (quantite > 0),
  quantite_recue integer not null default 0 check (quantite_recue >= 0),
  prix_unitaire  numeric(12,2) not null default 0,
  constraint biblio_acq_lignes_recue_max check (quantite_recue <= quantite)
);
create index if not exists biblio_acq_lignes_cmd_idx on biblio_acquisitions_lignes(acquisition_id);
create index if not exists biblio_acq_lignes_ecole_idx on biblio_acquisitions_lignes(ecole_id);

-- --- Suggestions d'achat ---------------------------------------------------
--  Ouvertes à TOUT membre (étudiant, enseignant) : d'où `est_membre_ecole`.
create table if not exists biblio_suggestions (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  demandeur_profil_id uuid references profils(id) on delete set null,
  titre          text not null,
  auteur         text,
  editeur        text,
  isbn           text,
  motif          text,
  statut         text not null default 'soumise'
                 check (statut in ('soumise','acceptee','refusee','commandee')),
  reponse        text,
  acquisition_id uuid references biblio_acquisitions(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists biblio_suggestions_ecole_idx on biblio_suggestions(ecole_id, statut, created_at desc);
create index if not exists biblio_suggestions_demandeur_idx on biblio_suggestions(demandeur_profil_id);

-- =====================================================================
--  RLS
-- =====================================================================
--  Fournisseurs / commandes / lignes : la GESTION uniquement. Contrairement au
--  catalogue, ces données sont commerciales (prix d'achat, fournisseurs) et
--  n'ont pas à être lisibles par les étudiants.
do $$
declare t text;
begin
  foreach t in array array['biblio_fournisseurs','biblio_acquisitions','biblio_acquisitions_lignes']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (_biblio_gestion(ecole_id));$p$, t, t);
    execute format($p$create policy %I_ecrire on %I for all
      using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id));$p$, t, t);
  end loop;
end $$;

-- Suggestions : le membre crée et suit LES SIENNES ; la gestion voit tout.
alter table biblio_suggestions enable row level security;

drop policy if exists biblio_suggestions_select on biblio_suggestions;
create policy biblio_suggestions_select on biblio_suggestions for select using (
  _biblio_gestion(ecole_id) or demandeur_profil_id = auth.uid()
);
drop policy if exists biblio_suggestions_insert on biblio_suggestions;
create policy biblio_suggestions_insert on biblio_suggestions for insert with check (
  _biblio_gestion(ecole_id)
  or (est_membre_ecole(ecole_id) and demandeur_profil_id = auth.uid() and statut = 'soumise')
);
-- Le demandeur peut corriger sa demande tant qu'elle n'a pas été traitée.
drop policy if exists biblio_suggestions_update on biblio_suggestions;
create policy biblio_suggestions_update on biblio_suggestions for update using (
  _biblio_gestion(ecole_id) or (demandeur_profil_id = auth.uid() and statut = 'soumise')
) with check (
  _biblio_gestion(ecole_id) or demandeur_profil_id = auth.uid()
);
drop policy if exists biblio_suggestions_delete on biblio_suggestions;
create policy biblio_suggestions_delete on biblio_suggestions for delete using (
  _biblio_gestion(ecole_id) or (demandeur_profil_id = auth.uid() and statut = 'soumise')
);

-- =====================================================================
--  Réception d'une ligne de commande → création des exemplaires (ATOMIQUE)
-- =====================================================================
--  Reçoit `p_quantite` unités : crée autant d'exemplaires rattachés à la
--  notice, met à jour la quantité reçue, puis recalcule le statut de la
--  commande (partielle tant que tout n'est pas arrivé).
--  Les codes-barres restent vides : ils sont apposés physiquement, puis
--  saisis depuis la fiche de la notice.
create or replace function public.receptionner_ligne(
  p_ligne    uuid,
  p_quantite integer default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  l  biblio_acquisitions_lignes;
  a  biblio_acquisitions;
  n  integer;
  reste integer;
begin
  select * into l from biblio_acquisitions_lignes where id = p_ligne;
  if l is null then raise exception 'Ligne de commande introuvable.'; end if;
  if not _biblio_gestion(l.ecole_id) then
    raise exception 'Réservé à la gestion de la bibliothèque.';
  end if;
  if l.ressource_id is null then
    raise exception 'Rattachez d''abord cette ligne à une notice du catalogue.';
  end if;

  reste := l.quantite - l.quantite_recue;
  n := coalesce(p_quantite, reste);
  if n <= 0 then return 0; end if;
  if n > reste then raise exception 'Quantité supérieure au reste à recevoir (%).', reste; end if;

  select * into a from biblio_acquisitions where id = l.acquisition_id;

  insert into biblio_exemplaires (ecole_id, ressource_id, prix, date_acquisition, fournisseur_id, statut, etat)
  select l.ecole_id, l.ressource_id, l.prix_unitaire, coalesce(a.date_reception, current_date),
         a.fournisseur_id, 'disponible', 'neuf'
    from generate_series(1, n);

  update biblio_acquisitions_lignes
     set quantite_recue = quantite_recue + n
   where id = p_ligne;

  -- Statut de la commande, recalculé depuis l'ensemble de ses lignes.
  update biblio_acquisitions c
     set statut = case
           when (select bool_and(x.quantite_recue >= x.quantite)
                   from biblio_acquisitions_lignes x where x.acquisition_id = c.id) then 'recue'
           else 'partielle' end,
         date_reception = coalesce(c.date_reception, current_date)
   where c.id = l.acquisition_id and c.statut not in ('annulee');

  return n;
end $$;

revoke execute on function public.receptionner_ligne(uuid, integer) from public, anon;
grant execute on function public.receptionner_ligne(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.receptionner_ligne(uuid, integer);
-- alter table biblio_exemplaires drop column if exists fournisseur_id;
-- drop table if exists biblio_suggestions, biblio_acquisitions_lignes,
--                      biblio_acquisitions, biblio_fournisseurs cascade;
