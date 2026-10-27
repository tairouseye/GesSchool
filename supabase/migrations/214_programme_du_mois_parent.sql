-- =====================================================================
--  214 — Le programme du mois chez le parent, au niveau RÉEL de l'enfant
--
--  Demande du promoteur (Tut'Tank, 27/10/2026), maquette validée
--  (docs/maquette-programme-parent.html) : la programmation officielle de
--  l'IEF, déjà chargée pour le cahier de textes, doit aussi apparaître chez
--  le parent, onglet Documents, et correspondre au niveau de SON enfant.
--
--  ⚠️ L'OBSTACLE : la programmation est rattachée au NIVEAU de la classe
--  (mig. 165), et chez Tut'Tank ce niveau est double — « CI/CP ». Le
--  programme du CI et celui du CP ne pouvaient donc pas coexister (unicité
--  niveau · année · mois · domaine), et un parent de CI aurait reçu celui du
--  CP. Depuis la mig. 164, l'élève porte son niveau réel (sous-niveau) ;
--  la programmation peut maintenant le porter aussi.
--
--    • `programmations.sous_niveau_id` : FACULTATIF. NULL = tout le niveau
--      (CM1, CM2, ou un programme commun aux deux niveaux de la classe).
--    • `importer_programmation(…, p_sous_niveau)` : le choix « CI / CP / les
--      deux » de l'écran d'import. Réimporter remplace la version du MÊME
--      sous-niveau, pas celle de l'autre.
--    • `enfant_programme(eleve, mois)` : la lecture côté parent, gardée par
--      `_parent_possede` (mig. 004/209). Programmes du niveau de la classe,
--      communs (sous-niveau NULL) ou du sous-niveau de l'enfant — jamais
--      ceux d'un autre sous-niveau.
--  Le personnel garde sa lecture par la RLS (mig. 165/193) : l'enseignante
--  d'une classe CI/CP voit les deux programmes, c'est voulu.
-- =====================================================================

-- --- 1. Le sous-niveau visé ----------------------------------------------
alter table programmations add column if not exists sous_niveau_id uuid
  references sous_niveaux(id) on delete cascade;
comment on column programmations.sous_niveau_id is
  'Niveau réel visé dans une classe double (CI dans « CI/CP »). NULL = tout le niveau (mig. 214).';

--  L'unicité tient compte du sous-niveau : le CI et le CP d'un même mois
--  coexistent. L'ancienne contrainte (mig. 165) part, quel que soit son nom.
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
     where con.conrelid = 'public.programmations'::regclass and con.contype = 'u'
  loop
    execute format('alter table public.programmations drop constraint %I', c);
  end loop;
end $$;
create unique index if not exists programmations_unique_sn on programmations
  (niveau_id, annee_id, mois, domaine, coalesce(sous_niveau_id, '00000000-0000-0000-0000-000000000000'::uuid));

--  Une FK garantit que le sous-niveau existe, pas qu'il appartient au niveau
--  de la programmation (même leçon que la mig. 164 pour les inscriptions).
create or replace function public._programmation_sous_niveau_coherent()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.sous_niveau_id is not null and not exists (
       select 1 from sous_niveaux sn where sn.id = new.sous_niveau_id and sn.niveau_id = new.niveau_id) then
    raise exception 'Ce niveau réel n''appartient pas au niveau de la programmation.';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_programmation_sous_niveau on programmations;
create trigger trg_programmation_sous_niveau before insert or update of sous_niveau_id, niveau_id
  on programmations for each row execute function public._programmation_sous_niveau_coherent();


-- --- 2. L'import : + le sous-niveau (corps de la 165) ---------------------
drop function if exists public.importer_programmation(uuid, uuid, int, text, jsonb);
create function public.importer_programmation(
  p_niveau uuid, p_annee uuid, p_mois int, p_source text, p_domaines jsonb,
  p_sous_niveau uuid default null
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
  if not exists (select 1 from annees_scolaires a where a.id = p_annee and a.ecole_id = v_ecole) then
    raise exception 'Année scolaire introuvable pour cet établissement.';
  end if;
  if p_sous_niveau is not null
     and not exists (select 1 from sous_niveaux sn where sn.id = p_sous_niveau and sn.niveau_id = p_niveau) then
    raise exception 'Ce niveau réel n''appartient pas au niveau choisi.';
  end if;
  if jsonb_typeof(p_domaines) <> 'array' or jsonb_array_length(p_domaines) = 0 then
    raise exception 'Aucun domaine à importer.';
  end if;

  for rec in select value as d from jsonb_array_elements(p_domaines) loop
    v_dom := nullif(trim(rec.d->>'domaine'), '');
    if v_dom is null then
      raise exception 'Un domaine sans nom ne peut pas être importé.';
    end if;
    if v_dom = any (v_faits) then
      raise exception 'Le domaine « % » apparaît deux fois dans le même import.', v_dom;
    end if;
    v_faits := v_faits || v_dom;
    if jsonb_typeof(rec.d->'lignes') <> 'array' then
      raise exception 'Le domaine « % » ne porte aucune ligne.', v_dom;
    end if;

    --  Remplace la version du MÊME sous-niveau (ou du niveau entier) : le
    --  programme du CP survit à un réimport de celui du CI.
    delete from programmations
     where niveau_id = p_niveau and annee_id = p_annee and mois = p_mois and domaine = v_dom
       and sous_niveau_id is not distinct from p_sous_niveau;

    insert into programmations (ecole_id, niveau_id, sous_niveau_id, annee_id, mois, domaine, source, importe_par)
    values (v_ecole, p_niveau, p_sous_niveau, p_annee, p_mois, v_dom, nullif(trim(p_source), ''), auth.uid())
    returning id into v_prog;
    if v_prog is null then
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
       and ((l->>'semaine') is null or (l->>'semaine')::int between 1 and 6);
    get diagnostics v_n = row_count;
    v_lignes := v_lignes + v_n;
  end loop;

  if v_lignes = 0 then
    raise exception 'Aucune ligne exploitable : vérifiez l''aperçu avant d''importer.';
  end if;
  return jsonb_build_object('programmations', v_progs, 'lignes', v_lignes);
end $fn$;
revoke execute on function public.importer_programmation(uuid, uuid, int, text, jsonb, uuid) from public, anon;
grant execute on function public.importer_programmation(uuid, uuid, int, text, jsonb, uuid) to authenticated;


-- --- 3. Côté parent : le programme du mois de SON enfant ------------------
--  Rend { niveau, mois, mois_disponibles: [10, 11…], domaines: [{ domaine,
--  lignes: [{ sous_domaine, theme, rubrique, activite, palier, semaine,
--  contenu }] }] }. `p_mois` NULL = le mois en cours s'il est publié, sinon
--  le dernier mois publié. Rien ne fuit d'un autre niveau : la sélection
--  part de l'inscription de l'enfant.
create or replace function public.enfant_programme(p_eleve uuid, p_mois int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_annee uuid; v_niveau uuid; v_sn uuid; v_lib text; v_mois int; v_dispo int[];
begin
  if not coalesce(public._parent_possede(p_eleve), false) then raise exception 'Accès refusé.'; end if;

  select a.id into v_annee from annees_scolaires a join eleves e on e.ecole_id = a.ecole_id
   where e.id = p_eleve and a.courante limit 1;
  select c.niveau_id, i.sous_niveau_id, coalesce(sn.libelle, n.libelle)
    into v_niveau, v_sn, v_lib
    from inscriptions i
    join classes c on c.id = i.classe_id
    left join niveaux n on n.id = c.niveau_id
    left join sous_niveaux sn on sn.id = i.sous_niveau_id
   where i.eleve_id = p_eleve and i.annee_id = v_annee
     and i.statut::text not in ('abandon', 'exclu', 'transfere')
   limit 1;
  if v_niveau is null then
    return jsonb_build_object('niveau', null, 'mois', null, 'mois_disponibles', '[]'::jsonb, 'domaines', '[]'::jsonb);
  end if;

  --  Les programmes de l'enfant : communs au niveau, ou de son niveau réel.
  select coalesce(array_agg(distinct p.mois), '{}') into v_dispo
    from programmations p
   where p.niveau_id = v_niveau and p.annee_id = v_annee
     and (p.sous_niveau_id is null or p.sous_niveau_id = v_sn);

  v_mois := coalesce(p_mois, extract(month from current_date)::int);
  if p_mois is null and not (v_mois = any (v_dispo)) then
    --  Le mois en cours n'est pas publié : le dernier mois publié de l'année
    --  scolaire (octobre → juillet), plutôt qu'un écran vide.
    select m into v_mois from unnest(v_dispo) m
     order by (m + 12 - 9) % 12 desc limit 1;
    v_mois := coalesce(v_mois, extract(month from current_date)::int);
  end if;

  return jsonb_build_object(
    'niveau', v_lib,
    'mois', v_mois,
    'mois_disponibles', to_jsonb(v_dispo),
    'domaines', coalesce((
      select jsonb_agg(jsonb_build_object('domaine', d.domaine, 'lignes', d.lignes) order by d.premier)
        from (
          select p.domaine, min(p.importe_le) as premier,
                 jsonb_agg(jsonb_build_object(
                   'sous_domaine', l.sous_domaine, 'theme', l.theme, 'rubrique', l.rubrique,
                   'activite', l.activite, 'palier', l.palier, 'semaine', l.semaine,
                   'contenu', l.contenu) order by l.ordre) as lignes
            from programmations p
            join programmation_lignes l on l.programmation_id = p.id
           where p.niveau_id = v_niveau and p.annee_id = v_annee and p.mois = v_mois
             and (p.sous_niveau_id is null or p.sous_niveau_id = v_sn)
           group by p.domaine
        ) d), '[]'::jsonb));
end $fn$;
revoke execute on function public.enfant_programme(uuid, int) from public, anon;
grant execute on function public.enfant_programme(uuid, int) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE : supabase/tests/essai_214_programme_parent.sql (tout est annulé).
--
--  ANNULATION
--   drop function if exists public.enfant_programme(uuid, int);
--   drop function if exists public.importer_programmation(uuid, uuid, int, text, jsonb, uuid);
--   puis réappliquer importer_programmation de la mig. 165 ;
--   drop trigger if exists trg_programmation_sous_niveau on programmations;
--   drop function if exists public._programmation_sous_niveau_coherent();
--   drop index if exists programmations_unique_sn;
--   (rétablir l'unicité de la 165 suppose qu'aucun mois n'ait deux
--    sous-niveaux importés) alter table programmations
--     add constraint programmations_niveau_id_annee_id_mois_domaine_key
--     unique (niveau_id, annee_id, mois, domaine);
--   alter table programmations drop column if exists sous_niveau_id;
-- =====================================================================
