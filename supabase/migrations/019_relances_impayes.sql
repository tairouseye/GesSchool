-- =====================================================================
--  019 — Relances automatiques d'impayés
--  Paliers configurables (J+/-x après échéance) + journal des relances +
--  job quotidien (pg_cron). Réutilise factures + notifications (→ push).
--  Voir docs/spec-relances-impayes.md.
-- =====================================================================

-- Recouvrement = domaine Gestion (comptable) → réservé au promoteur + comptable
-- (le responsable pédagogique 'direction' en est exclu). Défini ici aussi pour
-- que la migration soit auto-suffisante si jouée avant 033.
create or replace function est_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select est_super_admin() or a_role('admin_ecole')
$$;

-- ---------------------------------------------------------------------
--  1) Tables
-- ---------------------------------------------------------------------
create table if not exists regles_relance (
  id        uuid primary key default gen_random_uuid(),
  ecole_id  uuid not null references ecoles(id) on delete cascade,
  libelle   text not null,
  jours     integer not null,                    -- décalage / date_echeance (négatif = avant)
  modele    text not null,
  actif     boolean not null default true,
  ordre     integer not null default 0,
  created_at timestamptz not null default now(),
  unique (ecole_id, jours)
);
create index if not exists idx_regles_relance_ecole on regles_relance(ecole_id);

create table if not exists relances (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  facture_id  uuid references factures(id) on delete cascade,  -- null = relance manuelle au niveau élève
  eleve_id    uuid not null references eleves(id) on delete cascade,
  regle_id    uuid references regles_relance(id) on delete set null,
  palier      integer,                           -- copie de regles_relance.jours
  canal       text not null default 'auto',      -- 'auto' | 'manuel'
  montant_du  numeric(12,2),
  message     text,
  statut      text not null default 'envoye',    -- 'envoye' | 'echec'
  envoye_le   timestamptz not null default now(),
  unique (facture_id, regle_id)                  -- 1 palier = 1 fois par facture
);
create index if not exists idx_relances_ecole on relances(ecole_id);
create index if not exists idx_relances_facture on relances(facture_id);

-- ---------------------------------------------------------------------
--  2) RLS (cohérent avec 018 : lecture membre, écriture comptable/gestion)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['regles_relance','relances'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on %1$I;', t);
    execute format('drop policy if exists %1$s_ins on %1$I;', t);
    execute format('drop policy if exists %1$s_upd on %1$I;', t);
    execute format('drop policy if exists %1$s_del on %1$I;', t);
    execute format(
      'create policy %1$s_select on %1$I for select '
      || 'using (est_super_admin() or ecole_id = ecole_courante());', t);
    execute format(
      'create policy %1$s_ins on %1$I for insert '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable''))));', t);
    execute format(
      'create policy %1$s_upd on %1$I for update '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable'')))) '
      || 'with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable''))));', t);
    execute format(
      'create policy %1$s_del on %1$I for delete '
      || 'using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role(''comptable''))));', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  3) Rendu du modèle de message
-- ---------------------------------------------------------------------
create or replace function public._rendre_relance(
  p_modele text, p_ecole text, p_eleve text, p_reste numeric,
  p_devise text, p_echeance date
) returns text language sql immutable set search_path = public as $$
  select
    replace(replace(replace(replace(replace(replace(
      coalesce(p_modele, ''),
      '{ecole}',        coalesce(p_ecole, '')),
      '{eleve}',        coalesce(p_eleve, '')),
      '{montant}',      trim(to_char(coalesce(p_reste,0), 'FM999G999G999G990'))),
      '{devise}',       coalesce(p_devise, 'XOF')),
      '{echeance}',     coalesce(to_char(p_echeance, 'DD/MM/YYYY'), '')),
      '{jours_retard}', greatest(current_date - coalesce(p_echeance, current_date), 0)::text);
$$;

-- ---------------------------------------------------------------------
--  4) Job : exécute les relances dues (toutes écoles). Idempotent.
--     SECURITY DEFINER : tourne sans tenant courant (appelé par cron).
-- ---------------------------------------------------------------------
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
    insert into notifications (ecole_id, destinataire_id, titre, message)
    select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg
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

-- Réservé au système (cron). NON exposé à authenticated : la version
-- paramétrable traverse les tenants → passe par le wrapper ci-dessous.
revoke execute on function public.executer_relances(uuid) from public;

-- Wrapper UI : « relancer tous les retards de MON école » (gestion uniquement).
create or replace function public.relancer_tout()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not est_admin() then raise exception 'Réservé à la direction / l''administration.'; end if;
  return public.executer_relances(ecole_courante());
end $$;
grant execute on function public.relancer_tout() to authenticated;

-- ---------------------------------------------------------------------
--  5) Relance manuelle d'une facture (bouton « Relancer (push) »)
-- ---------------------------------------------------------------------
create or replace function public.relancer_facture(p_facture uuid)
returns void language plpgsql security definer set search_path = public as $$
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
  if not (est_admin() or a_role('comptable')) then raise exception 'Réservé au comptable.'; end if;

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
end $$;

grant execute on function public.relancer_facture(uuid) to authenticated;

-- ---------------------------------------------------------------------
--  5 bis) Relance manuelle au niveau ÉLÈVE (total dû, 1 seul message).
--         Utilisée par la page Recouvrement (agrégée par élève).
-- ---------------------------------------------------------------------
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

  insert into notifications (ecole_id, destinataire_id, titre, message)
  select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = p_eleve and t.profil_id is not null;

  insert into relances (ecole_id, facture_id, eleve_id, regle_id, palier,
                        canal, montant_du, message, statut)
  values (r.ecole_id, null, p_eleve, null, null, 'manuel', v_reste, v_msg, 'envoye');
end $$;

grant execute on function public.relancer_eleve(uuid) to authenticated;

-- ---------------------------------------------------------------------
--  6) Planification quotidienne (pg_cron) — 07:00 (Africa/Dakar = UTC)
--     Nécessite l'extension pg_cron activée (Dashboard → Extensions).
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

-- (Re)programme le job sans doublon
do $$
begin
  perform cron.unschedule('relances-impayes-quotidien')
  where exists (select 1 from cron.job where jobname = 'relances-impayes-quotidien');
exception when others then null;  -- pg_cron absent en local : ignorer
end $$;

select cron.schedule('relances-impayes-quotidien', '0 7 * * *',
                     $$select public.executer_relances();$$);
