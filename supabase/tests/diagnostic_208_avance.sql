-- =====================================================================
--  DIAGNOSTIC (lecture seule) — pourquoi `avance_options` a accepté
--  l'élève d'une autre famille dans essai_208_parent.sql.
--
--  `avance_options` (mig. 202) autorise, via `_peut_payer_pour` :
--   1. le parent lié (_parent_possede),
--   2. l'élève lui-même (_eleve_courant),
--   3. le super-admin,
--   4. la caisse de l'école (ecole_courante + a_acces('encaissement')
--      + peut_voir_eleve).
--  On rejoue chaque branche pour le MÊME parent et le MÊME élève que
--  l'essai. Rien n'est écrit, à part une table temporaire de session.
--  Coller tout le fichier, sans rien surligner.
-- =====================================================================
drop table if exists pg_temp.diag_208;
create temp table diag_208 (cle text, valeur text);

do $diag$
declare v_parent uuid; v_mien uuid; v_autre uuid;
begin
  -- Même décor que l'essai
  select t.profil_id, et.eleve_id into v_parent, v_mien
    from tuteurs t join eleve_tuteurs et on et.tuteur_id = t.id
   where t.profil_id is not null
   order by t.profil_id, et.eleve_id
   limit 1;
  select e.id into v_autre from eleves e
   where not exists (select 1 from eleve_tuteurs et join tuteurs t on t.id = et.tuteur_id
                      where et.eleve_id = e.id and t.profil_id = v_parent)
   order by e.id
   limit 1;

  -- auth.uid() lit ce réglage : les fonctions répondent « comme » ce parent.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_parent, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_parent::text, true);

  insert into pg_temp.diag_208 values
    ('1. parent lié à l''autre élève',     public._parent_possede(v_autre)::text),
    ('2. est l''autre élève lui-même',      coalesce((public._eleve_courant() = v_autre)::text, 'false')),
    ('3. super-admin',                      public.est_super_admin()::text),
    ('4a. même école que l''autre élève',   coalesce(((select ecole_id from eleves where id = v_autre) = public.ecole_courante())::text, 'false')),
    ('4b. droit encaissement',              public.a_acces('encaissement')::text),
    ('4c. peut voir l''élève',              public.peut_voir_eleve(v_autre)::text),
    ('=> _peut_payer_pour',                 public._peut_payer_pour(v_autre)::text),
    ('rôles du profil',                     coalesce((select string_agg(distinct role::text, ', ')
                                               from profil_roles where profil_id = v_parent), 'aucun (parent seul)')),
    ('avance_options contient la garde',    (pg_get_functiondef('public.avance_options(uuid)'::regprocedure)
                                               like '%_peut_payer_pour%')::text);
end
$diag$;

select cle, valeur from pg_temp.diag_208;
