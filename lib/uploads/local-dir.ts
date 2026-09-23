import path from "node:path";

/**
 * Where the local (non-S3) upload driver keeps files. In Docker this should
 * be a mounted volume (UPLOADS_DIR=/app/uploads) so files survive redeploys.
 * Files are served by app/uploads/[key]/route.ts — not from public/, because
 * Next.js production servers don't serve files added to public/ after build.
 */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

export function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
}

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}
