import { getCaller, ADMIN_EMAIL } from "../lib/apiAuth.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_BYTES = 100 * 1024 * 1024; // batas aman, jauh di atas video TikTok normal

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// tikwm.com itu middleman TIDAK resmi buat resolve link TikTok jadi link video langsung.
// Bisa berhenti kerja kapan aja kalau mereka ganti API atau blokir IP server.
async function resolveTikwm(tiktokUrl) {
  const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&hd=1`;
  const r = await fetchWithTimeout(api, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`tikwm status ${r.status}`);
  const j = await r.json();
  if (j?.code !== 0 || !j?.data) throw new Error(j?.msg || "Link TikTok gak ketemu / video diprivat");

  const d = j.data;
  // hdplay = kualitas terbaik tanpa watermark. play = versi "biasa" (dikompres berat sama TikTok).
  // wmplay sengaja ngga dipake karena ada watermark.
  const videoUrl = d.hdplay || d.play;
  if (!videoUrl) throw new Error("tikwm ngga ngasih link video buat konten ini");

  const full = videoUrl.startsWith("http") ? videoUrl : `https://www.tikwm.com${videoUrl}`;
  const sizeBytes = (d.hdplay ? d.hd_size : d.size) || null;
  return { videoUrl: full, sizeBytes, usedHd: Boolean(d.hdplay), provider: "tikwm" };
}

// snaptik.app: JAUH lebih rapuh dari tikwm. Situsnya ngga ngasih JSON API resmi, jadi ini
// nge-tiru alur browser (ambil cookie + token dari halaman utama, submit link, baca HTML
// hasilnya buat nemu link download). Struktur HTML & nama endpoint-nya sering ganti-ganti
// tanpa pemberitahuan, jadi provider ini WAJAR kalau tiba-tiba berhenti kerja duluan
// dibanding tikwm. Ditaruh sebagai cadangan kedua, bukan andalan utama.
async function resolveSnaptik(tiktokUrl) {
  const home = await fetchWithTimeout("https://snaptik.app/en", { headers: { "User-Agent": UA } });
  if (!home.ok) throw new Error(`snaptik status ${home.status}`);
  const cookie = (home.headers.get("set-cookie") || "").split(";")[0];
  const homeHtml = await home.text();
  const tokenMatch = homeHtml.match(/name=["']token["']\s+value=["']([^"']+)["']/i);
  const token = tokenMatch ? tokenMatch[1] : "";

  const body = new URLSearchParams({ url: tiktokUrl, token });
  const r = await fetchWithTimeout("https://snaptik.app/abc2.php", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`snaptik status ${r.status}`);

  const raw = await r.text();
  let html = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.data) html = parsed.data;
  } catch {
    // bukan JSON, berarti HTML langsung - dipakai apa adanya
  }

  const linkMatch =
    html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*(?:Download Server|Download MP4)/i) ||
    html.match(/<a[^>]+class="[^"]*download-file[^"]*"[^>]+href="([^"]+)"/i);
  if (!linkMatch) throw new Error("snaptik ngga ngasih link download (kemungkinan struktur situsnya udah ganti)");

  return { videoUrl: linkMatch[1], sizeBytes: null, usedHd: true, provider: "snaptik" };
}

// Rantai provider: dicoba satu-satu dari atas ke bawah, dipake yang pertama berhasil.
// Nambah provider baru di masa depan tinggal nambah fungsi resolve-nya lalu daftarin di sini.
const PROVIDERS = [resolveTikwm, resolveSnaptik];

async function resolveVideo(tiktokUrl) {
  const errors = [];
  for (const provider of PROVIDERS) {
    try {
      return await provider(tiktokUrl);
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }
  throw new Error(`Semua provider gagal - ${errors.join(" | ")}`);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Khusus admin, biar endpoint proxy-download ini gak disalahgunain orang lain
    const caller = await getCaller(req);
    if (!caller || caller.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Khusus admin" });
    }

    const tiktokUrl = req.query?.url;
    if (!tiktokUrl || !/^https:\/\/(www\.|vt\.|vm\.)?tiktok\.com\//i.test(tiktokUrl)) {
      return res.status(400).json({ error: "Link TikTok gak valid" });
    }

    const { videoUrl, sizeBytes, usedHd, provider } = await resolveVideo(tiktokUrl);
    if (sizeBytes && sizeBytes > MAX_BYTES) {
      return res.status(413).json({ error: "Video ini kegedean buat diunduh otomatis" });
    }

    const videoRes = await fetchWithTimeout(videoUrl, { headers: { "User-Agent": UA } }, 25000);
    if (!videoRes.ok || !videoRes.body) {
      return res.status(502).json({ error: "Gagal ambil file video dari sumbernya" });
    }

    // Dialirkan langsung (streaming), ngga ditampung dulu di memory - biar ngga kena
    // limit ukuran response Vercel (4.5MB kalau dibuffer).
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Cache-Control": "no-store",
      "X-Source-Quality": usedHd ? "hd" : "normal",
      "X-Source-Provider": provider,
    });

    const reader = videoRes.body.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        res.destroy();
        return;
      }
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error("Download TikTok video error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Gagal unduh video TikTok", detail: err.message });
    }
    res.end();
  }
}
