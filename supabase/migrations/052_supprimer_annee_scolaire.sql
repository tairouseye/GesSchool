-- =====================================================================
--  052 — Supprimer une année scolaire (ouverte par erreur / vide)
--
--  Garde-fous : réservé au promoteur ; refuse si des élèves y sont inscrits
--  (protège les vraies données) ; si l'année était « courante », rebascule la
--  courante sur l'année la plus récente restante ; interdit de supprimer la
--  seule année. La suppression cascade sur classes / affectations / frais /
--  emplois du temps (FK on delete cascade).
-- =====================================================================

create or replace function public.supprimer_annee_scolaire(p_annee uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_courante boolean; v_nb int; v_autre uuid;
begin
  if not (est_super_admin() or a_role('admin_ecole')) then
    raise exception 'Réservé au promoteur.';
  end if;

  select courante into v_courante from annees_scolaires where id = p_annee and ecole_id = v_ecole;
  if v_courante is null then raise exception 'Année introuvable.'; end if;

  select count(*) into v_nb from inscriptions where ecole_id = v_ecole and annee_id = p_annee;
  if v_nb > 0 then
    raise exception 'Impossible : % élève(s) inscrit(s) dans cette année. Retirez d''abord les inscriptions.', v_nb;
  end if;

  if v_courante then
    select id into v_autre from annees_scolaires
      where ecole_id = v_ecole and id <> p_annee
      order by date_debut desc limit 1;
    if v_autre is null then
      raise exception 'Impossible de supprimer la seule année scolaire.';
    end if;
  end if;

  delete from annees_scolaires where id = p_annee and ecole_id = v_ecole;

  if v_courante and v_autre is not null then
    update annees_scolaires set courante = true where id = v_autre;
  end if;
end $$;

revoke execute on function public.supprimer_annee_scolaire(uuid) from public, anon;
grant execute on function public.supprimer_annee_scolaire(uuid) to authenticated;
