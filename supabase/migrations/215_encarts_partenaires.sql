-- =====================================================================
--  215 — Encarts partenaires sur l'écran de connexion
--
--  LE BESOIN (promoteur, 28/10/2026, maquette docs/maquette-connexion-fond
--  validée) : sous la carte de connexion, l'encart du mois alterne entre le
--  conseil éducatif (dans le code, src/lib/fondsConnexion.js) et des
--  PARTENAIRES DE L'ÉDUCATION (librairies, fournitures, assurances
--  scolaires…), saisis par GesPro seul depuis la console super-admin.
--
--  ⚠️ L'ÉCRAN DE CONNEXION EST PUBLIC : on ne sait pas encore qui se
--  connecte, ni de quelle école. La lecture passe donc par une fonction
--  ouverte à `anon` qui ne rend QUE les encarts actifs et en période —
--  jamais la table, ni un encart désactivé ou programmé plus tard.
--  L'écriture est réservée au super-admin.
-- =====================================================================

create table if not exists public.encarts_partenaires (
  id          uuid primary key default gen_random_uuid(),
  partenaire  text not null check (length(btrim(partenaire)) between 1 and 80),
  message     text not null check (length(btrim(message)) between 1 and 180),
  --  https seulement : ni `javascript:` ni lien en clair sur un écran public.
  lien        text check (lien is null or lien ~* '^https://[^\s]+$'),
  logo_url    text check (logo_url is null or logo_url ~* '^https://[^\s]+$'),
  debut       date not null default current_date,
  fin         date,
  actif       boolean not null default true,
  ordre       int not null default 0,
  cree_le     timestamptz not null default now(),
  cree_par    uuid default auth.uid(),
  check (fin is null or fin >= debut)
);

alter table public.encarts_partenaires enable row level security;

revoke all on public.encarts_partenaires from anon;
grant select, insert, update, delete on public.encarts_partenaires to authenticated;

drop policy if exists encarts_super_admin on public.encarts_partenaires;
create policy encarts_super_admin on public.encarts_partenaires
  for all to authenticated
  using (est_super_admin())
  with check (est_super_admin());

--  Ce que l'écran de connexion a le droit de voir. Date du jour à Dakar
--  (UTC+0, sans heure d'été) : `current_date` du serveur suffit.
create or replace function public.encarts_connexion()
returns table (id uuid, partenaire text, message text, lien text, logo_url text)
language sql stable security definer set search_path = public as $$
  select e.id, e.partenaire, e.message, e.lien, e.logo_url
    from encarts_partenaires e
   where e.actif
     and e.debut <= current_date
     and (e.fin is null or e.fin >= current_date)
   order by e.ordre, e.debut, e.cree_le
   limit 6
$$;

revoke all on function public.encarts_connexion() from public;
grant execute on function public.encarts_connexion() to anon, authenticated;
