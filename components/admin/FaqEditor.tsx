"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RowShell, SectionCard, inputCls, moveItem, outlineBtnCls } from "./editor-ui";
import type { FaqEntry } from "./contest-config-form";

/** Edits `contests.faqConfig` — also used as grounding for the AI assistant. */
export function FaqEditor({ value, onChange }: { value: FaqEntry[]; onChange: (next: FaqEntry[]) => void }) {
  const update = (i: number, patch: Partial<FaqEntry>) =>
    onChange(value.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  return (
    <SectionCard
      title="FAQ"
      description="Questions shown on the contest site. Empty rows are dropped on save."
      action={
        <Button
          type="button"
          variant="outline"
          className={outlineBtnCls}
          onClick={() => onChange([...value, { question: "", answer: "" }])}
        >
          <Plus className="mr-2" size={16} />
          Add Question
        </Button>
      }
    >
      {value.length === 0 && <p className="text-sm text-gray-500">No FAQ entries yet.</p>}
      <div className="space-y-3">
        {value.map((q, i) => (
          <RowShell
            key={i}
            index={i}
            count={value.length}
            onMove={(d) => onChange(moveItem(value, i, d))}
            onRemove={() => onChange(value.filter((_, idx) => idx !== i))}
            heading={q.question || `Question #${i + 1}`}
          >
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-300">Question</Label>
                <Input value={q.question} onChange={(e) => update(i, { question: e.target.value })} className={inputCls} />
              </div>
              <div>
                <Label className="text-xs text-gray-300">Answer</Label>
                <Textarea
                  value={q.answer}
                  onChange={(e) => update(i, { answer: e.target.value })}
                  className={`${inputCls} min-h-[80px]`}
                />
              </div>
            </div>
          </RowShell>
        ))}
      </div>
    </SectionCard>
  );
}
