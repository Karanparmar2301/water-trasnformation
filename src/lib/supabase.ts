import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseSchema = (import.meta.env.VITE_SUPABASE_SCHEMA || 'public').trim() || 'public';
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Create a single supabase client for interacting with your database
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
