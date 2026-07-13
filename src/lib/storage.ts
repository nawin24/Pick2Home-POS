// Storage adapter. Uses Firebase Storage when wired up, else writes to the
// project's `public/uploads/` directory so uploads work out-of-the-box.
//
// Public URL shapes:
//   Firebase: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=…
//   Local:    /uploads/<folder>/<file>      (served by Next as a static asset)

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getBucket, isFirebaseConfigured } from "./firebase";

export type Backend = "firebase" | "local";

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function activeBackend(): Backend {
  return isFirebaseConfigured() ? "firebase" : "local";
}

export function storageStatus() {
  const backend = activeBackend();
  return {
    enabled: true,                                    // upload UI is always on now
    backend,
    bucket: backend === "firebase" ? process.env.FIREBASE_STORAGE_BUCKET ?? null : null,
    localPath: backend === "local" ? "public/uploads" : null,
  };
}

export async function saveImage(opts: {
  buffer: Buffer;
  contentType: string;
  folder: string;
}): Promise<{ url: string; path: string; backend: Backend }> {
  const { buffer, contentType, folder } = opts;
  if (!ALLOWED.has(contentType)) throw new Error("Unsupported image type");

  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "") || "misc";
  const ext = contentType.split("/")[1] || "bin";
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const relPath = `${safeFolder}/${filename}`;

  if (activeBackend() === "firebase") {
    const bucket = getBucket();
    if (!bucket) throw new Error("Firebase bucket unavailable");
    const token = randomUUID();
    await bucket.file(relPath).save(buffer, {
      contentType,
      resumable: false,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(relPath)}?alt=media&token=${token}`;
    return { url, path: relPath, backend: "firebase" };
  }

  // Local fallback — write to public/uploads/<folder>/<file> and return the
  // public path. Next.js serves /public at the site root.
  const fullDir = path.join(LOCAL_ROOT, safeFolder);
  await mkdir(fullDir, { recursive: true });
  await writeFile(path.join(fullDir, filename), buffer);
  return { url: `/uploads/${relPath}`, path: relPath, backend: "local" };
}
