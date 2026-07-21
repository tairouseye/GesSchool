-- =====================================================================
--  059 — Localisation de l'établissement (pays / ville) à la création
--
--  Problème : la colonne `ecoles.pays` existe avec le défaut « Sénégal »,
--  mais elle n'est renseignée NULLE PART — ni à l'onboarding (cette
--  fonction n'a pas de paramètre pays), ni dans Paramètres. Idem pour
--  `ville`. Conséquence pour les écoles hors Sénégal (Mali, Burkina,
--  Côte d'Ivoire…) :
--    - les documents officiels affichent « Sénégal » (DocumentOfficiel.jsx),
--    - les bulletins impriment « Fait à — » (ville vide).
--
--  Correctif : `creer_ecole_et_admin` accepte `p_pays` et `p_ville`.
--  Les deux ont une valeur par défaut → les appels existants restent
--  valides, mais on supprime d'abord l'ancienne signature pour éviter
--  une surcharge ambiguë (14 args vs 16 args à défauts).
--
--  Aucune donnée touchée : la fonction est recréée, rien n'est supprimé.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Retire toute version existante, quelle que soit sa signature.
--  (Même patron qu'en 017 : on ne peut pas « create or replace » une
--   fonction dont on change la liste des paramètres.)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'creer_ecole_et_admin'
  loop
    execute 'drop function ' || r.sig::text || ';';
  end loop;
end $$;

create or replace function creer_ecole_et_admin(
  p_nom                text,
  p_sigle              text,
  p_type_etablissement text,
  p_cycles             type_cycle[],
  p_couleur_primaire   text,
  p_couleur_secondaire text,
  p_logo_url           text,
  p_cachet_url         text,
  p_prenom             text,
  p_nom_admin          text,
  p_annee_libelle      text,
  p_annee_debut        date,
  p_annee_fin          date,
  p_decoupage          text,
  p_pays               text default 'Sénégal',
  p_ville              text default null,
  p_devise             text default 'XOF'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_ecole  uuid;
  v_annee  uuid;
  v_cycle  type_cycle;
  v_ordre  int := 0;
  v_nb     int;
  i        int;
begin
  if v_uid is null then
    raise exception 'Non authentifié.';
  end if;

  -- Bloque uniquement si déjà rattaché ET pas (encore) promoteur.
  if exists (select 1 from profils where id = v_uid and ecole_id is not null)
     and not exists (select 1 from proprietaires where profil_id = v_uid) then
    raise exception 'Ce compte est déjà rattaché à un établissement.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into ecoles (nom, sigle, type_etablissement, cycles_actifs,
                      couleur_primaire, couleur_secondaire, logo_url, cachet_url, email,
                      pays, ville, devise)
  values (p_nom, p_sigle, p_type_etablissement, coalesce(p_cycles, '{}'),
          coalesce(p_couleur_primaire, '#0B1F3A'),
          coalesce(p_couleur_secondaire, '#C9A227'),
          p_logo_url, p_cachet_url, v_email,
          coalesce(nullif(trim(p_pays), ''), 'Sénégal'),
          nullif(trim(p_ville), ''),
          coalesce(nullif(trim(p_devise), ''), 'XOF'))
  returning id into v_ecole;

  foreach v_cycle in array coalesce(p_cycles, '{}') loop
    v_ordre := v_ordre + 1;
    insert into cycles (ecole_id, type, libelle, ordre)
    values (v_ecole, v_cycle, libelle_cycle(v_cycle), v_ordre);
  end loop;

  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, v_ecole, coalesce(p_prenom, 'Admin'), coalesce(p_nom_admin, ''), v_email)
  on conflict (id) do update
    set ecole_id = excluded.ecole_id, prenom = excluded.prenom,
        nom = excluded.nom, email = excluded.email;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_ecole, 'admin_ecole')
  on conflict (profil_id, ecole_id, role) do nothing;

  -- Rattache la nouvelle école au promoteur
  insert into proprietaires (profil_id, ecole_id)
  values (v_uid, v_ecole)
  on conflict do nothing;

  insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante)
  values (v_ecole, p_annee_libelle, p_annee_debut, p_annee_fin, true)
  returning id into v_annee;

  v_nb := case when p_decoupage = 'semestre' then 2 else 3 end;
  for i in 1..v_nb loop
    insert into periodes (ecole_id, annee_id, libelle, ordre)
    values (v_ecole, v_annee,
      case when p_decoupage = 'semestre' then 'Semestre ' else 'Trimestre ' end || i, i);
  end loop;

  return v_ecole;
end;
$$;

grant execute on function creer_ecole_et_admin(
  text, text, text, type_cycle[], text, text, text, text,
  text, text, text, date, date, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION (à copier-coller pour revenir à l'état d'avant 059)
--  Rien à restaurer côté données : seule la fonction change. Il suffit de
--  supprimer la nouvelle signature puis de rejouer le bloc
--  `creer_ecole_et_admin` de la migration 010_pilotage_multi_ecoles.sql.
--
--    do $$
--    declare r record;
--    begin
--      for r in
--        select p.oid::regprocedure as sig
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'creer_ecole_et_admin'
--      loop execute 'drop function ' || r.sig::text || ';'; end loop;
--    end $$;
--    -- puis : rejouer 010_pilotage_multi_ecoles.sql (bloc creer_ecole_et_admin)
--    notify pgrst, 'reload schema';
-- =====================================================================
