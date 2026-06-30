-- =====================================================================
--  022 — Compte enseignant (liaison par code, comme l'espace parent)
--  L'admin génère un code sur la fiche enseignant ; l'enseignant crée son
--  compte et saisit le code → profil + rôle 'enseignant' + lien à sa fiche.
-- =====================================================================

alter table public.enseignants add column if not exists code_acces text;

-- Génération du code par l'administration de l'école
create or replace function public.generer_code_enseignant(p_enseignant uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from enseignants where id = p_enseignant;
  if v_ecole is null then raise exception 'Enseignant introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and (a_role('admin_ecole') or a_role('direction'))) then
    raise exception 'Réservé à l''administration de l''école.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update enseignants set code_acces = v_code where id = p_enseignant;
  return v_code;
end $$;

-- Liaison du compte enseignant via le code
create or replace function public.lier_enseignant(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_e record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_e from enseignants where code_acces = p_code limit 1;
  if v_e is null then raise exception 'Code invalide.'; end if;

  select email into v_email from auth.users where id = v_uid;

  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_uid, v_e.ecole_id, coalesce(v_e.prenom, 'Enseignant'), coalesce(v_e.nom, ''), v_email)
  on conflict (id) do update
    set ecole_id = excluded.ecole_id, prenom = excluded.prenom, nom = excluded.nom, email = excluded.email;

  update enseignants set profil_id = v_uid where id = v_e.id;

  insert into profil_roles (profil_id, ecole_id, role)
  values (v_uid, v_e.ecole_id, 'enseignant')
  on conflict (profil_id, ecole_id, role) do nothing;

  return v_e.id;
end $$;

revoke execute on function public.generer_code_enseignant(uuid) from public, anon;
grant execute on function public.generer_code_enseignant(uuid) to authenticated;
revoke execute on function public.lier_enseignant(text) from public, anon;
grant execute on function public.lier_enseignant(text) to authenticated;
