-- =====================================================================
--  159 — Une pièce jointe peut aussi devenir un texte de référence
--
--  Constaté en vérifiant une remarque de l'utilisateur : Tut'Tank AVAIT
--  publié son règlement intérieur, mais en pièce jointe d'une annonce
--  ciblée sur le cycle « Élémentaire ». Conséquences mesurées :
--
--    • 51 élèves d'Élémentaire reçoivent le règlement ;
--    • les 45 du Préscolaire, non — alors qu'un règlement intérieur
--      concerne tout l'établissement ;
--    • et il n'apparaît PAS dans « Textes de référence », l'étagère où l'on
--      revient le chercher : une annonce se lit une fois, un règlement se
--      consulte pendant des années.
--
--  ⚠️ CE N'ÉTAIT PAS UN DÉFAUT, C'ÉTAIT MA CONCEPTION — ET ELLE ÉTAIT TROP
--  RAIDE. Les migrations 150/151 ont posé deux endroits distincts, et ma
--  153 a exigé `annonce_id is null` pour la portée « familles ». Je fermais
--  un vrai trou : une pièce jointe d'annonce ciblée qui, marquée
--  « familles », fuitait au-delà de son audience.
--
--  Mais je confondais deux choses :
--    • une portée « familles » posée PAR ACCIDENT — le trou à fermer ;
--    • une portée « familles » posée VOLONTAIREMENT par l'école, qui est une
--      décision de publication parfaitement légitime.
--  Dans le second cas l'annonce reste ciblée ; seul le DOCUMENT devient
--  consultable par tous. C'est exactement ce qu'on veut d'un règlement.
--
--  ⚠️ COMMENT DISTINGUER L'ACCIDENT DE L'INTENTION, puisque la base ne voit
--  que la valeur d'une colonne ? Par un DOUBLE VERROU, que seule une
--  démarche explicite peut franchir :
--    1. `portee = 'familles'` — et `televerserFichier` force 'interne' dès
--       qu'il y a une annonce, donc cette valeur ne peut pas y arriver seule ;
--    2. une CATÉGORIE du rayon réglementaire — or une pièce jointe reçoit
--       `categorie = 'annonce'`, également forcée.
--  Deux champs, deux gestes, aucun par défaut. La RPC `verser_au_rayon()`
--  les pose ensemble, sous contrôle de rôle : c'est la seule porte.
--
--  Prérequis : migrations 150, 151, 153.
-- =====================================================================

-- --- 1. La portée « familles » vaut de nouveau pour une pièce jointe ------
--  On retire la condition `annonce_id is null` de la mig. 153. Les deux
--  voies restent distinctes et s'additionnent : une pièce jointe est visible
--  si son annonce l'est, OU si elle a été versée au rayon.
drop policy if exists fichiers_ecole_select on fichiers_ecole;
create policy fichiers_ecole_select on fichiers_ecole for select using (
  est_super_admin()
  or (ecole_id = ecole_courante()
      and (est_admin() or a_role('direction') or a_role('comptable') or a_role('secretaire')))
  -- Voie 1 : une pièce jointe suit l'audience de son annonce (mig. 150, 152).
  or (annonce_id is not null and _annonce_visible_par(annonce_id))
  -- Voie 2 : un document versé au rayon est lisible par tout membre —
  -- décision de publication explicite, qu'il soit attaché ou non (mig. 159).
  or (portee = 'familles' and est_membre_ecole(ecole_id))
);

-- --- 2. Le rayon accepte les documents attachés ---------------------------
--  Le filtre de catégorie suffit : une pièce jointe porte `categorie =
--  'annonce'` et reste donc dehors tant qu'on ne l'a pas reclassée.
create or replace function public.textes_reference()
returns table (id uuid, titre text, categorie text, reference text,
               date_texte date, nom_fichier text, chemin text,
               taille bigint, ecole text)
language sql stable security definer set search_path = public as $$
  select f.id, f.titre, f.categorie, f.reference, f.date_texte,
         f.nom_fichier, f.chemin, f.taille, ec.nom
    from fichiers_ecole f
    join ecoles ec on ec.id = f.ecole_id
   where f.portee = 'familles'
     and f.categorie in ('reglement', 'texte_officiel', 'convention', 'procedure')
     and est_membre_ecole(f.ecole_id)
   order by case f.categorie
              when 'reglement' then 1 when 'procedure' then 2
              when 'convention' then 3 else 4 end,
            f.date_texte desc nulls last, f.titre;
$$;
revoke execute on function public.textes_reference() from public, anon;
grant execute on function public.textes_reference() to authenticated;

-- --- 3. La seule porte : une action explicite et tracée -------------------
--  On ne laisse pas l'interface composer elle-même `portee` + `categorie`
--  sur une pièce jointe : ce serait retomber sur une combinaison implicite.
--  Une RPC nommée d'après l'intention rend le geste lisible en relecture.
create or replace function public.verser_au_rayon(
  p_fichier   uuid,
  p_categorie text,
  p_reference text default null,
  p_date      date default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ecole uuid;
begin
  if p_categorie not in ('reglement', 'texte_officiel', 'convention', 'procedure') then
    raise exception 'Catégorie hors du rayon réglementaire : %', p_categorie;
  end if;
  select f.ecole_id into v_ecole from fichiers_ecole f where f.id = p_fichier;
  if v_ecole is null then
    raise exception 'Document introuvable.';
  end if;
  if not public._doc_gestion(v_ecole) then
    raise exception 'Accès refusé.';
  end if;

  update fichiers_ecole
     set portee     = 'familles',
         categorie  = p_categorie,
         reference  = coalesce(nullif(trim(p_reference), ''), reference),
         date_texte = coalesce(p_date, date_texte)
   where id = p_fichier;
end $$;
revoke execute on function public.verser_au_rayon(uuid, text, text, date) from public, anon;
grant execute on function public.verser_au_rayon(uuid, text, text, date) to authenticated;

--  Le retrait doit exister : publier par erreur un document interne aux
--  familles doit pouvoir se défaire, sans détour par l'éditeur SQL.
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
         categorie = case when v_annonce is not null then 'annonce' else categorie end
   where id = p_fichier;
end $$;
revoke execute on function public.retirer_du_rayon(uuid) from public, anon;
grant execute on function public.retirer_du_rayon(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • le « Règlement intérieur.pdf » de Tut'Tank, versé au rayon, apparaît
--     dans « Textes de référence » pour un parent de PRÉSCOLAIRE — alors que
--     l'annonce qui le portait ne le visait pas ;
--   • l'annonce, elle, reste ciblée Élémentaire : on publie le document, pas
--     l'annonce ;
--   • retiré du rayon, il redevient invisible du parent de Préscolaire, et
--     reprend la catégorie « annonce » ;
--   • une pièce jointe NON versée reste soumise à l'audience de son annonce
--     (le trou de la mig. 153 ne se réouvre pas tout seul) ;
--   • `verser_au_rayon` avec une catégorie hors rayon est refusée ;
--   • un compte sans rôle de gestion est refusé sur les deux RPC.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.retirer_du_rayon(uuid);
-- drop function if exists public.verser_au_rayon(uuid, text, text, date);
-- (puis réappliquer la policy `fichiers_ecole_select` et `textes_reference()`
--  de la migration 153.)
