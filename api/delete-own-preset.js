import { createClient } from "@supabase/supabase-js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "heriii1901@gmail.com";
const MEDIA_PREFIXES = ["presets/", "covers/"];

function mediaKey(rawUrl) {
  const base = process.env.R2_PUBLIC_URL;
  const url = String(rawUrl || "").split("?")[0].split("#")[0];
  if (!base || !url.startsWith(`${base}/`)) return null;
  const key = url.slice(base.length + 1);
  if (!key || key.includes("..")) return null;
  return MEDIA_PREFIXES.some((p) => key.startsWith(p)) ? key : null;
}

// Kreator hapus preset MILIKNYA sendiri (admin boleh hapus punya siapa aja).
// Pakai service role key supaya gak bergantung ke aturan RLS, jadi kepemilikan dicek manual di sini.
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

    const presetId = req.body?.presetId;
    if (!presetId) return res.status(400).json({ error: "presetId kosong" });

    const { data: preset, error: presetErr } = await admin
      .from("presets")
      .select("id, song_id, creator_username, preview_video_url, cover_url")
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

    // Bersihin favorit dulu biar gak ketahan relasi, lalu hapus presetnya
    await admin.from("favorites").delete().eq("preset_id", preset.id);
    const { error: delErr } = await admin.from("presets").delete().eq("id", preset.id);
    if (delErr) throw delErr;

    // Kurangi jumlah preset di lagunya (best-effort)
    if (preset.song_id) {
      const { data: song } = await admin.from("songs").select("preset_count").eq("id", preset.song_id).maybeSingle();
      if (song) {
        await admin
          .from("songs")
          .update({ preset_count: Math.max(0, (song.preset_count || 0) - 1) })
          .eq("id", preset.song_id);
      }
    }

    // Data udah kehapus -> baru hapus file video + cover di R2
    const failedFiles = [];
    for (const url of [preset.preview_video_url, preset.cover_url]) {
      const key = mediaKey(url);
      if (!key) continue;
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
      } catch (err) {
        console.error("R2 delete error:", key, err);
        failedFiles.push(key);
      }
    }

    return res.status(200).json({ success: true, failedFiles });
  } catch (err) {
    console.error("delete-own-preset error:", err);
    return res.status(500).json({ error: "Hapus gagal", detail: err.message });
  }
}
