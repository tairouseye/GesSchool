-- =====================================================================
--  130 — Espace étudiant : scolarité, documents, annonces, notifications
--
--  Un parent dispose de 26 RPC (`enfant_factures`, `demander_document`…).
--  AUCUNE n'est réutilisable par un étudiant : toutes sont gardées par
--  `_parent_possede()` ou une jointure sur `tuteurs`. La donnée existe donc
--  déjà ; c'est le chemin d'accès qui manquait.
--
--  Cette migration ouvre quatre services à l'étudiant, sur le même patron
--  que `mes_notes_lmd` (mig. 129) : chaque fonction résout elle-même
--  l'étudiant par `eleves.profil_id = auth.uid()`, et ne renvoie que SES
--  données. Aucune policy existante n'est modifiée.
--
--  Motif de fond : un étudiant est MAJEUR et paie lui-même. Le faire passer
--  par ses parents pour voir sa facture était une incohérence du modèle.
--
--  Prérequis : migrations 113 (comptes étudiants) et 129.
-- =====================================================================

-- --- Helper : la fiche élève du compte connecté ---------------------------
--  STABLE et fail-closed. Renvoie NULL si le compte n'est lié à aucune fiche,
--  ce qui fait échouer proprement toutes les fonctions ci-dessous.
create or replace function public._eleve_courant()
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from eleves e where e.profil_id = auth.uid() limit 1;
$$;
grant execute on function public._eleve_courant() to authenticated;

-- =====================================================================
--  1. SCOLARITÉ — factures, déclarations de paiement
-- =====================================================================
create or replace function public.mes_factures()
returns table (
  id uuid, numero text, date_emission date, date_echeance date,
  montant_total numeric, montant_paye numeric, statut text
)
language sql stable security definer set search_path = public as $$
  select f.id, f.numero, f.date_emission, f.date_echeance,
         f.montant_total, f.montant_paye, f.statut::text
    from factures f
   where f.eleve_id = _eleve_courant()
   order by f.date_emission desc;
$$;
revoke execute on function public.mes_factures() from public, anon;
grant execute on function public.mes_factures() to authenticated;

create or replace function public.mes_declarations_paiement()
returns table (
  id uuid, facture_id uuid, montant numeric, mode text,
  reference_tx text, statut text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select d.id, d.facture_id, d.montant, d.mode::text,
         d.reference_tx, d.statut::text, d.created_at
    from declarations_paiement d
   where d.eleve_id = _eleve_courant()
   order by d.created_at desc;
$$;
revoke execute on function public.mes_declarations_paiement() from public, anon;
grant execute on function public.mes_declarations_paiement() to authenticated;

--  L'étudiant déclare son propre paiement mobile. Même écriture que
--  `declarer_paiement` (047), mais la garde est « c'est ma facture »
--  au lieu de « je suis le tuteur ».
create or replace function public.declarer_mon_paiement(
  p_facture uuid, p_montant numeric, p_mode text, p_reference text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_eleve uuid; v_ecole uuid; v_moi uuid := _eleve_courant();
begin
  if v_moi is null then raise exception 'Compte étudiant non rattaché à une fiche.'; end if;
  if coalesce(p_montant, 0) <= 0 then raise exception 'Montant invalide.'; end if;

  select f.eleve_id, f.ecole_id into v_eleve, v_ecole from factures f where f.id = p_facture;
  if v_eleve is null then raise exception 'Facture introuvable.'; end if;
  if v_eleve <> v_moi then raise exception 'Cette facture ne vous concerne pas.'; end if;

  insert into declarations_paiement (ecole_id, facture_id, eleve_id, montant, mode, reference_tx)
  values (v_ecole, p_facture, v_moi, p_montant, p_mode::mode_paiement, p_reference);
end $$;
revoke execute on function public.declarer_mon_paiement(uuid, numeric, text, text) from public, anon;
grant execute on function public.declarer_mon_paiement(uuid, numeric, text, text) to authenticated;

--  Coordonnées de paiement mobile de son établissement.
create or replace function public.mes_infos_paiement()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.valeur from parametres p
       join eleves e on e.ecole_id = p.ecole_id
      where e.id = _eleve_courant() and p.cle = 'paiement_mobile' limit 1),
    '{}'::jsonb);
$$;
revoke execute on function public.mes_infos_paiement() from public, anon;
grant execute on function public.mes_infos_paiement() to authenticated;

