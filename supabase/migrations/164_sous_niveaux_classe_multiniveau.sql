-- =====================================================================
--  164 — Le niveau RÉEL d'un élève dans une classe multi-niveaux
--
--  Remonté en visite : chez Tut'Tank, « TPS/PS A » est UNE classe qui
--  contient des élèves de TPS et des élèves de PS — c'est le système
--  Montessori. Idem pour « CI/CP ». Le système ne savait pas le dire : le
--  niveau d'un élève, c'est celui de sa classe, et l'école contournait en
--  créant des niveaux COMBINÉS (« TPS/PS », « CI/CP », « CE1/CE2 »).
--
--  ⚠️ POURQUOI PAS SIMPLEMENT AJOUTER TPS ET PS DANS `niveaux`.
--  Parce que `niveaux` n'est pas qu'une nomenclature pédagogique : six
--  autres objets s'y accrochent — `frais` (la grille tarifaire),
--  `coefficients_matieres`, `volumes_horaires`, `fournitures`,
--  `annonces.niveau_id` (mig. 152) et `fichiers_ecole.niveau_id` (mig. 159).
--  Y insérer TPS et PS les ferait apparaître dans six écrans de sélection,
--  et un tarif posé sur « TPS » au lieu de « TPS/PS » ne s'appliquerait
--  plus à personne. Le défaut serait silencieux et coûteux.
--
--  On sépare donc deux notions que l'école confond par commodité :
--    • le NIVEAU de la classe — unité de tarif, de programme, de fournitures ;
--    • le SOUS-NIVEAU de l'élève — sa place réelle dans cette classe.
--
--  ⚠️ FONCTIONNALITÉ OPT-IN. Un niveau sans sous-niveaux se comporte
--  exactement comme avant : rien ne change pour les six autres écoles, ni
--  pour les niveaux simples de Tut'Tank (CM1). On n'ajoute pas une
--  obligation, on rend une distinction possible là où elle existe.
--
--  Prérequis : migrations 001, 018, 033.
-- =====================================================================

-- --- 1. Les sous-niveaux d'un niveau --------------------------------------
create table if not exists sous_niveaux (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  niveau_id  uuid not null references niveaux(id) on delete cascade,
  libelle    text not null,
  ordre      integer not null default 0,
  created_at timestamptz not null default now(),
  unique (niveau_id, libelle)
);
create index if not exists sous_niveaux_niveau_idx on sous_niveaux(niveau_id, ordre);
create index if not exists sous_niveaux_ecole_idx on sous_niveaux(ecole_id);

comment on table sous_niveaux is
  'Niveaux réels à l''intérieur d''un niveau combiné : TPS et PS dans « TPS/PS ». Opt-in (mig. 164).';

alter table sous_niveaux enable row level security;

--  Lecture : tout membre de l'établissement — la liste sert à afficher le
--  niveau d'un élève partout, y compris dans l'espace parent via les RPC.
drop policy if exists sous_niveaux_select on sous_niveaux;
create policy sous_niveaux_select on sous_niveaux for select
  using (est_super_admin() or ecole_id = ecole_courante() or est_membre_ecole(ecole_id));

