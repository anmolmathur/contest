/**
 * Client-side uploader. Two-step: (1) ask `/api/uploads/presign` for a signed
 * URL, (2) PUT the file to that URL. Works against both S3 and the local mock
 * driver transparently.
 */
export async function uploadFile(opts: {
  file: File;
  kind: string;
  contestId?: string | null;
  teamId?: string | null;
}): Promise<{ assetId: string; publicUrl: string }> {
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: opts.kind,
      mimeType: opts.file.type,
      filename: opts.file.name,
      sizeBytes: opts.file.size,
      contestId: opts.contestId ?? null,
      teamId: opts.teamId ?? null,
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({ error: "Presign failed" }));
    throw new Error(err.error ?? "Presign failed");
  }
  const presign = (await presignRes.json()) as {
    assetId: string;
    uploadUrl: string;
    method: "PUT" | "POST";
    headers: Record<string, string>;
    publicUrl: string;
    driver: "s3" | "mock";
  };

  const uploadRes = await fetch(presign.uploadUrl, {
    method: presign.method,
    headers: presign.headers,
    body: opts.file,
  });
  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text().catch(() => "")}`);
  }

  return { assetId: presign.assetId, publicUrl: presign.publicUrl };
}
