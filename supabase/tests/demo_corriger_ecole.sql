-- =====================================================================
--  Démo KEUR CHEIKH ANTA — remettre les données d'aplomb (piste 2 du test
--  côté école, 09/11/2026). DONNÉES SEULEMENT, école de démonstration
--  seulement (id c9b85c0e…). Rien d'autre n'est touché.
--
--  1. Les factures « Scolarité (3 mois) » n'étaient reliées à aucun frais :
--     l'échéancier n'y voyait aucun mois payé, et les 50 élèves étaient « en
--     retard ». On les relie au frais mensuel de l'élève (son tarif) : avec la
--     mig. 232, ce qui est payé couvre octobre, novembre, décembre.
--  2. Les trimestres étaient datés 2025-2026 pour l'année 2026-2027 (d'où
--     « 3ème Trimestre » en novembre) : décalés d'un an.
--  3. L'annonce de test « NE DOIT PAS apparaitre chez un parent » devient un
--     vrai conseil des maîtres.
--  4. Les 12 enseignants partageaient leurs numéros avec des parents : chacun
--     reçoit le sien (77 000 01 xx).
--  5. Le sigle et les matricules « TT » (hérités de Tut'Tank) deviennent
--     « KCA » ; l'adresse contact@lesbaobabs.sn une adresse de démo.
--  6. Le compte démo direction devient propriétaire de l'école démo : le
--     bouton Pilotage ouvre enfin le pilotage (toujours en lecture seule,
--     le verrou des mig. 216-217 reste).
--
--  Rejouable sans dommage. Le contrôle est en bas.
-- =====================================================================
begin;

-- 1. Scolarité (3 mois) → le frais mensuel de l'élève
update facture_lignes fl
   set frais_id = t.frais_id
  from factures f
  cross join lateral public._tarif_scolarite(f.eleve_id, f.annee_id) t
 where fl.facture_id = f.id
   and f.ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795'
   and fl.libelle = 'Scolarité (3 mois)'
   and fl.frais_id is null
   and t.frais_id is not null;

-- 2. Les trimestres dans l'année 2026-2027
update periodes
   set date_debut = (date_debut + interval '1 year')::date,
       date_fin   = (date_fin   + interval '1 year')::date
 where ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795'
   and date_debut < '2026-09-01';

-- 3. L'annonce de test
update annonces
   set titre = 'Conseil des maîtres',
       contenu = 'Conseil des maîtres le jeudi 19 novembre à 16 h 30, en salle des professeurs. Ordre du jour : évaluations du 1er trimestre.'
 where ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795'
   and contenu ilike '%NE DOIT PAS%';

-- 4. Un numéro par enseignant
update enseignants e
   set telephone = '77 000 01 ' || lpad(n::text, 2, '0')
  from (select id, row_number() over (order by nom, prenom) as n
          from enseignants where ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795') x
 where e.id = x.id and e.telephone like '70 000 00 %';

-- 5. Sigle, matricules, adresse
update ecoles
   set sigle = 'KCA', matricule_prefixe = 'KCA', email = 'contact@demo-keurcheikhanta.sn',
       statut_juridique = 'École privée'
 where id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795';
update eleves
   set matricule = 'KCA-' || substr(matricule, 4)
 where ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795' and matricule like 'TT-%';

-- 6. Le compte démo direction, propriétaire de l'école démo
insert into proprietaires (profil_id, ecole_id)
select p.id, 'c9b85c0e-f19d-41de-8d94-3b4386cb6795'
  from profils p
 where p.email = 'demo.direction@gesprosn.org'
   and not exists (select 1 from proprietaires x
                    where x.profil_id = p.id and x.ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795');

commit;

-- Contrôle : statuts de paiement, trimestres, matricules
select public._statut_paiement(i.eleve_id, i.annee_id) as statut, count(*) as eleves, sum(r.du) as du
  from inscriptions i
  join annees_scolaires a on a.id = i.annee_id and a.courante
  cross join lateral public._retards(i.eleve_id, i.annee_id) r
 where a.ecole_id = 'c9b85c0e-f19d-41de-8d94-3b4386cb6795'
 group by 1 order by 1;
