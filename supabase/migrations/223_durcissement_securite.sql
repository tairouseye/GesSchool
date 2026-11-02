-- =====================================================================
--  223 — Durcissement de sécurité (audit du 02/11/2026)
--
--  L'audit a confirmé le cloisonnement (aucune ligne d'une autre école sur
--  140 tables, aucun accès d'un parent à un enfant qui n'est pas le sien,
--  aucune élévation de rôle). Il a trouvé quatre trous, fermés ici :
--
--   1. Le promoteur pouvait écrire `modules_actifs` (et `demonstration`,
--      `id`) dans SA ligne `ecoles` : débloquer des modules payants sans
--      payer. → déclencheur : les modules restent dans l'offre souscrite,
--      `demonstration` et `id` au super-administrateur.
--   2. Stockage `ecoles` (logos, CACHETS) : tout compte connecté, même un
--      parent, pouvait remplacer ou supprimer les fichiers de N'IMPORTE
--      QUELLE école. Le cachet s'imprime sur les attestations et les reçus.
--      → écriture limitée au dossier de sa propre école (direction), au
--      dossier de l'utilisateur (logo choisi pendant la création de
--      l'école), et aux encarts partenaires pour le super-administrateur.
--   3. Codes d'accès (parents, enseignants, étudiants, invitations) :
--      8 caractères hexadécimaux tirés de random(), et un code DÉJÀ SERVI
--      restait valable — qui le retrouvait (groupe WhatsApp) prenait la
--      place du parent sur la fiche. → 10 caractères d'un alphabet sans
--      ambiguïté (31 signes, ≈ 8·10¹⁴ combinaisons) tirés de
--      gen_random_bytes, et le code est EFFACÉ dès qu'il a servi (comme
--      déjà pour la connexion par téléphone, mig. 221).
--   4. Les invitations du personnel n'expiraient jamais (3 invitations
--      « direction » ouvertes depuis plus de 30 jours). → 7 jours.
--
--  Plus : search_path fixé sur 6 fonctions signalées par l'analyseur.
--
--  ⚠️ Les codes DÉJÀ remis ne changent pas : ils restent valables jusqu'à
--  leur premier usage. Seuls les nouveaux codes sont longs.
-- =====================================================================

-- --- 1. Les colonnes d'abonnement de `ecoles` -----------------------------------
--  Le promoteur garde sa page « Modules actifs » (Paramètres → Abonnement) :
--  il allume et éteint ce qu'il utilise, MAIS DANS SON OFFRE. Les modules de
--  l'offre sont ceux du plan de son dernier abonnement
--  (plans_abonnement.fonctions->'modules'). Sans abonnement, ou avec un plan
--  qui ne liste pas ses modules, rien n'est plafonné (comportement d'avant).
--  `demonstration` et `id` : super-administrateur seulement.
--  auth.uid() null = clé de service ou migration : on laisse passer.
create or replace function public._modules_de_l_offre(p_ecole uuid)
returns text[] language sql stable security definer set search_path = public as $fn$
  select case when jsonb_typeof(pa.fonctions -> 'modules') = 'array'
              then array(select jsonb_array_elements_text(pa.fonctions -> 'modules')) end
    from abonnements a join plans_abonnement pa on pa.id = a.plan_id
   where a.ecole_id = p_ecole
   order by a.debut desc, a.created_at desc
   limit 1
$fn$;
revoke execute on function public._modules_de_l_offre(uuid) from public, anon, authenticated;

create or replace function public._proteger_ecole()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_offre text[];
begin
  if auth.uid() is null or public.est_super_admin() then return new; end if;
  if new.demonstration is distinct from old.demonstration or new.id is distinct from old.id then
    raise exception 'Ce réglage est géré par GesPro.';
  end if;
  if new.modules_actifs is distinct from old.modules_actifs then
    v_offre := public._modules_de_l_offre(new.id);
    if v_offre is not null and (new.modules_actifs is null or not (new.modules_actifs <@ v_offre)) then
      raise exception 'Ce module ne fait pas partie de votre offre. Contactez GesPro pour l''ajouter.';
    end if;
  end if;
  return new;
end $fn$;
revoke execute on function public._proteger_ecole() from public, anon, authenticated;

drop trigger if exists trg_proteger_ecole on public.ecoles;
create trigger trg_proteger_ecole before update on public.ecoles
  for each row execute function public._proteger_ecole();

