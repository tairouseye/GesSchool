-- =====================================================================
--  104 — Pilotage : un super_admin peut entrer dans N'IMPORTE QUELLE école
--  (support/maintenance depuis la console), sans être « propriétaire ».
--  Les propriétaires gardent l'accès à leurs écoles comme avant.
-- =====================================================================

create or replace function public.entrer_ecole(p_ecole uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not est_super_admin()
     and not exists (select 1 from proprietaires where profil_id = auth.uid() and ecole_id = p_ecole) then
    raise exception 'Accès refusé à cette école.';
  end if;
  if not exists (select 1 from ecoles where id = p_ecole) then
    raise exception 'École introuvable.';
  end if;
  update profils set ecole_id = p_ecole where id = auth.uid();
end $$;
grant execute on function public.entrer_ecole(uuid) to authenticated;

-- =====================================================================
--  ANNULATION — revenir à la version de 010 (propriétaires uniquement)
-- =====================================================================
