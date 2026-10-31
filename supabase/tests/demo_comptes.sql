-- =====================================================================
--  Démo sans compte (mig. 216) — rattacher les deux comptes à l'école
--
--  À coller dans l'éditeur SQL Supabase, APRÈS :
--    1. la migration 216 ;
--    2. le déploiement de la fonction `demo` (nommée « dynamic-endpoint ») ;
--    3. UN essai de chaque bouton « Découvrir » sur l'écran de connexion
--       (c'est lui qui crée les comptes demo.parent@ et demo.direction@).
--
--  Rejouable. Change d'école : modifier v_ecole_nom et relancer.
--  ⚠️ L'école choisie doit être marquée « démonstration » et ne contenir
--  QUE des personnes fictives (voir diagnostic_ecoles_demo.sql).
-- =====================================================================
do $$
declare
  v_ecole_nom text := 'TutTank_Demo';            -- ← l'école à montrer
  v_ecole     uuid;
  v_parent    uuid;
  v_direction uuid;
  v_tuteur    uuid;
begin
  select id into v_ecole from ecoles where nom = v_ecole_nom and demonstration;
  if v_ecole is null then
    raise exception 'École « % » introuvable ou non marquée démonstration.', v_ecole_nom;
  end if;

  select id into v_parent    from auth.users where email = 'demo.parent@gesprosn.org';
  select id into v_direction from auth.users where email = 'demo.direction@gesprosn.org';
  if v_parent is null or v_direction is null then
    raise exception 'Comptes de démo absents : touchez une fois chaque bouton « Découvrir » sur l''écran de connexion.';
  end if;

  -- --- Direction : profil DANS l'école, tous les menus visibles ----------
  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_direction, v_ecole, 'Direction', 'Démo', 'demo.direction@gesprosn.org')
  on conflict (id) do update set ecole_id = excluded.ecole_id, prenom = excluded.prenom,
                                 nom = excluded.nom, actif = true;
  delete from profil_roles where profil_id = v_direction and ecole_id is distinct from v_ecole;
  insert into profil_roles (profil_id, ecole_id, role) values
    (v_direction, v_ecole, 'admin_ecole'),
    (v_direction, v_ecole, 'direction')
  on conflict (profil_id, ecole_id, role) do nothing;

  -- --- Parent : profil SANS école (comme lier_parent, mig. 004) ----------
  insert into profils (id, ecole_id, prenom, nom, email)
  values (v_parent, null, 'Parent', 'Démo', 'demo.parent@gesprosn.org')
  on conflict (id) do update set ecole_id = null, prenom = excluded.prenom,
                                 nom = excluded.nom, actif = true;
  delete from profil_roles where profil_id = v_parent and ecole_id is distinct from v_ecole;
  insert into profil_roles (profil_id, ecole_id, role) values (v_parent, v_ecole, 'parent')
  on conflict (profil_id, ecole_id, role) do nothing;

  -- Un tuteur À LUI, fictif : on ne prête pas l'identité d'un tuteur de
  -- l'école. Ancien rattachement ailleurs : détaché.
  update tuteurs set profil_id = null where profil_id = v_parent and ecole_id <> v_ecole;
  select id into v_tuteur from tuteurs where profil_id = v_parent and ecole_id = v_ecole;
  if v_tuteur is null then
    insert into tuteurs (ecole_id, profil_id, prenom, nom, telephone)
    values (v_ecole, v_parent, 'Parent', 'Démo', null)
    returning id into v_tuteur;
  end if;

  -- Deux enfants : ceux qui ont le plus à montrer (notes + factures),
  -- dans deux classes différentes si possible.
  delete from eleve_tuteurs where tuteur_id = v_tuteur;
  insert into eleve_tuteurs (ecole_id, eleve_id, tuteur_id, lien_parente, responsable_legal, responsable_paiement)
  select v_ecole, x.id, v_tuteur, 'parent', true, true
    from (
      select distinct on (ins.classe_id) el.id, ins.classe_id,
             (select count(*) from notes n where n.eleve_id = el.id)
           + (select count(*) from factures f where f.eleve_id = el.id) as richesse
        from eleves el
        join inscriptions ins on ins.eleve_id = el.id
        join annees_scolaires an on an.id = ins.annee_id and an.courante
       where el.ecole_id = v_ecole
       order by ins.classe_id, richesse desc
    ) x
   order by x.richesse desc
   limit 2;

  raise notice 'Démo prête : école %, parent avec % enfant(s).',
    v_ecole_nom, (select count(*) from eleve_tuteurs where tuteur_id = v_tuteur);
end $$;

-- Vérification
select u.email, u.raw_app_meta_data ->> 'demo' as marqueur, p.prenom, p.nom,
       e.nom as ecole_du_profil, array_agg(r.role order by r.role) as roles
  from auth.users u
  left join profils p on p.id = u.id
  left join ecoles e on e.id = p.ecole_id
  left join profil_roles r on r.profil_id = u.id
 where u.email like 'demo.%@gesprosn.org'
 group by u.email, marqueur, p.prenom, p.nom, e.nom;
