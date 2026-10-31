-- =====================================================================
--  Démo sans compte — rendre TutTank_Demo SÛRE avant de l'ouvrir au public
--
--  Le diagnostic (diagnostic_ecoles_demo.sql) a trouvé dans TutTank_Demo
--  1 élève et 2 tuteurs homonymes d'une personne d'une école RÉELLE, et des
--  numéros au format réel (78 xxx xx xx). La démo étant publique :
--    1. les homonymes reçoivent un autre prénom ;
--    2. TOUS les numéros de l'école de démo deviennent 70 000 00 01, 02…
--  Puis le contrôle est refait : il doit rendre 0 partout.
--
--  À coller en entier dans l'éditeur SQL Supabase. Rejouable.
--  Ne touche QUE l'école de démonstration nommée ci-dessous.
-- =====================================================================
do $$
declare
  v_ecole uuid;
  v_prenoms text[] := array['Awa','Moussa','Coumba','Ibou','Penda','Lamine','Seynabou','Ousmane',
                            'Maimouna','Cheikh','Rokhaya','Malick','Ndeye Fatou','Pape','Sokhna','Bassirou'];
  r record;
  i int := 0;
  t record;
  n int;
begin
  select id into v_ecole from ecoles where nom = 'TutTank_Demo' and demonstration;
  if v_ecole is null then raise exception 'TutTank_Demo introuvable ou non marquée démonstration.'; end if;

  -- 1. Homonymes : on change le prénom jusqu'à ne plus coïncider avec
  --    personne d'une école réelle.
  for r in
    select x.id from eleves x
     where x.ecole_id = v_ecole
       and exists (select 1 from eleves y join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
                    where lower(y.nom) = lower(x.nom) and lower(y.prenom) = lower(x.prenom))
  loop
    loop
      i := i + 1;
      exit when not exists (
        select 1 from eleves y join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
          join eleves x on x.id = r.id
         where lower(y.nom) = lower(x.nom) and lower(y.prenom) = lower(v_prenoms[1 + i % 16]));
    end loop;
    update eleves set prenom = v_prenoms[1 + i % 16] where id = r.id;
  end loop;

  for r in
    select x.id from tuteurs x
     where x.ecole_id = v_ecole
       and exists (select 1 from tuteurs y join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
                    where lower(y.nom) = lower(x.nom) and lower(y.prenom) = lower(x.prenom))
  loop
    loop
      i := i + 1;
      exit when not exists (
        select 1 from tuteurs y join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
          join tuteurs x on x.id = r.id
         where lower(y.nom) = lower(x.nom) and lower(y.prenom) = lower(v_prenoms[1 + i % 16]));
    end loop;
    update tuteurs set prenom = v_prenoms[1 + i % 16] where id = r.id;
  end loop;

  -- 2. Téléphones : toute table de l'école qui a une colonne `telephone`
  --    (tuteurs, élèves, personnel, enseignants…). Numéros 70 000 00 xx,
  --    manifestement fictifs.
  for t in
    select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'telephone'
       and exists (select 1 from information_schema.columns k
                    where k.table_schema = 'public' and k.table_name = c.table_name
                      and k.column_name = 'ecole_id')
       and exists (select 1 from information_schema.tables tb
                    where tb.table_schema = 'public' and tb.table_name = c.table_name
                      and tb.table_type = 'BASE TABLE')
  loop
    execute format(
      'update public.%I x set telephone = ''70 000 '' || lpad(((s.rn - 1) / 100)::text, 2, ''0'') || '' '' || lpad(((s.rn - 1) %% 100 + 1)::text, 2, ''0'')
         from (select id, row_number() over (order by id) as rn from public.%I
                where ecole_id = $1 and telephone is not null and btrim(telephone) <> '''') s
        where x.id = s.id', t.table_name, t.table_name)
    using v_ecole;
    get diagnostics n = row_count;
    if n > 0 then raise notice '% : % numéro(s) remplacé(s).', t.table_name, n; end if;
  end loop;
end $$;

-- 3. Contrôle (0 attendu dans les trois colonnes)
select d.nom as ecole_demo,
  (select count(*) from eleves x join eleves y
      on lower(x.nom) = lower(y.nom) and lower(x.prenom) = lower(y.prenom)
     join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
   where x.ecole_id = d.id) as eleves_homonymes,
  (select count(*) from tuteurs x join tuteurs y
      on lower(x.nom) = lower(y.nom) and lower(x.prenom) = lower(y.prenom)
     join ecoles ey on ey.id = y.ecole_id and not ey.demonstration
   where x.ecole_id = d.id) as tuteurs_homonymes,
  (select count(*) from tuteurs x
   where x.ecole_id = d.id and x.telephone is not null and x.telephone not like '70 000 %') as numeros_reels
from ecoles d
where d.nom = 'TutTank_Demo';
