-- =====================================================================
--  195 — Supérieur (LMD) : 12 tables
--
--  Le bloc le plus gros du chantier, et le plus régulier : les 12 tables du
--  supérieur portent toutes le même patron `_select` (large) + `_ecrire`
--  (par rôle), posé par les migrations 108-109. Aucune n'avait l'écriture
--  ouverte à tout le personnel — il n'en reste plus aucune dans le dépôt
--  depuis la 194. C'est donc un travail de COHÉRENCE : faire gouverner ces
--  tables par l'arbre à cocher, pour qu'une case décochée ferme vraiment.
--
--  🔴 MAIS IL Y A QUAND MÊME UN GAIN DE SÉCURITÉ, et il est net : les notes
--  LMD, les relevés et les procès-verbaux de délibération se lisaient par
--  `ecole_id = ecole_courante()` SEUL. Dans une université, le
--  bibliothécaire, le surveillant, la RH, le magasinier lisaient donc
--  **toutes les notes et tous les relevés de tous les étudiants**. C'est
--  exactement la famille du défaut corrigé par la migration 173 côté école —
--  elle n'avait jamais été appliquée au supérieur.
--
--  ⚠️ CE QUE J'AI VÉRIFIÉ AVANT DE RESSERRER CES TROIS LECTURES :
--
--  1. **L'écran Délibérations LIT `notes_lmd`** pour calculer les moyennes et
--     imprimer le PV (`Deliberations.jsx:55` → `getNotesLMD`). Sa lecture doit
--     donc rester ouverte à `deliberations_sup`, sinon le PV se calculerait sur
--     zéro note — en silence, car une lecture refusée par la RLS ne lève rien,
--     elle rend 0 ligne.
--  2. **LES ÉTUDIANTS NE PASSENT PAR AUCUNE DE CES POLICIES.** Leurs écrans
--     appellent exclusivement des RPC `security definer` (`mes_notes_lmd`,
--     `mes_releves`, `mon_dossier_etudiant`), protégées par la grille de
--     consentement de la migration 114. Et pour un étudiant
--     `ecole_courante()` vaut NULL : il n'a jamais lu ces tables en direct.
--     Resserrer est donc inerte pour eux — la grille de consentement est
--     intacte.
--
--  ⚠️ LES NEUF AUTRES LECTURES RESTENT LARGES, et c'est délibéré : ce sont des
--  RÉFÉRENTIELS. `filieres`, `semestres`, `ue`, `ecue`, `inscriptions_sup`…
--  sont lus par presque tous les écrans du supérieur pour composer un
--  affichage — l'écran Notes a besoin des inscriptions pour lister ses
--  étudiants, les Délibérations aussi. Fermer leur lecture viderait des
--  grilles en silence, comme l'aurait fait `classes` à la migration 186.
--
--  ⚠️ ET `emplois_sup` EST LE CAS QUI DEMANDAIT DE LIRE L'ÉCRAN. Son écriture
--  appartient aujourd'hui à {promoteur, direction}, mais la case `emploi_sup`
--  couvre AUSSI l'enseignant : l'utiliser seule aurait ÉLARGI. On exige donc
--  la case ET le pouvoir `p_toutes_classes`, ce qui reproduit exactement
--  {promoteur, direction} — le précédent `acquis_items` de la migration 193.
--  (L'écran, lui, offre « + Nouvelle séance » et « supprimer » à tout
--  enseignant qui peut l'ouvrir : ses enregistrements échouent. Défaut
--  d'interface PRÉEXISTANT, corrigé côté front dans le même lot — pas ici.)
--
--  ⚠️ AUCUN PÉRIMÈTRE PAR CYCLE n'est ajouté : le supérieur n'a pas de cycles,
--  il a des facultés et des filières. `cycles_autorises()` rendrait NULL pour
--  tout le personnel d'université, donc la conjonction serait inerte — du
--  bruit, pas une garantie. Un périmètre par filière serait un autre chantier.
-- =====================================================================

do $$
declare
  --  (table, mode de LECTURE, expression d'ÉCRITURE)
  --  mode de lecture : 'tenant'  = l'établissement (le cas des référentiels)
  --                    'membres' = + les étudiants (ils lisent leur emploi du temps)
  --                    'boites:a,b' = seulement les détenteurs de ces cases
  v_map text[][] := array[
    --  La maquette pédagogique : écran « Filières & maquettes », case `filieres`
    --  (= {direction} aujourd'hui). Correspondance exacte, aucun droit déplacé.
    array['facultes',         'tenant',  'filieres'],
    array['departements',     'tenant',  'filieres'],
    array['filieres',         'tenant',  'filieres'],
    array['semestres',        'tenant',  'filieres'],
    array['ue',               'tenant',  'filieres'],
    array['ecue',             'tenant',  'filieres'],
    --  La scolarité : écran « Inscriptions », case `inscriptions_sup`
    --  (= {direction, comptable, secretaire}). Correspondance exacte.
    array['inscriptions_sup', 'tenant',  'inscriptions_sup'],
    array['inscriptions_ue',  'tenant',  'inscriptions_sup'],
    --  🔴 Les trois tables dont la LECTURE se resserre.
    array['notes_lmd',        'boites:notes_lmd,deliberations_sup', 'notes_lmd'],
    array['releves',          'boites:deliberations_sup',           'deliberations_sup'],
    array['deliberations',    'boites:deliberations_sup',           'deliberations_sup'],
    --  ⚠️ L'emploi du temps des filières : la case SEULE élargirait aux
    --  enseignants (voir l'en-tête). `_DIRECTION` exige la case + le pouvoir.
    array['emplois_sup',      'membres', '_DIRECTION:emploi_sup']
  ];
  i int; t text; v_mode text; v_case text;
  v_lect text; v_ecr text; v_n int := 0; r record;
begin
  for i in 1 .. array_length(v_map, 1) loop
    t := v_map[i][1]; v_mode := v_map[i][2]; v_case := v_map[i][3];

    --  La lecture, selon le mode.
    if v_mode = 'tenant' then
      v_lect := '(select est_super_admin()) or ecole_id = (select ecole_courante())';
    elsif v_mode = 'membres' then
      --  ⚠️ `est_membre_ecole()` est CONSERVÉ ici : il vaut vrai pour les
      --  étudiants, qui consultent l'emploi du temps de leurs séances. Le
      --  remplacer par `ecole_courante()` seul viderait leur écran — pour un
      --  étudiant, `ecole_courante()` vaut NULL.
      v_lect := '(select est_super_admin()) or est_membre_ecole(ecole_id)';
    else
      select '(select est_super_admin()) or (ecole_id = (select ecole_courante()) and ('
             || string_agg(format('(select a_acces(%L))', b), ' or ') || '))'
        into v_lect
        from unnest(string_to_array(substr(v_mode, 8), ',')) as b;
    end if;

    --  L'écriture : la case, ou la case ET le pouvoir « voit toutes les classes ».
    if v_case like '\_DIRECTION:%' then
      v_ecr := format('(select a_acces(%L)) and (select a_acces(''p_toutes_classes''))',
                      substr(v_case, 12));
    else
      v_ecr := format('(select a_acces(%L))', v_case);
    end if;

    --  On retire TOUTES les policies de la table en énumérant le catalogue,
    --  pas par leurs noms attendus : une policy permissive oubliée annulerait
    --  tout le resserrement, puisqu'elles se combinent par OU. C'est la leçon
    --  de la migration 193, où les conventions de nommage divergeaient.
    for r in select p.polname from pg_policy p
              join pg_class c on c.oid = p.polrelid
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = t
    loop
      execute format('drop policy %I on public.%I;', r.polname, t);
    end loop;

    execute format('create policy %1$s_select on public.%1$I for select using (%2$s);',
                   t, v_lect);
    execute format($p$create policy %1$s_ecrire on public.%1$I for all
      using ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and %2$s))
      with check ((select est_super_admin()) or (ecole_id = (select ecole_courante()) and %2$s));$p$,
      t, v_ecr);
    v_n := v_n + 1;
  end loop;
  if v_n <> 12 then raise exception 'Attendu 12 tables du supérieur, % traitée(s).', v_n; end if;
end $$;

-- --- Pourquoi cette migration ne touche AUCUNE RPC --------------------
--
--  J'avais prévu d'y basculer les gardes de `verrouiller_deliberation` et
--  `publier_releves`. **CES DEUX FONCTIONS N'EXISTENT PAS** : le verrouillage
--  d'une délibération et la publication des relevés se font par un `update` et
--  un `insert` ordinaires depuis le front (`superieur.js:350-362`). Les
--  policies ci-dessus sont donc la TOTALITÉ de l'application de la règle pour
--  le supérieur — il n'y a pas de couche `security definer` à traduire.
--
--  Le balayage complet de la couche RPC, fait à cette occasion, a confirmé
--  qu'aucune fonction n'est propre au supérieur. Il a en revanche trouvé une
--  omission de la migration 194 : `ecole_conversations_etudiants` et quatre
--  autres fonctions de messagerie portent encore leur garde par rôle, parce
--  que la 194 n'avait regardé que les TABLES. Elles sont traitées à part
--  (migration 196), chaque migration gardant un seul sujet.

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- do $$ declare t text; v_r text; r record; begin
--   foreach t in array array['facultes','departements','filieres','semestres','ue','ecue',
--                            'emplois_sup'] loop
--     for r in select p.polname from pg_policy p join pg_class c on c.oid=p.polrelid
--               join pg_namespace n on n.oid=c.relnamespace
--              where n.nspname='public' and c.relname=t loop
--       execute format('drop policy %I on public.%I;', r.polname, t);
--     end loop;
--     v_r := case when t = 'emplois_sup'
--                 then 'est_super_admin() or est_membre_ecole(ecole_id)'
--                 else 'est_super_admin() or (ecole_id = ecole_courante())' end;
--     execute format('create policy %1$s_select on public.%1$I for select using (%2$s);', t, v_r);
--     execute format($p$create policy %1$s_ecrire on public.%1$I for all
--       using (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('direction'))))
--       with check (est_super_admin() or (ecole_id = ecole_courante() and (est_admin()
--              or a_role('direction'))));$p$, t);
--   end loop; end $$;
-- -- idem pour inscriptions_sup / inscriptions_ue / releves / deliberations avec
-- -- (est_admin() or direction or comptable or secretaire), et notes_lmd avec
-- -- (est_admin() or direction or enseignant) ; les `_select` reviennent à
-- -- `est_super_admin() or (ecole_id = ecole_courante())`.
-- -- ⚠️ Annuler ROUVRE la lecture de toutes les notes et de tous les relevés des
-- -- étudiants à l'ensemble du personnel de l'université.
-- notify pgrst, 'reload schema';
