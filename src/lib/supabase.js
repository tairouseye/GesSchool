import { createClient } from "@supabase/supabase-js";

// GesSchool — client Supabase unique (Postgres + Auth + Storage).
// Les credentials viennent de .env (jamais commités).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Garde-fou en dev : message clair plutôt qu'une erreur cryptique au runtime.
  console.error(
    "[GesSchool] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "Copier .env.example en .env et renseigner les valeurs du projet Supabase."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
