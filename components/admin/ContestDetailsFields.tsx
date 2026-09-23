"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, dateInputCls, inputCls } from "./editor-ui";
import type { ExtendedConfigForm } from "./contest-config-form";

type DetailKeys =
  | "heroCtaText"
  | "bannerImageUrl"
  | "startDate"
  | "endDate"
  | "eligibilityRules"
  | "teamStructureRules"
  | "deliverableRules";

/**
 * Contest fields the admin page did not previously expose: event dates,
 * hero CTA + banner, and the structured rules sections.
 */
export function ContestDetailsFields({
  value,
  onChange,
  ctaPlaceholder,
  rulesPlaceholders,
}: {
  value: Pick<ExtendedConfigForm, DetailKeys>;
  onChange: (patch: Partial<Pick<ExtendedConfigForm, DetailKeys>>) => void;
  ctaPlaceholder?: string;
  rulesPlaceholders?: Partial<Record<"eligibilityRules" | "teamStructureRules" | "deliverableRules", string>>;
}) {
  return (
    <>
      <SectionCard title="Event Dates & Landing Extras">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs text-gray-300">Start date</Label>
            <Input
              type="datetime-local"
              value={value.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className={dateInputCls}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-300">End date</Label>
            <Input
              type="datetime-local"
              value={value.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className={dateInputCls}
            />
            {value.startDate && value.endDate && value.endDate < value.startDate && (
              <p className="mt-1 text-xs text-amber-400">End date is before the start date.</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-300">Hero button text</Label>
            <Input
              value={value.heroCtaText}
              onChange={(e) => onChange({ heroCtaText: e.target.value })}
              placeholder={ctaPlaceholder || "Register Now"}
              className={inputCls}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-300">Banner image URL</Label>
            <Input
              value={value.bannerImageUrl}
              onChange={(e) => onChange({ bannerImageUrl: e.target.value })}
              placeholder="https://… (leave blank for the default artwork)"
              className={inputCls}
            />
          </div>
          {value.bannerImageUrl.trim() && /^(https?:\/\/|\/)/.test(value.bannerImageUrl.trim()) && (
            <div className="md:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.bannerImageUrl.trim()}
                alt="Banner preview"
                className="max-h-40 w-full rounded-lg border border-white/10 object-cover"
              />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Participation Rules" description="Shown on the rules page alongside the free-form rules content.">
        <div className="space-y-4">
          {(
            [
              ["eligibilityRules", "Eligibility"],
              ["teamStructureRules", "Team structure"],
              ["deliverableRules", "Deliverables"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs text-gray-300">{label}</Label>
              <Textarea
                value={value[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder={rulesPlaceholders?.[key] || undefined}
                className={`${inputCls} min-h-[80px]`}
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
