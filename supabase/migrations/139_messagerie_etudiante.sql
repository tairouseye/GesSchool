-- =====================================================================
--  139 — Messagerie étudiante (et une faille de la messagerie parent)
--
--  `messages` (migration 014) modélise UN SEUL interlocuteur : le tuteur.
--  `tuteur_id` est NOT NULL et `expediteur` n'accepte que 'parent'|'ecole'.
--  Au supérieur, l'étudiant est majeur, paie lui-même et fait ses démarches
--  seul — le faire passer par ses parents pour écrire à la scolarité était la
--  même incohérence que celle corrigée en migration 130 pour ses factures.
--
--  Choix de modélisation : on ÉTEND la table plutôt que d'en créer une
--  seconde. Un fil reste un fil ; dupliquer la table aurait dupliqué les
--  quatre RPC, la RLS et l'écran. `eleve_id` rejoint `tuteur_id`, avec la
--  contrainte « exactement un des deux » — même patron que l'emprunteur de
--  `biblio_emprunts` (profil OU fiche élève).
--
--  ⚠️ FAILLE TROUVÉE EN CHEMIN, corrigée ici : `ecole_conversations()`
--  (mig. 014) est SECURITY DEFINER et n'est gardée que par `ecole_courante()`.
--  La migration 133 a fermé la TABLE `messages` aux enseignants… mais pas
--  cette fonction, qui leur renvoie le dernier message de chaque conversation
--  parent. Le durcissement de la 133 était donc contournable par un simple
--  appel RPC. Le même garde-fou est posé sur les deux fonctions.
--
--  Prérequis : migrations 014, 112, 130, 133.
-- =====================================================================

-- --- 1. Schéma ------------------------------------------------------------
alter table messages alter column tuteur_id drop not null;
alter table messages
  add column if not exists eleve_id uuid references eleves(id) on delete cascade;

-- La contrainte d'origine est anonyme (`check (...)` en ligne, mig. 014) :
-- son nom est généré par Postgres. On la retrouve par sa DÉFINITION plutôt
-- que de parier sur `messages_expediteur_check` — deviner un nom qui n'existe
-- pas laisserait l'ancienne contrainte en place et l'insertion échouerait.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class cl     on cl.oid = con.conrelid
      join pg_namespace n  on n.oid = cl.relnamespace
     where n.nspname = 'public' and cl.relname = 'messages'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%expediteur%'
  loop
    execute format('alter table public.messages drop constraint %I;', c.conname);
    raise notice 'Contrainte supprimée : %', c.conname;
  end loop;
end $$;

--  `add constraint` n'a pas de variante `if not exists` : on précède chaque
--  ajout d'un drop, pour que la migration reste rejouable comme les autres.
alter table messages drop constraint if exists messages_expediteur_chk;
alter table messages
  add constraint messages_expediteur_chk
  check (expediteur in ('parent', 'ecole', 'etudiant'));

-- Un fil appartient à un parent OU à un étudiant, jamais aux deux ni à
-- personne : sans cela, un message orphelin serait invisible des deux côtés.
alter table messages drop constraint if exists messages_destinataire_chk;
alter table messages
  add constraint messages_destinataire_chk
  check ((tuteur_id is not null) <> (eleve_id is not null));

-- Et l'expéditeur doit être cohérent avec le fil : un message 'etudiant'
-- dans un fil de parent n'aurait aucun sens.
alter table messages drop constraint if exists messages_coherence_chk;
alter table messages
  add constraint messages_coherence_chk
  check (
    expediteur = 'ecole'
    or (expediteur = 'parent'   and tuteur_id is not null)
    or (expediteur = 'etudiant' and eleve_id  is not null)
  );

create index if not exists messages_eleve_idx on messages(eleve_id, created_at);

-- --- 2. Notification : un message non vu est un message qui n'existe pas ---
--  Le déclencheur ne concerne QUE les fils étudiants : il sort immédiatement
--  sur un fil parent. Notifier aussi les parents serait un changement de
--  comportement pour des utilisateurs réels (le push est branché, mig. 066)
--  — à décider séparément, pas à glisser dans cette migration.
create or replace function public.trg_notif_message_etudiant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profil uuid;
begin
  if new.eleve_id is null or new.expediteur <> 'ecole' then
    return null;
  end if;
  select profil_id into v_profil from eleves where id = new.eleve_id;
  if v_profil is null then
    return null;                      -- étudiant sans compte : rien à notifier
  end if;
  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  values (new.ecole_id, v_profil, 'Nouveau message de l''établissement',
          left(new.contenu, 140), new.eleve_id, 'message');
  return null;
end $$;

drop trigger if exists trg_notif_message_etudiant on messages;
create trigger trg_notif_message_etudiant
  after insert on messages
  for each row execute function public.trg_notif_message_etudiant();

-- =====================================================================
--  3. CÔTÉ ÉTUDIANT — RPC, comme pour ses notes et ses factures
-- =====================================================================
--  `_eleve_courant()` (mig. 130) résout la fiche du compte connecté : un
--  étudiant a un seul dossier, donc un seul fil. Pas de paramètre à passer,
--  donc rien à falsifier.

