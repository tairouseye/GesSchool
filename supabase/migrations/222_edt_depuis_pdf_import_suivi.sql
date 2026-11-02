-- =====================================================================
--  222 — Emploi du temps lu dans un PDF + import du fichier de suivi des mensualités
--
--  LE BESOIN (Mme Kane, Tut'Tank, 02/11/2026) :
--   1. charger l'emploi du temps d'une classe depuis son PDF : l'appli en
--      lit la grille (dans le navigateur), l'école la valide, et elle
--      remplace l'emploi du temps de la classe ;
--   2. charger SON fichier Excel « Suivi des mensualités » : l'appli montre
--      les écarts, et enregistre les paiements qu'elle coche.
--
--  1. Le PDF N'EST PAS CONSERVÉ (décision du promoteur, 02/11) : il ne sert
--     qu'à remplir la grille, qui reste LE SEUL emploi du temps en
--     circulation. Charger un PDF REMPLACE la semaine de la classe ; les
--     parents voient la grille, jamais un fichier qui pourrait être périmé.
--     `remplacer_emploi_classe` fait ce remplacement en une transaction.
--
--  2. `encaisser_mois_suivi` enregistre un paiement sur UN mois (ou sur
--     l'inscription, p_mois null) : il règle la facture existante de ce mois
--     s'il y en a une, sinon il la crée. LE MONTANT VIENT DU FICHIER mais ne
--     peut pas dépasser ce qui reste dû sur le mois : un fichier faux ne fait
--     jamais payer deux fois.
--     ⚠️ Aucune notification aux parents : c'est un rattrapage de saisie, des
--     paiements déjà faits au guichet. Cent messages d'un coup seraient du bruit.
-- =====================================================================

-- --- 1. L'emploi du temps lu dans un PDF ------------------------------------
--  Remplace TOUS les créneaux d'une classe par ceux lus dans le PDF, en une
--  transaction : une erreur au 30e créneau ne laisse pas une semaine à moitié
--  effacée. p_creneaux = [{jour, heure_debut, heure_fin, matiere_id,
--  enseignant_id, activite, salle}, …]
create or replace function public.remplacer_emploi_classe(p_classe uuid, p_creneaux jsonb)
returns int
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_n int;
begin
  select c.ecole_id into v_ecole from classes c where c.id = p_classe;
  if v_ecole is null then raise exception 'Classe introuvable.'; end if;
  if not (est_super_admin() or (v_ecole = ecole_courante() and a_acces('emploi'))) then
    raise exception 'Accès refusé.';
  end if;
  if jsonb_typeof(p_creneaux) <> 'array' or jsonb_array_length(p_creneaux) = 0 then
    raise exception 'Aucun créneau à enregistrer.';
  end if;
  --  Une matière ou un enseignant d'une autre école serait une fuite : refusé.
  if exists (select 1 from jsonb_array_elements(p_creneaux) x
              where (nullif(x->>'matiere_id', '') is not null and not exists (
                       select 1 from matieres m where m.id = (x->>'matiere_id')::uuid and m.ecole_id = v_ecole))
                 or (nullif(x->>'enseignant_id', '') is not null and not exists (
                       select 1 from enseignants e where e.id = (x->>'enseignant_id')::uuid and e.ecole_id = v_ecole))) then
    raise exception 'Matière ou enseignant inconnu dans cette école.';
  end if;

  delete from emplois_du_temps where classe_id = p_classe;
  insert into emplois_du_temps (ecole_id, classe_id, jour, heure_debut, heure_fin, matiere_id, enseignant_id, activite, salle)
  select v_ecole, p_classe, (x->>'jour')::int, (x->>'heure_debut')::time, (x->>'heure_fin')::time,
         nullif(x->>'matiere_id', '')::uuid, nullif(x->>'enseignant_id', '')::uuid,
         nullif(trim(x->>'activite'), ''), nullif(trim(x->>'salle'), '')
    from jsonb_array_elements(p_creneaux) x;
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;
revoke execute on function public.remplacer_emploi_classe(uuid, jsonb) from public, anon;
grant execute on function public.remplacer_emploi_classe(uuid, jsonb) to authenticated;

-- --- 2. Encaisser un mois depuis le fichier de suivi -------------------------
create or replace function public.encaisser_mois_suivi(
  p_eleve uuid, p_mois text, p_montant numeric,
  p_mode text default 'especes', p_reference text default null, p_date date default null)
returns numeric
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid; v_annee uuid; v_reste numeric := p_montant; v_l record; v_f record;
        v_du numeric; v_part numeric; v_fac uuid; v_total numeric := 0;
begin
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  if v_ecole is null then raise exception 'Élève introuvable.'; end if;
  if not (est_super_admin() or (v_ecole = ecole_courante() and a_acces('encaissement'))) then
    raise exception 'Réservé à la caisse.';
  end if;
  if not peut_voir_eleve(p_eleve) then raise exception 'Cet élève est hors de votre périmètre.'; end if;
  if coalesce(p_montant, 0) <= 0 then raise exception 'Montant invalide.'; end if;
  select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante limit 1;
  if v_annee is null then raise exception 'Aucune année scolaire en cours.'; end if;

  --  Les lignes de l'échéancier visées : celles du mois, ou l'inscription.
  for v_l in
    select * from public._echeancier(p_eleve, v_annee) x
     where (p_mois is null and not x.recurrent) or (x.recurrent and x.mois = p_mois)
     order by x.libelle
  loop
    exit when v_reste <= 0;
    --  La facture de cette ligne, si elle existe et n'est pas soldée.
    select fa.id, fl.montant as mt_ligne, fa.montant_total, fa.montant_paye into v_f
      from facture_lignes fl join factures fa on fa.id = fl.facture_id
     where fa.eleve_id = p_eleve and fa.ecole_id = v_ecole and fl.libelle = v_l.libelle
       and fa.statut not in ('annulee', 'brouillon')
       and (fa.annee_id = v_annee or fa.annee_id is null)
       and fa.montant_paye < fa.montant_total
     order by fa.date_emission limit 1;

    if found then
      --  Reste dû sur CETTE ligne (sa part du payé de la facture déduite).
      v_du := least(v_f.montant_total - v_f.montant_paye,
                    v_f.mt_ligne - case when v_f.montant_total > 0
                                        then v_f.montant_paye * v_f.mt_ligne / v_f.montant_total else 0 end);
      v_fac := v_f.id;
    elsif not v_l.facture then
      --  Pas encore facturée : la facture naît ici, comme une avance au guichet.
      insert into factures (ecole_id, eleve_id, annee_id, date_echeance, montant_total, statut, notes)
      values (v_ecole, p_eleve, v_annee, v_l.echeance, v_l.montant, 'emise',
              'Saisie depuis le fichier de suivi des mensualités')
      returning id into v_fac;
      insert into facture_lignes (ecole_id, facture_id, frais_id, libelle, quantite, prix_unitaire, montant)
      values (v_ecole, v_fac, v_l.frais_id, v_l.libelle, 1, v_l.montant, v_l.montant);
      v_du := v_l.montant;
    else
      continue;  -- déjà facturée et soldée
    end if;

    v_part := round(least(v_reste, v_du));
    if v_part > 0 then
      insert into paiements (ecole_id, facture_id, montant, mode, reference, date_paiement, encaisse_par)
      values (v_ecole, v_fac, v_part, p_mode::mode_paiement,
              coalesce(nullif(trim(p_reference), ''), 'Fichier de suivi'),
              coalesce(p_date, current_date), auth.uid());
      v_reste := v_reste - v_part;
      v_total := v_total + v_part;
    end if;
  end loop;

  if v_total = 0 then
    raise exception 'Rien à encaisser : % est déjà réglé dans l''appli.',
      coalesce(public._libelle_mois(p_mois), 'l''inscription');
  end if;
  return v_total;
end $fn$;
revoke execute on function public.encaisser_mois_suivi(uuid, text, numeric, text, text, date) from public, anon;
grant execute on function public.encaisser_mois_suivi(uuid, text, numeric, text, text, date) to authenticated;

-- --- Retour arrière ------------------------------------------------------------
-- drop function if exists public.encaisser_mois_suivi(uuid, text, numeric, text, text, date);
-- drop function if exists public.remplacer_emploi_classe(uuid, jsonb);
