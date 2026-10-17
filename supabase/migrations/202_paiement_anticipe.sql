-- =====================================================================
--  202 — Le paiement anticipé : payer un mois AVANT que l'école le facture
--
--  Demandé par le promoteur le 17/10/2026 : « un parent peut vouloir payer
--  le mois avant que la facture et la notification lui soient envoyées par
--  l'école à travers l'appli ». Décision prise avec lui : le parent CHOISIT
--  LES MOIS (le tarif mensuel de la classe est pré-rempli), il ne verse pas
--  un montant libre.
--
--  ⚠️ LA FACTURE NAÎT AU MOMENT OÙ L'ARGENT EST CONFIRMÉ, ET PAS AVANT.
--  Trois façons étaient possibles ; on a écarté les deux autres :
--   • un « crédit » sur le compte de l'élève, imputé plus tard : l'argent
--     entre en caisse le jour du versement, mais `paiements.facture_id` est
--     NON NUL et toute la chaîne — trésorerie (mig. 075, 154), écritures
--     (mig. 096), tableau de bord (mig. 137) — compte un encaissement par
--     ligne de `paiements`. Imputer le crédit par un paiement l'aurait compté
--     DEUX FOIS ; le tenir à part obligeait à retoucher six agrégats ;
--   • créer la facture dès que le parent déclare : une facture que l'école
--     n'a pas décidé d'émettre, qui deviendrait « en retard » si le parent
--     abandonne. Accusateur, et faux.
--  Retenu : la déclaration du parent ne porte AUCUNE facture, seulement les
--  lignes qu'il paie (tarif figé au moment où il paie). Quand la caisse
--  valide, la facture est créée, ses lignes posées et le paiement encaissé
--  dans la MÊME transaction. Elle naît réglée. Rien ne change pour la
--  comptabilité : c'est une facture et un paiement ordinaires.
--
--  ⚠️ ET LA FACTURATION EN LOT N'A RIEN À APPRENDRE. Elle saute déjà, par
--  élève, les libellés déjà facturés (« Scolarité — Novembre 2026 »). Les
--  lignes d'une avance portent EXACTEMENT ce libellé : le mois payé d'avance
--  est donc ignoré tout seul. Le seul ajout côté écran : un mois RÉSERVÉ par
--  une avance encore en attente est sauté lui aussi (src/lib/paiements.js).
--
--  ⚠️ LA NOTIFICATION « Nouvelle facture » N'EST PAS ENVOYÉE pour une avance.
--  Le parent recevrait « Facture F-2026-0142 · échéance 01/11 » pour un mois
--  qu'il vient de payer, et croirait devoir payer encore. Il reçoit à la
--  place « Paiement anticipé validé », qui nomme les mois et dit que la
--  facture est réglée.
--
--  Prérequis : 001, 038 (frais par cycle), 096, 188 (périmètre), 198, 201.
-- =====================================================================

-- --- 1. Les colonnes -------------------------------------------------

--  Une avance n'a pas encore de facture : elle n'existera qu'à la validation.
alter table public.declarations_paiement alter column facture_id drop not null;

--  Les lignes payées, tarif FIGÉ au moment du versement :
--  [{ "mois": "2026-11", "libelle_mois": "Novembre 2026",
--     "frais_id": "…", "libelle": "Scolarité — Novembre 2026", "montant": 35000 }]
--  Figé, parce que le parent a payé ce prix-là : si la grille change entre
--  sa déclaration et la validation, on ne lui réclame pas la différence.
alter table public.declarations_paiement add column if not exists avance_lignes jsonb;

comment on column public.declarations_paiement.avance_lignes is
  'Paiement anticipé (mig. 202) : les mois payés et leur tarif figé. facture_id est NULL tant que la caisse n''a pas validé ; la facture est créée à la validation.';

--  QUI a déclaré. Un élève a souvent deux parents qui paient chacun leur
--  part — le père un mois, la mère le suivant. Tout est déjà rattaché à
--  l'ÉLÈVE (un mois payé ou réservé par l'un disparaît pour l'autre, et les
--  totaux s'additionnent), mais rien ne disait QUEL parent avait payé : la
--  caisse validait sans savoir qui remercier ou rappeler, et le second
--  parent voyait un mois disparaître sans explication.
--  Défaut `auth.uid()` : `declarer_paiement` (mig. 198), non retouchée,
--  renseigne ainsi la colonne elle aussi. Les lignes existantes restent NULL.
alter table public.declarations_paiement
  add column if not exists declare_par uuid references profils(id) on delete set null default auth.uid();

