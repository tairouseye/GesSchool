-- =====================================================================
--  221 — Connexion des parents par NUMÉRO DE TÉLÉPHONE (sans SMS)
--
--  LE BESOIN (promoteur, 01/11/2026) : le parent scanne le QR code de
--  l'école et se connecte avec le numéro que l'école a déjà, au lieu d'un
--  e-mail qu'il n'a pas toujours. Maquette validée :
--  docs/maquette-connexion-telephone.html.
--
--  🔴 LE NUMÉRO N'EST PAS UN SECRET. Il circule dans les groupes WhatsApp
--  de classe. Il IDENTIFIE le parent, il ne l'AUTHENTIFIE pas : la première
--  fois (et après un oubli), le parent prouve qui il est avec le CODE PARENT
--  remis par l'école, puis choisit un mot de passe. Le code est EFFACÉ dès
--  qu'il a servi : un code ancien ne peut pas changer le mot de passe.
--
--  LE COMPTE. Le compte Supabase porte une adresse technique
--  « 221XXXXXXXXX@tel.gesprosn.org » (aucun courriel n'y est jamais envoyé) ;
--  il est créé par la fonction Edge `parent-telephone`, avec la clé de
--  service, une fois le code vérifié ici.
--
--  UN NUMÉRO = UN PARENT = TOUS SES ENFANTS. Les fiches `tuteurs` qui
--  portent ce numéro (une par enfant à l'import, parfois dans deux écoles)
--  sont toutes reliées au compte — à condition qu'elles désignent la MÊME
--  personne. Deux noms différents sur un numéro = deux familles possibles :
--  la connexion est refusée tant que l'école n'a pas corrigé (écran Codes
--  parents → « Numéros à vérifier »).
--
--  Aucune table nouvelle. Les deux fonctions d'activation ne sont
--  exécutables que par la clé de service (fonction Edge).
-- =====================================================================

-- --- 1. Un numéro, une écriture -------------------------------------------
--  « 77 123 45 67 », « +221 77 123 45 67 », « 00221771234567 » → 771234567.
create or replace function public.tel_normalise(p text) returns text
language sql immutable parallel safe as $$
  select case
    when d ~ '^00221\d{9}$' then substr(d, 6)
    when d ~ '^221\d{9}$'   then substr(d, 4)
    else nullif(d, '') end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create index if not exists tuteurs_tel_normalise_idx on public.tuteurs (public.tel_normalise(telephone));

--  Deux fiches désignent-elles la même personne ? Casse, espaces, tirets et
--  accents courants ignorés (« Aïssatou » = « AISSATOU »).
create or replace function public._nom_parent(p_prenom text, p_nom text) returns text
language sql immutable parallel safe as $$
  select regexp_replace(translate(lower(coalesce(p_prenom, '') || coalesce(p_nom, '')),
                                  'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z]', '', 'g')
$$;

-- --- 2. Vérifier une activation (sans rien écrire) -------------------------
--  Rend { statut, prenom, nom } — statut :
--    ok            · le code correspond au numéro, une seule personne
--    code_invalide · code inconnu, ou attaché à un AUTRE numéro (même message :
--                    on ne révèle pas lequel des deux est faux)
--    a_verifier    · le numéro est porté par des personnes différentes
--    compte_email  · ce parent a déjà un compte par e-mail
create or replace function public._verifier_activation_telephone(p_tel text, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tel text := public.tel_normalise(p_tel); v_t record; v_personnes int; v_email boolean;
begin
  if v_tel is null or v_tel !~ '^\d{9}$' then return jsonb_build_object('statut', 'code_invalide'); end if;
  select * into v_t from tuteurs where code_acces = upper(trim(p_code)) limit 1;
  if v_t is null or public.tel_normalise(v_t.telephone) is distinct from v_tel then
    return jsonb_build_object('statut', 'code_invalide');
  end if;
  select count(distinct public._nom_parent(prenom, nom)) into v_personnes
    from tuteurs where public.tel_normalise(telephone) = v_tel;
  if v_personnes > 1 then return jsonb_build_object('statut', 'a_verifier'); end if;
  --  Déjà relié à un compte e-mail : on ne lui en crée pas un second.
  select exists (
    select 1 from tuteurs tu join auth.users u on u.id = tu.profil_id
     where public.tel_normalise(tu.telephone) = v_tel and u.email not like '%@tel.gesprosn.org'
  ) into v_email;
  if v_email then return jsonb_build_object('statut', 'compte_email'); end if;
  return jsonb_build_object('statut', 'ok', 'prenom', v_t.prenom, 'nom', v_t.nom);
end $$;

-- --- 3. Relier le compte à toutes les fiches de ce parent -----------------
--  Rejoue la vérification (rien ne doit avoir changé entre-temps), relie,
--  pose le rôle parent dans chaque école, puis EFFACE le code utilisé.
create or replace function public._lier_parent_telephone(p_uid uuid, p_tel text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tel text := public.tel_normalise(p_tel); v_v jsonb; v_t record; v_email text; v_n int;
begin
  v_v := public._verifier_activation_telephone(p_tel, p_code);
  if v_v->>'statut' <> 'ok' then return v_v; end if;
  select * into v_t from tuteurs where code_acces = upper(trim(p_code)) limit 1;
  select email into v_email from auth.users where id = p_uid;
  if v_email is distinct from ('221' || v_tel || '@tel.gesprosn.org') then
    raise exception 'Compte inattendu pour ce numéro.';
  end if;

  --  Profil parent SANS ecole_id, comme `lier_parent` (mig. 004).
  insert into profils (id, ecole_id, prenom, nom, email)
  values (p_uid, null, coalesce(v_t.prenom, 'Parent'), coalesce(v_t.nom, ''), v_email)
  on conflict (id) do update set prenom = excluded.prenom, nom = excluded.nom;

  update tuteurs set profil_id = p_uid where public.tel_normalise(telephone) = v_tel;
  get diagnostics v_n = row_count;

  insert into profil_roles (profil_id, ecole_id, role)
  select distinct p_uid, ecole_id, 'parent' from tuteurs where public.tel_normalise(telephone) = v_tel
  on conflict (profil_id, ecole_id, role) do nothing;

  update tuteurs set code_acces = null where id = v_t.id;
  return jsonb_build_object('statut', 'ok', 'fiches', v_n);
end $$;

-- --- 4. Retrouver un compte par son adresse technique (fonction Edge) ------
create or replace function public._uid_compte_telephone(p_tel text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where email = '221' || public.tel_normalise(p_tel) || '@tel.gesprosn.org' limit 1
$$;

revoke all on function public._verifier_activation_telephone(text, text) from public, anon, authenticated;
revoke all on function public._lier_parent_telephone(uuid, text, text) from public, anon, authenticated;
revoke all on function public._uid_compte_telephone(text) from public, anon, authenticated;
grant execute on function public._verifier_activation_telephone(text, text) to service_role;
grant execute on function public._lier_parent_telephone(uuid, text, text) to service_role;
grant execute on function public._uid_compte_telephone(text) to service_role;

-- --- 5. Côté école : les numéros à vérifier --------------------------------
--  Les numéros de CETTE école portés par des personnes différentes : tant
--  qu'ils ne sont pas corrigés, ils ne servent pas à se connecter.
create or replace function public.numeros_a_verifier()
returns table(telephone text, noms text, enfants text, fiches bigint)
language sql stable security definer set search_path = public as $$
  with t as (
    select tu.id, public.tel_normalise(tu.telephone) as tel, tu.prenom, tu.nom
      from tuteurs tu
     where tu.ecole_id = public.ecole_courante()
       and public.tel_normalise(tu.telephone) is not null
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
  having count(distinct public._nom_parent(t.prenom, t.nom)) > 1
   order by 1
$$;
revoke all on function public.numeros_a_verifier() from public, anon;
grant execute on function public.numeros_a_verifier() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  VÉRIFICATION — supabase/tests/essai_221.sql
--  ANNULATION
--    drop function if exists public.numeros_a_verifier();
--    drop function if exists public._uid_compte_telephone(text);
--    drop function if exists public._lier_parent_telephone(uuid, text, text);
--    drop function if exists public._verifier_activation_telephone(text, text);
--    drop index if exists public.tuteurs_tel_normalise_idx;
--    (tel_normalise et _nom_parent peuvent rester)
-- =====================================================================
