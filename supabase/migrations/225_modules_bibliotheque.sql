-- =====================================================================
--  225 — Les modules de la bibliothèque, contrôlés par la base
--
--  Suite de la 224. La bibliothèque a ses propres gardes (_biblio_gestion,
--  _biblio_lecteur), qui ne passent pas par a_acces : un établissement sans
--  module bibliothèque pouvait donc s'en servir par l'API. Trois modules :
--    bibliotheque            le catalogue, les prêts, les acquisitions ;
--    bibliotheque_numerique  les documents numériques ;
--    memoires_theses         le dépôt institutionnel.
--
--  Les gardes communes exigent AU MOINS UN des trois (un mémoire publié est
--  une notice du catalogue). Les documents numériques exigent en plus
--  `bibliotheque_numerique` — ou `memoires_theses`, puisqu'un mémoire publié
--  devient un document numérique. Les dépôts exigent `memoires_theses`.
--  Le super-administrateur passe outre.
--
--  Ici la garde lit l'école DE LA LIGNE (p_ecole), pas l'école courante :
--  un étudiant n'a pas d'école courante.
-- =====================================================================

create or replace function public._ecole_a_module(p_ecole uuid, p_module text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((select e.modules_actifs is null or p_module = any(e.modules_actifs)
                     from ecoles e where e.id = p_ecole), false)
$fn$;
revoke execute on function public._ecole_a_module(uuid, text) from public, anon;
grant execute on function public._ecole_a_module(uuid, text) to authenticated;

create or replace function public._ecole_a_bibliotheque(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public._ecole_a_module(p_ecole, 'bibliotheque')
      or public._ecole_a_module(p_ecole, 'bibliotheque_numerique')
      or public._ecole_a_module(p_ecole, 'memoires_theses')
$fn$;
revoke execute on function public._ecole_a_bibliotheque(uuid) from public, anon;
grant execute on function public._ecole_a_bibliotheque(uuid) to authenticated;

-- --- Les deux gardes communes (versions en vigueur + le module) ------------------
create or replace function public._biblio_gestion(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select est_super_admin()
      or (p_ecole is not null and p_ecole = ecole_courante()
          and public._ecole_a_bibliotheque(p_ecole)
          and (est_admin() or a_role('direction') or a_role('bibliothecaire')));
$fn$;

create or replace function public._biblio_lecteur(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_ecole is not null and auth.uid() is not null
     and public._ecole_a_bibliotheque(p_ecole)
     and exists (
    select 1
      from profil_roles pr
      join profils p on p.id = pr.profil_id
     where pr.profil_id = auth.uid()
       and pr.ecole_id = p_ecole
       and p.actif
       and pr.role::text <> 'parent');
$fn$;

--  Six tables du catalogue RECOPIAIENT la garde de gestion dans leur règle
--  au lieu d'appeler _biblio_gestion : elles échappaient donc au module.
--  Même condition qu'avant (super-admin, ou l'école courante et
--  admin/direction/bibliothécaire), désormais par la fonction.
do $$
declare t text;
begin
  foreach t in array array['biblio_auteurs', 'biblio_bibliotheques', 'biblio_exemplaires',
                           'biblio_localisations', 'biblio_ressource_auteurs', 'biblio_ressources'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ecrire', t);
    execute format('create policy %I on public.%I for all using (_biblio_gestion(ecole_id)) with check (_biblio_gestion(ecole_id))',
                   t || '_ecrire', t);
  end loop;
end $$;

-- --- Documents numériques -------------------------------------------------------
create or replace function public._ecole_a_numerique(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.est_super_admin()
      or public._ecole_a_module(p_ecole, 'bibliotheque_numerique')
      or public._ecole_a_module(p_ecole, 'memoires_theses')
$fn$;
revoke execute on function public._ecole_a_numerique(uuid) from public, anon;
grant execute on function public._ecole_a_numerique(uuid) to authenticated;

--  Version en vigueur, plus le module (la lecture d'un fichier passe par ici).
create or replace function public._biblio_peut_lire(p_numerique uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
    from biblio_numeriques n
    where n.id = p_numerique
      and public._ecole_a_numerique(n.ecole_id)
      and _biblio_lecteur(n.ecole_id)                        -- cloisonnement + hors parents
      and (n.expire_le is null or n.expire_le > now())       -- péremption
      and (
        _biblio_gestion(n.ecole_id)                          -- la gestion voit tout
        or n.acces in ('public', 'institution')
        or (n.acces = 'cible' and exists (
              select 1 from biblio_acces_regles r
              where r.numerique_id = n.id and (
                   (r.role is not null and exists (
                      select 1 from profil_roles pr
                      where pr.profil_id = auth.uid()
                        and pr.ecole_id = n.ecole_id        -- le rôle doit être tenu ICI
                        and pr.role::text = r.role))
                or (r.filiere_id is not null and exists (
                      select 1 from inscriptions_sup i join eleves e on e.id = i.eleve_id
                      where e.profil_id = auth.uid() and i.statut = 'active'
                        and i.filiere_id = r.filiere_id
                        and (r.niveau is null or i.niveau = r.niveau)))
                or (r.departement_id is not null and exists (
                      select 1 from inscriptions_sup i join eleves e on e.id = i.eleve_id
                      join filieres f on f.id = i.filiere_id
                      where e.profil_id = auth.uid() and i.statut = 'active'
                        and f.departement_id = r.departement_id))
                or (r.faculte_id is not null and exists (
                      select 1 from inscriptions_sup i join eleves e on e.id = i.eleve_id
                      join filieres f on f.id = i.filiere_id
                      join departements d on d.id = f.departement_id
                      where e.profil_id = auth.uid() and i.statut = 'active'
                        and d.faculte_id = r.faculte_id))
              )))
      )
  );
$fn$;

drop policy if exists biblio_numeriques_select on public.biblio_numeriques;
create policy biblio_numeriques_select on public.biblio_numeriques for select using (
  est_super_admin()
  or (public._ecole_a_numerique(ecole_id) and _biblio_lecteur(ecole_id)
      and (acces <> 'restreint' or _biblio_gestion(ecole_id)))
);
drop policy if exists biblio_numeriques_ecrire on public.biblio_numeriques;
create policy biblio_numeriques_ecrire on public.biblio_numeriques for all
  using (public._ecole_a_numerique(ecole_id) and _biblio_gestion(ecole_id))
  with check (public._ecole_a_numerique(ecole_id) and _biblio_gestion(ecole_id));

-- --- Dépôt institutionnel (mémoires & thèses) ----------------------------------
create or replace function public._ecole_a_depots(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.est_super_admin() or public._ecole_a_module(p_ecole, 'memoires_theses')
$fn$;
revoke execute on function public._ecole_a_depots(uuid) from public, anon;
grant execute on function public._ecole_a_depots(uuid) to authenticated;

drop policy if exists biblio_depots_select on public.biblio_depots;
create policy biblio_depots_select on public.biblio_depots for select using (
  public._ecole_a_depots(ecole_id) and (
    _biblio_gestion(ecole_id) or deposant_profil_id = auth.uid()
    or (statut = 'publie' and _biblio_lecteur(ecole_id)))
);
drop policy if exists biblio_depots_insert on public.biblio_depots;
create policy biblio_depots_insert on public.biblio_depots for insert with check (
  public._ecole_a_depots(ecole_id) and (
    _biblio_gestion(ecole_id)
    or (_biblio_lecteur(ecole_id) and deposant_profil_id = auth.uid()
        and statut in ('brouillon', 'soumis')))
);
drop policy if exists biblio_depots_update on public.biblio_depots;
create policy biblio_depots_update on public.biblio_depots for update
  using (public._ecole_a_depots(ecole_id) and (
    _biblio_gestion(ecole_id)
    or (deposant_profil_id = auth.uid() and statut in ('brouillon', 'a_corriger'))))
  with check (public._ecole_a_depots(ecole_id) and (
    _biblio_gestion(ecole_id)
    or (deposant_profil_id = auth.uid() and statut in ('brouillon', 'soumis'))));
drop policy if exists biblio_depots_delete on public.biblio_depots;
create policy biblio_depots_delete on public.biblio_depots for delete using (
  public._ecole_a_depots(ecole_id) and (
    _biblio_gestion(ecole_id) or (deposant_profil_id = auth.uid() and statut = 'brouillon'))
);

--  Version en vigueur, plus le module.
create or replace function public.publier_depot(p_depot uuid, p_acces text default 'institution')
returns uuid language plpgsql security definer set search_path = public as $fn$
declare d biblio_depots; v_res uuid;
begin
  select * into d from biblio_depots where id = p_depot;
  if d is null then raise exception 'Dépôt introuvable.'; end if;
  if not _biblio_gestion(d.ecole_id) then raise exception 'Réservé à la gestion de la bibliothèque.'; end if;
  if not public._ecole_a_depots(d.ecole_id) then raise exception 'Le module Mémoires & thèses n''est pas souscrit.'; end if;
  if d.statut = 'publie' then return d.ressource_id; end if;
  if d.fichier_chemin is null then raise exception 'Aucun fichier joint à ce dépôt.'; end if;

  -- 1) la notice
  insert into biblio_ressources (ecole_id, titre, type_ressource, resume, mots_cles, annee_pub, visible)
  values (d.ecole_id, d.titre,
          case d.type when 'publication' then 'article' when 'these' then 'these' else 'memoire' end,
          d.resume, d.mots_cles,
          nullif(regexp_replace(coalesce(d.annee_academique, ''), '\D', '', 'g'), '')::int, true)
  returning id into v_res;

  -- 2) le document numérique (réutilise le fichier déjà déposé)
  insert into biblio_numeriques (ecole_id, ressource_id, fichier_chemin, fichier_nom, taille, format, acces, licence)
  values (d.ecole_id, v_res, d.fichier_chemin, d.fichier_nom, d.taille,
          lower(coalesce(substring(d.fichier_nom from '\.([^.]+)$'), 'pdf')),
          coalesce(p_acces, 'institution'), 'institutionnelle');

  -- 3) le dépôt devient publié
  update biblio_depots
     set statut = 'publie', ressource_id = v_res, publie_le = now(),
         decide_le = coalesce(decide_le, now()), validateur_profil_id = coalesce(validateur_profil_id, auth.uid())
   where id = p_depot;

  return v_res;
end $fn$;

-- --- Retour arrière ---------------------------------------------------------------
-- Réappliquer _biblio_gestion, _biblio_lecteur, _biblio_peut_lire, publier_depot
-- et les policies biblio_numeriques_* / biblio_depots_* sans la condition de
-- module (versions des migrations bibliothèque), puis supprimer
-- _ecole_a_depots, _ecole_a_numerique, _ecole_a_bibliotheque, _ecole_a_module.
