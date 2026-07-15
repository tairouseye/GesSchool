-- =====================================================================
--  053 — Année du matricule pilotable par le promoteur
--
--  Le matricule {PRÉFIXE}{SÉP}{AA}{SÉP}{SÉQ} utilisait l'année CIVILE courante
--  (26 en 2026) : deux élèves d'une même rentrée pouvaient recevoir un « AA »
--  différent selon leur date de saisie (sept. 2025 → 25, jan. 2026 → 26).
--  On ajoute ecoles.matricule_annee : si renseigné, il fixe l'année du
--  matricule ; sinon on garde l'année civile courante (comportement d'origine).
-- =====================================================================

alter table ecoles add column if not exists matricule_annee integer;

create or replace function prochain_matricule()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_ecole    uuid := ecole_courante();
  v_an       integer;
  v_an_cfg   integer;
  v_prefixe  text;
  v_sep      text;
  v_long     integer;
  v_seq      integer;
begin
  if v_ecole is null then
    raise exception 'Aucune école courante';
  end if;

  select coalesce(matricule_prefixe, ''), coalesce(matricule_separateur, '-'),
         greatest(coalesce(matricule_longueur, 4), 1), matricule_annee
    into v_prefixe, v_sep, v_long, v_an_cfg
    from ecoles where id = v_ecole;

  -- Année configurée par le promoteur, sinon année civile courante.
  v_an := coalesce(v_an_cfg, extract(year from current_date)::int);

  insert into matricule_compteurs (ecole_id, annee, dernier)
  values (v_ecole, v_an, 1)
  on conflict (ecole_id, annee)
    do update set dernier = matricule_compteurs.dernier + 1
  returning dernier into v_seq;

  return
    case when v_prefixe <> '' then v_prefixe || v_sep else '' end
    || lpad((v_an % 100)::text, 2, '0') || v_sep
    || lpad(v_seq::text, v_long, '0');
end;
$$;
