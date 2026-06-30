-- =====================================================================
--  023 — Cahier de textes (séances + devoirs par classe/matière)
--  Saisi par l'enseignant, visible par l'administration et les parents.
-- =====================================================================

create table if not exists cahier_textes (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid not null references ecoles(id) on delete cascade,
  classe_id     uuid not null references classes(id) on delete cascade,
  matiere_id    uuid references matieres(id) on delete set null,
  enseignant_id uuid references enseignants(id) on delete set null,
  date_seance   date not null default current_date,
  contenu       text,          -- ce qui a été fait en cours
  devoirs       text,          -- travail à faire
  date_pour     date,          -- échéance des devoirs
  created_at    timestamptz not null default now()
);
create index if not exists cahier_ecole_idx on cahier_textes(ecole_id);
create index if not exists cahier_classe_idx on cahier_textes(classe_id, date_seance);

alter table cahier_textes enable row level security;
drop policy if exists cahier_tenant on cahier_textes;
create policy cahier_tenant on cahier_textes
  using (est_super_admin() or ecole_id = ecole_courante())
  with check (est_super_admin() or ecole_id = ecole_courante());

-- Cahier de textes de la classe de l'enfant (côté parent)
create or replace function public.enfant_cahier(p_eleve uuid)
returns table(date_seance date, matiere text, contenu text, devoirs text, date_pour date)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select ct.date_seance, m.libelle, ct.contenu, ct.devoirs, ct.date_pour
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
    join cahier_textes ct on ct.classe_id = ins.classe_id and ct.ecole_id = ins.ecole_id
    left join matieres m on m.id = ct.matiere_id
    where ins.eleve_id = p_eleve
    order by ct.date_seance desc, ct.created_at desc
    limit 100;
end $$;

revoke execute on function public.enfant_cahier(uuid) from public, anon;
grant execute on function public.enfant_cahier(uuid) to authenticated;
