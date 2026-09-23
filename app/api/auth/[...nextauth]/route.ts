import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

/**
 * Behind a proxy (Cloudflare tunnel, ALB) the standalone server sees its own
 * bind address (e.g. http://0.0.0.0:3000) as the request URL, and Auth.js
 * would build OAuth callback URLs from it. We don't set AUTH_URL because each
 * contest may run on its own domain, so rebuild the URL from the host the
 * request actually arrived on.
 */
async function withPublicUrl(req: NextRequest): Promise<NextRequest> {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))?.split(",")[0].trim();
  if (!host) return req;
  const current = new URL(req.url);
  const proto = (req.headers.get("x-forwarded-proto") ?? current.protocol.replace(":", "")).split(",")[0].trim();
  const publicUrl = new URL(`${current.pathname}${current.search}`, `${proto}://${host}`);
  if (publicUrl.href === current.href) return req;
  // Auth request bodies are small form posts; copy them explicitly (passing the
  // original Request as init would need `duplex: "half"` for its stream body).
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  return new NextRequest(publicUrl, { method: req.method, headers: req.headers, body });
}

export const GET = async (req: NextRequest) => handlers.GET(await withPublicUrl(req));
export const POST = async (req: NextRequest) => handlers.POST(await withPublicUrl(req));
