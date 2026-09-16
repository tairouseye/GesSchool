# Journal des modifications — GesSchool

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version la plus récente en haut.
La version applicative est celle de `package.json` (affichée dans l'app). Migrations dans [`supabase/migrations/`](supabase/migrations).

> Historique antérieur à `2.109.0` : voir l'historique git. Ce journal démarre au chantier **Comptabilité / RH & Paie**.

## [2.171.0] — migration 114
- **Supérieur — Consentement d'accès parent aux notes (étapes A2 + A3)** :
  - **A2** — le parent (déjà lié à l'étudiant) voit un bouton **« Demander l'accès aux notes »** sur les sections Notes/Bulletins ; l'étudiant reçoit la demande dans son **espace** et l'**autorise / refuse / révoque**.
  - **A3** — au supérieur, les notes et bulletins ne remontent au parent **que si l'accès est autorisé** (RPC `enfant_notes` / `enfant_bulletins` gatées) ; sinon la section affiche l'état de la demande. **À l'école, comportement inchangé** (le parent voit librement).
  - Table `acces_parent_etudiant` + RPC `demander_acces_notes` / `mon_acces_notes` / `mes_demandes_acces` / `decider_acces` (migration 114). **Chantier consentement complet (A1→A3).**

## [2.170.0] — migration 113
- **Supérieur — Comptes étudiants (étape A1)** : l'étudiant majeur a désormais son **compte**, sur le modèle des parents. L'établissement génère un **code étudiant** (page **« Codes étudiants »**, Pédagogie/Supérieur), distribué par **WhatsApp** ; l'étudiant crée son compte, choisit « Je suis un étudiant » et saisit le code → un **espace étudiant** dédié s'ouvre. Socle du consentement d'accès parent (étapes A2 « demande & approbation » et A3 « cloisonnement des notes » à suivre).
  - Rôle `etudiant`, `eleves.profil_id` / `code_acces` / `telephone`, RPC `lier_etudiant` + `generer_code_etudiant` (migration 113). Cloisonné au supérieur ; aucun impact sur les écoles.

## [2.169.0] — migration 112
- **Espace parent — pastilles « nouveau » par menu** : chaque tuile de l'enfant (Notes, Absences, Paiements…) affiche une **pastille** quand il y a du nouveau, alimentée par les notifications déjà générées (nouvelle note, absence, facture). La pastille s'efface à l'ouverture de la section. Les notifications portent désormais l'**élève concerné** et une **catégorie** (migration 112) pour un comptage précis par enfant.

## [2.168.0] — migration 111
- **Supérieur (LMD) — Délibérations & relevés (Phase 4)** : nouvelle page **« Délibérations & relevés »** (Pédagogie / Supérieur).
  - **Arrêté des résultats** : fige (snapshot) les résultats calculés d'une cohorte (filière/niveau/semestre/session) en une **délibération** + un **relevé par étudiant** ; verrouillage possible.
  - **Relevé de notes** imprimable (détail par UE, moyenne, crédits acquis/total, décision, mention) **avec QR d'authentification** — vérifiable sur la page publique `/verifier` (nouveau type `releve` dans `verifier_document`).
  - **PV de délibération** imprimable (liste des décisions du jury).
  - Tables `deliberations` + `releves` (additives, RLS). **Module Supérieur : phases 0 à 4 livrées.**

## [2.167.0] — migration 110
- **Supérieur (LMD) — Notes & moteur de calcul (Phase 3)** : nouvelle page **« Notes »** (espace Pédagogie, mode Supérieur).
  - **Saisie** des notes par UE / ECUE, en **CC + examen**, par **session** (normale / rattrapage). Note finale = CC × pondération + Examen × pondération (réglable/école, défaut 40/60).
  - **Résultats** calculés par le **moteur LMD** : moyenne ECUE→UE→semestre, **capitalisation** (UE ≥ 10 → crédits acquis), **compensation** (semestre ≥ 10 → tout le semestre validé), crédits acquis/total, **décision** (Admis / Admis par compensation / Ajourné) et **mention**.
  - Moteur pur et **testé** (`test/lmd.test.mjs` : note finale, moyennes, capitalisation, compensation, mention). Table `notes_lmd` (additive, RLS).

## [2.166.0] — migration 109
- **Supérieur (LMD) — Inscriptions (Phase 2)** : nouvelle page **« Inscriptions »** (espace Pédagogie, mode Supérieur) pour l'**inscription administrative** (rattacher un étudiant — existant ou nouveau — à une filière + niveau, avec génération optionnelle de la **facture de droits** via le module Paiements) et l'**inscription pédagogique** (choix des **UE** du semestre, avec total de crédits). Filtres par filière/niveau, gestion du statut (active/suspendue).
  - Tables `inscriptions_sup` et `inscriptions_ue` (additives, RLS). Réutilise `eleves`, `annees_scolaires` et la facturation existante.

## [2.165.0] — migration 108
- **Module « Supérieur » (LMD) — fondation** : nouveau **type d'établissement** (École / Enseignement supérieur), réglable dans Paramètres → Établissement. Quand il vaut « Supérieur », l'espace **Pédagogie bascule en mode LMD** : la page **« Filières & maquettes »** (Faculté → Département → Filière → Semestre, puis **UE / ECUE avec crédits et coefficients**, contrôle « /30 crédits ») remplace Niveaux & classes / Notes / Bulletins. Le reste (finances, communication, documents, RH) est identique.
  - 100 % **additif et isolé** : nouvelles tables (`facultes`, `departements`, `filieres`, `semestres`, `ue`, `ecue`) avec RLS ; **aucun impact** sur les écoles existantes (type par défaut = `ecole`). Logique de crédits couverte par des tests unitaires (`test/lmd.test.mjs`).
  - Première brique de la feuille de route LMD (phases 0-1). Suite : inscriptions pédagogiques, moteur de calcul (capitalisation/compensation), délibérations, relevés.

## [2.164.0] — migration 107
- **Documents authentifiables par QR code** : chaque document officiel valide porte désormais un **QR code** en bas de page renvoyant vers une **page publique de vérification** (`/verifier`, accessible sans compte). En scannant, on confirme l'authenticité du document depuis le registre de l'école (établissement, bénéficiaire, référence, date, montant/mention…). Couvre : **factures & reçus de paiement**, **bulletins de notes** (côté gestion et côté parent), **bulletins de paie**, **certificats & attestations**, et un nouveau **reçu de dépense imprimable** (Comptabilité → Dépenses → « 🧾 reçu »).
  - Technique : RPC publique `verifier_document` (lecture seule, `security definer`, accès `anon`) — aucune écriture à l'impression, les documents historiques sont vérifiables sans reprise de données. Le QR encode le type + l'identifiant stable de l'enregistrement. QR généré côté client en SVG (net à l'impression, sans réseau).

## [2.163.0] — migration 106
- **RH — fiche employé complétée** : nouveaux champs **pays, n° fiscal (NINEA), banque, compte bancaire/IBAN, mobile money, personnes à charge** (section « Paiement & coordonnées bancaires » de la fiche). Complète la conformité paie/SYSCOHADA (le n° IPRES existait déjà).

## [2.162.0] — migration 105
- **Fournitures — case « fourni par l'école »** : indicateur explicite par article (colonne `fourni_ecole`), réglable côté staff (bouton « école » sur chaque ligne + case dans le formulaire). L'espace parent affiche ces articles en **rouge gras** selon cette case (plus le mot-clé). Backfill : les articles dont la note mentionnait l'école sont cochés automatiquement.

## [2.161.0]
- **Espace parent — fournitures fournies par l'école en évidence** : dans la liste de fournitures de l'enfant, les articles **fournis ou disponibles à l'école** (note mentionnant l'école) s'affichent en **rouge gras**, avec une légende (« pas besoin de l'acheter ailleurs »).

