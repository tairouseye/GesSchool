-- =====================================================================
--  156 — Marquer une école de DÉMONSTRATION, et l'écarter des totaux
--
--  Suite des migrations 154-155. La vue consolidée du promoteur mélangeait
--  ses écoles réelles et son école de démonstration : sur 9 357 500 de
--  trésorerie cumulée, 9 732 500 venaient de TutTank_Demo. Un total dont le
--  gros est fictif n'est pas un total approximatif — il est inexploitable.
--
--  On pose donc un marqueur explicite sur la fiche école. C'est une
--  propriété de l'établissement, pas une convention de nommage : se fier au
--  suffixe « _Demo » du nom marcherait jusqu'au jour où quelqu'un renomme
--  l'école, et se casserait en silence.
--
--  ⚠️ LA CARTE DE L'ÉCOLE RESTE. Le promoteur doit pouvoir continuer à
--  gérer sa démo depuis Pilotage — c'est son outil de démarchage. Seuls les
--  TOTAUX l'écartent. La RPC rend donc le drapeau et laisse l'écran décider.
--
--  ⚠️ ET CERTAINS COMPTES N'ONT QUE DES DÉMOS. Vérifié : la démarcheuse
--  (Binette Gueye Fall) ne possède que TutTank_Demo, et le compte de
--  présentation RDC que « Complexe Scolaire La Grâce ». Écarter les démos
--  sans filet viderait complètement leur Pilotage et donnerait une page
--  cassée. Le repli est appliqué côté écran : s'il ne reste aucune école
--  réelle, on consolide tout et on le dit.
--
--  Prérequis : migrations 010, 017/034, 154, 155.
-- =====================================================================

-- --- 1. Le marqueur -------------------------------------------------------
--  ⚠️ `add column if not exists` est un NO-OP si la colonne existe déjà : il
--  n'appliquerait alors NI le défaut NI le NOT NULL (c'est exactement ce qui
--  avait fait perdre 11 entrées de menu à 6 écoles en mig. 108/141). On pose
--  donc les contraintes séparément, pour que la migration soit rejouable.
alter table ecoles add column if not exists demonstration boolean;
update ecoles set demonstration = false where demonstration is null;
alter table ecoles alter column demonstration set default false;
alter table ecoles alter column demonstration set not null;

comment on column ecoles.demonstration is
  'École de démonstration : gérable normalement, mais écartée des totaux consolidés du Pilotage (mig. 156).';

-- --- 2. Les écoles de démonstration connues -------------------------------
--  Par nom et non par identifiant : lisible en relecture, et sans effet sur
--  une base neuve où ces écoles n'existent pas (0 ligne touchée).
update ecoles set demonstration = true
 where nom in ('TutTank_Demo', 'Complexe Scolaire La Grâce');

-- --- 3. Pilotage rend le drapeau ------------------------------------------
--  Ajout d'une colonne au retour ⇒ 42P13 sur un `create or replace` seul.
drop function if exists public.pilotage_synthese();
create or replace function public.pilotage_synthese()
returns table(
  ecole_id uuid, ecole text, sigle text, devise text, demonstration boolean,
  effectif bigint,
  total_facture numeric, total_paye numeric,
  tresorerie numeric,
  masse_salariale numeric, masse_brouillon numeric, bulletins_brouillon bigint,
  recettes_annee numeric, depenses_annee numeric, scolarite_annee numeric
)
language sql stable security definer set search_path = public as $$
  select
    e.id, e.nom, e.sigle, coalesce(e.devise, 'XOF'), e.demonstration,
    (select count(*) from eleves el where el.ecole_id = e.id),
    -- Une facture annulée n'est ni due ni encaissée (règle de la mig. 143).
    coalesce((select sum(f.montant_total) from factures f
              where f.ecole_id = e.id and f.statut <> 'annulee'), 0),
    coalesce((select sum(f.montant_paye)  from factures f
              where f.ecole_id = e.id and f.statut <> 'annulee'), 0),
    -- Trésorerie : tout ce qui est entré, scolarité comprise (mig. 154).
      coalesce((select sum(c.solde_initial) from comptes c where c.ecole_id = e.id), 0)
    + coalesce((select sum(r.montant) from recettes  r where r.ecole_id = e.id), 0)
    + coalesce((select sum(p.montant) from paiements p where p.ecole_id = e.id), 0)
    - coalesce((select sum(d.montant) from depenses  d where d.ecole_id = e.id), 0),
    -- Masse salariale ENGAGÉE du mois : pas les brouillons (mig. 155).
    coalesce((select sum(s.montant_net) from salaires s
              where s.ecole_id = e.id
                and s.periode = to_char(current_date, 'YYYY-MM')
                and s.statut in ('valide', 'paye', 'archive')), 0),
    coalesce((select sum(s.montant_net) from salaires s
              where s.ecole_id = e.id
                and s.periode = to_char(current_date, 'YYYY-MM')
                and s.statut = 'brouillon'), 0),
    (select count(*) from salaires s
      where s.ecole_id = e.id
        and s.periode = to_char(current_date, 'YYYY-MM')
        and s.statut = 'brouillon'),
    coalesce((select sum(r.montant) from recettes r
              where r.ecole_id = e.id and r.date_recette >= date_trunc('year', current_date)), 0),
    coalesce((select sum(d.montant) from depenses d
              where d.ecole_id = e.id and d.date_depense >= date_trunc('year', current_date)), 0),
    coalesce((select sum(p.montant) from paiements p
              where p.ecole_id = e.id and p.date_paiement >= date_trunc('year', current_date)), 0)
  from ecoles e
  where e.id in (select ecole_id from proprietaires where profil_id = auth.uid())
  -- Les démos en dernier : la liste s'ouvre sur les vraies écoles.
  order by e.demonstration, e.nom;
