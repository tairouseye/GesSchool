-- =====================================================================
--  140 — Admissions : campagnes et candidatures (enseignement supérieur)
--
--  Aujourd'hui une université ne peut recruter qu'en saisissant elle-même
--  chaque dossier : `inscriptions_sup` (mig. 109) suppose un `eleve` qui
--  existe déjà. Tout ce qui précède l'inscription — le dépôt du dossier,
--  son examen, la décision — se passe hors de l'application, et la donnée
--  est retapée à l'arrivée.
--
--  ⚠️ POINT STRUCTURANT : un candidat N'A PAS DE COMPTE, et ne doit pas avoir
--  à en créer un pour postuler — c'est le premier point d'abandon d'un
--  portail d'admission. Le dépôt se fait donc en ANONYME, par des fonctions
--  `SECURITY DEFINER` accordées à `anon`, sur le précédent de
--  `verifier_document` (mig. 107). Les tables, elles, restent fermées :
--  `anon` n'a AUCUN accès direct.
--
--  Le candidat reçoit un `code_suivi` et consulte l'avancement de son
--  dossier sur une page publique — même idiome que les codes parents et
--  les codes étudiants déjà en place.
--
--  ⚠️ CE QUI RESTE OUVERT, dit franchement : un point d'entrée anonyme est
--  une surface de spam. Trois garde-fous ici — campagne explicitement
--  ouverte et datée, un seul dossier par e-mail et par campagne, longueurs
--  plafonnées — mais AUCUN n'arrête un attaquant déterminé qui ferait varier
--  l'adresse. Une limitation de débit exige une brique d'infrastructure
--  (Edge Function + compteur) : chantier séparé, à prévoir avant d'ouvrir
--  une campagne à grande échelle.
--
--  Prérequis : migrations 001, 108 (filières), 109 (inscriptions_sup).
-- =====================================================================

-- =====================================================================
--  1. CAMPAGNES
-- =====================================================================
create table if not exists admissions_campagnes (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  annee_id        uuid references annees_scolaires(id) on delete set null,
  libelle         text not null,
  niveau          text,                       -- L1, M1… le niveau recruté
  ouverte         boolean not null default false,
  date_ouverture  date,
  date_cloture    date,
  frais_dossier   numeric(12,2),
  message_accueil text,
  -- Compteur de numéros de dossier. Incrémenté par `update … returning`,
  -- donc sous verrou de ligne : deux dépôts simultanés ne peuvent pas
  -- recevoir le même numéro (ce qu'un `count(*) + 1` ne garantit pas).
  compteur        integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint admissions_campagnes_dates_chk
    check (date_cloture is null or date_ouverture is null or date_cloture >= date_ouverture)
);
create index if not exists admissions_campagnes_ecole_idx
  on admissions_campagnes(ecole_id, ouverte);

alter table admissions_campagnes enable row level security;
drop policy if exists admissions_campagnes_gestion on admissions_campagnes;
create policy admissions_campagnes_gestion on admissions_campagnes for all
  using (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('secretaire')))
  )
  with check (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('secretaire')))
  );

-- =====================================================================
--  2. CANDIDATURES
-- =====================================================================
create table if not exists candidatures (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid not null references ecoles(id) on delete cascade,
  campagne_id    uuid not null references admissions_campagnes(id) on delete cascade,
  numero         text not null,
  code_suivi     text not null,

  -- État civil (repris tel quel à la conversion : aucune ressaisie)
  prenom         text not null,
  nom            text not null,
  sexe           sexe,
  date_naissance date,
  lieu_naissance text,
  nationalite    text,
  telephone      text,
  email          text not null,
  adresse        text,

  -- Vœux : deux suffisent. Au-delà, l'arbitrage n'est plus automatisable
  -- et se règle en commission — inutile de modéliser plus.
  filiere_id     uuid references filieres(id) on delete set null,
  filiere_2_id   uuid references filieres(id) on delete set null,

  -- Parcours antérieur
  dernier_diplome      text,
  annee_diplome        integer,
  etablissement_origine text,
  mention              text,
  moyenne              numeric(4,2),
  motivation           text,

  statut       text not null default 'soumise'
               check (statut in ('soumise', 'en_examen', 'complement',
                                 'admise', 'liste_attente', 'refusee', 'inscrite')),
  motif        text,                                   -- motif de la décision
  decision_le  timestamptz,
  decideur_id  uuid references profils(id) on delete set null,

  -- Rempli à la conversion. Sa présence EST la preuve que le dossier a été
  -- transformé : c'est ce qui rend la conversion non rejouable.
  eleve_id     uuid references eleves(id) on delete set null,
  created_at   timestamptz not null default now()
);

