-- =====================================================================
--  166 — Le bulletin passe par des états, et le conseil de classe signe
--
--  Points 6 et 7 de la visite :
--    6. « le bulletin devrait suivre un circuit : brouillon, validé, publié,
--       et savoir si le parent l'a consulté » ;
--    7. « le PV doit être validé par le Responsable pédagogique — chez
--       Tut'Tank il y en a DEUX, un pour le préscolaire et un pour
--       l'élémentaire — et par le responsable de la Gestion ; il faut donc
--       deux signatures. »
--
--  ⚠️ CE QUE « PUBLIER » VOULAIT DIRE JUSQU'ICI. La fonction applicative
--  s'appelle `publierBulletins` et son commentaire dit « persiste les
--  bulletins calculés → visibles par les parents ». Autrement dit : écrire
--  le bulletin le rendait AUSSITÔT visible. Il n'y avait pas d'état, donc
--  pas de relecture possible avant diffusion.
--
--  ⚠️ L'ORDRE DES OPÉRATIONS DU §1 EST CRITIQUE. Écrire
--  `add column statut text not null default 'brouillon'` mettrait TOUS les
--  bulletins existants en brouillon — et ferait disparaître, d'un coup, tous
--  les bulletins que les parents consultent aujourd'hui. On ajoute donc la
--  colonne NULLABLE, on remplit l'existant en « publié » (c'est leur état
--  réel : ils sont visibles), et seulement ensuite on pose le défaut pour
--  les NOUVELLES lignes. Même leçon que le défaut de `type_etablissement` :
--  `add column` n'applique son défaut qu'aux lignes à venir.
--
--  ⚠️ ET L'APPLICATION N'ENVOIE PAS `statut` DANS SON UPSERT. C'est
--  volontaire : `on conflict do update` ne touche que les colonnes
--  transmises. Régénérer un bulletin déjà publié conserve donc sa
--  publication, au lieu de le faire disparaître de l'espace parent.
--
--  ⚠️ POURQUOI UNE TABLE DÉDIÉE POUR LES RESPONSABLES DE CYCLE, et non une
--  portée sur `profil_roles`. Cette table est lue par `a_role()`,
--  `est_gestion()`, `est_membre_ecole()` et par la quasi-totalité des
--  policies de l'application. Y ajouter une portée changerait le sens de
--  chaque appel existant — un risque large pour un besoin local. La
--  désignation « qui est responsable de quel cycle » est un fait
--  d'organisation : elle vit dans sa propre table.
--
--  Prérequis : migrations 001, 011, 018, 033, 114 (consentement), 163.
-- =====================================================================

-- --- 1. Les états du bulletin ---------------------------------------------
alter table bulletins add column if not exists statut text;

--  L'existant est VISIBLE aujourd'hui : son état réel est « publié ».
--  Sans cette ligne, la migration couperait l'accès de tous les parents.
update bulletins set statut = 'publie' where statut is null;

--  `add column if not exists` étant un NO-OP sur une colonne déjà là, le
--  défaut, le NOT NULL et la contrainte se posent SÉPARÉMENT — sinon ils ne
--  s'appliqueraient pas lors d'un rejeu de la migration.
alter table bulletins alter column statut set default 'brouillon';
alter table bulletins alter column statut set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bulletins_statut_chk') then
    alter table bulletins add constraint bulletins_statut_chk
      check (statut in ('brouillon', 'valide', 'publie'));
  end if;
end $$;

alter table bulletins add column if not exists valide_le   timestamptz;
alter table bulletins add column if not exists valide_par  uuid references profils(id) on delete set null;
alter table bulletins add column if not exists publie_le   timestamptz;
alter table bulletins add column if not exists publie_par  uuid references profils(id) on delete set null;
--  « Consulté » n'est pas un quatrième état : c'est un fait daté qui
--  s'ajoute à « publié ». Un bulletin publié et lu reste publié.
alter table bulletins add column if not exists consulte_le timestamptz;

create index if not exists bulletins_statut_idx on bulletins(classe_id, periode_id, statut);

comment on column bulletins.statut is
  'brouillon (relecture) · valide (arrêté) · publie (visible du parent). L''existant a été repris en « publie » (mig. 166).';
comment on column bulletins.consulte_le is
  'Première ouverture par le parent. NULL = jamais consulté (mig. 166).';

