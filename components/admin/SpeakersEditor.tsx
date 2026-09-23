"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Speaker, SpeakerRole } from "@/lib/contest-config";
import { uploadFile } from "@/lib/uploads/client";
import { ChipMultiSelect, RowShell, SectionCard, inputCls, moveItem, newId, outlineBtnCls } from "./editor-ui";

export const SPEAKER_ROLE_LABELS: Record<SpeakerRole, string> = {
  speaker: "Speaker",
  panelist: "Panelist",
  jury: "Jury",
  mentor: "Mentor",
  host: "Host",
};

function PhotoField({
  value,
  onChange,
  contestId,
}: {
  value: string;
  onChange: (url: string) => void;
  contestId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image must be under 5 MB");
      return;
    }
    setBusy(true);
    try {
      const { publicUrl } = await uploadFile({ file, kind: "speaker_photo", contestId: contestId ?? null });
      onChange(publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="text-gray-600" size={28} />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
          className={inputCls}
        />
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={outlineBtnCls}
          >
            {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
            Upload photo
          </Button>
          {err && <span className="text-xs text-red-400">{err}</span>}
        </div>
      </div>
    </div>
  );
}

/** Edits `contests.speakers` — keynote speakers, panelists, jury and mentor bios. */
export function SpeakersEditor({
  value,
  onChange,
  contestId,
}: {
  value: Speaker[];
  onChange: (next: Speaker[]) => void;
  contestId?: string;
}) {
  const update = (i: number, patch: Partial<Speaker>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <SectionCard
      title="Speakers & Jury"
      description="People shown on the public agenda and speakers page. Link them to agenda sessions below."
      action={
        <Button
          type="button"
          variant="outline"
          className={outlineBtnCls}
          onClick={() => onChange([...value, { id: newId(), name: "", roles: ["speaker"] }])}
        >
          <Plus className="mr-2" size={16} />
          Add Person
        </Button>
      }
    >
      {value.length === 0 && <p className="text-sm text-gray-500">No speakers yet.</p>}
      <div className="space-y-3">
        {value.map((s, i) => (
          <RowShell
            key={s.id}
            index={i}
            count={value.length}
            onMove={(d) => onChange(moveItem(value, i, d))}
            onRemove={() => onChange(value.filter((_, idx) => idx !== i))}
            heading={s.name || `Person #${i + 1}`}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs text-gray-300">Name</Label>
                <Input value={s.name} onChange={(e) => update(i, { name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label className="text-xs text-gray-300">Title</Label>
                <Input
                  value={s.title ?? ""}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Chief Strategy Officer"
                  className={inputCls}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-300">Organisation</Label>
                <Input value={s.org ?? ""} onChange={(e) => update(i, { org: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-3">
                <Label className="mb-1.5 block text-xs text-gray-300">Roles</Label>
                <ChipMultiSelect
                  options={(Object.keys(SPEAKER_ROLE_LABELS) as SpeakerRole[]).map((r) => ({ value: r, label: SPEAKER_ROLE_LABELS[r] }))}
                  value={s.roles ?? []}
                  onChange={(roles) => update(i, { roles })}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-300">Bio</Label>
                <Textarea
                  value={s.bio ?? ""}
                  onChange={(e) => update(i, { bio: e.target.value })}
                  className={`${inputCls} min-h-[96px]`}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-300">Photo</Label>
                <PhotoField value={s.photoUrl ?? ""} onChange={(photoUrl) => update(i, { photoUrl })} contestId={contestId} />
              </div>
            </div>
          </RowShell>
        ))}
      </div>
    </SectionCard>
  );
}
