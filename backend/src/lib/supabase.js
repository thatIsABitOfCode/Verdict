import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is missing from backend/.env');
}

if (!supabasePublishableKey) {
  throw new Error(
    'SUPABASE_PUBLISHABLE_KEY is missing from backend/.env'
  );
}

export function createSupabaseClient(accessToken) {
  return createClient(supabaseUrl, supabasePublishableKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : {},
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}