-- --- 1 bis. 🔴 VERROU DE COLONNE : qui peut changer l'état -----------------
--  ⚠️ FAILLE TROUVÉE EN VÉRIFIANT LA POLICY EXISTANTE. La migration 058
--  autorise l'ENSEIGNANT de la classe à écrire dans `bulletins`
--  (« a_role('enseignant') and enseigne_classe(classe_id) ») — c'est
--  normal, c'est lui qui renseigne les appréciations. Mais `statut` est une
--  colonne comme les autres : sans ce verrou, un enseignant pourrait écrire
--  `statut = 'publie'` par un simple PATCH sur l'API et diffuser lui-même
--  les bulletins de sa classe, sans passer par la direction. Le circuit
--  n'aurait existé que dans l'écran.
--
--  On ne touche PAS à la policy de la 058 — l'enseignant doit continuer à
--  écrire les notes et les appréciations. On garde la seule colonne qui
--  porte la décision.
create or replace function public._verifier_statut_bulletin()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  --  À l'insertion, un bulletin naît en relecture. Le créer directement
  --  « publié » reviendrait à sauter le circuit.
  if tg_op = 'INSERT' then
    if new.statut is distinct from 'brouillon'
       and not (est_super_admin() or est_admin() or a_role('direction')) then
      raise exception 'Un bulletin se crée en brouillon ; seule la direction le publie.';
    end if;
    return new;
  end if;
  if new.statut is distinct from old.statut
     and not (est_super_admin() or est_admin() or a_role('direction')) then
    raise exception 'Seule la direction peut changer l''état d''un bulletin.';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_statut_bulletin_ins on bulletins;
create trigger trg_statut_bulletin_ins
  before insert on bulletins
  for each row execute function public._verifier_statut_bulletin();

--  `of statut` : le déclencheur ne se réveille que si l'UPDATE mentionne la
--  colonne. L'upsert de l'application, qui ne l'envoie pas, n'est pas
--  ralenti et ne risque pas d'être refusé.
drop trigger if exists trg_statut_bulletin_upd on bulletins;
create trigger trg_statut_bulletin_upd
  before update of statut on bulletins
  for each row execute function public._verifier_statut_bulletin();

-- --- 2. Qui est responsable pédagogique de quel cycle ---------------------
--  Chez Tut'Tank : un responsable pour le préscolaire, un pour
--  l'élémentaire. Plusieurs responsables par cycle restent possibles — une
--  école peut avoir un adjoint, et rien ne justifie de l'interdire.
create table if not exists responsables_cycle (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  cycle_id   uuid not null references cycles(id) on delete cascade,
  profil_id  uuid not null references profils(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cycle_id, profil_id)
);
create index if not exists responsables_cycle_idx on responsables_cycle(ecole_id, cycle_id);
create index if not exists responsables_cycle_profil_idx on responsables_cycle(profil_id);

comment on table responsables_cycle is
  'Responsable pédagogique d''un cycle. Sert à exiger la signature du BON responsable sur le PV (mig. 166).';

alter table responsables_cycle enable row level security;

drop policy if exists responsables_cycle_select on responsables_cycle;
create policy responsables_cycle_select on responsables_cycle for select
  using (est_super_admin() or ecole_id = ecole_courante());

