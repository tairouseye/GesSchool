-- =====================================================================
--  122 — Bibliothèque : STATISTIQUES (tableau de bord)
--
--  Une RPC unique qui agrège TOUT EN BASE et renvoie un seul jsonb.
--
--  Pourquoi une RPC et pas des `count()` côté client :
--    • le classement des ouvrages les plus empruntés exige un GROUP BY —
--      le faire au navigateur imposerait de télécharger tous les emprunts,
--      exactement ce que ce module s'interdit (cf. 117 : pagination serveur) ;
--    • un seul aller-retour au lieu d'une dizaine.
--
--  Sécurité : SECURITY DEFINER + garde `_biblio_gestion()` explicite, donc
--  l'agrégat ne peut pas servir à sonder les données d'un autre établissement.
--
--  Prérequis : migrations 117 → 121.
-- =====================================================================

create or replace function public.biblio_statistiques(
  p_ecole  uuid,
  p_depuis date default (current_date - 365)
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not _biblio_gestion(p_ecole) then
    raise exception 'Réservé à la gestion de la bibliothèque.';
  end if;

  select jsonb_build_object(
    -- --- Fonds ---------------------------------------------------------
    'ressources', (select count(*) from biblio_ressources where ecole_id = p_ecole),
    'exemplaires', (select count(*) from biblio_exemplaires where ecole_id = p_ecole),
    'exemplaires_disponibles', (select count(*) from biblio_exemplaires
                                 where ecole_id = p_ecole and statut = 'disponible'),
    'numeriques', (select count(*) from biblio_numeriques where ecole_id = p_ecole),

    -- --- Circulation ---------------------------------------------------
    'emprunts_en_cours', (select count(*) from biblio_emprunts
                           where ecole_id = p_ecole and statut = 'en_cours'),
    'emprunts_en_retard', (select count(*) from biblio_emprunts
                            where ecole_id = p_ecole and statut = 'en_cours'
                              and date_echeance < current_date),
    'emprunts_periode', (select count(*) from biblio_emprunts
                          where ecole_id = p_ecole and date_emprunt >= p_depuis),
    'reservations_actives', (select count(*) from biblio_reservations
                              where ecole_id = p_ecole and statut in ('active', 'disponible')),

    -- --- Dépôt institutionnel ------------------------------------------
    'depots_a_traiter', (select count(*) from biblio_depots
                          where ecole_id = p_ecole and statut in ('soumis', 'verification')),
    'depots_publies', (select count(*) from biblio_depots
                        where ecole_id = p_ecole and statut = 'publie'),

    -- --- Pénalités ------------------------------------------------------
    'penalites_dues', (select coalesce(sum(montant), 0) from biblio_penalites
                        where ecole_id = p_ecole and statut = 'due'),

    -- --- Ouvrages les plus empruntés sur la période ----------------------
    'top_ouvrages', coalesce((
      select jsonb_agg(t) from (
        select r.titre, count(*) as emprunts
          from biblio_emprunts e
          join biblio_exemplaires x on x.id = e.exemplaire_id
          join biblio_ressources  r on r.id = x.ressource_id
         where e.ecole_id = p_ecole and e.date_emprunt >= p_depuis
         group by r.id, r.titre
         order by count(*) desc, r.titre
         limit 5
      ) t), '[]'::jsonb),

    -- --- Volume mensuel (12 derniers mois, mois vides inclus) ------------
    'par_mois', coalesce((
      select jsonb_agg(t order by t.mois) from (
        select to_char(m.mois, 'YYYY-MM') as mois,
               (select count(*) from biblio_emprunts e
                 where e.ecole_id = p_ecole
                   and e.date_emprunt >= m.mois
                   and e.date_emprunt < m.mois + interval '1 month') as emprunts
          from generate_series(date_trunc('month', current_date) - interval '11 months',
                               date_trunc('month', current_date),
                               interval '1 month') as m(mois)
      ) t), '[]'::jsonb)
  ) into v;

  return v;
end $$;

revoke execute on function public.biblio_statistiques(uuid, date) from public, anon;
grant execute on function public.biblio_statistiques(uuid, date) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.biblio_statistiques(uuid, date);
