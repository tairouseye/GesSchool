-- =====================================================================
--  152 — Cibler une annonce par NIVEAU ou par CYCLE
--
--  Le ciblage s'arrêtait à la classe (mig. 001). Or une école annonce
--  rarement à une seule classe : une sortie concerne « le préscolaire »,
--  une réunion « les CM », un rappel de fournitures « l'élémentaire ».
--  Faute de maille intermédiaire, ces messages partaient à TOUTES les
--  familles — et ce qui s'adresse à tout le monde n'est lu par personne.
--
--  On ajoute donc deux cibles, sur le même patron que « classe » : un
--  discriminant `cible` et la colonne d'identifiant correspondante.
--
--  ⚠️ LA RÈGLE DE VISIBILITÉ EST ÉCRITE À QUATRE ENDROITS — et c'est
--  précisément pour cela qu'il faut les modifier ENSEMBLE :
--    • `_annonce_visible_par()` .... pièces jointes (table ET Storage, mig. 150)
--    • `annonces_parent()` ......... accueil parent
--    • `annonces_enfant()` ......... page d'un enfant
--    • `mes_annonces()` ............ espace étudiant
--  En oublier une, c'est soit masquer une annonce légitime, soit laisser
--  fuir sa pièce jointe.
--
--  ⚠️ NUANCE CONSERVÉE : une annonce « tous » ou « parents » atteint un
--  parent DÈS QU'IL A UN ENFANT dans l'école, même sans inscription active.
--  Un ciblage par classe, niveau ou cycle exige au contraire l'inscription
--  de l'année courante — c'est elle qui rattache l'enfant à une classe.
--  35 élèves de Tut'Tank n'ont aujourd'hui aucun responsable rattaché : la
--  distinction n'est pas théorique.
--
--  Prérequis : migrations 001, 145, 150.
-- =====================================================================

alter table annonces add column if not exists niveau_id uuid references niveaux(id) on delete cascade;
alter table annonces add column if not exists cycle_id  uuid references cycles(id)  on delete cascade;
create index if not exists annonces_ciblage_idx on annonces(ecole_id, cible, classe_id, niveau_id, cycle_id);

-- =====================================================================
--  1. La règle de visibilité, pour les pièces jointes
-- =====================================================================
create or replace function public._annonce_visible_par(p_annonce uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from annonces a where a.id = p_annonce and (
      -- Personnel de l'établissement
      est_super_admin()
      or (a.ecole_id = ecole_courante()
          and (est_admin() or a_role('direction') or a_role('comptable')
               or a_role('secretaire') or a_role('enseignant')))
      -- Parent : annonce générale — un enfant dans l'école suffit
      or (a.cible in ('tous', 'parents') and exists (
            select 1 from tuteurs t
              join eleve_tuteurs et on et.tuteur_id = t.id
              join eleves e on e.id = et.eleve_id
             where t.profil_id = auth.uid() and e.ecole_id = a.ecole_id))
      -- Parent : annonce ciblée — passe par l'inscription de l'année courante
      or (a.cible in ('classe', 'niveau', 'cycle') and exists (
            select 1 from tuteurs t
              join eleve_tuteurs et on et.tuteur_id = t.id
              join eleves e on e.id = et.eleve_id
              join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante
              join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
              join classes c on c.id = ins.classe_id
              join niveaux n on n.id = c.niveau_id
             where t.profil_id = auth.uid()
               and e.ecole_id = a.ecole_id
               and ((a.cible = 'classe' and a.classe_id = c.id)
                 or (a.cible = 'niveau' and a.niveau_id = n.id)
                 or (a.cible = 'cycle'  and a.cycle_id  = n.cycle_id))))
      -- Étudiant du supérieur : ni classe, ni niveau, ni cycle chez lui
      or (a.cible in ('tous', 'etudiants') and exists (
            select 1 from eleves e
             where e.profil_id = auth.uid() and e.ecole_id = a.ecole_id))
    )
  );
$$;
revoke execute on function public._annonce_visible_par(uuid) from public, anon;
grant execute on function public._annonce_visible_par(uuid) to authenticated;

-- =====================================================================
--  2. Accueil parent
-- =====================================================================
--  `create or replace` ne peut pas changer le type de retour d'un
--  `returns table(...)` → 42P13 (piège des mig. 114, 131, 144, 145, 150).
drop function if exists public.annonces_parent();
create or replace function public.annonces_parent()
returns table(id uuid, titre text, contenu text, cible text,
              ecole text, ecole_id uuid, publie_le timestamptz,
              classe text, classe_id uuid, portee_libelle text, fichiers jsonb)
