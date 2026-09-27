import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "heriii1901@gmail.com";

// Kreator update INFO preset miliknya sendiri (lagu, link XML/5MB, link TikTok).
// Video contoh gak diubah di sini. Pola kepemilikan sama kayak delete-own-preset.js:
// pake service role key, kepemilikan dicek manual biar gak bergantung ke RLS.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return res.status(500).json({ error: "Server belum siap: SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel" });
  }
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Harus login dulu" });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return res.status(401).json({ error: "Sesi login gak valid" });

    const { presetId, songId, xmlLink, mbLink, tiktokLink } = req.body || {};
    if (!presetId) return res.status(400).json({ error: "presetId kosong" });
    if (!songId) return res.status(400).json({ error: "Lagu belum dipilih" });
    if (!xmlLink || !mbLink) return res.status(400).json({ error: "Link XML / 5MB belum diisi" });

    const { data: preset, error: presetErr } = await admin
      .from("presets")
      .select("id, creator_username")
      .eq("id", presetId)
      .maybeSingle();
    if (presetErr) throw presetErr;
    if (!preset) return res.status(404).json({ error: "Preset gak ditemukan" });

    // Cek kepemilikan: admin, atau kreator yang username-nya sama dengan pembuat preset
    if (user.email !== ADMIN_EMAIL) {
      const { data: profile } = await admin
        .from("profiles")
        .select("is_creator, creator_username")
        .eq("id", user.id)
        .maybeSingle();
      const isOwner =
        profile?.is_creator && profile.creator_username && profile.creator_username === preset.creator_username;
      if (!isOwner) return res.status(403).json({ error: "Ini bukan preset kamu" });
    }

    const { error: updateErr } = await admin
      .from("presets")
      .update({
        song_id: songId,
        xml_link: xmlLink,
        mb_link: mbLink,
        tiktok_link: tiktokLink || null,
      })
      .eq("id", presetId);
    if (updateErr) throw updateErr;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("update-own-preset error:", err);
    return res.status(500).json({ error: "Update gagal", detail: err.message });
  }
}
