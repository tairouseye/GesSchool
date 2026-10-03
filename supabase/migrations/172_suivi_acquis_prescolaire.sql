-- =====================================================================
--  172 — Le suivi des acquis, au préscolaire
--
--  Point 2 de la visite : « suivi pédagogique préscolaire ».
--
--  ⚠️ AU PRÉSCOLAIRE, ON NE NOTE PAS SUR 20. On OBSERVE. Un enfant de TPS
--  n'a pas une moyenne de 12,5 en langage : il « sait nommer les objets
--  usuels » — acquis, en cours d'acquisition, ou pas encore. Réutiliser
--  `notes` et `evaluations` aurait produit des bulletins chiffrés absurdes,
--  et surtout une CONVERSATION FAUSSE avec les familles : un parent qui lit
--  « 8/20 » à trois ans comprend un échec, là où l'enseignante voulait dire
--  « il y arrive bientôt ».
--
--  ⚠️ TROIS VALEURS, ET PAS DE QUATRIÈME « NON ÉVALUÉ ». L'absence
--  d'observation EST l'information « pas encore évalué » : une ligne
--  manquante le dit déjà. Ajouter une valeur explicite obligerait à créer
--  une observation pour chaque item non traité — des milliers de lignes
--  vides, et un travail de saisie sans objet.
--
--  ⚠️ LE RÉFÉRENTIEL APPARTIENT À L'ÉCOLE. On ne lui impose pas une liste
--  d'items : chaque établissement a ses propres intitulés, et le
--  curriculum évolue. Un modèle de départ est proposé (§5) mais il
--  s'INSÈRE sur demande — on ne crée rien dans son dos.
--
--  ⚠️ CE QUI EST VOLONTAIREMENT HORS PÉRIMÈTRE : l'impression du suivi sur
--  le bulletin. Le bulletin préscolaire mérite une mise en page propre, pas
--  une colonne de plus dans un modèle chiffré. À faire ensuite.
--
--  Prérequis : migrations 001, 018, 114 (consentement), 164 (sous-niveaux).
-- =====================================================================

