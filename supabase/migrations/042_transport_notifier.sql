-- =====================================================================
--  042 — Transport : notifier les parents des élèves embarqués
--  Appelé par la Gestion depuis l'écran Embarquement. Insère une notification
--  (→ push si configuré) aux parents de chaque élève marqué « embarqué ».
-- =====================================================================

create or replace function public.transport_notifier(p_circuit uuid, p_date date, p_sens text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_ecole uuid := ecole_courante(); v_n int := 0; v_circuit text; r record;
begin
  if not (est_admin() or a_role('comptable') or a_role('secretaire')) then
    raise exception 'Réservé à la Gestion.';
  end if;
  select nom into v_circuit from transport_circuits where id = p_circuit;
  for r in
    select p.eleve_id, e.prenom
    from transport_pointages p
    join eleves e on e.id = p.eleve_id
    where p.ecole_id = v_ecole and p.circuit_id = p_circuit and p.date_p = p_date
      and p.sens = p_sens and p.embarque
  loop
    insert into notifications (ecole_id, destinataire_id, titre, message)
    select v_ecole, t.profil_id, 'Transport scolaire',
      r.prenom || ' a été pris(e) en charge par le bus'
      || coalesce(' (' || v_circuit || ')', '')
      || case when p_sens = 'retour' then ' pour le retour.' else ' ce matin.' end
    from eleve_tuteurs et
    join tuteurs t on t.id = et.tuteur_id
    where et.eleve_id = r.eleve_id and t.profil_id is not null;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function public.transport_notifier(uuid, date, text) from public, anon;
grant execute on function public.transport_notifier(uuid, date, text) to authenticated;
