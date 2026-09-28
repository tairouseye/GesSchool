-- =====================================================================
--  159 — Le rayon réglementaire porte une AUDIENCE, comme une annonce
--
--  Deux corrections de l'utilisateur ont conduit ici, et la seconde a
--  renversé la première conclusion.
--
--  1) « Tut'Tank a bien publié son règlement intérieur ». Exact : il est en
--     pièce jointe d'une annonce du 28/09, ciblée sur le cycle Élémentaire.
--     Mon audit voyait la tuile « Règlement » vide et en concluait qu'aucune
--     école n'avait rien publié — constat juste, cause fausse.
--
--  2) « Mais le préscolaire ne doit pas voir ce règlement, qui n'appartient
--     qu'à l'élémentaire. » Et là tout change : le ciblage n'était pas un
--     défaut, c'était une DÉCISION. Un établissement peut avoir un règlement
--     par cycle, et les 45 élèves du Préscolaire n'ont pas à recevoir celui
--     de l'Élémentaire.
--
--  ⚠️ CE QUI ÉTAIT FAUTIF, C'ÉTAIT MON RAYON. « Textes de référence » ne
--  savait publier qu'en tout-ou-rien : `portee = 'familles'` ⇒ visible de
--  TOUS les membres de l'école. Verser le règlement de l'Élémentaire y
--  aurait donc violé l'intention de l'école. Le vrai manque n'est pas une
--  porte entre les deux endroits, c'est que le rayon ignorait la notion
--  d'audience que les annonces possèdent depuis la migration 152.
--
--  Un texte de référence reçoit donc le MÊME vocabulaire de ciblage qu'une
--  annonce : toute l'école, un cycle, un niveau, une classe. Le règlement de
--  l'Élémentaire s'y range, consultable en permanence — par les familles de
--  l'Élémentaire, et par elles seules.
--
--  ⚠️ ET ON NE RECOPIE PAS LA RÈGLE UNE CINQUIÈME FOIS. L'en-tête de la 152
--  prévient qu'elle vit à quatre endroits. On la SORT donc dans une fonction,
--  `_public_vise()`, que `_annonce_visible_par()` et le rayon appellent tous
--  deux. Une règle, deux appelants — au lieu de deux copies qui divergeront.
--  Le corps de `_annonce_visible_par` est réécrit à l'identique en termes de
--  résultat : la recette de la 152 est rejouée après coup pour le prouver.
--
--  Prérequis : migrations 150, 151, 152, 153.
-- =====================================================================

