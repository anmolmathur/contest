"use client";

import { useRef, useState } from "react";
import { Building2, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/uploads/client";
import { isLogoUrl, orderedLogos, type LogoOrder, type LogoSlot, type OrgLogo } from "@/lib/org-logo";
import { SectionCard, inputCls } from "./editor-ui";

/**
 * Logo of the organisation / institution / university hosting the contest.
 * Shown in the contest nav and on the landing hero. Saves immediately.
 */
export function OrganizationLogoCard({
  slot = "org",
  slug,
  contestId,
  logo,
  onChange,
  onError,
}: {
  /** "org" = host organisation / university; "parent" = parent company / brand. */
  slot?: LogoSlot;
  slug: string;
  contestId: string;
  logo: OrgLogo | null;
  onChange: (logo: OrgLogo | null) => void;
  onError: (msg: string) => void;
}) {
  const parent = slot === "parent";
  const api = `/api/c/${slug}/org-logo?slot=${slot}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(logo?.name ?? "");
  const [url, setUrl] = useState(logo?.url ?? "");
  const [busy, setBusy] = useState<"" | "upload" | "save" | "remove">("");

  const save = async (nextUrl: string, nextName: string) => {
    setBusy("save");
    try {
      const res = await fetch(api, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nextUrl, name: nextName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return onError(data.error || "Failed to save logo");
      setUrl(data.logo.url);
      onChange(data.logo);
    } catch {
      onError("Failed to save logo");
    } finally {
      setBusy("");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onError("Choose an image file (PNG, SVG, JPG or WebP)");
    setBusy("upload");
    try {
      const { publicUrl } = await uploadFile({ file, kind: "certificate_logo", contestId });
      await save(publicUrl, name);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      const res = await fetch(api, { method: "DELETE" });
      if (!res.ok) return onError("Failed to remove logo");
      setUrl("");
      onChange(null);
    } catch {
      onError("Failed to remove logo");
    } finally {
      setBusy("");
    }
  };

  const previewUrl = isLogoUrl(url) ? url.trim() : "";

  return (
    <SectionCard
      title={parent ? "Parent Company Logo" : "Organisation Logo"}
      description={
        parent
          ? "Logo of the parent company or brand behind this contest, e.g. TeamLease or Digivarsity. Shown in the top bar and on the landing page; set the order in Logo Order below."
          : "Logo of the organisation, institution or university hosting this contest. Shown in the top bar and on the landing page."
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 sm:w-48">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={name || (parent ? "Parent company logo" : "Organisation logo")} className="max-h-20 max-w-[85%] object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-500">
              <Building2 size={28} />
              <span className="text-xs">{parent ? "Parent logo placeholder" : "Logo placeholder"}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <Label className="text-xs text-gray-300">{parent ? "Parent company name" : "Organisation name"}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={parent ? "e.g. TeamLease EdTech or Digivarsity" : "e.g. Jain University"}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-300">Logo image URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… or upload a file below"
              className={inputCls}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              {busy === "upload" ? <Loader2 size={14} className="mr-2 animate-spin" /> : <ImagePlus size={14} className="mr-2" />}
              Upload logo
            </Button>
            <Button
              type="button"
              disabled={!!busy || !previewUrl}
              onClick={() => save(url.trim(), name)}
            >
              {busy === "save" && <Loader2 size={14} className="mr-2 animate-spin" />}
              Save
            </Button>
            {logo && (
              <Button type="button" variant="outline" disabled={!!busy} onClick={remove}>
                <Trash2 size={14} className="mr-2" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">Use a transparent PNG or SVG, max 5 MB. It is shown at about 28 px tall in the top bar.</p>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * Choose which logo comes first (left-most) in the contest nav and hero.
 * Saves immediately; a preview shows the current order.
 */
export function LogoOrderCard({
  slug,
  order,
  parent,
  org,
  onChange,
  onError,
}: {
  slug: string;
  order: LogoOrder;
  parent: OrgLogo | null;
  org: OrgLogo | null;
  onChange: (order: LogoOrder) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const set = async (next: LogoOrder) => {
    if (next === order || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${slug}/org-logo`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the logo order");
      onChange(next);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save the logo order");
    } finally {
      setBusy(false);
    }
  };
  const shown = orderedLogos(parent, org, order);
  const opts: Array<{ value: LogoOrder; label: string }> = [
    { value: "parent-first", label: "Parent company first" },
    { value: "org-first", label: "Organisation first" },
  ];
  return (
    <SectionCard title="Logo Order" description="Which logo appears first (left-most) in the contest header and on the landing page.">
      <div className="flex flex-wrap items-center gap-2">
        {opts.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={order === o.value ? "default" : "outline"}
            disabled={busy}
            onClick={() => set(o.value)}
          >
            {o.label}
          </Button>
        ))}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {shown.length
          ? `Currently shown: ${shown.map((x) => (x.slot === "parent" ? "Parent company" : "Organisation")).join(" → ")}`
          : "Upload a logo above to see the order take effect."}
      </p>
    </SectionCard>
  );
}
