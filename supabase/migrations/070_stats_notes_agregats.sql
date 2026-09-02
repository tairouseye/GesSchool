-- 070 — Agrégats de notes côté serveur (perf tableau de bord).
--
-- Avant : le tableau de bord chargeait TOUTES les notes de l'école (toutes
-- années confondues) dans le navigateur pour n'en tirer qu'une moyenne.
-- Ça grossit sans fin et transfère des dizaines de milliers de lignes.
-- Ici, Postgres calcule l'agrégat et ne renvoie que quelques chiffres, en
-- filtrant sur l'ANNÉE (via la période de l'évaluation).
--
-- Sécurité : SECURITY DEFINER (contourne la RLS) → on RESTREINT explicitement
-- à l'école du demandeur (ou super-admin). Un appel hors périmètre ne renvoie
-- aucune donnée.

-- Moyenne générale de l'établissement (notes ramenées sur /20), pour une année.
create or replace function public.moyenne_notes_ecole(p_ecole uuid, p_annee uuid)
returns table(moyenne numeric, n bigint)
language sql security definer set search_path = public stable as $$
  select
    avg((nt.valeur / nullif(e.bareme, 0)) * 20)::numeric as moyenne,
    count(*)::bigint as n
  from notes nt
  join evaluations e on e.id = nt.evaluation_id
  join periodes p on p.id = e.periode_id
  where nt.ecole_id = p_ecole
    and nt.absent = false and nt.valeur is not null
    and (p_annee is null or p.annee_id = p_annee)
    and (public.est_super_admin() or public.ecole_courante() = p_ecole);
$$;

-- Moyenne par niveau scolaire (tableau de bord pédagogie), pour une année.
create or replace function public.moyenne_notes_par_niveau(p_ecole uuid, p_annee uuid)
returns table(niveau_id uuid, moyenne numeric, n bigint)
language sql security definer set search_path = public stable as $$
  select c.niveau_id,
         avg((nt.valeur / nullif(e.bareme, 0)) * 20)::numeric as moyenne,
         count(*)::bigint as n
  from notes nt
  join evaluations e on e.id = nt.evaluation_id
  join classes c on c.id = e.classe_id
  join periodes p on p.id = e.periode_id
  where nt.ecole_id = p_ecole
    and nt.absent = false and nt.valeur is not null
    and c.niveau_id is not null
    and (p_annee is null or p.annee_id = p_annee)
    and (public.est_super_admin() or public.ecole_courante() = p_ecole)
  group by c.niveau_id;
$$;

grant execute on function public.moyenne_notes_ecole(uuid, uuid) to authenticated;
grant execute on function public.moyenne_notes_par_niveau(uuid, uuid) to authenticated;

-- ANNULATION
-- drop function if exists public.moyenne_notes_ecole(uuid, uuid);
-- drop function if exists public.moyenne_notes_par_niveau(uuid, uuid);