create unique index if not exists candidatures_numero_idx on candidatures(ecole_id, numero);
create unique index if not exists candidatures_code_idx   on candidatures(code_suivi);
-- Un candidat, un dossier par campagne. Premier garde-fou anti-doublon,
-- et accessoirement anti-spam trivial.
create unique index if not exists candidatures_email_idx
  on candidatures(campagne_id, lower(email));
create index if not exists candidatures_liste_idx
  on candidatures(ecole_id, campagne_id, statut, created_at desc);

alter table candidatures enable row level security;
drop policy if exists candidatures_gestion on candidatures;
create policy candidatures_gestion on candidatures for all
  using (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('secretaire')))
  )
  with check (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('secretaire')))
  );

-- Horodatage de la décision. En trigger et non dans l'interface : une
-- décision datée par le client serait datée par l'horloge du client.
create or replace function public.trg_candidature_decision()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.statut is distinct from old.statut
     and new.statut in ('admise', 'liste_attente', 'refusee') then
    new.decision_le := now();
    new.decideur_id := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_candidature_decision on candidatures;
create trigger trg_candidature_decision
  before update on candidatures
  for each row execute function public.trg_candidature_decision();

-- =====================================================================
--  3. CÔTÉ CANDIDAT — anonyme
-- =====================================================================

-- --- Ce qu'un candidat voit avant de postuler ----------------------------
--  Expose le nom, le sigle et le logo de l'établissement à `anon` : c'est la
--  vitrine publique d'un portail d'admission, pas une fuite. Rien d'autre de
--  l'école n'est renvoyé, et seules les campagnes OUVERTES apparaissent.
create or replace function public.campagne_publique(p_ecole uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ecole', (select jsonb_build_object('nom', e.nom, 'sigle', e.sigle,
                                        'logo_url', e.logo_url, 'devise', e.devise)
                from ecoles e where e.id = p_ecole),
    'campagnes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'libelle', c.libelle, 'niveau', c.niveau,
               'date_cloture', c.date_cloture, 'frais_dossier', c.frais_dossier,
               'message_accueil', c.message_accueil) order by c.libelle)
        from admissions_campagnes c
       where c.ecole_id = p_ecole
         and c.ouverte
         and (c.date_ouverture is null or c.date_ouverture <= current_date)
         and (c.date_cloture   is null or c.date_cloture   >= current_date)
    ), '[]'::jsonb),
    'filieres', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'nom', f.nom,
                                          'sigle', f.sigle, 'diplome', f.diplome)
                       order by f.ordre, f.nom)
        from filieres f where f.ecole_id = p_ecole
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.campagne_publique(uuid) to anon, authenticated;

