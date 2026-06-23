-- =====================================================================
--  002 — Onboarding établissement
--  Fonction SECURITY DEFINER qui crée en une transaction :
--    école + cycles + profil admin + rôle admin_ecole + année + périodes.
--  Nécessaire car l'utilisateur n'a pas encore de profil → les RLS
--  (ecole_courante()) le bloqueraient pour ces tout premiers inserts.
--  + Bucket Storage 'ecoles' (logos / cachets).
-- =====================================================================

-- ---------------------------------------------------------------------
--  Storage : bucket public pour logos & cachets
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ecoles', 'ecoles', true)
on conflict (id) do nothing;

-- Lecture publique des assets d'école
drop policy if exists "ecoles_assets_lecture" on storage.objects;
create policy "ecoles_assets_lecture" on storage.objects
  for select using (bucket_id = 'ecoles');

-- Upload réservé aux utilisateurs authentifiés
drop policy if exists "ecoles_assets_upload" on storage.objects;
create policy "ecoles_assets_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'ecoles');

drop policy if exists "ecoles_assets_maj" on storage.objects;
create policy "ecoles_assets_maj" on storage.objects
  for update to authenticated using (bucket_id = 'ecoles');

-- ---------------------------------------------------------------------
--  Libellé par défaut d'un cycle
-- ---------------------------------------------------------------------
create or replace function libelle_cycle(p type_cycle)
returns text language sql immutable as $$
  select case p
    when 'prescolaire'   then 'Préscolaire'
    when 'premier_cycle' then 'Élémentaire'
    when 'second_cycle'  then 'Collège'
    when 'lycee'         then 'Lycée'
    when 'formation_pro' then 'Formation professionnelle'
    when 'universite'    then 'Université'
  end
$$;

-- ---------------------------------------------------------------------
--  Onboarding : crée l'école et rattache l'utilisateur courant en admin
-- ---------------------------------------------------------------------
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
  p_decoupage          text          -- 'trimestre' | 'semestre'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  -- Refuser si l'utilisateur est déjà rattaché à une école
  if exists (select 1 from profils where id = v_uid and ecole_id is not null) then
    raise exception 'Ce compte est déjà rattaché à un établissement.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- 1) École
  insert into ecoles (nom, sigle, type_etablissement, cycles_actifs,
                      couleur_primaire, couleur_secondaire, logo_url, cachet_url, email)
  values (p_nom, p_sigle, p_type_etablissement, coalesce(p_cycles, '{}'),
          coalesce(p_couleur_primaire, '#0B1F3A'),
          coalesce(p_couleur_secondaire, '#C9A227'),
          p_logo_url, p_cachet_url, v_email)
  returning id into v_ecole;

  -- 2) Cycles activés
  foreach v_cycle in array coalesce(p_cycles, '{}') loop
    v_ordre := v_ordre + 1;
    insert into cycles (ecole_id, type, libelle, ordre)
    values (v_ecole, v_cycle, libelle_cycle(v_cycle), v_ordre);
  end loop;

  -- 3) Profil admin (upsert sur l'id auth)
  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, v_ecole, coalesce(p_prenom, 'Admin'), coalesce(p_nom_admin, ''), v_email)
  on conflict (id) do update
    set ecole_id = excluded.ecole_id,
        prenom   = excluded.prenom,
        nom      = excluded.nom,
        email    = excluded.email;

  -- 4) Rôle admin_ecole
  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_ecole, 'admin_ecole')
  on conflict (profil_id, ecole_id, role) do nothing;

  -- 5) Année scolaire courante
  insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante)
  values (v_ecole, p_annee_libelle, p_annee_debut, p_annee_fin, true)
  returning id into v_annee;

  -- 6) Périodes (3 trimestres ou 2 semestres)
  v_nb := case when p_decoupage = 'semestre' then 2 else 3 end;
  for i in 1..v_nb loop
    insert into periodes (ecole_id, annee_id, libelle, ordre)
    values (
      v_ecole, v_annee,
      case when p_decoupage = 'semestre' then 'Semestre ' else 'Trimestre ' end || i,
      i
    );
  end loop;

  return v_ecole;
end;
$$;

-- Exécutable par tout utilisateur authentifié (la fonction se protège elle-même)
grant execute on function creer_ecole_et_admin(
  text, text, text, type_cycle[], text, text, text, text, text, text, text, date, date, text
) to authenticated;
