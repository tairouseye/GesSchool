-- =====================================================================
--  226 — Les relances et l'état de paiement, sous contrôle du module
--
--  Dernier point de l'audit de sécurité (02/11/2026) : les vieilles gardes
--  par rôle qui ignoraient les modules souscrits.
--
--  1. `relances` se lisait par TOUT membre de l'école : un enseignant voyait
--     le journal des rappels d'impayés, montants compris. Désormais : ceux
--     qui relancent (`p_relancer`) ou voient l'état de paiement
--     (`p_voir_impayes`), et seulement si l'école a le module Encaissements.
--     Écriture directe : `p_relancer` (l'appli passe par les fonctions).
--  2. `p_relancer` n'est rattaché à aucun module : relancer_eleve,
--     relancer_facture, annuler_relances et relancer_tout marchaient donc
--     sans le module. Ils l'exigent maintenant.
--  3. Le passage automatique (executer_relances, cron) saute les écoles qui
--     n'ont pas le module : plus de rappel envoyé au nom d'un module coupé.
--  4. statut_paiement_classe nommait encore les rôles (direction, comptable,
--     secrétariat) ; elle passe au pouvoir `p_voir_impayes`, qui leur est
--     donné par les mêmes modèles. Mesuré le 03/11 : personne ne gagne ni ne
--     perd l'indicateur. Hors module, elle ne renvoie rien (la liste Élèves
--     masque alors la colonne, comme pour un enseignant).
--
--  Le module se lit sur l'école DE LA LIGNE (_ecole_a_module, mig. 225).
-- =====================================================================

