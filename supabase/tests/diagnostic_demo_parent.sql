-- =====================================================================
--  Diagnostic — que voit le PARENT DÉMO dans chaque rubrique ?
--  Lecture seule. À coller EN ENTIER dans l'éditeur SQL Supabase.
--
--  On se met dans la peau de demo.parent@gesprosn.org (jeton simulé), puis
--  on appelle les MÊMES fonctions que l'écran, pour chacun de ses enfants.
--  Une case à 0 = une rubrique vide à remplir.
-- =====================================================================
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'demo.parent@gesprosn.org'),
                    'role', 'authenticated',
                    'app_metadata', json_build_object('demo', 'parent'))::text, false);

select m.prenom, m.nom, m.classe,
  c.libelle as niveau_cycle,
  (select count(*) from enfant_notes(m.eleve_id))          as notes,
  (select count(*) from enfant_bulletins(m.eleve_id))      as bulletins,
  (select count(*) from enfant_absences(m.eleve_id))       as absences,
  (select count(*) from enfant_emploi(m.eleve_id))         as emploi_du_temps,
  (select count(*) from enfant_cahier(m.eleve_id))         as cahier_textes,
  (select count(*) from enfant_fournitures(m.eleve_id))    as fournitures,
  (select count(*) from annonces_enfant(m.eleve_id))       as annonces,
  (select count(*) from enfant_factures(m.eleve_id))       as factures,
  (select count(*) from enfant_cantine(m.eleve_id))        as cantine,
  (select count(*) from enfant_transport(m.eleve_id))      as transport,
  (select count(*) from enfant_acquis(m.eleve_id, null))   as acquis,
  enfant_programme(m.eleve_id, null) is not null           as programme,
  (select count(*) from mes_demandes())                    as demandes_documents,
  (select count(*) from mes_conversations())               as conversations,
  (select count(*) from notifications n
    where n.destinataire_id = auth.uid())                  as alertes
from mes_enfants() m
left join inscriptions ins on ins.eleve_id = m.eleve_id
left join annees_scolaires an on an.id = ins.annee_id and an.courante
left join classes cl on cl.id = ins.classe_id and an.id is not null
left join niveaux nv on nv.id = cl.niveau_id
left join cycles c on c.id = nv.cycle_id
where an.id is not null or ins.id is null;
