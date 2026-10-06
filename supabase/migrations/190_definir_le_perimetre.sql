-- =====================================================================
--  190 — Le promoteur pose le périmètre lui-même
--
--  Les migrations 188 et 189 ont posé le mécanisme et l'ont éprouvé. Il
--  manquait le guichet : jusqu'ici, cloisonner quelqu'un demandait d'écrire
--  dans `personnel_perimetre` à la main.
--
--  ⚠️ POURQUOI JE N'AI PAS ASSIGNÉ LES CYCLES MOI-MÊME. Tut'Tank a deux
--  responsables (`primaire.tuttank`, `bureau.tuttank`) et deux cycles
--  (Préscolaire 45 inscrits, Élémentaire 51). Rien dans la base ne dit
--  laquelle tient lequel : `responsables_cycle` est vide, et les intitulés de
--  compte ne sont pas une preuve. Me tromper aurait fait perdre à une
--  responsable ses propres élèves et lui aurait montré ceux de l'autre — un
--  défaut visible, et une erreur que la personne la mieux placée pour
--  trancher ne peut pas corriger sans moi. D'où ce guichet.
-- =====================================================================

-- --- 1. Poser le périmètre -------------------------------------------
create or replace function public.definir_perimetre(
  p_profil uuid, p_mode text, p_cycles uuid[] default '{}'::uuid[])
returns text language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid := ecole_courante(); v_n int;
begin
  --  Fail-closed, dans l'ordre : session, établissement, rôle, cible.
  if auth.uid() is null or v_ecole is null then
    raise exception 'Session introuvable.';
  end if;
  --  ⚠️ LE PROMOTEUR SEUL. Si une responsable pouvait définir son propre
  --  périmètre, le cloisonnement ne voudrait rien dire — elle l'élargirait.
  --  Même raison que pour `accorder_modele` (mig. 176).
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

  --  ⚠️ UN PÉRIMÈTRE `cycles` SANS CYCLE NE MONTRERAIT RIEN. `cycles_autorises()`
  --  rend alors un tableau vide — fail-closed — et la personne ne verrait
  --  aucun élève. C'est une erreur de saisie, pas une permission : on la
  --  refuse ici plutôt que de la laisser produire un écran vide inexplicable.
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

  insert into personnel_perimetre (ecole_id, profil_id, mode)
  values (v_ecole, p_profil, p_mode)
  on conflict (profil_id, ecole_id) do update set mode = excluded.mode;

  --  Remplacement complet : on ne cumule pas les cycles d'un réglage
  --  précédent, sinon « Préscolaire » après « Élémentaire » donnerait les deux.
  delete from personnel_cycles where profil_id = p_profil and ecole_id = v_ecole;
  if p_mode = 'cycles' then
    insert into personnel_cycles (ecole_id, profil_id, cycle_id)
    select v_ecole, p_profil, unnest(p_cycles)
    on conflict do nothing;
  end if;

  return p_mode;
end $fn$;

revoke execute on function public.definir_perimetre(uuid, text, uuid[]) from public, anon;
grant execute on function public.definir_perimetre(uuid, text, uuid[]) to authenticated;

-- --- 2. Lire les périmètres de l'établissement ------------------------
--
--  L'écran Membres a besoin d'afficher le périmètre de chacun. Lecture
--  réservée à qui gère les membres, comme `membres_ecole`.
create or replace function public.perimetres_ecole()
returns table(profil_id uuid, mode text, cycles uuid[], libelles text)
language sql stable security definer set search_path = public as $fn$
  select pp.profil_id, pp.mode,
         coalesce((select array_agg(pc.cycle_id order by pc.cycle_id)
                     from personnel_cycles pc
                    where pc.profil_id = pp.profil_id and pc.ecole_id = pp.ecole_id), '{}'::uuid[]),
         coalesce((select string_agg(c.libelle, ', ' order by c.libelle)
                     from personnel_cycles pc
                     join cycles c on c.id = pc.cycle_id
                    where pc.profil_id = pp.profil_id and pc.ecole_id = pp.ecole_id), '')
    from personnel_perimetre pp
   where pp.ecole_id = public.ecole_courante()
     and (public.est_super_admin() or public.a_acces('membres'));
$fn$;

revoke execute on function public.perimetres_ecole() from public, anon;
grant execute on function public.perimetres_ecole() to authenticated;

-- --- 3. Son propre périmètre, pour que l'écran le dise ----------------
--
--  ⚠️ POURQUOI L'ÉCRAN DOIT LE SAVOIR. Une personne cloisonnée qui voit
--  « 45 élèves » sans explication croira à une perte de données. L'interface
--  doit pouvoir écrire « Vous voyez le Préscolaire » — c'est la différence
--  entre un cloisonnement et un bogue.
create or replace function public.mon_perimetre()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'cloisonne', public.cycles_autorises() is not null,
    'cycles', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'libelle', c.libelle) order by c.libelle)
        from cycles c
       where c.id = any(coalesce(public.cycles_autorises(), '{}'::uuid[]))
    ), '[]'::jsonb),
    'classes', coalesce(array_length(public.classes_autorisees(), 1), 0)
  );
$fn$;

revoke execute on function public.mon_perimetre() from public, anon;
grant execute on function public.mon_perimetre() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop function if exists public.definir_perimetre(uuid, text, uuid[]);
-- drop function if exists public.perimetres_ecole();
-- drop function if exists public.mon_perimetre();