-- --- Dépôt d'un dossier ---------------------------------------------------
--  Entrée en jsonb, mais chaque champ est extrait NOMMÉMENT : une clé
--  inconnue dans la charge utile est ignorée, elle ne peut pas atteindre la
--  table. Les longueurs sont plafonnées — un point d'entrée anonyme ne doit
--  jamais accepter un texte de taille arbitraire.
create or replace function public.deposer_candidature(p_campagne uuid, p_candidat jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c        admissions_campagnes%rowtype;
  v_seq      integer;
  v_numero   text;
  v_code     text;
  v_email    text := lower(trim(coalesce(p_candidat->>'email', '')));
  v_prenom   text := trim(coalesce(p_candidat->>'prenom', ''));
  v_nom      text := trim(coalesce(p_candidat->>'nom', ''));
  v_tel      text := trim(coalesce(p_candidat->>'telephone', ''));
  v_f1       uuid := nullif(p_candidat->>'filiere_id', '')::uuid;
  v_f2       uuid := nullif(p_candidat->>'filiere_2_id', '')::uuid;
  v_sexe     text := nullif(p_candidat->>'sexe', '');
  v_motiv    text := trim(coalesce(p_candidat->>'motivation', ''));
begin
  select * into v_c from admissions_campagnes where id = p_campagne;
  if not found or not v_c.ouverte
     or (v_c.date_ouverture is not null and v_c.date_ouverture > current_date)
     or (v_c.date_cloture   is not null and v_c.date_cloture   < current_date) then
    raise exception 'Les candidatures ne sont pas ouvertes pour cette campagne.';
  end if;

  if v_prenom = '' or v_nom = '' then
    raise exception 'Le prénom et le nom sont obligatoires.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;
  if v_tel = '' then
    raise exception 'Le téléphone est obligatoire.';
  end if;
  if length(v_prenom) > 80 or length(v_nom) > 80 or length(v_email) > 160
     or length(v_tel) > 40 or length(v_motiv) > 4000 then
    raise exception 'Un des champs dépasse la longueur autorisée.';
  end if;
  if v_sexe is not null and v_sexe not in ('M', 'F') then
    raise exception 'Sexe invalide.';
  end if;

  -- Une filière d'une AUTRE école serait un dossier incohérent, et la
  -- vérifier ici évite de faire confiance à ce que le navigateur envoie.
  if v_f1 is not null and not exists
       (select 1 from filieres where id = v_f1 and ecole_id = v_c.ecole_id) then
    raise exception 'Filière inconnue pour cet établissement.';
  end if;
  if v_f2 is not null and not exists
       (select 1 from filieres where id = v_f2 and ecole_id = v_c.ecole_id) then
    raise exception 'Second vœu inconnu pour cet établissement.';
  end if;

  if exists (select 1 from candidatures
              where campagne_id = p_campagne and lower(email) = v_email) then
    raise exception 'Une candidature a déjà été déposée avec cette adresse e-mail.';
  end if;

  update admissions_campagnes set compteur = compteur + 1
   where id = p_campagne returning compteur into v_seq;

  v_numero := 'CAND-' || to_char(current_date, 'YYYY') || '-' || lpad(v_seq::text, 4, '0');
  v_code   := upper(substr(md5(gen_random_uuid()::text), 1, 8));

  insert into candidatures (
    ecole_id, campagne_id, numero, code_suivi,
    prenom, nom, sexe, date_naissance, lieu_naissance, nationalite,
    telephone, email, adresse, filiere_id, filiere_2_id,
    dernier_diplome, annee_diplome, etablissement_origine, mention, moyenne, motivation
  ) values (
    v_c.ecole_id, p_campagne, v_numero, v_code,
    v_prenom, v_nom, v_sexe::sexe,
    nullif(p_candidat->>'date_naissance', '')::date,
    left(nullif(trim(coalesce(p_candidat->>'lieu_naissance', '')), ''), 120),
    left(nullif(trim(coalesce(p_candidat->>'nationalite', '')), ''), 60),
    v_tel, v_email,
    left(nullif(trim(coalesce(p_candidat->>'adresse', '')), ''), 240),
    v_f1, v_f2,
    left(nullif(trim(coalesce(p_candidat->>'dernier_diplome', '')), ''), 120),
    nullif(p_candidat->>'annee_diplome', '')::integer,
    left(nullif(trim(coalesce(p_candidat->>'etablissement_origine', '')), ''), 160),
    left(nullif(trim(coalesce(p_candidat->>'mention', '')), ''), 40),
    nullif(p_candidat->>'moyenne', '')::numeric,
    nullif(v_motiv, '')
  );

  return jsonb_build_object('numero', v_numero, 'code_suivi', v_code);
end $$;
grant execute on function public.deposer_candidature(uuid, jsonb) to anon, authenticated;

-- --- Suivi d'un dossier ---------------------------------------------------
--  Renvoie NULL sur un code inconnu : ne jamais distinguer « code faux » de
--  « dossier absent », sinon le code devient énumérable.
create or replace function public.suivre_candidature(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'numero', c.numero, 'statut', c.statut,
           'prenom', c.prenom, 'nom', c.nom,
           'depose_le', c.created_at, 'decision_le', c.decision_le,
           'motif', c.motif,
           'ecole', e.nom, 'campagne', ca.libelle, 'niveau', ca.niveau,
           'filiere', f.nom)
    from candidatures c
    join ecoles e                on e.id  = c.ecole_id
    join admissions_campagnes ca on ca.id = c.campagne_id
    left join filieres f         on f.id  = c.filiere_id
   where c.code_suivi = upper(trim(p_code))
   limit 1;
$$;
grant execute on function public.suivre_candidature(text) to anon, authenticated;

-- =====================================================================
--  4. CONVERSION — le cœur de l'affaire
-- =====================================================================
--  Transformer un dossier admis en étudiant inscrit SANS ressaisie : c'est
--  la seule raison d'être du module. En RPC et non côté interface, pour que
--  la création de l'élève, celle de l'inscription et la mise à jour du
--  dossier réussissent ou échouent ensemble.
create or replace function public.convertir_candidature(p_id uuid, p_annee uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_c     candidatures%rowtype;
  v_eleve uuid;
  v_mat   text;
  v_niv   text;
begin
  select * into v_c from candidatures where id = p_id;
  if not found then
    raise exception 'Candidature introuvable.';
  end if;

  if not (est_super_admin()
          or (v_c.ecole_id = ecole_courante()
              and (est_admin() or a_role('direction') or a_role('secretaire')))) then
    raise exception 'Réservé à la scolarité de l''établissement.';
  end if;

  if v_c.eleve_id is not null then
    raise exception 'Ce dossier a déjà été transformé en inscription.';
  end if;
  if v_c.statut <> 'admise' then
    raise exception 'Seul un dossier ADMIS peut être inscrit.';
  end if;
  if v_c.filiere_id is null then
    raise exception 'Choisissez une filière avant d''inscrire ce candidat.';
  end if;

  begin
    v_mat := prochain_matricule();
  exception when others then
    v_mat := null;             -- format de matricule non configuré : sans blocage
  end;

  insert into eleves (ecole_id, matricule, prenom, nom, sexe, date_naissance,
                      lieu_naissance, nationalite, adresse, telephone)
  values (v_c.ecole_id, v_mat, v_c.prenom, v_c.nom, v_c.sexe, v_c.date_naissance,
          v_c.lieu_naissance, v_c.nationalite, v_c.adresse, v_c.telephone)
  returning id into v_eleve;

  select niveau into v_niv from admissions_campagnes where id = v_c.campagne_id;

  insert into inscriptions_sup (ecole_id, eleve_id, filiere_id, niveau, annee_id, statut)
  values (v_c.ecole_id, v_eleve, v_c.filiere_id, v_niv,
          coalesce(p_annee, (select id from annees_scolaires
                              where ecole_id = v_c.ecole_id and courante limit 1)),
          'active');

  update candidatures set statut = 'inscrite', eleve_id = v_eleve where id = p_id;

  return v_eleve;
end $$;
revoke execute on function public.convertir_candidature(uuid, uuid) from public, anon;
grant execute on function public.convertir_candidature(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE après application
--   • anon : select sur `candidatures` → 0 ligne (table fermée)
--   • anon : deposer_candidature sur une campagne fermée → exception
--   • même e-mail deux fois sur une campagne → exception
--   • enseignant : select sur `candidatures` → 0 ligne
--   • conversion d'un dossier non « admise » → exception
--   • conversion deux fois → exception, et UN SEUL élève créé
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.convertir_candidature(uuid, uuid);
-- drop function if exists public.suivre_candidature(text);
-- drop function if exists public.deposer_candidature(uuid, jsonb);
-- drop function if exists public.campagne_publique(uuid);
-- drop trigger  if exists trg_candidature_decision on candidatures;
-- drop function if exists public.trg_candidature_decision();
-- drop table if exists candidatures cascade;
-- drop table if exists admissions_campagnes cascade;
