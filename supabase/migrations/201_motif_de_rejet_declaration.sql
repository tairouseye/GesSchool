-- =====================================================================
--  201 — Dire au parent POURQUOI sa déclaration a été rejetée
--
--  🔴 LA QUESTION DU PROMOTEUR : « comment le parent va savoir l'objet du
--  rejet ? » Réponse mesurée : **il ne le sait pas, et personne ne le lui
--  dit.**
--    • `rejeter_declaration(p_decl)` ne prenait **aucun motif** — elle
--      basculait le statut, rien de plus ;
--    • `declarations_paiement` n'avait **aucune colonne** pour le porter ;
--    • `enfant_declarations()` rendait `numero, montant, statut` — pas de
--      motif, pas même la date ;
--    • **aucune notification** n'était émise au rejet.
--  Le parent devait donc deviner, et seulement s'il pensait à retourner voir
--  son espace. La migration 198 rend ce cas FRÉQUENT (toute déclaration sans
--  preuve devra être rejetée), donc le silence devient un vrai problème.
--
--  ⚠️ LE PATRON N'EST PAS INVENTÉ : `traiter_demande` (demandes de documents)
--  stocke déjà sa `reponse` **et** notifie la famille en y joignant le texte.
--  On s'aligne dessus plutôt que d'inventer une troisième façon de refuser
--  quelque chose dans la même application.
--
--  ⚠️ LE MOTIF EST OBLIGATOIRE. Un rejet sans explication est exactement la
--  situation d'aujourd'hui : le parent voit « rejeté » et recommence à
--  l'identique, ou renonce et appelle l'école. La caisse doit dire pourquoi.
--
--  ⚠️ LES DEUX FAMILLES DE DESTINATAIRES SONT NOTIFIÉES : les tuteurs d'un
--  élève (`_notifier_parents`) ET le compte d'un étudiant majeur
--  (`_notifier_etudiant`), car les deux peuvent déclarer un paiement. Ne
--  traiter que le premier aurait laissé les étudiants dans le silence —
--  précisément ceux dont la migration 198 vient d'ouvrir le dépôt de preuve.
-- =====================================================================

alter table public.declarations_paiement
  add column if not exists motif text;

comment on column public.declarations_paiement.motif is
  'Pourquoi la caisse a rejeté cette déclaration. Obligatoire au rejet depuis la migration 201 ; NULL sur les lignes antérieures.';

-- --- 1. Rejeter EN DISANT POURQUOI ------------------------------------
--
--  ⚠️ `drop` PUIS `create` : ajouter un paramètre crée une SURCHARGE, elle ne
--  remplace pas. L'ancienne signature à un argument resterait appelable —
--  c'est-à-dire que le rejet muet resterait possible, et le correctif ne
--  servirait à rien. Même leçon qu'à la migration 198.
drop function if exists public.rejeter_declaration(uuid);
create function public.rejeter_declaration(p_decl uuid, p_motif text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare d record; v_numero text;
begin
  select * into d from declarations_paiement where id = p_decl;
  if d is null then raise exception 'Déclaration introuvable.'; end if;
  if not est_super_admin() and d.ecole_id <> ecole_courante() then
    raise exception 'Accès refusé.';
  end if;
  if not (a_acces('encaissement')) then raise exception 'Réservé à la comptabilité.'; end if;
  if d.statut <> 'en_attente' then raise exception 'Déclaration déjà traitée.'; end if;
  --  Le motif, obligatoire : c'est tout l'objet de cette migration.
  if coalesce(trim(p_motif), '') = '' then
    raise exception 'Indiquez pourquoi vous rejetez cette déclaration : le parent doit pouvoir corriger.';
  end if;

  update declarations_paiement
     set statut = 'rejete', motif = trim(p_motif),
         validee_par = auth.uid(), validee_le = now()
   where id = p_decl;

  select f.numero into v_numero from factures f where f.id = d.facture_id;

  --  ⚠️ LE MOTIF EST DANS LE MESSAGE, pas seulement dans la base : une
  --  notification qui dirait « votre déclaration a été rejetée » obligerait
  --  le parent à rouvrir l'application pour comprendre. Il doit pouvoir
  --  corriger depuis ce qu'il lit.
  perform _notifier_parents(
    d.eleve_id, d.ecole_id,
    'Déclaration de paiement rejetée',
    format('Votre déclaration de %s%s n''a pas pu être validée : %s',
           trunc(d.montant),
           coalesce(' sur la facture ' || v_numero, ''),
           trim(p_motif)),
    'facture');
  --  Et l'étudiant majeur, qui déclare pour lui-même. `_notifier_etudiant`
  --  ne fait rien si le compte n'est pas activé : appel sans risque.
  perform _notifier_etudiant(
    d.eleve_id,
    'Déclaration de paiement rejetée',
    format('Votre déclaration de %s n''a pas pu être validée : %s',
           trunc(d.montant), trim(p_motif)));
end $fn$;

revoke execute on function public.rejeter_declaration(uuid, text) from public, anon;
grant execute on function public.rejeter_declaration(uuid, text) to authenticated;

-- --- 2. Le parent LIT le motif dans son espace ------------------------
--
--  ⚠️ `drop` nécessaire : ajouter des colonnes à un `returns table` est un
--  changement de type de retour, que `create or replace` refuse. La date est
--  ajoutée au passage — « rejeté » sans date ne dit pas de quelle tentative
--  il s'agit quand il y en a eu plusieurs.
drop function if exists public.enfant_declarations(uuid);
create function public.enfant_declarations(p_eleve uuid)
returns table(id uuid, numero text, montant numeric, statut text,
              motif text, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select dp.id, f.numero, dp.montant, dp.statut::text, dp.motif, dp.created_at
      from declarations_paiement dp
      left join factures f on f.id = dp.facture_id
     where dp.eleve_id = p_eleve
     order by dp.created_at desc;
end $fn$;

revoke execute on function public.enfant_declarations(uuid) from public, anon;
grant execute on function public.enfant_declarations(uuid) to authenticated;

-- --- 3. L'étudiant aussi ----------------------------------------------
drop function if exists public.mes_declarations_paiement();
create function public.mes_declarations_paiement()
returns table(id uuid, facture_id uuid, montant numeric, mode text,
              reference_tx text, statut text, motif text, created_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select d.id, d.facture_id, d.montant, d.mode::text, d.reference_tx,
         d.statut::text, d.motif, d.created_at
    from declarations_paiement d
   where d.eleve_id = _eleve_courant()
   order by d.created_at desc;
$fn$;

revoke execute on function public.mes_declarations_paiement() from public, anon;
grant execute on function public.mes_declarations_paiement() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop function if exists public.rejeter_declaration(uuid, text);
-- drop function if exists public.enfant_declarations(uuid);
-- drop function if exists public.mes_declarations_paiement();
-- -- puis restaurer les trois fonctions sans `motif` (mig. 072 et 113), et :
-- alter table public.declarations_paiement drop column if exists motif;
-- -- ⚠️ Annuler rend le rejet MUET : le parent voit « rejeté » sans savoir
-- -- pourquoi, et recommence à l'identique.
-- notify pgrst, 'reload schema';
