import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCaller, isAdminOrCreator } from "../lib/apiAuth.js";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Cuma folder & tipe file ini yang boleh di-upload lewat izin presigned
const ALLOWED_FOLDERS = ["presets", "covers", "effects", "effects-covers"];
const ALLOWED_TYPE = /^(video\/[a-z0-9.+-]+|image\/(jpeg|png|webp|gif))$/i;

// Buang path & karakter aneh dari nama file
function safeFileName(name) {
  const clean = String(name).split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]+/g, "_");
  return clean.slice(-80) || "file";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: "Harus login dulu" });
    if (!(await isAdminOrCreator(caller))) {
      return res.status(403).json({ error: "Cuma kreator yang boleh upload" });
    }

    const { fileName, contentType, folder } = req.body || {};
    if (!fileName) {
      return res.status(400).json({ error: "Missing fileName" });
    }

    const targetFolder = folder || "presets";
    if (!ALLOWED_FOLDERS.includes(targetFolder)) {
      return res.status(400).json({ error: "Folder upload gak valid" });
    }
    const type = contentType || "video/mp4";
    if (!ALLOWED_TYPE.test(type)) {
      return res.status(400).json({ error: "Tipe file gak diizinkan" });
    }

    const key = `${targetFolder}/${Date.now()}-${safeFileName(fileName)}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: type,
    });

    // Link ini cuma izin upload doang, ukurannya kecil (bukan file video-nya),
    // jadi ga kena limit ukuran body Vercel. Browser upload langsung ke R2 pake link ini.
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return res.status(200).json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("Presign error:", err);
    return res.status(500).json({ error: "Gagal bikin izin upload" });
  }
}
