-- =====================================================================
--  Essai 215 — encarts partenaires de la connexion
--  À lancer dans le SQL Editor APRÈS la migration 215. Tout se fait dans
--  une transaction annulée : rien ne reste en base.
-- =====================================================================
begin;

-- Trois encarts : en cours, désactivé, à venir.
insert into public.encarts_partenaires (partenaire, message, lien, debut, fin, actif)
values ('Essai en cours', 'Message visible', 'https://exemple.sn', current_date - 1, current_date + 30, true),
       ('Essai désactivé', 'Ne doit pas apparaître', null, current_date - 1, null, false),
       ('Essai à venir', 'Pas encore', null, current_date + 5, null, true);

-- 1) Le public (anon) ne voit QUE l'encart en cours, et pas la table.
set local role anon;
select 'encarts_connexion (anon)' as essai,
       (select count(*) from public.encarts_connexion() where partenaire like 'Essai%') as nb_vus,
       1 as attendu;
do $$
begin
  perform 1 from public.encarts_partenaires limit 1;
  raise exception 'ÉCHEC : anon lit la table';
exception when insufficient_privilege then
  raise notice 'OK : anon ne lit pas la table';
end $$;
reset role;

-- 2) Un lien non https est refusé.
do $$
begin
  insert into public.encarts_partenaires (partenaire, message, lien) values ('X', 'Y', 'javascript:alert(1)');
  raise exception 'ÉCHEC : lien javascript: accepté';
exception when check_violation then
  raise notice 'OK : lien non https refusé';
end $$;

rollback;
