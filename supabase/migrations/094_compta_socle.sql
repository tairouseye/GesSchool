-- =====================================================================
--  094 — COMPTABILITÉ (étape 1) : socle de comptabilité générale
--  Pose les fondations SYSCOHADA sans rien casser du livre de caisse
--  existant (comptes / recettes / depenses restent tels quels) :
--    • exercices comptables + périodes mensuelles (ouvert/clôturé)
--    • plan comptable configurable par école (modèle SYSCOHADA d'école)
--    • journaux (caisse, banque, mobile, achats, ventes, salaires, OD)
--  Aucune écriture n'est encore générée ici (étapes suivantes).
--  RLS : cloisonné par école ; gestion (promoteur/direction) ou comptable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXERCICES + PÉRIODES
-- ---------------------------------------------------------------------
create table if not exists exercices (
  id                uuid primary key default gen_random_uuid(),
  ecole_id          uuid not null references ecoles(id) on delete cascade,
  annee_scolaire_id uuid references annees_scolaires(id) on delete set null,
  libelle           text not null,                       -- ex. '2025-2026'
  date_debut        date not null,
  date_fin          date not null,
  statut            text not null default 'ouvert' check (statut in ('ouvert','cloture')),
  created_at        timestamptz not null default now(),
  unique (ecole_id, libelle)
);
create index if not exists exercices_ecole_idx on exercices(ecole_id);

create table if not exists periodes_compta (
  id           uuid primary key default gen_random_uuid(),
  ecole_id     uuid not null references ecoles(id) on delete cascade,
  exercice_id  uuid not null references exercices(id) on delete cascade,
  annee        int  not null,
  mois         int  not null check (mois between 1 and 12),
  statut       text not null default 'ouverte' check (statut in ('ouverte','cloturee')),
  cloture_at   timestamptz,
  cloture_par  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (exercice_id, annee, mois)
);
create index if not exists periodes_compta_ecole_idx on periodes_compta(ecole_id);

-- ---------------------------------------------------------------------
-- 2. PLAN COMPTABLE (chart of accounts)
--    NB : distinct de la table `comptes` (portefeuilles de trésorerie
--    physiques : caisse/banque/mobile). Le lien sera posé à l'étape 3.
-- ---------------------------------------------------------------------
create table if not exists plan_comptable (
  id         uuid primary key default gen_random_uuid(),
  ecole_id   uuid not null references ecoles(id) on delete cascade,
  numero     text not null,
  libelle    text not null,
  classe     int  not null check (classe between 1 and 8),
  type       text check (type in ('actif','passif','charge','produit')),
  parent_id  uuid references plan_comptable(id) on delete set null,
  imputable  boolean not null default true,   -- true = peut recevoir des écritures
  systeme    boolean not null default false,  -- true = compte standard amorcé (protégé)
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ecole_id, numero)
);
create index if not exists plan_comptable_ecole_idx on plan_comptable(ecole_id);
create index if not exists plan_comptable_parent_idx on plan_comptable(parent_id);

-- ---------------------------------------------------------------------
-- 3. JOURNAUX
-- ---------------------------------------------------------------------
create table if not exists journaux (
  id                     uuid primary key default gen_random_uuid(),
  ecole_id               uuid not null references ecoles(id) on delete cascade,
  code                   text not null,                    -- CA, BQ, MM, AC, VE, SA, OD
  libelle                text not null,
  type                   text not null default 'od'
                            check (type in ('tresorerie','achats','ventes','salaires','od')),
  compte_contrepartie_id uuid references plan_comptable(id) on delete set null, -- trésorerie par défaut
  systeme                boolean not null default false,
  actif                  boolean not null default true,
  created_at             timestamptz not null default now(),
  unique (ecole_id, code)
);
create index if not exists journaux_ecole_idx on journaux(ecole_id);