## [2.160.0]
- **Comptabilité — Plan comptable en arbre repliable** : les classes et comptes parents se **déplient/replient** (cascade), avec bouton « Tout déplier / Tout replier » — fini la longue liste plate.

## [2.159.0]
- **Correctif génération de paie bloquée (gros barème)** : le chargement du barème pour le calcul se fait de nouveau en **une seule requête** (au lieu de ~15 pages) — la pagination introduite en 2.154 pouvait faire **caler la génération en silence** sur un barème volumineux (2013 réel). Le comptage reste un COUNT serveur.

## [2.158.0]
- **UX mobile — fenêtres (modales) adaptées à l'écran** : les fenêtres sont plafonnées à la hauteur visible (`dvh`), en-tête fixe et **contenu qui défile** jusqu'en bas (boutons toujours atteignables), en **portrait comme en paysage** ; prise en compte de la zone sûre iPhone (encoche). Corrige le bas de fenêtre coupé (ex. « Régime », « Préparer la paie »).

## [2.157.0] — migration 104
- **Super_admin — accès à toutes les écoles** : `entrer_ecole` autorise un super_admin à entrer dans **n'importe quelle** école (support/maintenance), sans être propriétaire. Bouton **« entrer »** dans la console SuperAdmin (à côté de « gérer ») → bascule le contexte sur l'école choisie (RH, paie, compta…). Un seul compte pour toutes les écoles.

