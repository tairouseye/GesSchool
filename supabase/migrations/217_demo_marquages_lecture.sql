-- =====================================================================
--  217 — Démo sans compte : laisser passer les marquages de LECTURE
--
--  Suite de la 216. En remplissant la démo parent (31/10/2026), deux
--  lectures se sont révélées être aussi des ÉCRITURES :
--    - enfant_bulletins       → bulletins.consulte_le = now()  (mig. 166)
--    - conversation_messages  → messages.lu = true             (mig. 158)
--  Dès qu'un bulletin publié ou un message de l'école existe, le verrou de
--  la 216 faisait échouer l'OUVERTURE de la rubrique : le visiteur voyait
--  une erreur au lieu du bulletin.
--
--  La 216 avait réglé le cas des notifications en n'y posant aucun verrou
--  sur UPDATE. C'est trop large : on pouvait y réécrire le titre. On passe
--  à une règle unique et plus juste : en démo, une mise à jour passe SI ET
--  SEULEMENT SI elle ne change que des colonnes de lecture.
--
--    notifications.lu · messages.lu · bulletins.consulte_le
--
--  (+ updated_at, qu'un trigger voisin peut toucher au passage.)
-- =====================================================================

create or replace function public.demo_lecture_seule()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_lecture text[];
begin
  if not public.est_compte_demo() then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    v_lecture := case tg_table_name
      when 'notifications' then array['lu']
      when 'messages'      then array['lu']
      when 'bulletins'     then array['consulte_le']
      else array[]::text[]
    end;
    if cardinality(v_lecture) > 0
       and (to_jsonb(new) - v_lecture - 'updated_at') = (to_jsonb(old) - v_lecture - 'updated_at') then
      return new;
    end if;
  end if;

  raise exception using
    errcode = 'GSDEM',
    message = 'Mode démonstration : rien n''est enregistré. Créez votre école pour essayer pour de vrai.';
end $$;

-- Toutes les tables, notifications comprises, sous le même verrou complet.
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
        'create or replace trigger trg_demo_lecture_seule before insert or update or delete on public.%I
           for each row execute function public.demo_lecture_seule()',
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

notify pgrst, 'reload schema';
