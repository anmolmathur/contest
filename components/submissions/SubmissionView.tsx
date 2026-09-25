"use client";

import { ExternalLink, FileText, Download } from "lucide-react";
import type { SubmissionField, SubmissionValues } from "@/lib/contest-config";
import { AUTONOMY_LEVELS } from "@/lib/contest-config";
import { fieldsForPhase, parseAgentCharter } from "@/lib/submission-fields";

function fileName(url: string): string {
  const last = url.split("?")[0].split("/").pop() ?? url;
  // local uploads look like "<kind>_<date>_<user>_<rand>.pdf" — show the extension nicely
  const ext = last.includes(".") ? last.split(".").pop()!.toUpperCase() : "FILE";
  return `${ext} file`;
}

function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}

function LinkValue({ url, asFile }: { url: string; asFile?: boolean }) {
  if (asFile && isImage(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-40 rounded-md border border-white/10 object-contain" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 break-all text-sm text-electric-blue hover:underline"
    >
      {asFile ? <FileText size={14} className="shrink-0" /> : <ExternalLink size={14} className="shrink-0" />}
      <span className="truncate">{asFile ? fileName(url) : url}</span>
      {asFile && <Download size={12} className="shrink-0 opacity-70" />}
    </a>
  );
}

/**
 * Read-only rendering of a submission's values against the contest's field
 * definitions. Pass `phase` to show only the fields for that round; values for
 * keys without a matching field definition are shown at the end (so legacy
 * data is never hidden).
 */
export function SubmissionView({
  fields,
  values,
  phase,
  compact = false,
}: {
  fields: SubmissionField[];
  values: SubmissionValues;
  phase?: number;
  compact?: boolean;
}) {
  const defs = phase !== undefined ? fieldsForPhase(fields, phase) : fields;
  const known = new Set(defs.map((f) => f.key));
  const extras = Object.keys(values).filter((k) => !known.has(k) && !fields.some((f) => f.key === k));

  const rows = defs.filter((f) => {
    const v = values[f.key];
    return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "";
  });

  if (rows.length === 0 && extras.length === 0) {
    return <p className="text-sm text-gray-500">No details submitted.</p>;
  }

  return (
    <dl className={compact ? "space-y-2" : "space-y-4"}>
      {rows.map((f) => {
        const v = values[f.key];
        const list = Array.isArray(v) ? v : [v as string];
        const isFile = f.type === "file" || f.type === "fileList";
        const isLink = isFile || f.type === "url" || f.type === "urlList";
        return (
          <div key={f.key}>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{f.label}</dt>
            <dd className="text-sm text-gray-200">
              {f.type === "agentCharter" ? (
                <AgentCharterView json={v} compact={compact} />
              ) : f.type === "multiselect" ? (
                <div className="flex flex-wrap gap-1.5">
                  {list.map((x) => (
                    <span key={x} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-gray-200">
                      {x}
                    </span>
                  ))}
                </div>
              ) : isLink ? (
                <div className={isFile && list.every(isImage) ? "flex flex-wrap gap-2" : "flex flex-col gap-1"}>
                  {list.map((u, i) => (
                    <LinkValue key={i} url={u} asFile={isFile} />
                  ))}
                </div>
              ) : (
                <p className={`whitespace-pre-wrap break-words ${compact ? "line-clamp-3" : ""}`}>{list.join("\n")}</p>
              )}
            </dd>
          </div>
        );
      })}
      {extras.map((k) => {
        const v = values[k];
        const list = Array.isArray(v) ? v : [v];
        return (
          <div key={k}>
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
            <dd className="text-sm text-gray-300">
              {list.map((x, i) =>
                /^https?:\/\/|^\/uploads\//.test(x) ? <LinkValue key={i} url={x} /> : <p key={i} className="whitespace-pre-wrap break-words">{x}</p>,
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function AgentCharterView({ json, compact }: { json: string | string[] | undefined; compact?: boolean }) {
  const agents = parseAgentCharter(json);
  if (agents.length === 0) return <p className="text-gray-500">—</p>;
  return (
    <div className="space-y-2">
      {agents.map((a, i) => {
        const level = AUTONOMY_LEVELS.find((l) => l.key === a.autonomy);
        return (
          <div key={i} className="rounded-md border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{a.name}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">{level?.label ?? a.autonomy}</span>
              {a.platform && <span className="text-xs text-gray-400">on {a.platform}</span>}
              {a.monthlyCostInr ? <span className="ml-auto text-xs text-gray-400">₹{a.monthlyCostInr.toLocaleString("en-IN")}/mo</span> : null}
            </div>
            <p className={`mt-1 whitespace-pre-wrap text-gray-300 ${compact ? "line-clamp-2" : ""}`}>{a.task}</p>
            {!compact && (
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-gray-400 sm:grid-cols-3">
                {a.humanCheckpoint && (
                  <div>
                    <span className="text-gray-500">Human check:</span> {a.humanCheckpoint}
                  </div>
                )}
                {a.dataAccessed && (
                  <div>
                    <span className="text-gray-500">Data:</span> {a.dataAccessed}
                  </div>
                )}
                {a.guardrails && (
                  <div>
                    <span className="text-gray-500">Guardrails:</span> {a.guardrails}
                  </div>
                )}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
