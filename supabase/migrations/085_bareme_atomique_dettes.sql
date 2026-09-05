-- =====================================================================
--  085 — Audit : import barème atomique (#6) + dettes personnel (#8)
--  #6 : remplacer_bareme() fait delete+insert dans UNE transaction → plus de
--       barème partiel en cas d'échec en cours d'import.
--  #8 : dettes_personnel() renvoie l'agrégat des salaires validés non payés,
--       accessible au comptable/gestion/RH (SECURITY DEFINER contourne la RLS
--       de `salaires` réservée à la RH, pour le tableau de bord comptable).
-- =====================================================================

-- Filet de sécurité : garantit la colonne salaires.statut (normalement posée par
-- la 079). `if not exists` = no-op si elle est déjà là ; le backfill ne touche
-- QUE les lignes à NULL (n'écrase aucun statut existant : brouillon/valide/paye).
alter table salaires add column if not exists statut text default 'brouillon';
update salaires set statut = case when paye then 'paye' else 'brouillon' end where statut is null;

create or replace function remplacer_bareme(p_ecole uuid, p_periodicite text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (est_super_admin() or (ecole_courante() = p_ecole and (est_gestion() or a_role('rh') or a_role('comptable')))) then
    raise exception 'Accès refusé.';
  end if;
  if p_periodicite not in ('mensuel', 'annuel') then raise exception 'Périodicité invalide.'; end if;

  delete from bareme_ir where ecole_id = p_ecole and periodicite = p_periodicite;
  insert into bareme_ir (ecole_id, periodicite, revenu, trimf, ir)
  select p_ecole, p_periodicite,
         (r->>'revenu')::numeric,
         coalesce((r->>'trimf')::numeric, 0),
         coalesce(r->'ir', '{}'::jsonb)
  from jsonb_array_elements(p_rows) r
  where (r->>'revenu') is not null;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function remplacer_bareme(uuid, text, jsonb) to authenticated;

create or replace function dettes_personnel(p_ecole uuid)
returns numeric language sql security definer set search_path = public stable as $$
  select coalesce(sum(montant_net), 0)::numeric
  from salaires
  where ecole_id = p_ecole and statut = 'valide'
    and (est_super_admin() or (ecole_courante() = p_ecole and (est_gestion() or a_role('rh') or a_role('comptable'))));
$$;

grant execute on function dettes_personnel(uuid) to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists remplacer_bareme(uuid, text, jsonb);
-- drop function if exists dettes_personnel(uuid);
