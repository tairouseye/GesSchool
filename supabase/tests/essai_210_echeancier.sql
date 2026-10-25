-- =====================================================================
--  ESSAI — échéancier, statut en couleur, tarif propre, fratrie,
--          exonération (migration 210)
--
--  Prérequis : 210 appliquée sur cette base.
--  Coller TOUT le fichier dans l'éditeur SQL (sans rien surligner), lancer.
--  Verdict : UNE LIGNE (colonne `resultat`) qui commence par « OK »,
--  « ÉCHEC » ou « IMPOSSIBLE ».
--
--  Aucune donnée n'est conservée : tout se passe dans un bloc annulé à la
--  fin (sous-transaction). Le décor est FICTIF — une année scolaire
--  « ESSAI-210 » non courante, un niveau, une classe, deux frais, cinq
--  élèves et un parent — créé dans une école existante, puis annulé.
--
--  L'année d'essai commence deux mois avant le mois en cours et dure neuf
--  mois : le verdict ne dépend pas de la date du jour.
-- =====================================================================
drop table if exists pg_temp.essai_210_resultat;
create temp table essai_210_resultat (resultat text);

do $essai$
declare
  v_ecole uuid; v_cycle uuid; v_annee uuid; v_niveau uuid; v_classe uuid;
  v_insc uuid; v_scol uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; v_tut uuid; v_fac uuid;
  m0 date := date_trunc('month', current_date)::date;   -- mois en cours
  v_mois text; v_lib text;
  v_err text := '';
  v_resultat text;
  v_s text; v_n int; v_mt numeric;
  v_parent uuid;
