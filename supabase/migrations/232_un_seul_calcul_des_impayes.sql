-- =====================================================================
--  232 — Un seul calcul des impayés, partout
--
--  Test côté école du 09/11/2026 (démo, KEUR CHEIKH ANTA) : la même école,
--  le même jour, quatre écrans, quatre réponses. L'accueil Gestion et le
--  Recouvrement lisaient les FACTURES (19 élèves, 3,51 M) ; la fiche, la
--  Situation des paiements et l'espace parent lisaient l'ÉCHÉANCIER (50
--  élèves sur 50, 7,4 M). Une élève qui avait tout payé était « en retard »
--  de 130 000 XOF chez son parent.
--
--  1. LE GARDE-FOU. L'échéancier (mig. 210) ne reconnaît un mois payé que si
--     une ligne de facture porte exactement son libellé (« Frais de
--     scolarité — Octobre 2026 »). Une facture « Frais de scolarité » sans
--     mois — ce que « + Nouvelle facture » produisait — était encaissée mais
--     n'effaçait aucun mois. Désormais, ce qui est PAYÉ sur une ligne d'un
--     frais mensuel sans mois reconnu (même frais, ou même libellé que le
--     frais) couvre les mois les plus anciens de ce frais qui n'ont pas de
--     facture. Un mois entièrement couvert compte comme facturé : il n'est
--     plus proposé au paiement (`_lignes_avance`). Ces lignes ne sont plus
--     répétées dans les « autres frais » du parent.
--
--  2. LE MÊME CHIFFRE. `_retards` donne, pour un élève, ce qui est dû et
--     échu d'après l'échéancier (`du`, même définition que la Situation
--     depuis la mig. 210) et le reste échu des factures HORS échéancier
--     (`hors` : cantine, transport, uniforme…). `impayes_annee` le rend
--     pour toute l'année : l'accueil Gestion, l'accueil du comptable et de
--     la caisse, et le Recouvrement le lisent. La Situation des paiements
--     rend `hors` dans sa colonne `echu` : la page additionne les deux.
--
--  Droits : `impayes_annee` reprend la garde d'`eleve_echeancier` (la caisse
--  ou le pouvoir « voir les impayés ») et le périmètre de classes
--  (`classes_autorisees`), comme `situation_paiements`. Les montants payés
--  y sont déjà visibles par ces rôles (factures, échéancier).
--
--  Tut'Tank : ses seules lignes sans mois sont l'inscription et la
--  réinscription, qui ne sont pas des frais mensuels : rien ne change pour
--  elle (contrôle en bas de fichier).
--
--  Prérequis : 210, 211, 212, 229, 230.
--
--  ANNULATION : rejouer `_echeancier` de la 211, `_echeancier_json` de la
--  229, `situation_paiements` de la 210 ; puis
--    drop function if exists public.impayes_annee(uuid);
--    drop function if exists public._retards(uuid, uuid);
-- =====================================================================


-- --- 1. L'échéancier, avec le garde-fou (corps de la 211) ----------------
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
    --  Ce qui est payé sur des lignes d'un frais mensuel sans mois reconnu,
    --  au prorata de ce que la facture a reçu.
    select r.id as fid,
           sum(fl.montant * least(fa.montant_paye, fa.montant_total) / fa.montant_total) as mt
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
    --  Le crédit couvre les mois sans facture, du plus ancien au plus récent.
    select b.*,
           case when b.libre then
             least(b.mt, greatest(coalesce(c.mt, 0)
               - coalesce(sum(b.mt) over (partition by b.fid, b.libre order by b.mo
                                          rows between unbounded preceding and 1 preceding), 0), 0))
           else 0 end as cr
      from base b left join credit c on c.fid = b.fid
  )
  select a.o, a.mo, a.lib, a.fid, a.rec,
         coalesce(a.fmt, a.mt),
         a.ech,
         case when a.regle then coalesce(a.fmt, a.mt) when a.cr > 0 then a.cr else 0 end,
         a.flib is not null or (a.libre and a.cr >= a.mt),
         case when coalesce(a.regle, false) or (a.libre and a.cr >= a.mt) then 'paye'
              when a.ech < current_date then 'en_retard'
              when coalesce(a.entame, false) or a.cr > 0 then 'partiel'
              else 'a_venir' end
    from alloc a
   where coalesce(a.fmt, a.mt) > 0
   order by a.o, a.lib;
end $fn$;
revoke execute on function public._echeancier(uuid, uuid) from public, anon, authenticated;


