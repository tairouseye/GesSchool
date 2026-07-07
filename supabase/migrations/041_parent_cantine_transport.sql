-- =====================================================================
--  041 — Espace parent : consultation Cantine & Transport de son enfant
--  Les tables cantine_*/transport_* sont réservées à la Gestion (RLS). Le
--  parent y accède via des RPC SECURITY DEFINER qui vérifient le lien
--  parent → enfant (_parent_possede).
-- =====================================================================

create or replace function public.enfant_cantine(p_eleve uuid)
returns table(formule text, tarif numeric, solde numeric, regime text, actif boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query select a.formule, a.tarif, a.solde, a.regime, a.actif
    from cantine_abonnements a where a.eleve_id = p_eleve;
end $$;

create or replace function public.enfant_cantine_menu(p_eleve uuid)
returns table(jour int, plats text)
language plpgsql security definer set search_path = public as $$
declare v_ecole uuid;
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  select ecole_id into v_ecole from eleves where id = p_eleve;
  return query
    select m.jour, m.plats from cantine_menus m
    where m.ecole_id = v_ecole
      and m.semaine = (current_date - ((extract(isodow from current_date))::int - 1))
    order by m.jour;
end $$;

create or replace function public.enfant_transport(p_eleve uuid)
returns table(trajet text, tarif numeric, actif boolean, circuit text, arret text,
              heure_depart text, chauffeur text, chauffeur_tel text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._parent_possede(p_eleve) then raise exception 'Accès refusé.'; end if;
  return query
    select ab.trajet, ab.tarif, ab.actif, c.nom, ar.libelle, c.heure_depart, c.chauffeur, c.chauffeur_tel
    from transport_abonnements ab
    left join transport_circuits c on c.id = ab.circuit_id
    left join transport_arrets ar on ar.id = ab.arret_id
    where ab.eleve_id = p_eleve;
end $$;

revoke execute on function public.enfant_cantine(uuid) from public, anon;
revoke execute on function public.enfant_cantine_menu(uuid) from public, anon;
revoke execute on function public.enfant_transport(uuid) from public, anon;
grant execute on function public.enfant_cantine(uuid) to authenticated;
grant execute on function public.enfant_cantine_menu(uuid) to authenticated;
grant execute on function public.enfant_transport(uuid) to authenticated;
