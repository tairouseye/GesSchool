-- =====================================================================
--  VÉRIFICATION RLS — module Bibliothèque (après migrations 126 et 127)
--
--  Ce script ENDOSSE l'identité d'un vrai étudiant et tente les gestes que
--  l'audit avait trouvés possibles. Chaque test affiche OK (bloqué, donc
--  corrigé) ou ÉCHEC (encore passant).
--
--  Il ne modifie RIEN : tout se déroule dans une transaction annulée à la
--  fin. On peut le relancer autant de fois qu'on veut.
--
--  Prérequis : migrations 126 et 127 appliquées, et au moins un étudiant
--  avec un compte lié (`eleves.profil_id` renseigné) dans un établissement
--  en mode « supérieur ». Le jeu de test suffit.
-- =====================================================================

begin;

do $$
declare
  v_ecole    uuid;
  v_etudiant uuid;   -- profil_id de l'étudiant que l'on endosse
  v_eleve    uuid;
  v_depot    uuid;
  v_sugg     uuid;
  v_resa     uuid;
  v_res      uuid;
  v_autre    uuid;   -- une ressource d'un AUTRE établissement
  n          int;
  rang_obtenu int;
begin
  -- --- Préparation (encore en superutilisateur) -----------------------
  select e.ecole_id, e.profil_id, e.id into v_ecole, v_etudiant, v_eleve
    from eleves e
    join ecoles ec on ec.id = e.ecole_id
   where e.profil_id is not null and ec.type_etablissement = 'superieur'
   limit 1;

  if v_etudiant is null then
    raise exception 'Aucun étudiant avec un compte lié dans un établissement supérieur. Liez un compte étudiant, puis relancez.';
  end if;

  select id into v_res from biblio_ressources where ecole_id = v_ecole limit 1;
  select id into v_autre from biblio_ressources where ecole_id <> v_ecole limit 1;

  -- Matériel de test appartenant à l'étudiant.
  insert into biblio_depots (ecole_id, type, titre, deposant_profil_id, deposant_eleve_id, statut)
  values (v_ecole, 'memoire', 'VERIF RLS — dépôt', v_etudiant, v_eleve, 'brouillon')
  returning id into v_depot;

  insert into biblio_suggestions (ecole_id, demandeur_profil_id, titre, statut)
  values (v_ecole, v_etudiant, 'VERIF RLS — suggestion', 'soumise')
  returning id into v_sugg;

  insert into biblio_reservations (ecole_id, ressource_id, profil_id, statut)
  values (v_ecole, v_res, v_etudiant, 'active')
  returning id into v_resa;

  raise notice '--- Identité endossée : étudiant % (école %) ---', v_etudiant, v_ecole;

  -- --- On devient cet étudiant ----------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_etudiant, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1. Auto-validation de son dépôt (faille GRAVE d'origine)
  begin
    update biblio_depots set statut = 'valide' where id = v_depot;
    get diagnostics n = row_count;
    if n > 0 then raise warning 'ÉCHEC 1 — l''étudiant a pu passer son dépôt à « valide »';
    else raise notice 'OK 1   — dépôt vers « valide » : refusé';
    end if;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK 1   — dépôt vers « valide » : refusé par la policy';
  end;

  -- 2. Publication directe de son dépôt
  begin
    update biblio_depots set statut = 'publie' where id = v_depot;
    get diagnostics n = row_count;
    if n > 0 then raise warning 'ÉCHEC 2 — l''étudiant a pu publier son dépôt';
    else raise notice 'OK 2   — dépôt vers « publie » : refusé';
    end if;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK 2   — dépôt vers « publie » : refusé par la policy';
  end;

  -- 3. Le geste LÉGITIME doit rester possible : soumettre son dossier
  begin
    update biblio_depots set statut = 'soumis' where id = v_depot;
    get diagnostics n = row_count;
    if n = 1 then raise notice 'OK 3   — soumission de son dépôt : autorisée (rien n''est cassé)';
    else raise warning 'ÉCHEC 3 — l''étudiant ne peut plus soumettre son propre dépôt !';
    end if;
  exception when others then
    raise warning 'ÉCHEC 3 — soumission refusée : %', sqlerrm;
  end;

  -- 4. Création d'un dépôt déjà « publie »
  begin
    insert into biblio_depots (ecole_id, type, titre, deposant_profil_id, statut)
    values (v_ecole, 'memoire', 'VERIF RLS — dépôt né publié', v_etudiant, 'publie');
    raise warning 'ÉCHEC 4 — un dépôt a pu être créé directement « publie »';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK 4   — création en « publie » : refusée';
  end;

  -- 5. Auto-acceptation de sa suggestion d'achat
  begin
    update biblio_suggestions set statut = 'acceptee', reponse = 'Accordé par moi-même'
     where id = v_sugg;
    get diagnostics n = row_count;
    if n > 0 then raise warning 'ÉCHEC 5 — l''étudiant a pu accepter sa propre suggestion';
    else raise notice 'OK 5   — auto-acceptation de suggestion : refusée';
    end if;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK 5   — auto-acceptation de suggestion : refusée par la policy';
  end;

  -- 6. Se replacer en tête de la file d'attente
  begin
    update biblio_reservations set rang = 1, statut = 'disponible' where id = v_resa;
    get diagnostics n = row_count;
    if n > 0 then raise warning 'ÉCHEC 6 — l''étudiant a pu modifier son rang dans la file';
    else raise notice 'OK 6   — modification du rang : refusée';
    end if;
  exception when insufficient_privilege or check_violation then
    raise notice 'OK 6   — modification du rang : refusée par la policy';
  end;

  -- 7. L'annulation, elle, doit rester possible
  begin
    update biblio_reservations set statut = 'annulee' where id = v_resa;
    get diagnostics n = row_count;
    if n = 1 then raise notice 'OK 7   — annulation de sa réservation : autorisée';
    else raise warning 'ÉCHEC 7 — l''étudiant ne peut plus annuler sa réservation !';
    end if;
  exception when others then
    raise warning 'ÉCHEC 7 — annulation refusée : %', sqlerrm;
  end;

  -- 8. Le rang est-il bien attribué EN BASE ? (bug de la file d'attente)
  begin
    insert into biblio_reservations (ecole_id, ressource_id, profil_id, rang)
    values (v_ecole, v_res, v_etudiant, 1)      -- on tente d'imposer 1
    returning rang into rang_obtenu;
    raise notice 'INFO 8 — rang attribué par la base : % (le client ne le décide plus)', rang_obtenu;
  exception when others then
    raise notice 'INFO 8 — insertion de réservation refusée : %', sqlerrm;
  end;

  -- 9. Cloisonnement : lecture du catalogue d'un AUTRE établissement
  select count(*) into n from biblio_ressources where ecole_id <> v_ecole;
  if n > 0 then raise warning 'ÉCHEC 9 — % notice(s) d''un autre établissement sont lisibles', n;
  else raise notice 'OK 9   — aucune notice d''un autre établissement n''est lisible';
  end if;

  -- 10. Intégrité (migration 127) : réserver une ressource d'ailleurs
  if v_autre is null then
    raise notice 'SAUTÉ 10 — un seul établissement en base, test non applicable';
  else
    begin
      insert into biblio_reservations (ecole_id, ressource_id, profil_id)
      values (v_ecole, v_autre, v_etudiant);
      raise warning 'ÉCHEC 10 — réservation créée sur une ressource d''un autre établissement';
    exception when foreign_key_violation then
      raise notice 'OK 10  — ressource d''un autre établissement : refusée par la clé composite';
    when others then
      raise notice 'OK 10  — refusée (%)', sqlerrm;
    end;
  end if;

  -- 11. Les prix d'achat ne doivent pas être lisibles par un étudiant
  select count(*) into n from biblio_acquisitions_lignes;
  if n > 0 then raise warning 'ÉCHEC 11 — % ligne(s) de commande lisibles par un étudiant', n;
  else raise notice 'OK 11  — lignes de commande (prix d''achat) : invisibles';
  end if;

  raise notice '--- Fin. Aucune donnée conservée (transaction annulée). ---';
end $$;

rollback;
