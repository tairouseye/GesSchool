-- =====================================================================
--  205 — Les couleurs de l'école de chaque enfant, pour l'espace parent
--
--  Demandé le 19/10/2026 : l'emploi du temps affiché au parent doit suivre la
--  charte graphique de l'école (couleur primaire pour l'en-tête, teintes des
--  matières tirées de la secondaire) et porter son logo. Le logo était déjà
--  rendu ; les couleurs non. Le parent ne lit pas `ecoles` directement : on
--  les ajoute à `mes_enfants`, en FIN de liste (les colonnes existantes ne
--  bougent pas). Le type de retour change : drop + create, droits rétablis à
--  l'identique.
--
--  Prérequis : définition courante de mes_enfants (photo, annonces nouvelles).
-- =====================================================================

drop function if exists public.mes_enfants();
create function public.mes_enfants()
returns table(eleve_id uuid, prenom text, nom text, matricule text, classe text, ecole text, ecole_id uuid,
              logo text, annonces_nouvelles bigint, photo text, couleur_primaire text, couleur_secondaire text)
language sql security definer set search_path = public as $function$
  select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom, ec.id, ec.logo_url,
         (select count(*) from annonces_enfant(e.id) a
           where a.publie_le >= now() - interval '7 days'),
         e.photo_url,
         ec.couleur_primaire, ec.couleur_secondaire
  from tuteurs t
  join eleve_tuteurs et on et.tuteur_id = t.id
  join eleves e on e.id = et.eleve_id
  left join ecoles ec on ec.id = e.ecole_id
  left join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
  left join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
  left join classes c on c.id = ins.classe_id
  where t.profil_id = auth.uid()
  order by e.nom, e.prenom
$function$;

revoke all on function public.mes_enfants() from public, anon;
grant execute on function public.mes_enfants() to authenticated;
