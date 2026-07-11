-- =====================================================================
--  046 — Correctif : « column reference "id" is ambiguous » (messagerie)
--
--  La liste des conversations (mes_conversations) se charge, mais l'ouverture
--  d'un fil appelle conversation_messages() dont la version en base avait
--  dérivé (colonne « id » non qualifiée, vraisemblablement via une jointure
--  ajoutée). On la recrée avec des colonnes entièrement qualifiées ; les
--  colonnes de sortie restent celles consommées par l'app (id, expediteur,
--  contenu, created_at).
-- =====================================================================

drop function if exists public.conversation_messages(uuid);
create or replace function public.conversation_messages(p_tuteur uuid)
returns table(id uuid, expediteur text, contenu text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from tuteurs t where t.id = p_tuteur and t.profil_id = auth.uid()
  ) then
    raise exception 'Accès refusé.';
  end if;

  update messages m set lu = true
    where m.tuteur_id = p_tuteur and m.expediteur = 'ecole' and m.lu = false;

  return query
    select m.id, m.expediteur, m.contenu, m.created_at
    from messages m
    where m.tuteur_id = p_tuteur
    order by m.created_at;
end $$;

revoke execute on function public.conversation_messages(uuid) from public, anon;
grant execute on function public.conversation_messages(uuid) to authenticated;