--  Désigner un responsable est un acte d'organisation : le promoteur seul.
--  Si la direction pouvait se désigner elle-même, la signature du PV ne
--  vaudrait plus rien — elle se décernerait son propre droit de signer.
do $$
declare pred text := 'est_admin()';
begin
  execute 'drop policy if exists responsables_cycle_ins on public.responsables_cycle';
  execute 'drop policy if exists responsables_cycle_upd on public.responsables_cycle';
  execute 'drop policy if exists responsables_cycle_del on public.responsables_cycle';
  execute format('create policy responsables_cycle_ins on public.responsables_cycle for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy responsables_cycle_upd on public.responsables_cycle for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy responsables_cycle_del on public.responsables_cycle for delete using (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
end $$;

--  Le cycle d'une classe : classe → niveau → cycle.
create or replace function public.cycle_de_classe(p_classe uuid)
returns uuid language sql stable security definer set search_path = public as $fn$
  select n.cycle_id from classes c join niveaux n on n.id = c.niveau_id where c.id = p_classe;
$fn$;

--  ⚠️ FAIL-CLOSED : un cycle inconnu, une session absente ⇒ faux.
create or replace function public.est_responsable_cycle(p_cycle uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_cycle is not null and auth.uid() is not null and exists (
    select 1 from responsables_cycle rc
      join profils p on p.id = rc.profil_id
     where rc.cycle_id = p_cycle and rc.profil_id = auth.uid() and p.actif
  );
$fn$;
revoke execute on function public.est_responsable_cycle(uuid) from public, anon;
grant execute on function public.est_responsable_cycle(uuid) to authenticated;
revoke execute on function public.cycle_de_classe(uuid) from public, anon;
grant execute on function public.cycle_de_classe(uuid) to authenticated;

-- --- 3. Le conseil de classe et son procès-verbal -------------------------
create table if not exists conseils_classe (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  classe_id    uuid not null references classes(id) on delete cascade,
  periode_id   uuid not null references periodes(id) on delete cascade,
  tenu_le      date,
  observations text,
  cree_par     uuid references profils(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (classe_id, periode_id)
);
create index if not exists conseils_classe_idx on conseils_classe(ecole_id, periode_id);

comment on table conseils_classe is
  'Procès-verbal du conseil de classe, un par classe et par période (mig. 166).';

--  Les signatures. DEUX garanties portées par des contraintes, pas par
--  l'écran :
--    • `unique (conseil_id, qualite)` : une seule signature par qualité ;
--    • `unique (conseil_id, profil_id)` : une même personne ne peut pas
--      fournir les DEUX signatures. Sans elle, un compte cumulant la
--      direction et la gestion signerait seul un PV « à deux signatures »,
--      et l'exigence de l'école serait vidée de son sens.
create table if not exists conseil_signatures (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  conseil_id uuid not null references conseils_classe(id) on delete cascade,
  profil_id  uuid not null references profils(id) on delete cascade,
  qualite    text not null check (qualite in ('pedagogique', 'gestion')),
  signe_le   timestamptz not null default now(),
  unique (conseil_id, qualite),
  unique (conseil_id, profil_id)
);
create index if not exists conseil_signatures_idx on conseil_signatures(conseil_id);

alter table conseils_classe enable row level security;
alter table conseil_signatures enable row level security;

--  Lecture : le personnel de l'établissement. Un PV n'est pas un document
--  de famille — les parents n'y accèdent pas (aucune policy ne le leur
--  ouvre, et `ecole_courante()` est NULL pour eux).
do $$
declare t text;
begin
  foreach t in array array['conseils_classe','conseil_signatures'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('create policy %1$s_select on public.%1$I for select using (est_super_admin() or ecole_id = ecole_courante());', t);
  end loop;
end $$;

--  Ouvrir / annoter un PV : promoteur, direction, secrétariat.
do $$
declare pred text := '(est_admin() or a_role(''direction'') or a_role(''secretaire''))';
begin
  execute 'drop policy if exists conseils_classe_ins on public.conseils_classe';
  execute 'drop policy if exists conseils_classe_upd on public.conseils_classe';
  execute 'drop policy if exists conseils_classe_del on public.conseils_classe';
  execute format('create policy conseils_classe_ins on public.conseils_classe for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy conseils_classe_upd on public.conseils_classe for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy conseils_classe_del on public.conseils_classe for delete using (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
end $$;

--  ⚠️ LES SIGNATURES NE S'ÉCRIVENT PAS DIRECTEMENT. Aucune policy
--  d'insertion n'est posée sur `conseil_signatures` : on signe par la RPC
--  `signer_conseil`, qui contrôle la QUALITÉ du signataire. Une policy
--  « with check » ne saurait pas, à elle seule, vérifier que le signataire
--  pédagogique est responsable DU CYCLE de la classe concernée.
--  Retirer sa propre signature reste permis : une signature posée par
--  erreur doit pouvoir être reprise.
drop policy if exists conseil_signatures_del on conseil_signatures;
create policy conseil_signatures_del on conseil_signatures for delete
  using (est_super_admin() or (ecole_id = ecole_courante() and profil_id = auth.uid()));

-- --- 4. Signer, avec la bonne qualité -------------------------------------
--  SECURITY INVOKER : la fonction a pour métier d'APPLIQUER la RLS, pas de
--  la contourner. C'est la leçon de `_doc_peut_lire` (mig. 150).
create or replace function public.signer_conseil(p_conseil uuid, p_qualite text)
returns void language plpgsql security invoker set search_path = public as $fn$
declare v_classe uuid; v_ecole uuid; v_cycle uuid;
begin
  select cc.classe_id, cc.ecole_id into v_classe, v_ecole
    from conseils_classe cc where cc.id = p_conseil;
  --  `found` est faux aussi bien quand le PV n'existe pas que quand la RLS
  --  le masque : on ne distingue pas les deux, pour ne rien révéler.
  if not found then
    raise exception 'Procès-verbal introuvable.';
  end if;
  if p_qualite not in ('pedagogique', 'gestion') then
    raise exception 'Qualité de signature inconnue.';
  end if;

  if p_qualite = 'pedagogique' then
    v_cycle := public.cycle_de_classe(v_classe);
    if not public.est_responsable_cycle(v_cycle) then
      raise exception 'Seul le responsable pédagogique de ce cycle peut apposer cette signature.';
    end if;
  else
    --  ⚠️ PAS `est_gestion()` ICI. Ce helper (mig. 011) vaut vrai pour
    --  `direction` : un responsable pédagogique aurait alors pu fournir les
    --  DEUX signatures, et le « PV à deux signatures » n'en aurait exigé
    --  qu'une. On nomme donc explicitement les rôles de l'espace Gestion.
    if not (est_admin() or a_role('comptable') or a_role('secretaire')) then
      raise exception 'Seule la gestion de l''établissement peut apposer cette signature.';
    end if;
  end if;

  insert into conseil_signatures (ecole_id, conseil_id, profil_id, qualite)
  values (v_ecole, p_conseil, auth.uid(), p_qualite)
  on conflict (conseil_id, qualite) do nothing;

  --  Rien inséré : soit la qualité est déjà signée, soit cette personne a
  --  déjà signé dans l'autre qualité. Le dire, plutôt que de laisser croire
  --  au succès.
  if not exists (select 1 from conseil_signatures s
                  where s.conseil_id = p_conseil and s.profil_id = auth.uid() and s.qualite = p_qualite) then
    raise exception 'Cette signature est déjà apposée, ou vous avez déjà signé ce procès-verbal dans l''autre qualité.';
  end if;
end $fn$;
revoke execute on function public.signer_conseil(uuid, text) from public, anon;
grant execute on function public.signer_conseil(uuid, text) to authenticated;

--  Un PV est complet quand il porte SES DEUX signatures.
create or replace function public.conseil_complet(p_conseil uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select count(distinct s.qualite) = 2 from conseil_signatures s where s.conseil_id = p_conseil
  ), false);
$fn$;
revoke execute on function public.conseil_complet(uuid) from public, anon;
grant execute on function public.conseil_complet(uuid) to authenticated;

-- --- 5. Faire avancer les bulletins d'une classe --------------------------
--  Un acte de classe entière : l'école arrête puis diffuse une période, pas
--  un bulletin à la fois. On rend le NOMBRE de bulletins touchés, pour que
--  l'écran dise « 24 bulletins publiés » plutôt qu'un vague succès.
create or replace function public.avancer_bulletins(
  p_classe uuid, p_periode uuid, p_statut text
) returns integer language plpgsql security invoker set search_path = public as $fn$
declare v_n integer; v_cycle uuid;
begin
  if p_statut not in ('brouillon', 'valide', 'publie') then
    raise exception 'État inconnu.';
  end if;
  v_cycle := public.cycle_de_classe(p_classe);
  if v_cycle is null then
    raise exception 'Classe introuvable.';
  end if;
  --  ⚠️ ADMIN ET DIRECTION SEULEMENT, et pas « responsable de cycle » en
  --  plus. La policy d'écriture de `bulletins` (mig. 058) repose sur
  --  `est_gestion()`, qui ne connaît pas les responsables de cycle : un
  --  responsable sans le rôle `direction` aurait passé ce contrôle, puis vu
  --  son UPDATE filtré par la RLS — zéro ligne touchée, donc le message
  --  « aucun bulletin à faire avancer », parfaitement trompeur. Les deux
  --  responsables pédagogiques de Tut'Tank portent le rôle `direction`
  --  (vérifié en base) : le besoin est couvert sans élargir la RLS d'une
  --  table aussi sensible que les bulletins.
  if not (est_admin() or a_role('direction')) then
    raise exception 'Seule la direction peut faire avancer les bulletins.';
  end if;

  update bulletins b
     set statut = p_statut,
         valide_le  = case when p_statut = 'valide' then now() else b.valide_le end,
         valide_par = case when p_statut = 'valide' then auth.uid() else b.valide_par end,
         publie_le  = case when p_statut = 'publie' then now() else b.publie_le end,
         publie_par = case when p_statut = 'publie' then auth.uid() else b.publie_par end
   where b.classe_id = p_classe and b.periode_id = p_periode;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    --  Zéro ligne : aucun bulletin généré, ou la RLS les masque. Dans les
    --  deux cas, l'écran ne doit pas afficher un succès.
    raise exception 'Aucun bulletin à faire avancer pour cette classe et cette période.';
  end if;
  return v_n;
end $fn$;
revoke execute on function public.avancer_bulletins(uuid, uuid, text) from public, anon;
grant execute on function public.avancer_bulletins(uuid, uuid, text) to authenticated;

--  État d'avancement d'une classe, pour l'écran : combien par état, le PV
--  est-il ouvert, est-il complet, combien de parents ont consulté.
drop function if exists public.etat_bulletins(uuid, uuid);
create or replace function public.etat_bulletins(p_classe uuid, p_periode uuid)
returns table(
  brouillon bigint, valide bigint, publie bigint, consultes bigint,
  conseil_id uuid, conseil_complet boolean, signatures jsonb
) language sql stable security invoker set search_path = public as $fn$
  with b as (
    select * from bulletins where classe_id = p_classe and periode_id = p_periode
  ), cc as (
    select id from conseils_classe where classe_id = p_classe and periode_id = p_periode
  )
  select
    (select count(*) from b where statut = 'brouillon'),
    (select count(*) from b where statut = 'valide'),
    (select count(*) from b where statut = 'publie'),
    (select count(*) from b where consulte_le is not null),
    (select id from cc),
    coalesce(public.conseil_complet((select id from cc)), false),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'qualite', s.qualite, 'signe_le', s.signe_le,
               --  ⚠️ `profil_id` EST NÉCESSAIRE À L'ÉCRAN : c'est lui qui
               --  permet de reconnaître SA propre signature — pour offrir de
               --  la retirer, et pour ne PAS proposer à quelqu'un qui a déjà
               --  signé d'apposer l'autre signature (la base le refuse, mais
               --  un bouton qui mène à un refus est un défaut d'interface).
               'profil_id', s.profil_id,
               'nom', trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, ''))))
        from conseil_signatures s
        left join profils p on p.id = s.profil_id
       where s.conseil_id = (select id from cc)
    ), '[]'::jsonb);
