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

    // fetch otomatis ngikutin redirect - short link (vt.tiktok.com/xxx)
    // bakal "kebuka" di server terus balikin URL video panjang yang asli
    const response = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const finalUrl = response.url;
    const match = finalUrl.match(/(\d{15,20})/);

    return res.status(200).json({
      finalUrl,
      videoId: match ? match[1] : null,
    });
  } catch (err) {
    console.error("Resolve TikTok link error:", err);
    return res.status(500).json({ error: "Gagal resolve link", detail: err.message });
  }
}