-- --- 1. Les items observables ---------------------------------------------
--  `niveau_id` NULL = l'item vaut pour tout le cycle. C'est le cas courant
--  au préscolaire, où les mêmes domaines sont suivis de TPS à GS avec des
--  attentes croissantes — l'ÉCHELLE dit la progression, pas des items
--  différents par niveau.
create table if not exists acquis_items (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  cycle_id   uuid not null references cycles(id) on delete cascade,
  niveau_id  uuid references niveaux(id) on delete cascade,
  domaine    text not null,
  libelle    text not null,
  ordre      integer not null default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists acquis_items_idx on acquis_items(ecole_id, cycle_id, domaine, ordre);

comment on table acquis_items is
  'Referentiel d''observation du prescolaire : un item observable par domaine. Appartient a l''ecole (mig. 172).';

-- --- 2. Les observations ---------------------------------------------------
--  Une observation par enfant, par item, par période. La contrainte
--  d'unicité permet de CORRIGER sans empiler : une enseignante revient sur
--  son appréciation, elle ne crée pas une seconde ligne contradictoire.
create table if not exists acquis_observations (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  eleve_id    uuid not null references eleves(id) on delete cascade,
  item_id     uuid not null references acquis_items(id) on delete cascade,
  periode_id  uuid not null references periodes(id) on delete cascade,
  valeur      text not null check (valeur in ('non_acquis', 'en_cours', 'acquis')),
  observation text,
  saisi_par   uuid references profils(id) on delete set null,
  maj_le      timestamptz not null default now(),
  unique (eleve_id, item_id, periode_id)
);
create index if not exists acquis_obs_idx on acquis_observations(ecole_id, periode_id, eleve_id);
create index if not exists acquis_obs_item_idx on acquis_observations(item_id);

comment on column acquis_observations.valeur is
  'non_acquis | en_cours | acquis. L''ABSENCE de ligne signifie « pas encore evalue » (mig. 172).';

-- --- 3. RLS ----------------------------------------------------------------
alter table acquis_items enable row level security;
alter table acquis_observations enable row level security;

--  Lecture : tout le personnel de l'établissement. Les familles passent par
--  la RPC du §4, jamais par la table.
do $$
declare t text;
begin
  foreach t in array array['acquis_items','acquis_observations'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('create policy %1$s_select on public.%1$I for select using (est_super_admin() or ecole_id = ecole_courante());', t);
  end loop;
end $$;

--  Le RÉFÉRENTIEL est un acte de structure pédagogique : direction et
--  promoteur. Si chaque enseignante pouvait le réécrire, deux classes de GS
--  ne suivraient plus les mêmes acquis et le suivi perdrait son sens.
do $$
declare pred text := '(est_admin() or a_role(''direction''))';
begin
  execute 'drop policy if exists acquis_items_ins on public.acquis_items';
  execute 'drop policy if exists acquis_items_upd on public.acquis_items';
  execute 'drop policy if exists acquis_items_del on public.acquis_items';
  execute format('create policy acquis_items_ins on public.acquis_items for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy acquis_items_upd on public.acquis_items for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy acquis_items_del on public.acquis_items for delete using (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
end $$;

--  LES OBSERVATIONS, elles, sont le travail quotidien de la classe :
--  l'enseignante les saisit. Même périmètre que les absences (mig. 018) —
--  et c'est volontaire, car chez Tut'Tank ce sont les responsables
--  pédagogiques qui font le travail des enseignantes (cf. v2.230.0).
do $$
declare pred text := '(est_gestion() or a_role(''enseignant''))';
begin
  execute 'drop policy if exists acquis_obs_ins on public.acquis_observations';
  execute 'drop policy if exists acquis_obs_upd on public.acquis_observations';
  execute 'drop policy if exists acquis_obs_del on public.acquis_observations';
  execute format('create policy acquis_obs_ins on public.acquis_observations for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy acquis_obs_upd on public.acquis_observations for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy acquis_obs_del on public.acquis_observations for delete using (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
end $$;

-- --- 4. Ce que la famille voit ---------------------------------------------
--  ⚠️ LA GRILLE DE CONSENTEMENT DE LA MIGRATION 114 S'APPLIQUE. Un acquis
--  est une appréciation pédagogique sur l'enfant, au même titre qu'une
--  note : il passe donc par `_parent_possede` PUIS `_acces_notes_autorise`.
--  S'en dispenser aurait ouvert par la fenêtre ce que la 114 ferme à la
--  porte.
drop function if exists public.enfant_acquis(uuid, uuid);
create or replace function public.enfant_acquis(p_eleve uuid, p_periode uuid)
returns table(domaine text, libelle text, ordre int, valeur text, observation text)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;

  return query
  select i.domaine, i.libelle, i.ordre, o.valeur, o.observation
    from acquis_observations o
    join acquis_items i on i.id = o.item_id
   where o.eleve_id = p_eleve
     and (p_periode is null or o.periode_id = p_periode)
     --  On ne rend QUE ce qui a été observé : un référentiel de 60 items
     --  dont 3 renseignés ne doit pas afficher 57 lignes vides à la
     --  famille. L'absence est déjà une information, inutile de l'étaler.
   order by i.domaine, i.ordre, i.libelle;
end $fn$;
revoke execute on function public.enfant_acquis(uuid, uuid) from public, anon;
grant execute on function public.enfant_acquis(uuid, uuid) to authenticated;

-- --- 5. Un modèle de départ, inséré SUR DEMANDE ----------------------------
--  ⚠️ RIEN N'EST CRÉÉ DANS LE DOS DE L'ÉCOLE. Cette fonction ne s'exécute
--  que si la direction la demande, et elle NE TOUCHE À RIEN si un
--  référentiel existe déjà : on ne vient pas écraser le travail d'une
--  équipe pédagogique avec une liste générique.
--
--  Les domaines suivent le curriculum de l'éducation de base ; les
--  intitulés sont volontairement courts et observables, et l'école les
--  réécrit à sa main.
create or replace function public.charger_modele_acquis(p_cycle uuid)
returns integer language plpgsql security invoker set search_path = public as $fn$
declare v_ecole uuid; v_n integer;
begin
  select c.ecole_id into v_ecole from cycles c where c.id = p_cycle;
  if v_ecole is null then raise exception 'Cycle introuvable.'; end if;

  if exists (select 1 from acquis_items ai where ai.cycle_id = p_cycle) then
    raise exception 'Un référentiel existe déjà pour ce cycle : il n''a pas été modifié.';
  end if;

  insert into acquis_items (ecole_id, cycle_id, domaine, libelle, ordre)
  select v_ecole, p_cycle, d.domaine, l.libelle, l.ordre
    from (values
      ('Langage et communication', 1),
      ('Activités numériques', 2),
      ('Découverte du monde', 3),
      ('Vivre ensemble', 4),
      ('Activités physiques', 5),
      ('Activités artistiques', 6)
    ) as d(domaine, rang)
    join (values
      ('Langage et communication', 'Nommer les objets usuels', 1),
      ('Langage et communication', 'Écouter et comprendre une consigne simple', 2),
      ('Langage et communication', 'S''exprimer en phrases compréhensibles', 3),
      ('Langage et communication', 'Redire une comptine apprise', 4),
      ('Activités numériques', 'Compter jusqu''à 10', 1),
      ('Activités numériques', 'Reconnaître les chiffres de 1 à 10', 2),
      ('Activités numériques', 'Trier selon la couleur, la forme, la taille', 3),
      ('Découverte du monde', 'Reconnaître les parties du corps', 1),
      ('Découverte du monde', 'Distinguer les moments de la journée', 2),
      ('Découverte du monde', 'Nommer les animaux familiers', 3),
      ('Vivre ensemble', 'Respecter les règles de la classe', 1),
      ('Vivre ensemble', 'Partager et attendre son tour', 2),
      ('Vivre ensemble', 'Dire bonjour, merci, pardon', 3),
      ('Vivre ensemble', 'Aller aux toilettes seul(e)', 4),
      ('Activités physiques', 'Courir, sauter, grimper sans danger', 1),
      ('Activités physiques', 'Tenir correctement un crayon', 2),
      ('Activités physiques', 'Découper, coller, enfiler', 3),
      ('Activités artistiques', 'Chanter avec le groupe', 1),
      ('Activités artistiques', 'Dessiner, peindre librement', 2)
    ) as l(domaine, libelle, ordre)
      on l.domaine = d.domaine;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    --  La RLS a refusé : le dire, plutôt que de rendre 0 que l'écran
    --  afficherait comme un succès vide.
    raise exception 'Accès refusé : seule la direction peut charger un référentiel.';
  end if;
  return v_n;
end $fn$;
revoke execute on function public.charger_modele_acquis(uuid) from public, anon;
grant execute on function public.charger_modele_acquis(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • charger le modèle sur le cycle Préscolaire → 19 items, 6 domaines ;
--   • le recharger → REFUSÉ, et le référentiel existant intact ;
--   • un compte `enseignant` → peut saisir des observations, PAS modifier
--     le référentiel ;
--   • un compte `comptable` ou `rh` → ni l'un ni l'autre ;
--   • saisir deux fois le même item pour le même enfant et la même période
--     → CORRIGE la ligne (unicité), n'en crée pas une seconde ;
--   • 🔴 un parent n'accède PAS aux tables ; par la RPC il ne voit que SON
--     enfant, et seulement si le consentement de la mig. 114 l'autorise ;
--   • un enfant sans aucune observation → la RPC rend zéro ligne, et non
--     60 lignes vides.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.charger_modele_acquis(uuid);
-- drop function if exists public.enfant_acquis(uuid, uuid);
-- drop table if exists acquis_observations;
-- drop table if exists acquis_items;
