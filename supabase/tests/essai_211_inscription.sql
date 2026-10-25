-- =====================================================================
--  ESSAI — inscription / réinscription et dernier mois facturé (mig. 211)
--
--  Prérequis : 210 et 211 appliquées.
--  Coller TOUT le fichier dans l'éditeur SQL (sans rien surligner), lancer.
--  Verdict : UNE LIGNE (colonne `resultat`) : « OK », « ÉCHEC » ou
--  « IMPOSSIBLE ».
--
--  Décor FICTIF dans une école existante (année « ESSAI-211 » non
--  courante, niveau, classe, frais, deux élèves), entièrement annulé.
-- =====================================================================
drop table if exists pg_temp.essai_211_resultat;
create temp table essai_211_resultat (resultat text);

do $essai$
declare
  v_ecole uuid; v_cycle uuid; v_ancienne uuid; v_annee uuid; v_niveau uuid; v_classe uuid; v_classe0 uuid;
  e_new uuid; e_old uuid;
  m0 date := date_trunc('month', current_date)::date;
  v_err text := '';
  v_resultat text;
  v_n int; v_lib text; v_b boolean;
begin
  begin
    select n.ecole_id, n.cycle_id into v_ecole, v_cycle from niveaux n limit 1;
    if v_ecole is null then
      v_resultat := 'IMPOSSIBLE — aucune école avec un cycle dans cette base.';
      raise exception 'ESSAI_FIN';
    end if;

    --  Une année ANTÉRIEURE (pour l'ancien) et l'année d'essai : 10 mois de
    --  cours, mensualités sur 9 seulement.
    insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante)
    values (v_ecole, 'ESSAI-211-AVANT', (m0 - interval '14 months')::date, (m0 - interval '3 months')::date, false)
    returning id into v_ancienne;
    insert into annees_scolaires (ecole_id, libelle, date_debut, date_fin, courante, fin_facturation)
    values (v_ecole, 'ESSAI-211', (m0 - interval '1 month')::date, (m0 + interval '9 months' - interval '1 day')::date, false,
            (m0 + interval '7 months')::date)
    returning id into v_annee;
    insert into niveaux (ecole_id, cycle_id, libelle) values (v_ecole, v_cycle, 'ESSAI-211') returning id into v_niveau;
    insert into classes (ecole_id, niveau_id, annee_id, libelle) values (v_ecole, v_niveau, v_annee, 'ESSAI-211') returning id into v_classe;
    insert into classes (ecole_id, niveau_id, annee_id, libelle) values (v_ecole, v_niveau, v_ancienne, 'ESSAI-211-AVANT') returning id into v_classe0;
    insert into frais (ecole_id, annee_id, niveau_id, libelle, montant, recurrent, obligatoire, public) values
      (v_ecole, v_annee, v_niveau, 'Inscription ESSAI', 100000, false, true, 'nouveaux'),
      (v_ecole, v_annee, v_niveau, 'Réinscription ESSAI', 80000, false, true, 'anciens'),
      (v_ecole, v_annee, v_niveau, 'Mensualité ESSAI', 60000, true, true, 'tous');

    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Nouveau', 'ESSAI211') returning id into e_new;
    insert into eleves (ecole_id, prenom, nom) values (v_ecole, 'Ancien', 'ESSAI211') returning id into e_old;
    insert into inscriptions (ecole_id, eleve_id, classe_id, annee_id) values
      (v_ecole, e_new, v_classe, v_annee),
      (v_ecole, e_old, v_classe, v_annee),
      (v_ecole, e_old, v_classe0, v_ancienne);

    -- 1. Déduction : nouveau / ancien
    if not public._est_nouveau(e_new, v_annee) then v_err := v_err || ' | 1. le nouveau n''est pas vu nouveau'; end if;
    if public._est_nouveau(e_old, v_annee) then v_err := v_err || ' | 1. l''ancien est vu nouveau'; end if;

    -- 2. Le nouveau doit l'Inscription, pas la Réinscription ; l'ancien l'inverse
    select string_agg(x.libelle, ',') into v_lib from public._echeancier(e_new, v_annee) x where not x.recurrent;
    if v_lib is distinct from 'Inscription ESSAI' then v_err := v_err || format(' | 2. nouveau doit : %s', v_lib); end if;
    select string_agg(x.libelle, ',') into v_lib from public._echeancier(e_old, v_annee) x where not x.recurrent;
    if v_lib is distinct from 'Réinscription ESSAI' then v_err := v_err || format(' | 2. ancien doit : %s', v_lib); end if;

    -- 3. Mensualités jusqu'au dernier mois facturé : 9 mois, pas 10
    select count(*) into v_n from public._echeancier(e_new, v_annee) x where x.recurrent;
    if v_n <> 9 then v_err := v_err || format(' | 3. %s mensualités au lieu de 9', v_n); end if;

    -- 4. Saisie explicite : l'ancien déclaré nouveau doit l'Inscription
    update inscriptions set nouveau = true where eleve_id = e_old and annee_id = v_annee;
    select string_agg(x.libelle, ',') into v_lib from public._echeancier(e_old, v_annee) x where not x.recurrent;
    if v_lib is distinct from 'Inscription ESSAI' then v_err := v_err || format(' | 4. saisie « nouveau » ignorée : %s', v_lib); end if;

    -- 5. La facturation en lot reçoit l'information
    select t.nouveau into v_b from public._tarif_scolarite(e_new, v_annee) t;
    if not coalesce(v_b, false) then v_err := v_err || ' | 5. _tarif_scolarite ne dit pas « nouveau »'; end if;

    if v_err <> '' then
      v_resultat := 'ÉCHEC —' || v_err;
    else
      v_resultat := 'OK — nouveau → Inscription, ancien → Réinscription, saisie prioritaire, 9 mensualités sur 10 mois.';
    end if;
    raise exception 'ESSAI_FIN';
  exception when others then
    if sqlerrm <> 'ESSAI_FIN' then
      v_resultat := 'ÉCHEC — erreur inattendue : ' || sqlerrm;
    end if;
  end;
  insert into pg_temp.essai_211_resultat values (v_resultat);
end
$essai$;

select resultat from pg_temp.essai_211_resultat;