-- --- 2. Stockage `ecoles` : chacun dans son dossier ----------------------------
--  Chemins écrits par l'appli :
--    <ecole_id>/logo-… , <ecole_id>/cachet-…   (Paramètres, Structure)
--    <utilisateur>/logo-…                      (création de l'école)
--    partenaires/…                             (encarts, super-administrateur)
--  La lecture reste publique : le logo s'affiche sur l'écran de connexion.
create or replace function public._ecoles_asset_ecrivable(p_name text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select auth.uid() is not null and (
    public.est_super_admin()
    or split_part(p_name, '/', 1) = auth.uid()::text
    or (split_part(p_name, '/', 1) = public.ecole_courante()::text
        and (public.est_admin() or public.a_acces('parametres') or public.a_acces('structure')))
  )
$fn$;
revoke execute on function public._ecoles_asset_ecrivable(text) from public, anon;
grant execute on function public._ecoles_asset_ecrivable(text) to authenticated;

drop policy if exists ecoles_assets_upload on storage.objects;
create policy ecoles_assets_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'ecoles' and public._ecoles_asset_ecrivable(name));
drop policy if exists ecoles_assets_maj on storage.objects;
create policy ecoles_assets_maj on storage.objects for update to authenticated
  using (bucket_id = 'ecoles' and public._ecoles_asset_ecrivable(name))
  with check (bucket_id = 'ecoles' and public._ecoles_asset_ecrivable(name));
drop policy if exists ecoles_assets_suppr on storage.objects;
create policy ecoles_assets_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'ecoles' and public._ecoles_asset_ecrivable(name));

-- --- 3. Des codes qu'on ne devine pas, et qui ne servent qu'une fois -----------
--  Sans 0/O, 1/I/L : un code se dicte au téléphone sans erreur.
create or replace function public._code_aleatoire(p_longueur int default 10)
returns text language plpgsql volatile set search_path = public, extensions as $fn$
declare alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; b bytea; s text := '';
begin
  b := extensions.gen_random_bytes(p_longueur);
  for i in 0 .. p_longueur - 1 loop
    s := s || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return s;
end $fn$;
revoke execute on function public._code_aleatoire(int) from public, anon, authenticated;

create or replace function public.generer_code_tuteur(p_tuteur uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from tuteurs where id = p_tuteur;
  if v_ecole is null then raise exception 'Tuteur introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and (a_acces('codes_parents'))) then
    raise exception 'Réservé à l''administration de l''école.';
  end if;
  v_code := public._code_aleatoire(10);
  update tuteurs set code_acces = v_code where id = p_tuteur;
  return v_code;
end $fn$;

create or replace function public.generer_code_enseignant(p_enseignant uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from enseignants where id = p_enseignant;
  if v_ecole is null then raise exception 'Enseignant introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and (a_acces('enseignants'))) then
    raise exception 'Réservé à l''administration de l''école.';
  end if;
  v_code := public._code_aleatoire(10);
  update enseignants set code_acces = v_code where id = p_enseignant;
  return v_code;
end $fn$;

create or replace function public.generer_code_etudiant(p_eleve uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from eleves where id = p_eleve;
  if v_ecole is null then raise exception 'Étudiant introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and (a_acces('codes_etudiants'))) then
    raise exception 'Réservé à l''établissement.';
  end if;
  v_code := public._code_aleatoire(10);
  update eleves set code_acces = v_code where id = p_eleve;
  return v_code;
end $fn$;

create or replace function public.inviter_membre(p_role text, p_email text default null)
returns text language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid := ecole_courante(); v_code text;
begin
  if v_ecole is null then raise exception 'Aucune école courante.'; end if;
  if not public._peut_inviter(p_role) then
    raise exception 'Vous n''êtes pas autorisé à inviter ce rôle.';
  end if;
  v_code := public._code_aleatoire(10);
  insert into public.invitations (ecole_id, role, code, email, cree_par)
  values (v_ecole, p_role::public.role_systeme, v_code, nullif(p_email, ''), auth.uid());
  return v_code;
end $fn$;

--  Les liaisons : le code s'efface en même temps qu'il sert.
create or replace function public.lier_parent(p_code text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_t record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_t from tuteurs where code_acces = upper(trim(p_code)) limit 1;
  if v_t is null then raise exception 'Code invalide.'; end if;

  select email into v_email from auth.users where id = v_uid;

  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, null, coalesce(v_t.prenom, 'Parent'), coalesce(v_t.nom, ''), v_email)
  on conflict (id) do update set prenom = excluded.prenom, nom = excluded.nom, email = excluded.email;

  update tuteurs set profil_id = v_uid, code_acces = null where id = v_t.id;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_t.ecole_id, 'parent')
  on conflict (profil_id, ecole_id, role) do nothing;

  return v_t.id;
end $fn$;

create or replace function public.lier_enseignant(p_code text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_e record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_e from enseignants where code_acces = upper(trim(p_code)) limit 1;
  if v_e is null then raise exception 'Code invalide.'; end if;

  select email into v_email from auth.users where id = v_uid;

  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, v_e.ecole_id, coalesce(v_e.prenom, 'Enseignant'), coalesce(v_e.nom, ''), v_email)
  on conflict (id) do update
    set ecole_id = excluded.ecole_id, prenom = excluded.prenom, nom = excluded.nom, email = excluded.email;

  update enseignants set profil_id = v_uid, code_acces = null where id = v_e.id;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_e.ecole_id, 'enseignant')
  on conflict (profil_id, ecole_id, role) do nothing;

  return v_e.id;
end $fn$;

create or replace function public.lier_etudiant(p_code text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_e record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_e from eleves where code_acces = upper(trim(p_code)) limit 1;
  if v_e is null then raise exception 'Code invalide.'; end if;

  select email into v_email from auth.users where id = v_uid;

  -- Profil SANS ecole_id (aucune exposition via les policies tenant), comme les parents.
  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, null, coalesce(v_e.prenom, 'Étudiant'), coalesce(v_e.nom, ''), v_email)
  on conflict (id) do update set prenom = excluded.prenom, nom = excluded.nom, email = excluded.email;

  update eleves set profil_id = v_uid, code_acces = null where id = v_e.id;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_e.ecole_id, 'etudiant')
  on conflict (profil_id, ecole_id, role) do nothing;

  return v_e.id;
