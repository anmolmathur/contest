"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENDA_KIND_LABELS, type AgendaItem, type AgendaKind, type Speaker } from "@/lib/contest-config";
import { ChipMultiSelect, RowShell, SectionCard, dateInputCls, inputCls, moveItem, newId, outlineBtnCls } from "./editor-ui";

/** Edits `contests.agenda` — the public schedule of keynotes, panels, pitches etc. */
export function AgendaEditor({
  value,
  onChange,
  speakers,
  defaultDay,
}: {
  value: AgendaItem[];
  onChange: (next: AgendaItem[]) => void;
  speakers: Speaker[];
  /** yyyy-mm-dd used for the first new item (e.g. contest start date). */
  defaultDay?: string;
}) {
  const update = (i: number, patch: Partial<AgendaItem>) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const add = () => {
    const last = value[value.length - 1];
    onChange([
      ...value,
      {
        id: newId(),
        day: last?.day ?? defaultDay ?? "",
        start: last?.end ?? "",
        title: "",
        kind: "keynote",
        speakerIds: [],
      },
    ]);
  };

  const speakerOptions = speakers
    .filter((s) => s.name.trim())
    .map((s) => ({ value: s.id, label: s.name }));

  return (
    <SectionCard
      title="Agenda"
      description="Sessions shown on the public agenda. Items are sorted by day and start time when saved."
      action={
        <Button type="button" onClick={add} variant="outline" className={outlineBtnCls}>
          <Plus className="mr-2" size={16} />
          Add Session
        </Button>
      }
    >
      {value.length === 0 && <p className="text-sm text-gray-500">No sessions yet.</p>}
      <div className="space-y-3">
        {value.map((a, i) => (
          <RowShell
            key={a.id}
            index={i}
            count={value.length}
            onMove={(d) => onChange(moveItem(value, i, d))}
            onRemove={() => onChange(value.filter((_, idx) => idx !== i))}
            heading={a.title || `Session #${i + 1}`}
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="col-span-2 md:col-span-1">
                <Label className="text-xs text-gray-300">Day</Label>
                <Input type="date" value={a.day} onChange={(e) => update(i, { day: e.target.value })} className={dateInputCls} />
              </div>
              <div>
                <Label className="text-xs text-gray-300">Start</Label>
                <Input type="time" value={a.start} onChange={(e) => update(i, { start: e.target.value })} className={dateInputCls} />
              </div>
              <div>
                <Label className="text-xs text-gray-300">End</Label>
                <Input
                  type="time"
                  value={a.end ?? ""}
                  onChange={(e) => update(i, { end: e.target.value || undefined })}
                  className={dateInputCls}
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label className="text-xs text-gray-300">Kind</Label>
                <Select value={a.kind} onValueChange={(v) => update(i, { kind: v as AgendaKind })}>
                  <SelectTrigger className={`${inputCls} w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGENDA_KIND_LABELS) as AgendaKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {AGENDA_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs text-gray-300">Title</Label>
                <Input
                  value={a.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Opening keynote: The future of sustainable business"
                  className={inputCls}
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label className="text-xs text-gray-300">Venue</Label>
                <Input
                  value={a.venue ?? ""}
                  onChange={(e) => update(i, { venue: e.target.value })}
                  placeholder="Main Auditorium"
                  className={inputCls}
                />
              </div>
              <div className="col-span-2 md:col-span-4">
                <Label className="mb-1.5 block text-xs text-gray-300">Speakers</Label>
                <ChipMultiSelect
                  options={speakerOptions}
                  value={a.speakerIds ?? []}
                  onChange={(speakerIds) => update(i, { speakerIds })}
                  emptyLabel="Add people in Speakers & Jury to link them here."
                />
              </div>
              <div className="col-span-2 md:col-span-4">
                <Label className="text-xs text-gray-300">Description</Label>
                <Textarea
                  value={a.description ?? ""}
                  onChange={(e) => update(i, { description: e.target.value })}
                  className={`${inputCls} min-h-[72px]`}
                />
              </div>
            </div>
          </RowShell>
        ))}
      </div>
    </SectionCard>
  );
}
