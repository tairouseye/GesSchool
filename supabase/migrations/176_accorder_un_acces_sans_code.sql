-- =====================================================================
--  176 — Le promoteur accorde un accès directement, sans renvoyer un code
--
--  🔴 CE QUI MANQUAIT, ET POURQUOI C'EST GÊNANT. La page Membres sait
--  RETIRER un rôle (la croix ✕) mais pas en ACCORDER un : le seul chemin
--  était d'émettre un code d'invitation et de demander à la personne de le
--  saisir. Or les deux responsables de Tut'Tank sont déjà dans
--  l'application depuis des mois. Leur renvoyer un code pour qu'elles
--  « rejoignent » l'établissement où elles travaillent déjà n'a aucun sens,
--  et c'est le promoteur qui l'a dit.
--
--  Le besoin réel : « il faut juste que le promoteur leur donne l'accès au
--  module gestion. »
--
--  ⚠️ CETTE RPC ÉCRIT LES DEUX REPRÉSENTATIONS, et c'est délibéré. Pendant
--  la transition vers les cases à cocher (mig. 175), les droits sont encore
--  tenus par `profil_roles` ; ils le seront bientôt par `personnel_acces`.
--  Écrire les deux garantit qu'aucun accès ne se perdra le jour de la
--  bascule — et que l'épreuve de fidélité (`test/acces.test.mjs`) reste
--  vraie entre-temps. À l'étape 3, on retirera simplement l'écriture du
--  rôle.
-- =====================================================================

-- --- 1. Les modèles, en une fonction réutilisable ----------------------
--
--  ⚠️ BLOC GÉNÉRÉ depuis `boitesDuModele()` de `src/lib/acces.js`, qui le
--  dérive de `ACCES` (permissions.js). La migration 175 portait la même
--  liste dans un CTE jetable ; elle devient une fonction, parce qu'elle
--  sert maintenant à deux endroits — le backfill et l'octroi.
--
--  Rend NULL pour un modèle inconnu : c'est ce qui ferme la porte à
--  `admin_ecole`, `super_admin`, `parent` et `etudiant`. Le promoteur ne
--  « donne » pas le rôle de promoteur par ce guichet, et un parent n'est
--  pas du personnel.
create or replace function public.boites_du_modele(p_modele text)
returns text[] language sql immutable as $fn$
  select case p_modele
    when 'direction' then array['_pedagogie','acquis','admissions','annonces','biblio_acquisitions','biblio_circulation','biblio_depots','biblio_inventaire','bibliotheque','cahier','codes_etudiants','codes_parents','deliberations_sup','eleves','emploi','emploi_sup','enseignants','filieres','fournitures','inscriptions_sup','membres','messagerie','notes_bulletins','notes_lmd','p_bulletins_diffuser','p_codes_parents','parametres','photos','presence_vie','programmation','progression','structure']
    when 'comptable' then array['_gestion','annonces','biblio_acquisitions','biblio_inventaire','cantine','certificats','codes_etudiants','codes_parents','comptabilite','deliberations_sup','demandes','eleves','encaissement','inscriptions_sup','membres','messagerie','p_eleves_editer','p_relancer','parametres','transport']
    when 'secretaire' then array['_gestion','admissions','annonces','bibliotheque','cantine','certificats','codes_etudiants','codes_parents','deliberations_sup','demandes','eleves','encaissement','inscriptions_sup','messagerie','p_eleves_editer','parametres','photos','transport']
    when 'enseignant' then array['_pedagogie','acquis','bibliotheque','cahier','eleves','emploi','emploi_sup','fournitures','notes_bulletins','notes_lmd','presence_vie','progression']
    when 'surveillant' then array['_pedagogie','cahier','eleves','presence_vie']
    when 'rh' then array['enseignants','membres','rh']
    when 'bibliothecaire' then array['biblio_acquisitions','biblio_circulation','biblio_depots','biblio_inventaire','bibliotheque']
    else null
  end;
$fn$;

-- --- 2. Les cases suivent toujours les rôles --------------------------
--
--  Recalcul complet plutôt qu'ajout : c'est ce qui rend l'opération
--  IDEMPOTENTE et juste au retrait. Retirer `comptable` à quelqu'un qui est
--  aussi `direction` ne doit pas lui enlever « Élèves » ou « Membres », que
--  les deux modèles partagent — un simple `delete` des cases du modèle
--  retiré l'aurait fait.
create or replace function public.recalculer_acces_personnel(p_profil uuid, p_ecole uuid)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_cibles text[]; v_n integer;
begin
  select coalesce(array_agg(distinct b), '{}')
    into v_cibles
    from profil_roles pr
    cross join unnest(coalesce(public.boites_du_modele(pr.role::text), '{}')) as b
   where pr.profil_id = p_profil and pr.ecole_id = p_ecole;

  delete from personnel_acces pa
   where pa.profil_id = p_profil and pa.ecole_id = p_ecole
     and not (pa.boite = any(v_cibles));

  insert into personnel_acces (ecole_id, profil_id, boite)
  select p_ecole, p_profil, b from unnest(v_cibles) as b
  on conflict (profil_id, ecole_id, boite) do nothing;

  select count(*) into v_n from personnel_acces
   where profil_id = p_profil and ecole_id = p_ecole;
  return v_n;
