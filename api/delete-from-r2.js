import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Dua bucket yang boleh dihapus lewat endpoint ini:
// - avatar : foto profil & wallpaper (boleh dihapus user yang login)
// - media  : video preview + cover preset/efek (KHUSUS admin)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "heriii1901@gmail.com";
const MEDIA_PREFIXES = ["presets/", "covers/", "effects/", "effects-covers/"];
const MAX_URLS = 20;

function resolveTarget(rawUrl) {
  const url = String(rawUrl || "").split("?")[0].split("#")[0];
  const avatarBase = process.env.R2_AVATAR_PUBLIC_URL;
  const mediaBase = process.env.R2_PUBLIC_URL;

  if (avatarBase && url.startsWith(`${avatarBase}/`)) {
    const key = url.slice(avatarBase.length + 1);
    if (key && !key.includes("..") && key.startsWith("avatars/")) {
      return { kind: "avatar", bucket: process.env.R2_AVATAR_BUCKET_NAME, key };
    }
  }
  if (mediaBase && url.startsWith(`${mediaBase}/`)) {
    const key = url.slice(mediaBase.length + 1);
    if (key && !key.includes("..") && MEDIA_PREFIXES.some((p) => key.startsWith(p))) {
      return { kind: "media", bucket: process.env.R2_BUCKET_NAME, key };
    }
  }
  return null;
}

// Cek token login Supabase yang dikirim dari app
async function getCaller(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!token || !base || !anon) return null;
  try {
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.email ? { email: u.email } : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: "Harus login dulu" });

    const body = req.body || {};
    const urls = (Array.isArray(body.urls) ? body.urls : [body.url]).filter(Boolean).slice(0, MAX_URLS);
    if (urls.length === 0) return res.status(400).json({ error: "Missing url" });

    const isAdmin = caller.email === ADMIN_EMAIL;
    const deleted = [];
    const failed = [];

    for (const url of urls) {
      const target = resolveTarget(url);
      if (!target) {
        failed.push({ url, reason: "URL bukan dari bucket R2 yang dikenali" });
        continue;
      }
      if (target.kind === "media" && !isAdmin) {
        failed.push({ url, reason: "Cuma admin yang boleh hapus video/cover" });
        continue;
      }
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: target.key }));
        deleted.push(url);
      } catch (err) {
        console.error("R2 delete error:", url, err);
        failed.push({ url, reason: err.message });
      }
    }

    return res.status(200).json({ success: failed.length === 0, deleted: deleted.length, failed });
  } catch (err) {
    console.error("Delete handler error:", err);
    return res.status(500).json({ error: "Delete gagal", detail: err.message });
  }
}
