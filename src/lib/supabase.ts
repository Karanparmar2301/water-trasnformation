import { createClient } from '@supabase/supabase-js';

// Fallback values keep production connected if environment variables are missing.
// Supabase anon keys are safe to expose in frontend applications.
const DEFAULT_SUPABASE_URL = 'https://ehisgjnldaregojpjtov.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaXNnam5sZGFyZWdvanBqdG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDg0NjQsImV4cCI6MjA5MDg4NDQ2NH0.m8B0KCDaMhFCmOYRvG5zWNNhVfCfUbVMVTSbRBYC4k0';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

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
