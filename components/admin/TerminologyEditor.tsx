"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { term, termPlural, type TermKey, type Terminology } from "@/lib/contest-config";
import { SectionCard, inputCls } from "./editor-ui";

const KEYS: Array<{ key: TermKey; hint: string }> = [
  { key: "track", hint: "e.g. Track, Category, Problem Statement" },
  { key: "phase", hint: "e.g. Phase, Round, Stage" },
  { key: "judge", hint: "e.g. Judge, Jury, Evaluator" },
  { key: "submission", hint: "e.g. Submission, Entry, Pitch" },
  { key: "team", hint: "e.g. Team, Squad, Startup" },
  { key: "member", hint: "e.g. Member, Participant" },
];

/** Edits `contests.terminology` — singular display names used across the contest UI. */
export function TerminologyEditor({
  value,
  onChange,
  presetTerms,
}: {
  value: Terminology;
  onChange: (next: Terminology) => void;
  /** The contest type's default vocabulary — shown as placeholders. */
  presetTerms: Terminology;
}) {
  return (
    <SectionCard
      title="Terminology"
      description="Singular labels used across the contest UI. Leave blank to use the contest type's default (shown greyed out)."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KEYS.map(({ key, hint }) => {
          const effective = { ...presetTerms, ...Object.fromEntries(Object.entries(value).filter(([, v]) => v?.trim())) };
          return (
            <div key={key}>
              <Label className="text-xs capitalize text-gray-300">{key}</Label>
              <Input
                value={value[key] ?? ""}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                placeholder={term(presetTerms, key)}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-gray-500">
                {hint} · plural: {termPlural(effective, key)}
              </p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
