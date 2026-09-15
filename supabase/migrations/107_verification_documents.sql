-- =====================================================================
--  107 — Authentification des documents par QR code
--
--  Chaque document officiel (facture/reçu, bulletin de notes, bulletin de
--  paie, reçu de dépense, certificat/attestation) porte un QR code renvoyant
--  vers la page publique /verifier. Cette page appelle `verifier_document`,
--  qui, à partir d'un code opaque (type~identifiant), va lire la SOURCE du
--  document et renvoie un résumé d'attestation MINIMAL (aucune donnée
--  sensible : ni détail de notes par matière, ni téléphone, ni ligne de paie).
--
--  Sécurité :
--   • SECURITY DEFINER + STABLE : la fonction lit les tables métier en
--     contournant la RLS, mais UNIQUEMENT par identifiant exact (UUID
--     non devinable) et ne retourne que quelques champs publics.
--   • Accessible à `anon` (le vérificateur n'a pas de compte).
--   • Aucune écriture : rien n'est créé à l'impression ; les documents
--     historiques sont vérifiables sans reprise de données.
-- =====================================================================

create or replace function verifier_document(p_code text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_type text := split_part(coalesce(p_code, ''), '~', 1);
  v_a    text := split_part(coalesce(p_code, ''), '~', 2);
  v_b    text := split_part(coalesce(p_code, ''), '~', 3);
  v_bid  uuid;
  v_res  jsonb;
begin
  if v_type = '' or v_a = '' then
    return jsonb_build_object('ok', false);
  end if;

  begin
    if v_type = 'facture' then
      select jsonb_build_object(
        'ok', true, 'type', 'facture', 'titre', 'Facture / Reçu',
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(trim(coalesce(el.prenom,'') || ' ' || coalesce(el.nom,'')), ''),
        'reference', coalesce(f.numero, left(f.id::text, 8)),
        'date', f.date_emission, 'montant', f.montant_total,
        'devise', coalesce(e.devise, 'XOF'), 'statut', f.statut::text,
        'extra', jsonb_build_object('montant_paye', f.montant_paye, 'matricule', el.matricule)
      )
      into v_res
      from factures f
      join ecoles e on e.id = f.ecole_id
      left join eleves el on el.id = f.eleve_id
      where f.id = v_a::uuid;

    elsif v_type = 'bulletin' then
      -- Deux formes : bulletin~<bulletin_id> (espace parent) ou
      -- bulletin~<eleve_id>~<periode_id> (espace gestion). On résout d'abord
      -- l'id du bulletin (évite de caster une chaîne vide en uuid).
      if v_b = '' then
        v_bid := v_a::uuid;
      else
        select b0.id into v_bid from bulletins b0
        where b0.eleve_id = v_a::uuid and b0.periode_id = v_b::uuid;
      end if;

      select jsonb_build_object(
        'ok', true, 'type', 'bulletin', 'titre', 'Bulletin de notes',
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(trim(coalesce(el.prenom,'') || ' ' || coalesce(el.nom,'')), ''),
        'reference', pe.libelle, 'date', b.genere_le, 'montant', null,
        'devise', coalesce(e.devise, 'XOF'), 'statut', null,
        'extra', jsonb_build_object(
          'classe', c.libelle, 'periode', pe.libelle, 'matricule', el.matricule,
          'moyenne', b.moyenne_generale, 'mention', b.mention,
          'rang', b.rang, 'effectif', b.effectif)
      )
      into v_res
      from bulletins b
      join ecoles e on e.id = b.ecole_id
      left join eleves el on el.id = b.eleve_id
      left join classes c on c.id = b.classe_id
      left join periodes pe on pe.id = b.periode_id
      where b.id = v_bid;

    elsif v_type = 'paie' then
      select jsonb_build_object(
        'ok', true, 'type', 'paie', 'titre', 'Bulletin de paie',
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), ''),
        'reference', s.periode, 'date', s.date_paiement, 'montant', s.montant_net,
        'devise', coalesce(e.devise, 'XOF'),
        'statut', case when s.paye then 'payé' else 'non payé' end,
        'extra', jsonb_build_object('fonction', p.fonction, 'periode', s.periode)
      )
      into v_res
      from salaires s
      join ecoles e on e.id = s.ecole_id
      left join personnels p on p.id = s.personnel_id
      where s.id = v_a::uuid;

    elsif v_type = 'depense' then
      select jsonb_build_object(
        'ok', true, 'type', 'depense', 'titre', 'Reçu de dépense',
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(d.beneficiaire, ''),
        'reference', coalesce(nullif(d.libelle, ''), left(d.id::text, 8)),
        'date', d.date_depense, 'montant', d.montant,
        'devise', coalesce(e.devise, 'XOF'), 'statut', null,
        'extra', jsonb_build_object('libelle', d.libelle, 'categorie', d.categorie)
      )
      into v_res
      from depenses d
      join ecoles e on e.id = d.ecole_id
      where d.id = v_a::uuid;

    elsif v_type = 'doc' then
      -- Certificat / attestation : seulement s'il est validé (ou archivé/généré).
      select jsonb_build_object(
        'ok', true, 'type', 'doc', 'titre', coalesce(nullif(dc.titre, ''), 'Document officiel'),
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(trim(coalesce(el.prenom,'') || ' ' || coalesce(el.nom,'')), ''),
        'reference', dc.reference,
        'date', coalesce(dc.date_doc, dc.valide_le::date, dc.created_at::date),
        'montant', dc.montant, 'devise', coalesce(e.devise, 'XOF'), 'statut', dc.statut,
        'extra', jsonb_build_object('type_doc', dc.type)
      )
      into v_res
      from documents dc
      join ecoles e on e.id = dc.ecole_id
      left join eleves el on el.id = dc.eleve_id
      where dc.id = v_a::uuid
        and dc.statut in ('valide', 'archive', 'genere');

    else
      return jsonb_build_object('ok', false);
    end if;
  exception when others then
    -- UUID mal formé ou toute autre erreur → non authentifié (jamais d'exception publique).
    return jsonb_build_object('ok', false);
  end;

  return coalesce(v_res, jsonb_build_object('ok', false));
end;
$$;

comment on function verifier_document(text) is
  'Authentification publique d''un document officiel via son QR code. Lecture seule, résumé minimal.';

grant execute on function verifier_document(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists verifier_document(text);
