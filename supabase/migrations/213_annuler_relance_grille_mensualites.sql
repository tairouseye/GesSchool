-- =====================================================================
--  213 — Annuler une relance, et la grille de suivi des mensualités.
--
--  Demandes du promoteur (Tut'Tank, 27/10/2026) :
--
--  1. RECOUVREMENT : « un bouton pour annuler les relances au besoin ».
--     Une relance partie par erreur (montant faux avant un encaissement,
--     famille qui a déjà payé en espèces…) restait dans le fil du parent.
--     `annuler_relances(ids)` :
--       • retire la notification « Rappel de paiement » du fil du parent
--         (le push déjà reçu sur le téléphone, lui, ne se rattrape pas) ;
--       • garde la ligne au journal, marquée `annulee` (qui, quand) : on
--         sait ce qui est parti et ce qui a été retiré ;
--       • NE relance PAS le palier : la ligne reste, donc `executer_relances`
--         (07h00) ne renverra pas le même palier pour la même facture.
--     Garde : `p_relancer`, comme l'envoi (mig. 180/181).
--
--  2. SUIVI DES MENSUALITÉS : la synthèse « à l'image du fichier de
--     Mme Kane » (TutTank/Suivi mensualités 2026-2027.xlsx) : une ligne par
--     élève — matricule, nom, prénom, niveau, classe, mensualité,
--     inscription, puis ce qui est payé pour chaque mois.
--     `grille_mensualites(annee, classe)` lit l'échéancier (mig. 210/211) ;
--     le payé d'un mois est le payé RÉEL (un acompte apparaît pour son
--     montant), et son état (paye / partiel / en_retard / a_venir).
--     Garde et périmètre : ceux de `situation_paiements` (p_voir_impayes,
--     classes autorisées). Lecture seule.
-- =====================================================================