$fn$;
revoke execute on function public.etat_bulletins(uuid, uuid) from public, anon;
grant execute on function public.etat_bulletins(uuid, uuid) to authenticated;

-- --- 6. Le parent ne voit que ce qui est PUBLIÉ ---------------------------
--  ⚠️ `create or replace` ne peut pas changer un `returns table(...)` :
--  il faut détruire d'abord (42P13). Même piège qu'aux migrations 163 et 165.
--
--  ⚠️ LA GRILLE DE CONSENTEMENT DE LA MIGRATION 114 EST CONSERVÉE TELLE
--  QUELLE (`_parent_possede` puis `_acces_notes_autorise`). Elle protège
--  contre « un parent voit les notes d'un autre enfant » : on n'y touche pas.
drop function if exists public.enfant_bulletins(uuid);
create or replace function public.enfant_bulletins(p_eleve uuid)
returns table(
  id uuid, periode text, ordre int, moyenne numeric, rang int, effectif int, mention text,
  ecole text, sigle text, classe text, eleve_prenom text, eleve_nom text, matricule text, annee text,
  logo text,
  affiche_absences boolean, absences bigint, absences_justifiees bigint
)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;

  --  « Consulté » : on date la PREMIÈRE ouverture seulement. Écrire à chaque
  --  lecture ferait un UPDATE par affichage de page, pour une information
  --  qui ne change plus.
  update bulletins b set consulte_le = now()
   where b.eleve_id = p_eleve and b.statut = 'publie' and b.consulte_le is null;

  return query
    select b.id, p.libelle, p.ordre, b.moyenne_generale, b.rang, b.effectif, b.mention,
           ec.nom, ec.sigle, c.libelle, e.prenom, e.nom, e.matricule, an.libelle,
           ec.logo_url,
           public.bulletin_affiche_absences(b.classe_id),
           ab.absences, ab.justifiees
    from bulletins b
    join periodes p on p.id = b.periode_id
    join eleves e on e.id = b.eleve_id
    left join classes c on c.id = b.classe_id
    left join ecoles ec on ec.id = b.ecole_id
    left join annees_scolaires an on an.id = p.annee_id
    -- LATERAL : la fonction rend 0 ligne quand la période n'est pas datée, et
    -- le LEFT JOIN laisse alors les compteurs à NULL. C'est exactement la
    -- distinction voulue entre « aucune absence » et « on ne sait pas ».
    left join lateral public.absences_periode(b.eleve_id, b.periode_id) ab on true
    where b.eleve_id = p_eleve
      --  🔴 LE CŒUR DU POINT 6 : un bulletin en relecture ne quitte pas
      --  l'école. Les bulletins existants ont été repris en « publie » au
      --  §1, donc aucun parent ne perd l'accès à ce qu'il voyait hier.
      and b.statut = 'publie'
    order by p.ordre;