create or replace function public._ecole_a_encaissement(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.est_super_admin() or public._ecole_a_module(p_ecole, 'encaissement')
$fn$;
revoke execute on function public._ecole_a_encaissement(uuid) from public, anon;
grant execute on function public._ecole_a_encaissement(uuid) to authenticated;

-- --- 1. La table des relances -----------------------------------------------------
drop policy if exists relances_select on public.relances;
create policy relances_select on public.relances for select using (
  est_super_admin()
  or (ecole_id = ecole_courante() and public._ecole_a_encaissement(ecole_id)
      and (a_acces('p_relancer') or a_acces('p_voir_impayes')))
);
drop policy if exists relances_ins on public.relances;
create policy relances_ins on public.relances for insert with check (
  est_super_admin()
  or (ecole_id = ecole_courante() and public._ecole_a_encaissement(ecole_id) and a_acces('p_relancer'))
);
drop policy if exists relances_upd on public.relances;
create policy relances_upd on public.relances for update
  using (est_super_admin()
    or (ecole_id = ecole_courante() and public._ecole_a_encaissement(ecole_id) and a_acces('p_relancer')))
  with check (est_super_admin()
    or (ecole_id = ecole_courante() and public._ecole_a_encaissement(ecole_id) and a_acces('p_relancer')));
drop policy if exists relances_del on public.relances;
create policy relances_del on public.relances for delete using (
  est_super_admin()
  or (ecole_id = ecole_courante() and public._ecole_a_encaissement(ecole_id) and a_acces('p_relancer'))
);

-- --- 2. Les envois manuels (versions en vigueur + le module) ----------------------
create or replace function public.relancer_eleve(p_eleve uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare r record; v_msg text; v_reste numeric; v_echeance date; v_ecole uuid := ecole_courante();
begin
  select e.ecole_id, e.prenom, e.nom, ec.nom as ecole_nom, ec.devise
    into r
  from eleves e join ecoles ec on ec.id = e.ecole_id
  where e.id = p_eleve;
  if r is null then raise exception 'Élève introuvable.'; end if;
  if not est_super_admin() and r.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (a_acces('p_relancer')) then raise exception 'Réservé au comptable.'; end if;
  if not public._ecole_a_encaissement(r.ecole_id) then raise exception 'Le module Encaissements n''est pas souscrit.'; end if;
  if not peut_voir_eleve(p_eleve) then raise exception 'Cet élève est hors de votre périmètre.'; end if;

  select coalesce(sum(f.montant_total - f.montant_paye), 0), min(f.date_echeance)
    into v_reste, v_echeance
  from factures f
  where f.eleve_id = p_eleve and f.statut not in ('payee','annulee')
    and (f.montant_total - f.montant_paye) > 0;

  if v_reste <= 0 then raise exception 'Aucun impayé pour cet élève.'; end if;

  v_msg := 'Rappel de paiement : '
        || trim(to_char(v_reste, 'FM999G999G999G990')) || ' ' || coalesce(r.devise,'XOF')
        || ' restent dus pour ' || r.prenom || ' ' || r.nom
        || coalesce(' (échéance ' || to_char(v_echeance,'DD/MM/YYYY') || ')', '') || '.';

  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg, p_eleve, 'facture'
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = p_eleve and t.profil_id is not null;

  insert into relances (ecole_id, facture_id, eleve_id, regle_id, palier,
                        canal, montant_du, message, statut)
  values (r.ecole_id, null, p_eleve, null, null, 'manuel', v_reste, v_msg, 'envoye');
end $fn$;

create or replace function public.relancer_facture(p_facture uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare r record; v_msg text; v_ecole uuid := ecole_courante();
begin
  select f.ecole_id, f.eleve_id, f.date_echeance,
         (f.montant_total - f.montant_paye) as reste,
         e.prenom, e.nom, ec.nom as ecole_nom, ec.devise
    into r
  from factures f
  join eleves e  on e.id  = f.eleve_id
  join ecoles ec on ec.id = f.ecole_id
  where f.id = p_facture;

  if r is null then raise exception 'Facture introuvable.'; end if;
  if not est_super_admin() and r.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (a_acces('p_relancer')) then raise exception 'Réservé au comptable.'; end if;
  if not public._ecole_a_encaissement(r.ecole_id) then raise exception 'Le module Encaissements n''est pas souscrit.'; end if;
  if not peut_voir_eleve(r.eleve_id) then raise exception 'Cette facture est hors de votre périmètre.'; end if;

  v_msg := 'Rappel de paiement : '
        || trim(to_char(coalesce(r.reste,0), 'FM999G999G999G990')) || ' ' || coalesce(r.devise,'XOF')
        || ' restent dus pour ' || r.prenom || ' ' || r.nom
        || coalesce(' (échéance ' || to_char(r.date_echeance,'DD/MM/YYYY') || ')', '') || '.';

  insert into notifications (ecole_id, destinataire_id, titre, message)
  select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = r.eleve_id and t.profil_id is not null;

  insert into relances (ecole_id, facture_id, eleve_id, regle_id, palier,
                        canal, montant_du, message, statut)
  values (r.ecole_id, p_facture, r.eleve_id, null, null, 'manuel', r.reste, v_msg, 'envoye');
end $fn$;

create or replace function public.annuler_relances(p_relances uuid[])
returns integer language plpgsql security definer set search_path = public as $fn$
declare r record; v_n int := 0; v_ecole uuid := ecole_courante();
begin
  if not coalesce(est_super_admin() or a_acces('p_relancer'), false) then
    raise exception 'Réservé au comptable.';
  end if;
  if not public._ecole_a_encaissement(v_ecole) then
    raise exception 'Le module Encaissements n''est pas souscrit.';
  end if;

  for r in
    select rl.* from relances rl
     where rl.id = any(coalesce(p_relances, '{}'))
       and rl.statut <> 'annulee'
       and (est_super_admin() or rl.ecole_id = v_ecole)
  loop
    delete from notifications n
     where n.ecole_id = r.ecole_id
       and (n.eleve_id = r.eleve_id or n.eleve_id is null)
       and n.titre = 'Rappel de paiement'
       and n.message is not distinct from r.message
       and n.created_at between r.envoye_le - interval '1 minute' and r.envoye_le + interval '1 minute';

    update relances set statut = 'annulee', annulee_le = now(), annulee_par = auth.uid()
     where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $fn$;

create or replace function public.relancer_tout()
returns integer language plpgsql security definer set search_path = public as $fn$
begin
  if not est_admin() then raise exception 'Réservé à la direction / l''administration.'; end if;
  if not public._ecole_a_encaissement(ecole_courante()) then
    raise exception 'Le module Encaissements n''est pas souscrit.';
  end if;
  return public.executer_relances(ecole_courante());
end $fn$;

-- --- 3. Le passage automatique : seulement les écoles qui ont le module -----------
create or replace function public.executer_relances(p_ecole uuid default null)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_count int := 0; r record; v_msg text;
begin
  for r in
    select f.id as facture_id, f.ecole_id, f.eleve_id,
           f.date_echeance, (f.montant_total - f.montant_paye) as reste,
           rr.id as regle_id, rr.jours, rr.modele,
           e.prenom, e.nom, ec.nom as ecole_nom, ec.devise
    from factures f
    join regles_relance rr on rr.ecole_id = f.ecole_id and rr.actif
    join eleves e  on e.id  = f.eleve_id
    join ecoles ec on ec.id = f.ecole_id
    where f.statut not in ('payee','annulee')
      and f.date_echeance is not null
      and (f.montant_total - f.montant_paye) > 0
      and (p_ecole is null or f.ecole_id = p_ecole)   -- null = toutes les écoles (cron)
      and (ec.modules_actifs is null or 'encaissement' = any(ec.modules_actifs))
      and current_date >= f.date_echeance + make_interval(days => rr.jours)
      and not exists (select 1 from relances rl
                      where rl.facture_id = f.id and rl.regle_id = rr.id)
  loop
    v_msg := public._rendre_relance(r.modele, r.ecole_nom,
               r.prenom || ' ' || r.nom, r.reste, r.devise, r.date_echeance);

    -- Notifie les parents responsables du paiement (repli : tous les parents liés)
    insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
    select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg, r.eleve_id, 'facture'
    from eleve_tuteurs et
    join tuteurs t on t.id = et.tuteur_id
    where et.eleve_id = r.eleve_id and t.profil_id is not null
      and (et.responsable_paiement or not exists (
            select 1 from eleve_tuteurs et2
            join tuteurs t2 on t2.id = et2.tuteur_id
            where et2.eleve_id = r.eleve_id and et2.responsable_paiement
              and t2.profil_id is not null));

    -- Journalise (même sans parent lié : trace de la tentative)
    insert into relances (ecole_id, facture_id, eleve_id, regle_id, palier,
                          canal, montant_du, message, statut)
    values (r.ecole_id, r.facture_id, r.eleve_id, r.regle_id, r.jours,
            'auto', r.reste, v_msg, 'envoye');

    v_count := v_count + 1;
  end loop;
  return v_count;
end $fn$;

-- --- 4. L'indicateur de paiement de la liste Élèves -------------------------------
create or replace function public.statut_paiement_classe(p_classe uuid, p_annee uuid)
returns table(eleve_id uuid, statut text, factures bigint, echues bigint)
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid;
begin
  select c.ecole_id into v_ecole from classes c where c.id = p_classe;
  if v_ecole is null then
    raise exception 'Classe introuvable.';
  end if;
  if not (est_super_admin() or (v_ecole = ecole_courante() and a_acces('p_voir_impayes'))) then
    raise exception 'Accès refusé.';
  end if;
  if not public._ecole_a_encaissement(v_ecole) then
    raise exception 'Le module Encaissements n''est pas souscrit.';
  end if;

  --  Toujours aucun montant : un statut et deux compteurs.
  return query
  select i.eleve_id,
         public._statut_paiement(i.eleve_id, p_annee),
         (select count(*) from factures fa where fa.eleve_id = i.eleve_id and fa.annee_id = p_annee and fa.statut <> 'annulee'),
         (select count(*) from public._echeancier(i.eleve_id, p_annee) x where x.etat = 'en_retard')
    from inscriptions i
   where i.classe_id = p_classe
     and i.annee_id = p_annee;
end $fn$;

-- --- Retour arrière ---------------------------------------------------------------
-- Réappliquer les versions précédentes de relancer_eleve, relancer_facture,
-- annuler_relances (mig. 213), relancer_tout, executer_relances,
-- statut_paiement_classe et les policies relances_* (select = ecole courante ;
-- écriture = est_admin() or a_role('comptable')), puis supprimer
-- _ecole_a_encaissement.
