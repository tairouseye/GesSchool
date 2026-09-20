-- =====================================================================
--  146 — Une notification doit dire DE QUEL ENFANT elle parle
--
--  Constat de l'utilisateur : « un parent avec 3 élèves dans une école ne
--  devrait pas recevoir 3 mêmes notifications pour la même école ».
--
--  Mesuré en base avant de corriger. Deux choses, et une seule est un défaut :
--
--   • Les ANNONCES ne se dupliquent pas : `annonces_parent()` porte un
--     `select distinct`, et aucun déclencheur ne transforme une annonce en
--     notification. Rien à faire de ce côté.
--
--   • Les NOTIFICATIONS, elles, sont émises PAR ENFANT — et c'est correct :
--     trois enfants, trois notes saisies, trois évènements réels. Le défaut
--     est qu'elles sont INDISCERNABLES. Relevé sur un parent de la base :
--     deux « Demande de document — Votre document est prêt à être retiré. »
--     rigoureusement identiques, à deux dates, pour deux enfants différents.
--
--  La colonne `notifications.eleve_id` existe depuis la migration 112 et
--  `_notifier_parents` la renseigne. Mais `traiter_demande` (mig. 028) est
--  antérieure : elle insère sa notification À LA MAIN, sans `eleve_id` ni
--  `categorie`. C'est la seule source qui les omette.
--
--  L'interface affiche désormais le nom de l'enfant à partir de cette
--  colonne (elle le retrouve par `mes_enfants`, la table `eleves` étant
--  fermée au parent). Encore faut-il que la colonne soit remplie.
--
--  Prérequis : migrations 028, 112.
-- =====================================================================

create or replace function public.traiter_demande(p_demande uuid, p_statut text, p_reponse text)
returns void language plpgsql security definer set search_path = public as $$
declare d record; v_profil uuid;
begin
  select * into d from demandes_documents where id = p_demande;
  if d is null then raise exception 'Demande introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then raise exception 'Accès refusé.'; end if;
  if not (est_admin() or a_role('comptable') or a_role('secretaire')) then
    raise exception 'Réservé à l''administration.';
  end if;

  update demandes_documents
    set statut = p_statut, reponse = p_reponse, traite_par = auth.uid(), traite_le = now()
    where id = p_demande;

  if p_statut in ('pret', 'rejete') then
    select profil_id into v_profil from tuteurs where id = d.tuteur_id;
    if v_profil is not null then
      -- Ajouté en 146 : `eleve_id` (pour nommer l'enfant côté parent),
      -- `categorie` (pour les pastilles par section) et le TYPE de document
      -- dans le message — deux demandes distinctes cessent d'être un doublon
      -- apparent.
      insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
      values (
        d.ecole_id, v_profil, 'Demande de document',
        case when p_statut = 'pret'
             then 'Votre document est prêt à être retiré.'
             else 'Votre demande a été traitée.' end
        || coalesce(' (' || nullif(d.type, '') || ')', '')
        || coalesce(' ' || nullif(p_reponse, ''), ''),
        d.eleve_id, 'document');
    end if;
  end if;
end $$;

revoke execute on function public.traiter_demande(uuid, text, text) from public, anon;
grant execute on function public.traiter_demande(uuid, text, text) to authenticated;

-- --- Rattrapage des notifications déjà envoyées ---------------------------
--  Les notifications antérieures n'ont pas d'`eleve_id` : le parent ne
--  saurait toujours pas de quel enfant elles parlent. On le retrouve quand
--  le rattachement est SANS AMBIGUÏTÉ — c'est-à-dire quand le destinataire
--  n'a qu'un seul enfant dans cette école. Au-delà, deviner serait pire que
--  se taire : une notification attribuée au mauvais enfant induirait en
--  erreur, alors qu'une notification sans nom se lit encore.
update notifications n
   set eleve_id = u.eleve_id
  from (
    select t.profil_id, e.ecole_id, min(e.id) as eleve_id, count(*) as nb
      from tuteurs t
      join eleve_tuteurs et on et.tuteur_id = t.id
      join eleves e on e.id = et.eleve_id
     where t.profil_id is not null
     group by t.profil_id, e.ecole_id
    having count(*) = 1
  ) u
 where n.eleve_id is null
   and n.destinataire_id = u.profil_id
   and n.ecole_id = u.ecole_id;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   select titre, message, eleve_id from notifications
--    where destinataire_id = '<un parent de plusieurs enfants>';
--   → les notifications futures portent un eleve_id ; les anciennes d'un
--     parent multi-enfants restent à null (assumé : mieux vaut ne rien dire
--     que désigner le mauvais enfant).
--   Puis, dans l'espace parent → Alertes : le nom de l'enfant s'affiche en
--   pastille dès qu'il y a plus d'un enfant.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- (réappliquer traiter_demande de la migration 028 ; le rattrapage des
--  `eleve_id` n'est pas annulé — il ne fait que compléter une donnée
--  manquante, sans rien écraser.)
