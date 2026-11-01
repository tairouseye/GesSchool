-- =====================================================================
--  219 — Notifications du PERSONNEL (lot 2 de l'audit du 31/10/2026)
--
--  LE MANQUE. Les parents sont prévenus de tout (notes, absences,
--  factures…) ; le personnel de presque rien. Une déclaration de paiement
--  mobile, un justificatif d'absence, un message ou une demande de document
--  arrivaient sans que personne ne le sache : il fallait penser à ouvrir le
--  bon écran.
--
--  LE PRINCIPE. Une notification va à QUI PEUT TRAITER : les membres qui ont
--  la case de l'écran concerné (`personnel_acces`, mig. 175 — la même
--  source de vérité que `a_acces`, qui décide les policies), plus les
--  promoteurs (`admin_ecole`). Pas de rôle écrit en dur ici : décocher une
--  case dans « Membres » arrête aussi les notifications.
--
--  AUCUNE TABLE NOUVELLE. Tout passe par `notifications`, que la cloche lit
--  déjà côté parent et que le déclencheur de la mig. 066 pousse sur les
--  téléphones abonnés. `categorie` dit à l'écran où mener.
--
--    paiement_declare  → /paiements     (case `paiements`  → encaissement)
--    justificatif      → /assiduite     (case `assiduite`  → presence_vie)
--    message_parent    → /messagerie    (case `messagerie`)
--    demande_document  → /demandes      (case `demandes`)
-- =====================================================================

-- --- 1. Le destinataire : qui peut traiter ----------------------------
create or replace function public._notifier_personnel(
  p_ecole uuid, p_cle text, p_titre text, p_msg text, p_categorie text, p_eleve uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (ecole_id, destinataire_id, titre, message, categorie, eleve_id)
  select p_ecole, x.profil_id, p_titre, p_msg, p_categorie, p_eleve
    from (
      select pa.profil_id from personnel_acces pa
       where pa.ecole_id = p_ecole and pa.boite = public.boite_de_cle(p_cle)
      union
      select pr.profil_id from profil_roles pr
       where pr.ecole_id = p_ecole and pr.role = 'admin_ecole'
    ) x
    join profils p on p.id = x.profil_id and coalesce(p.actif, true)
   --  Pas de doublon : tant qu'une alerte identique n'est pas lue, on n'en
   --  empile pas une seconde (un parent qui écrit cinq messages de suite).
   where not exists (
     select 1 from notifications n
      where n.destinataire_id = x.profil_id and n.ecole_id = p_ecole
        and n.categorie = p_categorie and n.lu = false
        and n.titre is not distinct from p_titre
   );
end $$;
revoke all on function public._notifier_personnel(uuid, text, text, text, text, uuid) from public, anon, authenticated;

-- --- 2. Paiement mobile déclaré par un parent ---------------------------
create or replace function public.trg_notif_perso_declaration() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if new.statut is distinct from 'en_attente' then return null; end if;
  select trim(e.prenom || ' ' || e.nom) into v_nom from eleves e where e.id = new.eleve_id;
  perform public._notifier_personnel(new.ecole_id, 'paiements',
    'Paiement mobile à valider',
    to_char(new.montant, 'FM999G999G999') || ' déclarés' || coalesce(' pour ' || v_nom, '') || '.',
    'paiement_declare', new.eleve_id);
  return null;
end $$;
drop trigger if exists trg_notif_perso_declaration on public.declarations_paiement;
create trigger trg_notif_perso_declaration after insert on public.declarations_paiement
  for each row execute function public.trg_notif_perso_declaration();

-- --- 3. Absence justifiée par un parent (statut → en_attente, mig. 024) --
create or replace function public.trg_notif_perso_justificatif() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if new.statut is distinct from 'en_attente' or old.statut is not distinct from 'en_attente' then return null; end if;
  select trim(e.prenom || ' ' || e.nom) into v_nom from eleves e where e.id = new.eleve_id;
  perform public._notifier_personnel(new.ecole_id, 'assiduite',
    'Justificatif d''absence à examiner',
    coalesce(v_nom || ' · ', '') || 'absence du ' || to_char(new.date_abs, 'DD/MM/YYYY') || '.',
    'justificatif', new.eleve_id);
  return null;
end $$;
drop trigger if exists trg_notif_perso_justificatif on public.absences;
create trigger trg_notif_perso_justificatif after update of statut on public.absences
  for each row execute function public.trg_notif_perso_justificatif();

-- --- 4. Message d'un parent ---------------------------------------------
create or replace function public.trg_notif_perso_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if new.expediteur is distinct from 'parent' then return null; end if;
  select trim(coalesce(t.prenom, '') || ' ' || coalesce(t.nom, '')) into v_nom from tuteurs t where t.id = new.tuteur_id;
  --  Le titre nomme le parent : cinq messages du même parent ne font
  --  qu'une alerte, deux parents en font deux.
  perform public._notifier_personnel(new.ecole_id, 'messagerie',
    'Message de ' || coalesce(nullif(v_nom, ''), 'un parent'),
    left(new.contenu, 120), 'message_parent', null);
  return null;
end $$;
drop trigger if exists trg_notif_perso_message on public.messages;
create trigger trg_notif_perso_message after insert on public.messages
  for each row execute function public.trg_notif_perso_message();

-- --- 5. Demande de document ---------------------------------------------
create or replace function public.trg_notif_perso_demande() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  select trim(e.prenom || ' ' || e.nom) into v_nom from eleves e where e.id = new.eleve_id;
  perform public._notifier_personnel(new.ecole_id, 'demandes',
    'Demande de document',
    coalesce('Pour ' || v_nom || '.', 'Une famille demande un document.'),
    'demande_document', new.eleve_id);
  return null;
end $$;
drop trigger if exists trg_notif_perso_demande on public.demandes_documents;
create trigger trg_notif_perso_demande after insert on public.demandes_documents
  for each row execute function public.trg_notif_perso_demande();

notify pgrst, 'reload schema';

-- =====================================================================
--  VÉRIFICATION — supabase/tests/essai_219.sql
--
--  ANNULATION
--    drop trigger if exists trg_notif_perso_declaration on public.declarations_paiement;
--    drop trigger if exists trg_notif_perso_justificatif on public.absences;
--    drop trigger if exists trg_notif_perso_message on public.messages;
--    drop trigger if exists trg_notif_perso_demande on public.demandes_documents;
--    (les fonctions peuvent rester : sans déclencheur, elles ne font rien)
-- =====================================================================
