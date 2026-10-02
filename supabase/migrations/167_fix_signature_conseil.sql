-- =====================================================================
--  167 — Correctif : personne ne pouvait signer le procès-verbal
--
--  🔴 DÉFAUT DE LA MIGRATION 166, TROUVÉ EN L'ÉPROUVANT AVEC DE VRAIES
--  SESSIONS. `signer_conseil` était déclarée SECURITY INVOKER, et j'avais
--  délibérément omis toute policy d'INSERT sur `conseil_signatures` — pour
--  que la RPC reste le seul chemin d'écriture, puisqu'un `with check` ne
--  sait pas vérifier que le signataire pédagogique est responsable DU CYCLE
--  de la classe concernée.
--
--  Les deux décisions étaient justes séparément, et incompatibles ensemble :
--  en SECURITY INVOKER, l'INSERT de la fonction passe lui aussi par la RLS.
--  Sans policy d'insertion, il est refusé — y compris au signataire
--  légitime. Mesuré : « new row violates row-level security policy for
--  table conseil_signatures » (42501) pour le responsable du bon cycle.
--  Les contrôles de la fonction ne servaient à rien : l'insertion
--  n'arrivait jamais.
--
--  ⚠️ POURQUOI PAS SIMPLEMENT AJOUTER UNE POLICY D'INSERT. Parce qu'elle
--  rouvrirait le trou qu'on cherchait à fermer : un `with check
--  (profil_id = auth.uid())` laisserait n'importe quel membre insérer sa
--  signature DIRECTEMENT par l'API, en sautant le contrôle de cycle. La
--  table doit rester fermée à l'écriture directe.
--
--  ⚠️ LA FONCTION DEVIENT DONC SECURITY DEFINER — et c'est cohérent avec la
--  leçon de `_doc_peut_lire` (mig. 150), qui disait INVOKER « quand le
--  métier de la fonction est d'APPLIQUER la RLS ». Ici, son métier est
--  d'appliquer une règle que la RLS NE SAIT PAS exprimer. Mais passer en
--  DEFINER retire le filet du cloisonnement multi-tenant : il faut donc le
--  reposer À LA MAIN, explicitement. C'est tout l'objet du contrôle
--  `v_ecole = ecole_courante()` ci-dessous — sans lui, un membre de l'école
--  B signerait le procès-verbal de l'école A.
--
--  Prérequis : migration 166.
-- =====================================================================

create or replace function public.signer_conseil(p_conseil uuid, p_qualite text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_classe uuid; v_ecole uuid; v_cycle uuid; v_deja text;
begin
  --  Fail-closed d'abord : pas de session, pas de signature.
  if auth.uid() is null then
    raise exception 'Accès refusé.';
  end if;
  if p_qualite not in ('pedagogique', 'gestion') then
    raise exception 'Qualité de signature inconnue.';
  end if;

  --  ⚠️ EN SECURITY DEFINER, CE SELECT NE PASSE PLUS PAR LA RLS : il voit
  --  les procès-verbaux de TOUTES les écoles. Le cloisonnement doit donc
  --  être écrit ici, explicitement.
  select cc.classe_id, cc.ecole_id into v_classe, v_ecole
    from conseils_classe cc where cc.id = p_conseil;
  if not found then
    raise exception 'Procès-verbal introuvable.';
  end if;
  --  `ecole_courante()` vaut NULL pour un parent ou un élève : la
  --  comparaison est alors fausse, et la signature refusée. C'est voulu.
  if v_ecole is distinct from ecole_courante() then
    raise exception 'Procès-verbal introuvable.';
  end if;

  --  Une même personne ne pose pas les deux signatures. La contrainte
  --  `unique (conseil_id, profil_id)` l'interdit déjà, mais elle lèverait
  --  une erreur Postgres brute (23505) que l'écran afficherait telle
  --  quelle. On le dit en français avant d'y arriver.
  select s.qualite into v_deja from conseil_signatures s
   where s.conseil_id = p_conseil and s.profil_id = auth.uid();
  if found then
    raise exception 'Vous avez déjà signé ce procès-verbal (au titre « % »).', v_deja;
  end if;

  if p_qualite = 'pedagogique' then
    v_cycle := public.cycle_de_classe(v_classe);
    if not public.est_responsable_cycle(v_cycle) then
      raise exception 'Seul le responsable pédagogique de ce cycle peut apposer cette signature.';
    end if;
  else
    --  ⚠️ PAS `est_gestion()` ICI. Ce helper (mig. 011) vaut vrai pour
    --  `direction` : un responsable pédagogique aurait alors pu fournir les
    --  DEUX signatures, et le « PV à deux signatures » n'en aurait exigé
    --  qu'une. On nomme explicitement les rôles de l'espace Gestion.
    if not (est_admin() or a_role('comptable') or a_role('secretaire')) then
      raise exception 'Seule la gestion de l''établissement peut apposer cette signature.';
    end if;
  end if;

  insert into conseil_signatures (ecole_id, conseil_id, profil_id, qualite)
  values (v_ecole, p_conseil, auth.uid(), p_qualite)
  on conflict (conseil_id, qualite) do nothing;

  --  Rien inséré : la qualité est déjà signée par quelqu'un d'autre.
  if not exists (select 1 from conseil_signatures s
                  where s.conseil_id = p_conseil and s.profil_id = auth.uid() and s.qualite = p_qualite) then
    raise exception 'Cette signature a déjà été apposée par une autre personne.';
  end if;
end $fn$;
revoke execute on function public.signer_conseil(uuid, text) from public, anon;
grant execute on function public.signer_conseil(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  CONTRÔLE
--   • le responsable DU CYCLE de la classe signe « pedagogique » → accepté
--     (c'est précisément ce qui échouait) ;
--   • le responsable d'un AUTRE cycle → refusé ;
--   • un compte `direction` qui n'est responsable d'aucun cycle → refusé ;
--   • « gestion » : refusée à `direction` (qui satisfait pourtant
--     `est_gestion()`), acceptée au promoteur / comptable / secrétaire ;
--   • la même personne, en seconde qualité → refus EXPLICITE en français,
--     et non une violation de contrainte brute ;
--   • 🔴 un membre d'une AUTRE école, sur un PV qui n'est pas le sien →
--     « Procès-verbal introuvable » (le DEFINER ne doit pas ouvrir le
--     cloisonnement) ;
--   • un parent, un élève, un anonyme → refusés ;
--   • `conseil_signatures` reste FERMÉE à l'insertion directe : un POST sur
--     la table échoue toujours, la RPC demeure le seul chemin.
-- =====================================================================

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- (rejouer le §4 de la migration 166 pour revenir à la version
--  SECURITY INVOKER — qui ne permettait à personne de signer.)
