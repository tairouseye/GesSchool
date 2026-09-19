-- =====================================================================
--  142 — Le parent peut enfin imprimer sa facture et ses reçus
--
--  `enfant_factures` (mig. 004) renvoie une ligne par facture : numéro,
--  dates, totaux, statut. De quoi dresser une liste — pas de quoi produire
--  un document. Il y manque LES LIGNES de la facture, les encaissements
--  déjà reçus, et l'identité de l'établissement (logo, couleurs, mentions
--  légales) que la mise en page de caisse exige.
--
--  Le parent n'a accès à aucune de ces tables : `factures` et `paiements`
--  ont été fermées à tout ce qui n'est pas la gestion (mig. 133), et son
--  `profils.ecole_id` est NULL de toute façon. D'où une RPC dédiée, gardée
--  par `_parent_possede()` — le même verrou que les autres `enfant_*`.
--
--  Une seule fonction renvoyant un jsonb complet plutôt que quatre appels :
--  le document s'affiche d'un bloc ou pas du tout, il ne se compose pas
--  progressivement sous les yeux du parent.
--
--  Prérequis : migrations 004 (_parent_possede), 133.
-- =====================================================================

create or replace function public.enfant_facture_detail(p_facture uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_f factures%rowtype;
  v_e ecoles%rowtype;
begin
  select * into v_f from factures where id = p_facture;
  if not found then
    raise exception 'Facture introuvable.';
  end if;
  -- Le verrou porte sur l'ÉLÈVE, pas sur la facture : c'est le lien de
  -- filiation qui autorise, et lui seul.
  if not public._parent_possede(v_f.eleve_id) then
    raise exception 'Accès refusé.';
  end if;

  select * into v_e from ecoles where id = v_f.ecole_id;

  return jsonb_build_object(
    'facture', jsonb_build_object(
      'id', v_f.id, 'numero', v_f.numero,
      'date_emission', v_f.date_emission, 'date_echeance', v_f.date_echeance,
      'montant_total', v_f.montant_total, 'montant_paye', v_f.montant_paye,
      'statut', v_f.statut::text, 'notes', v_f.notes),

    'lignes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'libelle', l.libelle, 'quantite', l.quantite,
               'prix_unitaire', l.prix_unitaire, 'montant', l.montant))
        from facture_lignes l where l.facture_id = v_f.id), '[]'::jsonb),

    -- Les encaissements : c'est ce qui permet au parent d'imprimer SON reçu.
    'paiements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'montant', p.montant, 'mode', p.mode,
               'reference', p.reference, 'date_paiement', p.date_paiement)
             order by p.date_paiement, p.created_at)
        from paiements p where p.facture_id = v_f.id), '[]'::jsonb),

    'eleve', (select jsonb_build_object('prenom', e.prenom, 'nom', e.nom, 'matricule', e.matricule)
                from eleves e where e.id = v_f.eleve_id),

    -- Identité visuelle et légale : sans elle le document sort générique.
    'ecole', jsonb_build_object(
      'nom', v_e.nom, 'sigle', v_e.sigle, 'logo_url', v_e.logo_url,
      'cachet_url', v_e.cachet_url, 'devise', v_e.devise,
      'couleur_primaire', v_e.couleur_primaire, 'couleur_secondaire', v_e.couleur_secondaire,
      'adresse', v_e.adresse, 'ville', v_e.ville,
      'telephone', v_e.telephone, 'email', v_e.email,
      'type_etablissement', v_e.type_etablissement),

    'identite', coalesce((select pa.valeur from parametres pa
                           where pa.ecole_id = v_f.ecole_id and pa.cle = 'identite_legale'), '{}'::jsonb),
    'mobile',   coalesce((select pa.valeur from parametres pa
                           where pa.ecole_id = v_f.ecole_id and pa.cle = 'paiement_mobile'), '{}'::jsonb)
  );
end $$;

revoke execute on function public.enfant_facture_detail(uuid) from public, anon;
grant execute on function public.enfant_facture_detail(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • parent : enfant_facture_detail(<facture de SON enfant>) → jsonb complet
--   • parent : enfant_facture_detail(<facture d'un autre élève>) → « Accès refusé. »
--   • anon   : exécution refusée
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.enfant_facture_detail(uuid);
