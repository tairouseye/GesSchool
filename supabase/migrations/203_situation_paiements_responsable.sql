-- =====================================================================
--  203 — La situation de paiement de chaque élève, MONTANTS COMPRIS, pour
--        le responsable pédagogique
--
--  Demandé par le promoteur le 17/10/2026 : « permettre au responsable
--  pédagogique de voir rapidement la situation des paiements de n'importe
--  quel élève sous sa responsabilité ».
--
--  🔴 CETTE MIGRATION REVIENT SUR UNE DÉCISION, ET LE DIT. La mig. 170 avait
--  volontairement caché les montants au responsable pédagogique (moindre
--  privilège : il apprenait « en retard », pas « de combien »). Le promoteur,
--  interrogé explicitement le 17/10/2026 entre « statut seul » et « statut +
--  montants », a choisi les montants. C'est sa décision d'établissement ; on
--  l'applique, et on garde tout le reste :
--   • LECTURE SEULE. Rien ici ne permet d'encaisser, d'annuler ni de
--     relancer — ces actes restent à la caisse (`encaissement`, `p_relancer`) ;
--   • LA TABLE `factures` RESTE FERMÉE (mig. 133). On n'élargit pas une
--     policy : une RPC rend des TOTAUX par élève — ni numéro de facture, ni
--     détail des lignes, ni historique des paiements ;
--   • TOUJOURS PAS L'ENSEIGNANT NI LE SURVEILLANT (mig. 170) : la garde est le
--     pouvoir `p_voir_impayes`, que leurs modèles ne cochent pas ;
--   • LE PÉRIMÈTRE PAR CYCLE TIENT (mig. 188-189) : une responsable du
--     préscolaire ne voit que les élèves du préscolaire.
--
--  ⚠️ RAPIDE, C'EST-À-DIRE SANS CHOISIR UNE CLASSE. L'indicateur de la mig.
--  170 exige une classe en argument : pour trouver un élève, il fallait
--  savoir dans quelle classe il est. Ici, toute l'année de son périmètre en
--  un appel, avec une recherche par nom ou matricule.
--
--  Prérequis : 133, 170, 175 (a_acces), 188 (périmètre), 202 (avances).
-- =====================================================================

create or replace function public.situation_paiements(
  p_annee uuid, p_q text default null, p_classe uuid default null)
