import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { presignUpload } from "@/lib/uploads/storage";
import { db } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";

const RATE_LIMIT = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // 20 uploads per minute per user

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMIT.get(userId);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(session.user.id)) {
    return NextResponse.json({ error: "Too many uploads, try again shortly" }, { status: 429 });
  }

  const body = await req.json();
  const { kind, mimeType, filename, sizeBytes, contestId, teamId } = body as {
    kind?: string;
    mimeType?: string;
    filename?: string;
    sizeBytes?: number;
    contestId?: string | null;
    teamId?: string | null;
  };
  if (!kind || !mimeType || !filename || !sizeBytes) {
    return NextResponse.json(
      { error: "kind, mimeType, filename, sizeBytes required" },
      { status: 400 }
    );
  }

  try {
    const presign = await presignUpload({
      ownerUserId: session.user.id,
      contestId: contestId ?? null,
      teamId: teamId ?? null,
      kind,
      mimeType,
      filename,
      sizeBytes,
    });

    // Record the pending asset. `url` is the eventual public URL — the client
    // confirms upload completion by POSTing to /api/uploads/commit.
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        ownerUserId: session.user.id,
        contestId: contestId ?? null,
        teamId: teamId ?? null,
        kind,
        bucket: presign.bucket ?? null,
        objectKey: presign.objectKey,
        url: presign.publicUrl,
        mimeType,
        sizeBytes,
      })
      .returning();

    return NextResponse.json({
      assetId: asset.id,
      uploadUrl: presign.uploadUrl,
      method: presign.method,
      headers: presign.headers,
      publicUrl: presign.publicUrl,
      driver: presign.driver,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Presign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
