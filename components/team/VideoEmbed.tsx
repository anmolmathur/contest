"use client";

/**
 * Responsive 16:9 player for a walkthrough video. Accepts Vimeo and YouTube
 * page or player URLs, or a direct video file (.mp4/.webm). Anything else is
 * shown as a plain link so a mistyped URL never breaks the dialog.
 */
export function toEmbedUrl(raw: string): { kind: "iframe" | "video" | "link"; src: string } {
  const url = raw.trim();
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: "link", src: url };
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "player.vimeo.com") return { kind: "iframe", src: url };
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
    if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname.startsWith("/embed/")) return { kind: "iframe", src: url };
    const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) return { kind: "video", src: url };
  return { kind: "link", src: url };
}

export default function VideoEmbed({ url, title }: { url: string; title: string }) {
  const embed = toEmbedUrl(url);
  if (embed.kind === "link") {
    return (
      <a href={embed.src} target="_blank" rel="noreferrer" className="text-sm text-electric-blue underline">
        Watch: {title}
      </a>
    );
  }
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black" style={{ paddingTop: "56.25%" }}>
      {embed.kind === "iframe" ? (
        <iframe
          src={embed.src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <video src={embed.src} title={title} controls preload="metadata" className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