returns table(
  eleve_id uuid, prenom text, nom text, matricule text,
  classe_id uuid, classe text,
  statut text,                 -- a_jour | en_retard | non_facture (mêmes règles que la mig. 170)
  total numeric,               -- facturé sur l'année, hors factures annulées
  paye numeric,
  reste numeric,
  echu numeric,                -- part du reste dont l'échéance est passée
  factures_echues bigint,
  prochaine_echeance date,     -- prochaine échéance non réglée
  dernier_paiement date,
  mois_avance text,            -- mois À VENIR déjà payés d'avance (mig. 202)
  avance_en_attente numeric    -- déclarations du parent pas encore validées
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid; v_q text;
begin
  --  ⚠️ EN SECURITY DEFINER, LA RLS NE PROTÈGE PLUS : l'école et le droit sont
  --  vérifiés ici (même leçon qu'aux mig. 167 et 170).
  select a.ecole_id into v_ecole from annees_scolaires a where a.id = p_annee;
  if v_ecole is null then raise exception 'Année introuvable.'; end if;
  if not (est_super_admin() or (v_ecole = ecole_courante() and a_acces('p_voir_impayes'))) then
    raise exception 'Accès refusé.';
  end if;
  if p_classe is not null and classes_autorisees() is not null
     and not (p_classe = any(classes_autorisees())) then
    raise exception 'Cette classe est hors de votre périmètre.';
  end if;

  --  Recherche insensible aux accents (pas d'extension `unaccent` ici) :
  --  « Ndeye » doit trouver « Ndèye ».
  v_q := nullif(lower(translate(trim(coalesce(p_q, '')),
           'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC')), '');

  return query
  with insc as (
    select i.eleve_id, i.classe_id, c.libelle as classe
      from inscriptions i
      join classes c on c.id = i.classe_id
     where i.annee_id = p_annee and c.ecole_id = v_ecole
       and (p_classe is null or i.classe_id = p_classe)
       --  Le périmètre par cycle (mig. 188) : NULL = aucune restriction.
       and (classes_autorisees() is null or i.classe_id = any(classes_autorisees()))
  ), f as (
    select fa.eleve_id,
           count(*) filter (where fa.statut <> 'annulee') as nb,
           coalesce(sum(fa.montant_total) filter (where fa.statut <> 'annulee'), 0) as total,
           coalesce(sum(fa.montant_paye)  filter (where fa.statut <> 'annulee'), 0) as paye,
           --  Échu = échéance passée ET solde non nul, jamais le statut saisi
           --  (même précaution qu'à la mig. 170 : le solde est tenu par un
           --  déclencheur, le statut peut mentir). Une facture sans échéance
           --  n'est pas « en retard ».
           coalesce(sum(fa.montant_total - fa.montant_paye) filter (
             where fa.statut <> 'annulee' and fa.montant_total > fa.montant_paye
               and fa.date_echeance is not null and fa.date_echeance < current_date), 0) as echu,
           count(*) filter (
             where fa.statut <> 'annulee' and fa.montant_total > fa.montant_paye
               and fa.date_echeance is not null and fa.date_echeance < current_date) as echues,
           min(fa.date_echeance) filter (
             where fa.statut <> 'annulee' and fa.montant_total > fa.montant_paye
               and fa.date_echeance >= current_date) as prochaine
      from factures fa
     where fa.ecole_id = v_ecole and fa.annee_id = p_annee
       and fa.eleve_id in (select eleve_id from insc)
     group by fa.eleve_id
  ), pa as (
    select fa.eleve_id, max(p.date_paiement) as dernier
      from paiements p join factures fa on fa.id = p.facture_id
     where fa.ecole_id = v_ecole and fa.annee_id = p_annee
       and fa.eleve_id in (select eleve_id from insc)
     group by fa.eleve_id
  ), av as (
    --  Les mois à venir déjà payés d'avance : « payé jusqu'à décembre ».
    select s.eleve_id, string_agg(s.lm, ', ' order by s.ech) as mois
      from (select distinct fa.eleve_id, fa.date_echeance as ech,
                   split_part(fl.libelle, ' — ', 2) as lm
              from factures fa join facture_lignes fl on fl.facture_id = fa.id
             where fa.avance and fa.statut <> 'annulee'
               and fa.ecole_id = v_ecole and fa.annee_id = p_annee
               and fa.date_echeance >= date_trunc('month', current_date)
               and fa.eleve_id in (select eleve_id from insc)) s
     where s.lm <> ''
     group by s.eleve_id
  ), dp as (
    select d.eleve_id, sum(d.montant) as m
      from declarations_paiement d
     where d.ecole_id = v_ecole and d.statut = 'en_attente'
       and d.eleve_id in (select eleve_id from insc)
     group by d.eleve_id
  )
  select e.id, e.prenom, e.nom, e.matricule, insc.classe_id, insc.classe,
         case when coalesce(f.nb, 0) = 0 then 'non_facture'
              when coalesce(f.echues, 0) > 0 then 'en_retard'
              else 'a_jour' end,
         coalesce(f.total, 0), coalesce(f.paye, 0),
         greatest(coalesce(f.total, 0) - coalesce(f.paye, 0), 0),
         coalesce(f.echu, 0), coalesce(f.echues, 0),
         f.prochaine, pa.dernier, av.mois, coalesce(dp.m, 0)
    from insc
    join eleves e on e.id = insc.eleve_id
    left join f  on f.eleve_id  = insc.eleve_id
    left join pa on pa.eleve_id = insc.eleve_id
    left join av on av.eleve_id = insc.eleve_id
    left join dp on dp.eleve_id = insc.eleve_id
   where v_q is null
      or lower(translate(coalesce(e.prenom, '') || ' ' || coalesce(e.nom, '') || ' ' || coalesce(e.matricule, ''),
           'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC')) like '%' || v_q || '%'
   order by (case when coalesce(f.echues, 0) > 0 then 0 when coalesce(f.nb, 0) = 0 then 2 else 1 end),
            coalesce(f.echu, 0) desc, e.nom, e.prenom;
end $fn$;

revoke execute on function public.situation_paiements(uuid, text, uuid) from public, anon;
grant execute on function public.situation_paiements(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • responsable pédagogique, comptable, secrétariat (pouvoir
--     `p_voir_impayes`) → la liste de l'année, montants compris ;
--   • 🔴 enseignant, surveillant, RH → « Accès refusé » ;
--   • 🔴 responsable cloisonnée sur un cycle → seulement les élèves de ses
--     classes ; une classe d'un autre cycle passée en argument → refus ;
--   • 🔴 année d'une AUTRE école → refus ;
--   • élève jamais facturé → « non_facture », reste 0 (et non « en retard ») ;
--   • facture impayée SANS échéance → l'élève reste « a_jour », mais son
--     reste à payer s'affiche ;
--   • facture annulée → n'entre dans aucun total ;
--   • « Ndeye » trouve « Ndèye ».
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.situation_paiements(uuid, text, uuid);
-- notify pgrst, 'reload schema';
