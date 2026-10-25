-- =====================================================================
--  211 — Inscription ou réinscription, et dernier mois facturé
--
--  Relevé à la vérification des frais de Tut'Tank (25/10/2026), avant
--  l'import :
--
--  1. LES NOUVEAUX PAIENT L'INSCRIPTION, LES ANCIENS LA RÉINSCRIPTION.
--     La grille porte « Inscription » (obligatoire, 100 000 / 55 000) et
--     « Réinscription » (optionnelle, 80 000 / 45 000). Sans distinction,
--     l'échéancier de la 210 réclamait l'Inscription aux 96 anciens.
--     → `frais.public` : tous | nouveaux | anciens ;
--     → `inscriptions.nouveau` : NULL = déduit (aucune inscription dans
--       une année antérieure de l'école = nouveau), true / false = saisi.
--
--  2. L'ANNÉE VA JUSQU'AU 31 JUILLET, LES MENSUALITÉS JUSQU'EN JUIN
--     (décision du promoteur : 9 mois, octobre → juin). Raccourcir
--     `date_fin` changerait l'année pour tout le reste (périodes,
--     absences…).
--     → `annees_scolaires.fin_facturation` : dernier mois facturé.
--       NULL = jusqu'à `date_fin`, comme avant.
--
--  Rien ne change pour une école qui n'utilise pas ces réglages : public
--  « tous » par défaut, fin de facturation NULL.
--
--  Prérequis : 210.
-- =====================================================================

alter table frais add column if not exists public text not null default 'tous';
do $$ begin
  alter table frais add constraint frais_public_valide check (public in ('tous', 'nouveaux', 'anciens'));
exception when duplicate_object then null; end $$;
comment on column frais.public is
  'À qui le frais s''applique : tous, nouveaux élèves (inscription) ou anciens (réinscription). Mig. 211.';

alter table inscriptions add column if not exists nouveau boolean;
comment on column inscriptions.nouveau is
  'Nouvel élève cette année. NULL = déduit : aucune inscription antérieure dans l''école. Mig. 211.';

alter table annees_scolaires add column if not exists fin_facturation date;
comment on column annees_scolaires.fin_facturation is
  'Dernier mois de mensualité (n''importe quel jour du mois). NULL = jusqu''à date_fin. Mig. 211.';

--  Le changement de `nouveau` est un acte de caisse (il décide de ce qui est
--  dû) : même garde que le tarif (mig. 210).
create or replace function public._garder_tarif_inscription()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (tg_op = 'INSERT' and (new.mensualite is not null or new.motif_tarif is not null or new.exonere
                            or new.nouveau is not null))
     or (tg_op = 'UPDATE' and (new.mensualite is distinct from old.mensualite
                               or new.motif_tarif is distinct from old.motif_tarif
                               or new.exonere is distinct from old.exonere
                               or new.nouveau is distinct from old.nouveau)) then
    if auth.uid() is not null
       and not coalesce(public.est_super_admin() or public.a_acces('p_frais'), false) then
      raise exception 'Seul le gestionnaire des frais peut modifier le tarif d''un élève.';
    end if;
  end if;
  return new;
end $fn$;
revoke execute on function public._garder_tarif_inscription() from public, anon, authenticated;


-- --- Nouvel élève ? --------------------------------------------------------
create or replace function public._est_nouveau(p_eleve uuid, p_annee uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select i.nouveau from inscriptions i where i.eleve_id = p_eleve and i.annee_id = p_annee limit 1),
    not exists (
      select 1 from inscriptions i
        join annees_scolaires a on a.id = i.annee_id
        join annees_scolaires cur on cur.id = p_annee
       where i.eleve_id = p_eleve and a.ecole_id = cur.ecole_id and a.date_debut < cur.date_debut));
$fn$;
revoke execute on function public._est_nouveau(uuid, uuid) from public, anon, authenticated;


