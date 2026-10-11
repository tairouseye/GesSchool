-- =====================================================================
--  199 — Régler les accès CASE PAR CASE (étape 2 du plan)
--
--  🔴 CE QUI MANQUAIT, ET POURQUOI LE PROMOTEUR LE DEMANDE. L'écran Membres
--  savait accorder un MODÈLE entier (« Comptable / Gestion », « Responsable
--  RH »…) mais pas **décocher une case**. Besoin réel énoncé : les deux
--  responsables de Tut'Tank ne doivent pas voir la **Comptabilité**, alors
--  que la responsable **RH & Paie** doit la voir. Aujourd'hui c'est
--  impossible : le modèle « Comptable / Gestion » apporte `comptabilite`
--  avec le reste, et rien ne permet de l'enlever.
--
--  ⚠️ C'EST MAINTENANT QUE ÇA DEVIENT POSSIBLE, et pas avant. Jusqu'aux
--  migrations 175→196, les cases étaient une représentation en attente :
--  les droits réels tenaient aux rôles. Décocher une case n'aurait fermé que
--  l'écran, la base continuant d'autoriser — le défaut que le plan nomme
--  « ⚠️ Ne pas garder les deux ». Les tables et les RPC obéissent désormais
--  aux cases, donc décocher ferme vraiment.
--
--  ⚠️ LE PROMOTEUR NE PEUT PAS SE VERROUILLER LUI-MÊME, et ce n'est pas
--  vérifié ici : `a_acces()` rend vrai inconditionnellement pour
--  `super_admin` et `admin_ecole`. La garantie est dans le helper, pas dans
--  l'appelant — c'est la propriété n°1 du plan, et c'est ce qui rend cette
--  RPC sans danger même si on décoche tout.
-- =====================================================================

-- --- 1. Les cases qui existent ----------------------------------------
--
--  🔴 POURQUOI CETTE FONCTION EST INDISPENSABLE. `boite_de_cle()` rend son
--  argument TEL QUEL pour une clé inconnue : une faute de frappe
--  (`encaissements` au pluriel) ne lève aucune erreur, elle crée une case
--  morte qui n'accorde rien — et verrouille l'écran en silence. Le défaut
--  s'est déjà produit dans ce chantier. Une RPC qui accepte une liste de
--  cases DOIT donc les valider.
--
--  ⚠️ ELLE NE RECOPIE PAS LA LISTE : elle la DÉRIVE des modèles, que la
--  migration 175 a elle-même générés depuis `acces.js`. Retaper 45 noms ici
--  créerait une seconde vérité, qui divergerait au premier écran ajouté.
--  Vérifié avant d'écrire : les 45 cases de l'arbre figurent toutes dans au
--  moins un modèle, donc l'union est complète.
create or replace function public.boites_connues()
returns text[]
language sql stable security definer set search_path = public as $fn$
  select array_agg(distinct b order by b)
    from unnest(array['direction', 'comptable', 'secretaire', 'enseignant',
                      'surveillant', 'rh', 'bibliothecaire']) as m,
         unnest(boites_du_modele(m)) as b;
$fn$;

revoke execute on function public.boites_connues() from public, anon;
grant execute on function public.boites_connues() to authenticated;

-- --- 2. Lire les cases d'un membre ------------------------------------
--
--  `mes_acces()` ne rend que les SIENNES. Pour afficher l'arbre d'un autre
--  membre, il faut les lire — réservé à qui gère les membres.
create or replace function public.acces_du_membre(p_profil uuid)
returns text[]
language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(pa.boite order by pa.boite), '{}'::text[])
    from personnel_acces pa
   where pa.profil_id = p_profil
     and pa.ecole_id = ecole_courante()
     --  Même garde que `perimetres_ecole` : la case `membres`, pas
     --  `est_admin()` — sinon l'écran se viderait pour la direction.
     and (est_super_admin() or a_acces('membres'));
$fn$;

revoke execute on function public.acces_du_membre(uuid) from public, anon;
grant execute on function public.acces_du_membre(uuid) to authenticated;

