import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    // Ambil key dari URL, contoh:
    // https://pub-xxxx.r2.dev/presets/migrated-123-abc.mp4 -> presets/migrated-123-abc.mp4
    const key = url.split(`${process.env.R2_PUBLIC_URL}/`)[1];
    if (!key) return res.status(400).json({ error: "URL bukan dari R2 bucket ini" });

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Delete failed", detail: err.message });
  }
}