language sql stable security definer set search_path = public as $$
  select distinct a.id, a.titre, a.contenu, a.cible,
         ec.nom, a.ecole_id, a.publie_le, c.libelle, a.classe_id,
         -- Dire à qui l'annonce s'adresse : « CM1 », « Élémentaire »…
         coalesce(c.libelle, n.libelle, cy.libelle),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', f.id, 'titre', f.titre, 'nom_fichier', f.nom_fichier,
                     'chemin', f.chemin, 'taille', f.taille) order by f.created_at)
                     from fichiers_ecole f where f.annonce_id = a.id), '[]'::jsonb)
  from annonces a
  join ecoles ec on ec.id = a.ecole_id
  left join classes c  on c.id  = a.classe_id
  left join niveaux n  on n.id  = a.niveau_id
  left join cycles  cy on cy.id = a.cycle_id
  where a.ecole_id in (
    select distinct e.ecole_id from tuteurs t
      join eleve_tuteurs et on et.tuteur_id = t.id
      join eleves e on e.id = et.eleve_id
     where t.profil_id = auth.uid())
    and (
      a.cible in ('tous', 'parents')
      or (a.cible in ('classe', 'niveau', 'cycle') and exists (
            select 1 from tuteurs t
              join eleve_tuteurs et on et.tuteur_id = t.id
              join eleves e on e.id = et.eleve_id
              join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante
              join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
              join classes cl on cl.id = ins.classe_id
              join niveaux nv on nv.id = cl.niveau_id
             where t.profil_id = auth.uid()
               and e.ecole_id = a.ecole_id
               and ((a.cible = 'classe' and a.classe_id = cl.id)
                 or (a.cible = 'niveau' and a.niveau_id = nv.id)
                 or (a.cible = 'cycle'  and a.cycle_id  = nv.cycle_id))))
    )
  order by a.publie_le desc;
$$;
revoke execute on function public.annonces_parent() from public, anon;
grant execute on function public.annonces_parent() to authenticated;

-- =====================================================================
--  3. Page d'un enfant
-- =====================================================================
drop function if exists public.annonces_enfant(uuid);
create or replace function public.annonces_enfant(p_eleve uuid)
returns table(id uuid, titre text, contenu text, cible text,
              publie_le timestamptz, classe text, portee_libelle text, fichiers jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_ecole uuid; v_classe uuid; v_niveau uuid; v_cycle uuid;
begin
  if not public._parent_possede(p_eleve) then
    raise exception 'Accès refusé.';
  end if;
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;

  -- Une seule lecture remonte la chaîne classe → niveau → cycle.
  select ins.classe_id, c.niveau_id, n.cycle_id
    into v_classe, v_niveau, v_cycle
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
    join classes c on c.id = ins.classe_id
    join niveaux n on n.id = c.niveau_id
   where ins.eleve_id = p_eleve
   limit 1;

  return query
    select a.id, a.titre, a.contenu, a.cible, a.publie_le, c.libelle,
           coalesce(c.libelle, n.libelle, cy.libelle),
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', f.id, 'titre', f.titre, 'nom_fichier', f.nom_fichier,
                       'chemin', f.chemin, 'taille', f.taille) order by f.created_at)
                       from fichiers_ecole f where f.annonce_id = a.id), '[]'::jsonb)
      from annonces a
      left join classes c  on c.id  = a.classe_id
      left join niveaux n  on n.id  = a.niveau_id
      left join cycles  cy on cy.id = a.cycle_id
     where a.ecole_id = v_ecole
       and (a.cible in ('tous', 'parents')
            or (a.cible = 'classe' and v_classe is not null and a.classe_id = v_classe)
            or (a.cible = 'niveau' and v_niveau is not null and a.niveau_id = v_niveau)
            or (a.cible = 'cycle'  and v_cycle  is not null and a.cycle_id  = v_cycle))
     order by a.publie_le desc;
end $$;
revoke execute on function public.annonces_enfant(uuid) from public, anon;
grant execute on function public.annonces_enfant(uuid) to authenticated;

-- =====================================================================
--  4. Espace étudiant
-- =====================================================================
--  Un étudiant du supérieur n'a ni classe, ni niveau, ni cycle : les
--  annonces ainsi ciblées ne le concernent pas. L'ancienne version filtrait
--  `classe_id is null` ; il faut désormais écarter les trois.
drop function if exists public.mes_annonces();
create or replace function public.mes_annonces()
returns table (id uuid, titre text, contenu text, ecole text,
               publie_le timestamptz, fichiers jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.titre, a.contenu, ec.nom, a.publie_le,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', f.id, 'titre', f.titre, 'nom_fichier', f.nom_fichier,
                     'chemin', f.chemin, 'taille', f.taille) order by f.created_at)
                     from fichiers_ecole f where f.annonce_id = a.id), '[]'::jsonb)
    from annonces a
    join ecoles ec on ec.id = a.ecole_id
   where a.ecole_id = (select e.ecole_id from eleves e where e.id = _eleve_courant())
     and (a.cible is null or a.cible in ('tous', 'etudiants', 'eleves'))
     and a.classe_id is null and a.niveau_id is null and a.cycle_id is null
   order by a.publie_le desc
   limit 50;
$$;
revoke execute on function public.mes_annonces() from public, anon;
grant execute on function public.mes_annonces() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • annonce ciblée « Élémentaire » → parvient au parent d'un CI/CP,
--     PAS à celui d'un TPS/PS ;
--   • annonce ciblée « CM1 » (niveau) → même logique, maille plus fine ;
--   • sa pièce jointe suit : ni la ligne, ni l'octet pour un parent non visé ;
--   • annonce « tous » → parvient même au parent dont l'enfant n'a pas
--     encore d'inscription active ;
--   • étudiant du supérieur : aucune annonce ciblée classe/niveau/cycle.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- alter table annonces drop column if exists niveau_id;
-- alter table annonces drop column if exists cycle_id;
-- (puis réappliquer _annonce_visible_par, annonces_parent, annonces_enfant
--  et mes_annonces des migrations 150 et 151.)
