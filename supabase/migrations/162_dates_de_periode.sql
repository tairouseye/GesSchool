-- =====================================================================
--  162 — Les dates d'une période : les saisir, et restreindre qui le peut
--
--  Découvert en préparant « afficher les absences sur le bulletin » : compter
--  les absences D'UN TRIMESTRE suppose de savoir quand il commence et quand
--  il finit. Or **17 des 20 périodes en base n'ont aucune date**, et
--  `periodes` n'est JAMAIS écrite par l'application : aucun écran ne permet
--  de les saisir. Elles naissent nulles à l'ouverture de l'année scolaire.
--
--  Livrer le comptage sans cela aurait donné un bulletin muet pour 17
--  périodes sur 20, sans recours pour l'école — et afficher « 0 absence »
--  aurait été pire : un mensonge là où l'information n'existe pas.
--
--  ⚠️ ET EN VÉRIFIANT LES DROITS, UN SECOND DÉFAUT. `periodes` ne porte que
--  la policy générique de la migration 001 (`ecole_id = ecole_courante()`) :
--  la 018 lui a oublié ses policies par rôle. Mesuré avec de vraies sessions,
--  le **responsable RH peut modifier le calendrier scolaire** — tout comme le
--  comptable, le secrétaire, le surveillant et l'enseignant. Les parents,
--  eux, sont bien exclus (`ecole_courante()` est NULL pour eux) : ce n'est
--  pas une fuite vers les familles, mais c'est contraire au moindre
--  privilège, et on ne pose pas un écran de saisie par-dessus.
--
--  Le découpage de l'année est un acte de structure académique : mêmes rôles
--  que la page « Niveaux & classes » (ACCES.structure = direction).
--  La LECTURE reste ouverte à tout le personnel — notes, bulletins et
--  progressions en dépendent.
--
--  Prérequis : migrations 001, 018, 033.
-- =====================================================================

-- --- 1. L'écriture redevient un acte de structure -------------------------
--  La policy générique `periodes_tenant` couvre `for all` : on la restreint
--  à la LECTURE et on ajoute trois policies d'écriture, sur le patron exact
--  de la migration 033.
drop policy if exists periodes_tenant on periodes;
create policy periodes_tenant on periodes for select
  using (est_super_admin() or ecole_id = ecole_courante());

do $$
declare pred text := '(est_admin() or a_role(''direction''))';
begin
  execute format('drop policy if exists periodes_ins on public.periodes;');
  execute format('drop policy if exists periodes_upd on public.periodes;');
  execute format('drop policy if exists periodes_del on public.periodes;');
  execute format('create policy periodes_ins on public.periodes for insert with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy periodes_upd on public.periodes for update using (est_super_admin() or (ecole_id = ecole_courante() and %1$s)) with check (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
  execute format('create policy periodes_del on public.periodes for delete using (est_super_admin() or (ecole_id = ecole_courante() and %1$s));', pred);
end $$;

-- --- 2. Une période ne peut pas finir avant d'avoir commencé --------------
--  `add constraint` n'a pas de variante `if not exists` : on précède d'un
--  drop pour rester rejouable. Les 17 périodes sans dates passent (NULL
--  satisfait la contrainte), les 3 datées aussi — vérifié avant écriture.
alter table periodes drop constraint if exists periodes_dates_chk;
alter table periodes add constraint periodes_dates_chk
  check (date_debut is null or date_fin is null or date_fin >= date_debut);

comment on column periodes.date_debut is
  'Début de la période. Nécessaire au comptage des absences du bulletin (mig. 162/163).';

-- --- 3. Savoir si une période est exploitable ------------------------------
--  Utilisée par le comptage d'absences : une période sans dates ne permet
--  AUCUN calcul, et il faut pouvoir le dire à l'écran plutôt que d'afficher
--  un zéro trompeur.
create or replace function public.periode_datee(p_periode uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from periodes p
     where p.id = p_periode and p.date_debut is not null and p.date_fin is not null
  );
$$;
revoke execute on function public.periode_datee(uuid) from public, anon;
grant execute on function public.periode_datee(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • un compte « rh », « comptable » ou « secrétaire » ne peut PLUS
--     modifier une période (0 ligne touchée) — il la lit toujours ;
--   • le responsable pédagogique (direction) et le promoteur le peuvent ;
--   • une période dont la fin précède le début est refusée ;
--   • les 20 périodes existantes sont intactes, dates comprises.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists public.periode_datee(uuid);
-- alter table periodes drop constraint if exists periodes_dates_chk;
-- drop policy if exists periodes_del on periodes;
-- drop policy if exists periodes_upd on periodes;
-- drop policy if exists periodes_ins on periodes;
-- drop policy if exists periodes_tenant on periodes;
-- create policy periodes_tenant on periodes
--   using (est_super_admin() or ecole_id = ecole_courante())
--   with check (est_super_admin() or ecole_id = ecole_courante());
