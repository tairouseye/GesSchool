-- =====================================================================
--  057 — Verrouillage des écritures sur `parametres`
--
--  Constat d'audit : la table `parametres` n'avait que la politique « tenant »
--  générique (001) — donc TOUT membre de l'école, y compris un enseignant ou
--  un surveillant, pouvait modifier les signataires, le barème de notation,
--  le format des matricules ou les règles de relance. Seule l'interface
--  filtrait ; l'API REST, elle, acceptait tout.
--
--  On garde la LECTURE ouverte à tous les membres (l'app lit les signataires
--  pour les bulletins, la notation pour les moyennes, etc.), mais on réserve
--  l'ÉCRITURE à la gestion et aux responsables concernés — miroir de
--  SECTIONS_PARAMETRES dans src/lib/permissions.js.
-- =====================================================================

-- La politique générique couvrait select ET write : on la remplace par une
-- lecture explicite + des politiques d'écriture ciblées.
drop policy if exists parametres_tenant on public.parametres;

create policy parametres_lecture on public.parametres
  for select
  using (est_super_admin() or ecole_id = ecole_courante());

-- Qui peut écrire quelle clé.
create or replace function public._peut_ecrire_parametre(p_cle text)
returns boolean language sql stable security definer set search_path = public as $$
  select est_super_admin()
      or est_gestion()
      or case p_cle
           when 'signataires'  then a_role('direction')
           when 'notation'     then a_role('direction')
           when 'champs_eleve' then a_role('comptable') or a_role('secretaire')
           else false
         end;
$$;

create policy parametres_ecriture_ins on public.parametres
  for insert
  with check (ecole_id = ecole_courante() and public._peut_ecrire_parametre(cle));

create policy parametres_ecriture_upd on public.parametres
  for update
  using (ecole_id = ecole_courante() and public._peut_ecrire_parametre(cle))
  with check (ecole_id = ecole_courante() and public._peut_ecrire_parametre(cle));

create policy parametres_ecriture_del on public.parametres
  for delete
  using (ecole_id = ecole_courante() and public._peut_ecrire_parametre(cle));

-- NB : les règles de relance vivent dans la table `regles_relance` (019), déjà
-- restreinte au comptable — rien à faire ici pour elles.

notify pgrst, 'reload schema';
