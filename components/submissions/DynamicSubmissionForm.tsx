"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Link2, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import type { SubmissionField, SubmissionValues } from "@/lib/contest-config";
import { fieldsForPhase, isFieldRequired } from "@/lib/submission-fields";
import { AgentCharterEditor } from "./AgentCharterEditor";
import { uploadFile } from "@/lib/uploads/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Browsers sometimes report an empty/generic MIME (e.g. .pptx on Windows) — infer from the extension. */
function withInferredMime(file: File): File {
  const inferred = MIME_BY_EXT[extOf(file.name)];
  if (inferred && (!file.type || file.type === "application/octet-stream")) {
    return new File([file], file.name, { type: inferred, lastModified: file.lastModified });
  }
  return file;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true;
  const ext = `.${extOf(file.name)}`;
  return accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((a) => {
      if (a.startsWith(".")) return a === ext;
      if (a.endsWith("/*")) return file.type.toLowerCase().startsWith(a.slice(0, -1));
      return a === file.type.toLowerCase();
    });
}

function acceptHint(accept?: string): string {
  if (!accept) return "";
  return accept
    .split(",")
    .map((a) => a.trim().replace(/^\./, "").toUpperCase())
    .filter(Boolean)
    .join(", ");
}

function isLink(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s) || s.startsWith("/uploads/") || s.startsWith("/api/uploads/");
}

