-- =====================================================================
--  181 — « Relancer (push) » n'a jamais fonctionné
--
--  🔴 TROUVÉ EN ÉPROUVANT LA MIGRATION 180, et c'est un bug fonctionnel,
--  pas un bug de droits. `relancer_eleve(p_eleve)` charge son enregistrement
--  ainsi :
--
--      select e.ecole_id, e.prenom, e.nom, ec.nom as ecole_nom, ec.devise
--        into r from eleves e join ecoles ec on ec.id = e.ecole_id
--       where e.id = p_eleve;
--
--  …puis insère la notification en lisant `r.eleve_id` — un champ que `r`
--  NE CONTIENT PAS. PL/pgSQL ne s'en aperçoit qu'à l'exécution :
--
--      ERROR: record "r" has no field "eleve_id"
--
--  Conséquence : le bouton **« Relancer (push) »** de l'écran Recouvrement
--  ([src/pages/Recouvrement.jsx](src/pages/Recouvrement.jsx#L73)) a toujours
--  échoué. Et c'est le SEUL chemin que l'interface utilise pour relancer —
--  `relancer_facture`, qui est correcte, n'est appelée par aucun écran.
--
--  ⚠️ CE N'EST PAS LA BASCULE QUI L'A CASSÉ. La migration 180 n'a remplacé
--  que la chaîne de garde ; le `r.eleve_id` était là avant. La bascule l'a
--  seulement RÉVÉLÉ, parce qu'elle m'a fait appeler la fonction pour de vrai
--  au lieu de lire son en-tête. C'est l'argument pour éprouver chaque RPC et
--  pas seulement chaque policy.
--
--  La correction : `p_eleve`, le paramètre de la fonction, EST l'élève. On ne
--  touche à rien d'autre — même message, même garde (`a_acces('p_relancer')`,
--  posée en 180), même écriture dans `relances`.
-- =====================================================================

create or replace function public.relancer_eleve(p_eleve uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare r record; v_msg text; v_reste numeric; v_echeance date; v_ecole uuid := ecole_courante();
begin
  select e.ecole_id, e.prenom, e.nom, ec.nom as ecole_nom, ec.devise
    into r
  from eleves e join ecoles ec on ec.id = e.ecole_id
  where e.id = p_eleve;
  if r is null then raise exception 'Élève introuvable.'; end if;
  if not est_super_admin() and r.ecole_id <> v_ecole then raise exception 'Accès refusé.'; end if;
  if not (a_acces('p_relancer')) then raise exception 'Réservé au comptable.'; end if;

  -- Total restant dû + échéance la plus ancienne (factures non soldées)
  select coalesce(sum(f.montant_total - f.montant_paye), 0), min(f.date_echeance)
    into v_reste, v_echeance
  from factures f
  where f.eleve_id = p_eleve and f.statut not in ('payee','annulee')
    and (f.montant_total - f.montant_paye) > 0;

  if v_reste <= 0 then raise exception 'Aucun impayé pour cet élève.'; end if;

  v_msg := 'Rappel de paiement : '
        || trim(to_char(v_reste, 'FM999G999G999G990')) || ' ' || coalesce(r.devise,'XOF')
        || ' restent dus pour ' || r.prenom || ' ' || r.nom
        || coalesce(' (échéance ' || to_char(v_echeance,'DD/MM/YYYY') || ')', '') || '.';

  --  🔴 ICI LE CORRECTIF : `p_eleve` et non `r.eleve_id`, qui n'existe pas.
  insert into notifications (ecole_id, destinataire_id, titre, message, eleve_id, categorie)
  select r.ecole_id, t.profil_id, 'Rappel de paiement', v_msg, p_eleve, 'facture'
  from eleve_tuteurs et
  join tuteurs t on t.id = et.tuteur_id
  where et.eleve_id = p_eleve and t.profil_id is not null;

  insert into relances (ecole_id, facture_id, eleve_id, regle_id, palier,
                        canal, montant_du, message, statut)
  values (r.ecole_id, null, p_eleve, null, null, 'manuel', v_reste, v_msg, 'envoye');
end $fn$;

revoke execute on function public.relancer_eleve(uuid) from public, anon;
grant  execute on function public.relancer_eleve(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
--  Aucune : rétablir `r.eleve_id` remettrait une fonction qui échoue
--  systématiquement. S'il faut revenir en arrière, c'est la migration 180
--  (la garde) qu'il faut annuler, pas celle-ci.
