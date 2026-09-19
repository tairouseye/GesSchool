-- =====================================================================
--  VÉRIFICATION RLS — module Bibliothèque (après migrations 126, 127, 128)
--
--  Ce script ENDOSSE de vraies identités et tente les gestes que l'audit
--  avait trouvés possibles. Chaque ligne affiche OK (bloqué, donc corrigé)
--  ou ÉCHEC (encore passant).
--
--  Il ne modifie RIEN : tout se déroule dans une transaction annulée à la
--  fin. On peut le relancer autant de fois qu'on veut.
--
--  Il s'adapte à ce qui existe : s'il manque un lecteur (étudiant,
--  enseignant, personnel), il saute les tests concernés en le disant, et
--  vérifie quand même ce qu'il peut.
-- =====================================================================

begin;

do $$
declare
  v_ecole    uuid;
  v_lecteur  uuid;   -- membre SANS droits de gestion (étudiant de préférence)
  v_parent   uuid;
  v_eleve    uuid;
  v_depot    uuid;
  v_sugg     uuid;
  v_resa     uuid;
  v_res      uuid;
  v_autre    uuid;   -- une ressource d'un AUTRE établissement
  n          int;
  rang_obtenu int;
begin
  -- --- Qui avons-nous sous la main ? (encore en superutilisateur) ------
  select pr.ecole_id, pr.profil_id into v_ecole, v_lecteur
    from profil_roles pr
    join ecoles  ec on ec.id = pr.ecole_id
    join profils p  on p.id  = pr.profil_id
   where ec.type_etablissement = 'superieur'
     and p.actif
     and pr.role::text <> 'parent'
     -- Aucun rôle de gestion ici, sinon le test ne prouverait rien :
     -- la gestion a légitimement tous les droits.
     and not exists (
       select 1 from profil_roles g
        where g.profil_id = pr.profil_id and g.ecole_id = pr.ecole_id
          and g.role::text in ('admin_ecole', 'direction', 'bibliothecaire'))
   order by case pr.role::text when 'etudiant' then 0 else 1 end
   limit 1;

  if v_ecole is null then
    select id into v_ecole from ecoles where type_etablissement = 'superieur' limit 1;
  end if;
  if v_ecole is null then
    raise exception 'Aucun établissement en mode « supérieur ».';
  end if;

  select pr.profil_id into v_parent
    from profil_roles pr join profils p on p.id = pr.profil_id
   where pr.ecole_id = v_ecole and p.actif and pr.role::text = 'parent'
     and not exists (select 1 from profil_roles g
                      where g.profil_id = pr.profil_id and g.ecole_id = pr.ecole_id
                        and g.role::text <> 'parent')
   limit 1;

  select id into v_res   from biblio_ressources where ecole_id = v_ecole limit 1;
  select id into v_autre from biblio_ressources where ecole_id <> v_ecole limit 1;

  -- =====================================================================
  --  PARTIE A — un LECTEUR (étudiant / enseignant / personnel)
  -- =====================================================================
  if v_lecteur is null then
    raise warning 'SAUTÉ A (tests 1-11) — aucun lecteur sans droits de gestion. '
      'Activez un compte étudiant (Codes étudiants) ou invitez un enseignant.';
  elsif v_res is null then
    raise warning 'SAUTÉ A (tests 1-11) — catalogue vide. Passez d''abord seed_bibliotheque_demo.sql.';
  else
    select id into v_eleve from eleves where profil_id = v_lecteur and ecole_id = v_ecole limit 1;

    -- Matériel de test appartenant au lecteur.
    insert into biblio_depots (ecole_id, type, titre, deposant_profil_id, deposant_eleve_id, statut)
    values (v_ecole, 'memoire', 'VERIF RLS — dépôt', v_lecteur, v_eleve, 'brouillon')
    returning id into v_depot;

    insert into biblio_suggestions (ecole_id, demandeur_profil_id, titre, statut)
    values (v_ecole, v_lecteur, 'VERIF RLS — suggestion', 'soumise')
    returning id into v_sugg;

    insert into biblio_reservations (ecole_id, ressource_id, profil_id, statut)
    values (v_ecole, v_res, v_lecteur, 'active')
    returning id into v_resa;

    raise notice '--- A. Identité endossée : lecteur % ---', v_lecteur;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_lecteur, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    -- Validité du test lui-même.
    if _biblio_gestion(v_ecole) then
      raise exception 'Le compte % a des droits de gestion : le test ne prouverait rien.', v_lecteur;
    end if;
    if not _biblio_lecteur(v_ecole) then
      raise exception 'Le compte % n''est pas reconnu lecteur : les refus viendraient de là.', v_lecteur;
    end if;

    -- 1. Auto-validation de son dépôt (faille GRAVE d'origine)
    begin
      update biblio_depots set statut = 'valide' where id = v_depot;
      get diagnostics n = row_count;
      if n > 0 then raise warning 'ÉCHEC 1 — dépôt passé à « valide » par son auteur';
      else raise notice 'OK 1   — dépôt vers « valide » : refusé'; end if;
    exception when insufficient_privilege or check_violation then
      raise notice 'OK 1   — dépôt vers « valide » : refusé par la policy';
    end;

    -- 2. Publication directe de son dépôt
    begin
      update biblio_depots set statut = 'publie' where id = v_depot;
      get diagnostics n = row_count;
      if n > 0 then raise warning 'ÉCHEC 2 — dépôt publié par son auteur';
      else raise notice 'OK 2   — dépôt vers « publie » : refusé'; end if;
    exception when insufficient_privilege or check_violation then
      raise notice 'OK 2   — dépôt vers « publie » : refusé par la policy';
    end;

    -- 3. Le geste LÉGITIME doit rester possible
    begin
      update biblio_depots set statut = 'soumis' where id = v_depot;
      get diagnostics n = row_count;
      if n = 1 then raise notice 'OK 3   — soumettre son dépôt : autorisé (rien n''est cassé)';
      else raise warning 'ÉCHEC 3 — le lecteur ne peut plus soumettre son propre dépôt !'; end if;
    exception when others then
      raise warning 'ÉCHEC 3 — soumission refusée : %', sqlerrm;
    end;

    -- 4. Création d'un dépôt déjà « publie »
    begin
      insert into biblio_depots (ecole_id, type, titre, deposant_profil_id, statut)
      values (v_ecole, 'memoire', 'VERIF RLS — né publié', v_lecteur, 'publie');
      raise warning 'ÉCHEC 4 — dépôt créé directement en « publie »';
    exception when insufficient_privilege or check_violation then
      raise notice 'OK 4   — création en « publie » : refusée';
    end;

    -- 5. Auto-acceptation de sa suggestion d'achat
    begin
      update biblio_suggestions set statut = 'acceptee', reponse = 'Accordé par moi-même'
       where id = v_sugg;
      get diagnostics n = row_count;
      if n > 0 then raise warning 'ÉCHEC 5 — suggestion acceptée par son auteur';
      else raise notice 'OK 5   — auto-acceptation de suggestion : refusée'; end if;
    exception when insufficient_privilege or check_violation then
      raise notice 'OK 5   — auto-acceptation de suggestion : refusée par la policy';
    end;

    -- 6. Se replacer en tête de la file d'attente
    begin
      update biblio_reservations set rang = 1, statut = 'disponible' where id = v_resa;
      get diagnostics n = row_count;
      if n > 0 then raise warning 'ÉCHEC 6 — rang modifié par l''usager';
      else raise notice 'OK 6   — modification du rang : refusée'; end if;
    exception when insufficient_privilege or check_violation then
      raise notice 'OK 6   — modification du rang : refusée par la policy';
    end;

    -- 7. L'annulation doit rester possible
    begin
      update biblio_reservations set statut = 'annulee' where id = v_resa;
      get diagnostics n = row_count;
      if n = 1 then raise notice 'OK 7   — annuler sa réservation : autorisé';
      else raise warning 'ÉCHEC 7 — le lecteur ne peut plus annuler sa réservation !'; end if;
    exception when others then
      raise warning 'ÉCHEC 7 — annulation refusée : %', sqlerrm;
    end;

    -- 8. Le rang est-il attribué EN BASE ? (bug de la file d'attente)
    begin
      insert into biblio_reservations (ecole_id, ressource_id, profil_id, rang)
      values (v_ecole, v_res, v_lecteur, 1)          -- on tente d'imposer 1
      returning rang into rang_obtenu;
      raise notice 'INFO 8 — rang attribué par la base : % (le client ne le décide plus)', rang_obtenu;
    exception when others then
      raise notice 'INFO 8 — réservation refusée : %', sqlerrm;
    end;

    -- 9. Cloisonnement : catalogue d'un AUTRE établissement
    select count(*) into n from biblio_ressources where ecole_id <> v_ecole;
    if n > 0 then raise warning 'ÉCHEC 9 — % notice(s) d''un autre établissement lisibles', n;
    else raise notice 'OK 9   — aucune notice d''un autre établissement n''est lisible'; end if;

    -- 10. Intégrité (127) : réserver une ressource d'ailleurs
    if v_autre is null then
      raise notice 'SAUTÉ 10 — un seul établissement en base';
    else
      begin
        insert into biblio_reservations (ecole_id, ressource_id, profil_id)
        values (v_ecole, v_autre, v_lecteur);
        raise warning 'ÉCHEC 10 — réservation sur une ressource d''un autre établissement';
      exception when foreign_key_violation then
        raise notice 'OK 10  — ressource d''ailleurs : refusée par la clé composite';
      when others then
        raise notice 'OK 10  — refusée (%)', sqlerrm;
      end;
    end if;

    -- 11. Les prix d'achat ne regardent pas un lecteur
    select count(*) into n from biblio_acquisitions_lignes;
    if n > 0 then raise warning 'ÉCHEC 11 — % ligne(s) de commande lisibles', n;
    else raise notice 'OK 11  — lignes de commande (prix d''achat) : invisibles'; end if;
  end if;

  -- =====================================================================
  --  PARTIE B — un PARENT (migration 128 : hors public de la bibliothèque)
  -- =====================================================================
  if v_parent is null then
    raise notice 'SAUTÉ B (tests 12-14) — aucun compte parent sur cet établissement.';
  else
    raise notice '--- B. Identité endossée : parent % ---', v_parent;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    -- 12. Le parent est bien membre… mais pas lecteur de la bibliothèque
    if est_membre_ecole(v_ecole) and not _biblio_lecteur(v_ecole) then
      raise notice 'OK 12  — parent membre de l''école, mais PAS lecteur de la bibliothèque';
    elsif _biblio_lecteur(v_ecole) then
      raise warning 'ÉCHEC 12 — le parent est encore lecteur de la bibliothèque';
    else
      raise warning 'ÉCHEC 12 — le parent n''est même plus membre de l''école (trop restrictif !)';
    end if;

    -- 13. Catalogue invisible
    select count(*) into n from biblio_ressources where ecole_id = v_ecole;
    if n > 0 then raise warning 'ÉCHEC 13 — % notice(s) visibles par un parent', n;
    else raise notice 'OK 13  — catalogue invisible pour un parent'; end if;

    -- 14. Dépôt institutionnel interdit
    begin
      insert into biblio_depots (ecole_id, type, titre, deposant_profil_id, statut)
      values (v_ecole, 'memoire', 'VERIF RLS — dépôt parent', v_parent, 'brouillon');
      raise warning 'ÉCHEC 14 — un parent a pu créer un dépôt institutionnel';
    exception when insufficient_privilege or check_violation then
      raise notice 'OK 14  — dépôt par un parent : refusé';
    end;
  end if;

  raise notice '--- Fin. Aucune donnée conservée (transaction annulée). ---';
end $$;

rollback;
