import { createClient } from '@supabase/supabase-js';
import { keyValueStore } from '../database/keyValueStore';

// Expo automatically loads variables prefixed with EXPO_PUBLIC_ from .env files.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return await keyValueStore.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await keyValueStore.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await keyValueStore.removeItem(key);
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents redirection bugs in embedded environments
  }
});

const SUPABASE_SERVICE_KEY = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// Admin instance with full auth privileges for bypass actions like registering supermarket super_admins
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});
