-- =====================================================================
--  029 — Gestion des membres & délégation hiérarchique des accès
--  Le promoteur crée les responsables ; chaque responsable (cloisonné à son
--  domaine) invite/gère ses propres sous-utilisateurs via un code + lien.
--    admin_ecole → tous | direction → enseignant/surveillant/parent
--    rh → secretaire     | comptable → secretaire
--  ⚠️ Le type enum est qualifié `public.role_systeme` (le SQL Editor ne le
--     résolvait pas sans schéma). Si l'ADD VALUE échoue (« unsafe use of new
--     value » ou « cannot run inside a transaction block »), exécute cette
--     ligne SEULE d'abord, puis relance le reste du fichier.
-- =====================================================================

alter type public.role_systeme add value if not exists 'secretaire';

-- --------------------------------------------------------------------
--  Table des invitations (code + lien partageable)
-- --------------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  role        public.role_systeme not null,
  code        text not null unique,
  email       text,
  cree_par    uuid references profils(id) on delete set null,
  statut      text not null default 'active' check (statut in ('active', 'utilisee', 'revoquee')),
  utilise_par uuid references profils(id) on delete set null,
  utilise_le  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists invitations_ecole_idx on public.invitations(ecole_id);
create index if not exists invitations_code_idx on public.invitations(code);

alter table public.invitations enable row level security;
drop policy if exists invitations_tenant on public.invitations;
create policy invitations_tenant on public.invitations for all
  using (ecole_id = ecole_courante() or est_super_admin())
  with check (ecole_id = ecole_courante() or est_super_admin());

-- --------------------------------------------------------------------
--  Matrice de délégation : qui peut inviter/gérer quel rôle
-- --------------------------------------------------------------------
create or replace function public._peut_inviter(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select
        est_super_admin()
     or (a_role('admin_ecole') and p_role in ('direction','rh','comptable','secretaire','enseignant','surveillant','parent'))
     or (a_role('direction')   and p_role in ('enseignant','surveillant','parent'))
     or (a_role('rh')          and p_role in ('secretaire'))
     or (a_role('comptable')   and p_role in ('secretaire'));
$$;

-- --------------------------------------------------------------------
--  Inviter un membre → renvoie le code d'invitation
-- --------------------------------------------------------------------
create or replace function public.inviter_membre(p_role text, p_email text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_code text;
begin
  if v_ecole is null then raise exception 'Aucune école courante.'; end if;
  if not public._peut_inviter(p_role) then
    raise exception 'Vous n''êtes pas autorisé à inviter ce rôle.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.invitations (ecole_id, role, code, email, cree_par)
  values (v_ecole, p_role::public.role_systeme, v_code, nullif(p_email, ''), auth.uid());
  return v_code;
end $$;

-- --------------------------------------------------------------------
--  Rejoindre l'établissement via un code → crée le profil + le rôle
-- --------------------------------------------------------------------
create or replace function public.rejoindre(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv record; v_email text;
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  select * into v_inv from public.invitations
    where code = upper(trim(p_code)) and statut = 'active' limit 1;
  if v_inv is null then raise exception 'Code invalide ou déjà utilisé.'; end if;

  select email into v_email from auth.users where id = v_uid;

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

-- --------------------------------------------------------------------
--  Liste des membres de l'école (pour les managers)
-- --------------------------------------------------------------------
create or replace function public.membres_ecole()
returns table (id uuid, prenom text, nom text, email text, actif boolean, roles text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.prenom, p.nom, p.email, p.actif,
         coalesce(array_agg(pr.role::text order by pr.role) filter (where pr.role is not null), '{}')
  from public.profils p
  left join public.profil_roles pr on pr.profil_id = p.id and pr.ecole_id = p.ecole_id
  where p.ecole_id = ecole_courante()
    and (est_super_admin() or a_role('admin_ecole') or a_role('direction') or a_role('rh') or a_role('comptable'))
  group by p.id, p.prenom, p.nom, p.email, p.actif
  order by p.nom, p.prenom;
$$;

-- --------------------------------------------------------------------
--  Révoquer un rôle / suspendre-réactiver un membre
-- --------------------------------------------------------------------
create or replace function public.revoquer_role(p_profil uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante();
begin
  if not public._peut_inviter(p_role) then
    raise exception 'Non autorisé à gérer ce rôle.';
  end if;
  delete from public.profil_roles
    where profil_id = p_profil and ecole_id = v_ecole and role = p_role::public.role_systeme;
end $$;

create or replace function public.suspendre_membre(p_profil uuid, p_suspendu boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_ok boolean := est_super_admin() or a_role('admin_ecole');
begin
  if not v_ok then
    -- le caller doit pouvoir gérer au moins un des rôles de la cible
    select bool_or(public._peut_inviter(role::text)) into v_ok
    from public.profil_roles where profil_id = p_profil and ecole_id = v_ecole;
  end if;
  if not coalesce(v_ok, false) then raise exception 'Non autorisé à gérer ce membre.'; end if;
  update public.profils set actif = not p_suspendu
    where id = p_profil and ecole_id = v_ecole;
end $$;

-- --------------------------------------------------------------------
--  Élargit la génération du code parent : promoteur + responsable
--  pédagogique + côté Gestion (comptable/secrétaire) qui inscrivent.
-- --------------------------------------------------------------------
create or replace function public.generer_code_tuteur(p_tuteur uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_ecole uuid;
begin
  select ecole_id into v_ecole from tuteurs where id = p_tuteur;
  if v_ecole is null then raise exception 'Tuteur introuvable.'; end if;
  if not est_super_admin() and not (ecole_courante() = v_ecole and (
        a_role('admin_ecole') or a_role('direction') or a_role('comptable') or a_role('secretaire'))) then
    raise exception 'Réservé à l''administration de l''école.';
  end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update tuteurs set code_acces = v_code where id = p_tuteur;
  return v_code;
end $$;

-- --------------------------------------------------------------------
--  Droits d'exécution
-- --------------------------------------------------------------------
revoke execute on function public._peut_inviter(text) from public, anon;
revoke execute on function public.inviter_membre(text, text) from public, anon;
revoke execute on function public.rejoindre(text) from public, anon;
revoke execute on function public.membres_ecole() from public, anon;
revoke execute on function public.revoquer_role(uuid, text) from public, anon;
revoke execute on function public.suspendre_membre(uuid, boolean) from public, anon;

grant execute on function public._peut_inviter(text) to authenticated;
grant execute on function public.inviter_membre(text, text) to authenticated;
grant execute on function public.rejoindre(text) to authenticated;
grant execute on function public.membres_ecole() to authenticated;
grant execute on function public.revoquer_role(uuid, text) to authenticated;
grant execute on function public.suspendre_membre(uuid, boolean) to authenticated;
grant execute on function public.generer_code_tuteur(uuid) to authenticated;
