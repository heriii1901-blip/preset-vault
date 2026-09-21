import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCaller, ADMIN_EMAIL } from "../lib/apiAuth.js";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchWithTimeout(url, options = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Terima "@user", "user", atau link profil tiktok.com/@user
function extractUsername(input) {
  const raw = String(input || "").trim();
  const m = raw.match(/tiktok\.com\/@([A-Za-z0-9._]{1,40})/i);
  const name = (m ? m[1] : raw.replace(/^@/, "")).toLowerCase();
  return /^[a-z0-9._]{1,40}$/.test(name) ? name : null;
}

// Jalur RESMI: TikTok oEmbed. Cuma balikin nama tampilan (author_name), tanpa foto/bio.
async function getOembedName(username) {
  try {
    const target = `https://www.tiktok.com/@${username}`;
    const r = await fetchWithTimeout(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`,
      { headers: { "User-Agent": UA } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j?.author_name || null;
  } catch {
    return null;
  }
}

// Jalur TIDAK resmi (best-effort): baca data yang ditanam di halaman profil.
// Bisa gagal kapan aja kalau TikTok ngeblok server / ganti struktur halaman.
async function scrapeProfile(username) {
  try {
    const r = await fetchWithTimeout(`https://www.tiktok.com/@${username}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const user = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user;
    if (!user) return null;
    return {
      nickname: user.nickname || null,
      bio: user.signature || null,
      avatar: user.avatarLarger || user.avatarMedium || user.avatarThumb || null,
    };
  } catch {
    return null;
  }
}

// URL foto TikTok itu bertanda tangan & kedaluwarsa, jadi harus disalin ke R2 kita.
async function mirrorAvatar(avatarUrl, username) {
  try {
    const u = new URL(avatarUrl);
    const hostOk = /(^|\.)tiktokcdn(-us|-eu)?\.com$/i.test(u.hostname);
    if (u.protocol !== "https:" || !hostOk) return null;

    const r = await fetchWithTimeout(u.toString(), { headers: { "User-Agent": UA } }, 8000);
    if (!r.ok) return null;

    const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;

    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_AVATAR_BYTES) return null;

    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const key = `avatars/guest-${username}-${Date.now()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_AVATAR_BUCKET_NAME,
        Key: key,
        Body: buf,
        ContentType: type,
      })
    );
    return `${process.env.R2_AVATAR_PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("Mirror avatar TikTok gagal:", err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Khusus admin, biar endpoint ini gak bisa dipake orang lain sebagai proxy
    const caller = await getCaller(req);
    if (!caller || caller.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Khusus admin" });
    }

    const username = extractUsername(req.body?.username);
    if (!username) return res.status(400).json({ error: "Username TikTok gak valid" });

    const [oembedName, scraped] = await Promise.all([
      getOembedName(username),
      scrapeProfile(username),
    ]);

    const avatarUrl = scraped?.avatar ? await mirrorAvatar(scraped.avatar, username) : null;
    const nickname = oembedName || scraped?.nickname || null;

    if (!nickname && !avatarUrl && !scraped?.bio) {
      return res.status(404).json({ error: "Akun TikTok gak ketemu (atau diprivat/diblok)" });
    }

    return res.status(200).json({
      username,
      nickname,
      bio: scraped?.bio || null,
      avatarUrl,
      tiktokLink: `https://www.tiktok.com/@${username}`,
    });
  } catch (err) {
    console.error("TikTok profile error:", err);
    return res.status(500).json({ error: "Gagal ambil profil TikTok", detail: err.message });
  }
}
