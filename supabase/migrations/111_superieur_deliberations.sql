-- =====================================================================
--  111 — Supérieur (LMD) : délibérations & relevés de notes
--
--  Une DÉLIBÉRATION fige (snapshot) les résultats d'un semestre pour une
--  cohorte (filière + niveau + session + année). Chaque étudiant obtient un
--  RELEVÉ (moyenne, crédits acquis/total, décision, mention + détail par UE),
--  authentifiable par QR (via verifier_document, type « releve »).
--
--  Additif et isolé. RLS multi-établissement.
-- =====================================================================

create table if not exists deliberations (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  filiere_id  uuid not null references filieres(id) on delete cascade,
  niveau      text,
  semestre_id uuid not null references semestres(id) on delete cascade,
  session     text not null default 'normale' check (session in ('normale','rattrapage')),
  annee_id    uuid references annees_scolaires(id) on delete set null,
  date_delib  date not null default current_date,
  verrouillee boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists deliberations_ecole_idx on deliberations(ecole_id);
create index if not exists deliberations_combo_idx on deliberations(filiere_id, niveau, semestre_id, session, annee_id);

create table if not exists releves (
  id              uuid primary key default gen_random_uuid(),
  ecole_id        uuid not null references ecoles(id) on delete cascade,
  deliberation_id uuid not null references deliberations(id) on delete cascade,
  inscription_id  uuid references inscriptions_sup(id) on delete set null,
  eleve_id        uuid references eleves(id) on delete set null,
  moyenne         numeric(5,2),
  credits_acquis  integer not null default 0,
  credits_total   integer not null default 0,
  decision        text,
  mention         text,
  valide          boolean not null default false,
  details         jsonb,           -- [{intitule, code, moyenne, credits, acquise}]
  created_at      timestamptz not null default now()
);
create index if not exists releves_ecole_idx on releves(ecole_id);
create index if not exists releves_delib_idx on releves(deliberation_id);

-- RLS : lecture = membre ; écriture = promoteur, direction ou gestion.
do $$
declare t text;
begin
  foreach t in array array['deliberations','releves']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      est_super_admin() or ecole_id = ecole_courante()
    );$p$, t, t);
    execute format('drop policy if exists %I_ecrire on %I;', t, t);
    execute format($p$create policy %I_ecrire on %I for all using (
      est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
    ) with check (
      est_super_admin() or (ecole_id = ecole_courante() and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
    );$p$, t, t);
  end loop;
end $$;

-- --- Extension de la vérification publique au type « releve » ---------
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
-- drop table if exists releves, deliberations cascade;
--  (verifier_document conserve la branche « releve » — sans table, elle
--   renvoie simplement ok:false ; réappliquer 107 pour la version d'origine.)
