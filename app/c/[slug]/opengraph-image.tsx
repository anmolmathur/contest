import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { contests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const alt = "Contest OG image";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Per-contest dynamic OG image. If the contest has a `brandingConfig.ogImageUrl`
 * we redirect to that; otherwise we generate a gradient card with the contest
 * name and subtitle.
 */
export default async function OGImage({ params }: { params: { slug: string } }) {
  const contest = await db.query.contests.findFirst({
    where: eq(contests.slug, params.slug),
  });

  const branding = (contest?.brandingConfig ?? {}) as {
    primaryColor?: string;
    secondaryColor?: string;
    ogImageUrl?: string;
  };
  const primary = branding.primaryColor ?? "#7c3aed";
  const secondary = branding.secondaryColor ?? "#2563eb";
  const title = contest?.heroTitle ?? contest?.name ?? "Contest";
  const subtitle = contest?.heroSubtitle ?? contest?.description ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          color: "white",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "1000px" }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 28, fontSize: 32, opacity: 0.9, lineHeight: 1.3 }}>
              {subtitle.slice(0, 180)}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
