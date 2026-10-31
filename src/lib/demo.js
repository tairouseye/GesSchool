import { supabase } from "@/lib/supabase.js";

// Démonstration sans compte (mig. 216). Le code de la fonction Edge est dans
// supabase/functions/demo/ ; déployée depuis le tableau de bord, Supabase
// lui a donné le nom « dynamic-endpoint », qu'il ne permet pas de changer.
const FONCTION = "dynamic-endpoint";

// La fonction rend une session sur le compte partagé de l'espace choisi ;
// la base, elle, refuse toute écriture à ce compte.
export async function entrerEnDemo(espace) {
  const { data, error } = await supabase.functions.invoke(FONCTION, { body: { espace } });
  if (error || !data?.access_token) {
    throw new Error("La démonstration est indisponible pour le moment. Réessayez dans un instant.");
  }
  const { error: e } = await supabase.auth.setSession({
    access_token: data.access_token, refresh_token: data.refresh_token,
  });
  if (e) throw e;
}

// 'parent' | 'direction' | null — lu dans le jeton, sans requête.
export const espaceDemo = (session) => session?.user?.app_metadata?.demo || null;
