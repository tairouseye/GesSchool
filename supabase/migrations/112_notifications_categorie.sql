-- =====================================================================
--  112 — Notifications : catégorie + élève concerné (badges « nouveau » parent)
--
--  Ajoute `categorie` et `eleve_id` aux notifications pour permettre des
--  pastilles « nouveau » PAR ENFANT et PAR SECTION dans l'espace parent
--  (Notes, Absences, Paiements…). Additif ; les déclencheurs existants sont
--  mis à jour pour renseigner ces champs.
-- =====================================================================

alter table notifications
  add column if not exists categorie text,
  add column if not exists eleve_id  uuid references eleves(id) on delete set null;

create index if not exists notifications_dest_eleve_idx on notifications(destinataire_id, eleve_id, lu);

-- Helper enrichi : porte l'élève concerné + une catégorie (note / absence / facture…).
drop function if exists public._notifier_parents(uuid, uuid, text, text);
create or replace function public._notifier_parents(p_eleve uuid, p_ecole uuid, p_titre text, p_msg text, p_categorie text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  select p_ecole, t.profil_id, p_titre, p_msg, p_eleve, p_categorie
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = p_eleve and t.profil_id is not null;
end $$;

-- Note saisie → catégorie 'note'
create or replace function public.trg_notif_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_mat text;
begin
  select m.libelle into v_mat
  from evaluations ev join matieres m on m.id = ev.matiere_id
  where ev.id = new.evaluation_id;
  perform public._notifier_parents(new.eleve_id, new.ecole_id, 'Nouvelle note',
    coalesce('Une note a été saisie en ' || v_mat, 'Une nouvelle note a été saisie.'), 'note');
  return null;
end $$;

-- Absence / retard → catégorie 'absence'
create or replace function public.trg_notif_absence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._notifier_parents(new.eleve_id, new.ecole_id,
    case when new.type = 'retard' then 'Retard signalé' else 'Absence signalée' end,
    'Enregistré le ' || to_char(new.date_abs, 'DD/MM/YYYY'), 'absence');
  return null;
end $$;

-- Facture émise → catégorie 'facture'
create or replace function public.trg_notif_facture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._notifier_parents(new.eleve_id, new.ecole_id, 'Nouvelle facture',
    'Facture ' || coalesce(new.numero, '') ||
    case when new.date_echeance is not null then ' · échéance ' || to_char(new.date_echeance, 'DD/MM/YYYY') else '' end,
    'facture');
  return null;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table notifications drop column if exists categorie, drop column if exists eleve_id;
--  (réappliquer la migration 013 pour revenir aux fonctions sans catégorie.)