-- =====================================================================
--  1. LA RÈGLE, UNE SEULE FOIS
-- =====================================================================
--  Qui, parmi le PUBLIC d'un établissement (familles et étudiants), est visé
--  par un contenu portant cette audience ? Le personnel est traité à part par
--  chaque appelant : ses droits ne dépendent pas d'une inscription.
--
--  Nuance conservée de la 152, et elle compte : une audience « tous » ou
--  « parents » atteint un parent DÈS QU'IL A UN ENFANT dans l'école, même
--  sans inscription active. Un ciblage classe/niveau/cycle exige au contraire
--  l'inscription de l'année courante — c'est elle qui rattache l'enfant à une
--  classe. 35 élèves de Tut'Tank n'ont aucun responsable rattaché : la
--  distinction n'est pas théorique.
create or replace function public._public_vise(
  p_ecole uuid, p_cible text, p_classe uuid, p_niveau uuid, p_cycle uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select p_ecole is not null and auth.uid() is not null and (
    -- Parent : contenu général — un enfant dans l'école suffit.
    (coalesce(p_cible, 'tous') in ('tous', 'parents') and exists (
       select 1 from tuteurs t
         join eleve_tuteurs et on et.tuteur_id = t.id
         join eleves e on e.id = et.eleve_id
        where t.profil_id = auth.uid() and e.ecole_id = p_ecole))
    -- Parent : contenu ciblé — passe par l'inscription de l'année courante.
    or (p_cible in ('classe', 'niveau', 'cycle') and exists (
          select 1 from tuteurs t
            join eleve_tuteurs et on et.tuteur_id = t.id
            join eleves e on e.id = et.eleve_id
            join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante
            join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
            join classes c on c.id = ins.classe_id
            join niveaux n on n.id = c.niveau_id
           where t.profil_id = auth.uid()
             and e.ecole_id = p_ecole
             and ((p_cible = 'classe' and p_classe = c.id)
               or (p_cible = 'niveau' and p_niveau = n.id)
               or (p_cible = 'cycle'  and p_cycle  = n.cycle_id))))
    -- Étudiant du supérieur : ni classe, ni niveau, ni cycle chez lui.
    or (coalesce(p_cible, 'tous') in ('tous', 'etudiants') and exists (
          select 1 from eleves e
           where e.profil_id = auth.uid() and e.ecole_id = p_ecole))
  );
$$;
revoke execute on function public._public_vise(uuid, text, uuid, uuid, uuid) from public, anon;
grant execute on function public._public_vise(uuid, text, uuid, uuid, uuid) to authenticated;

--  `_annonce_visible_par` devient un appelant, plus une copie. Le personnel
--  reste traité ici : son droit vient du rôle, pas d'une inscription.
create or replace function public._annonce_visible_par(p_annonce uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from annonces a where a.id = p_annonce and (
      est_super_admin()
      or (a.ecole_id = ecole_courante()
          and (est_admin() or a_role('direction') or a_role('comptable')
               or a_role('secretaire') or a_role('enseignant')))
      or public._public_vise(a.ecole_id, a.cible, a.classe_id, a.niveau_id, a.cycle_id)
    )
  );
$$;
revoke execute on function public._annonce_visible_par(uuid) from public, anon;
grant execute on function public._annonce_visible_par(uuid) to authenticated;

-- =====================================================================
--  2. LE RAYON REÇOIT UNE AUDIENCE
-- =====================================================================
alter table fichiers_ecole add column if not exists cible text;
alter table fichiers_ecole add column if not exists classe_id uuid references classes(id) on delete set null;
alter table fichiers_ecole add column if not exists niveau_id uuid references niveaux(id) on delete set null;
alter table fichiers_ecole add column if not exists cycle_id  uuid references cycles(id)  on delete set null;

alter table fichiers_ecole drop constraint if exists fichiers_ecole_cible_chk;
alter table fichiers_ecole add constraint fichiers_ecole_cible_chk
  check (cible is null or cible in ('tous', 'parents', 'etudiants', 'classe', 'niveau', 'cycle'));

create index if not exists fichiers_ecole_cible_idx
  on fichiers_ecole(ecole_id, portee, cible);

--  ⚠️ `add column` laisse `cible` NULL sur les lignes existantes, et
--  `_public_vise` traite NULL comme « tous » : un texte déjà publié aux
--  familles garde donc exactement l'audience qu'il avait. Aucune régression
--  silencieuse, ni dans un sens ni dans l'autre.
comment on column fichiers_ecole.cible is
  'Audience du texte publié : tous/parents/etudiants/classe/niveau/cycle. NULL = toute l''école (mig. 159).';

-- --- La policy : deux voies, et la seconde respecte l'audience ------------
drop policy if exists fichiers_ecole_select on fichiers_ecole;
create policy fichiers_ecole_select on fichiers_ecole for select using (
  est_super_admin()
  or (ecole_id = ecole_courante()
      and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  -- Voie 1 : une pièce jointe suit l'audience de SON ANNONCE (mig. 150, 152).
  or (annonce_id is not null and _annonce_visible_par(annonce_id))
  -- Voie 2 : un texte versé au rayon suit SA PROPRE audience (mig. 159).
  --  C'est ce qui permet de ranger le règlement de l'Élémentaire sur
  --  l'étagère sans l'ouvrir aux familles du Préscolaire — la correction
  --  que ma 153 rendait impossible, faute de savoir cibler.
  or (portee = 'familles' and _public_vise(ecole_id, cible, classe_id, niveau_id, cycle_id))
);

-- --- Le rayon, vu des familles -------------------------------------------
drop function if exists public.textes_reference();
create or replace function public.textes_reference()
returns table (id uuid, titre text, categorie text, reference text,
               date_texte date, nom_fichier text, chemin text,
               taille bigint, ecole text, portee_libelle text)
language sql stable security definer set search_path = public as $$
  select f.id, f.titre, f.categorie, f.reference, f.date_texte,
         f.nom_fichier, f.chemin, f.taille, ec.nom,
         -- Dire à qui le texte s'adresse : « CM1 », « Élémentaire »… Sans
         -- cela un parent de deux cycles ne saurait pas lequel le concerne.
         coalesce(c.libelle, n.libelle, cy.libelle)
    from fichiers_ecole f
    join ecoles ec on ec.id = f.ecole_id
    left join classes c  on c.id  = f.classe_id
    left join niveaux n  on n.id  = f.niveau_id
    left join cycles  cy on cy.id = f.cycle_id
   where f.portee = 'familles'
     and f.categorie in ('reglement', 'texte_officiel', 'convention', 'procedure')
     and public._public_vise(f.ecole_id, f.cible, f.classe_id, f.niveau_id, f.cycle_id)
   order by case f.categorie
              when 'reglement' then 1 when 'procedure' then 2
              when 'convention' then 3 else 4 end,
            f.date_texte desc nulls last, f.titre;
$$;
revoke execute on function public.textes_reference() from public, anon;
grant execute on function public.textes_reference() to authenticated;

-- =====================================================================
--  3. LA SEULE PORTE : une action explicite, qui exige l'audience
-- =====================================================================
--  On ne laisse pas l'interface composer `portee` + `categorie` + ciblage sur
--  une pièce jointe : ce serait retomber sur une combinaison implicite. Une
--  RPC nommée d'après l'intention rend le geste lisible en relecture — et
--  l'audience y est un PARAMÈTRE OBLIGATOIRE, pour qu'on ne puisse pas
--  publier à tout le monde par omission.
create or replace function public.verser_au_rayon(
  p_fichier   uuid,
  p_categorie text,
  p_cible     text,
  p_entite    uuid default null,          -- la classe, le niveau ou le cycle visé
  p_reference text default null,
  p_date      date default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid;
begin
  if p_categorie not in ('reglement', 'texte_officiel', 'convention', 'procedure') then
    raise exception 'Catégorie hors du rayon réglementaire : %', p_categorie;
  end if;
  if p_cible not in ('tous', 'classe', 'niveau', 'cycle') then
    raise exception 'Audience inconnue : %', p_cible;
  end if;
  if p_cible <> 'tous' and p_entite is null then
    raise exception 'Une audience « % » exige de désigner l''entité visée.', p_cible;
  end if;

  select f.ecole_id into v_ecole from fichiers_ecole f where f.id = p_fichier;
  if v_ecole is null then
    raise exception 'Document introuvable.';
  end if;
  if not public._doc_gestion(v_ecole) then
    raise exception 'Accès refusé.';
  end if;

  --  L'entité doit appartenir à l'école : sans ce contrôle, on pourrait
  --  cibler la classe d'un autre établissement et rendre le texte invisible
  --  partout — un échec silencieux est pire qu'un refus.
  if p_cible = 'classe' and not exists (select 1 from classes x where x.id = p_entite and x.ecole_id = v_ecole) then
    raise exception 'Classe inconnue de cet établissement.';
  end if;
  if p_cible = 'niveau' and not exists (select 1 from niveaux x where x.id = p_entite and x.ecole_id = v_ecole) then
    raise exception 'Niveau inconnu de cet établissement.';
  end if;
  if p_cible = 'cycle' and not exists (select 1 from cycles x where x.id = p_entite and x.ecole_id = v_ecole) then
    raise exception 'Cycle inconnu de cet établissement.';
  end if;

  update fichiers_ecole
     set portee     = 'familles',
         categorie  = p_categorie,
         cible      = p_cible,
         -- Une seule entité renseignée : les autres repartent à NULL, sinon
         -- un changement d'audience laisserait un ciblage fantôme (mig. 152).
         classe_id  = case when p_cible = 'classe' then p_entite end,
         niveau_id  = case when p_cible = 'niveau' then p_entite end,
         cycle_id   = case when p_cible = 'cycle'  then p_entite end,
         reference  = coalesce(nullif(trim(p_reference), ''), reference),
         date_texte = coalesce(p_date, date_texte)
   where id = p_fichier;
end $$;
revoke execute on function public.verser_au_rayon(uuid, text, text, uuid, text, date) from public, anon;
grant execute on function public.verser_au_rayon(uuid, text, text, uuid, text, date) to authenticated;

--  Le retrait doit exister : publier par erreur doit se défaire sans détour
--  par l'éditeur SQL.
create or replace function public.retirer_du_rayon(p_fichier uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid; v_annonce uuid;
begin
  select f.ecole_id, f.annonce_id into v_ecole, v_annonce
    from fichiers_ecole f where f.id = p_fichier;
  if v_ecole is null then
    raise exception 'Document introuvable.';
  end if;
  if not public._doc_gestion(v_ecole) then
    raise exception 'Accès refusé.';
  end if;

  --  Une pièce jointe retrouve sa catégorie d'origine : sans cela elle
  --  resterait classée « règlement » tout en sortant du rayon, donc
  --  invisible partout et introuvable dans la bibliothèque de fichiers.
  update fichiers_ecole
     set portee    = 'interne',
         categorie = case when v_annonce is not null then 'annonce' else categorie end,
         cible     = null, classe_id = null, niveau_id = null, cycle_id = null
   where id = p_fichier;
end $$;
revoke execute on function public.retirer_du_rayon(uuid) from public, anon;
grant execute on function public.retirer_du_rayon(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • le « Règlement intérieur.pdf » de Tut'Tank, versé au rayon avec
--     l'audience « cycle = Élémentaire », apparaît dans « Textes de
--     référence » pour Awa BOYE (enfant en CM1) et PAS pour un parent dont
--     le seul enfant serait en Préscolaire ;
--   • l'annonce du 28/09 reste ciblée Élémentaire : on publie le document,
--     pas l'annonce ;
--   • retiré du rayon, il redevient invisible des familles et reprend la
--     catégorie « annonce », ciblage remis à zéro ;
--   • une pièce jointe NON versée reste soumise à l'audience de son annonce
--     (le trou fermé par la 153 ne se réouvre pas tout seul) ;
--   • un texte déjà publié avant cette migration a `cible = NULL`, traité
--     comme « toute l'école » : son audience ne change pas ;
--   • `verser_au_rayon` refuse une catégorie hors rayon, une audience
--     inconnue, une audience ciblée sans entité, et une entité d'une autre
--     école ;
--   • ⚠️ REJOUER LA RECETTE DE LA 152 : `_annonce_visible_par` a été réécrite
--     pour appeler `_public_vise`. Le résultat doit être inchangé — annonce
--     « Élémentaire » reçue par un parent de CI/CP et non de TPS/PS, pièce
--     jointe suivant la même audience, ni la ligne ni l'octet.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.retirer_du_rayon(uuid);
-- drop function if exists public.verser_au_rayon(uuid, text, text, uuid, text, date);
-- drop function if exists public.textes_reference();
-- alter table fichiers_ecole drop constraint if exists fichiers_ecole_cible_chk;
-- alter table fichiers_ecole drop column if exists cycle_id;
-- alter table fichiers_ecole drop column if exists niveau_id;
-- alter table fichiers_ecole drop column if exists classe_id;
-- alter table fichiers_ecole drop column if exists cible;
-- drop function if exists public._public_vise(uuid, text, uuid, uuid, uuid);
-- (puis réappliquer `_annonce_visible_par` et `textes_reference` de la 152/153
--  ainsi que la policy `fichiers_ecole_select` de la 153.)
