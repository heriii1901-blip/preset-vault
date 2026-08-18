import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, contentType, folder } = req.body || {};
    if (!fileName) {
      return res.status(400).json({ error: "Missing fileName" });
    }

    const key = `${folder || "presets"}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType || "video/mp4",
    });

    // Link ini cuma izin upload doang, ukurannya kecil (bukan file video-nya),
    // jadi ga kena limit ukuran body Vercel. Browser upload langsung ke R2 pake link ini.
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return res.status(200).json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("Presign error:", err);
    return res.status(500).json({ error: "Gagal bikin izin upload", detail: err.message });
  }
}
