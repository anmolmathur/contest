"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SubmissionField, SubmissionFieldType } from "@/lib/contest-config";
import { ChipMultiSelect, RowShell, SectionCard, inputCls, moveItem, outlineBtnCls, slugKey } from "./editor-ui";

const TYPE_LABELS: Record<SubmissionFieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  url: "Link (URL)",
  urlList: "Multiple links",
  file: "File upload",
  fileList: "Multiple files",
  select: "Dropdown",
};

export interface PhaseOption {
  phase: number;
  name: string;
}

/**
 * Edits `contests.submissionFields`: what teams hand in, per round.
 * New rows auto-derive their key from the label until the key is edited.
 */
export function SubmissionFieldsEditor({
  value,
  onChange,
  phases,
  phaseTerm = "Phase",
  submissionTerm = "Submission",
}: {
  value: SubmissionField[];
  onChange: (next: SubmissionField[]) => void;
  /** Scorable phases the field can be restricted to. */
  phases: PhaseOption[];
  phaseTerm?: string;
  submissionTerm?: string;
}) {
  // Indices of rows whose key should keep following the label (new rows until the key is touched).
  const [autoKey, setAutoKey] = useState<Set<number>>(new Set());

  const dupKeys = new Set(
    value.map((f) => f.key).filter((k, i, all) => k && all.indexOf(k) !== i),
  );

  const update = (i: number, patch: Partial<SubmissionField>) => {
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  const add = () => {
    setAutoKey(new Set(autoKey).add(value.length));
    onChange([...value, { key: "", label: "", type: "text", required: false }]);
  };

  const remove = (i: number) => {
    const next = new Set<number>();
    autoKey.forEach((k) => {
      if (k < i) next.add(k);
      else if (k > i) next.add(k - 1);
    });
    setAutoKey(next);
    onChange(value.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    const next = new Set<number>();
    autoKey.forEach((k) => next.add(k === i ? t : k === t ? i : k));
    setAutoKey(next);
    onChange(moveItem(value, i, dir));
  };

  return (
    <SectionCard
      title={`${submissionTerm} Fields`}
      description={`What teams submit in each ${phaseTerm.toLowerCase()}. Leave the ${phaseTerm.toLowerCase()} selection empty to ask for a field in every ${phaseTerm.toLowerCase()}.`}
      action={
        <Button type="button" onClick={add} variant="outline" className={outlineBtnCls}>
          <Plus className="mr-2" size={16} />
          Add Field
        </Button>
      }
    >
      {value.length === 0 && <p className="text-sm text-gray-500">No fields yet — teams would have nothing to submit.</p>}
      <div className="space-y-3">
        {value.map((f, i) => {
          const isFile = f.type === "file" || f.type === "fileList";
          const keyErr = !f.key.trim() ? "Key required" : dupKeys.has(f.key) ? "Duplicate key" : null;
          return (
            <RowShell
              key={i}
              index={i}
              count={value.length}
              onMove={(d) => move(i, d)}
              onRemove={() => remove(i)}
              heading={f.label || `Field #${i + 1}`}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs text-gray-300">Label</Label>
                  <Input
                    value={f.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      update(i, autoKey.has(i) ? { label, key: slugKey(label) } : { label });
                    }}
                    placeholder="Pitch Deck"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-300">Key</Label>
                  <Input
                    value={f.key}
                    onChange={(e) => {
                      const s = new Set(autoKey);
                      s.delete(i);
                      setAutoKey(s);
                      update(i, { key: e.target.value.replace(/\s+/g, "") });
                    }}
                    placeholder="pitchDeck"
                    className={`${inputCls} font-mono ${keyErr ? "border-red-500/60" : ""}`}
                  />
                  {keyErr && <p className="mt-1 text-xs text-red-400">{keyErr}</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-300">Type</Label>
                  <Select value={f.type} onValueChange={(v) => update(i, { type: v as SubmissionFieldType })}>
                    <SelectTrigger className={`${inputCls} w-full`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as SubmissionFieldType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-300">Placeholder</Label>
                  <Input
                    value={f.placeholder ?? ""}
                    onChange={(e) => update(i, { placeholder: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-300">Help text</Label>
                  <Input
                    value={f.helpText ?? ""}
                    onChange={(e) => update(i, { helpText: e.target.value })}
                    placeholder="Shown under the input"
                    className={inputCls}
                  />
                </div>
                {isFile && (
                  <>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-gray-300">Accepted file types</Label>
                      <Input
                        value={f.accept ?? ""}
                        onChange={(e) => update(i, { accept: e.target.value })}
                        placeholder=".pdf,.ppt,.pptx"
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-300">Max size (MB)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={f.maxSizeMb ?? ""}
                        onChange={(e) => update(i, { maxSizeMb: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined })}
                        placeholder="25"
                        className={inputCls}
                      />
                    </div>
                  </>
                )}
                {f.type === "select" && (
                  <div className="md:col-span-3">
                    <Label className="text-xs text-gray-300">Options (one per line)</Label>
                    <textarea
                      value={(f.options ?? []).join("\n")}
                      onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                      rows={3}
                      className={`${inputCls} w-full rounded-md border px-3 py-2`}
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block text-xs text-gray-300">
                    {phaseTerm}s {(!f.phases || f.phases.length === 0) && <span className="text-gray-500">(all)</span>}
                  </Label>
                  <ChipMultiSelect
                    options={phases.map((p) => ({ value: p.phase, label: `${p.phase}. ${p.name || `${phaseTerm} ${p.phase}`}` }))}
                    value={f.phases ?? []}
                    onChange={(next) => update(i, { phases: next })}
                    emptyLabel={`No scorable ${phaseTerm.toLowerCase()}s configured — the field applies everywhere.`}
                  />
                </div>
                <label className="flex items-center gap-2 self-end text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                    className="h-4 w-4 accent-[var(--neon-purple)]"
                  />
                  Required
                </label>
              </div>
            </RowShell>
          );
        })}
      </div>
    </SectionCard>
  );
}