end $fn$;
revoke execute on function public.enfant_bulletins(uuid) from public, anon;
grant execute on function public.enfant_bulletins(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • AVANT TOUT : `select statut, count(*) from bulletins group by 1`
--     → tout l'existant en « publie », aucun bulletin disparu pour les
--     parents ;
--   • un bulletin régénéré après publication reste « publie » (l'upsert de
--     l'application n'envoie pas `statut`) ;
--   • un nouveau bulletin naît « brouillon » et n'apparaît PAS dans
--     l'espace parent ; après `avancer_bulletins(..., 'publie')`, il
--     apparaît ;
--   • la première ouverture par le parent date `consulte_le` ; la seconde
--     ne le modifie plus ;
--   • désigner un responsable de cycle : promoteur seul. La direction ne
--     peut pas se désigner elle-même ;
--   • signature « pedagogique » : acceptée pour le responsable DU CYCLE de
--     la classe, refusée pour le responsable d'un AUTRE cycle ;
--   • signature « gestion » : refusée à `direction` (qui satisfait pourtant
--     `est_gestion()`), acceptée au promoteur / comptable / secrétaire ;
--   • une même personne ne peut pas poser les deux signatures ;
--   • un parent n'accède ni au PV ni aux signatures ;
--   • `avancer_bulletins` sur une classe sans bulletin → refus explicite,
--     et non un succès à zéro ligne ;
--   • 🔴 un ENSEIGNANT de la classe qui tente un PATCH direct
--     `statut = 'publie'` sur l'API → REFUSÉ par le déclencheur, alors que
--     la policy de la 058 l'autorise par ailleurs à écrire dans la table ;
--   • ce même enseignant peut toujours écrire notes et appréciations : le
--     verrou ne porte que sur `statut`.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.etat_bulletins(uuid, uuid);
-- drop function if exists public.avancer_bulletins(uuid, uuid, text);
-- drop function if exists public.conseil_complet(uuid);
-- drop function if exists public.signer_conseil(uuid, text);
-- drop function if exists public.est_responsable_cycle(uuid);
-- drop function if exists public.cycle_de_classe(uuid);
-- drop trigger if exists trg_statut_bulletin_upd on bulletins;
-- drop trigger if exists trg_statut_bulletin_ins on bulletins;
-- drop function if exists public._verifier_statut_bulletin();
-- drop table if exists conseil_signatures;
-- drop table if exists conseils_classe;
-- drop table if exists responsables_cycle;
-- alter table bulletins drop constraint if exists bulletins_statut_chk;
-- alter table bulletins drop column if exists consulte_le;
-- alter table bulletins drop column if exists publie_par;
-- alter table bulletins drop column if exists publie_le;
-- alter table bulletins drop column if exists valide_par;
-- alter table bulletins drop column if exists valide_le;
-- alter table bulletins drop column if exists statut;
-- (puis rejouer la 163 pour restaurer `enfant_bulletins` sans le filtre)
