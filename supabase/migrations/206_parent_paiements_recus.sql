-- =====================================================================
--  206 — Espace parent, « Paiements » : de quoi relier factures,
--        encaissements et déclarations
--
--  Demandé le 19/10/2026 : le parent doit comprendre d'un coup d'œil la
--  situation de son enfant, retrouver le REÇU d'un paiement validé depuis la
--  facture concernée, et ne plus voir une déclaration validée mêlée aux
--  déclarations en attente ou rejetées.
--
--  Ce qui manquait aux RPC :
--   • `enfant_factures` ne disait pas si une facture avait des encaissements :
--     l'écran ne pouvait pas proposer « Reçu » sans ouvrir chaque facture.
--     → `nb_paiements` et `dernier_paiement_id` (le reçu ouvert par défaut).
--   • `enfant_declarations` ne rendait pas la facture concernée : une
--     déclaration en attente ne pouvait pas être rattachée à sa facture.
--     → `facture_id` (null pour une avance pas encore facturée).
--
--  🔴 LES DROITS NE BOUGENT PAS. Les deux fonctions restent SECURITY DEFINER
--  avec le même verrou `_parent_possede(p_eleve)` : seul un parent lié à
--  l'enfant obtient une ligne. Aucune policy RLS n'est créée ni élargie ;
--  `paiements` reste fermée au parent, qui n'en voit qu'un COMPTE et un
--  identifiant, le détail du reçu passant toujours par `enfant_facture_detail`
--  (même verrou). Le type de retour change : drop + create, puis droits
--  rétablis à l'identique (authenticated seulement, ni public ni anon).
--
--  Les colonnes nouvelles sont ajoutées EN FIN de liste : un écran qui ne les
--  lit pas encore continue de fonctionner.
--
--  Prérequis : 142 (enfant_facture_detail), 201 (motif), 202 (avances,
--  declare_par).
-- =====================================================================

-- Factures de l'enfant, avec leurs encaissements comptés ---------------------
drop function if exists public.enfant_factures(uuid);
create function public.enfant_factures(p_eleve uuid)
returns table(id uuid, numero text, date_emission date, date_echeance date, montant_total numeric,
              montant_paye numeric, statut text, nb_paiements integer, dernier_paiement_id uuid)
language plpgsql security definer set search_path = public as $function$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select f.id, f.numero, f.date_emission, f.date_echeance, f.montant_total, f.montant_paye, f.statut::text,
           (select count(*)::integer from paiements p where p.facture_id = f.id),
           (select p.id from paiements p where p.facture_id = f.id
             order by p.date_paiement desc, p.created_at desc limit 1)
    from factures f where f.eleve_id = p_eleve order by f.date_emission desc;
end $function$;

revoke all on function public.enfant_factures(uuid) from public, anon;
grant execute on function public.enfant_factures(uuid) to authenticated;

-- Déclarations de l'enfant, avec la facture concernée -------------------------
drop function if exists public.enfant_declarations(uuid);
create function public.enfant_declarations(p_eleve uuid)
returns table(id uuid, numero text, montant numeric, statut text, motif text, created_at timestamp with time zone,
              avance text, declarant text, facture_id uuid)
language plpgsql security definer set search_path = public as $function$
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
           end,
           dp.facture_id
      from declarations_paiement dp
      left join factures f on f.id = dp.facture_id
     where dp.eleve_id = p_eleve
     order by dp.created_at desc;
end $function$;

revoke all on function public.enfant_declarations(uuid) from public, anon;
grant execute on function public.enfant_declarations(uuid) to authenticated;