-- --- 3. Poser les cases d'un membre -----------------------------------
--
--  ⚠️ REMPLACE, n'ajoute pas : c'est tout l'intérêt. `accorder_modele`
--  cumulait (`on conflict do nothing`), donc on ne pouvait jamais retirer.
--  Ici la liste reçue devient la liste exacte.
--
--  ⚠️ RÉSERVÉ AU PROMOTEUR (`est_admin()`), pas à la case `membres` : décider
--  qui voit la comptabilité et la paie n'est pas la même chose qu'inviter un
--  collègue. La direction LIT l'arbre (pour comprendre), le promoteur seul
--  l'écrit. C'est aussi ce qui empêche une responsable de s'accorder la
--  comptabilité qu'on vient de lui retirer.
create or replace function public.definir_acces(p_profil uuid, p_boites text[])
returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_ecole uuid := ecole_courante(); v_connues text[]; v_inconnues text[];
        v_avant text[]; v_demandees text[];
begin
  if auth.uid() is null or v_ecole is null then
    raise exception 'Session introuvable.';
  end if;
  if not est_admin() then
    raise exception 'Seul le promoteur règle les accès d''un membre.';
  end if;
  --  Le membre doit être ACTIF et de cet établissement. Même test que
  --  `definir_perimetre` : sur `profils … and p.actif`, pas sur
  --  `profil_roles`, qui laisserait passer un membre suspendu.
  if not exists (select 1 from profils p
                  where p.id = p_profil and p.ecole_id = v_ecole and p.actif) then
    raise exception 'Cette personne n''est pas un membre actif de votre établissement.';
  end if;

  --  Dédoublonner et retirer les vides AVANT de valider : l'arbre peut
  --  envoyer deux fois une clé transverse (Membres, Paramètres apparaissent
  --  dans plusieurs espaces, et une case accorde LA boîte, pas « la boîte
  --  dans cet espace »).
  select coalesce(array_agg(distinct b), '{}'::text[]) into v_demandees
    from unnest(coalesce(p_boites, '{}'::text[])) as b
   where coalesce(trim(b), '') <> '';

  v_connues := boites_connues();
  select coalesce(array_agg(b), '{}'::text[]) into v_inconnues
    from unnest(v_demandees) as b where not (b = any(v_connues));
  if array_length(v_inconnues, 1) is not null then
    --  🔴 On LÈVE, on n'ignore pas : une case inconnue ne verrouille pas
    --  bruyamment, elle verrouille en silence. Mieux vaut un refus visible.
    raise exception 'Case(s) inconnue(s) : %. Rien n''a été modifié.',
                    array_to_string(v_inconnues, ', ');
  end if;

  select coalesce(array_agg(pa.boite order by pa.boite), '{}'::text[]) into v_avant
    from personnel_acces pa where pa.profil_id = p_profil and pa.ecole_id = v_ecole;

  delete from personnel_acces
   where profil_id = p_profil and ecole_id = v_ecole
     and not (boite = any(v_demandees));
  insert into personnel_acces (ecole_id, profil_id, boite)
  select v_ecole, p_profil, b from unnest(v_demandees) as b
  on conflict (profil_id, ecole_id, boite) do nothing;

  --  ⚠️ UN CHANGEMENT DE DROITS SE JOURNALISE. C'est précisément ce qu'un
  --  journal d'audit sert à attester : qui a donné ou retiré quoi, à qui.
  --  La table est append-only depuis la mig. 192 et son écriture est
  --  réservée à la console ; cette fonction est `definer`, elle contourne la
  --  RLS — c'est voulu, et c'est le seul chemin d'écriture légitime ici.
  insert into journal_audit (ecole_id, utilisateur, entite, entite_id, operation, details)
  values (v_ecole, auth.uid(), 'personnel_acces', p_profil, 'definir_acces',
          jsonb_build_object('avant', v_avant, 'apres', v_demandees));

  return coalesce(array_length(v_demandees, 1), 0);
end $fn$;

revoke execute on function public.definir_acces(uuid, text[]) from public, anon;
grant execute on function public.definir_acces(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- ANNULATION
-- =====================================================================
-- drop function if exists public.definir_acces(uuid, text[]);
-- drop function if exists public.acces_du_membre(uuid);
-- drop function if exists public.boites_connues();
-- -- ⚠️ Annuler retire au promoteur le seul moyen de décocher une case : il
-- -- ne pourrait plus qu'accorder des modèles entiers.
-- notify pgrst, 'reload schema';
