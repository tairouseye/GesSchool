-- =====================================================================
--  234 — Un mois couvert par une facture sans mois n'est plus « à facturer »
--
--  La 232 impute ce qui est PAYÉ sur une ligne de frais mensuel sans mois
--  (« Scolarité (3 mois) », « Frais de scolarité ») aux mois les plus anciens.
--  Mais tant que cette facture n'est pas payée, les mois qu'elle couvre
--  restaient « sans facture » : la fenêtre Encaisser (09/11/2026) et l'espace
--  parent les proposaient à part — la même scolarité facturée deux fois.
--
--  Désormais l'imputation se fait en deux temps, du plus ancien mois au plus
--  récent :
--   • ce qui est FACTURÉ sur ces lignes marque les mois comme facturés
--     (`facture` = true) : ils ne sont plus proposés au paiement ;
--   • ce qui est PAYÉ les marque payés (`paye`), comme dans la 232.
--  Un mois facturé mais pas payé, échéance passée, reste « en retard » : le
--  montant dû ne change pas, seule la double facturation disparaît.
--
--  Prérequis : 232, 233.
--  ANNULATION : rejouer `_echeancier` de la 232.
-- =====================================================================

create or replace function public._echeancier(p_eleve uuid, p_annee uuid)
returns table(
  ordre int, mois text, libelle text, frais_id uuid, recurrent boolean,
  montant numeric, echeance date, paye numeric, facture boolean, etat text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid; v_annee record; v_t record;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select a.id, a.date_debut, coalesce(a.fin_facturation, a.date_fin) as fin into v_annee
    from annees_scolaires a where a.id = p_annee and a.ecole_id = v_ecole;
  if v_annee.id is null then return; end if;

  select * into v_t from public._tarif_scolarite(p_eleve, p_annee);
  if v_t.classe_id is null then return; end if;
  if v_t.exonere then return; end if;

  return query
  with fr as (
    select x.id, x.libelle, x.recurrent,
           case when x.id = v_t.frais_id then v_t.montant else x.montant end as montant
      from public._frais_eleve(v_ecole, p_annee, v_t.niveau_id, v_t.cycle_id, v_t.nouveau) x
  ), lignes as (
    select 0 as o, null::text as mo, fr.libelle as lib, fr.id as fid, false as rec, fr.montant as mt,
           (date_trunc('month', v_annee.date_debut)::date + 4) as ech
      from fr where not fr.recurrent
    union all
    select (row_number() over (order by g, fr.libelle))::int, to_char(g, 'YYYY-MM'),
           fr.libelle || ' — ' || public._libelle_mois(to_char(g, 'YYYY-MM')), fr.id, true, fr.montant,
           (g::date + 4)
      from fr
     cross join generate_series(date_trunc('month', v_annee.date_debut),
                                date_trunc('month', v_annee.fin), interval '1 month') g
     where fr.recurrent
  ), fac as (
    select fl.libelle, sum(fl.montant) as mt,
           bool_and(fa.montant_paye >= fa.montant_total) as regle,
           bool_or(fa.montant_paye > 0) as entame
      from facture_lignes fl join factures fa on fa.id = fl.facture_id
     where fa.eleve_id = p_eleve and fa.ecole_id = v_ecole and fa.statut <> 'annulee'
       and (fa.annee_id = p_annee or fa.annee_id is null)
     group by fl.libelle
  ), credit as (
    --  Lignes d'un frais mensuel sans mois reconnu : ce qui est facturé
    --  (`fact`) et ce qui est payé, au prorata de la facture (`paye`).
    select r.id as fid,
           sum(fl.montant) as fact,
           sum(fl.montant * least(fa.montant_paye, fa.montant_total) / fa.montant_total) as paye
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
      join fr r on r.recurrent and (fl.frais_id = r.id or fl.libelle = r.libelle)
     where fa.eleve_id = p_eleve and fa.ecole_id = v_ecole
       and fa.statut not in ('annulee', 'brouillon') and fa.montant_total > 0
       and (fa.annee_id = p_annee or fa.annee_id is null)
       and not exists (select 1 from lignes l2 where l2.lib = fl.libelle)
     group by r.id
  ), base as (
    select l.o, l.mo, l.lib, l.fid, l.rec, l.mt, l.ech,
           fac.libelle as flib, fac.mt as fmt, fac.regle, fac.entame,
           (l.rec and fac.libelle is null) as libre
      from lignes l left join fac on fac.libelle = l.lib
  ), alloc as (
    --  Du plus ancien mois sans facture au plus récent.
    select b.*,
           coalesce(sum(b.mt) over (partition by b.fid, b.libre order by b.mo
                                    rows between unbounded preceding and 1 preceding), 0) as avant,
           c.fact as c_fact, c.paye as c_paye
      from base b left join credit c on c.fid = b.fid
  ), couvre as (
    select a.*,
           case when a.libre then least(a.mt, greatest(coalesce(a.c_paye, 0) - a.avant, 0)) else 0 end as cr,
           case when a.libre then least(a.mt, greatest(coalesce(a.c_fact, 0) - a.avant, 0)) else 0 end as cf
      from alloc a
  )
  select a.o, a.mo, a.lib, a.fid, a.rec,
         coalesce(a.fmt, a.mt),
         a.ech,
         case when a.regle then coalesce(a.fmt, a.mt) when a.cr > 0 then round(a.cr, 2) else 0 end,
         a.flib is not null or (a.libre and a.cf >= a.mt),
         case when coalesce(a.regle, false) or (a.libre and a.cr >= a.mt) then 'paye'
              when a.ech < current_date then 'en_retard'
              when coalesce(a.entame, false) or a.cr > 0 then 'partiel'
              else 'a_venir' end
    from couvre a
   where coalesce(a.fmt, a.mt) > 0
   order by a.o, a.lib;
end $fn$;
revoke execute on function public._echeancier(uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE (lecture seule) — aucun mois ne doit être à la fois proposé au
--  paiement (`not facture`) ET couvert par une facture sans mois encore
--  ouverte. Et les totaux de `_retards` ne bougent pas (essai_234).
-- =====================================================================
