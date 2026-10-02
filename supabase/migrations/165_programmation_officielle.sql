-- =====================================================================
--  165 — La programmation officielle, chargée depuis le document de l'IEF
--
--  Point 15 de la visite : « l'enseignant devrait pouvoir réutiliser les
--  éléments de programmation plutôt que les ressaisir ». L'école a fourni
--  le document source — la planification mensuelle de l'IEF de Sangalkam —
--  et confirmé qu'il s'agit du modèle OFFICIEL, de forme stable, rattaché à
--  un COURS (un niveau) et non à une classe.
--
--  Structure réelle du document, relevée sur l'exemplaire fourni :
--      Mois · Cours (niveau)
--      └── Domaine          « Langue et communication »
--          └── Sous-domaine « COMMUNICATION ORALE », « PRODUCTION DE TEXTES »
--              └── Activité Expression orale, Récitation, Vocabulaire…
--                  └── Palier, puis une cellule par SEMAINE (1 à 4)
--
--  ⚠️ ON NE FORCE PAS LA DISTINCTION OA / OS. Le document ne l'applique pas
--  régulièrement : certaines cellules portent « OA Faire agir », d'autres
--  « OS Donner des conseils… », d'autres une activité en clair
--  (« Apprendre une récitation sur l'environnement »). Inventer deux
--  colonnes obligerait l'analyseur à deviner, et il devinerait mal. On
--  stocke le CONTENU de la cellule tel qu'il est écrit : c'est ce que
--  l'enseignante lit, et ce qu'elle reportera dans son cahier.
--
--  ⚠️ CORRECTIONS APPORTÉES APRÈS LECTURE DU DOCUMENT RÉEL. La première
--  version de cette migration supposait une hiérarchie que le document ne
--  respecte pas. Trois écarts, tous constatés sur l'exemplaire fourni :
--
--   1. Le tableau ne nomme que DEUX sous-domaines, et il les MARQUE
--      (« Sous-domaine 1COMMUNICATION ORALE », « Sous -domaine 2 »). Les
--      titres en capitales qui suivent — « LECTURE », « PRODUCTION DE
--      TEXTES » — sont des RUBRIQUES internes. D'où la colonne `rubrique` :
--      sans elle, « COMMUNICATION ECRITE » disparaissait du classement,
--      écrasée par la rubrique posée juste après.
--   2. Le marqueur porte parfois le THÈME du mois à côté de lui
--      (« LECTURE DE TEXTES INJONCTIFS ») et non le nom du sous-domaine.
--      D'où la colonne `theme` : c'est un renseignement que l'enseignante
--      lit sur son document, le perdre serait appauvrir la reprise.
--   3. Des cellules sont FUSIONNÉES : une ligne de 2 cellules dans un
--      tableau de 5 colonnes ne dit pas quelle semaine elle couvre. D'où
--      `semaine` NULLABLE = « tout le mois ». Inventer une semaine 1 pour
--      ces lignes était le défaut le plus grave : le palier du mois
--      (183 caractères d'intention pédagogique) passait pour une séance.
--
--  ⚠️ RATTACHÉ AU NIVEAU, PAS À LA CLASSE. Une planification CM1 vaut pour
--  CM1 A comme pour CM1 B — l'école l'a confirmé. La saisir deux fois serait
--  exactement la ressaisie qu'on cherche à supprimer.
--
--  Prérequis : migrations 001, 023 (cahier_textes), 033.
-- =====================================================================

-- --- 1. Une planification : un niveau, un mois, un domaine ----------------
create table if not exists programmations (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  niveau_id  uuid not null references niveaux(id) on delete cascade,
  annee_id   uuid not null references annees_scolaires(id) on delete cascade,
  mois       integer not null check (mois between 1 and 12),
  domaine    text not null,
  -- Trace de l'origine : savoir d'où vient un contenu officiel compte
  -- autant que le contenu lui-même.
  source     text,
  importe_le timestamptz not null default now(),
  importe_par uuid references profils(id) on delete set null,
  unique (niveau_id, annee_id, mois, domaine)
);
create index if not exists programmations_idx on programmations(ecole_id, niveau_id, annee_id, mois);

comment on table programmations is
  'Planification mensuelle officielle (IEF), par niveau et par domaine. Importée depuis le document Word (mig. 165).';

-- --- 2. Ses lignes, une par activité et par semaine -----------------------
create table if not exists programmation_lignes (
  id               uuid primary key default gen_random_uuid(),
  ecole_id         uuid not null references ecoles(id) on delete cascade,
  programmation_id uuid not null references programmations(id) on delete cascade,
  sous_domaine     text,
  theme            text,
  rubrique         text,
  activite         text,
  palier           text,
  --  NULL = « tout le mois » : le document fusionne des cellules sur les
  --  quatre semaines, et on refuse d'inventer laquelle il visait.
  semaine          integer check (semaine is null or semaine between 1 and 6),
  contenu          text not null,
  ordre            integer not null default 0
);
create index if not exists programmation_lignes_idx on programmation_lignes(programmation_id, semaine, ordre);

comment on column programmation_lignes.contenu is
  'Le texte de la cellule, tel qu''écrit dans le document officiel — OA, OS ou activité en clair (mig. 165).';
comment on column programmation_lignes.rubrique is
  'Titre en capitales interne au sous-domaine : « LECTURE », « PRODUCTION DE TEXTES » (mig. 165).';
comment on column programmation_lignes.theme is
  'Thème du bloc, écrit à côté du marqueur de sous-domaine : « LECTURE DE TEXTES INJONCTIFS » (mig. 165).';
comment on column programmation_lignes.semaine is
  'Semaine 1-6, ou NULL quand la cellule du document est fusionnée sur le mois (mig. 165).';

-- --- 3. Le cahier de textes peut citer une ligne de programmation ---------
--  C'est tout l'objet du point 15 : choisir au lieu de ressaisir. Le lien
--  est FACULTATIF — une séance improvisée, un rattrapage, une sortie
--  n'ont pas de ligne officielle, et doivent rester saisissables librement.
alter table cahier_textes add column if not exists programmation_ligne_id uuid
  references programmation_lignes(id) on delete set null;
create index if not exists cahier_textes_prog_idx on cahier_textes(programmation_ligne_id);

-- --- 4. RLS ---------------------------------------------------------------
alter table programmations enable row level security;
alter table programmation_lignes enable row level security;

--  Lecture : tout le personnel de l'établissement. Les enseignantes en ont
--  besoin pour remplir leur cahier — c'est le but.
do $$
declare t text;
begin
  foreach t in array array['programmations','programmation_lignes'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('create policy %1$s_select on public.%1$I for select using (est_super_admin() or ecole_id = ecole_courante());', t);
  end loop;
end $$;

--  Écriture : promoteur et responsable pédagogique. La planification d'un
--  niveau est PARTAGÉE par toutes ses classes : si chaque enseignante
--  pouvait la réécrire, celle de CM1 A écraserait celle de CM1 B. C'est un
--  acte de structure, pas un acte de classe.
do $$
declare t text; pred text := '(est_admin() or a_role(''direction''))';
begin
  foreach t in array array['programmations','programmation_lignes'] loop
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);
    execute format('create policy %1$s_ins on public.%1$I for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
    execute format('create policy %1$s_upd on public.%1$I for update using (est_super_admin() or (ecole_id = ecole_courante() and %2$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
    execute format('create policy %1$s_del on public.%1$I for delete using (est_super_admin() or (ecole_id = ecole_courante() and %2$s));', t, pred);
  end loop;
end $$;

-- --- 5. Importer un mois entier, en une seule transaction ------------------
--  ⚠️ LE DOCUMENT PORTE PLUSIEURS DOMAINES DANS UN SEUL TABLEAU : celui de
--  l'école enchaîne « Langue et communication », « MATHEMATIQUES », « ESVS »
--  et « EPSA ». La fonction reçoit donc TOUS les domaines du mois et les
--  écrit ensemble. Un appel par domaine laisserait, en cas d'échec au
--  troisième, un mois à moitié importé — et personne pour s'en apercevoir.
--
--  Réimporter le même mois REMPLACE, n'empile pas : un document corrigé par
--  l'IEF ne doit pas laisser l'ancienne version à côté de la nouvelle.
--
--  p_domaines : [{ "domaine": "...", "lignes": [{ sous_domaine, theme,
--                  rubrique, activite, palier, semaine, contenu, ordre }] }]
create or replace function public.importer_programmation(
  p_niveau uuid, p_annee uuid, p_mois int, p_source text, p_domaines jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $fn$
declare
  v_ecole uuid; v_prog uuid; v_dom text; rec record;
  v_progs int := 0; v_lignes int := 0; v_n int;
  v_faits text[] := '{}';
begin
  select n.ecole_id into v_ecole from niveaux n where n.id = p_niveau;
  if v_ecole is null then raise exception 'Niveau introuvable.'; end if;
  if p_mois is null or p_mois < 1 or p_mois > 12 then
    raise exception 'Le mois est obligatoire.';
  end if;
  --  ⚠️ L'année doit appartenir à l'école du niveau. Sans ce contrôle, une
  --  direction pourrait accrocher sa programmation à l'année scolaire d'un
  --  AUTRE établissement : la RLS ne le verrait pas, puisqu'elle ne vérifie
  --  que `ecole_id`, qui vient du niveau. Même leçon que les clés étrangères
  --  composites de l'audit bibliothèque (mig. 127) : une FK garantit que la
  --  ligne existe, pas qu'elle appartient au bon établissement.
  if not exists (select 1 from annees_scolaires a where a.id = p_annee and a.ecole_id = v_ecole) then
    raise exception 'Année scolaire introuvable pour cet établissement.';
  end if;
  if jsonb_typeof(p_domaines) <> 'array' or jsonb_array_length(p_domaines) = 0 then
    raise exception 'Aucun domaine à importer.';
  end if;

  for rec in select value as d from jsonb_array_elements(p_domaines) loop
    v_dom := nullif(trim(rec.d->>'domaine'), '');
    if v_dom is null then
      raise exception 'Un domaine sans nom ne peut pas être importé.';
    end if;
    --  ⚠️ Un domaine répété dans la même charge utile ne doit PAS passer :
    --  le `delete` ci-dessous effacerait la programmation insérée au tour
    --  précédent, et seul le dernier bloc survivrait — en silence.
    if v_dom = any (v_faits) then
      raise exception 'Le domaine « % » apparaît deux fois dans le même import.', v_dom;
    end if;
    v_faits := v_faits || v_dom;
    if jsonb_typeof(rec.d->'lignes') <> 'array' then
      raise exception 'Le domaine « % » ne porte aucune ligne.', v_dom;
    end if;

    --  L'ancienne version part d'abord : ses lignes suivent en cascade.
    delete from programmations
     where niveau_id = p_niveau and annee_id = p_annee and mois = p_mois and domaine = v_dom;

    insert into programmations (ecole_id, niveau_id, annee_id, mois, domaine, source, importe_par)
    values (v_ecole, p_niveau, p_annee, p_mois, v_dom, nullif(trim(p_source), ''), auth.uid())
    returning id into v_prog;
    if v_prog is null then
      --  La RLS a refusé l'insertion : le dire, plutôt que de rendre un
      --  identifiant nul que l'appelant prendrait pour un succès.
      raise exception 'Accès refusé : seule la direction peut importer une programmation.';
    end if;
    v_progs := v_progs + 1;

    insert into programmation_lignes (ecole_id, programmation_id, sous_domaine, theme, rubrique,
                                     activite, palier, semaine, contenu, ordre)
    select v_ecole, v_prog,
           nullif(trim(l->>'sous_domaine'), ''),
           nullif(trim(l->>'theme'), ''),
           nullif(trim(l->>'rubrique'), ''),
           nullif(trim(l->>'activite'), ''),
           nullif(trim(l->>'palier'), ''),
           (l->>'semaine')::int,
           trim(l->>'contenu'),
           coalesce((l->>'ordre')::int, 0)
      from jsonb_array_elements(rec.d->'lignes') l
     where coalesce(trim(l->>'contenu'), '') <> ''
       --  Une semaine absente est LÉGITIME (cellule fusionnée). Seule une
       --  semaine hors bornes est écartée. ⚠️ Écrire « between 1 and 6 »
       --  seul rejetterait les lignes « tout le mois » : la comparaison
       --  rend NULL, donc faux, et elles disparaîtraient en silence.
       and ((l->>'semaine') is null or (l->>'semaine')::int between 1 and 6);
    get diagnostics v_n = row_count;
    v_lignes := v_lignes + v_n;
  end loop;

  if v_lignes = 0 then
    raise exception 'Aucune ligne exploitable : vérifiez l''aperçu avant d''importer.';
  end if;
  return jsonb_build_object('programmations', v_progs, 'lignes', v_lignes);
end $fn$;
revoke execute on function public.importer_programmation(uuid, uuid, int, text, jsonb) from public, anon;
grant execute on function public.importer_programmation(uuid, uuid, int, text, jsonb) to authenticated;

-- --- 6. Supprimer une programmation ---------------------------------------
--  La RLS suffit, mais on passe par une fonction pour que l'écran reçoive un
--  refus EXPLICITE : un `delete` bloqué par la RLS rend « 0 ligne touchée »,
--  que l'interface afficherait comme un succès.
create or replace function public.supprimer_programmation(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $fn$
begin
  delete from programmations where id = p_id;
  if not found then
    raise exception 'Programmation introuvable, ou vous n''avez pas le droit de la supprimer.';
  end if;
end $fn$;
revoke execute on function public.supprimer_programmation(uuid) from public, anon;
grant execute on function public.supprimer_programmation(uuid) to authenticated;


notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • importer le document CM1 d'avril → QUATRE programmations (Langue et
--     communication, MATHEMATIQUES, ESVS, EPSA) et une cinquantaine de
--     lignes, en un seul appel ;
--   • réimporter le même mois → remplace domaine par domaine, n'empile pas ;
--   • un domaine absent du nouvel import garde son ancienne version : on ne
--     supprime que ce qu'on réécrit ;
--   • un compte enseignant ou comptable → import refusé, lecture permise ;
--   • une année scolaire d'une AUTRE école → refusé ;
--   • le même domaine deux fois dans le même import → refusé explicitement
--     (et non silencieusement réduit au dernier) ;
--   • une ligne sans contenu, ou une semaine hors 1-6 → écartée sans faire
--     échouer l'import ; aucune ligne exploitable du tout → refus explicite ;
--   • une ligne SANS semaine (cellule fusionnée) → conservée, rangée en
--     « tout le mois » ; c'est le cas du palier et de « Copier des textes »
--     dans l'exemplaire fourni ;
--   • supprimer une programmation → les séances du cahier de textes qui la
--     citaient restent, leur lien passe à NULL (rien n'est perdu).
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.supprimer_programmation(uuid);
-- drop function if exists public.importer_programmation(uuid, uuid, int, text, jsonb);
-- alter table cahier_textes drop column if exists programmation_ligne_id;
-- drop table if exists programmation_lignes;
-- drop table if exists programmations;