-- --- 2. Le détail parent / fiche (corps de la 229) ------------------------
--  Seul changement : une ligne d'un frais mensuel sans mois n'apparaît plus
--  dans les `autres` frais — son paiement est déjà compté dans les mois.
create or replace function public._echeancier_json(p_eleve uuid, p_annee uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
  with ech as (
    select * from public._echeancier(p_eleve, p_annee)
  ),
  mensuels as (
    select distinct f.id, f.libelle
      from ech join frais f on f.id = ech.frais_id
     where ech.recurrent
  ),
  pay as (
    select fl.libelle,
           max(p.date_paiement) as date_paiement,
           string_agg(distinct p.mode::text, ',') as modes
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
      join paiements p on p.facture_id = fa.id
     where fa.eleve_id = p_eleve and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
     group by fl.libelle
  ),
  fac as (
    select distinct on (fl.libelle) fl.libelle, fa.id as facture_id,
           (select p.id from paiements p where p.facture_id = fa.id
             order by p.date_paiement desc, p.created_at desc limit 1) as paiement_id
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
     where fa.eleve_id = p_eleve and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
     order by fl.libelle, fa.date_emission desc, fa.created_at desc
  ),
  autres as (
    select fl.libelle, sum(fl.montant) as montant,
           bool_and(fa.montant_paye >= fa.montant_total) as regle,
           bool_or(fa.montant_paye > 0) as entame,
           min(fa.date_echeance) as echeance
      from facture_lignes fl
      join factures fa on fa.id = fl.facture_id
     where fa.eleve_id = p_eleve and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = p_annee or fa.annee_id is null)
       and not exists (select 1 from ech where ech.libelle = fl.libelle)
       and not exists (select 1 from mensuels m where fl.frais_id = m.id or fl.libelle = m.libelle)
     group by fl.libelle
  )
  select jsonb_build_object(
    'statut', public._statut_paiement(p_eleve, p_annee),
    'tarif', (select jsonb_build_object(
                'tarif_niveau', t.tarif_niveau, 'montant', t.montant,
                'mensualite', i.mensualite, 'motif', i.motif_tarif, 'exonere', i.exonere,
                'nouveau', t.nouveau, 'nouveau_saisi', i.nouveau)
                from inscriptions i
                left join lateral public._tarif_scolarite(p_eleve, p_annee) t on true
               where i.eleve_id = p_eleve and i.annee_id = p_annee limit 1),
    'lignes', coalesce((select jsonb_agg(jsonb_build_object(
                 'mois', x.mois, 'libelle', x.libelle, 'recurrent', x.recurrent,
                 'montant', x.montant, 'echeance', x.echeance, 'paye', x.paye,
                 'etat', x.etat,
                 'date_paiement', case when x.etat = 'paye' then pay.date_paiement end,
                 'mode', case when x.etat in ('paye', 'partiel') then pay.modes end,
                 'facture_id', fac.facture_id,
                 'paiement_id', fac.paiement_id)
                 order by x.ordre, x.libelle)
               from ech x left join pay on pay.libelle = x.libelle
                          left join fac on fac.libelle = x.libelle), '[]'::jsonb),
    'autres', coalesce((select jsonb_agg(jsonb_build_object(
                 'libelle', a.libelle, 'montant', a.montant, 'echeance', a.echeance,
                 'etat', case when a.regle then 'paye'
                              when a.echeance < current_date then 'en_retard'
                              when a.entame then 'partiel'
                              else 'a_venir' end,
                 'date_paiement', case when a.regle then pay.date_paiement end,
                 'mode', case when a.entame then pay.modes end,
                 'facture_id', fac.facture_id,
                 'paiement_id', fac.paiement_id)
                 order by a.echeance nulls last, a.libelle)
               from autres a left join pay on pay.libelle = a.libelle
                             left join fac on fac.libelle = a.libelle), '[]'::jsonb));
$fn$;
revoke execute on function public._echeancier_json(uuid, uuid) from public, anon, authenticated;


-- --- 3. Les retards d'un élève (interne) ---------------------------------
--   du        : dû et échu d'après l'échéancier (en retard ou entamé) ;
--   hors      : reste échu des factures qui ne portent AUCUNE ligne de
--               l'échéancier ni d'un frais mensuel (cantine, transport…) ;
--   reste     : tout ce qui reste à payer sur l'année (échéancier + hors) ;
--   depuis    : la plus ancienne échéance dépassée ;
--   prochaine : la prochaine échéance, et ce qu'elle attend.
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
    (select coalesce(sum(x.montant - x.paye), 0) from ech x where x.etat in ('en_retard', 'partiel')),
    (select coalesce(sum(fa.reste), 0) from fa
      where fa.hors and fa.reste > 0 and fa.date_echeance is not null and fa.date_echeance < current_date),
    (select coalesce(sum(greatest(x.montant - x.paye, 0)), 0) from ech x)
      + (select coalesce(sum(fa.reste), 0) from fa where fa.hors and fa.reste > 0),
    least((select min(x.echeance) from ech x where x.etat = 'en_retard'),
          (select min(fa.date_echeance) from fa where fa.hors and fa.reste > 0 and fa.date_echeance < current_date)),
    (select min(aven.d) from aven where aven.d >= current_date),
    (select coalesce(sum(aven.m), 0) from aven where aven.d = (select min(a2.d) from aven a2 where a2.d >= current_date)),
    (select coalesce(sum(fa.montant_paye), 0) from fa);
$fn$;
revoke execute on function public._retards(uuid, uuid) from public, anon, authenticated;


