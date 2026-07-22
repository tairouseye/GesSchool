-- =====================================================================
--  063 — Offres commerciales : FORMULE × PALIER
--
--  Les paliers d'effectif (060) fixaient le prix par taille, mais rien ne
--  reliait les MODULES à une offre. On introduit 3 formules qui empilent
--  les modules (Essentiel ⊂ Confort ⊂ Tout inclus) ; le catalogue devient
--  une matrice formule × palier.
--
--  Rien de nouveau dans le schéma : `plans_abonnement` a déjà `max_eleves`,
--  `prix_annuel` (060) et `fonctions` (jsonb). Et le câblage plan→modules
--  EXISTE DÉJÀ : `admin_set_abonnement` (017) lit `fonctions->'modules'` et
--  l'applique à `ecoles.modules_actifs`. Il suffisait de remplir ce champ.
--
--  Cette migration ne fait qu'ajouter la RPC d'upsert. Les lignes d'offres
--  elles-mêmes sont générées depuis le simulateur (console super-admin),
--  pour que les prix restent pilotés par le modèle de coûts, pas figés ici.
-- =====================================================================

-- Upsert d'un plan COMPLET : prix + palier + MODULES. Étend
-- admin_set_plan_tarif (061) qui ne gérait pas les modules.
drop function if exists public.admin_upsert_plan(text, text, numeric, numeric, int, text[]);
create or replace function public.admin_upsert_plan(
  p_code         text,
  p_libelle      text,
  p_prix_mensuel numeric,
  p_prix_annuel  numeric,
  p_max_eleves   int,
  p_modules      text[]
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;

  insert into plans_abonnement (code, libelle, prix_mensuel, prix_annuel, max_eleves, fonctions, actif)
  values (p_code, p_libelle,
          coalesce(p_prix_mensuel, 0), coalesce(p_prix_annuel, 0), p_max_eleves,
          jsonb_build_object('modules', coalesce(to_jsonb(p_modules), '[]'::jsonb)),
          true)
  on conflict (code) do update set
    libelle      = excluded.libelle,
    prix_mensuel = excluded.prix_mensuel,
    prix_annuel  = excluded.prix_annuel,
    max_eleves   = excluded.max_eleves,
    fonctions    = excluded.fonctions,
    actif        = true;
end $$;

revoke execute on function public.admin_upsert_plan(text, text, numeric, numeric, int, text[])
  from public, anon;
grant execute on function public.admin_upsert_plan(text, text, numeric, numeric, int, text[])
  to authenticated;

-- Les anciens plans mono-palier (060 : socle/standard/premium/campus) n'ont
-- pas de modules et feraient doublon dans le sélecteur une fois la grille
-- d'offres générée. On les masque SANS les supprimer (une école pourrait y
-- être encore rattachée ; masquer n'affecte pas un abonnement en cours).
update public.plans_abonnement
   set actif = false
 where code in ('socle', 'standard', 'premium', 'campus');

notify pgrst, 'reload schema';

-- =====================================================================
--  ANNULATION (retour à l'état d'avant 063)
--
--    drop function if exists public.admin_upsert_plan(text, text, numeric, numeric, int, text[]);
--    -- réactiver les anciens plans mono-palier :
--    update public.plans_abonnement set actif = true
--      where code in ('socle','standard','premium','campus');
--    -- retirer les offres générées (formule_palier), si tu en as créé :
--    delete from public.plans_abonnement
--      where code ~ '^(essentiel|confort|tout)_';
--    notify pgrst, 'reload schema';
--
--  ⚠️ Avant le delete, vérifier qu'aucune école n'y est abonnée :
--    select p.code, count(a.*) from plans_abonnement p
--      left join abonnements a on a.plan_id = p.id
--     where p.code ~ '^(essentiel|confort|tout)_' group by p.code;
--  Réaffecter ces écoles à un plan actif avant de supprimer.
-- =====================================================================