--  Écriture : acte de structure académique, mêmes rôles que « Niveaux &
--  classes » et que les dates de période (mig. 162).
do $$
declare pred text := '(est_admin() or a_role(''direction''))';
begin
  execute format('drop policy if exists sous_niveaux_ins on public.sous_niveaux;');
  execute format('drop policy if exists sous_niveaux_upd on public.sous_niveaux;');
  execute format('drop policy if exists sous_niveaux_del on public.sous_niveaux;');
  execute format('create policy sous_niveaux_ins on public.sous_niveaux for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy sous_niveaux_upd on public.sous_niveaux for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy sous_niveaux_del on public.sous_niveaux for delete using (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
end $$;

-- --- 2. La place de l'élève ------------------------------------------------
--  Nullable : un élève sans sous-niveau garde celui de sa classe. C'est le
--  cas de TOUS les élèves existants, et rien ne les oblige à changer.
alter table inscriptions add column if not exists sous_niveau_id uuid references sous_niveaux(id) on delete set null;
create index if not exists inscriptions_sous_niveau_idx on inscriptions(sous_niveau_id);

comment on column inscriptions.sous_niveau_id is
  'Niveau réel de l''élève dans une classe multi-niveaux. NULL = celui de la classe (mig. 164).';

-- --- 3. L'intégrité qu'une clé étrangère ne sait pas dire ------------------
--  ⚠️ Une FK garantit que le sous-niveau EXISTE, pas qu'il appartient au
--  niveau de la classe de l'élève. Sans ce contrôle, on pourrait inscrire un
--  élève de CI/CP au sous-niveau « TPS » : la donnée serait cohérente pour
--  Postgres et absurde pour l'école. Même leçon que les FK composites de
--  l'audit bibliothèque (mig. 127).
create or replace function public._verifier_sous_niveau()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_niveau_classe uuid; v_niveau_sous uuid; v_ecole_sous uuid;
begin
  if new.sous_niveau_id is null then return new; end if;

  select sn.niveau_id, sn.ecole_id into v_niveau_sous, v_ecole_sous
    from sous_niveaux sn where sn.id = new.sous_niveau_id;
  if v_niveau_sous is null then
    raise exception 'Sous-niveau introuvable.';
  end if;
  if v_ecole_sous <> new.ecole_id then
    raise exception 'Ce sous-niveau appartient à un autre établissement.';
  end if;

  select c.niveau_id into v_niveau_classe from classes c where c.id = new.classe_id;
  if v_niveau_classe is distinct from v_niveau_sous then
    raise exception 'Ce sous-niveau n''appartient pas au niveau de la classe de l''élève.';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_verifier_sous_niveau on inscriptions;
create trigger trg_verifier_sous_niveau
  before insert or update of sous_niveau_id, classe_id on inscriptions
  for each row execute function public._verifier_sous_niveau();

-- --- 4. Le niveau tel qu'on l'affiche --------------------------------------
--  « CI » si le sous-niveau est renseigné, « CI/CP » sinon. Une seule
--  définition, pour que les écrans ne la réinventent pas chacun à leur façon.
create or replace function public.niveau_affiche(p_inscription uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select coalesce(sn.libelle, n.libelle)
    from inscriptions i
    join classes c on c.id = i.classe_id
    join niveaux n on n.id = c.niveau_id
    left join sous_niveaux sn on sn.id = i.sous_niveau_id
   where i.id = p_inscription;
$fn$;
revoke execute on function public.niveau_affiche(uuid) from public, anon;
grant execute on function public.niveau_affiche(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • aucune inscription existante n'est modifiée : `sous_niveau_id` est
--     NULL partout, et le niveau affiché reste celui de la classe ;
--   • créer TPS et PS sous le niveau « TPS/PS », puis placer un élève de
--     TPS/PS A en « TPS » → accepté ;
--   • placer ce même élève en « CI » (sous-niveau d'un AUTRE niveau) →
--     refusé par le déclencheur ;
--   • un sous-niveau d'une autre école → refusé ;
--   • déplacer un élève vers une classe d'un autre niveau sans vider son
--     sous-niveau → refusé (le déclencheur écoute aussi `classe_id`) ;
--   • un compte « comptable » ou « rh » ne peut pas créer de sous-niveau ;
--   • un niveau SANS sous-niveaux se comporte exactement comme avant.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.niveau_affiche(uuid);
-- drop trigger if exists trg_verifier_sous_niveau on inscriptions;
-- drop function if exists public._verifier_sous_niveau();
-- alter table inscriptions drop column if exists sous_niveau_id;
-- drop table if exists sous_niveaux;
