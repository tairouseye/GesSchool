-- =====================================================================
--  045 — Correctif : « column reference "id" is ambiguous » (espace parent)
--
--  Trois RPC parent avaient été créées directement en base (les migrations
--  020/021 n'ont jamais été versionnées) : enfant_declarations,
--  enfant_fournitures, ecole_paiement_infos. L'une d'elles (au moins
--  enfant_declarations : jointure declarations_paiement × factures, les deux
--  tables ayant une colonne id, plus une colonne de sortie nommée id)
--  référençait « id » sans qualifier la table → erreur.
--
--  On recrée les trois proprement, colonnes entièrement qualifiées, en
--  conservant le garde-fou _parent_possede et les mêmes colonnes de sortie
--  que celles consommées par l'app (parent.js / ParentEnfant.jsx).
-- =====================================================================

-- Déclarations de paiement mobile d'un enfant --------------------------------
drop function if exists public.enfant_declarations(uuid);
create or replace function public.enfant_declarations(p_eleve uuid)
returns table(id uuid, numero text, montant numeric, statut text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select dp.id, f.numero, dp.montant, dp.statut::text
    from declarations_paiement dp
    left join factures f on f.id = dp.facture_id
    where dp.eleve_id = p_eleve
    order by dp.created_at desc;
end $$;

-- Liste des fournitures applicables à l'enfant -------------------------------
drop function if exists public.enfant_fournitures(uuid);
create or replace function public.enfant_fournitures(p_eleve uuid)
returns table(libelle text, quantite int, obligatoire boolean, note text)
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid; v_niveau uuid;
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select c.niveau_id into v_niveau
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
    join classes c on c.id = ins.classe_id
    where ins.eleve_id = p_eleve
    limit 1;
  return query
    select fr.libelle, fr.quantite::int, fr.obligatoire, fr.note
    from fournitures fr
    where fr.ecole_id = v_ecole
      and (fr.niveau_id is null or fr.niveau_id = v_niveau)
    order by fr.libelle;
end $$;

-- Coordonnées de paiement mobile de l'école de l'enfant ----------------------
drop function if exists public.ecole_paiement_infos(uuid);
create or replace function public.ecole_paiement_infos(p_eleve uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid; v_val jsonb;
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select p.valeur into v_val
    from parametres p
    where p.ecole_id = v_ecole and p.cle = 'paiement_mobile'
    limit 1;
  return coalesce(v_val, '{}'::jsonb);
end $$;

revoke execute on function public.enfant_declarations(uuid) from public, anon;
revoke execute on function public.enfant_fournitures(uuid) from public, anon;
revoke execute on function public.ecole_paiement_infos(uuid) from public, anon;
grant execute on function public.enfant_declarations(uuid) to authenticated;
grant execute on function public.enfant_fournitures(uuid) to authenticated;
grant execute on function public.ecole_paiement_infos(uuid) to authenticated;
