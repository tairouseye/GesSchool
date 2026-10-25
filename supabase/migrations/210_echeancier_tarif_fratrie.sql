-- =====================================================================
--  210 — Échéancier par élève : statut en couleur, tarif propre,
--        exonération et réduction de fratrie
--
--  Demandé par le promoteur le 25/10/2026, à l'import des données de
--  Tut'Tank : « l'école comme les parents doivent voir le statut de
--  paiement des élèves » — rouge en retard, vert à jour, bleu en avance —
--  « et dans le détail, les mois payés et ceux dus ».
--
--  ⚠️ LE STATUT NE PEUT PLUS VENIR DES SEULES FACTURES. La décision d'import
--  est de ne facturer que les mois PAYÉS : un mois dû n'a donc pas de
--  facture. L'ancien calcul (mig. 170 : « une facture échue impayée ») dirait
--  « à jour » à une famille qui n'a rien payé. La source de vérité devient
--  l'ÉCHÉANCIER : ce que l'élève doit, mois par mois, d'après la grille de
--  frais de son niveau — et une ligne est payée quand la facture qui la porte
--  est réglée.
--
--  ⚠️ AUCUN CHANGEMENT POUR UNE ÉCOLE SANS FRAIS OBLIGATOIRES : l'échéancier
--  est vide, le statut retombe sur l'ancienne règle (factures échues), et
--  « non facturé » reste « non facturé ».
--
--  Ajouts :
--   1. `inscriptions.mensualite`, `motif_tarif`, `exonere` — le tarif PROPRE
--      à l'élève (22 réductions chez Tut'Tank) et l'exonération (élèves qui
--      ne paient pas). Modifiables seulement avec le pouvoir `p_frais`.
--   2. `regles_fratrie` — la réduction automatique selon le nombre d'enfants
--      inscrits, paramétrée par l'école (pourcentage ou montant).
--   3. `_echeancier`, `_statut_paiement` — internes.
--   4. RPC : `eleve_echeancier` (personnel), `enfant_echeancier` (parent),
--      `fratrie_eleve`, `definir_tarif_eleve`, `tarifs_eleves` (facturation
--      en lot).
--   5. `statut_paiement_classe`, `situation_paiements`, `_lignes_avance`
--      passent par l'échéancier. Mêmes signatures, mêmes gardes.
--
--  Échéance d'un mois : le 5. En retard À PARTIR DU 6 (décision du
--  promoteur, 25/10/2026).
--
--  Prérequis : 133, 164, 170, 175, 180, 188, 202, 203, 209.
-- =====================================================================


-- --- 1. Le tarif propre à l'élève --------------------------------------
alter table inscriptions add column if not exists mensualite numeric(12,2);
alter table inscriptions add column if not exists motif_tarif text;
alter table inscriptions add column if not exists exonere boolean not null default false;

