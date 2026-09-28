-- =====================================================================
--  150 — Pièces jointes aux annonces, archivées dans la Documentation
--
--  Deux besoins, une seule table. Une annonce doit pouvoir porter un PDF
--  (règlement intérieur, circulaire, calendrier), et ce fichier doit se
--  retrouver dans Pilotage → Documentation — où la page annonce d'ailleurs
--  déjà l'archivage « prochainement ».
--
--  Les stocker deux fois — une copie pour l'annonce, une pour la GED —
--  garantirait qu'elles divergent. On tient donc UNE table, `fichiers_ecole`,
--  qui est la documentation de l'établissement ; une pièce jointe n'est
--  qu'une de ses lignes, rattachée à une annonce.
--
--  ⚠️ LE POINT DÉLICAT : QUI PEUT LIRE LE FICHIER.
--  Une annonce ciblée « classe » ne s'adresse qu'aux parents de cette classe.
--  Sa pièce jointe doit suivre exactement la même audience — sinon le
--  ciblage, correct au niveau de l'annonce, serait contourné par le fichier.
--  Cette règle est écrite UNE FOIS, dans `_annonce_visible_par()`, et
--  appliquée à trois endroits : la policy de la table, la policy Storage, et
--  les RPC des espaces parent et étudiant. Une seule règle, pas trois
--  copies qui finiraient par diverger.
--
--  Prérequis : migrations 001, 006, 116 (est_membre_ecole), 145.
-- =====================================================================

-- =====================================================================
--  1. QUI VOIT UNE ANNONCE ?
-- =====================================================================
--  Reprend le raisonnement des migrations 006 et 145 :
--   • le personnel de l'établissement (rôles ayant la page Annonces) ;
--   • le parent dont un enfant est concerné — toute l'école, ou sa classe ;
--   • l'étudiant de l'établissement, pour les annonces qui lui sont destinées.
create or replace function public._annonce_visible_par(p_annonce uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from annonces a where a.id = p_annonce and (
      -- Personnel de l'établissement
      est_super_admin()
      or (a.ecole_id = ecole_courante()
          and (est_admin() or a_role('direction') or a_role('comptable')
               or a_role('secretaire') or a_role('enseignant')))
      -- Parent : l'annonce vise toute l'école, ou la classe d'un de ses enfants
      or (a.cible in ('tous', 'parents') and exists (
            select 1 from tuteurs t
              join eleve_tuteurs et on et.tuteur_id = t.id
              join eleves e on e.id = et.eleve_id
             where t.profil_id = auth.uid() and e.ecole_id = a.ecole_id))
      or (a.cible = 'classe' and a.classe_id is not null and exists (
            select 1 from tuteurs t
              join eleve_tuteurs et on et.tuteur_id = t.id
              join eleves e on e.id = et.eleve_id
              join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante
              join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
             where t.profil_id = auth.uid() and ins.classe_id = a.classe_id))
      -- Étudiant du supérieur
      or (a.cible in ('tous', 'etudiants') and exists (
            select 1 from eleves e
             where e.profil_id = auth.uid() and e.ecole_id = a.ecole_id))
    )
  );
$$;
revoke execute on function public._annonce_visible_par(uuid) from public, anon;
grant execute on function public._annonce_visible_par(uuid) to authenticated;

