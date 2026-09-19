-- =====================================================================
--  131 — Carte d'étudiant vérifiable + devise au dossier étudiant
--
--  1. `mon_dossier_etudiant()` gagne le nom de l'établissement, sa devise,
--     l'année académique et la photo. La devise manquait : l'espace étudiant
--     affichait « XOF » en dur, faux pour un établissement en USD ou CDF
--     (`useAuth().ecole` est NULL pour un étudiant, son `profils.ecole_id`
--     l'étant aussi).
--
--  2. `verifier_document()` reçoit une branche « etu » : une carte
--     d'étudiant devient authentifiable par QR, comme les factures, bulletins
--     et relevés. La fonction est REPRODUITE EN ENTIER — `create or replace`
--     remplace tout le corps, il ne s'agit pas d'y ajouter une ligne.
--     Toutes les branches de la 111 sont conservées à l'identique.
--
--  ⚠️ Cette vérification est PUBLIQUE (anon). La branche « etu » n'expose
--  que ce qui figure déjà sur une carte physique : nom, matricule, filière,
--  établissement — et uniquement si l'inscription est ACTIVE. Un étudiant
--  radié ou d'une année révolue renvoie « non valide », ce qui est
--  précisément l'intérêt du contrôle.
--
--  Prérequis : migrations 111 et 120.
-- =====================================================================

create or replace function public.mon_dossier_etudiant()
returns table(
  eleve_id   uuid,
  ecole_id   uuid,
  prenom     text,
  nom        text,
  matricule  text,
  filiere_id uuid,
  filiere    text,
  niveau     text,
  ecole      text,
  sigle      text,
  devise     text,
  logo_url   text,
  photo_url  text,
  annee      text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.ecole_id, e.prenom, e.nom, e.matricule,
         i.filiere_id, f.nom, i.niveau,
         ec.nom, ec.sigle, coalesce(ec.devise, 'XOF'), ec.logo_url,
         e.photo_url, an.libelle
  from eleves e
  join ecoles ec on ec.id = e.ecole_id
  left join inscriptions_sup i
    on i.eleve_id = e.id and i.statut = 'active'
  left join filieres f on f.id = i.filiere_id
  left join annees_scolaires an on an.id = i.annee_id
  where e.profil_id = auth.uid()
  order by i.created_at desc nulls last
  limit 1;
$$;

-- =====================================================================
--  Vérification publique — branches 107 + 111 + « etu »
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
          'moyenne', b.moyenne_generale, 'mention', b.mention, 'rang', b.rang, 'effectif', b.effectif)
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

    elsif v_type = 'releve' then
      select jsonb_build_object(
        'ok', true, 'type', 'releve', 'titre', 'Relevé de notes',
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(trim(coalesce(el.prenom,'') || ' ' || coalesce(el.nom,'')), ''),
        'reference', s.libelle, 'date', d.date_delib, 'montant', null,
        'devise', coalesce(e.devise, 'XOF'), 'statut', r.decision,
        'extra', jsonb_build_object(
          'filiere', fi.nom, 'niveau', d.niveau, 'moyenne', r.moyenne, 'mention', r.mention,
          'credits', (r.credits_acquis::text || '/' || r.credits_total::text))
      )
      into v_res
      from releves r
      join deliberations d on d.id = r.deliberation_id
      join ecoles e on e.id = r.ecole_id
      left join eleves el on el.id = r.eleve_id
      left join filieres fi on fi.id = d.filiere_id
      left join semestres s on s.id = d.semestre_id
      where r.id = v_a::uuid;

    -- NOUVEAU — carte d'étudiant. Ne répond QUE si l'inscription est active :
    -- une carte périmée doit se signaler comme telle.
    elsif v_type = 'etu' then
      select jsonb_build_object(
        'ok', true, 'type', 'etu', 'titre', 'Carte d''étudiant',
        'ecole', e.nom, 'sigle', e.sigle, 'ville', e.ville,
        'beneficiaire', nullif(trim(coalesce(el.prenom,'') || ' ' || coalesce(el.nom,'')), ''),
        'reference', el.matricule, 'date', i.date_inscription, 'montant', null,
        'devise', coalesce(e.devise, 'XOF'), 'statut', 'Inscription active',
        'extra', jsonb_build_object(
          'matricule', el.matricule, 'filiere', fi.nom,
          'niveau', i.niveau, 'annee', an.libelle)
      )
      into v_res
      from eleves el
      join ecoles e on e.id = el.ecole_id
      join inscriptions_sup i on i.eleve_id = el.id and i.statut = 'active'
      left join filieres fi on fi.id = i.filiere_id
      left join annees_scolaires an on an.id = i.annee_id
      where el.id = v_a::uuid
      order by i.created_at desc
      limit 1;

    elsif v_type = 'doc' then
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
    return jsonb_build_object('ok', false);
  end;

  return coalesce(v_res, jsonb_build_object('ok', false));
end;
$$;

grant execute on function verifier_document(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- Réappliquer la migration 111 (verifier_document sans la branche « etu »)
-- et la 120 (mon_dossier_etudiant sans la devise).
