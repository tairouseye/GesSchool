-- =====================================================================
--  230 — Espace parent, d'après les écrans de Mme Kane (Tut'Tank, 05/11/2026)
--
--  1. Un mois DÉJÀ DÛ et sans facture se paie depuis le téléphone.
--     Relevé le 05/11 : 79 élèves de Tut'Tank en retard, tous sur octobre,
--     sans facture pour ce mois. `_lignes_avance` ne proposait que les mois
--     à partir du mois en cours : l'écran disait « En retard » sans aucun
--     moyen de payer. On retire ce plancher. Le reste ne change pas : mois
--     récurrents, non facturés, et pas déjà déclarés en attente.
--     `declarer_avance` passe par cette liste : la preuve reste obligatoire
--     et la caisse valide, comme pour une avance.
--
--  2. `mes_enfants` rend aussi `date_naissance` (l'âge sur la carte de
--     l'enfant) et `telephone_ecole` (le bouton WhatsApp de l'accueil), en
--     FIN de liste. Le parent ne voit que SES enfants, comme avant : le
--     filtre sur `t.profil_id = auth.uid()` ne bouge pas.
--
--  Repart des définitions de la mig. 202 (lignes) et 220 (mes_enfants).
--  Le type de retour de `mes_enfants` change : drop + create, droits
--  rétablis à l'identique.
--
--  ANNULATION : remettre `and x.mois >= to_char(current_date, 'YYYY-MM')`
--  dans `_lignes_avance`, et rejouer 220_mes_enfants_devise.sql.
-- =====================================================================

create or replace function public._lignes_avance(p_eleve uuid)
returns table(mois text, libelle_mois text, frais_id uuid, libelle text, montant numeric)
language plpgsql stable security definer set search_path = public as $function$
#variable_conflict use_column
declare v_annee uuid;
begin
  select a.id into v_annee from annees_scolaires a join eleves e on e.ecole_id = a.ecole_id
   where e.id = p_eleve and a.courante limit 1;
  if v_annee is null then return; end if;

  return query
  select x.mois, public._libelle_mois(x.mois), x.frais_id, x.libelle, x.montant
    from public._echeancier(p_eleve, v_annee) x
   where x.recurrent and not x.facture
     and not exists (
       select 1 from declarations_paiement d, jsonb_array_elements(d.avance_lignes) j
        where d.eleve_id = p_eleve and d.statut = 'en_attente' and j->>'libelle' = x.libelle)
   order by x.mois, x.libelle;
end $function$;

drop function if exists public.mes_enfants();
create function public.mes_enfants()
returns table(eleve_id uuid, prenom text, nom text, matricule text, classe text, ecole text, ecole_id uuid,
              logo text, annonces_nouvelles bigint, photo text, couleur_primaire text, couleur_secondaire text,
              devise text, date_naissance date, telephone_ecole text)
language sql security definer set search_path = public as $function$
  select e.id, e.prenom, e.nom, e.matricule, c.libelle, ec.nom, ec.id, ec.logo_url,
         (select count(*) from annonces_enfant(e.id) a
           where a.publie_le >= now() - interval '7 days'),
         e.photo_url,
         ec.couleur_primaire, ec.couleur_secondaire,
         coalesce(ec.devise, 'XOF'),
         e.date_naissance, ec.telephone
  from tuteurs t
  join eleve_tuteurs et on et.tuteur_id = t.id
  join eleves e on e.id = et.eleve_id
  left join ecoles ec on ec.id = e.ecole_id
  left join annees_scolaires an on an.ecole_id = e.ecole_id and an.courante = true
  left join inscriptions ins on ins.eleve_id = e.id and ins.annee_id = an.id
  left join classes c on c.id = ins.classe_id
  where t.profil_id = auth.uid()
  order by e.nom, e.prenom
$function$;

revoke all on function public.mes_enfants() from public, anon;
grant execute on function public.mes_enfants() to authenticated;
