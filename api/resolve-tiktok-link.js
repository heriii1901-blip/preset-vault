const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    let target;
    try {
      target = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: "URL gak valid" });
    }

    const host = target.hostname.toLowerCase();
    const isTiktokHost = host === "tiktok.com" || host.endsWith(".tiktok.com");
    if (!["http:", "https:"].includes(target.protocol) || !isTiktokHost) {
      return res.status(400).json({ error: "Bukan link TikTok" });
    }

    // Dulu: fetch + ikutin redirect, terus nebak ID dari angka 15-20 digit pertama
    // yang ketemu di URL akhirnya. Ternyata TikTok suka nolak/ngalihin fetch dari
    // server ke halaman generik (bukan browser beneran), jadi angka yang ke-tebak
    // bisa SALAH dan nabrak sama video lain (bug ID ketuker). Sekarang pake tikwm.com
    // (API yang sama yang udah dipake di download-tiktok-video.js) - ID video diambil
    // langsung dari data JSON-nya, bukan nebak dari URL.
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(target.toString())}`;
    const r = await fetch(api, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`tikwm status ${r.status}`);
    const j = await r.json();

    if (j?.code !== 0 || !j?.data?.id) {
      return res.status(200).json({ finalUrl: null, videoId: null });
    }

    return res.status(200).json({
      finalUrl: j.data.play || null,
      videoId: String(j.data.id),
    });
  } catch (err) {
    console.error("Resolve TikTok link error:", err);
    return res.status(500).json({ error: "Gagal resolve link", detail: err.message });
  }
}