end $fn$;

--  Les codes des comptes DÉJÀ reliés ne servent plus à rien : on les efface
--  (6 parents relevés à l'audit dont le code circulait encore).
update tuteurs    set code_acces = null where code_acces is not null and profil_id is not null;
update enseignants set code_acces = null where code_acces is not null and profil_id is not null;
update eleves     set code_acces = null where code_acces is not null and profil_id is not null;

-- --- 4. Une invitation vaut 7 jours ---------------------------------------------
create or replace function public.rejoindre(p_code text)
returns text language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_inv record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_inv from public.invitations
    where code = upper(trim(p_code)) and statut = 'active' limit 1;
  if v_inv is null then raise exception 'Code invalide ou déjà utilisé.'; end if;
  if v_inv.created_at < now() - interval '7 days' then
    raise exception 'Cette invitation a expiré (7 jours). Demandez-en une nouvelle à l''école.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Verrouillage optionnel : si l'invitation cible un email, il doit correspondre.
  if v_inv.email is not null
     and lower(trim(v_inv.email)) <> lower(trim(coalesce(v_email, ''))) then
    raise exception 'Cette invitation est réservée à l''adresse %.', v_inv.email;
  end if;

  insert into public.profils (id, ecole_id, prenom, nom, email)
  values (v_uid, v_inv.ecole_id, coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'Membre'), '', v_email)
  on conflict (id) do update
    set ecole_id = excluded.ecole_id, email = excluded.email;

  insert into public.profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_inv.ecole_id, v_inv.role)
  on conflict (profil_id, ecole_id, role) do nothing;

  update public.invitations
    set statut = 'utilisee', utilise_par = v_uid, utilise_le = now()
    where id = v_inv.id;

  return v_inv.role::text;
end $fn$;

--  Les invitations déjà périmées ne s'affichent plus « en attente ».
update public.invitations set statut = 'revoquee'
 where statut = 'active' and created_at < now() - interval '7 days';

-- --- 5. search_path fixé (analyseur Supabase) -----------------------------------
alter function public.tel_normalise(text) set search_path = public;
alter function public._nom_parent(text, text) set search_path = public;
alter function public.boite_de_cle(text) set search_path = public;
alter function public.boites_du_modele(text) set search_path = public;
alter function public._biblio_ecole(text) set search_path = public;
alter function public._doc_ecole(text) set search_path = public;

-- --- Retour arrière ---------------------------------------------------------------
-- drop trigger if exists trg_proteger_ecole on public.ecoles;
-- drop function if exists public._proteger_ecole();
-- drop function if exists public._modules_de_l_offre(uuid);
-- drop function if exists public._ecoles_asset_ecrivable(text);
-- drop function if exists public._code_aleatoire(int);
-- Stockage : recréer ecoles_assets_upload/maj/suppr avec (bucket_id = 'ecoles') seul.
-- Codes : réappliquer les versions des mig. 029/030 (inviter_membre, rejoindre),
-- et celles d'origine de generer_code_* et lier_* (8 caractères, code conservé).
