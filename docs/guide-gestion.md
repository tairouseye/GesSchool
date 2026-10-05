# Guide — Gestion

Pour le **comptable** et le **secrétariat**. L'argent, les dossiers, les papiers.

---

## 1. En début d'année : la grille tarifaire

**Menu Gestion → Paiements → onglet Grille tarifaire**

C'est le catalogue de ce que l'école facture. À faire **une fois**.

Pour chaque frais : un **libellé** (tel qu'il apparaîtra sur la facture), un **montant**, et une **portée** :

| Portée | Quand l'utiliser |
|---|---|
| **Toute l'école** | des frais identiques pour tous |
| **Par cycle** | une scolarité identique pour tout l'élémentaire |
| **Par niveau** | un tarif propre, par exemple une classe d'examen |

Cochez **Mensuel** si le frais se répète chaque mois, et **Obligatoire** pour qu'il soit pré-coché à la facturation en lot.

> ⚠️ **Le piège en Montessori.** Si la classe s'appelle « TPS/PS » et que vous posez le tarif sur « TPS », il ne s'appliquera **à personne** : c'est le niveau de la **classe** qui compte, pas le sous-niveau de l'enfant.

---

## 2. Facturer

**Toute une promotion** — **⚡ Générer en lot** : choisissez le niveau. Les frais obligatoires sont pré-cochés, y compris ceux posés au niveau du cycle. Un élève déjà facturé pour le même frais est **ignoré** : pas de doublon.

**Un élève** — **+ Nouvelle facture** : l'élève, l'échéance, puis les lignes.

> **Pour désigner un élève, tapez deux lettres** de son nom ou de son matricule : la recherche part au serveur. Ne cherchez plus une liste déroulante — elle existait, mais s'arrêtait à 1 000 noms sans le dire.

> ⚠️ **Mettez toujours une date d'échéance.** Sans elle, une facture impayée n'est **jamais** comptée en retard et n'entre pas dans les relances. L'application ne devine pas une échéance que vous n'avez pas donnée.

---

## 3. Encaisser

Cliquez une facture : vous voyez son détail, ses encaissements, et un **reçu imprimable** au logo de l'école.

**Encaisser un paiement** : le montant, le **mode** (espèces, Wave, Orange Money, Free Money, virement, chèque, carte), la référence, la date, et le compte d'encaissement.

- Le **statut se recalcule tout seul** : émise → partiellement payée → payée. Ne le changez pas à la main.
- Les **paiements partiels** sont normaux : encaissez autant de fois qu'il faut.
- **Annuler la facture** la retire des impayés et n'engage plus la famille.

---

## 4. Les paiements déclarés par les familles

**Onglet Paiement mobile**

Renseignez d'abord vos numéros **Wave / Orange Money / Free Money** : ils s'affichent aux parents.

Un parent qui paie par mobile money **déclare** son paiement en joignant une **preuve**. Sa déclaration arrive ici.

1. **« Voir »** la preuve.
2. **Valider** — la facture est soldée automatiquement — ou **rejeter** en expliquant pourquoi.

> ⚠️ **C'est le point où l'on se fait avoir.** Comparez toujours la **référence de la transaction** avec celle de la preuve : une capture d'écran se retouche. Vérifiez aussi le montant et la date.

---

## 5. Relancer les impayés

**Menu Gestion → Recouvrement**

La liste des impayés avec le montant, le retard et le contact de la famille.

- **Relancer** envoie une notification dans l'application.
- **WhatsApp** ouvre un message pré-rempli vers le numéro du parent — c'est le canal qui fonctionne le mieux.
- L'**historique** est conservé : vous ne relancerez pas deux fois la même famille le même jour.

Des **relances automatiques** se règlent dans Paramètres : des paliers (7, 15, 30 jours de retard) déclenchent une notification chaque matin.

> **Pour voir d'un coup d'œil où en est une classe** : menu Élèves, filtrez sur la classe. Une colonne **Paiement** apparaît. ⚪ **Non facturé** n'est pas 🔴 **Retard** — le premier veut dire qu'il reste des factures à émettre, de votre côté.

---

## 6. Les élèves et les inscriptions

**Menu Gestion → Élèves**

**Importer une liste** (une rentrée) :

1. ⚠️ **Les classes doivent exister d'abord.** Sinon les élèves seront créés mais **non inscrits**.
2. Dans votre fichier, la colonne **Classe** doit correspondre **exactement** au libellé de la classe : `CI/CP A` et `CI-CP A` ne sont pas la même chose.
3. **↑ Importer (Excel)** → l'application devine les colonnes → **vérifiez les associations** → **Terminer**.
4. **Lisez le bilan.** « 96 créés, 96 inscrits » est ce qu'il faut voir. Si le second chiffre est plus petit, la colonne Classe ne correspond pas.

Un **modèle** est fourni : `modele-import-eleves.csv`.

**Les codes parents** : sur la fiche de l'élève, bouton **Code parent**. C'est ce code qui permet à la famille de créer son compte.

> **Préférez « Abandon » à la suppression** pour un élève qui a quitté l'école. La suppression emporte **tout** : inscriptions, notes, bulletins, factures, paiements, absences.

---

## 7. Les documents administratifs

**Menu Gestion → Documents**

Un document officiel engage l'établissement : il passe donc par une **validation**.

1. Choisissez l'**élève**, le **type** (certificat de scolarité, attestation d'inscription, de fréquentation, de résultats, radiation, convocation…) et le **signataire**.
2. Le document part pour validation. Le signataire le retrouve dans **« À signer »**.
3. Une fois validé, il est **imprimable / PDF** : informations remplies, accords « né / née », cachet, et un **QR code** qui permet d'en vérifier l'authenticité.

