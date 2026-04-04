import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    supabaseUrl !== "your_project_url" &&
    supabaseKey !== "your_public_key"
);

if (!isSupabaseConfigured) {
  console.warn(
    "GigShield: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env for database sync."
  );
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;
