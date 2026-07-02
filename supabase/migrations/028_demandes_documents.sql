-- =====================================================================
--  028 — Demande de documents par le parent
--  Le parent sollicite un document → l'administration le traite →
--  le parent est notifié (notification + push si configuré).
-- =====================================================================

-- Traitement des demandes = domaine Gestion (comptable/secrétaire) ; le
-- responsable pédagogique 'direction' en est exclu. Défini ici aussi pour que
-- la migration soit auto-suffisante si jouée avant 033.
create or replace function est_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select est_super_admin() or a_role('admin_ecole')
$$;

create table if not exists demandes_documents (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  eleve_id    uuid references eleves(id) on delete set null,
  tuteur_id   uuid references tuteurs(id) on delete set null,
  type        text not null,            -- scolarite | inscription | frequentation | bulletin | autre
  message     text,
  statut      text not null default 'en_attente' check (statut in ('en_attente','en_cours','pret','rejete')),
  reponse     text,
  traite_par  uuid references profils(id) on delete set null,
  traite_le   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists demandes_ecole_idx on demandes_documents(ecole_id);

alter table demandes_documents enable row level security;
drop policy if exists demandes_tenant on demandes_documents;
create policy demandes_tenant on demandes_documents
  using (est_super_admin() or ecole_id = ecole_courante())
  with check (est_super_admin() or ecole_id = ecole_courante());

-- Le parent dépose une demande
create or replace function public.demander_document(p_eleve uuid, p_type text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tuteur uuid; v_ecole uuid;
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select ecole_id into v_ecole from eleves where id = p_eleve;
  select t.id into v_tuteur
  from tuteurs t join eleve_tuteurs et on et.tuteur_id = t.id
  where t.profil_id = auth.uid() and et.eleve_id = p_eleve limit 1;
  insert into demandes_documents (ecole_id, eleve_id, tuteur_id, type, message)
  values (v_ecole, p_eleve, v_tuteur, p_type, p_message);
end $$;

-- Suivi des demandes du parent
create or replace function public.mes_demandes()
returns table(id uuid, eleve text, type text, message text, statut text, reponse text, created_at timestamptz, ecole text)
language sql security definer set search_path = public as $$
  select d.id, e.prenom || ' ' || e.nom, d.type, d.message, d.statut, d.reponse, d.created_at, ec.nom
  from demandes_documents d
  join tuteurs t on t.id = d.tuteur_id
  left join eleves e on e.id = d.eleve_id
  left join ecoles ec on ec.id = d.ecole_id
  where t.profil_id = auth.uid()
  order by d.created_at desc;
$$;

-- L'administration traite une demande (+ notifie le parent)
create or replace function public.traiter_demande(p_demande uuid, p_statut text, p_reponse text)
returns void language plpgsql security definer set search_path = public as $$
declare d record; v_profil uuid;
begin
  select * into d from demandes_documents where id = p_demande;
  if d is null then raise exception 'Demande introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('comptable') or a_role('secretaire')) then
    raise exception 'Réservé à l''administration.';
  end if;

  update demandes_documents
    set statut = p_statut, reponse = p_reponse, traite_par = auth.uid(), traite_le = now()
    where id = p_demande;

  if p_statut in ('pret', 'rejete') then
    select profil_id into v_profil from tuteurs where id = d.tuteur_id;
    if v_profil is not null then
      insert into notifications (ecole_id, destinataire_id, titre, message)
      values (d.ecole_id, v_profil, 'Demande de document',
        case when p_statut = 'pret' then 'Votre document est prêt à être retiré.' else 'Votre demande a été traitée.' end
        || coalesce(' ' || nullif(p_reponse, ''), ''));
    end if;
  end if;
end $$;

revoke execute on function public.demander_document(uuid, text, text) from public, anon;
grant execute on function public.demander_document(uuid, text, text) to authenticated;
revoke execute on function public.mes_demandes() from public, anon;
grant execute on function public.mes_demandes() to authenticated;
revoke execute on function public.traiter_demande(uuid, text, text) from public, anon;
grant execute on function public.traiter_demande(uuid, text, text) to authenticated;
