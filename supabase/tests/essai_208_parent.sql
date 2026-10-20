-- =====================================================================
--  ESSAI — cloisonnement de l'espace parent (migration 208)
--
--  Prérequis : 208 appliquée sur cette base.
--  Coller TOUT le fichier dans l'éditeur SQL (sans rien surligner : sinon
--  seule la sélection est exécutée) puis lancer.
--
--  Le verdict s'affiche comme UNE LIGNE de résultat (colonne `resultat`),
--  qui commence par « OK », « ÉCHEC » ou « IMPOSSIBLE ».
--
--  Aucune donnée n'est conservée : tous les appels se font dans un bloc
--  qui est annulé à la fin (sous-transaction), y compris un éventuel
--  paiement déclaré à tort. Seule subsiste la table temporaire du verdict,
--  qui disparaît avec la session.
--
--  Ce que l'essai prouve, en se faisant passer pour un VRAI parent de la
--  base (rôle `authenticated`, `auth.uid()` = son profil) :
--   A. il lit les données de SON enfant (aucune exception) ;
--   B. chaque RPC parent REFUSE un élève qui n'est pas le sien ;
--   C. un appel anonyme (`anon`) est refusé ;
--   D. une preuve hors du dossier de l'élève est refusée.
-- =====================================================================
drop table if exists pg_temp.essai_208_resultat;
create temp table essai_208_resultat (resultat text);

do $essai$
declare
  v_parent uuid; v_mien uuid; v_autre uuid; v_facture_autre uuid; v_facture_mienne uuid;
  v_fuites text := '';
  v_nb int := 0;
  v_etape text := 'préparation';
  v_resultat text;
  f text;
