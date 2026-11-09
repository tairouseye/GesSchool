-- =====================================================================
--  233 — « En retard » veut dire la même chose partout
--
--  Après la 232, la démo comptait 17 élèves en retard à l'accueil et au
--  Recouvrement, mais 19 dans la Situation des paiements. Deux définitions
--  restaient :
--   • le STATUT (`_statut_paiement`, mig. 210) disait « en retard » dès qu'une
--     facture échue n'était pas soldée — y compris une facture de scolarité
--     SANS MOIS, qui ne porte aucune dette au-delà de l'échéancier (Oumou
--     Fall, Elimane Faye : octobre à décembre payés, et une facture
--     « Scolarité mensuelle » de 65 000 restée ouverte) ;
--   • le MONTANT (`_retards.du`) comptait aussi les mois « entamés » pas
--     encore échus — ce n'est pas un retard.
--
--  Désormais, pour le statut comme pour le montant, est EN RETARD :
--   — un mois de l'échéancier dont l'échéance est passée et qui n'est pas
--     payé (état `en_retard`) ;
--   — le reste d'une facture échue HORS échéancier (cantine, transport…).
--  Les autres statuts ne changent pas.
--
--  Prérequis : 232.
--  ANNULATION : rejouer `_statut_paiement` de la 210 et `_retards` de la 232.
-- =====================================================================

create or replace function public._retards(p_eleve uuid, p_annee uuid)
returns table(du numeric, hors numeric, reste numeric, depuis date, prochaine date, prochaine_montant numeric, paye numeric)
language sql stable security definer set search_path = public as $fn$
  with ech as (
    select * from public._echeancier(p_eleve, p_annee)
  ), mensuels as (
    select distinct f.id, f.libelle
      from ech join frais f on f.id = ech.frais_id
     where ech.recurrent
  ), fa as (
    select f.id, f.montant_total - f.montant_paye as reste, f.date_echeance, f.montant_paye,
           not exists (
             select 1 from facture_lignes fl
              where fl.facture_id = f.id
                and (exists (select 1 from ech where ech.libelle = fl.libelle)
                     or exists (select 1 from mensuels m where fl.frais_id = m.id or fl.libelle = m.libelle))
           ) as hors
      from factures f
     where f.eleve_id = p_eleve and f.annee_id = p_annee and f.statut not in ('annulee', 'brouillon')
  ), aven as (
    select x.echeance as d, x.montant - x.paye as m from ech x
     where x.etat in ('a_venir', 'partiel') and x.montant > x.paye
    union all
    select fa.date_echeance, fa.reste from fa
     where fa.hors and fa.reste > 0 and fa.date_echeance >= current_date
  )
  select
    --  233 : les seuls mois échus (plus les mois entamés pas encore dus).
    (select coalesce(round(sum(x.montant - x.paye), 2), 0) from ech x where x.etat = 'en_retard'),
    (select coalesce(sum(fa.reste), 0) from fa
      where fa.hors and fa.reste > 0 and fa.date_echeance is not null and fa.date_echeance < current_date),
    (select coalesce(round(sum(greatest(x.montant - x.paye, 0)), 2), 0) from ech x)
      + (select coalesce(sum(fa.reste), 0) from fa where fa.hors and fa.reste > 0),
    least((select min(x.echeance) from ech x where x.etat = 'en_retard'),
          (select min(fa.date_echeance) from fa where fa.hors and fa.reste > 0 and fa.date_echeance < current_date)),
    (select min(aven.d) from aven where aven.d >= current_date),
    (select coalesce(round(sum(aven.m), 2), 0) from aven where aven.d = (select min(a2.d) from aven a2 where a2.d >= current_date)),
    (select coalesce(sum(fa.montant_paye), 0) from fa);
$fn$;
revoke execute on function public._retards(uuid, uuid) from public, anon, authenticated;

--  Le statut, en un mot (corps de la 210, règle du retard alignée).
--   exonere > en_retard > en_avance > a_jour ; non_facture si rien n'est dû
--   ni facturé.
create or replace function public._statut_paiement(p_eleve uuid, p_annee uuid)
returns text language plpgsql stable security definer set search_path = public as $fn$
declare v_exo boolean; v_n int; v_avance boolean; v_fact int; v_r record;
begin
  select i.exonere into v_exo from inscriptions i
   where i.eleve_id = p_eleve and i.annee_id = p_annee limit 1;
  if coalesce(v_exo, false) then return 'exonere'; end if;

  select count(*),
         coalesce(bool_or(x.etat = 'paye' and x.mois > to_char(current_date, 'YYYY-MM')), false)
    into v_n, v_avance
    from public._echeancier(p_eleve, p_annee) x;

  select count(*) filter (where fa.statut <> 'annulee') into v_fact
    from factures fa where fa.eleve_id = p_eleve and fa.annee_id = p_annee;

  select r.du, r.hors into v_r from public._retards(p_eleve, p_annee) r;

  if v_r.du > 0 or v_r.hors > 0 then return 'en_retard'; end if;
  if v_n = 0 and v_fact = 0 then return 'non_facture'; end if;
  if v_avance then return 'en_avance'; end if;
  return 'a_jour';
end $fn$;
revoke execute on function public._statut_paiement(uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE (lecture seule) — un élève est « en retard » si et seulement
--  si son retard est positif :
--   select public._statut_paiement(i.eleve_id, i.annee_id) = 'en_retard' as statut_retard,
--          (r.du + r.hors) > 0 as montant_retard, count(*)
--     from inscriptions i join annees_scolaires a on a.id = i.annee_id and a.courante
--     cross join lateral public._retards(i.eleve_id, i.annee_id) r
--    group by 1, 2;     -- deux lignes seulement : (true, true) et (false, false)
-- =====================================================================