-- =====================================================================
--  2. LA TABLE : la documentation de l'établissement
-- =====================================================================
create table if not exists fichiers_ecole (
  id          uuid primary key default gen_random_uuid(),
  ecole_id    uuid not null references ecoles(id) on delete cascade,
  -- Rattachement facultatif : une pièce jointe d'annonce le renseigne, un
  -- document déposé directement dans la Documentation le laisse vide.
  annonce_id  uuid references annonces(id) on delete cascade,
  titre       text not null,
  categorie   text not null default 'autre'
              check (categorie in ('annonce', 'reglement', 'circulaire',
                                   'formulaire', 'calendrier', 'autre')),
  nom_fichier text not null,
  chemin      text not null unique,          -- <ecole_id>/<uuid>.<ext>
  mime        text,
  taille      bigint,
  depose_par  uuid references profils(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists fichiers_ecole_idx on fichiers_ecole(ecole_id, created_at desc);
create index if not exists fichiers_ecole_annonce_idx on fichiers_ecole(annonce_id);

alter table fichiers_ecole enable row level security;

--  Lecture : le personnel de gestion voit toute la documentation ; les
--  familles et les étudiants ne voient que les pièces jointes des annonces
--  qui leur sont destinées.
drop policy if exists fichiers_ecole_select on fichiers_ecole;
create policy fichiers_ecole_select on fichiers_ecole for select using (
  est_super_admin()
  or (ecole_id = ecole_courante()
      and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  or (annonce_id is not null and _annonce_visible_par(annonce_id))
);

--  Écriture : publier une pièce ou déposer un document est un acte de
--  communication — mêmes rôles que la page Annonces (cf. ACCES.annonces).
drop policy if exists fichiers_ecole_ecrire on fichiers_ecole;
create policy fichiers_ecole_ecrire on fichiers_ecole for all
  using (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  )
  with check (
    est_super_admin()
    or (ecole_id = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  );

-- =====================================================================
--  3. STOCKAGE — bucket privé `documents`
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)          -- 20 Mo par fichier
on conflict (id) do update set public = false;

--  Extraction de l'école depuis le chemin, IMMUTABLE et fail-closed :
--  un cast d'uuid brut dans une policy lèverait une erreur sur un chemin
--  non conforme (patron `_preuve_eleve`, mig. 072).
create or replace function public._doc_ecole(p_name text)
returns uuid language sql immutable as $$
  select case
    when p_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
    then substring(p_name from 1 for 36)::uuid
  end;
$$;

--  Le droit de lire l'OCTET suit le droit de lire la LIGNE. Sans cela, le
--  ciblage d'une annonce serait contournable en devinant un chemin.
--
--  ⚠️ SECURITY INVOKER — et c'est tout l'intérêt. En `SECURITY DEFINER`,
--  cette fonction contournerait la RLS de `fichiers_ecole` et répondrait
--  « oui » pour n'importe quel fichier existant : le contrôle d'audience
--  serait annulé au moment même où on croit l'appliquer. Exécutée avec les
--  droits de l'APPELANT, la ligne n'est visible que s'il a le droit de la
--  voir — la policy de la table fait donc foi pour l'octet aussi.
create or replace function public._doc_peut_lire(p_name text)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from fichiers_ecole f where f.chemin = p_name);
$$;
revoke execute on function public._doc_peut_lire(text) from public, anon;
grant execute on function public._doc_peut_lire(text) to authenticated;

create or replace function public._doc_gestion(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_ecole is not null and (
    est_super_admin()
    or (p_ecole = ecole_courante()
        and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  );
$$;
revoke execute on function public._doc_gestion(uuid) from public, anon;
grant execute on function public._doc_gestion(uuid) to authenticated;

-- ⚠️ Toujours filtrer `bucket_id` : une policy non filtrée affecterait les
-- autres buckets (précédent : 043 avait cassé le bucket `ecoles`).
drop policy if exists documents_ecole_select on storage.objects;
create policy documents_ecole_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public._doc_peut_lire(name));

drop policy if exists documents_ecole_insert on storage.objects;
create policy documents_ecole_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public._doc_gestion(public._doc_ecole(name)));

drop policy if exists documents_ecole_update on storage.objects;
create policy documents_ecole_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public._doc_gestion(public._doc_ecole(name)));

drop policy if exists documents_ecole_delete on storage.objects;
create policy documents_ecole_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public._doc_gestion(public._doc_ecole(name)));

-- =====================================================================
--  4. LES ESPACES PARENT ET ÉTUDIANT VOIENT LES PIÈCES JOINTES
-- =====================================================================
--  `create or replace` ne peut pas changer le type de retour d'un
--  `returns table(...)` → 42P13 (piège des mig. 114, 131, 144, 145).
--  Les pièces jointes sont renvoyées en jsonb : une annonce peut en porter
--  plusieurs, et un tableau évite de dupliquer la ligne d'annonce.

drop function if exists public.annonces_enfant(uuid);
create or replace function public.annonces_enfant(p_eleve uuid)
returns table(id uuid, titre text, contenu text, cible text,
              publie_le timestamptz, classe text, fichiers jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_ecole uuid; v_classe uuid;
begin
  if not public._parent_possede(p_eleve) then
    raise exception 'Accès refusé.';
  end if;
  select e.ecole_id into v_ecole from eleves e where e.id = p_eleve;
  select ins.classe_id into v_classe
    from inscriptions ins
    join annees_scolaires an on an.id = ins.annee_id and an.courante = true
   where ins.eleve_id = p_eleve
   limit 1;

  return query
    select a.id, a.titre, a.contenu, a.cible, a.publie_le, c.libelle,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', f.id, 'titre', f.titre, 'nom_fichier', f.nom_fichier,
                       'chemin', f.chemin, 'taille', f.taille) order by f.created_at)
                       from fichiers_ecole f where f.annonce_id = a.id), '[]'::jsonb)
      from annonces a
      left join classes c on c.id = a.classe_id
     where a.ecole_id = v_ecole
       and (a.cible in ('tous', 'parents')
            or (a.cible = 'classe' and v_classe is not null and a.classe_id = v_classe))
     order by a.publie_le desc;
