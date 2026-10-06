-- =====================================================================
--  189 — Le périmètre par cycle DANS les RPC `security definer`
--
--  🔴 POURQUOI CETTE MIGRATION EST INDISPENSABLE. La migration 188 a greffé
--  le périmètre sur 51 policies, donc sur tout ce qui lit les tables. Mais une
--  fonction `security definer` NE PASSE PAS PAR LA RLS : elle aurait continué
--  de rendre les factures, les totaux et les moyennes de TOUTE l'école à une
--  personne cloisonnée sur un cycle. C'est la leçon de la migration 167,
--  appliquée une fois de plus : en DEFINER, le cloisonnement doit être écrit
--  à la main.
--
--  Activer un périmètre sans cette migration aurait donné le pire des cas :
--  une liste d'élèves cloisonnée, et juste au-dessus un total qui compte
--  toute l'école. C'est exactement le défaut corrigé au lot 2 de l'audit —
--  un nombre derrière lequel on ne peut pas regarder.
--
--  ⚠️ `classes_autorisees() is null or ...` DEVANT CHAQUE `exists`. Sans ce
--  préfixe, une ligne dont le rattachement est absent (un paiement sans
--  facture, par exemple) disparaîtrait AUSSI pour les non-cloisonnés : une
--  régression silencieuse pour tout le monde, au lieu d'un cloisonnement pour
--  quelques-uns. `peut_voir_eleve()` porte déjà ce test en elle, les `exists`
--  non.
--
--  ⚠️ QUATRE FONCTIONS DÉLIBÉRÉMENT NON TOUCHÉES, et c'est le fruit de les
--  avoir lues plutôt que devinées :
--   • `psp_etat_eleve` : malgré son nom, c'est une fonction PARENT, gardée par
--     `_parent_possede`. La cloisonner par cycle n'aurait aucun sens.
--   • `etat_bulletins` : `STABLE` sans `SECURITY DEFINER`, donc elle SUBIT la
--     RLS — le périmètre de la 188 s'y applique déjà, gratuitement.
--   • `pilotage_synthese` : bornée aux écoles dont l'appelant est propriétaire,
--     donc réservée au promoteur, qui n'est jamais cloisonné.
--   • `dettes_personnel` : agrège des salaires, qui n'ont pas de cycle.
-- =====================================================================

