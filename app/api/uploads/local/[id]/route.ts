import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadsDir, safeKey as sanitizeKey } from "@/lib/uploads/local-dir";

/**
 * Dev-only upload receiver.
 *
 * The S3 driver uses a presigned PUT to S3 directly. The mock driver
 * points clients at this endpoint instead, which writes the file to
 * UPLOADS_DIR (see lib/uploads/local-dir.ts); app/uploads/[key] serves it.
 */
export async function PUT(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key query required" }, { status: 400 });
  // Sanitize: no absolute paths, no traversal
  const safeKey = sanitizeKey(key);

  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, safeKey);

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  await fs.writeFile(filePath, buf);

  return NextResponse.json({ ok: true, url: `/uploads/${safeKey}`, sizeBytes: buf.length });
}
