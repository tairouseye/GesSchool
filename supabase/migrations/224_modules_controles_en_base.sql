-- =====================================================================
--  224 — Les modules souscrits sont contrôlés PAR LA BASE
--
--  LE TROU (audit sécurité du 02/11/2026) : un module non souscrit
--  disparaissait du menu, mais rien n'empêchait d'appeler son API
--  directement. Aucune règle ni fonction ne lisait `ecoles.modules_actifs`.
--
--  LE CORRECTIF tient en un point : `a_acces(clé)`, par où passent déjà
--  les droits de ~300 règles et fonctions, répond NON pour une clé dont le
--  module n'est pas souscrit — au promoteur comme à son personnel. Seul le
--  super-administrateur passe outre.
--
--  LA CARTE clé → module est GÉNÉRÉE depuis src/lib/modules.js (MODULES) et
--  src/lib/acces.js (FUSIONS) ; test/acces.test.mjs refuse qu'elles
--  divergent. Une boîte n'est rattachée à un module que si TOUTES ses pages
--  en font partie : `presence_vie` mêle l'appel du supérieur (cœur) et celui
--  du primaire (Vie scolaire) — elle reste donc hors module, comme à l'écran.
--  Règle d'or : la base ne bloque JAMAIS ce que l'interface montre.
--
--  Ce qui n'est PAS couvert : les chemins des familles (parents, étudiants),
--  qui ne passent pas par a_acces ; les vieilles gardes par rôle
--  (est_admin, est_gestion) ; la bibliothèque, gardée par _biblio_gestion.
--
--  modules_actifs NULL = tous les modules (comportement historique).
-- =====================================================================

--  Généré depuis le JS — ne pas éditer à la main (voir test/acces.test.mjs).
create or replace function public._module_de_cle(p_cle text)
returns text language sql immutable parallel safe set search_path = public as $fn$
  select case p_cle
    when '_pilotage' then 'pilotage'
    when 'annonces' then 'communication'
    when 'appel' then 'vie_scolaire'
    when 'assiduite' then 'vie_scolaire'
    when 'biblio_acquisitions' then 'bibliotheque'
    when 'biblio_circulation' then 'bibliotheque'
    when 'biblio_depots' then 'memoires_theses'
    when 'biblio_inventaire' then 'bibliotheque'
    when 'biblio_numerique' then 'bibliotheque_numerique'
    when 'bibliotheque' then 'bibliotheque'
    when 'bulletins' then 'evaluations'
    when 'cahier' then 'vie_scolaire'
    when 'cantine' then 'cantine'
    when 'certificats' then 'scolarite'
    when 'classement' then 'evaluations'
    when 'comptabilite' then 'comptabilite'
    when 'demandes' then 'scolarite'
    when 'eleves' then 'scolarite'
    when 'emploi' then 'vie_scolaire'
    when 'encaissement' then 'encaissement'
    when 'enseignants' then 'scolarite'
    when 'fournitures' then 'vie_scolaire'
    when 'messagerie' then 'communication'
    when 'notes' then 'evaluations'
    when 'notes_bulletins' then 'evaluations'
    when 'paiements' then 'encaissement'
    when 'progression' then 'vie_scolaire'
    when 'recouvrement' then 'encaissement'
    when 'rh' then 'rh'
    when 'situation_paiements' then 'encaissement'
    when 'structure' then 'scolarite'
    when 'transport' then 'transport'
    when 'vie_scolaire' then 'vie_scolaire'
  end
$fn$;

--  Le module de cette clé est-il souscrit par l'école courante ?
create or replace function public._module_ouvert(p_cle text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public._module_de_cle(p_cle) is null
      or coalesce((select e.modules_actifs is null or public._module_de_cle(p_cle) = any(e.modules_actifs)
                     from ecoles e where e.id = public.ecole_courante()), true)
$fn$;
revoke execute on function public._module_ouvert(text) from public, anon;
grant execute on function public._module_ouvert(text) to authenticated;

--  Reprend la version en vigueur (mig. 175) ; seule la condition de module
--  est ajoutée, et elle s'applique AUSSI au promoteur.
create or replace function public.a_acces(p_cle text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_cle is not null and auth.uid() is not null and (
    est_super_admin()
    or (public._module_ouvert(p_cle) and (
          a_role('admin_ecole')
          or exists (
            select 1 from personnel_acces pa
             where pa.profil_id = auth.uid()
               and pa.ecole_id = ecole_courante()
               and pa.boite = public.boite_de_cle(p_cle)
          )))
  );
$fn$;

-- --- Retour arrière ---------------------------------------------------------------
-- Réappliquer a_acces sans `public._module_ouvert(p_cle) and (…)`, puis :
-- drop function if exists public._module_ouvert(text);
-- drop function if exists public._module_de_cle(text);