create or replace function public.ma_conversation()
returns table (id uuid, expediteur text, contenu text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_moi uuid := _eleve_courant();
begin
  if v_moi is null then
    return;                           -- compte non rattaché : fil vide
  end if;
  -- Ouvrir le fil vaut lecture.
  update messages set lu = true
   where messages.eleve_id = v_moi and messages.expediteur = 'ecole' and messages.lu = false;
  return query
    select m.id, m.expediteur, m.contenu, m.created_at
      from messages m
     where m.eleve_id = v_moi
     order by m.created_at;
end $$;
revoke execute on function public.ma_conversation() from public, anon;
grant execute on function public.ma_conversation() to authenticated;

create or replace function public.etudiant_envoyer(p_contenu text)
returns void language plpgsql security definer set search_path = public as $$
declare v_moi uuid := _eleve_courant(); v_ecole uuid;
begin
  if v_moi is null then
    raise exception 'Ce compte n''est rattaché à aucun dossier étudiant.';
  end if;
  if coalesce(trim(p_contenu), '') = '' then
    return;
  end if;
  select ecole_id into v_ecole from eleves where id = v_moi;
  insert into messages (ecole_id, eleve_id, expediteur, contenu, auteur_id)
  values (v_ecole, v_moi, 'etudiant', trim(p_contenu), auth.uid());
end $$;
revoke execute on function public.etudiant_envoyer(text) from public, anon;
grant execute on function public.etudiant_envoyer(text) to authenticated;

create or replace function public.mes_messages_non_lus_etudiant()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from messages m
   where m.eleve_id = _eleve_courant()
     and m.expediteur = 'ecole' and m.lu = false;
$$;
revoke execute on function public.mes_messages_non_lus_etudiant() from public, anon;
grant execute on function public.mes_messages_non_lus_etudiant() to authenticated;

-- =====================================================================
--  4. CÔTÉ ÉTABLISSEMENT
-- =====================================================================
--  Contrairement à `ecole_conversations()` qui liste TOUS les tuteurs avec un
--  compte, on ne liste ici que les étudiants ayant déjà échangé. Le personnel
--  ouvre un nouveau fil par la recherche d'étudiant : à 10 000 inscrits, une
--  liste exhaustive ne serait ni utilisable ni supportable.
create or replace function public.ecole_conversations_etudiants()
returns table (eleve_id uuid, etudiant text, matricule text,
               dernier text, dernier_le timestamptz, non_lus bigint)
language sql stable security definer set search_path = public as $$
  select e.id, e.prenom || ' ' || e.nom, e.matricule,
    (select m.contenu    from messages m where m.eleve_id = e.id order by m.created_at desc limit 1),
    (select m.created_at from messages m where m.eleve_id = e.id order by m.created_at desc limit 1),
    (select count(*)     from messages m where m.eleve_id = e.id
                          and m.expediteur = 'etudiant' and m.lu = false)
    from eleves e
   where e.ecole_id = ecole_courante()
     and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire'))
     and exists (select 1 from messages m where m.eleve_id = e.id)
   order by 5 desc nulls last;
$$;
revoke execute on function public.ecole_conversations_etudiants() from public, anon;
grant execute on function public.ecole_conversations_etudiants() to authenticated;

-- --- Correctif de sécurité : la même garde sur la fonction PARENT ---------
--  Le corps change, la signature est identique — pas de `drop function`
--  nécessaire (sinon : 42P13, cf. migrations 114 et 131).
create or replace function public.ecole_conversations()
returns table(tuteur_id uuid, parent text, telephone text, dernier text, dernier_le timestamptz, non_lus bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.prenom || ' ' || t.nom, t.telephone,
    (select m.contenu    from messages m where m.tuteur_id = t.id order by m.created_at desc limit 1),
    (select m.created_at from messages m where m.tuteur_id = t.id order by m.created_at desc limit 1),
    (select count(*)     from messages m where m.tuteur_id = t.id
                          and m.expediteur = 'parent' and m.lu = false)
  from tuteurs t
  where t.ecole_id = ecole_courante()
    and t.profil_id is not null
    -- Ajouté en 139 : mêmes rôles que la policy `messages_gestion` (mig. 133).
    and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire'))
  order by 5 desc nulls last;
$$;
revoke execute on function public.ecole_conversations() from public, anon;
grant execute on function public.ecole_conversations() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE — avec un compte `enseignant` d'UCAD :
--    select * from ecole_conversations();             -- doit renvoyer 0 ligne
--    select * from ecole_conversations_etudiants();   -- doit renvoyer 0 ligne
--  Avec le compte étudiant : `ma_conversation()` ne renvoie que son fil.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists trg_notif_message_etudiant on messages;
-- drop function if exists public.trg_notif_message_etudiant();
-- drop function if exists public.ma_conversation();
-- drop function if exists public.etudiant_envoyer(text);
-- drop function if exists public.mes_messages_non_lus_etudiant();
-- drop function if exists public.ecole_conversations_etudiants();
-- alter table messages drop constraint if exists messages_coherence_chk;
-- alter table messages drop constraint if exists messages_destinataire_chk;
-- alter table messages drop constraint if exists messages_expediteur_chk;
-- alter table messages add constraint messages_expediteur_check
--   check (expediteur in ('parent', 'ecole'));
-- delete from messages where eleve_id is not null;   -- avant de rétablir NOT NULL
-- alter table messages drop column if exists eleve_id;
-- alter table messages alter column tuteur_id set not null;
-- (puis réappliquer le corps d'origine de `ecole_conversations` — mig. 014.)
