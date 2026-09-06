-- =====================================================================
--  097 — COMPTABILITÉ : créer les exercices manquants
--  094 n'a créé un exercice que pour l'année scolaire « courante ». Or les
--  opérations réelles peuvent porter sur d'autres années (ex. l'année en
--  cours de clôture). Cette RPC crée un exercice (+ périodes mensuelles)
--  pour CHAQUE année scolaire de l'école qui n'en a pas encore, en statut
--  « ouvert » (pour permettre la reprise comptable). La clôture reste une
--  action explicite ultérieure.
-- =====================================================================

create or replace function assurer_exercices()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid := ecole_courante();
  a       record;
  v_ex    uuid;
  d       date;
  n       int := 0;
begin
  if not (est_super_admin() or est_gestion() or a_role('comptable')) then
    raise exception 'Non autorisé.';
  end if;
  if v_ecole is null then raise exception 'École introuvable.'; end if;

  for a in select * from annees_scolaires where ecole_id = v_ecole loop
    if not exists (select 1 from exercices where ecole_id = v_ecole and libelle = a.libelle) then
      insert into exercices(ecole_id, annee_scolaire_id, libelle, date_debut, date_fin, statut)
      values (v_ecole, a.id, a.libelle, a.date_debut, a.date_fin, 'ouvert')
      returning id into v_ex;

      d := date_trunc('month', a.date_debut)::date;
      while d <= a.date_fin loop
        insert into periodes_compta(ecole_id, exercice_id, annee, mois)
        values (v_ecole, v_ex, extract(year from d)::int, extract(month from d)::int)
        on conflict (exercice_id, annee, mois) do nothing;
        d := (d + interval '1 month')::date;
      end loop;

      n := n + 1;
    end if;
  end loop;

  return n;
end $$;
grant execute on function assurer_exercices() to authenticated;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop function if exists assurer_exercices();