## [2.156.0]
- **Paie — net TOTAL = salaire de base** : en « base = net », la partie soumise vise *(salaire de base − indemnités non soumises)* ; avec la prime de transport rajoutée après déductions, le **net final égale exactement le salaire de base** saisi.

## [2.155.0]
- **Paie — salaire de base = net exprimé en heures × taux horaire dérivé** : en régime complet « base = net », le brut calculé à l'envers est présenté comme *heures mensuelles × taux horaire*, le **taux étant la variable dérivée** qui fait correspondre le net saisi (Personnel). Le net du bulletin = salaire de base saisi.
- **Prime de transport non soumise** : sortie de l'assiette cotisations/IR, **ajoutée après les déductions** (indemnité non imposable). Réglable par élément (bouton soumis/non soumis).

## [2.154.0]
- **Correctif barème volumineux** : `compterBareme` utilise un **COUNT serveur** (exact, sans charger les lignes) et le chargement du barème (`getBaremePour`) est **paginé**. Un barème réel (ex. 2013 ≈ 14 800 lignes) était tronqué à ~1000 lignes → faux « barème non chargé » à la génération **et** IR faussé pour les hauts revenus. Corrigé.

## [2.153.0] — migration 103
- **RH & Paie — compte comptable par élément (P6 audit)** : chaque élément de paie peut porter son **compte du plan comptable**. La comptabilisation des salaires (`poster_salaire_charge`) répartit alors les **charges (débit)** et les **retenues (crédit)** sur ces comptes, avec repli sur les comptes par défaut (661/423/organismes) et **équilibre garanti**. Sélecteur de compte dans **Éléments de paie**. *(PDF téléchargeable et historique de salaire déjà assurés par l'impression navigateur + dossier employé/piste d'audit existants.)*

