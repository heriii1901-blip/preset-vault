import zlib from "node:zlib";
import { getCaller, isAdminOrCreator } from "../lib/apiAuth.js";

// ============================================================
// Generate XML dari link Alight Creative -> upload ke Google Drive
// ============================================================
// Env Vercel yang dibutuhin (diisi belakangan di rumah):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   GOOGLE_DRIVE_FOLDER_ID (opsional, default ke folder di bawah)
// Kalau env Google belum ada, endpoint tetep jalan sampai tahap ambil XML
// (buat tes), terus balikin pesan "Drive belum di-setup".
const DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID || "1m_BCz8Bb8k1eZxHyweGnbOHIGCaCPUB1";

const FB_BUCKET = "alight-creative.appspot.com";
const FB_BASE = `https://firebasestorage.googleapis.com/v0/b/${FB_BUCKET}/o`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Tebakan nama file kalau folder ga bisa di-list (BELUM TERBUKTI, cuma cadangan)
const GUESS_NAMES = [
  "project.zip", "package.zip", "project.xml", "package.xml", "project.alightmotion", "p.zip",
  "package", "project", "package.alightmotion", "share.alightmotion", "data.zip",
  "bundle.zip", "share.zip", "export.zip", "pkg.zip", "package.bin", "p",
];

const enc = encodeURIComponent;

