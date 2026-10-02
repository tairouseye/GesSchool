-- =====================================================================
--  169 — Le parent voit la photo de SON enfant, et d'aucun autre
--
--  Demandé : saisir les photos des élèves, et les montrer dans l'espace
--  parent — l'enfant du parent, et rien de plus.
--
--  État constaté avant d'écrire : le téléversement existe depuis la
--  migration 003 et fonctionne côté personnel, mais **aucune photo n'a
--  jamais été enregistrée** — 0 sur 172 élèves. Ajouter 96 photos une par
--  une depuis chaque fiche élève n'est pas praticable ; c'est l'écran de
--  saisie qui manquait, pas la plomberie.
--
--  ⚠️ CE QUE LA MIGRATION 015 A DÉJÀ BIEN FAIT, ET QU'ON NE TOUCHE PAS.
--  Le bucket `eleves` est PRIVÉ et ses policies sont cloisonnées par
--  `(storage.foldername(name))[1] = ecole_courante()::text`. Vérifié : un
--  anonyme est refusé. Les policies du personnel restent inchangées.
--
--  ⚠️ POURQUOI LE PARENT NE VOIT RIEN AUJOURD'HUI. `ecole_courante()` lit
--  `profils.ecole_id`, qui est NULL pour un parent : la comparaison est donc
--  toujours fausse et il ne peut signer aucune URL. Ce n'est pas un défaut
--  de la 015, c'est la conséquence voulue de son cloisonnement.
--
--  🔴 ET SURTOUT : CE QU'IL NE FAUT PAS FAIRE POUR Y REMÉDIER.
--  La tentation est d'élargir la policy à `est_membre_ecole(...)`. Ce serait
--  une faute : ce helper est VRAI POUR TOUS LES PARENTS de l'école. Chaque
--  parent pourrait alors lister et lire la photo de CHACUN des 96 enfants.
--  C'est exactement la famille de défauts « un parent voit les données d'un
--  autre enfant » que l'audit de la bibliothèque avait relevée. On passe
--  donc par `_parent_possede()`, qui ne répond vrai que pour SES enfants.
--
--  ⚠️ LE CHEMIN CHANGE DE FORME, ET C'EST LE CŒUR DE LA MIGRATION.
--  L'ancien chemin est `<ecole_id>/<eleve_id>-<horodatage>.<ext>`. Il est
--  INANALYSABLE dans une policy : un UUID contient quatre tirets, donc
--  découper sur « - » ne permet pas de retrouver l'élève de façon fiable.
--  Le nouveau chemin est `<ecole_id>/<eleve_id>/<horodatage>.<ext>` : un
--  segment par identifiant, lisible par `storage.foldername()`.
--  Cette correction est possible SANS MIGRATION DE DONNÉES précisément
--  parce qu'aucune photo n'existe encore (0 sur 172) — l'occasion ne se
--  représentera pas une fois les 96 photos prises.
--
--  Prérequis : migrations 003, 004 (_parent_possede), 015, 072 (modèle).
-- =====================================================================

-- --- 1. Retrouver l'élève depuis le chemin, sans jamais se tromper -------
--  IMMUTABLE et FAIL-CLOSED, sur le modèle de `_preuve_eleve` (mig. 072) :
--  un chemin non conforme ne rend pas une erreur de cast en pleine policy,
--  il rend NULL — donc n'autorise rien.
create or replace function public._photo_eleve(p_name text)
returns uuid language sql immutable set search_path = public, storage as $$
  select case
    when (storage.foldername(p_name))[2] ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(p_name))[2])::uuid
    else null
  end;
$$;

comment on function public._photo_eleve(text) is
  'Eleve_id extrait du 2e segment du chemin d''une photo. NULL si non conforme (fail-closed, mig. 169).';

-- --- 2. Le parent lit la photo de SON enfant ------------------------------
--  Policy ADDITIONNELLE : celles du personnel (mig. 015) restent en place et
--  intactes. Sous PostgreSQL, plusieurs policies permissives s'additionnent
--  — le personnel continue de passer par la sienne, le parent par celle-ci.
--
--  ⚠️ `_parent_possede` est SECURITY DEFINER et STABLE : il traverse la RLS
--  de `tuteurs`/`eleve_tuteurs` pour répondre, ce qui est nécessaire ici, et
--  ne rend vrai que si `auth.uid()` est bien tuteur de CET élève.
drop policy if exists eleves_photo_parent_select on storage.objects;
create policy eleves_photo_parent_select on storage.objects
  for select to authenticated using (
    bucket_id = 'eleves'
    and public._parent_possede(public._photo_eleve(name))
  );

-- --- 3. La photo descend jusqu'à l'espace parent --------------------------
--  ⚠️ Ajouter une colonne au retour impose un DROP : `create or replace`
--  refuse un changement de signature (42P13). Même piège qu'aux migrations
--  157, 163, 165 et 166.
--
--  ⚠️ ON REND LE CHEMIN, PAS UNE URL. Le bucket est privé : l'URL se signe
--  côté client, et la policy du §2 décide si le parent y a droit. Rendre
--  une URL publique ici contournerait tout le cloisonnement.
drop function if exists public.mes_enfants();

create function public.mes_enfants()
returns table(
  eleve_id uuid, prenom text, nom text, matricule text, classe text,
  ecole text, ecole_id uuid, logo text, annonces_nouvelles bigint,
  photo text
)
language sql security definer set search_path = public as $$
  select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom, ec.id, ec.logo_url,
         (select count(*) from annonces_enfant(e.id) a
           where a.publie_le >= now() - interval '7 days'),
         e.photo_url
  from tuteurs t
  join eleve_tuteurs et on et.tuteur_id = t.id
  join eleves e on e.id = et.eleve_id
  left join ecoles ec on ec.id = e.ecole_id
  left join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
  left join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
  left join classes c on c.id = ins.classe_id
  where t.profil_id = auth.uid()
  order by e.nom, e.prenom
$$;
revoke execute on function public.mes_enfants() from public, anon;
grant execute on function public.mes_enfants() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • un parent signe la photo de SON enfant → autorisé ;
--   • 🔴 le même parent signe la photo d'un AUTRE enfant de la même école
--     → REFUSÉ (c'est l'épreuve qui compte) ;
--   • un parent LISTE le bucket → il ne voit que les photos de ses enfants ;
--   • un parent d'une autre école → rien ;
--   • un anonyme → rien ;
--   • le personnel de l'école continue de tout voir pour SON école, et rien
--     pour les autres (policies de la 015, inchangées) ;
--   • une photo déposée à l'ancienne forme (`<ecole>/<uuid>-<ts>.jpg`) n'est
--     PAS lisible par le parent : `_photo_eleve` rend NULL, donc refus.
--     Aucune photo n'existant à ce jour, le cas est théorique — mais il est
--     fail-closed, et non fail-open ;
--   • `mes_enfants()` rend bien la colonne `photo` (un CHEMIN), et l'espace
--     parent continue de fonctionner pour un enfant SANS photo (NULL) ;
--   • la grille de consentement de la migration 114 n'est pas touchée : elle
--     garde les NOTES, pas l'identité de l'enfant.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop policy if exists eleves_photo_parent_select on storage.objects;
-- drop function if exists public._photo_eleve(text);
