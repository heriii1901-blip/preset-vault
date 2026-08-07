import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
  // proteksi: cuma bisa dipanggil kalau tau secretnya
  if (req.query.secret !== process.env.CLEANUP_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const dryRun = req.query.dryRun !== "false"; // default: cuma preview, gak beneran hapus

  try {
    // 1. Ambil semua key yang MASIH dipake dari DB
    const { data: presets, error } = await supabase
      .from("presets")
      .select("preview_video_url")
      .not("preview_video_url", "is", null);
    if (error) throw error;

    const activeKeys = new Set(
      presets
        .map((p) => p.preview_video_url)
        .filter((url) => url && url.includes(process.env.R2_BUCKET_NAME + "") || true)
        .map((url) => url.split("/").slice(3).join("/")) // ambil key setelah domain
    );

    // 2. List semua file yang ada di bucket R2
    let allObjects = [];
    let continuationToken;
    do {
      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME,
          ContinuationToken: continuationToken,
        })
      );
      allObjects = allObjects.concat(listRes.Contents || []);
      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    // 3. Cari yang orphan (ada di bucket, tapi gak ada di DB)
    const orphans = allObjects.filter((obj) => !activeKeys.has(obj.Key));

    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        totalFiles: allObjects.length,
        activeInDb: activeKeys.size,
        orphanCount: orphans.length,
        orphanKeys: orphans.map((o) => o.Key),
      });
    }

    // 4. Beneran hapus (cuma jalan kalau dryRun=false)
    const deleted = [];
    for (const obj of orphans) {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: obj.Key }));
      deleted.push(obj.Key);
    }

    return res.status(200).json({ dryRun: false, deletedCount: deleted.length, deleted });
  } catch (err) {
    console.error("Cleanup error:", err);
    return res.status(500).json({ error: "Cleanup failed", detail: err.message });
  }
}
