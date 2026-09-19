-- =====================================================================
--  136 — PHASE 2 : liste paginée des factures
--
--  La page Paiements chargeait TOUTES les factures de l'année, puis
--  filtrait en mémoire. Intenable dès quelques milliers de factures.
--
--  Pourquoi une RPC et non un simple `.range()` : la recherche porte à la
--  fois sur la facture (`numero`) et sur l'élève embarqué (`nom`, `prenom`,
--  `matricule`). PostgREST REFUSE de mêler une colonne de la table et une
--  colonne embarquée dans un même `or()` — vérifié sur la base :
--    PGRST100 « failed to parse logic tree ».
--  Le OU doit donc s'écrire en SQL.
--
--  La fonction renvoie `{ total, lignes }` : le total vient d'un COUNT sur
--  le même filtre, sinon la pagination afficherait un nombre de pages faux.
--
--  Sécurité : `SECURITY DEFINER` contourne la RLS, la garde reproduit donc
--  EXACTEMENT celle posée sur `factures` par la migration 133 — sans quoi
--  cette fonction rouvrirait la fuite que la phase 0 vient de fermer.
--
--  Prérequis : migration 133.
-- =====================================================================

create or replace function public.factures_paginees(
  p_ecole  uuid,
  p_annee  uuid    default null,
  p_q      text    default null,
  p_statut text    default null,
  p_page   integer default 0,
  p_taille integer default 25
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_total  bigint;
  v_lignes jsonb;
  v_q      text := nullif(btrim(coalesce(p_q, '')), '');
  v_t      integer := least(greatest(coalesce(p_taille, 25), 1), 100);  -- jamais illimité
  v_off    integer := greatest(coalesce(p_page, 0), 0) * v_t;
begin
  if not (est_super_admin()
          or (p_ecole = ecole_courante()
              and (est_admin() or a_role('comptable') or a_role('secretaire')))) then
    raise exception 'Réservé à la gestion de l''établissement.';
  end if;

  with filtre as (
    select f.*, e.prenom, e.nom, e.matricule
      from factures f
      left join eleves e on e.id = f.eleve_id
     where f.ecole_id = p_ecole
       and (p_annee is null or f.annee_id = p_annee)
       and (p_statut is null or f.statut::text = p_statut)
       and (v_q is null
            or f.numero    ilike '%' || v_q || '%'
            or e.nom       ilike '%' || v_q || '%'
            or e.prenom    ilike '%' || v_q || '%'
            or e.matricule ilike '%' || v_q || '%')
  )
  select count(*) into v_total from filtre;

  with filtre as (
    select f.*, e.prenom, e.nom, e.matricule
      from factures f
      left join eleves e on e.id = f.eleve_id
     where f.ecole_id = p_ecole
       and (p_annee is null or f.annee_id = p_annee)
       and (p_statut is null or f.statut::text = p_statut)
       and (v_q is null
            or f.numero    ilike '%' || v_q || '%'
            or e.nom       ilike '%' || v_q || '%'
            or e.prenom    ilike '%' || v_q || '%'
            or e.matricule ilike '%' || v_q || '%')
     order by date_emission desc, numero desc
     limit v_t offset v_off
  )
  select coalesce(jsonb_agg(to_jsonb(filtre)), '[]'::jsonb) into v_lignes from filtre;

  return jsonb_build_object('total', v_total, 'lignes', v_lignes);
end $$;

revoke execute on function public.factures_paginees(uuid, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.factures_paginees(uuid, uuid, text, text, integer, integer)
  to authenticated;

-- --- Index de tri et de filtre --------------------------------------------
--  La liste se trie par date d'émission décroissante, filtrée par école et
--  année : sans cet index, chaque page relit toute la table.
create index if not exists factures_liste_idx
  on factures(ecole_id, annee_id, date_emission desc);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.factures_paginees(uuid, uuid, text, text, integer, integer);
-- drop index if exists factures_liste_idx;
