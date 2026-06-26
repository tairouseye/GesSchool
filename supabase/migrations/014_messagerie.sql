-- =====================================================================
--  014 — Messagerie parent ↔ école
--  Un fil de discussion par tuteur (parent) et école. `lu` = lu par le
--  destinataire (parent pour un message 'ecole', école pour 'parent').
-- =====================================================================

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  tuteur_id   uuid not null references tuteurs(id) on delete cascade,
  expediteur  text not null check (expediteur in ('parent', 'ecole')),
  contenu     text not null,
  lu          boolean not null default false,
  auteur_id   uuid references profils(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_tuteur_idx on messages(tuteur_id, created_at);
create index if not exists messages_ecole_idx on messages(ecole_id);

-- RLS : staff (école courante). Le parent passe par les RPC ci-dessous.
alter table messages enable row level security;
drop policy if exists messages_tenant on messages;
create policy messages_tenant on messages
  using (est_super_admin() or ecole_id = ecole_courante())
  with check (est_super_admin() or ecole_id = ecole_courante());

-- ---------------------------------------------------------------------
-- Côté PARENT (profil sans ecole_id) — RPC SECURITY DEFINER
-- ---------------------------------------------------------------------
create or replace function public.mes_conversations()
returns table(tuteur_id uuid, ecole text, ecole_id uuid, dernier text, dernier_le timestamptz, non_lus bigint)
language sql security definer set search_path = public as $$
  select t.id, ec.nom, t.ecole_id,
    (select m.contenu from messages m where m.tuteur_id = t.id order by m.created_at desc limit 1),
    (select m.created_at from messages m where m.tuteur_id = t.id order by m.created_at desc limit 1),
    (select count(*) from messages m where m.tuteur_id = t.id and m.expediteur = 'ecole' and m.lu = false)
  from tuteurs t join ecoles ec on ec.id = t.ecole_id
  where t.profil_id = auth.uid()
  order by ec.nom;
$$;
grant execute on function public.mes_conversations() to authenticated;

create or replace function public.mes_messages_non_lus()
returns bigint language sql security definer set search_path = public as $$
  select count(*) from messages m
  join tuteurs t on t.id = m.tuteur_id
  where t.profil_id = auth.uid() and m.expediteur = 'ecole' and m.lu = false;
$$;
grant execute on function public.mes_messages_non_lus() to authenticated;

create or replace function public.conversation_messages(p_tuteur uuid)
returns table(id uuid, expediteur text, contenu text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tuteurs where id = p_tuteur and profil_id = auth.uid()) then
    raise exception 'Accès refusé.';
  end if;
  update messages set lu = true where tuteur_id = p_tuteur and expediteur = 'ecole' and lu = false;
  return query
    select m.id, m.expediteur, m.contenu, m.created_at
    from messages m where m.tuteur_id = p_tuteur order by m.created_at;
end $$;
grant execute on function public.conversation_messages(uuid) to authenticated;

create or replace function public.parent_envoyer(p_tuteur uuid, p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tuteurs where id = p_tuteur and profil_id = auth.uid()) then
    raise exception 'Accès refusé.';
  end if;
  if coalesce(trim(p_contenu), '') = '' then return; end if;
  insert into messages (ecole_id, tuteur_id, expediteur, contenu, auteur_id)
  select ecole_id, p_tuteur, 'parent', p_contenu, auth.uid() from tuteurs where id = p_tuteur;
end $$;
grant execute on function public.parent_envoyer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Côté ÉCOLE (staff) — résumé des conversations (parents avec compte)
-- ---------------------------------------------------------------------
create or replace function public.ecole_conversations()
returns table(tuteur_id uuid, parent text, telephone text, dernier text, dernier_le timestamptz, non_lus bigint)
language sql security definer set search_path = public as $$
  select t.id, t.prenom || ' ' || t.nom, t.telephone,
    (select m.contenu from messages m where m.tuteur_id = t.id order by m.created_at desc limit 1),
    (select m.created_at from messages m where m.tuteur_id = t.id order by m.created_at desc limit 1),
    (select count(*) from messages m where m.tuteur_id = t.id and m.expediteur = 'parent' and m.lu = false)
  from tuteurs t
  where t.ecole_id = ecole_courante() and t.profil_id is not null
  order by 5 desc nulls last;
$$;
grant execute on function public.ecole_conversations() to authenticated;
