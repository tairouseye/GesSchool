-- =====================================================================
--  132 — Dossier étudiant : les champs d'en-tête de l'établissement
--
--  Le relevé de notes imprimable porte un en-tête officiel (logo, nom,
--  adresse, ville, pays) et la mention « Fait à <ville>, le … ». Côté
--  personnel ces champs viennent de `useAuth().ecole` ; côté étudiant cette
--  valeur est NULL (son `profils.ecole_id` l'est aussi), et le relevé
--  s'imprimait donc sans adresse ni ville.
--
--  ⚠️ `create or replace` refuse de modifier le type de retour d'une
--  fonction `returns table(...)` — piège déjà rencontré en 114 et 131.
--  D'où le `drop` préalable.
--
--  Prérequis : migration 131.
-- =====================================================================

drop function if exists public.mon_dossier_etudiant();

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
  annee      text,
  adresse    text,
  ville      text,
  pays       text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.ecole_id, e.prenom, e.nom, e.matricule,
         i.filiere_id, f.nom, i.niveau,
         ec.nom, ec.sigle, coalesce(ec.devise, 'XOF'), ec.logo_url,
         e.photo_url, an.libelle,
         ec.adresse, ec.ville, ec.pays
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

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.mon_dossier_etudiant();
-- puis réappliquer la migration 131.
