import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Email kamu sebagai admin. Cuma email ini yang bisa buka Panel Admin.
// (Ini cuma buat tampilan UI aja — keamanan aslinya dijaga sama RLS policy di Supabase)
export const ADMIN_EMAIL = 'heriii1901@gmail.com'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
