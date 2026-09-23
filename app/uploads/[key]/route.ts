import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadsDir, safeKey, contentTypeFor } from "@/lib/uploads/local-dir";

export const runtime = "nodejs";

/** Serves files stored by the local upload driver (keys are random + unguessable). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const k = safeKey(decodeURIComponent(key));
  if (!k) return new NextResponse("Not found", { status: 404 });
  const dir = uploadsDir();
  const filePath = path.join(dir, k);
  if (!filePath.startsWith(path.resolve(dir))) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(filePath);
    const type = contentTypeFor(k);
    const inline = /^(image\/|application\/pdf|video\/)/.test(type) && type !== "image/svg+xml";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": type,
        "content-length": String(buf.length),
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${k.split("_").slice(-1)[0]}"`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