function fallbackName(url: string): string {
  const last = decodeURIComponent(url.split("?")[0].split("/").pop() ?? url);
  // Our upload keys are random (`<hex>.pdf`) — show the type instead of gibberish.
  if (/^[0-9a-f]{12,}\.[a-z0-9]+$/i.test(last)) return `${extOf(last).toUpperCase()} file`;
  return last || url;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-gray-500";
const ghostBtnCls = "border-white/20 text-white bg-white/10 hover:bg-white/20";

export function DynamicSubmissionForm({
  fields,
  phase,
  values,
  onChange,
  contestId,
  teamId,
  disabled = false,
  solutionPaths,
}: {
  fields: SubmissionField[];
  phase: number;
  values: SubmissionValues;
  onChange: (values: SubmissionValues) => void;
  contestId: string;
  teamId: string;
  disabled?: boolean;
  /** Team's declared solution paths (Ideathon) — make path-specific fields required. */
  solutionPaths?: string[] | null;
}) {
  const defs = fieldsForPhase(fields, phase);
  const declared = values["solutionPaths"];
  const paths = Array.isArray(declared) ? declared : solutionPaths ?? null;

  // Latest values, so async uploads never overwrite edits made meanwhile.
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});

  const setValue = (key: string, v: string | string[] | undefined) => {
    const next: SubmissionValues = { ...valuesRef.current };
    const empty = v === undefined || (Array.isArray(v) ? v.length === 0 : v === "");
    if (empty) delete next[key];
    else next[key] = v as string | string[];
    valuesRef.current = next;
    onChange(next);
  };

  const setError = (key: string, msg: string | null) =>
    setErrors((prev) => {
      const n = { ...prev };
      if (msg) n[key] = msg;
      else delete n[key];
      return n;
    });

  const bump = (key: string, delta: number) =>
    setUploading((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) }));

  const displayName = (url: string) => names[url] ?? fallbackName(url);

  /** Validate + upload one file for a field; returns the public URL or null on error. */
  const uploadOne = async (f: SubmissionField, raw: File): Promise<string | null> => {
    const file = withInferredMime(raw);
    if (!matchesAccept(file, f.accept)) {
      setError(f.key, `"${file.name}" is not an accepted file type${f.accept ? ` (${acceptHint(f.accept)})` : ""}.`);
      return null;
    }
    const maxMb = f.maxSizeMb ?? (file.type.startsWith("image/") ? 10 : 25);
    if (file.size > maxMb * 1024 * 1024) {
      setError(f.key, `"${file.name}" is larger than ${maxMb} MB.`);
      return null;
    }
    if (!file.type) {
      setError(f.key, `Couldn't detect the type of "${file.name}". Try a PDF, Office or image file.`);
      return null;
    }
    const kind = file.type.startsWith("image/") && maxMb <= 10 ? "submission_screenshot" : "submission_file";
    bump(f.key, 1);
    try {
      const { publicUrl } = await uploadFile({ file, kind, contestId, teamId });
      setNames((prev) => ({ ...prev, [publicUrl]: file.name }));
      return publicUrl;
    } catch (e) {
      setError(f.key, e instanceof Error ? e.message : "Upload failed");
      return null;
    } finally {
      bump(f.key, -1);
    }
  };

  const handleSingleFile = async (f: SubmissionField, file: File | undefined) => {
    if (!file) return;
    setError(f.key, null);
    const url = await uploadOne(f, file);
    if (url) setValue(f.key, url);
  };

  const handleMultiFiles = async (f: SubmissionField, files: File[]) => {
    if (files.length === 0) return;
    setError(f.key, null);
    for (const file of files) {
      const url = await uploadOne(f, file);
      if (url) {
        const cur = valuesRef.current[f.key];
        const arr = Array.isArray(cur) ? cur : typeof cur === "string" && cur ? [cur] : [];
        setValue(f.key, [...arr, url]);
      }
    }
  };

  const addDraftLink = (f: SubmissionField, mode: "single" | "multi") => {
    const link = (drafts[f.key] ?? "").trim();
    if (!link) return;
    if (!isLink(link)) {
      setError(f.key, "Please paste a full link starting with https://");
      return;
    }
    setError(f.key, null);
    if (mode === "single") {
      setValue(f.key, link);
    } else {
      const cur = valuesRef.current[f.key];
      const arr = Array.isArray(cur) ? cur : typeof cur === "string" && cur ? [cur] : [];
      setValue(f.key, [...arr, link]);
    }
    setDrafts((prev) => ({ ...prev, [f.key]: "" }));
  };

  if (defs.length === 0) {
    return <p className="text-sm text-gray-400">Nothing to hand in at this stage.</p>;
  }

  return (
    <div className="space-y-5">
      {defs.map((f) => {
        const v = values[f.key];
        const str = typeof v === "string" ? v : Array.isArray(v) ? v.join("\n") : "";
        const arr = Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
        const busy = (uploading[f.key] ?? 0) > 0;
        const inputId = `sf-${f.key}`;

        return (
          <div key={f.key}>
            <Label htmlFor={inputId} className="text-gray-200">
              {f.label}
              {isFieldRequired(f, paths) && <span className="ml-0.5 text-hot-pink">*</span>}
              {!f.required && f.requiredForPaths?.length ? (
                <span className="ml-2 text-xs font-normal text-gray-400">for {f.requiredForPaths.join(" / ")}</span>
              ) : null}
            </Label>
            {f.helpText && <p className="mt-0.5 text-xs text-gray-400">{f.helpText}</p>}

            <div className="mt-1.5">
              {/* ---------- text / url ---------- */}
              {(f.type === "text" || f.type === "url") && (
                <Input
                  id={inputId}
                  type={f.type === "url" ? "url" : "text"}
                  value={str}
                  disabled={disabled}
                  placeholder={f.placeholder ?? (f.type === "url" ? "https://..." : undefined)}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  className={inputCls}
                />
              )}

              {/* ---------- number ---------- */}
              {f.type === "number" && (
                <Input
                  id={inputId}
                  type="number"
                  inputMode="decimal"
                  value={str}
                  min={f.min}
                  max={f.max}
                  disabled={disabled}
                  placeholder={f.placeholder}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  className={`${inputCls} max-w-xs`}
                />
              )}

              {/* ---------- multiselect ---------- */}
              {f.type === "multiselect" && (
                <div className="flex flex-wrap gap-2" id={inputId}>
                  {(f.options ?? []).map((opt) => {
                    const on = arr.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={disabled}
                        aria-pressed={on}
                        onClick={() => setValue(f.key, on ? arr.filter((x) => x !== opt) : [...arr, opt])}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          on ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100" : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ---------- agent charter ---------- */}
              {f.type === "agentCharter" && (
                <AgentCharterEditor value={v} disabled={disabled} onChange={(json) => setValue(f.key, json)} />
              )}

              {/* ---------- textarea ---------- */}
              {f.type === "textarea" && (
                <Textarea
                  id={inputId}
                  value={str}
                  disabled={disabled}
                  placeholder={f.placeholder}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  className={`${inputCls} min-h-[110px]`}
                />
              )}

              {/* ---------- select ---------- */}
              {f.type === "select" && (
                <Select value={str || undefined} onValueChange={(val) => setValue(f.key, val)} disabled={disabled}>
                  <SelectTrigger id={inputId} className={`${inputCls} w-full`}>
                    <SelectValue placeholder={f.placeholder ?? "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* ---------- urlList ---------- */}
              {f.type === "urlList" && (
                <div className="space-y-2">
                  {(arr.length > 0 ? arr : [""]).map((u, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        id={i === 0 ? inputId : undefined}
                        type="url"
                        value={u}
                        disabled={disabled}
                        placeholder={f.placeholder ?? "https://..."}
                        onChange={(e) => {
                          const next = arr.length > 0 ? [...arr] : [""];
                          next[i] = e.target.value;
                          setValue(f.key, next);
                        }}
                        className={inputCls}
                      />
                      {arr.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => setValue(f.key, arr.filter((_, j) => j !== i))}
                          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          aria-label="Remove link"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setValue(f.key, [...(arr.length > 0 ? arr : [""]), ""])}
                    className={ghostBtnCls}
                  >
                    <Plus className="mr-1.5" size={14} />
                    Add link
                  </Button>
                </div>
              )}

              {/* ---------- file (single) ---------- */}
              {f.type === "file" && (
                <div className="space-y-2">
                  {str ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                      <FileText size={16} className="shrink-0 text-electric-blue" />
                      <a
                        href={str}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-electric-blue hover:underline"
                        title={str}
                      >
                        {displayName(str)}
                      </a>
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${ghostBtnCls} ${
                          disabled || busy ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Replace
                        <input
                          type="file"
                          className="hidden"
                          accept={f.accept}
                          disabled={disabled || busy}
                          onChange={(e) => {
                            void handleSingleFile(f, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled || busy}
                        onClick={() => setValue(f.key, undefined)}
                        className="h-7 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        aria-label="Remove file"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <label
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-4 text-sm text-gray-300 transition hover:border-white/40 hover:bg-white/10 ${
                          disabled || busy ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {busy ? "Uploading..." : "Upload file"}
                        {f.accept && <span className="text-xs text-gray-500">({acceptHint(f.accept)})</span>}
                        {f.maxSizeMb && <span className="text-xs text-gray-500">max {f.maxSizeMb} MB</span>}
                        <input
                          id={inputId}
                          type="file"
                          className="hidden"
                          accept={f.accept}
                          disabled={disabled || busy}
                          onChange={(e) => {
                            void handleSingleFile(f, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <PasteLink
                        value={drafts[f.key] ?? ""}
                        disabled={disabled}
                        onChange={(val) => setDrafts((prev) => ({ ...prev, [f.key]: val }))}
                        onAdd={() => addDraftLink(f, "single")}
                        label="Use link"
                      />
                    </>
                  )}
                </div>
              )}

              {/* ---------- fileList ---------- */}
              {f.type === "fileList" && (
                <div className="space-y-2">
                  {arr.length > 0 && (
                    <ul className="space-y-1.5">
                      {arr.map((u, i) => (
                        <li
                          key={`${u}-${i}`}
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                          ) : (
                            <FileText size={16} className="shrink-0 text-electric-blue" />
                          )}
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-sm text-electric-blue hover:underline"
                            title={u}
                          >
                            {displayName(u)}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled || busy}
                            onClick={() => setValue(f.key, arr.filter((_, j) => j !== i))}
                            className="h-7 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            aria-label="Remove"
                          >
                            <X size={14} />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-gray-300 transition hover:border-white/40 hover:bg-white/10 ${
                      disabled || busy ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {busy ? "Uploading..." : arr.length > 0 ? "Upload more" : "Upload files"}
                    {f.accept && <span className="text-xs text-gray-500">({acceptHint(f.accept)})</span>}
                    {f.maxSizeMb && <span className="text-xs text-gray-500">max {f.maxSizeMb} MB each</span>}
                    <input
                      id={inputId}
                      type="file"
                      multiple
                      className="hidden"
                      accept={f.accept}
                      disabled={disabled || busy}
                      onChange={(e) => {
                        // Copy before resetting the input (FileList is live).
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        void handleMultiFiles(f, files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <PasteLink
                    value={drafts[f.key] ?? ""}
                    disabled={disabled}
                    onChange={(val) => setDrafts((prev) => ({ ...prev, [f.key]: val }))}
                    onAdd={() => addDraftLink(f, "multi")}
                    label="Add link"
                  />
                </div>
              )}
            </div>

            {errors[f.key] && <p className="mt-1 text-xs text-red-400">{errors[f.key]}</p>}
          </div>
        );
      })}
    </div>
  );
}

function PasteLink({
  value,
  onChange,
  onAdd,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Link2 size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <Input
          type="url"
          value={value}
          disabled={disabled}
          placeholder="...or paste a link (Drive, Dropbox, etc.)"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          className={`${inputCls} pl-8`}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !value.trim()}
        onClick={onAdd}
        className={`h-9 ${ghostBtnCls}`}
      >
        {label}
      </Button>
    </div>
  );
}

export default DynamicSubmissionForm;
