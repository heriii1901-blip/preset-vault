import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const batchSize = parseInt(req.query.limit) || 10;

  try {
    // Ambil preset yang preview_video_url-nya MASIH link Supabase (belum dimigrasi)
    const { data: presets, error } = await supabase
      .from("presets")
      .select("id, preview_video_url")
      .like("preview_video_url", "%supabase.co%")
      .limit(batchSize);

    if (error) throw error;

    if (!presets || presets.length === 0) {
      return res.status(200).json({ done: true, message: "Semua preset udah kemigrasi!" });
    }

    const results = [];

    for (const preset of presets) {
      try {
        const videoRes = await fetch(preset.preview_video_url);
        if (!videoRes.ok) throw new Error(`Gagal download: ${videoRes.status}`);

        const arrayBuffer = await videoRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const originalName = preset.preview_video_url.split("/").pop();
        const key = `presets/migrated-${Date.now()}-${originalName}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: videoRes.headers.get("content-type") || "video/mp4",
          })
        );

        const newUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        const { error: updateErr } = await supabase
          .from("presets")
          .update({ preview_video_url: newUrl })
          .eq("id", preset.id);

        if (updateErr) throw updateErr;

        results.push({ id: preset.id, status: "success", newUrl });
      } catch (err) {
        results.push({ id: preset.id, status: "failed", error: err.message });
      }
    }

    return res.status(200).json({
      done: false,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("Migration error:", err);
    return res.status(500).json({ error: "Migration failed", detail: err.message });
  }
}
