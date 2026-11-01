// GesSchool — ESLint (lot 5 de l'audit du 31/10/2026, P2-14).
//
// Le script `npm run lint` existait sans configuration ni dépendance : il ne
// vérifiait rien. Ce filet attrape ce qu'un test unitaire ne voit pas —
// variable inconnue, hook appelé sous condition, code mort.
//
// ⚠️ ERREUR = bloque le déploiement (étape `npm run lint` de deploy.yml).
// AVERTISSEMENT = signalé, sans bloquer : dépendances d'effets et variables
// inutilisées, nombreuses et souvent volontaires dans le code existant.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default [
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**", "public/**", "supabase/functions/**", "AUDIT_GESCHOOL/**", "Videos presentation/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, __APP_VERSION__: "readonly", __BUILD_DATE__: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, react },
    rules: {
      //  Sans ces deux règles, un composant utilisé seulement en JSX passerait
      //  pour une variable inutilisée.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["test/**/*.mjs", "scripts/**/*.{js,mjs}", "docs/**/*.mjs", "*.config.js", "*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
    rules: { "no-unused-vars": ["warn", { args: "none" }] },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