begin
  begin
    -- --- Décor -----------------------------------------------------------
    select n.ecole_id, n.cycle_id into v_ecole, v_cycle from niveaux n limit 1;
    if v_ecole is null then
      v_resultat := 'IMPOSSIBLE — aucune école avec un cycle dans cette base.';
      raise exception 'ESSAI_FIN';
    end if;

    insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante)
    values (v_ecole, 'ESSAI-210', (m0 - interval '2 months')::date, (m0 + interval '7 months' - interval '1 day')::date, false)
    returning id into v_annee;
    insert into niveaux (ecole_id, cycle_id, libelle) values (v_ecole, v_cycle, 'ESSAI-210') returning id into v_niveau;
    insert into classes (ecole_id, niveau_id, annee_id, libelle) values (v_ecole, v_niveau, v_annee, 'ESSAI-210') returning id into v_classe;
    insert into frais (ecole_id, annee_id, niveau_id, libelle, montant, recurrent, obligatoire)
    values (v_ecole, v_annee, v_niveau, 'Inscription ESSAI', 10000, false, true);
    insert into frais (ecole_id, annee_id, niveau_id, libelle, montant, recurrent, obligatoire)
    values (v_ecole, v_annee, v_niveau, 'Scolarité ESSAI', 50000, true, true) returning id into v_scol;

    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Un', 'ESSAI210') returning id into e1;
    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Deux', 'ESSAI210') returning id into e2;
    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Trois', 'ESSAI210') returning id into e3;
    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Quatre', 'ESSAI210') returning id into e4;
    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Cinq', 'ESSAI210') returning id into e5;
    insert into inscriptions (ecole_id, eleve_id, classe_id, annee_id)
    select v_ecole, x, v_classe, v_annee from unnest(array[e1, e2, e3, e4, e5]) x;

    -- --- 1. Rien de payé : 1 inscription + 9 mois, les passés en retard ---
    select count(*) into v_n from public._echeancier(e1, v_annee);
    if v_n <> 10 then v_err := v_err || format(' | 1. %s lignes au lieu de 10', v_n); end if;
    if public._statut_paiement(e1, v_annee) <> 'en_retard' then
      v_err := v_err || ' | 1. sans paiement, le statut n''est pas en_retard';
    end if;
    --  Le mois en cours : en retard à partir du 6, à venir avant.
    select x.etat into v_s from public._echeancier(e1, v_annee) x where x.mois = to_char(m0, 'YYYY-MM') and x.recurrent;
    --  ⚠️ Le `case` entre parenthèses : sans elles, PL/pgSQL coupe la
    --  condition du `if` au premier `then`, celui du `case`.
    if v_s <> (case when extract(day from current_date) > 5 then 'en_retard' else 'a_venir' end) then
      v_err := v_err || format(' | 1. mois en cours : %s (le jour %s)', v_s, extract(day from current_date));
    end if;

    -- --- 2. Tout ce qui est échu payé → à jour ; un mois futur → en avance -
    --  Facture réglée = une facture + un paiement du même montant.
    for v_lib, v_mt in
      select x.libelle, x.montant from public._echeancier(e1, v_annee) x
       where x.mois is null or x.mois <= to_char(m0, 'YYYY-MM')
    loop
      insert into factures (ecole_id, eleve_id, annee_id, montant_total) values (v_ecole, e1, v_annee, v_mt) returning id into v_fac;
      insert into facture_lignes (ecole_id, facture_id, libelle, quantite, prix_unitaire, montant)
      values (v_ecole, v_fac, v_lib, 1, v_mt, v_mt);
      insert into paiements (ecole_id, facture_id, montant) values (v_ecole, v_fac, v_mt);
    end loop;
    v_s := public._statut_paiement(e1, v_annee);
    if v_s <> 'a_jour' then v_err := v_err || format(' | 2. tout l''échu payé : %s au lieu de a_jour', v_s); end if;

    v_mois := to_char(m0 + interval '1 month', 'YYYY-MM');
    select x.libelle into v_lib from public._echeancier(e1, v_annee) x where x.mois = v_mois and x.recurrent;
    insert into factures (ecole_id, eleve_id, annee_id, montant_total, avance) values (v_ecole, e1, v_annee, 50000, true) returning id into v_fac;
    insert into facture_lignes (ecole_id, facture_id, libelle, quantite, prix_unitaire, montant)
    values (v_ecole, v_fac, v_lib, 1, 50000, 50000);
    insert into paiements (ecole_id, facture_id, montant) values (v_ecole, v_fac, 50000);
    v_s := public._statut_paiement(e1, v_annee);
    if v_s <> 'en_avance' then v_err := v_err || format(' | 2. mois suivant payé : %s au lieu de en_avance', v_s); end if;

    -- --- 3. Facture ANNULÉE : ne règle rien --------------------------------
    select x.libelle into v_lib from public._echeancier(e2, v_annee) x
     where x.mois = to_char(m0 - interval '2 months', 'YYYY-MM') and x.recurrent;
    insert into factures (ecole_id, eleve_id, annee_id, montant_total, statut) values (v_ecole, e2, v_annee, 50000, 'annulee') returning id into v_fac;
    insert into facture_lignes (ecole_id, facture_id, libelle, quantite, prix_unitaire, montant)
    values (v_ecole, v_fac, v_lib, 1, 50000, 50000);
    select x.etat into v_s from public._echeancier(e2, v_annee) x where x.libelle = v_lib;
    if v_s <> 'en_retard' then v_err := v_err || format(' | 3. mois d''une facture annulée : %s au lieu de en_retard', v_s); end if;

    -- --- 4. Tarif propre : 30 000 au lieu de 50 000 -------------------------
    update inscriptions set mensualite = 30000, motif_tarif = 'autre' where eleve_id = e2 and annee_id = v_annee;
    select x.montant into v_mt from public._echeancier(e2, v_annee) x
     where x.recurrent and not x.facture limit 1;
    if v_mt <> 30000 then v_err := v_err || format(' | 4. tarif propre : %s au lieu de 30000', v_mt); end if;

    -- --- 5. Exonéré : rien dû, statut exonere --------------------------------
    update inscriptions set exonere = true, motif_tarif = 'exonere' where eleve_id = e3 and annee_id = v_annee;
    select count(*) into v_n from public._echeancier(e3, v_annee);
    if v_n <> 0 then v_err := v_err || format(' | 5. exonéré : %s lignes dues', v_n); end if;
    if public._statut_paiement(e3, v_annee) <> 'exonere' then v_err := v_err || ' | 5. statut exonéré absent'; end if;
    if not (select t.exonere from public._tarif_scolarite(e3, v_annee) t) then
      v_err := v_err || ' | 5. la facturation en lot ne verrait pas l''exonération';
    end if;

    -- --- 6. Fratrie : 2 enfants, règle 10 % → 45 000 ; tarif propre prime ----
    insert into tuteurs (ecole_id, prenom, nom, telephone) values (v_ecole, 'Parent', 'ESSAI210', '00 000 00 00') returning id into v_tut;
    insert into eleve_tuteurs (ecole_id, eleve_id, tuteur_id, lien_parente) values (v_ecole, e4, v_tut, 'père'), (v_ecole, e5, v_tut, 'père');
    insert into regles_fratrie (ecole_id, nb_enfants, type, valeur) values (v_ecole, 2, 'pourcentage', 10);
    select t.montant into v_mt from public._tarif_scolarite(e4, v_annee) t;
    if v_mt <> 45000 then v_err := v_err || format(' | 6. fratrie 10 %% : %s au lieu de 45000', v_mt); end if;
    update inscriptions set mensualite = 40000, motif_tarif = 'fratrie' where eleve_id = e5 and annee_id = v_annee;
    select t.montant into v_mt from public._tarif_scolarite(e5, v_annee) t;
    if v_mt <> 40000 then v_err := v_err || format(' | 6. tarif propre et fratrie : %s au lieu de 40000', v_mt); end if;
    select count(*) into v_n from public._fratrie(e4, v_annee);
    if v_n <> 2 then v_err := v_err || format(' | 6. fratrie de %s au lieu de 2', v_n); end if;

    -- --- 7. Un parent d'une autre famille : enfant_echeancier refusé ---------
    select t.profil_id into v_parent from tuteurs t where t.profil_id is not null limit 1;
    if v_parent is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_parent::text, true);
      execute 'set local role authenticated';
      begin
        perform public.enfant_echeancier(e1);
        v_err := v_err || ' | 7. enfant_echeancier accepté pour l''enfant d''une autre famille';
      exception when others then
        if sqlerrm <> 'Accès refusé.' then v_err := v_err || ' | 7. refus inattendu : ' || sqlerrm; end if;
      end;
      begin
        perform public.eleve_echeancier(e1);
        v_err := v_err || ' | 7. eleve_echeancier accepté pour un parent';
      exception when others then null; end;
      begin
        update inscriptions set exonere = true where eleve_id = e1;
        if found then v_err := v_err || ' | 7. un parent a pu exonérer un élève'; end if;
      exception when others then null; end;
      execute 'reset role';
    end if;

    if v_err <> '' then
      v_resultat := 'ÉCHEC —' || v_err;
    else
      v_resultat := 'OK — échéancier, retard au 6, à jour, avance, facture annulée, tarif propre, exonéré, fratrie'
        || case when v_parent is null then ' (refus parent non testé : aucun parent avec compte)' else ', refus parent' end || '.';
    end if;
    raise exception 'ESSAI_FIN';
  exception when others then
    if sqlerrm <> 'ESSAI_FIN' then
      v_resultat := 'ÉCHEC — erreur inattendue : ' || sqlerrm;
    end if;
  end;
  insert into pg_temp.essai_210_resultat values (v_resultat);
end
$essai$;

-- Dernière instruction : l'éditeur Supabase n'affiche que son résultat.
select resultat from pg_temp.essai_210_resultat;