-- ---------------------------------------------------------------------
-- 4. RLS (même modèle que categories_finance : gestion ou comptable)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['exercices','periodes_compta','plan_comptable','journaux'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_tenant on %I', t, t);
    execute format(
      'create policy %I_tenant on %I using (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role(''comptable'')))) with check (est_super_admin() or (ecole_id = ecole_courante() and (est_gestion() or a_role(''comptable''))))',
      t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. AMORÇAGE par école : plan SYSCOHADA d'école + journaux + exercice
-- ---------------------------------------------------------------------
do $$
declare
  e     record;
  a     record;
  item  jsonb;
  d     date;
  -- Plan comptable d'école (SYSCOHADA). type null sur les têtes de tiers.
  comptes jsonb := $j$[
    {"n":"1","l":"Ressources durables","c":1,"t":"passif"},
    {"n":"10","l":"Capital / Fonds propres","c":1,"t":"passif"},
    {"n":"101","l":"Capital / Fonds de dotation","c":1,"t":"passif"},
    {"n":"11","l":"Report à nouveau","c":1,"t":"passif"},
    {"n":"110","l":"Report à nouveau","c":1,"t":"passif"},
    {"n":"12","l":"Résultat","c":1,"t":"passif"},
    {"n":"120","l":"Résultat de l'exercice","c":1,"t":"passif"},
    {"n":"16","l":"Emprunts et dettes financières","c":1,"t":"passif"},
    {"n":"162","l":"Emprunts bancaires","c":1,"t":"passif"},
    {"n":"165","l":"Dépôts et cautionnements reçus","c":1,"t":"passif"},

    {"n":"2","l":"Immobilisations","c":2,"t":"actif"},
    {"n":"21","l":"Immobilisations incorporelles","c":2,"t":"actif"},
    {"n":"213","l":"Logiciels","c":2,"t":"actif"},
    {"n":"22","l":"Terrains","c":2,"t":"actif"},
    {"n":"220","l":"Terrains","c":2,"t":"actif"},
    {"n":"23","l":"Bâtiments et installations","c":2,"t":"actif"},
    {"n":"231","l":"Bâtiments","c":2,"t":"actif"},
    {"n":"235","l":"Aménagements et installations","c":2,"t":"actif"},
    {"n":"24","l":"Matériel","c":2,"t":"actif"},
    {"n":"2441","l":"Matériel et mobilier scolaire","c":2,"t":"actif"},
    {"n":"2442","l":"Matériel informatique","c":2,"t":"actif"},
    {"n":"2444","l":"Matériel pédagogique","c":2,"t":"actif"},
    {"n":"245","l":"Matériel de transport","c":2,"t":"actif"},
    {"n":"28","l":"Amortissements","c":2,"t":"actif"},
    {"n":"2813","l":"Amort. logiciels","c":2,"t":"actif"},
    {"n":"2831","l":"Amort. bâtiments","c":2,"t":"actif"},
    {"n":"2841","l":"Amort. matériel et mobilier","c":2,"t":"actif"},
    {"n":"2842","l":"Amort. matériel informatique","c":2,"t":"actif"},
    {"n":"2845","l":"Amort. matériel de transport","c":2,"t":"actif"},

    {"n":"3","l":"Stocks","c":3,"t":"actif"},
    {"n":"31","l":"Stocks","c":3,"t":"actif"},
    {"n":"311","l":"Fournitures scolaires","c":3,"t":"actif"},
    {"n":"312","l":"Uniformes et articles revendus","c":3,"t":"actif"},

    {"n":"4","l":"Tiers","c":4,"t":null},
    {"n":"40","l":"Fournisseurs","c":4,"t":null},
    {"n":"401","l":"Fournisseurs","c":4,"t":"passif"},
    {"n":"408","l":"Fournisseurs, factures non parvenues","c":4,"t":"passif"},
    {"n":"41","l":"Clients (familles)","c":4,"t":null},
    {"n":"411","l":"Familles — créances scolarité","c":4,"t":"actif"},
    {"n":"419","l":"Familles — avances reçues","c":4,"t":"passif"},
    {"n":"42","l":"Personnel","c":4,"t":null},
    {"n":"421","l":"Personnel — avances et acomptes","c":4,"t":"actif"},
    {"n":"422","l":"Personnel — rémunérations dues (net à payer)","c":4,"t":"passif"},
    {"n":"423","l":"Personnel — oppositions et retenues","c":4,"t":"passif"},
    {"n":"43","l":"Organismes sociaux","c":4,"t":null},
    {"n":"431","l":"IPRES (retraite)","c":4,"t":"passif"},
    {"n":"432","l":"CSS (sécurité sociale)","c":4,"t":"passif"},
    {"n":"438","l":"IPM / autres organismes sociaux","c":4,"t":"passif"},
    {"n":"44","l":"État","c":4,"t":null},
    {"n":"441","l":"État — impôts sur salaires (IR / TRIMF)","c":4,"t":"passif"},
    {"n":"447","l":"État — autres impôts et taxes","c":4,"t":"passif"},
    {"n":"47","l":"Débiteurs et créditeurs divers","c":4,"t":null},
    {"n":"471","l":"Compte d'attente (à imputer)","c":4,"t":"actif"},

    {"n":"5","l":"Trésorerie","c":5,"t":"actif"},
    {"n":"52","l":"Banques","c":5,"t":"actif"},
    {"n":"521","l":"Banque — compte principal","c":5,"t":"actif"},
    {"n":"53","l":"Établissements financiers (mobile money)","c":5,"t":"actif"},
    {"n":"531","l":"Mobile money (Wave / Orange Money)","c":5,"t":"actif"},
    {"n":"57","l":"Caisse","c":5,"t":"actif"},
    {"n":"571","l":"Caisse","c":5,"t":"actif"},
    {"n":"58","l":"Virements internes","c":5,"t":"actif"},
    {"n":"585","l":"Virements de fonds (transferts)","c":5,"t":"actif"},

    {"n":"6","l":"Charges","c":6,"t":"charge"},
    {"n":"60","l":"Achats","c":6,"t":"charge"},
    {"n":"601","l":"Achats de fournitures scolaires","c":6,"t":"charge"},
    {"n":"605","l":"Achats non stockés (eau, énergie)","c":6,"t":"charge"},
    {"n":"6051","l":"Eau","c":6,"t":"charge"},
    {"n":"6052","l":"Électricité","c":6,"t":"charge"},
    {"n":"6053","l":"Autres achats non stockés","c":6,"t":"charge"},
    {"n":"61","l":"Transports","c":6,"t":"charge"},
    {"n":"611","l":"Transport et carburant","c":6,"t":"charge"},
    {"n":"62","l":"Services extérieurs","c":6,"t":"charge"},
    {"n":"622","l":"Locations (loyer)","c":6,"t":"charge"},
    {"n":"624","l":"Entretien et réparations","c":6,"t":"charge"},
    {"n":"625","l":"Primes d'assurance","c":6,"t":"charge"},
    {"n":"628","l":"Télécommunications et internet","c":6,"t":"charge"},
    {"n":"63","l":"Autres services extérieurs","c":6,"t":"charge"},
    {"n":"632","l":"Honoraires et intermédiaires","c":6,"t":"charge"},
    {"n":"638","l":"Autres charges externes","c":6,"t":"charge"},
    {"n":"64","l":"Impôts et taxes","c":6,"t":"charge"},
    {"n":"641","l":"Impôts et taxes","c":6,"t":"charge"},
    {"n":"66","l":"Charges de personnel","c":6,"t":"charge"},
    {"n":"661","l":"Rémunérations du personnel","c":6,"t":"charge"},
    {"n":"664","l":"Charges sociales patronales","c":6,"t":"charge"},
    {"n":"668","l":"Autres charges de personnel","c":6,"t":"charge"},
    {"n":"67","l":"Frais financiers","c":6,"t":"charge"},
    {"n":"671","l":"Intérêts et frais bancaires","c":6,"t":"charge"},
    {"n":"68","l":"Dotations aux amortissements","c":6,"t":"charge"},
    {"n":"681","l":"Dotations aux amortissements","c":6,"t":"charge"},

    {"n":"7","l":"Produits","c":7,"t":"produit"},
    {"n":"70","l":"Prestations scolaires","c":7,"t":"produit"},
    {"n":"706","l":"Scolarité","c":7,"t":"produit"},
    {"n":"7061","l":"Frais d'inscription","c":7,"t":"produit"},
    {"n":"7062","l":"Cantine","c":7,"t":"produit"},
    {"n":"7063","l":"Transport","c":7,"t":"produit"},
    {"n":"7064","l":"Activités et examens","c":7,"t":"produit"},
    {"n":"7065","l":"Vente de fournitures et uniformes","c":7,"t":"produit"},
    {"n":"75","l":"Autres produits","c":7,"t":"produit"},
    {"n":"758","l":"Dons et subventions","c":7,"t":"produit"},
    {"n":"77","l":"Produits financiers","c":7,"t":"produit"},
    {"n":"771","l":"Produits financiers","c":7,"t":"produit"}
  ]$j$::jsonb;
begin
  for e in select id from ecoles loop

    -- 5.a Plan comptable (si l'école n'en a pas encore)
    if not exists (select 1 from plan_comptable where ecole_id = e.id) then
      for item in select * from jsonb_array_elements(comptes) loop
        insert into plan_comptable(ecole_id, numero, libelle, classe, type, systeme)
        values (e.id, item->>'n', item->>'l', (item->>'c')::int,
                nullif(item->>'t','')::text, true);
      end loop;

      -- Arborescence : parent = plus long préfixe présent (numérotation SYSCOHADA).
      update plan_comptable c
        set parent_id = (
          select p.id from plan_comptable p
          where p.ecole_id = c.ecole_id and p.id <> c.id
            and c.numero like p.numero || '%'
            and length(p.numero) < length(c.numero)
          order by length(p.numero) desc limit 1)
      where c.ecole_id = e.id;

      -- Imputabilité : un compte qui a des enfants est une rubrique (non imputable).
      update plan_comptable c set imputable = false
      where c.ecole_id = e.id
        and exists (select 1 from plan_comptable k where k.parent_id = c.id);
    end if;

    -- 5.b Journaux standard (si absents)
    if not exists (select 1 from journaux where ecole_id = e.id) then
      insert into journaux(ecole_id, code, libelle, type, compte_contrepartie_id, systeme)
      select e.id, j.code, j.lib, j.typ,
             (select id from plan_comptable p where p.ecole_id = e.id and p.numero = j.cpt),
             true
      from (values
        ('CA','Journal de caisse','tresorerie','571'),
        ('BQ','Journal de banque','tresorerie','521'),
        ('MM','Journal mobile money','tresorerie','531'),
        ('AC','Journal des achats','achats', null),
        ('VE','Journal des ventes','ventes', null),
        ('SA','Journal des salaires','salaires', null),
        ('OD','Opérations diverses','od', null)
      ) as j(code, lib, typ, cpt);
    end if;

    -- 5.c Exercice ouvert calé sur l'année scolaire courante (si dispo, sinon rien)
    select id, libelle, date_debut, date_fin into a
    from annees_scolaires
    where ecole_id = e.id and courante = true
    order by date_debut desc limit 1;

    if found and not exists (select 1 from exercices where ecole_id = e.id and libelle = a.libelle) then
      insert into exercices(ecole_id, annee_scolaire_id, libelle, date_debut, date_fin)
      values (e.id, a.id, a.libelle, a.date_debut, a.date_fin)
      returning id into a.id;   -- réutilise a.id comme exercice_id

      -- Périodes mensuelles couvrant l'exercice
      d := date_trunc('month', a.date_debut)::date;
      while d <= a.date_fin loop
        insert into periodes_compta(ecole_id, exercice_id, annee, mois)
        values (e.id, a.id, extract(year from d)::int, extract(month from d)::int)
        on conflict (exercice_id, annee, mois) do nothing;
        d := (d + interval '1 month')::date;
      end loop;
    end if;

  end loop;
end $$;

-- =====================================================================
--  ANNULATION
-- =====================================================================
-- drop table if exists periodes_compta;
-- drop table if exists journaux;
-- drop table if exists exercices;
-- drop table if exists plan_comptable;
