-- =====================================================================
--  113 — Comptes étudiants (supérieur)
--
--  L'étudiant (majeur) a son propre compte, sur le modèle des parents :
--  l'établissement génère un CODE (distribué par WhatsApp), l'étudiant crée
--  son compte et saisit le code → son profil est lié à sa fiche `eleves` et
--  le rôle `etudiant` lui est attribué.
--
--  Sert de socle au consentement d'accès parent (étapes suivantes). Additif.
-- =====================================================================

alter table eleves
  add column if not exists code_acces text,
  add column if not exists profil_id  uuid references profils(id) on delete set null,
  add column if not exists telephone  text;

-- Liaison : l'utilisateur connecté saisit son code → devient l'étudiant.
create or replace function public.lier_etudiant(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_e record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_e from eleves where code_acces = p_code limit 1;
  if v_e is null then raise exception 'Code invalide.'; end if;

  select email into v_email from auth.users where id = v_uid;

  -- Profil SANS ecole_id (aucune exposition via les policies tenant), comme les parents.
  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, null, coalesce(v_e.prenom, 'Étudiant'), coalesce(v_e.nom, ''), v_email)
  on conflict (id) do update set prenom = excluded.prenom, nom = excluded.nom, email = excluded.email;

  update eleves set profil_id = v_uid where id = v_e.id;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_e.ecole_id, 'etudiant')
  on conflict (profil_id, ecole_id, role) do nothing;

  return v_e.id;
end $$;

-- Génération d'un code par l'établissement (promoteur / direction / gestion).
create or replace function public.generer_code_etudiant(p_eleve uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from eleves where id = p_eleve;
  if v_ecole is null then raise exception 'Étudiant introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and (
        est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire'))) then
    raise exception 'Réservé à l''établissement.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update eleves set code_acces = v_code where id = p_eleve;
  return v_code;
end $$;

grant execute on function public.lier_etudiant(text) to authenticated;
grant execute on function public.generer_code_etudiant(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.lier_etudiant(text);
-- drop function if exists public.generer_code_etudiant(uuid);
-- alter table eleves drop column if exists code_acces, drop column if exists profil_id, drop column if exists telephone;
