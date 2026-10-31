-- =====================================================================
--  216 — Démonstration SANS COMPTE, en lecture seule
--
--  LE BESOIN (promoteur, 31/10/2026, option 1 retenue) : sur l'écran de
--  connexion, « Découvrir GesSchool » ouvre une école de démonstration
--  comme PARENT (téléphone) ou comme DIRECTION (ordinateur), sans e-mail ni
--  mot de passe. On regarde tout, on n'enregistre rien.
--
--  COMMENT ON ENTRE. La fonction Edge `demo` ouvre une session sur l'un des
--  deux comptes partagés (demo.parent@… / demo.direction@…). Ces comptes
--  portent `app_metadata.demo` = 'parent' | 'direction'. `app_metadata` ne
--  se modifie qu'avec la clé de service : un visiteur ne peut ni se l'ôter
--  ni se le donner. Il est dans le jeton, donc la base le lit SANS requête.
--
--  POURQUOI UN TRIGGER, ET PAS LA RLS. Les écritures passent aussi par des
--  RPC SECURITY DEFINER, qui ignorent la RLS. Un trigger, lui, se déclenche
--  quel que soit le rôle qui écrit. Et `auth.jwt()` reste celui du visiteur
--  à l'intérieur d'une fonction SECURITY DEFINER. Un seul verrou couvre donc
--  les écrans, les RPC et les triggers en cascade.
--
--  ⚠️ PAR LIGNE, ET NON PAR INSTRUCTION. Un trigger d'instruction se
--  déclencherait aussi sur un `update … where` qui ne touche aucune ligne :
--  une page qui « marque comme lu » à l'ouverture tomberait en erreur sans
--  rien avoir changé. Par ligne, seule une vraie modification est refusée.
--
--  ⚠️ LES NOTIFICATIONS RESTENT « LISIBLES ». Marquer une alerte comme lue
--  est un UPDATE sur `notifications` ; le refuser laisserait les pastilles
--  allumées pour toujours. On y bloque l'ajout et la suppression, pas la
--  mise à jour (la RLS limite déjà chacun à ses propres notifications).
--
--  ⚠️ TOUTE NOUVELLE TABLE DOIT ÊTRE PROTÉGÉE. Une migration qui crée une
--  table appelle `select public.demo_proteger_tables();` à la fin. Le test
--  test/demo.test.mjs le vérifie pour toutes les migrations après 216.
--
--  Les comptes eux-mêmes (profil, rôles, tuteur) sont posés par
--  supabase/tests/demo_comptes.sql, une fois la fonction `demo` déployée.
-- =====================================================================

-- --- 1. Le visiteur est-il en démonstration ? ------------------------------
--  Sans jeton (éditeur SQL, pg_cron, clé de service), auth.jwt() est nul :
--  la réponse est « non », et l'administration n'est jamais bloquée.
create or replace function public.est_compte_demo()
returns boolean
language sql stable set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'demo', '') <> ''
$$;

revoke all on function public.est_compte_demo() from public, anon;
grant execute on function public.est_compte_demo() to authenticated;

-- --- 2. Le verrou ----------------------------------------------------------
--  Code SQLSTATE propre ('GSDEM') : l'écran peut reconnaître ce refus sans
--  lire le texte. Le message, lui, s'affiche tel quel dans les alertes.
create or replace function public.demo_lecture_seule()
returns trigger
language plpgsql set search_path = public as $$
begin
  if public.est_compte_demo() then
    raise exception using
      errcode = 'GSDEM',
      message = 'Mode démonstration : rien n''est enregistré. Créez votre école pour essayer pour de vrai.';
  end if;
  return coalesce(new, old);
end $$;

-- --- 3. Pose du verrou sur toutes les tables de `public` --------------------
--  Rejouable : `create or replace trigger` (PG 14+). Une table qu'on ne
--  possède pas (extension) est signalée et passée, sans tout faire échouer.
--  Les partitions héritent du trigger de leur table mère.
create or replace function public.demo_proteger_tables()
returns integer
language plpgsql set search_path = public as $$
declare
  t record;
  n integer := 0;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public'
       and c.relkind in ('r', 'p')
       and not c.relispartition
  loop
    begin
      execute format(
        'create or replace trigger trg_demo_lecture_seule before %s on public.%I
           for each row execute function public.demo_lecture_seule()',
        case when t.relname = 'notifications' then 'insert or delete'
             else 'insert or update or delete' end,
        t.relname);
      n := n + 1;
    exception when insufficient_privilege then
      raise notice 'Table % non protégée (propriétaire différent).', t.relname;
    end;
  end loop;
  return n;
end $$;

revoke all on function public.demo_proteger_tables() from public, anon, authenticated;

select public.demo_proteger_tables();

-- --- 4. Fichiers (Storage) ---------------------------------------------------
--  Le schéma `storage` n'est pas à nous : pas de trigger, mais des policies
--  RESTRICTIVES, qui s'ajoutent en ET aux policies existantes. Un visiteur
--  ne dépose, ne remplace ni ne supprime aucun fichier ; il les voit.
drop policy if exists "demo_lecture_seule_ajout" on storage.objects;
create policy "demo_lecture_seule_ajout" on storage.objects
  as restrictive for insert to authenticated
  with check (not public.est_compte_demo());

drop policy if exists "demo_lecture_seule_maj" on storage.objects;
create policy "demo_lecture_seule_maj" on storage.objects
  as restrictive for update to authenticated
  using (not public.est_compte_demo())
  with check (not public.est_compte_demo());

drop policy if exists "demo_lecture_seule_suppr" on storage.objects;
create policy "demo_lecture_seule_suppr" on storage.objects
  as restrictive for delete to authenticated
  using (not public.est_compte_demo());

notify pgrst, 'reload schema';
