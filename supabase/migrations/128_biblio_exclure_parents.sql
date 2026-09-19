-- =====================================================================
--  128 — Bibliothèque : EXCLURE LES PARENTS DU PUBLIC
--
--  Défaut de portée relevé après l'audit. Le public de la bibliothèque avait
--  été arrêté d'emblée : « Étudiants, Enseignants, Personnel » — pas les
--  parents. Or toutes les policies s'appuient sur `est_membre_ecole()`, qui
--  est volontairement AGNOSTIQUE au rôle : un parent est rattaché à son
--  établissement par `profil_roles` exactement comme un étudiant.
--
--  Conséquence : un parent pouvait consulter le catalogue, OUVRIR les
--  documents numériques marqués « institution », réserver, mettre en favori,
--  suggérer des achats — et même créer un dépôt institutionnel et téléverser
--  des fichiers sous `<ecole_id>/depots/`.
--
--  ⚠️ On ne touche PAS à `est_membre_ecole()` : c'est le helper générique du
--  projet, réutilisable par tout module ouvert aux étudiants ET aux parents
--  (bulletins, notes…). Le restreindre ici casserait ailleurs. On introduit
--  donc un helper propre à la bibliothèque et on l'y substitue.
--
--  Prérequis : migrations 117 → 127.
-- =====================================================================

--  Lecteur de la bibliothèque : membre de l'établissement qui y détient au
--  moins un rôle AUTRE que « parent ». Quelqu'un qui est à la fois parent et
--  enseignant reste lecteur — c'est son rôle d'enseignant qui le qualifie.
create or replace function public._biblio_lecteur(p_ecole uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_ecole is not null and auth.uid() is not null and exists (
    select 1
      from profil_roles pr
      join profils p on p.id = pr.profil_id
     where pr.profil_id = auth.uid()
       and pr.ecole_id = p_ecole
       and p.actif
       and pr.role::text <> 'parent');
$$;
grant execute on function public._biblio_lecteur(uuid) to authenticated;

-- =====================================================================
--  1. Catalogue (migration 117) — lecture
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'biblio_bibliotheques','biblio_localisations','biblio_auteurs',
    'biblio_ressources','biblio_ressource_auteurs','biblio_exemplaires'
  ]
  loop
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      est_super_admin() or _biblio_lecteur(ecole_id)
    );$p$, t, t);
  end loop;
end $$;

-- =====================================================================
--  2. Circulation (migration 118)
-- =====================================================================
drop policy if exists biblio_regles_pret_select on biblio_regles_pret;
create policy biblio_regles_pret_select on biblio_regles_pret for select
  using (est_super_admin() or _biblio_lecteur(ecole_id));

drop policy if exists biblio_reservations_insert on biblio_reservations;
create policy biblio_reservations_insert on biblio_reservations for insert with check (
  _biblio_gestion(ecole_id)
  or (_biblio_lecteur(ecole_id) and profil_id = auth.uid())
);

drop policy if exists biblio_favoris_self on biblio_favoris;
create policy biblio_favoris_self on biblio_favoris for all
  using (profil_id = auth.uid())
  with check (profil_id = auth.uid() and _biblio_lecteur(ecole_id));

drop policy if exists biblio_journal_insert on biblio_journal;
create policy biblio_journal_insert on biblio_journal for insert
  with check (_biblio_lecteur(ecole_id));

-- =====================================================================
--  3. Documents numériques (migration 119, version corrigée en 126)
-- =====================================================================
create or replace function public._biblio_peut_lire(p_numerique uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from biblio_numeriques n
    where n.id = p_numerique
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
$$;

drop policy if exists biblio_numeriques_select on biblio_numeriques;
create policy biblio_numeriques_select on biblio_numeriques for select using (
  est_super_admin()
  or (_biblio_lecteur(ecole_id) and (acces <> 'restreint' or _biblio_gestion(ecole_id)))
);

drop policy if exists biblio_acces_regles_select on biblio_acces_regles;
create policy biblio_acces_regles_select on biblio_acces_regles for select
  using (est_super_admin() or _biblio_lecteur(ecole_id));

-- =====================================================================
--  4. Dépôts (migration 121, insert corrigé en 126)
-- =====================================================================
create or replace function public._biblio_peut_lire_chemin(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select
      _biblio_gestion(_biblio_ecole(p_name))
   or exists (select 1 from biblio_numeriques n
              where n.fichier_chemin = p_name and _biblio_peut_lire(n.id))
   or exists (select 1 from biblio_ressources r
              where r.couverture_chemin = p_name and _biblio_lecteur(r.ecole_id))
      -- dépôt institutionnel : son auteur peut relire son propre fichier
   or exists (select 1 from biblio_depots d
              where d.fichier_chemin = p_name and d.deposant_profil_id = auth.uid());
$$;

drop policy if exists biblio_depots_select on biblio_depots;
create policy biblio_depots_select on biblio_depots for select using (
  _biblio_gestion(ecole_id)
  or deposant_profil_id = auth.uid()
  or (statut = 'publie' and _biblio_lecteur(ecole_id))
);

drop policy if exists biblio_depots_insert on biblio_depots;
create policy biblio_depots_insert on biblio_depots for insert with check (
  _biblio_gestion(ecole_id)
  or (_biblio_lecteur(ecole_id)
      and deposant_profil_id = auth.uid()
      and statut in ('brouillon', 'soumis'))
);

-- Métadonnées académiques : mêmes droits que le dépôt parent.
do $$
declare t text;
begin
  foreach t in array array['biblio_theses','biblio_publications']
  loop
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format($p$create policy %I_select on %I for select using (
      exists (select 1 from biblio_depots d where d.id = depot_id and (
        _biblio_gestion(d.ecole_id) or d.deposant_profil_id = auth.uid()
        or (d.statut = 'publie' and _biblio_lecteur(d.ecole_id))))
    );$p$, t, t);
  end loop;
end $$;

-- Storage : un parent ne doit pas pouvoir déposer de fichier.
drop policy if exists bibliotheque_insert on storage.objects;
create policy bibliotheque_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bibliotheque' and (
      public._biblio_gestion(public._biblio_ecole(name))
      or (public._biblio_lecteur(public._biblio_ecole(name))
          and (storage.foldername(name))[2] = 'depots')
    )
  );

-- =====================================================================
--  5. Suggestions d'achat (migration 123)
-- =====================================================================
drop policy if exists biblio_suggestions_insert on biblio_suggestions;
create policy biblio_suggestions_insert on biblio_suggestions for insert with check (
  _biblio_gestion(ecole_id)
  or (_biblio_lecteur(ecole_id) and demandeur_profil_id = auth.uid() and statut = 'soumise')
);

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE — qui accède désormais à la bibliothèque, par établissement ?
-- =====================================================================
-- select ec.nom, pr.role, count(distinct pr.profil_id) as comptes
--   from profil_roles pr
--   join ecoles ec on ec.id = pr.ecole_id
--   join profils p on p.id = pr.profil_id and p.actif
--  where ec.type_etablissement = 'superieur' and pr.role::text <> 'parent'
--  group by ec.nom, pr.role order by ec.nom, pr.role;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- Réappliquer les policies des migrations 117-123 puis 126, qui utilisent
-- `est_membre_ecole` à la place de `_biblio_lecteur`, puis :
-- drop function if exists public._biblio_lecteur(uuid);
