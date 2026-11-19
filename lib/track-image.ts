/** Validate a track cover image URL from a request body. "" / null clears it. */
export function parseTrackImageUrl(raw: unknown): { value?: string | null; error?: string } {
  if (raw === undefined) return {};
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: "Image URL must be text" };
  const v = raw.trim();
  if (!v) return { value: null };
  if (v.length > 500) return { error: "Image URL is too long (max 500 characters)" };
  if (!/^(https?:\/\/|\/(?!\/))/i.test(v)) return { error: "Image URL must start with https:// or /" };
  return { value: v };
}
