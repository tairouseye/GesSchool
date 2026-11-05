-- =====================================================================
--  231 — Savoir qu'un appel a été fait
--
--  Un appel où tout le monde est présent n'écrivait rien en base : ni
--  l'enseignant ni la direction ne pouvaient savoir s'il avait eu lieu.
--  Cette table garde une ligne par classe et par jour, posée quand
--  l'appel est validé. Elle sert à l'accueil de l'enseignant (« appel
--  validé ») et à celui de la direction (« classes sans appel »).
--
--  Mêmes droits que `absences` (mig. 223) : `presence_vie`, dans son école,
--  et pour un enseignant seulement ses classes (`classes_autorisees`).
--  La table n'expose aucune donnée d'élève.
--
--  ANNULATION : drop table public.appels_valides;
-- =====================================================================

create table if not exists public.appels_valides (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  classe_id uuid not null references public.classes(id) on delete cascade,
  date_appel date not null,
  valide_par uuid default auth.uid(),
  valide_le timestamptz not null default now(),
  unique (classe_id, date_appel)
);

create index if not exists appels_valides_ecole_date on public.appels_valides (ecole_id, date_appel);

alter table public.appels_valides enable row level security;

drop policy if exists appels_valides_acces on public.appels_valides;
create policy appels_valides_acces on public.appels_valides
  for all to authenticated
  using (
    ((select public.est_super_admin())
      or (ecole_id = (select public.ecole_courante()) and (select public.a_acces('presence_vie'))))
    and ((select public.classes_autorisees()) is null or classe_id = any(public.classes_autorisees()))
  )
  with check (
    ((select public.est_super_admin())
      or (ecole_id = (select public.ecole_courante()) and (select public.a_acces('presence_vie'))))
    and ((select public.classes_autorisees()) is null or classe_id = any(public.classes_autorisees()))
    and exists (select 1 from public.classes c where c.id = classe_id and c.ecole_id = appels_valides.ecole_id)
  );

revoke all on public.appels_valides from public, anon;
grant select, insert, update on public.appels_valides to authenticated;

select public.demo_proteger_tables();
