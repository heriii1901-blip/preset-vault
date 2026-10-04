import { getCaller, isAdminOrCreator } from "../lib/apiAuth.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Cuma ambil link Alight Creative. Link XML (Drive dll) sengaja diabaikan:
// kalau cuma ada XML tanpa link Creative, hasilnya dianggap kosong.
const CREATIVE_RE = /(?:https?:\/\/)?(?:www\.)?alightcreative\.com\/am\/share\/[^\s"'<>\]+/gi;

async function getJson(url, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// tikwm gratis dibatasi 1 request/detik: kasih jeda, dan ulang sekali kalau tetap kena limit
async function getJsonPaced(url) {
  await sleep(1150);
  let j = await getJson(url);
  if (j?.code !== 0 && /limit/i.test(String(j?.msg || ""))) {
    await sleep(1500);
    j = await getJson(url);
  }
  return j;
}

function extractLinks(text, into) {
  for (const m of String(text || "").matchAll(CREATIVE_RE)) {
    let l = m[0].split(/[?#]/)[0].replace(/[.,;:!?)\]}]+$/, "");
    if (!/^https?:\/\//i.test(l)) l = `https://${l}`;
    into.add(l.replace(/^http:/i, "https:"));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Harus login dulu" });
    if (!(await isAdminOrCreator(caller))) {
      return res.status(403).json({ ok: false, error: "Cuma admin/kreator" });
    }

    const { url } = req.body || {};
    if (!url || !/^https:\/\/([\w-]+\.)?tiktok\.com\//i.test(url)) {
      return res.status(400).json({ ok: false, error: "Link TikTok gak valid" });
    }

    const links = new Set();
    const sources = {};
    const enc = encodeURIComponent(url);

    // 1) Deskripsi video (+ id video buat komentar)
    let videoId = null;
    try {
      const j = await getJson(`https://www.tikwm.com/api/?url=${enc}`);
      if (j?.code !== 0 || !j?.data) throw new Error(j?.msg || "video gak ketemu");
      videoId = String(j.data.id || "");
      extractLinks(j.data.title, links);
      sources.deskripsi = "ok";
    } catch (e) {
      sources.deskripsi = `gagal: ${e.message}`;
    }

    // 2) Komentar (endpoint tikwm, BELUM TERBUKTI - kalau gagal dilewati aja)
    try {
      let cursor = 0;
      let total = 0;
      let replyCount = 0;
      for (let page = 0; page < 3; page++) {
        const j = await getJsonPaced(
          `https://www.tikwm.com/api/comment/list/?url=${enc}&count=50&cursor=${cursor}`
        );
        if (j?.code !== 0 || !j?.data) throw new Error(j?.msg || "komentar gak bisa diambil");
        const list = j.data.comments || [];
        for (const c of list) {
          extractLinks(JSON.stringify(c), links);
          if (Number(c.reply_total) > 0) replyCount++;
        }
        total += list.length;
        if (!j.data.hasMore) break;
        cursor = j.data.cursor ?? cursor + 50;
      }
      sources.komentar = `ok (${total} komentar dicek, ${replyCount} punya balasan)`;
    } catch (e) {
      sources.komentar = `gagal: ${e.message}`;
    }

    return res.status(200).json({ ok: true, videoId, links: [...links], sources });
  } catch (err) {
    console.error("find-creative-links error:", err);
    return res.status(200).json({ ok: false, error: err.message || "Gagal nyari link" });
  }
}