begin
  -- Tout ce bloc est annulé par l'exception finale « ESSAI_FIN » : les
  -- écritures éventuelles ET les changements de rôle disparaissent.
  begin
    -- --- Le décor : un parent réel, un de ses enfants, un élève d'une autre famille
    select t.profil_id, et.eleve_id into v_parent, v_mien
      from tuteurs t join eleve_tuteurs et on et.tuteur_id = t.id
     where t.profil_id is not null
     --  De préférence un enfant avec une facture impayée : sans elle, le
     --  contrôle D (preuve de paiement) ne peut pas être joué.
     order by (exists (select 1 from factures f
                        where f.eleve_id = et.eleve_id
                          and f.statut::text not in ('annulee', 'brouillon')
                          and coalesce(f.montant_total, 0) > coalesce(f.montant_paye, 0))) desc,
              t.profil_id, et.eleve_id
     limit 1;
    if v_parent is null then
      v_resultat := 'IMPOSSIBLE — aucun parent lié dans cette base.';
      raise exception 'ESSAI_FIN';
    end if;
    select e.id into v_autre from eleves e
     where not exists (select 1 from eleve_tuteurs et join tuteurs t on t.id = et.tuteur_id
                        where et.eleve_id = e.id and t.profil_id = v_parent)
     --  De préférence un élève qui a une facture : sinon le détail de
     --  facture et la déclaration de paiement « autre famille » sont sautés.
     order by (exists (select 1 from factures f where f.eleve_id = e.id)) desc, e.id
     limit 1;
    if v_autre is null then
      v_resultat := 'IMPOSSIBLE — aucun élève hors de cette famille.';
      raise exception 'ESSAI_FIN';
    end if;
    select id into v_facture_autre from factures where eleve_id = v_autre limit 1;
    select id into v_facture_mienne from factures
     where eleve_id = v_mien and statut::text not in ('annulee', 'brouillon')
       and coalesce(montant_total, 0) > coalesce(montant_paye, 0)
     limit 1;

    -- --- On devient ce parent
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_parent::text, true);
    execute 'set local role authenticated';

    -- --- A. Son enfant : tout répond (une exception ici = ÉCHEC)
    v_etape := 'A (lecture de son propre enfant)';
    perform * from public.mon_acces_notes(v_mien);
    perform * from public.enfant_notes(v_mien);
    perform * from public.enfant_bulletins(v_mien);
    perform * from public.enfant_factures(v_mien);
    perform * from public.enfant_absences(v_mien);
    perform * from public.enfant_declarations(v_mien);
    perform * from public.mes_demandes();

    -- --- B. L'enfant d'une autre famille : chaque appel DOIT lever une exception
    v_etape := 'B (autre famille)';
    foreach f in array array[
      'select * from public.mon_acces_notes($1)',
      'select * from public.enfant_notes($1)',
      'select * from public.enfant_bulletins($1)',
      'select * from public.enfant_factures($1)',
      'select * from public.enfant_absences($1)',
      'select * from public.enfant_declarations($1)',
      'select * from public.enfant_emploi($1)',
      'select * from public.enfant_cahier($1)',
      'select * from public.enfant_fournitures($1)',
      'select * from public.enfant_cantine($1)',
      'select * from public.enfant_transport($1)',
      'select * from public.annonces_enfant($1)',
      'select public.ecole_paiement_infos($1)',
      'select public.psp_etat_eleve($1)',
      'select * from public.avance_options($1)',
      'select public.demander_acces_notes($1)'
    ] loop
      begin
        execute f using v_autre;
        v_fuites := v_fuites || ' | ' || f;
      exception when others then
        v_nb := v_nb + 1;
      end;
    end loop;

    if v_facture_autre is not null then
      begin
        perform public.enfant_facture_detail(v_facture_autre);
        v_fuites := v_fuites || ' | enfant_facture_detail';
      exception when others then v_nb := v_nb + 1; end;
      begin
        perform public.declarer_paiement(v_facture_autre, 1, 'wave', 'essai', v_autre || '/essai.jpg');
        v_fuites := v_fuites || ' | declarer_paiement (autre famille)';
      exception when others then v_nb := v_nb + 1; end;
    end if;

    -- Mig. 209 : paiement anticipé pour l'enfant d'une autre famille
    begin
      perform public.declarer_avance(v_autre, array[to_char(current_date, 'YYYY-MM')],
        'wave', 'essai', v_autre || '/essai.jpg');
      v_fuites := v_fuites || ' | declarer_avance (autre famille)';
    exception when others then
      --  Seul « Accès refusé » prouve la garde : un autre refus (aucun mois
      --  à payer, montant…) signifierait qu'elle a été franchie.
      if sqlerrm = 'Accès refusé.' then v_nb := v_nb + 1;
      else v_fuites := v_fuites || ' | declarer_avance (garde franchie : ' || sqlerrm || ')'; end if;
    end;

    -- _acces_notes_autorise n'est plus appelable directement
    begin
      perform public._acces_notes_autorise(v_autre);
      v_fuites := v_fuites || ' | _acces_notes_autorise (appel direct)';
    exception when others then v_nb := v_nb + 1; end;

    -- --- D. Sa facture, mais une preuve rangée chez un autre élève
    v_etape := 'D (preuve de paiement)';
    if v_facture_mienne is not null then
      begin
        perform public.declarer_paiement(v_facture_mienne, 1, 'wave', 'essai', v_autre || '/essai.jpg');
        v_fuites := v_fuites || ' | declarer_paiement (preuve d''un autre dossier)';
      exception when others then v_nb := v_nb + 1; end;
      begin
        perform public.declarer_paiement(v_facture_mienne, 1, 'wave', 'essai', 'x');
        v_fuites := v_fuites || ' | declarer_paiement (preuve fictive « x »)';
      exception when others then v_nb := v_nb + 1; end;
    end if;

    -- --- C. Anonyme
    v_etape := 'C (anonyme)';
    execute 'reset role';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('request.jwt.claim.sub', '', true);
    execute 'set local role anon';
    begin
      perform * from public.mon_acces_notes(v_mien);
      v_fuites := v_fuites || ' | mon_acces_notes (anon)';
    exception when others then v_nb := v_nb + 1; end;
    execute 'reset role';

    if v_fuites <> '' then
      v_resultat := 'ÉCHEC — appels NON refusés :' || v_fuites;
    else
      v_resultat := format('OK — son enfant lisible, %s refus attendus obtenus (autre famille, preuve, anonyme)%s.',
        v_nb,
        case when v_facture_mienne is null then ' ; contrôle D non fait : aucune facture impayée pour cet enfant' else '' end
        || case when v_facture_autre is null then ' ; facture d''une autre famille non testée : aucune facture hors famille' else '' end);
    end if;
    raise exception 'ESSAI_FIN';
  exception when others then
    if sqlerrm <> 'ESSAI_FIN' then
      v_resultat := format('ÉCHEC — erreur inattendue à l''étape %s : %s', v_etape, sqlerrm);
    end if;
  end;
  -- Ici, tout ce qui précède est annulé et le rôle d'origine est rétabli.
  insert into pg_temp.essai_208_resultat values (v_resultat);
end
$essai$;

-- Dernière instruction : l'éditeur Supabase n'affiche que le résultat de
-- la dernière. La table temporaire disparaît avec la session.
select resultat from pg_temp.essai_208_resultat;
