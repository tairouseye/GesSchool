-- =====================================================================
--  ESSAI — annuler une relance, grille de suivi des mensualités
--          (migration 213)
--
--  Prérequis : 213 appliquée sur cette base.
--  Coller TOUT le fichier dans l'éditeur SQL (sans rien surligner), lancer.
--  Verdict : UNE LIGNE (colonne `resultat`) qui commence par « OK »,
--  « ÉCHEC » ou « IMPOSSIBLE ».
--
--  Aucune donnée n'est conservée : tout se passe dans un bloc annulé à la
--  fin (sous-transaction). La relance d'essai est FICTIVE (message
--  « ESSAI-213 ») ; la grille est lue sur les vrais élèves de Tut'Tank,
--  avec l'identité d'un administrateur de l'école, sans rien écrire.
-- =====================================================================
drop table if exists pg_temp.essai_213_resultat;
create temp table essai_213_resultat (resultat text);

do $essai$
declare
  v_ecole uuid := '72e0a623-1a12-4b57-b8c8-62e57b00fa61';
  v_annee uuid; v_admin uuid; v_parent uuid; v_eleve uuid; v_rel uuid;
  v_err text := ''; v_resultat text;
  v_n int; v_lignes int; v_insc int; v_incoh int; v_statut int; v_mois int;
  v_paye numeric; v_grille jsonb;
begin
  begin
    select a.id into v_annee from annees_scolaires a where a.ecole_id = v_ecole and a.courante;
    select p.id into v_admin from profils p join profil_roles pr on pr.profil_id = p.id
     where p.ecole_id = v_ecole and p.actif and pr.role = 'admin_ecole' limit 1;
    if v_annee is null or v_admin is null then
      v_resultat := 'IMPOSSIBLE — année courante ou administrateur de Tut''Tank introuvable.';
      raise exception 'ESSAI_FIN';
    end if;
    select i.eleve_id into v_eleve from inscriptions i where i.annee_id = v_annee limit 1;

    -- --- 0. Droits : rien pour anon ------------------------------------------
    if has_function_privilege('anon', 'public.annuler_relances(uuid[])', 'execute')
       or has_function_privilege('anon', 'public.grille_mensualites(uuid, uuid)', 'execute') then
      v_err := v_err || ' | 0. fonction exécutable par anon';
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    execute 'set local role authenticated';

    -- --- 1. La grille : une ligne par inscrit, cohérente ----------------------
    --  La grille est lue SOUS l'identité de l'administrateur ; les contrôles
    --  ensuite, hors de cette identité : `_statut_paiement` est (à raison)
    --  fermée aux utilisateurs.
    select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) into v_grille
      from public.grille_mensualites(v_annee) g;
    execute 'reset role';

    select count(*) into v_insc from inscriptions i join classes c on c.id = i.classe_id
     where i.annee_id = v_annee and c.ecole_id = v_ecole
       and i.statut::text not in ('abandon', 'exclu', 'transfere');
    select count(*),
           count(*) filter (where g.total_paye <> coalesce(g.inscription_paye, 0)
                              + coalesce((select sum((v ->> 'paye')::numeric) from jsonb_each(g.mois) m(k, v)), 0)),
           count(*) filter (where g.statut is distinct from public._statut_paiement(g.eleve_id, v_annee)),
           count(*) filter (where not g.exonere and g.mensualite is not null
                              and (select count(*) from jsonb_object_keys(g.mois)) = 0),
           coalesce(sum(g.total_paye), 0)
      into v_lignes, v_incoh, v_statut, v_mois, v_paye
      from jsonb_to_recordset(v_grille) g(eleve_id uuid, statut text, exonere boolean, mensualite numeric,
                                          inscription_paye numeric, mois jsonb, total_paye numeric);
    if v_lignes <> v_insc then v_err := v_err || format(' | 1. %s lignes pour %s inscrits', v_lignes, v_insc); end if;
    if v_incoh > 0 then v_err := v_err || format(' | 1. %s lignes : total payé ≠ inscription + mois', v_incoh); end if;
    if v_statut > 0 then v_err := v_err || format(' | 1. %s statuts différents de l''échéancier', v_statut); end if;
    if v_mois > 0 then v_err := v_err || format(' | 1. %s élèves facturables sans aucun mois', v_mois); end if;

    -- --- 2. Annuler une relance : notification retirée, journal gardé --------
    insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
    values (v_ecole, null, 'Rappel de paiement', 'ESSAI-213', v_eleve, 'facture');
    insert into relances (ecole_id, eleve_id, canal, montant_du, message, statut)
    values (v_ecole, v_eleve, 'manuel', 1, 'ESSAI-213', 'envoye') returning id into v_rel;
    execute 'set local role authenticated';

    select public.annuler_relances(array[v_rel]) into v_n;
    if v_n <> 1 then v_err := v_err || format(' | 2. %s relance(s) annulée(s) au lieu de 1', v_n); end if;
    execute 'reset role';
    if exists (select 1 from notifications where message = 'ESSAI-213') then
      v_err := v_err || ' | 2. la notification est restée dans le fil du parent';
    end if;
    if not exists (select 1 from relances where id = v_rel and statut = 'annulee'
                   and annulee_le is not null and annulee_par = v_admin) then
      v_err := v_err || ' | 2. la relance n''est pas marquée annulée (qui, quand)';
    end if;
    execute 'set local role authenticated';
    select public.annuler_relances(array[v_rel]) into v_n;
    if v_n <> 0 then v_err := v_err || ' | 2. une relance déjà annulée est recomptée'; end if;
    execute 'reset role';

    -- --- 3. Un parent ne peut ni annuler ni lire la grille --------------------
    select t.profil_id into v_parent from tuteurs t where t.profil_id is not null limit 1;
    if v_parent is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_parent::text, true);
      execute 'set local role authenticated';
      begin
        perform public.annuler_relances(array[v_rel]);
        v_err := v_err || ' | 3. annuler_relances accepté pour un parent';
      exception when others then null; end;
      begin
        perform * from public.grille_mensualites(v_annee);
        v_err := v_err || ' | 3. grille_mensualites accepté pour un parent';
      exception when others then null; end;
      execute 'reset role';
    end if;

    if v_err <> '' then
      v_resultat := 'ÉCHEC —' || v_err;
    else
      v_resultat := format('OK — grille : %s élèves, %s F payés, cohérente avec l''échéancier ; '
        || 'relance annulée (notification retirée, journal gardé)%s.',
        v_lignes, to_char(v_paye, 'FM999G999G990'),
        case when v_parent is null then ' ; refus parent non testé' else ' ; refus parent' end);
    end if;
    raise exception 'ESSAI_FIN';
  exception when others then
    if sqlerrm <> 'ESSAI_FIN' then
      v_resultat := 'ÉCHEC — erreur inattendue : ' || sqlerrm;
    end if;
  end;
  insert into pg_temp.essai_213_resultat values (v_resultat);
end
$essai$;

-- Dernière instruction : l'éditeur Supabase n'affiche que son résultat.
select resultat from pg_temp.essai_213_resultat;
