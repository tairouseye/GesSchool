-- =====================================================================
--  228 — Les enseignants se connectent aussi par leur NUMÉRO (prise en
--  main, lot 3)
--
--  LE CONSTAT (03/11/2026) : à Tut'Tank, aucun des 10 enseignants n'a de
--  compte. Leur seule porte était un compte par E-MAIL, puis « Je suis un
--  enseignant » et le code — alors qu'aucun n'a d'e-mail enregistré. Les
--  parents, eux, se connectent par leur numéro depuis la mig. 221.
--
--  Même mécanisme, même fonction Edge (`parent-telephone`, inchangée) : le
--  numéro IDENTIFIE, le CODE remis par l'école AUTHENTIFIE, puis la personne
--  choisit son mot de passe. Les deux fonctions d'activation reconnaissent
--  désormais un code ENSEIGNANT en plus d'un code parent.
--
--  🔴 UN NUMÉRO = UN COMPTE. Si un parent et un enseignant DIFFÉRENTS portent
--  le même numéro, ils partageraient le même compte — l'un pourrait changer
--  le mot de passe de l'autre. La règle « personnes différentes sur un même
--  numéro → à vérifier » compte donc désormais les fiches parents ET
--  enseignants. Une même personne, parent et enseignante, garde un seul
--  compte qui porte ses deux rôles.
-- =====================================================================

--  Les personnes distinctes portées par un numéro, toutes fiches confondues.
create or replace function public._personnes_du_numero(p_tel text) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct n)::int from (
    select public._nom_parent(prenom, nom) as n from tuteurs where public.tel_normalise(telephone) = p_tel
    union all
    select public._nom_parent(prenom, nom) from enseignants where public.tel_normalise(telephone) = p_tel
  ) x
$$;
revoke all on function public._personnes_du_numero(text) from public, anon, authenticated;
grant execute on function public._personnes_du_numero(text) to service_role;