--  Une déclaration porte SOIT une facture, SOIT des mois payés d'avance.
alter table public.declarations_paiement drop constraint if exists declarations_paiement_objet_chk;
alter table public.declarations_paiement add constraint declarations_paiement_objet_chk
  check (facture_id is not null or avance_lignes is not null);

--  Marque les factures nées d'un paiement anticipé : pour taire la
--  notification « Nouvelle facture », et pour que le responsable
--  pédagogique voie « payé d'avance jusqu'à décembre » (mig. 203).
alter table public.factures add column if not exists avance boolean not null default false;

-- --- 2. Le libellé du mois, À L'IDENTIQUE du front --------------------
--
--  ⚠️ DOIT RENDRE EXACTEMENT ce que rend `libelleMois()` (src/lib/paiements.js) :
--  « Novembre 2026 », majuscule initiale, accents compris. C'est sur ce texte
--  que la facturation en lot dédoublonne : un « novembre 2026 » ici, et le
--  mois payé d'avance serait facturé une seconde fois.
create or replace function public._libelle_mois(p_mois text)
returns text language sql immutable set search_path = public as $fn$
  select case when p_mois ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    (array['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août',
           'Septembre','Octobre','Novembre','Décembre'])[substr(p_mois, 6, 2)::int]
    || ' ' || substr(p_mois, 1, 4)
  end;
$fn$;

-- --- 3. Ce qu'on peut payer d'avance (moteur interne) -----------------
--
--  Les mois de l'année scolaire COURANTE, du mois en cours au dernier, et
--  pour chacun les frais MENSUELS OBLIGATOIRES de la classe de l'élève.
--
--  ⚠️ LE FRAIS LE PLUS PRÉCIS L'EMPORTE, à libellé égal. La mig. 038 permet
--  une « Scolarité » pour tout le cycle ET une « Scolarité » propre à la
--  classe d'examen. Les deux s'appliqueraient : le parent paierait deux fois
--  la scolarité. Niveau > cycle > école.
--
--  Un mois disparaît de la liste dès qu'il est facturé (facture non annulée)
--  OU réservé par une avance en attente de validation — sinon deux tuteurs
--  du même enfant pourraient payer le même mois.
create or replace function public._lignes_avance(p_eleve uuid)
returns table(mois text, libelle_mois text, frais_id uuid, libelle text, montant numeric)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_ecole uuid; v_annee record; v_classe uuid; v_niveau uuid; v_cycle uuid;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then return; end if;

  select a.id, a.date_debut, a.date_fin into v_annee
    from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;
  if v_annee.id is null then return; end if;

  select i.classe_id, c.niveau_id, n.cycle_id into v_classe, v_niveau, v_cycle
    from inscriptions i
    join classes c on c.id = i.classe_id
    left join niveaux n on n.id = c.niveau_id
   where i.eleve_id = p_eleve and i.annee_id = v_annee.id
     --  ⚠️ Les valeurs RÉELLES de l'enum `statut_inscription`, relevées en
     --  base. `getInscritsAvecNiveau` filtre « radie »/« parti », qui
     --  n'existent pas : un élève exclu y reste facturable.
     and i.statut::text not in ('abandon', 'exclu', 'transfere')
   limit 1;
  --  Pas inscrit cette année : aucun tarif ne s'applique, rien à proposer.
  if v_classe is null then return; end if;

  return query
  with m as (
    select to_char(g, 'YYYY-MM') as mois
      from generate_series(date_trunc('month', greatest(current_date, v_annee.date_debut)),
                           date_trunc('month', v_annee.date_fin),
                           interval '1 month') g
  ), fr as (
    select distinct on (lower(trim(f.libelle))) f.id, f.libelle, f.montant
      from frais f
     where f.ecole_id = v_ecole and f.recurrent and f.obligatoire
       and (f.annee_id = v_annee.id or f.annee_id is null)
       and ((f.niveau_id is null and f.cycle_id is null)
            or f.niveau_id = v_niveau
            or (f.cycle_id is not null and f.cycle_id = v_cycle))
     order by lower(trim(f.libelle)),
              (f.niveau_id is not null) desc, (f.cycle_id is not null) desc,
              (f.annee_id is not null) desc, f.created_at desc
  ), l as (
    --  ⚠️ « — » est un TIRET CADRATIN, comme dans `genererFacturesEnLot`.
    select m.mois, _libelle_mois(m.mois) as lm, fr.id as fid,
           fr.libelle || ' — ' || _libelle_mois(m.mois) as lib, fr.montant as mt
      from m cross join fr
  )
  select l.mois, l.lm, l.fid, l.lib, l.mt
    from l
   where l.mt > 0
     and not exists (
       select 1 from facture_lignes fl join factures f on f.id = fl.facture_id
        where f.eleve_id = p_eleve and f.statut <> 'annulee' and fl.libelle = l.lib)
     and not exists (
       select 1 from declarations_paiement d, jsonb_array_elements(d.avance_lignes) x
        where d.eleve_id = p_eleve and d.statut = 'en_attente' and x->>'libelle' = l.lib)
   order by l.mois, l.lib;
