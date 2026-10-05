-- =====================================================================
--  175 — Les accès du personnel : des cases à cocher, plus un rôle à choisir
--
--  🔴 CE QUE LE PROMOTEUR A DEMANDÉ. Ne plus choisir un rôle dans une
--  liste, mais inviter un **membre du personnel** puis **cocher** ce à quoi
--  il a droit — l'arbre des espaces (Gestion, Pédagogie, RH & Paie) avec
--  leurs sous-menus. Les enseignants font partie du personnel. Les parents
--  et les étudiants n'en font pas partie : ils ont leur propre porte (code
--  parent, code étudiant) et leur périmètre vient de leur LIEN. Cette
--  migration ne les concerne pas.
--
--  ⚠️ CETTE MIGRATION NE CHANGE RIEN, ET C'EST VOULU. Elle pose les tables,
--  les fonctions et les données ; AUCUNE policy n'est modifiée. Les
--  policies continuent de décider par rôle. On sépare délibérément la pose
--  du mécanisme de son activation, pour pouvoir vérifier avant de basculer.
--
--  La bascule se fera domaine par domaine, en REMPLAÇANT `a_role('x')` par
--  `a_acces('cle')` — jamais en ajoutant l'un à côté de l'autre. Garder les
--  deux ferait que décocher une case masquerait l'écran pendant que la base
--  continuerait d'autoriser : exactement le défaut corrigé par la migration
--  173 et par les lots 1 et 2 de l'audit.
-- =====================================================================