do $$ begin
  alter table inscriptions add constraint inscriptions_mensualite_positive
    check (mensualite is null or mensualite >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table inscriptions add constraint inscriptions_motif_tarif_valide
    check (motif_tarif is null or motif_tarif in ('fratrie', 'exonere', 'autre'));
exception when duplicate_object then null; end $$;

comment on column inscriptions.mensualite is
  'Mensualité propre à l''élève pour l''année (remplace le frais de scolarité de son niveau). NULL = tarif du niveau, moins la réduction de fratrie (mig. 210).';
comment on column inscriptions.exonere is
  'Élève exonéré : rien n''est dû (ni inscription ni mensualités). Mig. 210.';

--  ⚠️ LA POLICY D'ÉCRITURE D'`inscriptions` EST `p_eleves_editer` (mig. 186).
--  Sans ce garde, quiconque peut corriger une classe pourrait aussi baisser
--  une mensualité ou exonérer un élève : un acte de caisse. On ne touche pas
--  à la policy (elle sert à inscrire), on protège les trois colonnes.
--  `auth.uid() is null` : opération serveur (éditeur SQL, import), pas un
--  utilisateur de l'appli.
create or replace function public._garder_tarif_inscription()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (tg_op = 'INSERT' and (new.mensualite is not null or new.motif_tarif is not null or new.exonere))
     or (tg_op = 'UPDATE' and (new.mensualite is distinct from old.mensualite
                               or new.motif_tarif is distinct from old.motif_tarif
                               or new.exonere is distinct from old.exonere)) then
    if auth.uid() is not null
       and not coalesce(public.est_super_admin() or public.a_acces('p_frais'), false) then
      raise exception 'Seul le gestionnaire des frais peut modifier le tarif d''un élève.';
    end if;
  end if;
  return new;
end $fn$;
revoke execute on function public._garder_tarif_inscription() from public, anon, authenticated;

drop trigger if exists trg_garder_tarif_inscription on inscriptions;
create trigger trg_garder_tarif_inscription
  before insert or update on inscriptions
  for each row execute function public._garder_tarif_inscription();


-- --- 2. La règle de fratrie, propre à chaque école ----------------------
create table if not exists regles_fratrie (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  --  À partir de combien d'enfants inscrits la règle s'applique (2, 3, 4…).
  --  La règle retenue est celle au plus grand seuil atteint.
  nb_enfants  integer not null check (nb_enfants >= 2),
  type        text not null check (type in ('pourcentage', 'montant')),
  valeur      numeric(12,2) not null check (valeur >= 0),
  --  NULL = tous les cycles ; sinon la règle propre à ce cycle prime.
  cycle_id    uuid references cycles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (type <> 'pourcentage' or valeur <= 100)
);
create unique index if not exists regles_fratrie_unique
  on regles_fratrie(ecole_id, nb_enfants, coalesce(cycle_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists regles_fratrie_ecole_idx on regles_fratrie(ecole_id);

alter table regles_fratrie enable row level security;
--  Mêmes droits que la grille de frais (mig. 180) : lecture à la caisse,
--  écriture au gestionnaire des frais.
drop policy if exists regles_fratrie_select on regles_fratrie;
create policy regles_fratrie_select on regles_fratrie
  for select using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('encaissement')));
drop policy if exists regles_fratrie_ins on regles_fratrie;
create policy regles_fratrie_ins on regles_fratrie
  for insert with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')));
drop policy if exists regles_fratrie_upd on regles_fratrie;
create policy regles_fratrie_upd on regles_fratrie
  for update using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')))
         with check (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')));
drop policy if exists regles_fratrie_del on regles_fratrie;
create policy regles_fratrie_del on regles_fratrie
  for delete using (est_super_admin() or (ecole_id = ecole_courante() and a_acces('p_frais')));


-- --- 3. La fratrie : les élèves qui partagent un parent -----------------
--  Rien à saisir : le lien existe déjà (`eleve_tuteurs`). Limité aux élèves
--  inscrits dans l'année, hors abandon / exclusion / transfert.
create or replace function public._fratrie(p_eleve uuid, p_annee uuid)
returns table(eleve_id uuid)
language sql stable security definer set search_path = public as $fn$
  select distinct et2.eleve_id
    from eleve_tuteurs et1
    join eleve_tuteurs et2 on et2.tuteur_id = et1.tuteur_id
    join inscriptions i on i.eleve_id = et2.eleve_id and i.annee_id = p_annee
   where et1.eleve_id = p_eleve
     and i.statut::text not in ('abandon', 'exclu', 'transfere');
$fn$;
revoke execute on function public._fratrie(uuid, uuid) from public, anon, authenticated;


-- --- 4. L'échéancier ----------------------------------------------------
--  Une ligne par élément dû sur l'année :
--   • chaque frais PONCTUEL obligatoire (l'inscription), dû au début de
--     l'année ;
--   • chaque MOIS de l'année, pour chaque frais MENSUEL obligatoire.
--  Mêmes frais, même ordre de préférence (niveau > cycle > école) et mêmes
--  libellés que la facturation en lot et le paiement d'avance (mig. 202) :
--  c'est le LIBELLÉ qui relie une ligne due à la facture qui la règle.
--
--  Montant du frais de scolarité (le mensuel obligatoire le plus élevé) :
--   1. `inscriptions.mensualite` si elle est saisie ;
--   2. sinon le tarif du niveau, moins la règle de fratrie ;
--   3. les autres frais gardent leur montant.
--  Une ligne déjà facturée prend le montant RÉELLEMENT facturé.
--
--  États : `paye` (facture non annulée entièrement réglée), `partiel`
--  (facturée, réglée en partie), `en_retard` (non réglée, échéance passée),
--  `a_venir`.
--  Les frais obligatoires qui s'appliquent à un niveau : même choix et même
--  ordre de préférence que la mig. 202.
create or replace function public._frais_eleve(p_ecole uuid, p_annee uuid, p_niveau uuid, p_cycle uuid)
returns table(id uuid, libelle text, montant numeric, recurrent boolean)
language sql stable security definer set search_path = public as $fn$
  select distinct on (lower(trim(f.libelle))) f.id, f.libelle, f.montant, f.recurrent
    from frais f
   where f.ecole_id = p_ecole and f.obligatoire
     and (f.annee_id = p_annee or f.annee_id is null)
     and ((f.niveau_id is null and f.cycle_id is null)
          or f.niveau_id = p_niveau
          or (f.cycle_id is not null and f.cycle_id = p_cycle))
   order by lower(trim(f.libelle)),
            (f.niveau_id is not null) desc, (f.cycle_id is not null) desc,
            (f.annee_id is not null) desc, f.created_at desc;
$fn$;
revoke execute on function public._frais_eleve(uuid, uuid, uuid, uuid) from public, anon, authenticated;

--  Le tarif de SCOLARITÉ de l'élève (le frais mensuel obligatoire le plus
--  élevé de son niveau) : sa mensualité propre, sinon le tarif du niveau
--  moins la règle de fratrie. `frais_id` NULL : pas de scolarité mensuelle.
create or replace function public._tarif_scolarite(p_eleve uuid, p_annee uuid)
returns table(classe_id uuid, niveau_id uuid, cycle_id uuid, exonere boolean,
              frais_id uuid, tarif_niveau numeric, montant numeric)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_ecole uuid; v_insc record; v_niveau uuid; v_cycle uuid;
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

  select c.niveau_id, n.cycle_id into v_niveau, v_cycle
    from classes c left join niveaux n on n.id = c.niveau_id
   where c.id = v_insc.classe_id;

  select x.id, x.montant into v_fid, v_mt
    from public._frais_eleve(v_ecole, p_annee, v_niveau, v_cycle) x
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

  return query select v_insc.classe_id, v_niveau, v_cycle, v_insc.exonere, v_fid, v_mt, v_eff;
end $fn$;
revoke execute on function public._tarif_scolarite(uuid, uuid) from public, anon, authenticated;

create or replace function public._echeancier(p_eleve uuid, p_annee uuid)
returns table(
  ordre int, mois text, libelle text, frais_id uuid, recurrent boolean,
  montant numeric, echeance date, paye numeric, facture boolean, etat text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid; v_annee record; v_t record;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select a.id, a.date_debut, a.date_fin into v_annee
    from annees_scolaires a where a.id = p_annee and a.ecole_id = v_ecole;
  if v_annee.id is null then return; end if;

  select * into v_t from public._tarif_scolarite(p_eleve, p_annee);
  if v_t.classe_id is null then return; end if;
  --  Exonéré : rien n'est dû.
  if v_t.exonere then return; end if;

  return query
  with fr as (
    select x.id, x.libelle, x.recurrent,
           case when x.id = v_t.frais_id then v_t.montant else x.montant end as montant
      from public._frais_eleve(v_ecole, p_annee, v_t.niveau_id, v_t.cycle_id) x
  ), lignes as (
    --  Ponctuels : dus le 5 du premier mois de l'année.
    select 0 as o, null::text as mo, fr.libelle as lib, fr.id as fid, false as rec, fr.montant as mt,
           (date_trunc('month', v_annee.date_debut)::date + 4) as ech
      from fr where not fr.recurrent
    union all
    select (row_number() over (order by g, fr.libelle))::int, to_char(g, 'YYYY-MM'),
           fr.libelle || ' — ' || public._libelle_mois(to_char(g, 'YYYY-MM')), fr.id, true, fr.montant,
           (g::date + 4)
      from fr
     cross join generate_series(date_trunc('month', v_annee.date_debut),
                                date_trunc('month', v_annee.date_fin), interval '1 month') g
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

--  Le statut d'un élève, en un mot.
--   exonere > en_retard > en_avance > a_jour ; non_facture si rien n'est dû
--   ni facturé. Une facture ÉCHUE impayée hors échéancier (cantine,
--   transport…) compte aussi comme un retard : c'est l'ancienne règle
--   (mig. 170), qu'on ne perd pas.
create or replace function public._statut_paiement(p_eleve uuid, p_annee uuid)
returns text language plpgsql stable security definer set search_path = public as $fn$
declare v_exo boolean; v_n int; v_retard boolean; v_avance boolean; v_fact int; v_echue boolean;
begin
  select i.exonere into v_exo from inscriptions i
   where i.eleve_id = p_eleve and i.annee_id = p_annee limit 1;
  if coalesce(v_exo, false) then return 'exonere'; end if;

  select count(*),
         coalesce(bool_or(x.etat = 'en_retard'), false),
         coalesce(bool_or(x.etat = 'paye' and x.mois > to_char(current_date, 'YYYY-MM')), false)
    into v_n, v_retard, v_avance
    from public._echeancier(p_eleve, p_annee) x;

  select count(*) filter (where fa.statut <> 'annulee'),
         coalesce(bool_or(fa.statut <> 'annulee' and fa.montant_total > fa.montant_paye
                          and fa.date_echeance is not null and fa.date_echeance < current_date), false)
    into v_fact, v_echue
    from factures fa where fa.eleve_id = p_eleve and fa.annee_id = p_annee;

  if v_retard or v_echue then return 'en_retard'; end if;
  if v_n = 0 and v_fact = 0 then return 'non_facture'; end if;
  if v_avance then return 'en_avance'; end if;
  return 'a_jour';
end $fn$;
revoke execute on function public._statut_paiement(uuid, uuid) from public, anon, authenticated;


-- --- 5. Lecture de l'échéancier ------------------------------------------
--  Personnel : la caisse ou le pouvoir « voir les impayés », dans son
--  périmètre de cycle (mig. 188). Aucun accès enseignant ni surveillant
--  (mig. 170).
create or replace function public.eleve_echeancier(p_eleve uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_ecole uuid; v_annee uuid;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then raise exception 'Élève introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante()
                      and (public.a_acces('encaissement') or public.a_acces('p_voir_impayes'))
                      and public.peut_voir_eleve(p_eleve)), false) then
    raise exception 'Accès refusé.';
  end if;
  select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;
  return public._echeancier_json(p_eleve, v_annee);
end $fn$;

--  Parent : son enfant, et seulement le sien.
--  ⚠️ `coalesce` : la leçon de la mig. 209 (une garde NULL laisse passer).
create or replace function public.enfant_echeancier(p_eleve uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_annee uuid;
begin
  if not coalesce(public._parent_possede(p_eleve), false) then raise exception 'Accès refusé.'; end if;
  select a.id into v_annee from annees_scolaires a join eleves e on e.ecole_id = a.ecole_id
   where e.id = p_eleve and a.courante limit 1;
  return public._echeancier_json(p_eleve, v_annee);
end $fn$;

create or replace function public._echeancier_json(p_eleve uuid, p_annee uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'statut', public._statut_paiement(p_eleve, p_annee),
    --  Le tarif appliqué : tarif du niveau, mensualité propre éventuelle,
    --  montant retenu (après fratrie), motif, exonération.
    'tarif', (select jsonb_build_object(
                'tarif_niveau', t.tarif_niveau, 'montant', t.montant,
                'mensualite', i.mensualite, 'motif', i.motif_tarif, 'exonere', i.exonere)
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

revoke execute on function public.eleve_echeancier(uuid) from public, anon;
grant execute on function public.eleve_echeancier(uuid) to authenticated;
revoke execute on function public.enfant_echeancier(uuid) from public, anon;
grant execute on function public.enfant_echeancier(uuid) to authenticated;


-- --- 6. La fratrie d'un élève (fiche élève) ------------------------------
--  Lecture du dossier élève (`eleves`). Le statut de paiement n'est rendu
--  qu'à ceux qui ont le droit de le voir (mig. 170 / 203) ; sinon NULL.
create or replace function public.fratrie_eleve(p_eleve uuid)
returns table(eleve_id uuid, prenom text, nom text, classe text, statut text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid; v_annee uuid; v_paie boolean;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then raise exception 'Élève introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante() and public.a_acces('eleves')
                      and public.peut_voir_eleve(p_eleve)), false) then
    raise exception 'Accès refusé.';
  end if;
  v_paie := coalesce(public.est_super_admin() or public.a_acces('encaissement') or public.a_acces('p_voir_impayes'), false);
  select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;

  return query
  select e.id, e.prenom, e.nom, c.libelle,
         case when v_paie then public._statut_paiement(e.id, v_annee) end
    from public._fratrie(p_eleve, v_annee) f
    join eleves e on e.id = f.eleve_id and e.ecole_id = v_ecole
    left join inscriptions i on i.eleve_id = e.id and i.annee_id = v_annee
    left join classes c on c.id = i.classe_id
   where e.id <> p_eleve
   order by e.date_naissance nulls last, e.prenom;
end $fn$;
revoke execute on function public.fratrie_eleve(uuid) from public, anon;
grant execute on function public.fratrie_eleve(uuid) to authenticated;


-- --- 7. Définir le tarif d'un élève ---------------------------------------
create or replace function public.definir_tarif_eleve(
  p_eleve uuid, p_mensualite numeric, p_motif text, p_exonere boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_annee uuid; v_n int;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then raise exception 'Élève introuvable.'; end if;
  if not coalesce(public.est_super_admin()
                  or (v_ecole = public.ecole_courante() and public.a_acces('p_frais')), false) then
    raise exception 'Accès refusé.';
  end if;
  if p_mensualite is not null and p_mensualite < 0 then raise exception 'Mensualité invalide.'; end if;
  if p_motif is not null and p_motif not in ('fratrie', 'exonere', 'autre') then
    raise exception 'Motif invalide.';
  end if;
  select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;

  update inscriptions
     set mensualite = case when coalesce(p_exonere, false) then null else p_mensualite end,
         exonere = coalesce(p_exonere, false),
         motif_tarif = case when coalesce(p_exonere, false) then 'exonere'
                            when p_mensualite is null then null
                            else coalesce(p_motif, 'autre') end
   where eleve_id = p_eleve and annee_id = v_annee;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'L''élève n''est pas inscrit cette année.'; end if;
end $fn$;
revoke execute on function public.definir_tarif_eleve(uuid, numeric, text, boolean) from public, anon;
grant execute on function public.definir_tarif_eleve(uuid, numeric, text, boolean) to authenticated;


-- --- 8. Tarifs des élèves, pour la facturation en lot ----------------------
--  Sans cela, `genererFacturesEnLot` facturerait le plein tarif aux élèves à
--  tarif propre ou réduit par la fratrie, et facturerait les exonérés.
--  Rend, par élève : exonéré ou non, et le montant de SON frais de scolarité.
create or replace function public.tarifs_eleves(p_annee uuid, p_eleves uuid[])
returns table(eleve_id uuid, exonere boolean, frais_id uuid, montant numeric)
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
  select i.eleve_id, coalesce(t.exonere, i.exonere), t.frais_id, t.montant
    from inscriptions i
    left join lateral public._tarif_scolarite(i.eleve_id, p_annee) t on true
   where i.annee_id = p_annee and i.ecole_id = v_ecole and i.eleve_id = any(p_eleves);
end $fn$;
revoke execute on function public.tarifs_eleves(uuid, uuid[]) from public, anon;
grant execute on function public.tarifs_eleves(uuid, uuid[]) to authenticated;


-- --- 9. Le paiement d'avance suit le tarif de l'élève (corps de la 202) ----
--  Les mois À VENIR, non facturés, non réservés par une avance en attente.
--  Passer par l'échéancier donne d'un coup le tarif propre, la fratrie et
--  l'exonération (échéancier vide → rien à proposer).
create or replace function public._lignes_avance(p_eleve uuid)
returns table(mois text, libelle_mois text, frais_id uuid, libelle text, montant numeric)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_annee uuid;
begin
  select a.id into v_annee from annees_scolaires a join eleves e on e.ecole_id = a.ecole_id
   where e.id = p_eleve and a.courante limit 1;
  if v_annee is null then return; end if;

  return query
  select x.mois, public._libelle_mois(x.mois), x.frais_id, x.libelle, x.montant
    from public._echeancier(p_eleve, v_annee) x
   where x.recurrent and not x.facture
     and x.mois >= to_char(current_date, 'YYYY-MM')
     and not exists (
       select 1 from declarations_paiement d, jsonb_array_elements(d.avance_lignes) j
        where d.eleve_id = p_eleve and d.statut = 'en_attente' and j->>'libelle' = x.libelle)
   order by x.mois, x.libelle;
end $fn$;
revoke execute on function public._lignes_avance(uuid) from public, anon, authenticated;


-- --- 10. L'indicateur de la liste Élèves (corps de la 170) ----------------
create or replace function public.statut_paiement_classe(p_classe uuid, p_annee uuid)
returns table(eleve_id uuid, statut text, factures bigint, echues bigint)
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid;
begin
  select c.ecole_id into v_ecole from classes c where c.id = p_classe;
  if v_ecole is null then
    raise exception 'Classe introuvable.';
  end if;
  if not (est_super_admin() or (v_ecole = ecole_courante()
          and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))) then
    raise exception 'Accès refusé.';
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
revoke execute on function public.statut_paiement_classe(uuid, uuid) from public, anon;
grant execute on function public.statut_paiement_classe(uuid, uuid) to authenticated;


-- --- 11. La situation des paiements (corps de la 203) ---------------------
--  Changent : le STATUT (échéancier), l'ordre (en retard d'abord), et une
--  colonne `du` en dernière position — le montant DÛ d'après l'échéancier.
--  ⚠️ Sans elle, « Reste » (qui ne compte que les factures émises) dirait 0
--  pour un élève dont les mois dus ne sont pas facturés : c'est justement le
--  cas de Tut'Tank, où l'on ne facture que les mois payés.
--  Le type de retour change : `drop` puis `create`, droits remis à la fin.
drop function if exists public.situation_paiements(uuid, text, uuid);
create function public.situation_paiements(
  p_annee uuid, p_q text default null, p_classe uuid default null)
returns table(
  eleve_id uuid, prenom text, nom text, matricule text,
  classe_id uuid, classe text,
  statut text,                 -- en_retard | a_jour | en_avance | exonere | non_facture (mig. 210)
  total numeric,
  paye numeric,
  reste numeric,
  echu numeric,
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
    select insc.eleve_id, public._statut_paiement(insc.eleve_id, p_annee) as s,
           (select coalesce(sum(x.montant - x.paye), 0) from public._echeancier(insc.eleve_id, p_annee) x
             where x.etat in ('en_retard', 'partiel')) as du
      from insc
  )
  select e.id, e.prenom, e.nom, e.matricule, insc.classe_id, insc.classe,
         st.s,
         coalesce(f.total, 0), coalesce(f.paye, 0),
         greatest(coalesce(f.total, 0) - coalesce(f.paye, 0), 0),
         coalesce(f.echu, 0), coalesce(f.echues, 0),
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
            st.du desc, coalesce(f.echu, 0) desc, e.nom, e.prenom;
end $fn$;
revoke execute on function public.situation_paiements(uuid, text, uuid) from public, anon;
grant execute on function public.situation_paiements(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE (lecture seule)
--   select public._statut_paiement(eleve_id, annee_id), count(*)
--     from inscriptions where annee_id = '<année courante>' group by 1;
--   Puis supabase/tests/essai_210_echeancier.sql (tout est annulé).
--
--  ANNULATION
--   Réappliquer 170 (statut_paiement_classe), 202 (_lignes_avance),
--   203 (situation_paiements) ; puis :
--   drop function if exists public.tarifs_eleves(uuid, uuid[]);
--   drop function if exists public.definir_tarif_eleve(uuid, numeric, text, boolean);
--   drop function if exists public.fratrie_eleve(uuid);
--   drop function if exists public.enfant_echeancier(uuid);
--   drop function if exists public.eleve_echeancier(uuid);
--   drop function if exists public._echeancier_json(uuid, uuid);
--   drop function if exists public._statut_paiement(uuid, uuid);
--   drop function if exists public._echeancier(uuid, uuid);
--   drop function if exists public._tarif_scolarite(uuid, uuid);
--   drop function if exists public._frais_eleve(uuid, uuid, uuid, uuid);
--   drop function if exists public._fratrie(uuid, uuid);
--   drop trigger if exists trg_garder_tarif_inscription on inscriptions;
--   drop function if exists public._garder_tarif_inscription();
--   drop table if exists regles_fratrie;
--   (les colonnes d'`inscriptions` peuvent rester : NULL / false = sans effet)
-- =====================================================================
