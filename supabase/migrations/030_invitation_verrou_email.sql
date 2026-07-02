-- =====================================================================
--  030 — Verrouillage optionnel des invitations par email
--  Si l'invitation cible un email (champ renseigné à la création), la
--  personne DOIT créer/utiliser un compte avec exactement cette adresse.
--  Si le champ email est vide → comportement inchangé (n'importe qui avec
--  le code peut rejoindre). Souple pour le personnel sans email.
-- =====================================================================

create or replace function public.rejoindre(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_inv from public.invitations
    where code = upper(trim(p_code)) and statut = 'active' limit 1;
  if v_inv is null then raise exception 'Code invalide ou déjà utilisé.'; end if;

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
end $$;

revoke execute on function public.rejoindre(text) from public, anon;
grant execute on function public.rejoindre(text) to authenticated;