-- --- Vérifier une activation (sans rien écrire) ----------------------------
--  Rend { statut, type, prenom, nom } — `type` : 'parent' ou 'enseignant'.
create or replace function public._verifier_activation_telephone(p_tel text, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tel text := public.tel_normalise(p_tel); v_code text := upper(trim(coalesce(p_code, '')));
        v_t record; v_e record; v_type text; v_prenom text; v_nom text; v_email boolean;
begin
  if v_tel is null or v_tel !~ '^\d{9}$' then return jsonb_build_object('statut', 'code_invalide'); end if;
  select * into v_t from tuteurs where code_acces = v_code limit 1;
  if v_t.id is not null and public.tel_normalise(v_t.telephone) = v_tel then
    v_type := 'parent'; v_prenom := v_t.prenom; v_nom := v_t.nom;
  else
    select * into v_e from enseignants where code_acces = v_code limit 1;
    if v_e.id is not null and public.tel_normalise(v_e.telephone) = v_tel then
      v_type := 'enseignant'; v_prenom := v_e.prenom; v_nom := v_e.nom;
    end if;
  end if;
  --  Même message que le code soit inconnu ou attaché à un autre numéro :
  --  on ne révèle pas lequel des deux est faux.
  if v_type is null then return jsonb_build_object('statut', 'code_invalide'); end if;

  if public._personnes_du_numero(v_tel) > 1 then return jsonb_build_object('statut', 'a_verifier'); end if;

  --  Déjà relié à un compte e-mail : on ne lui en crée pas un second.
  select exists (
    select 1 from (
      select profil_id from tuteurs where public.tel_normalise(telephone) = v_tel
      union all
      select profil_id from enseignants where public.tel_normalise(telephone) = v_tel
    ) f join auth.users u on u.id = f.profil_id
     where u.email not like '%@tel.gesprosn.org'
  ) into v_email;
  if v_email then return jsonb_build_object('statut', 'compte_email'); end if;

  return jsonb_build_object('statut', 'ok', 'type', v_type, 'prenom', v_prenom, 'nom', v_nom);
end $$;

-- --- Relier le compte à la fiche prouvée par le code -----------------------
--  Parent : toutes les fiches `tuteurs` de ce numéro (comme la mig. 221).
--  Enseignant : SA fiche, comme `lier_enseignant` (profil rattaché à l'école,
--  rôle enseignant). Puis le code utilisé est EFFACÉ.
create or replace function public._lier_parent_telephone(p_uid uuid, p_tel text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tel text := public.tel_normalise(p_tel); v_code text := upper(trim(coalesce(p_code, '')));
        v_v jsonb; v_t record; v_e record; v_email text; v_n int;
begin
  v_v := public._verifier_activation_telephone(p_tel, p_code);
  if v_v->>'statut' <> 'ok' then return v_v; end if;
  select email into v_email from auth.users where id = p_uid;
  if v_email is distinct from ('221' || v_tel || '@tel.gesprosn.org') then
    raise exception 'Compte inattendu pour ce numéro.';
  end if;

  if v_v->>'type' = 'enseignant' then
    select * into v_e from enseignants where code_acces = v_code limit 1;
    insert into profils (id, ecole_id, prenom, nom, email)
    values (p_uid, v_e.ecole_id, coalesce(v_e.prenom, 'Enseignant'), coalesce(v_e.nom, ''), v_email)
    on conflict (id) do update set ecole_id = excluded.ecole_id, prenom = excluded.prenom, nom = excluded.nom;
    update enseignants set profil_id = p_uid, code_acces = null where id = v_e.id;
    insert into profil_roles (profil_id, ecole_id, role)
    values (p_uid, v_e.ecole_id, 'enseignant')
    on conflict (profil_id, ecole_id, role) do nothing;
    return jsonb_build_object('statut', 'ok', 'type', 'enseignant', 'fiches', 1);
  end if;

  select * into v_t from tuteurs where code_acces = v_code limit 1;
  --  Profil parent SANS ecole_id, comme `lier_parent` (mig. 004) — sauf s'il
  --  existe déjà (un enseignant parent garde son école).
  insert into profils (id, ecole_id, prenom, nom, email)
  values (p_uid, null, coalesce(v_t.prenom, 'Parent'), coalesce(v_t.nom, ''), v_email)
  on conflict (id) do update set prenom = excluded.prenom, nom = excluded.nom;

  update tuteurs set profil_id = p_uid where public.tel_normalise(telephone) = v_tel;
  get diagnostics v_n = row_count;

  insert into profil_roles (profil_id, ecole_id, role)
  select distinct p_uid, ecole_id, 'parent'::role_systeme from tuteurs where public.tel_normalise(telephone) = v_tel
  on conflict (profil_id, ecole_id, role) do nothing;

  update tuteurs set code_acces = null where id = v_t.id;
  return jsonb_build_object('statut', 'ok', 'type', 'parent', 'fiches', v_n);
end $$;

revoke all on function public._verifier_activation_telephone(text, text) from public, anon, authenticated;
revoke all on function public._lier_parent_telephone(uuid, text, text) from public, anon, authenticated;
grant execute on function public._verifier_activation_telephone(text, text) to service_role;
grant execute on function public._lier_parent_telephone(uuid, text, text) to service_role;

-- --- Côté école : les numéros à vérifier, enseignants compris -------------
create or replace function public.numeros_a_verifier()
returns table(telephone text, noms text, enfants text, fiches bigint)
language sql stable security definer set search_path = public as $$
  with t as (
    select tu.id, public.tel_normalise(tu.telephone) as tel, tu.prenom, tu.nom
      from tuteurs tu
     where tu.ecole_id = public.ecole_courante()
       and public.tel_normalise(tu.telephone) is not null
    union all
    select en.id, public.tel_normalise(en.telephone), en.prenom, en.nom || ' (enseignant)'
      from enseignants en
     where en.ecole_id = public.ecole_courante()
       and public.tel_normalise(en.telephone) is not null
  )
  select regexp_replace(t.tel, '^(\d{2})(\d{3})(\d{2})(\d{2})$', '\1 \2 \3 \4'),
         string_agg(distinct trim(t.prenom || ' ' || t.nom), ' / '),
         (select string_agg(distinct e.prenom || ' ' || e.nom, ', ')
            from eleve_tuteurs et join eleves e on e.id = et.eleve_id
           where et.tuteur_id = any (array_agg(t.id))),
         count(*)
    from t
   where public.a_acces('codes_parents')
   group by t.tel
  having count(distinct public._nom_parent(t.prenom, replace(t.nom, ' (enseignant)', ''))) > 1
   order by 1
$$;
revoke all on function public.numeros_a_verifier() from public, anon;
grant execute on function public.numeros_a_verifier() to authenticated;

-- --- Retour arrière ---------------------------------------------------------------
-- Réappliquer _verifier_activation_telephone, _lier_parent_telephone et
-- numeros_a_verifier de la mig. 221, puis
-- drop function public._personnes_du_numero(text);
