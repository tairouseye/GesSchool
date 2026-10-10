-- =====================================================================
--  197 — Tracer qui pose un périmètre
--
--  🔴 POURQUOI CETTE MIGRATION EXISTE. Le 10/10, en vérifiant la migration
--  194, j'ai trouvé deux lignes dans `personnel_cycles` qui cloisonnaient les
--  deux responsables de Tut'Tank. **Je n'ai pas pu déterminer qui les avait
--  posées** : ni le promoteur essayant le sélecteur livré le même soir, ni un
--  appel de ma recette non joué en transaction annulée — les deux hypothèses
--  restent ouvertes. Les horodatages ne tranchent pas, et la table ne porte
--  aucune trace d'auteur.
--
--  J'ai d'abord supposé, puis affirmé, que ces lignes étaient antérieures à la
--  session : c'était faux, elles datent du 06/10 à 23h21, soit 1h28 après la
--  migration 193. Supposer au lieu de mesurer est exactement ce qui a causé
--  l'incident du journal d'audit (migration 192).
--
--  ⚠️ LE PÉRIMÈTRE DÉCIDE QUI VOIT QUELS ENFANTS. Une ligne posée par erreur
--  retire à une responsable la moitié de son école ; une ligne retirée par
--  erreur lui donne l'autre moitié. Une donnée de cette portée doit dire d'où
--  elle vient — sinon la prochaine question « est-ce vous ou moi ? » sera
--  aussi sans réponse que celle-ci.
--
--  ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS : elle ne remplit pas les lignes
--  existantes. Les deux lignes de Tut'Tank gardent `pose_par = null`, et c'est
--  honnête — je ne sais pas qui les a posées, et inventer une valeur serait
--  pire que l'absence. `null` se lit « avant la traçabilité ».
--
--  ⚠️ ET CE QUE J'AI FAILLI CASSER EN L'ÉCRIVANT, parce que j'ai d'abord
--  rédigé les deux fonctions de mémoire avant de lire celles en vigueur.
--  Quatre divergences, toutes vérifiées puis corrigées :
--    1. `definir_perimetre` rend `text` (elle retourne `p_mode`), pas `void` :
--       `create or replace` REFUSE de changer un type de retour, la migration
--       aurait échoué ;
--    2. elle teste l'appartenance sur `profils … and p.actif`, pas sur
--       `profil_roles` : ma version aurait laissé passer un membre SUSPENDU ;
--    3. `perimetres_ecole` est gardée par `est_super_admin() or
--       a_acces('membres')`, pas par `est_admin()` : ma version l'aurait
--       RESSERRÉE et aurait vidé le sélecteur pour la direction ;
--    4. elle rend une `table(... , libelles text)` : ajouter des colonnes à un
--       `returns table` est aussi un changement de type de retour, d'où le
--       `drop` explicite ci-dessous.
-- =====================================================================

alter table public.personnel_cycles
  add column if not exists pose_par uuid references public.profils(id) on delete set null;
alter table public.personnel_perimetre
  add column if not exists pose_par uuid references public.profils(id) on delete set null;

comment on column public.personnel_cycles.pose_par is
  'Qui a posé ce cloisonnement (via definir_perimetre). NULL = ligne antérieure à la migration 197, auteur inconnu.';
comment on column public.personnel_perimetre.pose_par is
  'Qui a posé ce mode de périmètre (via definir_perimetre). NULL = ligne antérieure à la migration 197, auteur inconnu.';

-- --- `definir_perimetre` renseigne la colonne -------------------------
--
--  Réécrite À PARTIR DE SA DÉFINITION EN VIGUEUR, lue avant d'écrire. Le seul
--  changement est `pose_par` : les messages d'erreur, le type de retour et les
--  quatre garanties sont conservés mot pour mot. Chacune a une raison :
--    • `est_admin()` seul peut appeler — un périmètre n'est pas une préférence ;
--    • le membre doit être ACTIF (`p.actif`) ;
--    • mode 'cycles' SANS aucun cycle est REFUSÉ — sinon `cycles_autorises()`
--      rendrait un tableau vide, c'est-à-dire « aucune classe », et la
--      responsable perdrait toute son école en silence ;
--    • l'écriture REMPLACE au lieu d'accumuler, sinon retirer un cycle serait
--      impossible.
create or replace function public.definir_perimetre(
  p_profil uuid, p_mode text, p_cycles uuid[] default '{}'::uuid[])
