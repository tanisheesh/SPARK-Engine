import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
};

export type SavedPrompt = {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  created_at: string;
};
