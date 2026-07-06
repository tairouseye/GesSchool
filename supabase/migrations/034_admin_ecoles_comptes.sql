-- =====================================================================
--  034 — Console super-admin : suivi par école
--  Enrichit admin_ecoles() avec :
--    - nb_personnel  (comptes staff), nb_enseignants (sous-total), nb_parents
--    - derniere_activite : dernière connexion d'un utilisateur de l'école
--      (max(last_sign_in_at) sur auth.users, via profil_roles).
-- =====================================================================

drop function if exists public.admin_ecoles();

create or replace function public.admin_ecoles()
returns table(
  ecole_id        uuid,
  nom             text,
  sigle           text,
  effectif        bigint,
  nb_personnel    bigint,
  nb_enseignants  bigint,
  nb_parents      bigint,
  derniere_activite timestamptz,
  plan_code       text,
  plan_libelle    text,
  statut          statut_abonnement,
  fin             date,
  modules         text[]
)
language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  return query
    select
      e.id, e.nom, e.sigle,
      (select count(*) from eleves el where el.ecole_id = e.id),
      (select count(distinct pr.profil_id) from profil_roles pr
         where pr.ecole_id = e.id and pr.role <> 'parent'),
      (select count(distinct pr.profil_id) from profil_roles pr
         where pr.ecole_id = e.id and pr.role = 'enseignant'),
      (select count(distinct pr.profil_id) from profil_roles pr
         where pr.ecole_id = e.id and pr.role = 'parent'),
      (select max(u.last_sign_in_at) from profil_roles pr
         join auth.users u on u.id = pr.profil_id
         where pr.ecole_id = e.id),
      pa.code, pa.libelle, ab.statut, ab.fin, e.modules_actifs
    from ecoles e
    left join lateral (
      select a.* from abonnements a
      where a.ecole_id = e.id
      order by a.debut desc, a.created_at desc
      limit 1
    ) ab on true
    left join plans_abonnement pa on pa.id = ab.plan_id
    order by e.nom;
end $$;

revoke execute on function public.admin_ecoles() from public, anon;
grant execute on function public.admin_ecoles() to authenticated;
