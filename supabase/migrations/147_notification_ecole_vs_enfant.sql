-- =====================================================================
--  147 — Notification d'ENFANT vs notification d'ÉCOLE
--
--  Question posée : « il y a des notifications par enfant et d'autres qui
--  concernent l'école, à laquelle peuvent appartenir plusieurs enfants —
--  est-ce que cette particularité est bien gérée ? »
--
--  Recensement de TOUTES les sources de notification avant de répondre :
--
--    _notifier_parents (013/112) — note, absence, facture ... par enfant, eleve_id OK
--    traiter_demande   (028, corrigée en 146) .................. par enfant, eleve_id OK
--    executer_relances (019) — rappel de paiement .............. par enfant, eleve_id ABSENT
--    relancer_eleve    (019) — rappel manuel ................... par enfant, eleve_id ABSENT
--    transport_notifier(042) — prise en charge du bus .......... par enfant, eleve_id ABSENT
--    _notifier_etudiant(130) / messagerie (139) ................ l'étudiant lui-même
--
--  Réponse en deux temps.
--
--  1. Il n'existe AUJOURD'HUI aucune notification d'école. Toutes sont
--     rattachées à un enfant — donc aucune n'est envoyée en plusieurs
--     exemplaires à un même parent pour un même évènement. La particularité
--     ne pose donc pas encore de problème... parce qu'elle n'existe pas.
--
--  2. Mais rien ne la prépare : le jour où l'on notifiera un évènement
--     d'école (annonce publiée, fermeture exceptionnelle), l'écriture
--     naturelle — parcourir `eleve_tuteurs` — enverrait TROIS fois le même
--     message à un parent de trois enfants. C'est précisément le défaut
--     redouté. On pose donc la primitive correcte avant d'en avoir besoin.
--
--  Et trois sources par enfant omettaient encore `eleve_id` : leurs alertes
--  ne peuvent pas porter le nom de l'enfant dans l'espace parent (mig. 146),
--  ni alimenter les pastilles par section (mig. 112). Corrigé ici.
--
--  ⚠️ Les corps des trois fonctions ci-dessous sont repris À L'IDENTIQUE des
--  migrations 019 et 042 ; seules les lignes d'insertion changent, pour
--  ajouter `eleve_id` et `categorie`.
--
--  Prérequis : migrations 019, 042, 112, 146.
-- =====================================================================

-- --- 1. La primitive qui manquait : notifier l'ÉCOLE ----------------------
--  UNE notification par parent, quel que soit son nombre d'enfants. Le
--  `select distinct` sur le profil est tout l'intérêt de la fonction : un
--  parent de trois enfants reçoit un seul message.
--
--  `eleve_id` reste NULL À DESSEIN : l'évènement ne concerne aucun enfant en
--  particulier. L'espace parent l'affiche alors « Toute l'école » plutôt que
--  d'attribuer l'alerte au hasard.
create or replace function public._notifier_parents_ecole(
  p_ecole uuid, p_titre text, p_msg text, p_categorie text default null)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n integer;
begin
  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  -- `null::uuid` et non `null` : dans un SELECT DISTINCT, un null sans type
  -- laisse Postgres deviner, et il n'a pas toujours de quoi.
  select distinct p_ecole, t.profil_id, p_titre, p_msg, null::uuid, p_categorie
    from tuteurs t
   where t.ecole_id = p_ecole
     and t.profil_id is not null
     and exists (select 1 from eleve_tuteurs et where et.tuteur_id = t.id);
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

revoke execute on function public._notifier_parents_ecole(uuid, text, text, text) from public, anon;
grant execute on function public._notifier_parents_ecole(uuid, text, text, text) to authenticated;

-- --- 2. Les trois sources par enfant qui omettaient `eleve_id` ------------
create or replace function public.executer_relances(p_ecole uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
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
end $$;

create or replace function public.relancer_eleve(p_eleve uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_msg text; v_reste numeric; v_echeance date; v_ecole uuid := ecole_courante();
begin
  select e.ecole_id, e.prenom, e.nom, ec.nom as ecole_nom, ec.devise
    into r
  from eleves e join ecoles ec on ec.id = e.ecole_id
  where e.id = p_eleve;
  if r is null then raise exception 'Élève introuvable.'; end if;
  if not est_super_admin() and r.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('comptable')) then raise exception 'Réservé au comptable.'; end if;

  -- Total restant dû + échéance la plus ancienne (factures non soldées)
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
  select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg, r.eleve_id, 'facture'
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = p_eleve and t.profil_id is not null;

  insert into relances (ecole_id, facture_id, eleve_id, regle_id, palier,
                        canal, montant_du, message, statut)
  values (r.ecole_id, null, p_eleve, null, null, 'manuel', v_reste, v_msg, 'envoye');
end $$;

create or replace function public.transport_notifier(p_circuit uuid, p_date date, p_sens text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_n int := 0; v_circuit text; r record;
begin
  if not (est_admin() or a_role('comptable') or a_role('secretaire')) then
    raise exception 'Réservé à la Gestion.';
  end if;
  select nom into v_circuit from transport_circuits where id = p_circuit;
  for r in
    select p.eleve_id, e.prenom
    from transport_pointages p
    join eleves e on e.id = p.eleve_id
    where p.ecole_id = v_ecole and p.circuit_id = p_circuit and p.date_p = p_date
      and p.sens = p_sens and p.embarque
  loop
    insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
    select v_ecole, t.profil_id, 'Transport scolaire',
      r.prenom || ' a été pris(e) en charge par le bus'
      || coalesce(' (' || v_circuit || ')', '')
      || case when p_sens = 'retour' then ' pour le retour.' else ' ce matin.' end,
      r.eleve_id, 'transport'
    from eleve_tuteurs et
    join tuteurs t on t.id = et.tuteur_id
    where et.eleve_id = r.eleve_id and t.profil_id is not null;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Les droits d'exécution ne changent pas ; on les repose par sécurité, une
-- redéfinition pouvant les réinitialiser selon la version de Postgres.
revoke execute on function public.executer_relances(uuid) from public, anon;
grant execute on function public.executer_relances(uuid) to authenticated;
revoke execute on function public.relancer_eleve(uuid) from public, anon;
grant execute on function public.relancer_eleve(uuid) to authenticated;
revoke execute on function public.transport_notifier(uuid, date, text) from public, anon;
grant execute on function public.transport_notifier(uuid, date, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • un rappel de paiement et une prise en charge du bus portent
--     désormais `eleve_id` et `categorie` :
--       select titre, categorie, eleve_id from notifications
--        order by created_at desc limit 5;
--   • la primitive d'école n'envoie qu'un exemplaire par parent :
--       select _notifier_parents_ecole('<ecole>', 'Test', 'Message', 'annonce');
--       → le nombre renvoyé doit égaler le nombre de PARENTS, pas d'élèves
--     (puis supprimer ces notifications de test)
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public._notifier_parents_ecole(uuid, text, text, text);
-- (et réappliquer executer_relances / relancer_eleve des migrations 019,
--  transport_notifier de la 042 — corps identiques, sans eleve_id.)
