-- =====================================================================
--  013 — Alertes parents : notifications auto (note / absence / facture)
--  Des triggers insèrent une notification pour les parents liés à l'élève.
--  Le parent (ecole_id null) lit ses notifications via une policy « self ».
-- =====================================================================

-- Accès parent à SES notifications (en plus de la policy tenant du staff)
drop policy if exists notifications_self on notifications;
create policy notifications_self on notifications
  for select using (destinataire_id = auth.uid());

drop policy if exists notifications_self_maj on notifications;
create policy notifications_self_maj on notifications
  for update using (destinataire_id = auth.uid())
  with check (destinataire_id = auth.uid());

-- Helper : notifie tous les parents (comptes liés) d'un élève
create or replace function public._notifier_parents(p_eleve uuid, p_ecole uuid, p_titre text, p_msg text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (ecole_id, destinataire_id, titre, message)
  select p_ecole, t.profil_id, p_titre, p_msg
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = p_eleve and t.profil_id is not null;
end $$;

-- Note saisie
create or replace function public.trg_notif_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_mat text;
begin
  select m.libelle into v_mat
  from evaluations ev join matieres m on m.id = ev.matiere_id
  where ev.id = new.evaluation_id;
  perform public._notifier_parents(new.eleve_id, new.ecole_id, 'Nouvelle note',
    coalesce('Une note a été saisie en ' || v_mat, 'Une nouvelle note a été saisie.'));
  return null;
end $$;
drop trigger if exists trg_notes_notif on notes;
create trigger trg_notes_notif after insert on notes
  for each row execute function public.trg_notif_note();

-- Absence / retard
create or replace function public.trg_notif_absence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._notifier_parents(new.eleve_id, new.ecole_id,
    case when new.type = 'retard' then 'Retard signalé' else 'Absence signalée' end,
    'Enregistré le ' || to_char(new.date_abs, 'DD/MM/YYYY'));
  return null;
end $$;
drop trigger if exists trg_absences_notif on absences;
create trigger trg_absences_notif after insert on absences
  for each row execute function public.trg_notif_absence();

-- Facture émise
create or replace function public.trg_notif_facture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._notifier_parents(new.eleve_id, new.ecole_id, 'Nouvelle facture',
    'Facture ' || coalesce(new.numero, '') ||
    case when new.date_echeance is not null then ' · échéance ' || to_char(new.date_echeance, 'DD/MM/YYYY') else '' end);
  return null;
end $$;
drop trigger if exists trg_factures_notif on factures;
create trigger trg_factures_notif after insert on factures
  for each row execute function public.trg_notif_facture();