end $fn$;

--  Interne : appelé par les fonctions ci-dessous, qui vérifient les droits.
revoke execute on function public._lignes_avance(uuid) from public, anon, authenticated;

-- --- 4. Qui peut voir et payer pour cet élève -------------------------
--
--  Le parent (tuteur lié), l'étudiant majeur pour lui-même, et la caisse de
--  l'école — dans son périmètre de cycle (mig. 188).
create or replace function public._peut_payer_pour(p_eleve uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_eleve is not null and (
    public._parent_possede(p_eleve)
    or public._eleve_courant() = p_eleve
    or exists (
      select 1 from eleves e
       where e.id = p_eleve
         and (public.est_super_admin()
              or (e.ecole_id = public.ecole_courante()
                  and public.a_acces('encaissement')
                  and public.peut_voir_eleve(p_eleve))))
  );
$fn$;
revoke execute on function public._peut_payer_pour(uuid) from public, anon, authenticated;

-- --- 5. Les mois proposés (parent, étudiant, caisse) ------------------
create or replace function public.avance_options(p_eleve uuid)
returns table(mois text, libelle_mois text, frais_id uuid, libelle text, montant numeric)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not public._peut_payer_pour(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query select * from public._lignes_avance(p_eleve);
end $fn$;
revoke execute on function public.avance_options(uuid) from public, anon;
grant execute on function public.avance_options(uuid) to authenticated;

--  Les lignes de ces mois, ou une erreur qui dit lequel n'est plus libre.
--  ⚠️ Le PRIX vient de la base, jamais de l'appelant : le parent choisit des
--  mois, pas un montant.
create or replace function public._lignes_des_mois(p_eleve uuid, p_mois text[])
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_lignes jsonb; v_manque text;
begin
  if coalesce(cardinality(p_mois), 0) = 0 then
    raise exception 'Choisissez au moins un mois.';
  end if;

  select _libelle_mois(x) into v_manque
    from unnest(p_mois) x
   where not exists (select 1 from public._lignes_avance(p_eleve) l where l.mois = x)
   limit 1;
  if found then
    raise exception '% n''est plus disponible : ce mois a déjà été facturé, ou un paiement anticipé est déjà en attente de validation.',
      coalesce(v_manque, 'Ce mois');
  end if;

  select jsonb_agg(jsonb_build_object(
           'mois', l.mois, 'libelle_mois', l.libelle_mois, 'frais_id', l.frais_id,
           'libelle', l.libelle, 'montant', l.montant) order by l.mois, l.libelle)
    into v_lignes
    from public._lignes_avance(p_eleve) l
   where l.mois = any(p_mois);
  return v_lignes;
end $fn$;
revoke execute on function public._lignes_des_mois(uuid, text[]) from public, anon, authenticated;

-- --- 6. Le parent (ou l'étudiant) déclare son paiement anticipé -------
--
--  Mêmes exigences que `_verifier_declaration` (mig. 198) : une preuve est
--  obligatoire. Le doublon est empêché par construction : un mois réservé
--  par une avance en attente n'est plus proposé.
create or replace function public.declarer_avance(
  p_eleve uuid, p_mois text[], p_mode text, p_reference text, p_preuve text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_lignes jsonb; v_total numeric;
begin
  if not (public._parent_possede(p_eleve) or public._eleve_courant() = p_eleve) then
    raise exception 'Accès refusé.';
  end if;
  if coalesce(trim(p_preuve), '') = '' then
    raise exception 'Joignez la capture ou la photo de votre paiement : sans preuve, l''école ne peut pas le vérifier.';
  end if;

  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  v_lignes := public._lignes_des_mois(p_eleve, p_mois);
  select sum((x->>'montant')::numeric) into v_total from jsonb_array_elements(v_lignes) x;
  if coalesce(v_total, 0) <= 0 then raise exception 'Montant invalide.'; end if;

  insert into declarations_paiement
    (ecole_id, facture_id, eleve_id, montant, mode, reference_tx, preuve_chemin, avance_lignes, declare_par)
  values
    (v_ecole, null, p_eleve, v_total, p_mode::mode_paiement, p_reference, p_preuve, v_lignes, auth.uid());
end $fn$;
revoke execute on function public.declarer_avance(uuid, text[], text, text, text) from public, anon;
grant execute on function public.declarer_avance(uuid, text[], text, text, text) to authenticated;

-- --- 7. Créer la facture réglée (moteur interne) ----------------------
--
--  Facture + lignes + paiement dans la MÊME transaction : si l'une échoue,
--  rien n'est écrit. L'échéance est le 1er du premier mois payé.
create or replace function public._creer_facture_avance(
  p_eleve uuid, p_lignes jsonb, p_mode mode_paiement, p_reference text, p_compte uuid)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_annee uuid; v_total numeric; v_premier text; v_mois text;
        v_deja record; v_fac uuid; v_numero text;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;

  --  ⚠️ L'ÉCOLE A PU FACTURER CE MOIS ENTRE-TEMPS (une facture saisie à la
  --  main, que la réservation côté lot ne couvre pas). Encaisser quand même
  --  ferait payer le mois deux fois. On s'arrête et on dit quoi faire.
  select fl.libelle, f.numero into v_deja
    from jsonb_array_elements(p_lignes) x
    join facture_lignes fl on fl.libelle = x->>'libelle'
    join factures f on f.id = fl.facture_id
   where f.eleve_id = p_eleve and f.statut <> 'annulee'
   limit 1;
  if found then
    raise exception '« % » a déjà été facturé (facture %). Rejetez ce paiement anticipé avec ce motif : le parent réglera cette facture.',
      v_deja.libelle, coalesce(v_deja.numero, 'sans numéro');
  end if;

  select sum((x->>'montant')::numeric), min(x->>'mois') into v_total, v_premier
    from jsonb_array_elements(p_lignes) x;
  select string_agg(s.lm, ', ' order by s.m) into v_mois
    from (select distinct x->>'mois' as m, x->>'libelle_mois' as lm
            from jsonb_array_elements(p_lignes) x) s;

  insert into factures (ecole_id, eleve_id, annee_id, date_echeance, montant_total, statut, avance, notes)
  values (v_ecole, p_eleve, v_annee, (v_premier || '-01')::date, v_total, 'emise', true,
          'Paiement anticipé : ' || v_mois)
  returning id, numero into v_fac, v_numero;

  insert into facture_lignes (ecole_id, facture_id, frais_id, libelle, quantite, prix_unitaire, montant)
  select v_ecole, v_fac, nullif(x->>'frais_id', '')::uuid, x->>'libelle', 1,
         (x->>'montant')::numeric, (x->>'montant')::numeric
    from jsonb_array_elements(p_lignes) x;

  --  Le déclencheur `recalc_facture` passe la facture à « payée ».
  insert into paiements (ecole_id, facture_id, montant, mode, reference, compte_id, encaisse_par)
  values (v_ecole, v_fac, v_total, p_mode, p_reference, p_compte, auth.uid());

  perform public._notifier_parents(p_eleve, v_ecole,
    'Paiement anticipé validé',
    format('Votre paiement de %s pour %s est validé. La facture %s est émise et déjà réglée : vous n''avez rien d''autre à payer pour ce(s) mois.',
           trunc(v_total), v_mois, coalesce(v_numero, '')),
    'facture');
  perform public._notifier_etudiant(p_eleve,
    'Paiement anticipé validé',
    format('Votre paiement de %s pour %s est validé (facture %s, réglée).',
           trunc(v_total), v_mois, coalesce(v_numero, '')));
  return v_fac;
end $fn$;
revoke execute on function public._creer_facture_avance(uuid, jsonb, mode_paiement, text, uuid)
  from public, anon, authenticated;

-- --- 8. La caisse valide (avance OU paiement de facture) --------------
--
--  Reprend À L'IDENTIQUE la version de la mig. 198 pour une déclaration sur
--  facture ; ajoute seulement la branche « avance ».
create or replace function public.valider_declaration(p_decl uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare d record; v_reste numeric; v_fac uuid;
begin
  select * into d from declarations_paiement where id = p_decl;
  if d is null then raise exception 'Déclaration introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (a_acces('encaissement')) then raise exception 'Réservé à la comptabilité.'; end if;
  if d.statut <> 'en_attente' then raise exception 'Déclaration déjà traitée.'; end if;
  if coalesce(trim(d.preuve_chemin), '') = '' then
    raise exception 'Cette déclaration ne porte aucune preuve : refusez-la et demandez la capture du paiement.';
  end if;

  --  Paiement anticipé : la facture naît ici, déjà réglée.
  if d.facture_id is null then
    if d.avance_lignes is null then raise exception 'Déclaration sans objet.'; end if;
    v_fac := public._creer_facture_avance(d.eleve_id, d.avance_lignes, d.mode, d.reference_tx, null);
    update declarations_paiement
       set statut = 'valide', facture_id = v_fac, validee_par = auth.uid(), validee_le = now()
     where id = p_decl;
    return;
  end if;

  select greatest(coalesce(f.montant_total, 0) - coalesce(f.montant_paye, 0), 0)
    into v_reste from factures f where f.id = d.facture_id;
  if d.montant > v_reste then
    raise exception 'Le montant déclaré (%) dépasse le reste dû (%).', trunc(d.montant), trunc(v_reste);
  end if;

  insert into paiements (ecole_id, facture_id, montant, mode, reference, encaisse_par)
  values (d.ecole_id, d.facture_id, d.montant, d.mode, d.reference_tx, auth.uid());

  update declarations_paiement set statut = 'valide', validee_par = auth.uid(), validee_le = now() where id = p_decl;
end $fn$;

-- --- 9. La caisse encaisse une avance au guichet ----------------------
--
--  Le parent paie en espèces au secrétariat pour les mois à venir : même
--  moteur, sans déclaration ni preuve (la caisse a l'argent en main).
create or replace function public.encaisser_avance(
  p_eleve uuid, p_mois text[], p_mode text, p_reference text, p_compte uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then raise exception 'Élève introuvable.'; end if;
  if not (est_super_admin() or (v_ecole = ecole_courante() and a_acces('encaissement'))) then
    raise exception 'Réservé à la caisse.';
  end if;
  if not peut_voir_eleve(p_eleve) then raise exception 'Cet élève est hors de votre périmètre.'; end if;
  return public._creer_facture_avance(
    p_eleve, public._lignes_des_mois(p_eleve, p_mois), p_mode::mode_paiement, p_reference, p_compte);
end $fn$;
revoke execute on function public.encaisser_avance(uuid, text[], text, text, uuid) from public, anon;
grant execute on function public.encaisser_avance(uuid, text[], text, text, uuid) to authenticated;

-- --- 10. Taire « Nouvelle facture » pour une avance -------------------
--  Corps repris de la base de production, plus la seule ligne `if new.avance`.
create or replace function public.trg_notif_facture()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  --  Le parent reçoit « Paiement anticipé validé » à la place (§ 7).
  if new.avance then return null; end if;
  perform public._notifier_parents(new.eleve_id, new.ecole_id, 'Nouvelle facture',
    'Facture ' || coalesce(new.numero, '') ||
    case when new.date_echeance is not null then ' · échéance ' || to_char(new.date_echeance, 'DD/MM/YYYY') else '' end,
    'facture');
  return null;
end $fn$;

create or replace function public.trg_facture_notif_etudiant()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.avance then return null; end if;
  perform _notifier_etudiant(new.eleve_id, 'Nouvelle facture',
    'Une facture de ' || to_char(coalesce(new.montant_total, 0), 'FM999G999G999') ||
    ' vient d''être émise.');
  return null;
end $fn$;

-- --- 11. Le parent voit ses avances dans « Mes déclarations » ---------
--
--  ⚠️ `drop` nécessaire : ajouter une colonne à un `returns table` change le
--  type de retour (même leçon qu'à la mig. 201).
--
--  ⚠️ ET IL VOIT QUI A DÉCLARÉ. Les deux parents d'un même enfant lisent la
--  même liste : sans le nom, le second parent voit « Avance Novembre » et
--  ne sait pas si c'est la sienne. `declarant` vaut « Vous » pour ses
--  propres déclarations, sinon le prénom et le nom de l'autre tuteur lié à
--  CET élève — jamais une personne étrangère à l'enfant.
drop function if exists public.enfant_declarations(uuid);
create function public.enfant_declarations(p_eleve uuid)
returns table(id uuid, numero text, montant numeric, statut text,
              motif text, created_at timestamptz, avance text, declarant text)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select dp.id, f.numero, dp.montant, dp.statut::text, dp.motif, dp.created_at,
           (select string_agg(s.lm, ', ' order by s.m)
              from (select distinct x->>'mois' as m, x->>'libelle_mois' as lm
                      from jsonb_array_elements(dp.avance_lignes) x) s),
           case when dp.declare_par is null then null
                when dp.declare_par = auth.uid() then 'Vous'
                else coalesce((
                  select trim(coalesce(t.prenom, '') || ' ' || coalesce(t.nom, ''))
                    from eleve_tuteurs et join tuteurs t on t.id = et.tuteur_id
                   where et.eleve_id = p_eleve and t.profil_id = dp.declare_par
                   limit 1), 'Un autre responsable')
           end
      from declarations_paiement dp
      left join factures f on f.id = dp.facture_id
     where dp.eleve_id = p_eleve
     order by dp.created_at desc;
end $fn$;
revoke execute on function public.enfant_declarations(uuid) from public, anon;
grant execute on function public.enfant_declarations(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • parent lié → `avance_options` rend les mois restants de l'année, avec
--     le tarif mensuel obligatoire de la classe (niveau > cycle > école) ;
--   • 🔴 parent d'un AUTRE élève, enseignant, anonyme → « Accès refusé » ;
--   • `declarer_avance` sans preuve → refusé ; mois déjà facturé ou déjà
--     réservé → refusé en nommant le mois ;
--   • deux déclarations sur le même mois → la seconde est refusée, même
--     venant de l'AUTRE parent (tout est rattaché à l'élève) ;
--   • parent 1 paie novembre, parent 2 décembre → deux factures réglées,
--     totaux additionnés pour l'élève ; chacun voit « Vous » ou le nom de
--     l'autre dans « Mes déclarations », la caisse voit le nom du déclarant ;
--   • validation → une facture `avance = true`, statut « payée », un paiement
--     du même montant ; le parent reçoit « Paiement anticipé validé » et PAS
--     « Nouvelle facture » ;
--   • facturation en lot du mois payé → l'élève est ignoré (même libellé) ;
--   • mois facturé à la main entre déclaration et validation → la validation
--     refuse et dit de rejeter ; aucun double paiement ;
--   • une déclaration sur facture (le cas d'avant) se valide comme avant.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.encaisser_avance(uuid, text[], text, text, uuid);
-- drop function if exists public.declarer_avance(uuid, text[], text, text, text);
-- drop function if exists public.avance_options(uuid);
-- drop function if exists public._creer_facture_avance(uuid, jsonb, mode_paiement, text, uuid);
-- drop function if exists public._lignes_des_mois(uuid, text[]);
-- drop function if exists public._lignes_avance(uuid);
-- drop function if exists public._peut_payer_pour(uuid);
-- drop function if exists public._libelle_mois(text);
-- -- restaurer `valider_declaration` (mig. 198), `enfant_declarations` (mig. 201)
-- -- et les deux déclencheurs de notification (sans la ligne `if new.avance`).
-- -- ⚠️ Avant de remettre `facture_id` NON NUL, traiter les avances en attente :
-- -- delete from declarations_paiement where facture_id is null and statut <> 'valide';
-- alter table public.declarations_paiement drop constraint if exists declarations_paiement_objet_chk;
-- alter table public.declarations_paiement alter column facture_id set not null;
-- alter table public.declarations_paiement drop column if exists avance_lignes;
-- alter table public.declarations_paiement drop column if exists declare_par;
-- alter table public.factures drop column if exists avance;
-- notify pgrst, 'reload schema';