-- --- 1. Les trois tables ----------------------------------------------
--
--  `boite` porte soit une CASE (un écran ou un groupe d'écrans), soit un
--  POUVOIR (`p_...`). Les deux vivent ensemble parce qu'ils répondent à la
--  même question — « est-ce accordé ? » — et se lisent par la même
--  fonction.
create table if not exists personnel_acces (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  profil_id  uuid not null references profils(id) on delete cascade,
  boite      text not null,
  created_at timestamptz not null default now(),
  unique (profil_id, ecole_id, boite)
);
create index if not exists personnel_acces_ecole_idx on personnel_acces(ecole_id);

--  Le périmètre : sur QUOI ces accès portent.
--   'ecole'   — tout l'établissement (le défaut, et le cas de presque tous)
--   'cycles'  — les cycles listés dans `personnel_cycles`
--   'classes' — ses classes, par ses affectations (le cas de l'enseignant)
create table if not exists personnel_perimetre (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  profil_id  uuid not null references profils(id) on delete cascade,
  mode       text not null default 'ecole' check (mode in ('ecole', 'cycles', 'classes')),
  created_at timestamptz not null default now(),
  unique (profil_id, ecole_id)
);

create table if not exists personnel_cycles (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  profil_id  uuid not null references profils(id) on delete cascade,
  cycle_id   uuid not null references cycles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profil_id, ecole_id, cycle_id)
);

--  Il manquait, et c'est le chemin classe → niveau → cycle dont le
--  périmètre par cycle dépendra.
create index if not exists classes_niveau_idx on classes(niveau_id);

-- --- 2. La carte clé → boîte ------------------------------------------
--
--  ⚠️ BLOC GÉNÉRÉ depuis `FUSIONS` de `src/lib/acces.js`. Ne pas l'éditer à
--  la main : `test/acces.test.mjs` compare les deux et échoue s'ils
--  divergent.
--
--  Une boîte regroupe les écrans qui lisent LES MÊMES TABLES. Les séparer
--  donnerait un verrou d'affichage, pas un verrou de base — et une case qui
--  ne tient pas est un mensonge.
create or replace function public.boite_de_cle(p_cle text)
returns text language sql immutable as $fn$
  select case p_cle
    when 'appel' then 'presence_vie'
    when 'appel_sup' then 'presence_vie'
    when 'assiduite' then 'presence_vie'
    when 'vie_scolaire' then 'presence_vie'
    when 'notes' then 'notes_bulletins'
    when 'bulletins' then 'notes_bulletins'
    when 'classement' then 'notes_bulletins'
    when 'paiements' then 'encaissement'
    when 'recouvrement' then 'encaissement'
    else p_cle
  end;
$fn$;

-- --- 3. La fonction que les policies appelleront -----------------------
--
--  ⚠️ FAIL-CLOSED : pas de session, pas d'établissement courant, clé nulle
--  ⇒ faux. Et le promoteur a tout, INCONDITIONNELLEMENT et ici même — pas
--  dans l'appelant : c'est ce qui l'empêche de se verrouiller hors de sa
--  propre école en décochant une case.
create or replace function public.a_acces(p_cle text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_cle is not null and auth.uid() is not null and (
    est_super_admin() or a_role('admin_ecole')
    or exists (
      select 1 from personnel_acces pa
       where pa.profil_id = auth.uid()
         and pa.ecole_id = ecole_courante()
         and pa.boite = public.boite_de_cle(p_cle)
    )
  );
$fn$;
revoke execute on function public.a_acces(text) from public, anon;
grant execute on function public.a_acces(text) to authenticated;

-- --- 4. Ce que l'écran lit --------------------------------------------
create or replace function public.mes_acces()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'total', coalesce(est_super_admin() or a_role('admin_ecole'), false),
    'boites', coalesce((
      select jsonb_agg(pa.boite order by pa.boite) from personnel_acces pa
       where pa.profil_id = auth.uid() and pa.ecole_id = ecole_courante()
    ), '[]'::jsonb),
    'perimetre', coalesce((
      select pp.mode from personnel_perimetre pp
       where pp.profil_id = auth.uid() and pp.ecole_id = ecole_courante()
    ), 'ecole'),
    'cycles', coalesce((
      select jsonb_agg(pc.cycle_id) from personnel_cycles pc
       where pc.profil_id = auth.uid() and pc.ecole_id = ecole_courante()
    ), '[]'::jsonb)
  );
$fn$;
revoke execute on function public.mes_acces() from public, anon;
grant execute on function public.mes_acces() to authenticated;

-- --- 5. Les policies des trois tables ---------------------------------
alter table personnel_acces enable row level security;
alter table personnel_perimetre enable row level security;
alter table personnel_cycles enable row level security;

--  Lecture : soi-même, et les gestionnaires de membres (l'écran de
--  réglage en a besoin). Écriture : le promoteur seul — déléguer un accès
--  qu'on n'a pas soi-même viendra avec le flux d'invitation, pas avant.
do $$
declare t text;
begin
  foreach t in array array['personnel_acces', 'personnel_perimetre', 'personnel_cycles'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format($p$create policy %1$s_select on public.%1$I for select using (
        est_super_admin()
        or profil_id = auth.uid()
        or (ecole_id = ecole_courante()
            and (est_admin() or a_role('direction') or a_role('rh') or a_role('comptable'))));$p$, t);
    execute format('drop policy if exists %1$s_ecrire on public.%1$I;', t);
    execute format($p$create policy %1$s_ecrire on public.%1$I for all
      using (est_super_admin() or (ecole_id = ecole_courante() and est_admin()))
      with check (est_super_admin() or (ecole_id = ecole_courante() and est_admin()));$p$, t);
  end loop;
end $$;

-- --- 6. Le backfill : personne ne perd ni ne gagne un accès -----------
--
--  ⚠️ BLOC GÉNÉRÉ depuis `boitesDuModele()` de `src/lib/acces.js`, qui le
--  dérive lui-même de `ACCES` (permissions.js). Il n'y a donc qu'une
--  vérité, et `test/acces.test.mjs` vérifie qu'elle reproduit exactement
--  les droits actuels : pour chaque modèle et chaque écran,
--  `a_acces(cle)` doit rendre ce que `peutVoir(role, cle)` rendait.
--
--  Un seul écart est assumé, et il est documenté dans l'épreuve : le
--  secrétariat gagne l'ÉCRAN Recouvrement (il voyait déjà tous les impayés
--  depuis Paiements, et les deux lisent `factures`), mais pas l'ACTE de
--  relancer, qui reste tenu par le pouvoir `p_relancer`.
--
--  `admin_ecole` et `super_admin` ne reçoivent rien : `a_acces` leur rend
--  vrai sans condition. `parent` et `etudiant` ne sont pas du personnel.
with modeles(role, boites) as (values
    ('direction', array['_pedagogie', 'acquis', 'admissions', 'annonces', 'biblio_acquisitions', 'biblio_circulation', 'biblio_depots', 'biblio_inventaire', 'bibliotheque', 'cahier', 'codes_etudiants', 'codes_parents', 'deliberations_sup', 'eleves', 'emploi', 'emploi_sup', 'enseignants', 'filieres', 'fournitures', 'inscriptions_sup', 'membres', 'messagerie', 'notes_bulletins', 'notes_lmd', 'p_bulletins_diffuser', 'p_codes_parents', 'parametres', 'photos', 'presence_vie', 'programmation', 'progression', 'structure']),
    ('comptable', array['_gestion', 'annonces', 'biblio_acquisitions', 'biblio_inventaire', 'cantine', 'certificats', 'codes_etudiants', 'codes_parents', 'comptabilite', 'deliberations_sup', 'demandes', 'eleves', 'encaissement', 'inscriptions_sup', 'membres', 'messagerie', 'p_eleves_editer', 'p_relancer', 'parametres', 'transport']),
    ('secretaire', array['_gestion', 'admissions', 'annonces', 'bibliotheque', 'cantine', 'certificats', 'codes_etudiants', 'codes_parents', 'deliberations_sup', 'demandes', 'eleves', 'encaissement', 'inscriptions_sup', 'messagerie', 'p_eleves_editer', 'parametres', 'photos', 'transport']),
    ('enseignant', array['_pedagogie', 'acquis', 'bibliotheque', 'cahier', 'eleves', 'emploi', 'emploi_sup', 'fournitures', 'notes_bulletins', 'notes_lmd', 'presence_vie', 'progression']),
    ('surveillant', array['_pedagogie', 'cahier', 'eleves', 'presence_vie']),
    ('rh', array['enseignants', 'membres', 'rh']),
    ('bibliothecaire', array['biblio_acquisitions', 'biblio_circulation', 'biblio_depots', 'biblio_inventaire', 'bibliotheque'])
)
insert into personnel_acces (ecole_id, profil_id, boite)
select distinct pr.ecole_id, pr.profil_id, b
  from profil_roles pr
  join modeles m on m.role = pr.role::text
  cross join unnest(m.boites) as b
 where pr.ecole_id is not null
on conflict (profil_id, ecole_id, boite) do nothing;

--  Le périmètre de départ.
--
--  ⚠️ 'classes' POUR LE SEUL CAS OÙ C'EST DÉJÀ LA RÈGLE : un compte dont le
--  seul rôle métier est `enseignant`. La RLS le restreint déjà à ses
--  classes (`enseigne_classe`, mig. 058), donc écrire 'ecole' ici lui
--  élargirait le périmètre au moment de la bascule. Tous les autres —
--  direction, comptable, secrétariat, RH, surveillant, bibliothécaire —
--  voient aujourd'hui tout l'établissement : 'ecole'.
insert into personnel_perimetre (ecole_id, profil_id, mode)
select pr.ecole_id, pr.profil_id,
       case when bool_and(pr.role::text = 'enseignant') then 'classes' else 'ecole' end
  from profil_roles pr
 where pr.ecole_id is not null
   and pr.role::text in ('direction', 'comptable', 'secretaire', 'rh',
                         'enseignant', 'surveillant', 'bibliothecaire')
 group by pr.ecole_id, pr.profil_id
on conflict (profil_id, ecole_id) do nothing;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION (le mécanisme n'étant branché sur aucune policy, le retirer
-- est sans effet sur les droits)
-- =====================================================================
-- drop function if exists public.mes_acces();
-- drop function if exists public.a_acces(text);
-- drop function if exists public.boite_de_cle(text);
-- drop table if exists personnel_cycles;
-- drop table if exists personnel_perimetre;
-- drop table if exists personnel_acces;
-- drop index if exists classes_niveau_idx;
-- notify pgrst, 'reload schema';
