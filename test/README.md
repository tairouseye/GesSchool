# Tests GesSchool

Lancer : `npm test` (utilise le lanceur intégré de Node, aucune dépendance en plus).

## `permissions.matrix.test.mjs`
Vérifie, pour **chaque rôle × chaque formule commerciale** (Basic / Classic / Premium /
tout activé) :
- aucun rôle disposant d'un espace accessible ne se retrouve **sans aucune page ouvrable**
  (sinon l'utilisateur tombe sur l'écran « sans accès ») ;
- **aucun couplage cassé** entre modules : une page vendue (module actif) doit avoir son
  infrastructure active. C'est ce test qui attrape le bug où les **affectations enseignants**
  étaient verrouillées sous l'offre RH alors que l'appel, les notes et l'emploi du temps en
  dépendent ;
- l'empilement des formules (Confort ⊃ Essentiel, Premium ⊃ Confort).

Le test bundle `src/lib` à la volée avec esbuild (déjà présent via Vite) pour résoudre
l'alias `@/`. À rejouer **à chaque changement d'offre, de rôle ou de module**.

## `rls.smoke.test.mjs`
Smoke-test d'isolation multi-tenant **en lecture seule** contre Supabase. Il ne s'exécute que
si les variables d'environnement sont fournies (sinon il est **ignoré**), afin de ne jamais
committer de clé ni dépendre du réseau :

```
GESSCHOOL_URL=https://<projet>.supabase.co \
GESSCHOOL_ANON=<clé anon/publishable> \
GESSCHOOL_PARENT_EMAIL=<compte parent de test> \
GESSCHOOL_PARENT_PASS=<mot de passe> \
npm test
```

Il vérifie qu'un **anonyme** ne lit aucune table sensible, et qu'un **parent** ne voit que ses
données et ne peut pas insérer de notification.
