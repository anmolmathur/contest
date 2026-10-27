import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadsDir, safeKey, contentTypeFor } from "@/lib/uploads/local-dir";
import { isS3Mode, signedGetUrl } from "@/lib/uploads/storage";

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
    const buf = await fs.readFile(filePath); // legacy local files win; falls through to S3 below
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
    if (isS3Mode()) {
      const type = contentTypeFor(k);
      const inline = /^(image\/|application\/pdf|video\/)/.test(type) && type !== "image/svg+xml";
      const name = k.split("_").slice(-1)[0];
      try {
        const url = await signedGetUrl(k, {
          contentType: type,
          disposition: `${inline ? "inline" : "attachment"}; filename="${name}"`,
        });
        return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, max-age=300" } });
      } catch (e) {
        console.error("[uploads] signing failed", e);
      }
    }
    return new NextResponse("Not found", { status: 404 });
  }
}
