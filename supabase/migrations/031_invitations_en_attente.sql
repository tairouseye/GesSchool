-- =====================================================================
--  031 — Suivi des invitations en attente + annulation
--  Liste les codes générés non encore utilisés (statut 'active') et permet
--  de les annuler (statut 'revoquee').
-- =====================================================================

create or replace function public.invitations_ecole()
returns table (id uuid, role text, code text, email text, statut text, created_at timestamptz, cree_par_nom text)
language sql stable security definer set search_path = public as $$
  select i.id, i.role::text, i.code, i.email, i.statut, i.created_at,
         nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '')
  from public.invitations i
  left join public.profils p on p.id = i.cree_par
  where i.ecole_id = ecole_courante()
    and i.statut = 'active'
    and (est_super_admin() or a_role('admin_ecole') or a_role('direction') or a_role('rh') or a_role('comptable'))
  order by i.created_at desc;
$$;

create or replace function public.annuler_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_role text;
begin
  select role::text into v_role from public.invitations
    where id = p_id and ecole_id = v_ecole and statut = 'active';
  if v_role is null then raise exception 'Invitation introuvable ou déjà utilisée.'; end if;
  if not public._peut_inviter(v_role) then
    raise exception 'Non autorisé à annuler cette invitation.';
  end if;
  update public.invitations set statut = 'revoquee' where id = p_id and ecole_id = v_ecole;
end $$;

revoke execute on function public.invitations_ecole() from public, anon;
revoke execute on function public.annuler_invitation(uuid) from public, anon;
grant execute on function public.invitations_ecole() to authenticated;
grant execute on function public.annuler_invitation(uuid) to authenticated;
