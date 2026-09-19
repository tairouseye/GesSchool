-- =====================================================================
--  129 — Espace étudiant : SES notes et SES relevés
--
--  Constat : `notes_lmd`, `deliberations` et `releves` se lisent avec
--  `ecole_id = ecole_courante()`. Or `profils.ecole_id` est NULL pour un
--  étudiant, donc `ecole_courante()` aussi : il n'existait AUCUN chemin de
--  lecture vers ses propres notes. L'espace étudiant se limitait à la
--  bibliothèque, alors qu'un étudiant vient d'abord y chercher ses résultats.
--
--  Pourquoi des RPC et non de nouvelles policies : afficher un relevé lisible
--  exige aussi `ue`, `ecue`, `semestres` et `filieres`, toutes fermées de la
--  même façon. Ouvrir cinq tables de plus élargirait la surface bien au-delà
--  du besoin ; deux fonctions qui renvoient exactement le nécessaire sont
--  plus sûres et plus faciles à auditer. Même patron que
--  `mon_dossier_etudiant()` (mig. 120) et `enfant_notes` (parents).
--
--  ⚠️ Règle de publication retenue :
--    • NOTES : l'étudiant voit les siennes dès la saisie. Il est le sujet de
--      la donnée, et attendre la délibération rendrait l'espace inutile
--      pendant tout le semestre.
--    • RELEVÉS : uniquement ceux marqués `valide`. Un relevé non validé est
--      un document de travail du jury — le diffuser serait une faute.
--  Si l'université veut masquer les notes avant délibération, c'est ici que
--  la règle se change (une seule condition à ajouter).
--
--  Prérequis : migrations 108 → 113.
-- =====================================================================

-- --- Mes notes, par semestre et par UE ------------------------------------
create or replace function public.mes_notes_lmd()
returns table (
  inscription_id  uuid,
  annee           text,
  filiere         text,
  niveau          text,
  semestre_id     uuid,
  semestre        text,
  semestre_ordre  integer,
  credits_requis  integer,
  ue_id           uuid,
  ue_code         text,
  ue_intitule     text,
  ue_credits      numeric,
  ue_coefficient  numeric,
  ecue_id         uuid,
  ecue_code       text,
  ecue_intitule   text,
  ecue_credits    numeric,
  ecue_coefficient numeric,
  session         text,
  cc              numeric,
  examen          numeric
)
language sql stable security definer set search_path = public as $$
  select
    i.id, a.libelle, f.nom, i.niveau,
    s.id, s.libelle, s.ordre, s.credits_requis,
    u.id, u.code, u.intitule, u.credits, u.coefficient,
    ec.id, ec.code, ec.intitule, ec.credits, ec.coefficient,
    n.session, n.cc, n.examen
  from notes_lmd n
  join inscriptions_sup i on i.id = n.inscription_id
  join eleves e          on e.id = i.eleve_id
  join ue u              on u.id = n.ue_id
  join semestres s       on s.id = u.semestre_id
  join filieres f        on f.id = i.filiere_id
  left join ecue ec      on ec.id = n.ecue_id
  left join annees_scolaires a on a.id = i.annee_id
  where e.profil_id = auth.uid()          -- ← le seul filtre qui compte
  order by s.ordre, u.ordre, ec.ordre nulls first;
$$;

revoke execute on function public.mes_notes_lmd() from public, anon;
grant execute on function public.mes_notes_lmd() to authenticated;

-- --- Mes relevés VALIDÉS ---------------------------------------------------
create or replace function public.mes_releves()
returns table (
  id             uuid,
  ecole_id       uuid,
  semestre       text,
  filiere        text,
  niveau         text,
  session        text,
  annee          text,
  date_delib     date,
  moyenne        numeric,
  credits_acquis integer,
  credits_total  integer,
  decision       text,
  mention        text,
  details        jsonb
)
language sql stable security definer set search_path = public as $$
  select
    r.id, r.ecole_id, s.libelle, f.nom, d.niveau, d.session,
    a.libelle, d.date_delib,
    r.moyenne, r.credits_acquis, r.credits_total, r.decision, r.mention, r.details
  from releves r
  join eleves e        on e.id = r.eleve_id
  join deliberations d on d.id = r.deliberation_id
  join semestres s     on s.id = d.semestre_id
  join filieres f      on f.id = d.filiere_id
  left join annees_scolaires a on a.id = d.annee_id
  where e.profil_id = auth.uid()
    and r.valide                          -- jamais un document de travail du jury
  order by d.date_delib desc, s.ordre desc;
$$;

revoke execute on function public.mes_releves() from public, anon;
grant execute on function public.mes_releves() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.mes_notes_lmd();
-- drop function if exists public.mes_releves();
