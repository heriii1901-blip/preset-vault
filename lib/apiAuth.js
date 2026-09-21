// Helper login buat API. Token Supabase dikirim app lewat header "Authorization: Bearer <token>".
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "heriii1901@gmail.com";

function supabaseEnv() {
  return {
    base: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    anon: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  };
}

// Balikin { id, email, token } kalau token valid, null kalau enggak.
export async function getCaller(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const { base, anon } = supabaseEnv();
  if (!token || !base || !anon) return null;
  try {
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? { id: u.id, email: u.email || "", token } : null;
  } catch {
    return null;
  }
}

// Admin atau kreator terdaftar? (status kreator dibaca dari tabel profiles pakai token si user)
export async function isAdminOrCreator(caller) {
  if (caller.email === ADMIN_EMAIL) return true;
  const { base, anon } = supabaseEnv();
  try {
    const r = await fetch(`${base}/rest/v1/profiles?id=eq.${caller.id}&select=is_creator`, {
      headers: { apikey: anon, Authorization: `Bearer ${caller.token}` },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return rows?.[0]?.is_creator === true;
  } catch {
    return false;
  }
}
