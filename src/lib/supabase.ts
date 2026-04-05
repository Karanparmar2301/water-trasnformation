import { createClient } from '@supabase/supabase-js';

// Fallback values keep production connected if environment variables are missing.
// Supabase anon keys are safe to expose in frontend applications.
const DEFAULT_SUPABASE_URL = 'https://ehisgjnldaregojpjtov.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaXNnam5sZGFyZWdvanBqdG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDg0NjQsImV4cCI6MjA5MDg4NDQ2NH0.m8B0KCDaMhFCmOYRvG5zWNNhVfCfUbVMVTSbRBYC4k0';

function sanitizeEnvValue(rawValue: unknown, fallback: string): string {
  const baseValue = typeof rawValue === 'string' ? rawValue : fallback;
  const trimmed = baseValue.trim();
  const withoutLeadingQuotes = trimmed.replace(/^["']+/, '');
  const withoutBoundaryQuotes = withoutLeadingQuotes.replace(/["']+$/, '').trim();

  if (!withoutBoundaryQuotes) {
    return fallback.trim();
  }

  return withoutBoundaryQuotes;
}

export function sanitizeSupabaseIdentifier(rawValue: string): string {
  return sanitizeEnvValue(rawValue, '');
}

const supabaseUrl = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_URL, DEFAULT_SUPABASE_URL);
const supabaseAnonKey = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);

const normalizedSchema = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_SCHEMA, 'public').toLowerCase();
export const supabaseSchema = normalizedSchema || 'public';
export const usesDefaultSupabaseSchema = supabaseSchema === 'public';
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

export const supabaseRealtimeSchema = usesDefaultSupabaseSchema ? 'public' : supabaseSchema;

export function fromSupabaseTable(tableName: string) {
  if (!supabase) {
    return null;
  }

  const normalizedTableName = sanitizeSupabaseIdentifier(tableName);
  if (!normalizedTableName) {
    return null;
  }

  if (usesDefaultSupabaseSchema) {
    return supabase.from(normalizedTableName);
  }

  return supabase.schema(supabaseSchema).from(normalizedTableName);
}