-- --- Les frais d'un élève : + le public (corps de la 210) --------------------
--  Nouvelle signature (5e argument) : l'ancienne est supprimée, ses deux
--  appelants sont redéfinis ci-dessous.
drop function if exists public._frais_eleve(uuid, uuid, uuid, uuid);
create function public._frais_eleve(p_ecole uuid, p_annee uuid, p_niveau uuid, p_cycle uuid, p_nouveau boolean)
returns table(id uuid, libelle text, montant numeric, recurrent boolean)
language sql stable security definer set search_path = public as $fn$
  select distinct on (lower(trim(f.libelle))) f.id, f.libelle, f.montant, f.recurrent
    from frais f
   where f.ecole_id = p_ecole and f.obligatoire
     and (f.annee_id = p_annee or f.annee_id is null)
     and ((f.niveau_id is null and f.cycle_id is null)
          or f.niveau_id = p_niveau
          or (f.cycle_id is not null and f.cycle_id = p_cycle))
     and (f.public = 'tous'
          or (f.public = 'nouveaux' and p_nouveau)
          or (f.public = 'anciens' and not p_nouveau))
   order by lower(trim(f.libelle)),
            (f.niveau_id is not null) desc, (f.cycle_id is not null) desc,
            (f.annee_id is not null) desc, f.created_at desc;
$fn$;
revoke execute on function public._frais_eleve(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;


-- --- Le tarif de scolarité : + nouveau (corps de la 210) ---------------------
drop function if exists public._tarif_scolarite(uuid, uuid);
create function public._tarif_scolarite(p_eleve uuid, p_annee uuid)
returns table(classe_id uuid, niveau_id uuid, cycle_id uuid, exonere boolean,
              frais_id uuid, tarif_niveau numeric, montant numeric, nouveau boolean)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_ecole uuid; v_insc record; v_niveau uuid; v_cycle uuid; v_nouveau boolean;
  v_fid uuid; v_mt numeric; v_eff numeric; v_taille int; v_regle record;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if not exists (select 1 from annees_scolaires a where a.id = p_annee and a.ecole_id = v_ecole) then return; end if;

  select i.classe_id, i.mensualite, i.exonere into v_insc
    from inscriptions i
   where i.eleve_id = p_eleve and i.annee_id = p_annee
     and i.statut::text not in ('abandon', 'exclu', 'transfere')
   limit 1;
  if v_insc.classe_id is null then return; end if;
  v_nouveau := public._est_nouveau(p_eleve, p_annee);

  select c.niveau_id, n.cycle_id into v_niveau, v_cycle
    from classes c left join niveaux n on n.id = c.niveau_id
   where c.id = v_insc.classe_id;

  select x.id, x.montant into v_fid, v_mt
    from public._frais_eleve(v_ecole, p_annee, v_niveau, v_cycle, v_nouveau) x
   where x.recurrent order by x.montant desc, x.libelle limit 1;

  v_eff := v_mt;
  if v_fid is not null then
    if v_insc.mensualite is not null then
      v_eff := v_insc.mensualite;
    else
      select count(*) into v_taille from public._fratrie(p_eleve, p_annee);
      if v_taille >= 2 then
        select r.type, r.valeur into v_regle
          from regles_fratrie r
         where r.ecole_id = v_ecole and r.nb_enfants <= v_taille
           and (r.cycle_id is null or r.cycle_id = v_cycle)
         order by (r.cycle_id is not null) desc, r.nb_enfants desc
         limit 1;
        if v_regle.type is not null then
          v_eff := greatest(0, v_mt - case when v_regle.type = 'pourcentage'
                                           then round(v_mt * v_regle.valeur / 100)
                                           else v_regle.valeur end);
        end if;
      end if;
    end if;
  end if;

  return query select v_insc.classe_id, v_niveau, v_cycle, v_insc.exonere, v_fid, v_mt, v_eff, v_nouveau;
end $fn$;
revoke execute on function public._tarif_scolarite(uuid, uuid) from public, anon, authenticated;


-- --- L'échéancier : public des frais, dernier mois facturé (corps de la 210)
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
  )
  select l.o, l.mo, l.lib, l.fid, l.rec,
         coalesce(fac.mt, l.mt),
         l.ech,
         case when fac.regle then coalesce(fac.mt, l.mt) else 0 end,
         fac.libelle is not null,
         case when coalesce(fac.regle, false) then 'paye'
              when l.ech < current_date then 'en_retard'
              when coalesce(fac.entame, false) then 'partiel'
              else 'a_venir' end
    from lignes l
    left join fac on fac.libelle = l.lib
   where coalesce(fac.mt, l.mt) > 0
   order by l.o, l.lib;
end $fn$;
revoke execute on function public._echeancier(uuid, uuid) from public, anon, authenticated;