function parseCreativeLink(raw) {
  let u;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "alightcreative.com" && host !== "www.alightcreative.com") return null;
  const m = u.pathname.match(/^\/am\/share\/u\/([^/]+)\/p\/([^/?#]+)/);
  return m ? { uid: m[1], pid: m[2] } : null;
}

// ---------- ZIP mini-reader (tanpa dependency) ----------
function zipEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("ZIP rusak (akhir file ga ketemu)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    out.push({ name, method, csize, lho });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

function zipExtract(buf, e) {
  const nlen = buf.readUInt16LE(e.lho + 26);
  const elen = buf.readUInt16LE(e.lho + 28);
  const start = e.lho + 30 + nlen + elen;
  const data = buf.subarray(start, start + e.csize);
  if (e.method === 0) return data;
  if (e.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`Metode kompres ZIP ${e.method} ga didukung`);
}

// ---------- Ambil file dari server Alight Motion ----------
async function listFolder(prefix, log) {
  const r = await fetch(`${FB_BASE}?prefix=${enc(prefix)}`, { headers: { "User-Agent": UA } });
  log.push(`List folder: status ${r.status}`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const names = (j.items || []).map((i) => i.name);
  log.push(`Isi folder: ${names.length ? names.join(", ") : "(kosong)"}`);
  return names;
}

async function downloadObject(name, log) {
  const base = `${FB_BASE}/${enc(name)}`;
  let r = await fetch(`${base}?alt=media`, { headers: { "User-Agent": UA } });
  log.push(`Download ${name}: status ${r.status}`);
  if (r.status === 401 || r.status === 403) {
    const meta = await fetch(base, { headers: { "User-Agent": UA } });
    if (meta.ok) {
      const mj = await meta.json().catch(() => ({}));
      const token = String(mj.downloadTokens || "").split(",")[0];
      if (token) {
        r = await fetch(`${base}?alt=media&token=${token}`, { headers: { "User-Agent": UA } });
        log.push(`Download ${name} (pakai token): status ${r.status}`);
      }
    }
  }
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

async function sniffSharePage({ uid, pid }, log) {
  try {
    const url = `https://alightcreative.com/am/share/u/${uid}/p/${pid}`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const html = await r.text();
    log.push(`Halaman share: status ${r.status}, ${html.length} karakter`);
    const urls = [...new Set(html.match(/https?:\/\/[^\s"'<>)\\]+/g) || [])];
    urls
      .filter((u) => !/apple\.com|play\.google|badge/.test(u))
      .slice(0, 25)
      .forEach((u) => log.push(`URL: ${u.slice(0, 220)}`));
    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
    log.push(`Script: ${scripts.join(", ") || "(tidak ada)"}`);
    const hints = [...new Set(html.match(/[\w\-./%]*\.(zip|xml|alightmotion|json)[\w\-./%?=&]*/gi) || [])];
    log.push(`Petunjuk nama file: ${hints.slice(0, 15).join(", ") || "(tidak ada)"}`);
  } catch (e) {
    log.push(`Sniff gagal: ${e.message}`);
  }
}

async function fetchXmlFromCreative({ uid, pid }, log) {
  const prefix = `share/u/${uid}/p/${pid}/`;
  await sniffSharePage({ uid, pid }, log);
  let names = await listFolder(prefix, log);
  if (!names.length) {
    log.push("Folder ga bisa di-list, coba tebak nama file...");
    names = [...GUESS_NAMES, pid, `${pid}.zip`, `${pid}.alightmotion`].map((n) => prefix + n);
  }
  const files = names.filter((n) => !/\.(jpe?g|png|webp|gif)$/i.test(n));
  for (const name of files) {
    const buf = await downloadObject(name, log);
    if (!buf) continue;
    log.push(`Ukuran ${name}: ${buf.length} byte`);
    // ZIP -> ambil file .xml di dalamnya
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      const entries = zipEntries(buf);
      log.push(`Isi ZIP: ${entries.map((e) => e.name).join(", ")}`);
      const x = entries.find((e) => /\.xml$/i.test(e.name));
      if (!x) continue;
      return zipExtract(buf, x);
    }
    // XML polos
    const head = buf.toString("utf8", 0, 200).trimStart();
    if (head.startsWith("<")) return buf;
    log.push(`Format ${name} ga dikenali (awal file: ${JSON.stringify(head.slice(0, 40))})`);
  }
  return null;
}

// ---------- Google Drive ----------
async function driveAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(`Token Google ditolak: ${j.error_description || j.error || r.status}`);
  }
  return j.access_token;
}

async function uploadToDrive(token, fileName, xmlBuf) {
  const boundary = `pamxml${Date.now()}`;
  const meta = { name: fileName, parents: [DRIVE_FOLDER_ID], mimeType: "text/xml" };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: text/xml\r\n\r\n`
    ),
    xmlBuf,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const up = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || !uj.id) throw new Error(`Upload Drive gagal: ${uj.error?.message || up.status}`);

  const perm = await fetch(
    `https://www.googleapis.com/drive/v3/files/${uj.id}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );
  if (!perm.ok) {
    const pj = await perm.json().catch(() => ({}));
    throw new Error(`Gagal set akses "siapa saja": ${pj.error?.message || perm.status}`);
  }
  return `https://drive.google.com/file/d/${uj.id}/view?usp=sharing`;
}

function makeFileName(name, pid) {
  let base = String(name || "").replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!base) {
    const d = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    base = `Creative-${String(pid).slice(0, 8)}-${d}`;
  }
  return base.replace(/\.xml$/i, "") + ".xml";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const log = [];
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Harus login dulu" });
    if (!(await isAdminOrCreator(caller))) {
      return res.status(403).json({ ok: false, error: "Cuma admin/kreator yang boleh generate XML" });
    }

    const { url, name } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: "Link Creative kosong" });
    const parsed = parseCreativeLink(String(url));
    if (!parsed) return res.status(400).json({ ok: false, error: "Bukan link Alight Creative (alightcreative.com/am/share/...)" });

    const xml = await fetchXmlFromCreative(parsed, log);
    if (!xml) {
      return res.status(200).json({ ok: false, error: "XML ga berhasil diambil dari server Alight Motion", log });
    }
    log.push(`XML dapet: ${xml.length} byte`);

    const token = await driveAccessToken();
    if (!token) {
      return res.status(200).json({
        ok: false,
        error: "XML udah berhasil diambil, tapi Drive belum di-setup (env GOOGLE_* belum diisi di Vercel)",
        log,
      });
    }

    const link = await uploadToDrive(token, makeFileName(name, parsed.pid), xml);
    log.push("Upload Drive beres");
    return res.status(200).json({ ok: true, link, log });
  } catch (err) {
    console.error("creative-to-xml error:", err);
    return res.status(200).json({ ok: false, error: err.message || "Gagal generate XML", log });
  }
}
