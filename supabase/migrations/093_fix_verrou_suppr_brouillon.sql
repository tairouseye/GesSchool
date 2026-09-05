-- =====================================================================
--  093 — Correctif : suppression d'un bulletin BROUILLON impossible
--  Le verrou sur salaire_lignes bloquait la cascade quand on supprime un
--  bulletin brouillon : le parent étant déjà en cours de suppression, la
--  recherche du statut renvoyait NULL, et `NULL is distinct from 'brouillon'`
--  = vrai → « Bulletin verrouillé ». On n'applique le verrou QUE si le parent
--  existe encore ET n'est pas 'brouillon'. La suppression d'un brouillon (donc
--  la cascade sur ses lignes) est de nouveau autorisée.
-- =====================================================================

create or replace function trg_lock_salaire_lignes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_statut text;
begin
  select statut into v_statut from salaires where id = coalesce(new.salaire_id, old.salaire_id);
  -- v_statut NULL = parent en cours de suppression (cascade) → on laisse passer.
  if v_statut is not null and v_statut <> 'brouillon' and not est_super_admin() then
    raise exception 'Bulletin verrouillé (statut %). Dévalidez-le pour le modifier.', v_statut;
  end if;
  return coalesce(new, old);
end $$;

-- =====================================================================
--  ANNULATION — restaurer la condition « is distinct from 'brouillon' » (086).
-- =====================================================================
