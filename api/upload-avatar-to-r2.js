import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/gif", "image/jpeg"];

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
    const chunks = [];
    let totalSize = 0;
    for await (const chunk of req) {
      totalSize += chunk.length;
      if (totalSize > MAX_AVATAR_BYTES) {
        return res.status(400).json({ error: "File PP kegedean, maksimal 2MB" });
      }
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    const fileName = req.headers["x-file-name"];
    const fileType = req.headers["content-type"] || "image/png";

    if (!fileName) {
      return res.status(400).json({ error: "Missing x-file-name header" });
    }
    if (!ALLOWED_TYPES.includes(fileType)) {
      return res.status(400).json({ error: "Format PP cuma boleh PNG, JPG, atau GIF" });
    }
    const key = `avatars/${Date.now()}-${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_AVATAR_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: fileType,
      })
    );

    const publicUrl = `${process.env.R2_AVATAR_PUBLIC_URL}/${key}`;

    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return res.status(500).json({ error: "Upload PP gagal", detail: err.message });
  }
}
