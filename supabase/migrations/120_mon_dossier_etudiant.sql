-- =====================================================================
--  120 — RPC « mon dossier étudiant »
--
--  POURQUOI : un étudiant a `profils.ecole_id = NULL` (comme un parent), donc
--  `ecole_courante()` renvoie NULL et le client ne connaît pas son école.
--  Sans cette RPC, l'espace étudiant ne peut RIEN interroger (il ne sait pas
--  sur quel `ecole_id` filtrer).
--
--  Résout l'établissement ET le cursus depuis `eleves.profil_id = auth.uid()`
--  — même patron que `mes_demandes_acces()` (114). Générique : utile à tout
--  futur écran étudiant, pas seulement à la bibliothèque.
--
--  SECURITY DEFINER + filtre sur auth.uid() : un étudiant ne peut obtenir que
--  SON propre dossier (fail-closed : aucune ligne s'il n'est lié à aucune fiche).
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
  niveau     text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.ecole_id, e.prenom, e.nom, e.matricule,
         i.filiere_id, f.nom, i.niveau
  from eleves e
  left join inscriptions_sup i
    on i.eleve_id = e.id and i.statut = 'active'
  left join filieres f on f.id = i.filiere_id
  where e.profil_id = auth.uid()
  order by i.created_at desc nulls last
  limit 1;
$$;

comment on function public.mon_dossier_etudiant() is
  'École + cursus de l''étudiant connecté (profils.ecole_id étant NULL pour lui).';

revoke execute on function public.mon_dossier_etudiant() from public, anon;
grant execute on function public.mon_dossier_etudiant() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.mon_dossier_etudiant();
