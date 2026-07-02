-- =====================================================================
--  032 — Correctifs d'audit sécurité (délégation & isolation)
--
--  A) invitations : la policy « for all » laissait n'importe quel membre de
--     l'école INSÉRER une invitation de n'importe quel rôle (→ escalade en
--     admin via rejoindre) et LIRE tous les codes. On la remplace par une
--     lecture réservée aux managers ; les écritures ne passent QUE par les
--     RPC SECURITY DEFINER (qui contournent la RLS).
--  B) profils : la policy « profils_self » (id = auth.uid() en ALL) laissait
--     l'utilisateur modifier SA ligne, dont ecole_id (saut de tenant) et
--     actif (auto-réactivation après suspension). On passe en lecture seule ;
--     les écritures passent par les RPC (onboarding, rejoindre, lier_*).
--  C) secretaire : ce rôle avait accès UI (élèves, inscriptions, paiements)
--     mais AUCUNE écriture en base (policies 018 antérieures au rôle). On
--     ajoute 'secretaire' aux prédicats d'écriture des tables concernées.
--  D) suspension : n'était appliquée que côté client. On la rend effective en
--     base : ecole_courante() et a_role() ignorent un profil inactif.
-- =====================================================================

-- ---- A) invitations : lecture managers, écritures via RPC uniquement ----
drop policy if exists invitations_tenant on public.invitations;
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select
  using (est_super_admin() or (ecole_id = ecole_courante()
    and (a_role('admin_ecole') or a_role('direction') or a_role('rh') or a_role('comptable'))));
-- (pas de policy insert/update/delete → écriture directe bloquée)

-- ---- B) profils : lecture de son propre profil, écritures via RPC ----
drop policy if exists profils_self on profils;
drop policy if exists profils_self_select on profils;
create policy profils_self_select on profils for select using (id = auth.uid());
-- (pas de policy write → un utilisateur ne peut plus modifier ecole_id/actif)

-- ---- C) accès base du rôle 'secretaire' (opérationnel Gestion) ----
do $$
declare t text;
begin
  foreach t in array array[
    'eleves','inscriptions','eleve_tuteurs','tuteurs','documents_eleve',
    'paiements','factures','facture_lignes'
  ] loop
    execute format('drop policy if exists %1$s_ins on public.%1$I;', t);
    execute format('drop policy if exists %1$s_upd on public.%1$I;', t);
    execute format('drop policy if exists %1$s_del on public.%1$I;', t);
    execute format(
      'create policy %1$s_ins on public.%1$I for insert with check '
      || '(est_super_admin() or (ecole_id = ecole_courante() and '
      || '(est_gestion() or a_role(''comptable'') or a_role(''secretaire''))));', t);
    execute format(
      'create policy %1$s_upd on public.%1$I for update '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and '
      || '(est_gestion() or a_role(''comptable'') or a_role(''secretaire'')))) '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and '
      || '(est_gestion() or a_role(''comptable'') or a_role(''secretaire''))));', t);
    execute format(
      'create policy %1$s_del on public.%1$I for delete '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and '
      || '(est_gestion() or a_role(''comptable'') or a_role(''secretaire''))));', t);
  end loop;
end $$;

-- ---- D) suspension effective en base ----
-- ecole_courante() renvoie null pour un profil suspendu → toutes les policies
-- « ecole_id = ecole_courante() » tombent, l'utilisateur est isolé.
create or replace function ecole_courante()
returns uuid language sql stable security definer set search_path = public as $$
  select ecole_id from profils where id = auth.uid() and actif
$$;

-- a_role() renvoie false pour un profil suspendu → est_gestion(), est_super_admin()
-- et les contrôles de rôle des RPC échouent aussi.
create or replace function a_role(p_role public.role_systeme)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profil_roles pr
    join public.profils p on p.id = pr.profil_id
    where pr.profil_id = auth.uid() and pr.role = p_role and p.actif
  )
$$;
