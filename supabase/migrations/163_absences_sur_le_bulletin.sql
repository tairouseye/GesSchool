-- =====================================================================
--  163 — Les absences sur le bulletin, à partir du collège
--
--  Remonté en visite : le bulletin doit porter le nombre d'absences dès le
--  collège, et surtout PAS au préscolaire ni à l'élémentaire. Demande
--  explicite de l'école : « la logique doit être basée sur le niveau
--  scolaire et non codée en dur dans plusieurs composants ».
--
--  ⚠️ ET ELLE L'AURAIT ÉTÉ. Le bulletin s'imprime depuis DEUX composants
--  distincts — `BulletinImprimable` côté personnel, et un composant inline
--  dans l'espace parent. Y écrire deux fois « si le cycle n'est pas
--  préscolaire… », c'est garantir qu'un jour les deux divergeront. La règle
--  vit donc ICI, en base, et les deux côtés la consomment sans la redériver.
--
--  ⚠️ EXCLUSION PLUTÔT QU'INCLUSION. On n'énumère pas les cycles qui
--  affichent (second_cycle, lycee, formation_pro) mais ceux qui n'affichent
--  PAS : préscolaire et élémentaire. Un cycle ajouté demain héritera du
--  comportement attendu sans qu'on y pense.
--
--  ⚠️ UNE PÉRIODE SANS DATES NE DONNE PAS ZÉRO, ELLE NE DONNE RIEN.
--  17 des 20 périodes n'avaient aucune date avant la migration 162. Compter
--  « 0 absence » sur une période qu'on ne sait pas borner serait un mensonge,
--  et le pire : celui qui rassure. Les compteurs valent NULL, et l'écran
--  affiche une mention plutôt qu'un chiffre.
--
--  Prérequis : migrations 001, 114, 162.
-- =====================================================================

-- --- 1. Ce bulletin doit-il porter les absences ? -------------------------
create or replace function public.bulletin_affiche_absences(p_classe uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select cy.type not in ('prescolaire', 'premier_cycle')
       from classes c
       join niveaux n on n.id = c.niveau_id
       join cycles cy on cy.id = n.cycle_id
      where c.id = p_classe),
    false)   -- cycle introuvable : on n'affiche pas, plutôt que d'afficher à tort
$fn$;
revoke execute on function public.bulletin_affiche_absences(uuid) from public, anon;
grant execute on function public.bulletin_affiche_absences(uuid) to authenticated;

-- --- 2. Le comptage, borné par les dates de la période --------------------
--  Rend 0 ligne si la période n'est pas datée : l'appelant distingue ainsi
--  « aucune absence » de « on ne peut pas savoir ».
create or replace function public.absences_periode(p_eleve uuid, p_periode uuid)
returns table(absences bigint, justifiees bigint, retards bigint)
language sql stable security definer set search_path = public as $fn$
  select
    count(a.id) filter (where a.type = 'absence'),
    count(a.id) filter (where a.type = 'absence' and a.statut = 'justifie'),
    count(a.id) filter (where a.type = 'retard')
  from periodes p
  left join absences a
    on a.eleve_id = p_eleve
   and a.date_abs between p.date_debut and p.date_fin
  where p.id = p_periode
    and p.date_debut is not null
    and p.date_fin is not null
  group by p.id;
$fn$;
revoke execute on function public.absences_periode(uuid, uuid) from public, anon;
grant execute on function public.absences_periode(uuid, uuid) to authenticated;

-- --- 3. Côté personnel : toute une classe en un appel ---------------------
--  Sans cela, l'écran des bulletins ferait une requête par élève : le
--  patron N+1 que l'audit de performance a déjà corrigé ailleurs.
create or replace function public.absences_classe_periode(p_classe uuid, p_periode uuid)
returns table(eleve_id uuid, absences bigint, justifiees bigint, retards bigint)
language sql stable security definer set search_path = public as $fn$
  select i.eleve_id,
         count(a.id) filter (where a.type = 'absence'),
         count(a.id) filter (where a.type = 'absence' and a.statut = 'justifie'),
         count(a.id) filter (where a.type = 'retard')
    from periodes p
    join inscriptions i on i.classe_id = p_classe and i.annee_id = p.annee_id
    left join absences a
      on a.eleve_id = i.eleve_id
     and a.date_abs between p.date_debut and p.date_fin
   where p.id = p_periode
     and p.date_debut is not null
     and p.date_fin is not null
     and (est_super_admin()
          or (p.ecole_id = ecole_courante()
              and (est_admin() or a_role('direction') or a_role('comptable')
                   or a_role('secretaire') or enseigne_classe(p_classe))))
   group by i.eleve_id;
$fn$;
revoke execute on function public.absences_classe_periode(uuid, uuid) from public, anon;
grant execute on function public.absences_classe_periode(uuid, uuid) to authenticated;

-- --- 4. Côté parent : le bulletin porte ses absences ----------------------
--  `create or replace` ne peut pas changer le type de retour d'un
--  `returns table(...)` → 42P13 (piège des mig. 114, 131, 144, 145, 150, 152).
drop function if exists public.enfant_bulletins(uuid);
create or replace function public.enfant_bulletins(p_eleve uuid)
returns table(
  id uuid, periode text, ordre int, moyenne numeric, rang int, effectif int, mention text,
  ecole text, sigle text, classe text, eleve_prenom text, eleve_nom text, matricule text, annee text,
  logo text,
  affiche_absences boolean, absences bigint, absences_justifiees bigint
)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  if not public._acces_notes_autorise(p_eleve) then return; end if;
  return query
    select b.id, p.libelle, p.ordre, b.moyenne_generale, b.rang, b.effectif, b.mention,
           ec.nom, ec.sigle, c.libelle, e.prenom, e.nom, e.matricule, an.libelle,
           ec.logo_url,
           public.bulletin_affiche_absences(b.classe_id),
           ab.absences, ab.justifiees
    from bulletins b
    join periodes p on p.id = b.periode_id
    join eleves e on e.id = b.eleve_id
    left join classes c on c.id = b.classe_id
    left join ecoles ec on ec.id = b.ecole_id
    left join annees_scolaires an on an.id = p.annee_id
    -- LATERAL : la fonction rend 0 ligne quand la période n'est pas datée, et
    -- le LEFT JOIN laisse alors les compteurs à NULL. C'est exactement la
    -- distinction voulue entre « aucune absence » et « on ne sait pas ».
    left join lateral public.absences_periode(b.eleve_id, b.periode_id) ab on true
    where b.eleve_id = p_eleve
    order by p.ordre;
end $fn$;
revoke execute on function public.enfant_bulletins(uuid) from public, anon;
grant execute on function public.enfant_bulletins(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • bulletin d'un CM1 (élémentaire) → affiche_absences = false ;
--   • bulletin d'une 6e (collège) → true ;
--   • période sans dates → absences NULL, l'écran le dit au lieu d'afficher 0 ;
--   • période datée → compte l'intervalle, bornes incluses ;
--   • `absences_classe_periode` : un enseignant non affecté à la classe
--     n'obtient rien ; un parent non plus.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.absences_classe_periode(uuid, uuid);
-- drop function if exists public.absences_periode(uuid, uuid);
-- drop function if exists public.bulletin_affiche_absences(uuid);
-- drop function if exists public.enfant_bulletins(uuid);
-- (puis réappliquer `enfant_bulletins` de la migration 114.)