-- =====================================================================
--  2. DOCUMENTS ADMINISTRATIFS
-- =====================================================================
--  `demandes_documents.tuteur_id` est nullable : une demande d'étudiant est
--  simplement une demande sans tuteur.
create or replace function public.demander_mon_document(p_type text, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_moi uuid := _eleve_courant(); v_ecole uuid; v_id uuid;
begin
  if v_moi is null then raise exception 'Compte étudiant non rattaché à une fiche.'; end if;
  if coalesce(btrim(p_type), '') = '' then raise exception 'Type de document manquant.'; end if;

  select e.ecole_id into v_ecole from eleves e where e.id = v_moi;

  -- Garde-fou : pas plus de 5 demandes en cours, pour éviter le flood.
  if (select count(*) from demandes_documents d
       where d.eleve_id = v_moi and d.statut in ('en_attente', 'en_cours')) >= 5 then
    raise exception 'Vous avez déjà 5 demandes en cours. Attendez leur traitement.';
  end if;

  insert into demandes_documents (ecole_id, eleve_id, tuteur_id, type, message)
  values (v_ecole, v_moi, null, btrim(p_type), p_message)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.demander_mon_document(text, text) from public, anon;
grant execute on function public.demander_mon_document(text, text) to authenticated;

create or replace function public.mes_demandes_documents()
returns table (
  id uuid, type text, message text, statut text,
  reponse text, created_at timestamptz, traite_le timestamptz
)
language sql stable security definer set search_path = public as $$
  select d.id, d.type, d.message, d.statut, d.reponse, d.created_at, d.traite_le
    from demandes_documents d
   where d.eleve_id = _eleve_courant()
   order by d.created_at desc;
$$;
revoke execute on function public.mes_demandes_documents() from public, anon;
grant execute on function public.mes_demandes_documents() to authenticated;

-- =====================================================================
--  3. ANNONCES DE L'ÉTABLISSEMENT
-- =====================================================================
--  `annonces.cible` est du texte libre ('tous', 'parents', 'enseignants',
--  'classe'). Un étudiant voit le général, jamais ce qui vise explicitement
--  une autre audience.
create or replace function public.mes_annonces()
returns table (id uuid, titre text, contenu text, ecole text, publie_le timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.titre, a.contenu, ec.nom, a.publie_le
    from annonces a
    join ecoles ec on ec.id = a.ecole_id
   where a.ecole_id = (select e.ecole_id from eleves e where e.id = _eleve_courant())
     and (a.cible is null or a.cible in ('tous', 'etudiants', 'eleves'))
     and a.classe_id is null
   order by a.publie_le desc
   limit 50;
$$;
revoke execute on function public.mes_annonces() from public, anon;
grant execute on function public.mes_annonces() to authenticated;

-- =====================================================================
--  4. NOTIFICATIONS — l'émission manquait, pas la plomberie
-- =====================================================================
--  La table `notifications` et sa policy (`destinataire_id = auth.uid()`,
--  mig. 013) fonctionnent déjà pour un étudiant : il a un profil. Mais rien
--  ne lui en adressait — `_notifier_parents` ne vise que les tuteurs.
create or replace function public._notifier_etudiant(
  p_eleve uuid, p_titre text, p_message text
) returns void language plpgsql security definer set search_path = public as $$
declare v_profil uuid; v_ecole uuid;
begin
  select e.profil_id, e.ecole_id into v_profil, v_ecole from eleves e where e.id = p_eleve;
  if v_profil is null then return; end if;   -- compte pas encore activé : rien à faire
  insert into notifications (ecole_id, destinataire_id, titre, message)
  values (v_ecole, v_profil, p_titre, p_message);
end $$;

-- Nouvelle facture → l'étudiant est prévenu (il paie lui-même).
create or replace function public.trg_facture_notif_etudiant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform _notifier_etudiant(new.eleve_id, 'Nouvelle facture',
    'Une facture de ' || to_char(coalesce(new.montant_total, 0), 'FM999G999G999') ||
    ' vient d''être émise.');
  return null;
end $$;
drop trigger if exists trg_factures_notif_etudiant on factures;
create trigger trg_factures_notif_etudiant
  after insert on factures for each row
  execute function public.trg_facture_notif_etudiant();

-- Relevé validé par le jury → son relevé devient consultable.
create or replace function public.trg_releve_notif_etudiant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.valide and not coalesce(old.valide, false) then
    perform _notifier_etudiant(new.eleve_id, 'Relevé de notes disponible',
      'Votre relevé vient d''être validé par le jury.');
  end if;
  return null;
end $$;
drop trigger if exists trg_releves_notif_etudiant on releves;
create trigger trg_releves_notif_etudiant
  after update on releves for each row
  execute function public.trg_releve_notif_etudiant();

-- Décision sur un dépôt (mémoire/thèse) → son auteur est prévenu.
create or replace function public.trg_depot_notif_etudiant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut is distinct from old.statut and new.deposant_eleve_id is not null then
    perform _notifier_etudiant(new.deposant_eleve_id, 'Votre dépôt a été mis à jour',
      'Votre travail « ' || coalesce(new.titre, '') || ' » est passé à « ' || new.statut || ' ».');
  end if;
  return null;
end $$;
drop trigger if exists trg_depots_notif_etudiant on biblio_depots;
create trigger trg_depots_notif_etudiant
  after update on biblio_depots for each row
  execute function public.trg_depot_notif_etudiant();

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop trigger if exists trg_depots_notif_etudiant on biblio_depots;
-- drop trigger if exists trg_releves_notif_etudiant on releves;
-- drop trigger if exists trg_factures_notif_etudiant on factures;
-- drop function if exists public.trg_depot_notif_etudiant(), public.trg_releve_notif_etudiant(),
--   public.trg_facture_notif_etudiant(), public._notifier_etudiant(uuid, text, text);
-- drop function if exists public.mes_annonces(), public.mes_demandes_documents(),
--   public.demander_mon_document(text, text), public.mes_infos_paiement(),
--   public.declarer_mon_paiement(uuid, numeric, text, text),
--   public.mes_declarations_paiement(), public.mes_factures(), public._eleve_courant();