returns text
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid := ecole_courante(); v_n int;
begin
  if auth.uid() is null or v_ecole is null then
    raise exception 'Session introuvable.';
  end if;
  if not est_admin() then
    raise exception 'Seul le promoteur définit un périmètre.';
  end if;
  if p_mode not in ('ecole', 'cycles', 'classes') then
    raise exception 'Périmètre inconnu : %', p_mode;
  end if;
  if not exists (select 1 from profils p
                  where p.id = p_profil and p.ecole_id = v_ecole and p.actif) then
    raise exception 'Cette personne n''est pas un membre actif de votre établissement.';
  end if;
  if p_mode = 'cycles' then
    if coalesce(array_length(p_cycles, 1), 0) = 0 then
      raise exception 'Choisissez au moins un cycle.';
    end if;
    select count(*) into v_n from cycles c
     where c.id = any(p_cycles) and c.ecole_id = v_ecole;
    if v_n <> array_length(p_cycles, 1) then
      raise exception 'Un des cycles choisis n''appartient pas à votre établissement.';
    end if;
  end if;

  insert into personnel_perimetre (ecole_id, profil_id, mode, pose_par)
  values (v_ecole, p_profil, p_mode, auth.uid())
  on conflict (profil_id, ecole_id)
  do update set mode = excluded.mode, pose_par = excluded.pose_par;

  delete from personnel_cycles where profil_id = p_profil and ecole_id = v_ecole;
  if p_mode = 'cycles' then
    insert into personnel_cycles (ecole_id, profil_id, cycle_id, pose_par)
    select v_ecole, p_profil, unnest(p_cycles), auth.uid()
    on conflict do nothing;
  end if;

  return p_mode;
end $fn$;

revoke execute on function public.definir_perimetre(uuid, text, uuid[]) from public, anon;
grant execute on function public.definir_perimetre(uuid, text, uuid[]) to authenticated;

-- --- `perimetres_ecole()` montre l'auteur -----------------------------
--
--  Pour que la réponse soit lisible depuis l'écran Membres, et pas seulement
--  en SQL : c'est là que la question se posera.
--
--  ⚠️ `drop` NÉCESSAIRE : ajouter des colonnes à un `returns table` est un
--  changement de type de retour, que `create or replace` refuse. Le `drop` et
--  le `create` sont dans la même transaction, donc la fonction n'est jamais
--  absente pour l'application.
drop function if exists public.perimetres_ecole();
create function public.perimetres_ecole()
returns table(profil_id uuid, mode text, cycles uuid[], libelles text,
              pose_par uuid, pose_par_email text)
language sql stable security definer set search_path = public as $fn$
  select pp.profil_id, pp.mode,
         coalesce((select array_agg(pc.cycle_id order by pc.cycle_id)
                     from personnel_cycles pc
                    where pc.profil_id = pp.profil_id and pc.ecole_id = pp.ecole_id), '{}'::uuid[]),
         coalesce((select string_agg(c.libelle, ', ' order by c.libelle)
                     from personnel_cycles pc
                     join cycles c on c.id = pc.cycle_id
                    where pc.profil_id = pp.profil_id and pc.ecole_id = pp.ecole_id), ''),
         pp.pose_par,
         --  L'e-mail plutôt que l'identifiant : c'est ce qui permet de
         --  répondre « est-ce vous ou moi ? » sans repasser par le SQL.
         (select p.email from profils p where p.id = pp.pose_par)
    from personnel_perimetre pp
   where pp.ecole_id = public.ecole_courante()
     --  Garde CONSERVÉE À L'IDENTIQUE : `a_acces('membres')`, pas
     --  `est_admin()` — sinon le sélecteur se viderait pour la direction.
     and (public.est_super_admin() or public.a_acces('membres'));
$fn$;

revoke execute on function public.perimetres_ecole() from public, anon;
grant execute on function public.perimetres_ecole() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop function if exists public.perimetres_ecole();
-- -- puis recréer `perimetres_ecole` et `definir_perimetre` tels qu'ils sont
-- -- dans la migration 190 (sans `pose_par`), et seulement ensuite :
-- alter table public.personnel_cycles    drop column if exists pose_par;
-- alter table public.personnel_perimetre drop column if exists pose_par;
-- notify pgrst, 'reload schema';
