/**
 * Storage driver. Two modes:
 *
 *   S3 mode (production): presigned PUTs to AWS S3.
 *     AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *     AWS_S3_PUBLIC_URL (optional, for CloudFront).
 *
 *   Mock mode (local dev): uploads go straight to a local endpoint
 *     `/api/uploads/local/[id]` which writes the file to `uploads/` in the
 *     repo. The returned URL points at `/uploads/<filename>` served as static.
 *     Triggered when AWS_S3_BUCKET is unset OR UPLOAD_DRIVER=mock.
 *
 * Call `presignUpload({ ownerUserId, kind, mimeType, filename, sizeBytes })`
 * to get a `{ uploadUrl, method, headers, publicUrl, objectKey }` tuple.
 */

import crypto from "node:crypto";

export type PresignInput = {
  ownerUserId: string;
  contestId?: string | null;
  teamId?: string | null;
  kind: string; // 'pitch_video' | 'pitch_image' | 'banner' | ...
  mimeType: string;
  filename: string;
  sizeBytes: number;
};

export type PresignResult = {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  publicUrl: string;
  bucket: string | null;
  objectKey: string;
  driver: "s3" | "mock";
};

const MAX_BY_KIND: Record<string, number> = {
  pitch_video: 500 * 1024 * 1024, // 500 MB
  pitch_image: 25 * 1024 * 1024,  // 25 MB
  banner: 10 * 1024 * 1024,
  certificate_logo: 5 * 1024 * 1024,
  submission_screenshot: 10 * 1024 * 1024,
};

function assertAllowed(input: PresignInput): void {
  const max = MAX_BY_KIND[input.kind] ?? 10 * 1024 * 1024;
  if (input.sizeBytes > max) {
    throw new Error(`File too large for kind=${input.kind} (max ${max} bytes)`);
  }
  const allowed: Record<string, RegExp> = {
    pitch_video: /^video\//,
    pitch_image: /^image\//,
    banner: /^image\//,
    certificate_logo: /^image\//,
    submission_screenshot: /^image\//,
  };
  const pattern = allowed[input.kind];
  if (pattern && !pattern.test(input.mimeType)) {
    throw new Error(`MIME type ${input.mimeType} not allowed for kind ${input.kind}`);
  }
}

function isMock(): boolean {
  return !process.env.AWS_S3_BUCKET || process.env.UPLOAD_DRIVER === "mock";
}

function keyFor(input: PresignInput): string {
  const ext = input.filename.includes(".") ? input.filename.split(".").pop() : "bin";
  const rand = crypto.randomBytes(8).toString("hex");
  const date = new Date().toISOString().slice(0, 10);
  return `${input.kind}/${date}/${input.ownerUserId}/${rand}.${ext}`;
}

export async function presignUpload(input: PresignInput): Promise<PresignResult> {
  assertAllowed(input);
  const objectKey = keyFor(input);

  if (isMock()) {
    const id = crypto.randomBytes(12).toString("hex");
    const safeFilename = objectKey.replace(/\//g, "_");
    return {
      uploadUrl: `/api/uploads/local/${id}?key=${encodeURIComponent(safeFilename)}`,
      method: "PUT",
      headers: { "content-type": input.mimeType },
      publicUrl: `/uploads/${safeFilename}`,
      bucket: null,
      objectKey: safeFilename,
      driver: "mock",
    };
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_S3_REGION ?? "us-east-1";
  const client = new S3Client({ region });
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: input.mimeType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const cdnBase = process.env.AWS_S3_PUBLIC_URL ??
    `https://${bucket}.s3.${region}.amazonaws.com`;

  return {
    uploadUrl,
    method: "PUT",
    headers: { "content-type": input.mimeType },
    publicUrl: `${cdnBase}/${objectKey}`,
    bucket,
    objectKey,
    driver: "s3",
  };
}