## [2.152.0] — migration 102
- **RH & Paie — règles versionnées (P9 audit)** : cotisations et barème IR portent une **date d'effet** (+ date de fin pour les cotisations). La paie d'une période utilise la **version en vigueur ce mois-là** (`getCotisationsPour`/`getBaremePour`, `contexteComplet` et recalcul période-aware). `remplacer_bareme` **ajoute une version datée** (l'historique est conservé) au lieu de tout écraser. UI Régime : colonne « Effet » sur les cotisations, champ « à partir du » à l'import + liste des versions. Non destructif : l'existant prend effet le 2000-01-01.

## [2.151.0]
- **RH & Paie — régularisation IR annuelle (décembre)** : à la génération de **décembre**, une ligne **« Régularisation IR (annuelle) »** compare l'IR dû sur le **revenu annuel** (barème annuel) à la **somme des IR mensuels** déjà retenus → complément à retenir (> 0) ou **trop-perçu restitué** (< 0). Inclut naturellement le 13ᵉ mois s'il est soumis. Fonction pure `regularisationIR` testée. Nécessite le **barème annuel** chargé (mode complet).

## [2.150.0]
- **RH & Paie — congés/absences avant la paie** : « Préparer la paie » liste désormais les **congés en attente** et les **absences** du mois. La **génération est bloquée** tant que des congés du mois ne sont pas validés/refusés (bouton « Aller à Congés & absences »). Les absences non justifiées restent gérées par la retenue (P5).

## [2.149.0]
- **RH & Paie — Retenue sur absences (P5 audit)** : règle configurable par école — **aucune** / **proratisée** (jours × brut soumis ÷ jours-mois) / **forfait** (jours × montant/jour), sur les absences **non justifiées** (absence/maladie) du mois. Ligne « Retenue absences (N j) » ajoutée automatiquement à la génération. Réglage dans **RH & paie → Paie → Régime → « Retenue sur absences »**. Défaut : aucune (comportement inchangé).

## [2.148.0] — migration 101
- **RH & Paie — Éléments périodiques (P4 audit)** : un élément peut être **mensuel** (défaut), **trimestriel** (3/6/9/12), **semestriel** (6/12) ou **annuel / 13ᵉ mois** (décembre). Il ne figure alors que sur ses **mois de déclenchement** → **anti-double** naturel (une fiche par mois). Sélecteur de périodicité dans **Éléments de paie**. Sans effet sur les éléments existants (restent mensuels).

## [2.147.0] — migration 100
- **RH & Paie — Éléments globaux (P3 audit)** : appliquer un élément à une **portée** (tous / une catégorie / une fonction) avec un montant par défaut, et **exclure** des employés précis. Priorité de fusion : `global < régime < individuel` (le plus spécifique l'emporte). Gestion via **RH & paie → Paie → « Global »**.

## [2.146.0] — migration 099
- **RH & Paie — Régimes de rémunération (P2 audit)** : un **régime** nommé regroupe des éléments récurrents (montant par défaut) et s'affecte à un employé (fiche → « Régime de rémunération ») ou **en masse à une catégorie**. À la génération, les éléments de l'employé = régime + affectations individuelles (**l'individuel prime**). Gestion via **RH & paie → Paie → « Régimes »**. Non destructif : un employé sans régime garde le comportement actuel.

## [2.145.0] — migration 098
- **Comptabilité — salaires (P1 audit RH&Paie)** : une paie **validée** génère l'écriture de **constatation** (Débit 661 rémunérations + 664 patronal / Crédit 422 net + 431/432/438 organismes + 441 IR-TRIMF + 447 CFCE + 421 avances + 423 retenues), et le **paiement** génère le **règlement** (Débit 422 / Crédit trésorerie) via la dépense salaire — **sans double comptage**. Réversible : dévalidation et annulation de paiement suppriment les pièces (période ouverte). Triggers **non bloquants**. La **reprise d'exercice** inclut désormais les salaires.

## [2.144.0]
- **Paie — primes après déductions** : les primes/indemnités ajoutées à un bulletin sont **non soumises par défaut** (hors assiette cotisations/IR) et affichées **après les déductions** dans l'éditeur (le brut n'inclut plus que les gains soumis) — cohérent avec le bulletin imprimable. Un élément explicitement « soumis » reste dans le brut.
- **Paie — fin des doublons au recalcul** : le bouton « ↻ Recalculer » supprime désormais les lignes auto (cotisations/impôts + charges patronales) de façon **atomique** et est protégé par un **verrou anti-chevauchement** (plus de double jeu de cotisations). Un clic suffit aussi à nettoyer d'éventuels doublons existants.

## [2.143.0]
- **Paie — salaire de base NET** : en régime complet, le salaire de base d'un salaire fixe peut être traité comme le **net à verser** ; le **brut est calculé à l'envers** (net-to-gross) pour que, cotisations et IR déduits, l'employé touche exactement ce montant. Interrupteur **Net / Brut** dans Régime (défaut : Net). Corrige l'écart « Salaire base » (vue Personnel) vs « Net » (vue Paie) : après régénération du bulletin, les deux coïncident. Sans effet sur les employés payés à l'heure (taux horaire).

## [2.142.0] — migration 097
- **Comptabilité — exercices** : `assurer_exercices()` crée un exercice (+ périodes) pour chaque **année scolaire** sans exercice (094 ne le faisait que pour l'année courante). Dans « Paramètres », **sélecteur d'exercice** pour la reprise + bouton **« Créer les exercices manquants »** — permet de comptabiliser une année dont les opérations ne tombent pas dans l'exercice courant (ex. année en cours de clôture).

## [2.141.0] — migration 096
- **Comptabilité générale (étape 3)** : branchement automatique des opérations en partie double (méthode **engagement**). Facture → *Débit 411 Famille / Crédit 706 Scolarité* ; règlement → *Débit trésorerie / Crédit 411* ; dépense → *Débit charge / Crédit trésorerie* (charge selon la catégorie, mapping configurable). **Activation par école** (opt-in), **règles de mapping** (`regles_ecriture`), lien portefeuille de trésorerie → plan. **Reprise de l'exercice courant** (idempotente) via « Paramètres ». Triggers **non bloquants** (une erreur de comptabilisation n'empêche jamais l'opération métier ; journalisée dans `compta_erreurs`). Salaires branchés à l'étape suivante.

## [2.140.0] — migrations 094, 095
- **Comptabilité générale (étapes 1–2)** : socle SYSCOHADA amorcé par école — **plan comptable** configurable (classes 1→7), **journaux** (CA/BQ/MM/AC/VE/SA/OD), **exercices** + périodes mensuelles. **Moteur d'écritures en partie double** : pièces équilibrées (contrôle Σdébit = Σcrédit côté serveur), idempotence par opération source, verrou de période clôturée. Onglets **Plan comptable** et **Journal** (saisie d'opérations diverses) dans le module Comptabilité. Le livre de caisse existant reste inchangé.

## [2.139.0]
- **Récapitulatif des salaires** (rapport comptable) : net à payer + institutions (VRS, IPRES+CSS, IPM) + total décaissé, imprimable + export Excel.

## [2.138.0]
- **Régimes de paie multi-pays** : modèles de cotisations applicables par école (Sénégal validé ; RDC, Mali, Côte d'Ivoire = structure + taux indicatifs). `src/lib/regimes.js`.

## [2.137.0] · [2.136.0]
- **UX mobile (Phase 5)** : listes de paie et de congés converties en **cartes** (fin du défilement horizontal), actions tactiles.

## [2.135.0]
- **Livre de paie** imprimable (brut/cotisations/net/charges patronales + totaux) + **export Excel**.

## [2.134.0] — migration 092
- **Absences RH** (absence/retard/maladie/autorisation), informatif (pas de retenue automatique).

## [2.133.0] — migration 091
- **Congés** : demande → approbation/refus → solde annuel (quota réglable).

## [2.132.0] — migration 090
- **Dossier employé 360°** + **identité civile** + **historique des contrats** (période d'essai, motif de fin).

## [2.131.0] · [2.130.0] — migration 089
- **Avances & prêts** : échéancier, solde réversible (dérivé), **déduction automatique** à la génération. Proratisation embauche/départ en cours de mois.

## [2.129.0] — migration 088
- **Contrôle interne (Phase 1)** : piste d'audit des montants (inviolable), garde de suppression hors brouillon, **séparation des tâches** optionnelle.

## [2.128.0] — migrations 086, 087
- **Réparation** workflow/audit (journal_audit non persisté) + **diagnostic santé** (RH → Paie → Régime → « Vérifier l'installation »).

## [2.127.0] — migration 085
- Audit 🟡 : import du barème **atomique** (RPC), **dette personnel** visible au comptable, Part TRIMF clarifiée.

## [2.126.0]
- **Arrondi au franc** cohérent (net = somme des lignes arrondies).

## [2.125.0]
- **Vérification des entêtes** avant génération (champs manquants par employé, taux horaire critique).

## [2.124.0]
- **Bulletin de paie au format officiel** (colonnes part employé / patronale, cotisations, net, charges patronales).

## [2.123.0] — migration 084
- Audit 🟠 #1 : **recalcul automatique** des cotisations/IR après édition. Retrait du code mort `maj_salaire`.

## [2.122.0]
- **Préparer la paie** : heures/absences validées par employé avant génération.

## [2.121.0]
- **Tableau de bord comptable** (Phase G) : caisse/banque, recettes/dépenses/salaires, **créances & dettes**, résultat.

## [2.120.0] — migration 083
- Gains **non soumis** (transport…) : dans le net mais hors assiette cotisations/IR.

## [2.119.0] — migration 082
- **Brut = heures mensuelles × taux horaire** (base + sursalaire) ; heures ajustables par bulletin.

## [2.118.0] · [2.117.0] — migration 081
- **Moteur de paie** : cotisations (part sal./patr., plafonds) + **IR/TRIMF via barème** ; **import du barème** par école.

## [2.116.0] — migration 080
- **Régime de paie configurable** par école (cotisations, mode simplifié/complet, champs fiscaux employé).

## [2.115.0] — migration 079
- **Workflow de paie** brouillon → validé → payé (verrouillage) + **journal d'audit**.

## [2.114.0] — migration 078
- **Bulletin dynamique** : composition en lignes (gains/retenues), net recalculé par trigger.

## [2.113.0] — migration 077
- **Catalogue d'éléments de paie** configurable (gains/retenues, récurrent/ponctuel).

## [2.112.0] — migration 076
- **Catégories financières** configurables par école.

## [2.111.0]
- Édition du personnel, import des enseignants comme personnel, personnel sans contrat visible en paie.

## [2.110.0] — migration 075
- **Trésorerie/scolarité** : les encaissements alimentent la caisse (cohérence trésorerie ↔ résultat).

## [2.109.0] — migration 074
- Paie **nette** (« salaire de base »), personnel automatique, édition post-paiement (resync dépense) ; correctifs d'audit RH & compta.

---

### Correctifs base (sans changement de version applicative)
- **093** — autorise la suppression d'un bulletin **brouillon** (le verrou ignorait le parent supprimé en cascade).