end $$;
revoke execute on function public.annonces_enfant(uuid) from public, anon;
grant execute on function public.annonces_enfant(uuid) to authenticated;

drop function if exists public.annonces_parent();
create or replace function public.annonces_parent()
returns table(id uuid, titre text, contenu text, cible text,
              ecole text, ecole_id uuid, publie_le timestamptz,
              classe text, classe_id uuid, fichiers jsonb)
language sql stable security definer set search_path = public as $$
  select distinct a.id, a.titre, a.contenu, a.cible,
         ec.nom, a.ecole_id, a.publie_le, c.libelle, a.classe_id,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', f.id, 'titre', f.titre, 'nom_fichier', f.nom_fichier,
                     'chemin', f.chemin, 'taille', f.taille) order by f.created_at)
                     from fichiers_ecole f where f.annonce_id = a.id), '[]'::jsonb)
  from annonces a
  join ecoles ec on ec.id = a.ecole_id
  left join classes c on c.id = a.classe_id
  where a.ecole_id in (
    select distinct e.ecole_id
    from tuteurs t
    join eleve_tuteurs et on et.tuteur_id = t.id
    join eleves e on e.id = et.eleve_id
    where t.profil_id = auth.uid()
  )
  and (
    a.cible in ('tous', 'parents')
    or (a.cible = 'classe' and a.classe_id in (
          select ins.classe_id
          from tuteurs t
          join eleve_tuteurs et on et.tuteur_id = t.id
          join eleves e on e.id = et.eleve_id
          join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
          join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
          where t.profil_id = auth.uid()
        ))
  )
  order by a.publie_le desc;
$$;
revoke execute on function public.annonces_parent() from public, anon;
grant execute on function public.annonces_parent() to authenticated;

--  L'espace étudiant aussi : sans cela, un étudiant verrait l'annonce mais
--  pas le PDF qui l'accompagne.
drop function if exists public.mes_annonces();
create or replace function public.mes_annonces()
returns table (id uuid, titre text, contenu text, ecole text,
               publie_le timestamptz, fichiers jsonb)
language sql stable security definer set search_path = public as $fn$
  select a.id, a.titre, a.contenu, ec.nom, a.publie_le,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', f.id, 'titre', f.titre, 'nom_fichier', f.nom_fichier,
                     'chemin', f.chemin, 'taille', f.taille) order by f.created_at)
                     from fichiers_ecole f where f.annonce_id = a.id), '[]'::jsonb)
    from annonces a
    join ecoles ec on ec.id = a.ecole_id
   where a.ecole_id = (select e.ecole_id from eleves e where e.id = _eleve_courant())
     and (a.cible is null or a.cible in ('tous', 'etudiants', 'eleves'))
     and a.classe_id is null
   order by a.publie_le desc
   limit 50;
$fn$;
revoke execute on function public.mes_annonces() from public, anon;
grant execute on function public.mes_annonces() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • gestion : dépose un PDF sur une annonce → la ligne apparaît dans
--     Pilotage → Documentation ;
--   • parent concerné : l'annonce porte la pièce jointe et l'URL signée
--     s'ouvre ;
--   • parent d'une AUTRE classe : ni la ligne, ni l'octet
--       select * from fichiers_ecole;                       → 0 ligne
--       storage : URL signée sur le chemin                   → refusée ;
--   • enseignant : voit les annonces, mais pas la Documentation complète.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop policy if exists documents_ecole_select on storage.objects;
-- drop policy if exists documents_ecole_insert on storage.objects;
-- drop policy if exists documents_ecole_update on storage.objects;
-- drop policy if exists documents_ecole_delete on storage.objects;
-- drop function if exists public._doc_peut_lire(text);
-- drop function if exists public._doc_gestion(uuid);
-- drop function if exists public._doc_ecole(text);
-- drop table if exists fichiers_ecole cascade;
-- drop function if exists public._annonce_visible_par(uuid);
-- delete from storage.buckets where id = 'documents';   -- vider les objets d'abord
-- (puis réappliquer annonces_parent et annonces_enfant de la migration 145.)