$$;
revoke execute on function public.pilotage_synthese() from public, anon;
grant execute on function public.pilotage_synthese() to authenticated;

-- --- 4. Console super-admin : voir et basculer le marqueur ----------------
drop function if exists public.admin_ecoles();
create or replace function public.admin_ecoles()
returns table(
  ecole_id        uuid,
  nom             text,
  sigle           text,
  demonstration   boolean,
  effectif        bigint,
  nb_personnel    bigint,
  nb_enseignants  bigint,
  nb_parents      bigint,
  derniere_activite timestamptz,
  plan_code       text,
  plan_libelle    text,
  statut          statut_abonnement,
  fin             date,
  modules         text[]
)
language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  return query
    select
      e.id, e.nom, e.sigle, e.demonstration,
      (select count(*) from eleves el where el.ecole_id = e.id),
      (select count(distinct pr.profil_id) from profil_roles pr
         where pr.ecole_id = e.id and pr.role <> 'parent'),
      (select count(distinct pr.profil_id) from profil_roles pr
         where pr.ecole_id = e.id and pr.role = 'enseignant'),
      (select count(distinct pr.profil_id) from profil_roles pr
         where pr.ecole_id = e.id and pr.role = 'parent'),
      (select max(u.last_sign_in_at) from profil_roles pr
         join auth.users u on u.id = pr.profil_id
         where pr.ecole_id = e.id),
      pa.code, pa.libelle, ab.statut, ab.fin, e.modules_actifs
    from ecoles e
    left join abonnements ab on ab.ecole_id = e.id
      and ab.debut <= current_date
      and (ab.fin is null or ab.fin >= current_date)
    left join plans_abonnement pa on pa.id = ab.plan_id
    order by e.nom;
end $$;
revoke execute on function public.admin_ecoles() from public, anon;
grant execute on function public.admin_ecoles() to authenticated;

--  Bascule réservée au super-administrateur : classer une école en
--  démonstration change la lecture des chiffres de son promoteur.
create or replace function public.admin_marquer_demonstration(p_ecole uuid, p_demo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin() then
    raise exception 'Réservé au super-administrateur.';
  end if;
  update ecoles set demonstration = coalesce(p_demo, false) where id = p_ecole;
  if not found then
    raise exception 'École introuvable.';
  end if;
end $$;
revoke execute on function public.admin_marquer_demonstration(uuid, boolean) from public, anon;
grant execute on function public.admin_marquer_demonstration(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • MEDOUNE SEYE (4 écoles) : les tuiles ne cumulent plus que 3 écoles
--     réelles — trésorerie −375 000 au lieu de 9 357 500 ; la carte
--     TutTank_Demo reste présente, marquée « Démonstration », et son bouton
--     « Gérer cette école » fonctionne toujours ;
--   • Binette Gueye Fall (TutTank_Demo seule) : la page n'est PAS vide —
--     repli sur la démo, annoncé comme tel ;
--   • un non-super-admin appelant `admin_marquer_demonstration` est refusé.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.admin_marquer_demonstration(uuid, boolean);
-- drop function if exists public.pilotage_synthese();
-- drop function if exists public.admin_ecoles();
-- alter table ecoles drop column if exists demonstration;
-- (puis réappliquer pilotage_synthese de la mig. 155 et admin_ecoles de la 034.)
