"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Copy, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard, inputCls } from "./editor-ui";

/**
 * Custom domain status. Contest admins see it read-only; platform admins can
 * set / force-verify / remove it through /api/platform/contests/[slug]/domain.
 */
export function CustomDomainCard({
  slug,
  domain,
  verifiedAt,
  isPlatformAdmin,
  onChanged,
}: {
  slug: string;
  domain: string | null;
  verifiedAt: string | null;
  isPlatformAdmin: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState(domain ?? "");
  const [busy, setBusy] = useState<"" | "save" | "verify" | "remove">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cname, setCname] = useState("");
  const [lastDomain, setLastDomain] = useState(domain);

  // Keep the input in sync when the saved domain changes (e.g. after a refetch).
  if (domain !== lastDomain) {
    setLastDomain(domain);
    setDraft(domain ?? "");
  }

  const platformHost = cname || (typeof window !== "undefined" ? window.location.host : "");
  const shownDomain = domain || draft.trim().toLowerCase() || "your-domain.com";

  const call = async (kind: "save" | "verify" | "remove") => {
    setMsg(null);
    if (kind === "save") {
      const clean = draft.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
        setMsg({ ok: false, text: "Enter a valid hostname like events.example.com" });
        return;
      }
    }
    if (kind === "remove" && !confirm(`Remove ${domain} from this contest?`)) return;
    setBusy(kind);
    try {
      const res = await fetch(`/api/platform/contests/${slug}/domain`, {
        method: kind === "save" ? "POST" : kind === "verify" ? "PATCH" : "DELETE",
        headers: kind === "save" ? { "Content-Type": "application/json" } : undefined,
        body: kind === "save" ? JSON.stringify({ domain: draft.trim().toLowerCase() }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Request failed" });
        return;
      }
      if (kind === "save" && data.instructions?.cname) setCname(data.instructions.cname);
      setMsg({
        ok: true,
        text:
          kind === "save"
            ? "Domain saved — pending verification. Follow the DNS steps below."
            : kind === "verify"
              ? "Domain marked as verified."
              : "Domain removed.",
      });
      onChanged();
    } catch {
      setMsg({ ok: false, text: "Request failed" });
    } finally {
      setBusy("");
    }
  };

  const status = domain ? (
    verifiedAt ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
        <CheckCircle2 size={12} /> Verified
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
        <Clock size={12} /> Pending verification
      </span>
    )
  ) : null;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Globe size={18} /> Custom Domain {status}
        </span>
      }
      description={
        isPlatformAdmin
          ? "Serve this contest as a white-labelled site on its own domain."
          : "Custom domains are managed by platform administrators."
      }
    >
      {!isPlatformAdmin ? (
        domain ? (
          <p className="text-sm text-gray-300">
            <a href={`https://${domain}/`} target="_blank" rel="noopener noreferrer" className="font-mono text-electric-blue hover:underline">
              {domain}
            </a>
            {!verifiedAt && <span className="ml-2 text-gray-500">— waiting for DNS verification.</span>}
          </p>
        ) : (
          <p className="text-sm text-gray-500">No custom domain. The contest is available at /c/{slug}.</p>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="events.example.com"
              className={`${inputCls} font-mono`}
            />
            <Button
              type="button"
              onClick={() => call("save")}
              disabled={!!busy || !draft.trim() || draft.trim().toLowerCase() === (domain ?? "")}
              className="bg-gradient-to-r from-neon-purple to-electric-blue"
            >
              {busy === "save" && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {domain ? "Change" : "Set domain"}
            </Button>
          </div>
          {domain && (
            <div className="flex flex-wrap gap-2">
              {!verifiedAt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => call("verify")}
                  disabled={!!busy}
                  className="border-yellow-500/30 bg-transparent text-yellow-400 hover:bg-yellow-500/10"
                >
                  {busy === "verify" && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                  Force-mark as verified
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => call("remove")}
                disabled={!!busy}
                className="border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
              >
                {busy === "remove" && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Remove domain
              </Button>
            </div>
          )}
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-400">
            <li>
              At the DNS provider for <span className="font-mono text-gray-300">{shownDomain}</span>, add a{" "}
              <span className="font-semibold text-gray-300">CNAME</span> record pointing to{" "}
              <span className="inline-flex items-center gap-1 font-mono text-gray-300">
                {platformHost || "the platform host"}
                {platformHost && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(platformHost).catch(() => {})}
                    className="text-gray-500 hover:text-white"
                    aria-label="Copy host"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </span>
              .
            </li>
            <li>
              Once DNS has propagated, open{" "}
              <a
                href={`https://${shownDomain}/.well-known/contest-verify`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-electric-blue hover:underline"
              >
                https://{shownDomain}/.well-known/contest-verify
              </a>{" "}
              to verify it.
            </li>
            <li>If you have verified DNS by other means, use “Force-mark as verified”.</li>
          </ol>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}
    </SectionCard>
  );
}