-- --- 4. Les impayés de l'année, élève par élève --------------------------
--  Pour l'accueil Gestion (direction, comptable, caisse) et le Recouvrement.
create or replace function public.impayes_annee(p_annee uuid)
returns table(
  eleve_id uuid, prenom text, nom text, matricule text, classe_id uuid, classe text,
  du numeric, hors numeric, reste numeric, depuis date, prochaine date, prochaine_montant numeric, paye numeric)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid;
begin
  select a.ecole_id into v_ecole from annees_scolaires a where a.id = p_annee;
  if v_ecole is null then raise exception 'Année introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante()
                      and (public.a_acces('encaissement') or public.a_acces('p_voir_impayes'))), false) then
    raise exception 'Accès refusé.';
  end if;

  return query
  select e.id, e.prenom, e.nom, e.matricule, i.classe_id, c.libelle,
         r.du, r.hors, r.reste, r.depuis, r.prochaine, r.prochaine_montant, r.paye
    from inscriptions i
    join classes c on c.id = i.classe_id
    join eleves e on e.id = i.eleve_id
    cross join lateral public._retards(i.eleve_id, p_annee) r
   where i.annee_id = p_annee and c.ecole_id = v_ecole
     and (classes_autorisees() is null or i.classe_id = any(classes_autorisees()))
   order by r.du + r.hors desc, e.nom, e.prenom;
end $fn$;
revoke execute on function public.impayes_annee(uuid) from public, anon;
grant execute on function public.impayes_annee(uuid) to authenticated;


-- --- 5. La Situation des paiements (corps de la 210) ---------------------
--  Seul changement : `echu` = le reste échu des factures HORS échéancier
--  (`_retards.hors`), que la page ajoute à `du`. Avant, `echu` comptait
--  toutes les factures, et la page ne le lisait jamais (du toujours rempli).
drop function if exists public.situation_paiements(uuid, text, uuid);
create function public.situation_paiements(
  p_annee uuid, p_q text default null, p_classe uuid default null)
returns table(
  eleve_id uuid, prenom text, nom text, matricule text,
  classe_id uuid, classe text,
  statut text,
  total numeric,
  paye numeric,
  reste numeric,
  echu numeric,                -- reste échu hors échéancier (mig. 232)
  factures_echues bigint,
  prochaine_echeance date,
  dernier_paiement date,
  mois_avance text,
  avance_en_attente numeric,
  du numeric                   -- dû et échu d'après l'échéancier (mig. 210)
)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid; v_q text;
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

  v_q := nullif(lower(translate(trim(coalesce(p_q, '')),
           'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC')), '');

  return query
  with insc as (
    select i.eleve_id, i.classe_id, c.libelle as classe
      from inscriptions i
      join classes c on c.id = i.classe_id
     where i.annee_id = p_annee and c.ecole_id = v_ecole
       and (p_classe is null or i.classe_id = p_classe)
       and (classes_autorisees() is null or i.classe_id = any(classes_autorisees()))
  ), f as (
    select fa.eleve_id,
           count(*) filter (where fa.statut <> 'annulee') as nb,
           coalesce(sum(fa.montant_total) filter (where fa.statut <> 'annulee'), 0) as total,
           coalesce(sum(fa.montant_paye)  filter (where fa.statut <> 'annulee'), 0) as paye,
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
  ), st as (
    select insc.eleve_id, public._statut_paiement(insc.eleve_id, p_annee) as s, r.du, r.hors
      from insc cross join lateral public._retards(insc.eleve_id, p_annee) r
  )
  select e.id, e.prenom, e.nom, e.matricule, insc.classe_id, insc.classe,
         st.s,
         coalesce(f.total, 0), coalesce(f.paye, 0),
         greatest(coalesce(f.total, 0) - coalesce(f.paye, 0), 0),
         st.hors, coalesce(f.echues, 0),
         f.prochaine, pa.dernier, av.mois, coalesce(dp.m, 0), st.du
    from insc
    join eleves e on e.id = insc.eleve_id
    join st on st.eleve_id = insc.eleve_id
    left join f  on f.eleve_id  = insc.eleve_id
    left join pa on pa.eleve_id = insc.eleve_id
    left join av on av.eleve_id = insc.eleve_id
    left join dp on dp.eleve_id = insc.eleve_id
   where v_q is null
      or lower(translate(coalesce(e.prenom, '') || ' ' || coalesce(e.nom, '') || ' ' || coalesce(e.matricule, ''),
           'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC')) like '%' || v_q || '%'
   order by (case st.s when 'en_retard' then 0 when 'a_jour' then 1 when 'en_avance' then 2
                       when 'non_facture' then 3 else 4 end),
            st.du + st.hors desc, e.nom, e.prenom;
end $fn$;
revoke execute on function public.situation_paiements(uuid, text, uuid) from public, anon;
grant execute on function public.situation_paiements(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE (lecture seule) — Tut'Tank ne doit pas bouger :
--   avant/après, même résultat pour
--   select public._statut_paiement(i.eleve_id, i.annee_id), count(*)
--     from inscriptions i join annees_scolaires a on a.id = i.annee_id and a.courante
--     join ecoles e on e.id = a.ecole_id and e.nom = 'Tut''Tank' group by 1;
--  Essai : supabase/tests/essai_232.sql (tout est annulé).
-- =====================================================================
