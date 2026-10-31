-- =====================================================================
--  218 — Démo sans compte : aucune donnée personnelle réelle
--
--  Audit du 31/10/2026 (AUDIT_GESCHOOL, P1-1). Dans la démo DIRECTION,
--  la page « Membres » montrait le nom et l'e-mail réels de la promotrice
--  de l'école de démonstration, et une invitation en attente (adresse
--  Gmail réelle, nom de son auteur). N'importe quel visiteur y accédait en
--  deux clics, sans compte.
--
--  Les élèves, tuteurs, enseignants et personnels de l'école de démo sont
--  fictifs ou anonymisés (supabase/tests/demo_anonymiser.sql). Restaient
--  les COMPTES : `profils` et `invitations`, lus de deux façons —
--    - par les RPC `membres_ecole` (029) et `invitations_ecole` (031),
--      SECURITY DEFINER, donc insensibles à la RLS ;
--    - par lecture directe des tables, que la RLS autorise à la direction.
--  On ferme les deux chemins, pour les seuls comptes de démo.
--
--  Le parent de démo n'est pas concerné : il ne lit déjà que son propre
--  profil (vérifié en production).
-- =====================================================================

-- --- 1. RPC : recopie fidèle de la 029, plus le filtre démo --------------
create or replace function public.membres_ecole()
returns table (id uuid, prenom text, nom text, email text, actif boolean, roles text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.prenom, p.nom, p.email, p.actif,
         coalesce(array_agg(pr.role::text order by pr.role) filter (where pr.role is not null), '{}')
  from public.profils p
  left join public.profil_roles pr on pr.profil_id = p.id and pr.ecole_id = p.ecole_id
  where p.ecole_id = ecole_courante()
    and (est_super_admin() or a_role('admin_ecole') or a_role('direction') or a_role('rh') or a_role('comptable'))
    and (not est_compte_demo() or p.id = auth.uid())   -- 218 : en démo, soi seulement
  group by p.id, p.prenom, p.nom, p.email, p.actif
  order by p.nom, p.prenom;
$$;

-- --- 2. RPC : recopie fidèle de la 031, plus le filtre démo --------------
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
    and not est_compte_demo()                           -- 218 : en démo, aucune
  order by i.created_at desc;
$$;

-- `create or replace` conserve les droits ; on les repose quand même, à
-- l'identique de la 029 et de la 031, pour que ce fichier se lise seul.
revoke execute on function public.membres_ecole() from public, anon;
revoke execute on function public.invitations_ecole() from public, anon;
grant execute on function public.membres_ecole() to authenticated;
grant execute on function public.invitations_ecole() to authenticated;

-- --- 3. Lecture directe : policies RESTRICTIVES -------------------------
--  Elles s'ajoutent en ET aux policies existantes, sans les modifier : pour
--  un compte ordinaire, `not est_compte_demo()` est vrai et rien ne change.
drop policy if exists "demo_profils_soi_seulement" on public.profils;
create policy "demo_profils_soi_seulement" on public.profils
  as restrictive for select to authenticated
  using (not public.est_compte_demo() or id = auth.uid());

drop policy if exists "demo_aucune_invitation" on public.invitations;
create policy "demo_aucune_invitation" on public.invitations
  as restrictive for select to authenticated
  using (not public.est_compte_demo());

notify pgrst, 'reload schema';

-- =====================================================================
--  VÉRIFICATION (après application) — avec le compte démo direction,
--  `membres_ecole()` ne rend qu'une ligne (Direction Démo) et
--  `invitations_ecole()` aucune. Avec un compte réel : inchangé.
--
--  ANNULATION
--    drop policy if exists "demo_profils_soi_seulement" on public.profils;
--    drop policy if exists "demo_aucune_invitation" on public.invitations;
--    puis rejouer les définitions de la 029 (membres_ecole) et de la 031
--    (invitations_ecole).
-- =====================================================================