-- --- 1. Annuler des relances ----------------------------------------------
alter table public.relances add column if not exists annulee_le  timestamptz;
alter table public.relances add column if not exists annulee_par uuid references profils(id) on delete set null;
comment on column public.relances.statut is
  '''envoye'' | ''echec'' | ''annulee'' (mig. 213 : notification retirée du fil du parent).';

create or replace function public.annuler_relances(p_relances uuid[])
returns integer language plpgsql security definer set search_path = public as $fn$
declare r record; v_n int := 0; v_ecole uuid := ecole_courante();
begin
  if not coalesce(est_super_admin() or a_acces('p_relancer'), false) then
    raise exception 'Réservé au comptable.';
  end if;

  for r in
    select rl.* from relances rl
     where rl.id = any(coalesce(p_relances, '{}'))
       and rl.statut <> 'annulee'
       and (est_super_admin() or rl.ecole_id = v_ecole)
  loop
    --  La notification n'a pas d'identifiant de relance : on la retrouve par
    --  ce qu'elles partagent — même école, même élève (absent avant la
    --  mig. 147), même titre, même message, écrites dans la même
    --  transaction (now() identique ; une minute de marge).
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
revoke execute on function public.annuler_relances(uuid[]) from public, anon;
grant  execute on function public.annuler_relances(uuid[]) to authenticated;


-- --- 2. La grille de suivi des mensualités ---------------------------------
create or replace function public.grille_mensualites(p_annee uuid, p_classe uuid default null)
returns table(
  eleve_id uuid, matricule text, nom text, prenom text,
  niveau text, classe text,
  statut text,                 -- celui de l'échéancier (mig. 210)
  exonere boolean,
  mensualite numeric,
  inscription text,            -- « Inscription » / « Réinscription » (libellé du frais)
  inscription_montant numeric,
  inscription_paye numeric,
  mois jsonb,                  -- {"2026-10": {"montant":55000, "paye":55000, "etat":"paye"}, …}
  total_paye numeric,
  du numeric                   -- dû et échu non payé
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid;
begin
  select a.ecole_id into v_ecole from annees_scolaires a where a.id = p_annee;
  if v_ecole is null then raise exception 'Année introuvable.'; end if;
  if not (est_super_admin() or (v_ecole = ecole_courante() and a_acces('p_voir_impayes'))) then
    raise exception 'Accès refusé.';
  end if;
  if p_classe is not null and classes_autorisees() is not null
     and not (p_classe = any(classes_autorisees())) then
    raise exception 'Cette classe est hors de votre périmètre.';
  end if;

  return query
  with insc as (
    select i.eleve_id, c.libelle as classe, coalesce(sn.libelle, n.libelle) as niveau,
           coalesce(sn.ordre, 0) as o_sn, coalesce(n.ordre, 0) as o_n
      from inscriptions i
      join classes c on c.id = i.classe_id
      left join niveaux n on n.id = c.niveau_id
      left join sous_niveaux sn on sn.id = i.sous_niveau_id
     where i.annee_id = p_annee and c.ecole_id = v_ecole
       and i.statut::text not in ('abandon', 'exclu', 'transfere')
       and (p_classe is null or i.classe_id = p_classe)
       and (classes_autorisees() is null or i.classe_id = any(classes_autorisees()))
  ), ech as (
    select insc.eleve_id, x.*
      from insc cross join lateral public._echeancier(insc.eleve_id, p_annee) x
  ), pp as (
    --  Le payé réel par libellé : un acompte compte pour sa part de la ligne.
    select fa.eleve_id, fl.libelle,
           sum(case when fa.montant_total > 0
                    then least(fl.montant, fa.montant_paye * fl.montant / fa.montant_total)
                    else 0 end) as paye
      from facture_lignes fl join factures fa on fa.id = fl.facture_id
     where fa.ecole_id = v_ecole and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
       and fa.eleve_id in (select eleve_id from insc)
     group by fa.eleve_id, fl.libelle
  ), lignes as (
    select ech.eleve_id, ech.mois, ech.libelle, ech.recurrent, ech.montant, ech.etat,
           round(coalesce(pp.paye, 0)) as paye
      from ech left join pp on pp.eleve_id = ech.eleve_id and pp.libelle = ech.libelle
  ), parmois as (
    select l.eleve_id, l.mois, sum(l.montant) as montant, sum(l.paye) as paye,
           case when bool_and(l.etat = 'paye') then 'paye'
                when bool_or(l.etat = 'en_retard') then 'en_retard'
                when bool_or(l.etat = 'partiel') or sum(l.paye) > 0 then 'partiel'
                else 'a_venir' end as etat
      from lignes l where l.recurrent
     group by l.eleve_id, l.mois
  )
  select e.id, e.matricule, e.nom, e.prenom, insc.niveau, insc.classe,
         public._statut_paiement(e.id, p_annee),
         coalesce(t.exonere, false),
         t.montant,
         (select string_agg(l.libelle, ' + ' order by l.libelle) from lignes l
           where l.eleve_id = e.id and not l.recurrent),
         (select sum(l.montant) from lignes l where l.eleve_id = e.id and not l.recurrent),
         (select sum(l.paye) from lignes l where l.eleve_id = e.id and not l.recurrent),
         coalesce((select jsonb_object_agg(m.mois, jsonb_build_object(
                     'montant', m.montant, 'paye', m.paye, 'etat', m.etat))
                     from parmois m where m.eleve_id = e.id), '{}'::jsonb),
         coalesce((select sum(l.paye) from lignes l where l.eleve_id = e.id), 0),
         coalesce((select sum(l.montant - l.paye) from lignes l
                    where l.eleve_id = e.id and l.etat in ('en_retard', 'partiel')
                      and l.montant > l.paye), 0)
    from insc
    join eleves e on e.id = insc.eleve_id
    left join lateral public._tarif_scolarite(e.id, p_annee) t on true
   order by insc.o_n, insc.classe, insc.o_sn, insc.niveau, e.nom, e.prenom;
end $fn$;
revoke execute on function public.grille_mensualites(uuid, uuid) from public, anon;
grant  execute on function public.grille_mensualites(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE : supabase/tests/essai_213_relances_grille.sql (tout est annulé).
--
--  ANNULATION
--   drop function if exists public.grille_mensualites(uuid, uuid);
--   drop function if exists public.annuler_relances(uuid[]);
--   (les colonnes annulee_le / annulee_par peuvent rester : NULL = sans effet ;
--    les notifications retirées ne reviennent pas)
-- =====================================================================