-- --- Le tarif dans la fiche : + nouveau (corps de la 210) --------------------
create or replace function public._echeancier_json(p_eleve uuid, p_annee uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
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
                 'etat', x.etat) order by x.ordre, x.libelle)
               from public._echeancier(p_eleve, p_annee) x), '[]'::jsonb));
$fn$;
revoke execute on function public._echeancier_json(uuid, uuid) from public, anon, authenticated;


-- --- Tarifs pour la facturation en lot : + nouveau (corps de la 210) --------
--  Le type de retour change : `drop` puis `create`.
drop function if exists public.tarifs_eleves(uuid, uuid[]);
create function public.tarifs_eleves(p_annee uuid, p_eleves uuid[])
returns table(eleve_id uuid, exonere boolean, frais_id uuid, montant numeric, nouveau boolean)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid;
begin
  select a.ecole_id into v_ecole from annees_scolaires a where a.id = p_annee;
  if v_ecole is null then raise exception 'Année introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante() and public.a_acces('encaissement')), false) then
    raise exception 'Accès refusé.';
  end if;
  return query
  select i.eleve_id, coalesce(t.exonere, i.exonere), t.frais_id, t.montant,
         coalesce(t.nouveau, public._est_nouveau(i.eleve_id, p_annee))
    from inscriptions i
    left join lateral public._tarif_scolarite(i.eleve_id, p_annee) t on true
   where i.annee_id = p_annee and i.ecole_id = v_ecole and i.eleve_id = any(p_eleves);
end $fn$;
revoke execute on function public.tarifs_eleves(uuid, uuid[]) from public, anon;
grant execute on function public.tarifs_eleves(uuid, uuid[]) to authenticated;


-- --- Saisir « nouvel élève » (fiche élève, bouton Tarif) ---------------------
--  NULL = revenir à la déduction automatique.
create or replace function public.definir_nouveau_eleve(p_eleve uuid, p_nouveau boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_annee uuid; v_n int;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then raise exception 'Élève introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante() and public.a_acces('p_frais')), false) then
    raise exception 'Accès refusé.';
  end if;
  select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;
  update inscriptions set nouveau = p_nouveau where eleve_id = p_eleve and annee_id = v_annee;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'L''élève n''est pas inscrit cette année.'; end if;
end $fn$;
revoke execute on function public.definir_nouveau_eleve(uuid, boolean) from public, anon;
grant execute on function public.definir_nouveau_eleve(uuid, boolean) to authenticated;


-- --- Le dernier mois facturé (grille tarifaire) -----------------------------
--  `p_mois` : 'AAAA-MM', ou NULL pour revenir à la fin de l'année.
create or replace function public.definir_fin_facturation(p_annee uuid, p_mois text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_debut date; v_fin date; v_date date;
begin
  select a.ecole_id, a.date_debut, a.date_fin into v_ecole, v_debut, v_fin
    from annees_scolaires a where a.id = p_annee;
  if v_ecole is null then raise exception 'Année introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante() and public.a_acces('p_frais')), false) then
    raise exception 'Accès refusé.';
  end if;
  if p_mois is not null then
    if p_mois !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mois invalide.'; end if;
    v_date := (p_mois || '-01')::date;
    if v_date < date_trunc('month', v_debut) or v_date > v_fin then
      raise exception 'Le dernier mois facturé doit être dans l''année scolaire.';
    end if;
  end if;
  update annees_scolaires set fin_facturation = v_date where id = p_annee;
end $fn$;
revoke execute on function public.definir_fin_facturation(uuid, text) from public, anon;
grant execute on function public.definir_fin_facturation(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE : supabase/tests/essai_211_inscription.sql (tout est annulé).
--
--  ANNULATION
--   Réappliquer de la 210 : _frais_eleve (4 arguments, après
--   `drop function public._frais_eleve(uuid, uuid, uuid, uuid, boolean)`),
--   _tarif_scolarite et tarifs_eleves (après `drop`), _echeancier,
--   _echeancier_json, _garder_tarif_inscription ; puis
--   drop function if exists public.definir_fin_facturation(uuid, text);
--   drop function if exists public.definir_nouveau_eleve(uuid, boolean);
--   drop function if exists public._est_nouveau(uuid, uuid);
--   (les colonnes ajoutées peuvent rester : défauts sans effet)
-- =====================================================================