end $fn$;

-- --- 3. Accorder un accès à quelqu'un qui est DÉJÀ là ------------------
create or replace function public.accorder_modele(p_profil uuid, p_modele text)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid := ecole_courante();
begin
  --  Fail-closed, dans l'ordre : session, établissement, rôle, cible.
  if auth.uid() is null or v_ecole is null then
    raise exception 'Session introuvable.';
  end if;
  --  ⚠️ LE PROMOTEUR SEUL. Accorder un accès est un acte d'organisation, au
  --  même titre que désigner un responsable de cycle (mig. 166) : si un
  --  responsable pouvait s'en accorder, la délégation ne voudrait rien dire.
  if not est_admin() then
    raise exception 'Seul le promoteur accorde un accès.';
  end if;
  if public.boites_du_modele(p_modele) is null then
    raise exception 'Accès inconnu : %', p_modele;
  end if;
  --  La personne doit déjà être du personnel de CET établissement. On
  --  n'enrôle personne par ce guichet : il sert à élargir un accès, pas à
  --  faire entrer quelqu'un — l'invitation reste la porte d'entrée.
  if not exists (
    select 1 from profils p
     where p.id = p_profil and p.ecole_id = v_ecole and p.actif
  ) then
    raise exception 'Cette personne n''est pas un membre actif de votre établissement.';
  end if;

  insert into profil_roles (profil_id, ecole_id, role)
  values (p_profil, v_ecole, p_modele::role_systeme)
  on conflict (profil_id, ecole_id, role) do nothing;

  --  Et les cases suivent, pour que la bascule de l'étape 3 ne perde rien.
  return public.recalculer_acces_personnel(p_profil, v_ecole);
end $fn$;

revoke execute on function public.accorder_modele(uuid, text) from public, anon;
grant execute on function public.accorder_modele(uuid, text) to authenticated;
revoke execute on function public.recalculer_acces_personnel(uuid, uuid) from public, anon;
revoke execute on function public.boites_du_modele(text) from public, anon;
grant execute on function public.boites_du_modele(text) to authenticated;

-- --- 4. Le retrait d'un rôle entretient les cases ---------------------
--
--  Reprise à l'identique de la migration 029, avec le recalcul ajouté à la
--  fin. Sans lui, retirer un rôle laisserait ses cases derrière : l'écran
--  dirait « accès retiré » et la base, après la bascule, continuerait de
--  l'accorder.
create or replace function public.revoquer_role(p_profil uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid := ecole_courante();
begin
  if not public._peut_inviter(p_role) then
    raise exception 'Non autorisé à gérer ce rôle.';
  end if;
  delete from public.profil_roles
    where profil_id = p_profil and ecole_id = v_ecole and role = p_role::public.role_systeme;
  perform public.recalculer_acces_personnel(p_profil, v_ecole);
end $fn$;
revoke execute on function public.revoquer_role(uuid, text) from public, anon;
grant execute on function public.revoquer_role(uuid, text) to authenticated;

-- --- 5. Et l'arrivée par invitation, de même --------------------------
--
--  `rejoindre` (mig. 030) pose le rôle sans rien savoir des cases. On ne
--  la réécrit pas — elle porte le verrou d'e-mail et plusieurs correctifs —
--  mais un déclencheur maintient les cases à jour quoi qu'il arrive :
--  invitation, octroi, retrait, ou correction à la main dans l'éditeur SQL.
create or replace function public._trg_acces_suit_roles() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  perform public.recalculer_acces_personnel(
    coalesce(NEW.profil_id, OLD.profil_id),
    coalesce(NEW.ecole_id, OLD.ecole_id));
  return null;
end $fn$;

drop trigger if exists trg_acces_suit_roles on public.profil_roles;
create trigger trg_acces_suit_roles
  after insert or delete on public.profil_roles
  for each row execute function public._trg_acces_suit_roles();

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop trigger if exists trg_acces_suit_roles on public.profil_roles;
-- drop function if exists public._trg_acces_suit_roles();
-- drop function if exists public.accorder_modele(uuid, text);
-- drop function if exists public.recalculer_acces_personnel(uuid, uuid);
-- drop function if exists public.boites_du_modele(text);
-- -- et restaurer revoquer_role dans sa version de la migration 029 :
-- create or replace function public.revoquer_role(p_profil uuid, p_role text)
-- returns void language plpgsql security definer set search_path = public as $$
-- declare v_ecole uuid := ecole_courante();
-- begin
--   if not public._peut_inviter(p_role) then raise exception 'Non autorisé à gérer ce rôle.'; end if;
--   delete from public.profil_roles
--     where profil_id = p_profil and ecole_id = v_ecole and role = p_role::public.role_systeme;
-- end $$;
-- notify pgrst, 'reload schema';
