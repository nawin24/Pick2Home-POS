import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { saveImage, storageStatus } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Reports the active storage backend so the UI can show context to the user.
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  return NextResponse.json(storageStatus());
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const folder = String(form.get("folder") || "menu");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Field 'file' is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }
  const contentType = file.type || "application/octet-stream";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const out = await saveImage({ buffer, contentType, folder });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}
