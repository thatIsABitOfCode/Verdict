import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL is missing from backend/.env"
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing from backend/.env"
  );
}

/*
 * Privileged server-only Supabase client.
 *
 * NEVER import this into the frontend.
 * The secret key bypasses RLS.
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);