do $$
declare
  --  ⚠️ TOUTES LES ANCRES TIENNENT SUR UNE SEULE LIGNE, et c'est une
  --  précaution, pas un style. Les définitions stockées par PostgreSQL
  --  portent les fins de ligne du texte qui les a créées : la plupart de ces
  --  fonctions sont en CRLF, `bulletin_pour_attestation` est en LF. Une ancre
  --  multiligne écrite ici en LF ne correspondrait donc à rien dans la
  --  moitié des cas — le bloc aurait échoué bruyamment, ce qui est le bon
  --  comportement, mais pour une raison idiote.
  v_paires text[][] := array[
    --  1. LA LISTE DES FACTURES — l'écran Paiements. Deux CTE identiques,
    --     donc `replace` les atteint toutes les deux.
    array['factures_paginees',
          'where f.ecole_id = p_ecole',
          'where f.ecole_id = p_ecole and peut_voir_eleve(f.eleve_id)'],

    --  2. LES TOTAUX DU TABLEAU DE BORD : le montant facturé/encaissé…
    array['tableau_bord_finances',
          'and (p_annee is null or annee_id = p_annee)',
          'and peut_voir_eleve(eleve_id) and (p_annee is null or annee_id = p_annee)'],
    --     …et la série mensuelle. `paiements` n'a pas d'`eleve_id` : on
    --     remonte par la facture.
    array['tableau_bord_finances',
          'and p.date_paiement >= m.mois',
          'and (classes_autorisees() is null or exists (select 1 from factures f where f.id = p.facture_id and peut_voir_eleve(f.eleve_id))) and p.date_paiement >= m.mois'],

    --  3. LE STATUT DE PAIEMENT D'UNE CLASSE : la classe est un ARGUMENT,
    --     donc une personne cloisonnée pouvait passer celle d'un autre cycle.
    array['statut_paiement_classe',
          'return query',
          'if classes_autorisees() is not null and not (p_classe = any(classes_autorisees())) then raise exception ''Cette classe est hors de votre périmètre.''; end if;
  return query'],

    --  4. LES ABSENCES D'UNE CLASSE : même raison. Sa garde est une clause
    --     `where`, donc on y ajoute la condition plutôt qu'un `raise`.
    array['absences_classe_periode',
          'group by i.eleve_id;',
          'and (classes_autorisees() is null or p_classe = any(classes_autorisees()))
   group by i.eleve_id;'],

    --  5. LES MOYENNES DE L'ÉCOLE ET PAR NIVEAU
    array['moyenne_notes_ecole',
          'where nt.ecole_id = p_ecole',
          'where nt.ecole_id = p_ecole and peut_voir_eleve(nt.eleve_id)'],
    array['moyenne_notes_par_niveau',
          'where nt.ecole_id = p_ecole',
          'where nt.ecole_id = p_ecole and peut_voir_eleve(nt.eleve_id)'],

    --  6. LES ACTES SUR UN ÉLÈVE : délivrer une attestation, relancer,
    --     supprimer une facture. Agir hors de son périmètre est plus grave
    --     que lire hors de son périmètre.
    array['bulletin_pour_attestation',
          'if not exists (select 1 from eleves',
          'if not peut_voir_eleve(p_eleve) then return; end if;
  if not exists (select 1 from eleves'],
    array['relancer_eleve',
          'if not (a_acces(''p_relancer'')) then raise exception ''Réservé au comptable.''; end if;',
          'if not (a_acces(''p_relancer'')) then raise exception ''Réservé au comptable.''; end if;
  if not peut_voir_eleve(p_eleve) then raise exception ''Cet élève est hors de votre périmètre.''; end if;'],
    array['relancer_facture',
          'if not (a_acces(''p_relancer'')) then raise exception ''Réservé au comptable.''; end if;',
          'if not (a_acces(''p_relancer'')) then raise exception ''Réservé au comptable.''; end if;
  if not peut_voir_eleve(r.eleve_id) then raise exception ''Cette facture est hors de votre périmètre.''; end if;'],
    --     ⚠️ Ancre prise APRÈS la garde de rôle : le message de cette garde
    --     contient `l''établissement`, qu'il aurait fallu échapper quatre fois.
    array['supprimer_facture',
          'select count(*), coalesce(sum(montant), 0) into v_nb, v_montant',
          'if not peut_voir_eleve(v_f.eleve_id) then raise exception ''Cette facture est hors de votre périmètre.''; end if;
  select count(*), coalesce(sum(montant), 0) into v_nb, v_montant']
  ];
  i int; v_def text; v_new text; v_ajout text; v_n int := 0;
begin
  for i in 1 .. array_length(v_paires, 1) loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_paires[i][1];
    if v_def is null then
      raise exception 'Fonction % introuvable.', v_paires[i][1];
    end if;
    --  Déjà cloisonnée ? on ne double pas (migration rejouable).
    --  ⚠️ `strpos` ET NON `like` : `peut_voir_eleve` contient des tirets bas,
    --  que `like` traite comme des jokers d'un caractère. Un `like` pouvait
    --  rendre vrai à tort, SAUTER une substitution nécessaire, et laisser la
    --  fonction non cloisonnée tout en comptant 12 — une panne silencieuse.
    v_ajout := replace(v_paires[i][3], v_paires[i][2], '');
    if strpos(v_def, btrim(v_ajout)) > 0 then
      v_n := v_n + 1;
      continue;
    end if;
    v_new := replace(v_def, v_paires[i][2], v_paires[i][3]);
    if v_new = v_def then
      raise exception 'Ancre introuvable dans % (paire %) — elle a changé depuis l''inventaire.',
        v_paires[i][1], i;
    end if;
    execute v_new;
    v_n := v_n + 1;
  end loop;
  if v_n <> 11 then
    raise exception 'Attendu 11 substitutions, % traitée(s).', v_n;
  end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  Comme pour la 188 : vider `personnel_cycles` et remettre
--  `personnel_perimetre.mode = 'ecole'` rend tout inerte, puisque
--  `classes_autorisees()` rend alors NULL et que chaque condition commence
--  par ce test. Il n'y a donc pas lieu de défaire ces fonctions.