> **Préparez vos signataires d'abord** (Paramètres → Signataires) : sans signataire déclaré, aucun document ne peut être validé.

**Menu Gestion → Demandes** : les demandes envoyées par les familles. **En cours** · **Marquer prêt** · **Rejeter**, avec une réponse. Le parent est notifié automatiquement — inutile de l'appeler.

---

## 8. La comptabilité

**Menu → Comptabilité**, six onglets : **Synthèse**, **Trésorerie**, **Recettes**, **Dépenses**, **Plan comptable**, **Journal**.

**Ce qui arrive tout seul** : un encaissement de facture et une paie payée créent leur écriture. Ne les ressaisissez pas.

**Ce qui demande une saisie** : les dépenses de l'établissement — loyer, électricité, carburant, fournitures. **Joignez le justificatif** : c'est lui qui rend la dépense défendable.

> **Ne confondez pas « facturé » et « encaissé ».** La **Synthèse** raisonne sur le facturé, la **Trésorerie** sur l'argent réellement reçu. L'écart entre les deux, c'est exactement vos impayés.

---

## Si ça ne marche pas

**« Aucun frais applicable à ce niveau »** → le frais est posé sur un autre cycle ou niveau. Vérifiez sa portée.

**« La facture reste émise après encaissement »** → le montant encaissé est inférieur au total : elle est partiellement payée, c'est normal.

**« L'import n'a inscrit personne »** → la colonne Classe ne correspond pas. Corrigez le fichier et réimportez.

**« Je ne vois pas les bulletins / les notes »** → c'est voulu, et c'est tenu **par la base de données**, pas seulement par l'écran : la gestion n'accède pas au dossier pédagogique, et réciproquement la direction n'accède pas aux factures.

> **L'attestation de résultats fait exception, et elle seule.** Pour la délivrer, vous avez besoin de la moyenne : l'application vous donne donc, pour l'élève choisi, **la moyenne, la mention, le rang et la décision du conseil** — et rien d'autre du dossier.

---

Le [**mode d'emploi complet**](mode-emploi.html) décrit les 51 écrans, un par un. Dans l'application, il s'ouvre par le lien **📖 Aide & mode d'emploi**, en bas de la barre latérale (menu **Compte** sur téléphone).

*Développé par GesPro Digitals · contact@gesprosn.org*
