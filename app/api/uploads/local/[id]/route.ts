import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Dev-only upload receiver.
 *
 * The S3 driver uses a presigned PUT to S3 directly. The mock driver
 * points clients at this endpoint instead, which writes the file to
 * `public/uploads/` so Next.js can serve it statically.
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
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, safeKey);

  const buf = Buffer.from(await req.arrayBuffer());
  await fs.writeFile(filePath, buf);

  return NextResponse.json({ ok: true, url: `/uploads/${safeKey}`, sizeBytes: buf.length });
}
