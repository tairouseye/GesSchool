-- =====================================================================
--  126 — Bibliothèque : CORRECTIFS DE SÉCURITÉ RLS
--
--  Trois failles trouvées à l'audit du module. Toutes relèvent du même
--  oubli : dans une policy UPDATE, `using` contrôle la ligne AVANT
--  modification et `with check` la ligne APRÈS. Contrôler l'identité dans
--  `with check` sans contrôler l'état laisse l'utilisateur écrire l'état
--  qu'il veut, tant que la ligne reste la sienne.
--
--  L'interface ne propose évidemment aucun de ces gestes ; la faille est
--  exploitable par appel direct à l'API REST, avec le jeton d'un simple
--  étudiant. C'est précisément pour cela que la règle doit vivre en RLS.
--
--  Prérequis : migrations 121 et 123.
-- =====================================================================

-- --- 1. DÉPÔTS : un étudiant pouvait s'auto-valider ------------------------
--  Ancien `with check` : « gestion OU je suis le déposant ».
--  Un déposant pouvait donc faire passer son mémoire de `brouillon` à
--  `valide`, voire `publie` — et `biblio_depots_select` rend visible à tout
--  l'établissement ce qui est `publie`. Son travail non relu apparaissait
--  ainsi comme validé par la bibliothèque.
--
--  Le déposant ne peut désormais écrire QUE les deux états qui lui
--  appartiennent : son brouillon, et sa soumission.
drop policy if exists biblio_depots_update on biblio_depots;
create policy biblio_depots_update on biblio_depots for update using (
  _biblio_gestion(ecole_id)
  or (deposant_profil_id = auth.uid() and statut in ('brouillon', 'a_corriger'))
) with check (
  _biblio_gestion(ecole_id)
  or (deposant_profil_id = auth.uid() and statut in ('brouillon', 'soumis'))
);

--  Même trou à la création : rien n'imposait le statut de départ, un dépôt
--  pouvait naître `publie`.
drop policy if exists biblio_depots_insert on biblio_depots;
create policy biblio_depots_insert on biblio_depots for insert with check (
  _biblio_gestion(ecole_id)
  or (est_membre_ecole(ecole_id)
      and deposant_profil_id = auth.uid()
      and statut in ('brouillon', 'soumis'))
);

-- --- 2. SUGGESTIONS D'ACHAT : auto-acceptation -----------------------------
--  Même schéma : le demandeur pouvait passer sa propre suggestion à
--  `acceptee` ou `commandee`, et écrire la `reponse` de la bibliothèque.
drop policy if exists biblio_suggestions_update on biblio_suggestions;
create policy biblio_suggestions_update on biblio_suggestions for update using (
  _biblio_gestion(ecole_id)
  or (demandeur_profil_id = auth.uid() and statut = 'soumise')
) with check (
  _biblio_gestion(ecole_id)
  or (demandeur_profil_id = auth.uid() and statut = 'soumise')
);

-- --- 3. RÉSERVATIONS : la file d'attente ne fonctionnait PAS ---------------
--  Bug fonctionnel, pas seulement de sécurité. Le rang était calculé côté
--  client en lisant les réservations actives de la ressource — mais la RLS
--  ne montre à un étudiant QUE LES SIENNES. Il lisait donc une liste vide et
--  repartait avec le rang 1. Tous les étudiants se retrouvaient premiers :
--  la file n'ordonnait rien.
--
--  Le rang ne peut pas être calculé par quelqu'un qui n'a pas le droit de
--  voir la file. Il est désormais attribué en base, à l'insertion, pour tout
--  le monde sauf la gestion (qui peut encore le forcer à la main).
create or replace function public.biblio_rang_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if _biblio_gestion(new.ecole_id) and new.rang is not null and new.rang > 1 then
    return new;                       -- rang imposé volontairement par la gestion
  end if;
  select coalesce(max(r.rang), 0) + 1 into new.rang
    from biblio_reservations r
   where r.ressource_id = new.ressource_id
     and r.statut in ('active', 'disponible');
  return new;
end $$;

drop trigger if exists trg_biblio_rang_reservation on biblio_reservations;
create trigger trg_biblio_rang_reservation
  before insert on biblio_reservations
  for each row execute function public.biblio_rang_reservation();

--  Et l'usager ne peut plus réécrire sa propre réservation pour passer
--  devant : il garde le seul geste qui le concerne, l'annulation.
drop policy if exists biblio_reservations_update on biblio_reservations;
create policy biblio_reservations_update on biblio_reservations for update
  using (
    _biblio_gestion(ecole_id)
    or (profil_id = auth.uid() and statut in ('active', 'disponible'))
  )
  with check (
    _biblio_gestion(ecole_id)
    or (profil_id = auth.uid() and statut = 'annulee')
  );

-- --- 4. Ciblage par rôle : le rôle doit être tenu DANS l'établissement -----
--  `_biblio_peut_lire` acceptait n'importe quel `profil_roles` de
--  l'utilisateur, sans vérifier l'école. Quelqu'un qui est enseignant dans
--  l'établissement B et simple membre de A pouvait ainsi ouvrir un document
--  de A ciblé « enseignants ». Cas étroit (il faut une double appartenance),
--  mais c'est exactement le type de fuite que le cloisonnement doit exclure.
create or replace function public._biblio_peut_lire(p_numerique uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from biblio_numeriques n
    where n.id = p_numerique
      and est_membre_ecole(n.ecole_id)                       -- cloisonnement institution
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
                        and pr.ecole_id = n.ecole_id        -- ← le rôle doit être tenu ICI
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

-- --- 5. Performance : les statistiques scannent les emprunts par date ------
--  `biblio_statistiques` (122) fait douze sous-requêtes mensuelles plus le
--  classement des ouvrages, toutes filtrées sur (ecole_id, date_emprunt).
--  Le seul index existant est (ecole_id, statut) : inutilisable ici.
create index if not exists biblio_emprunts_date_idx
  on biblio_emprunts(ecole_id, date_emprunt);

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop index if exists biblio_emprunts_date_idx;
-- (puis réappliquer les policies des migrations 121/123 et la fonction
--  `_biblio_peut_lire` de la migration 119)
