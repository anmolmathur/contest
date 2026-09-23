"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard, Toggle, inputCls } from "./editor-ui";
import type { SettingsForm, Visibility } from "./contest-config-form";

/**
 * Edits `contests.settings` flags plus `visibility` and `supportEmail`.
 * `resultsPublished` is intentionally not editable here — it's driven by the
 * Publish results control (and kept in sync with this form).
 */
export function ContestSettingsFlags({
  settings,
  onSettingsChange,
  visibility,
  onVisibilityChange,
  supportEmail,
  onSupportEmailChange,
  trackTerm = "Track",
  judgeTerm = "Judge",
}: {
  settings: SettingsForm;
  onSettingsChange: (next: SettingsForm) => void;
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  supportEmail: string;
  onSupportEmailChange: (v: string) => void;
  trackTerm?: string;
  judgeTerm?: string;
}) {
  const set = (patch: Partial<SettingsForm>) => onSettingsChange({ ...settings, ...patch });
  return (
    <SectionCard title="Contest Options" description="Behaviour switches, visibility and contact details.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Toggle
          checked={!!settings.exclusiveTracks}
          onChange={(v) => set({ exclusiveTracks: v })}
          label={`Exclusive ${trackTerm.toLowerCase()}s`}
          description={`Each ${trackTerm.toLowerCase()} can be picked by only one team.`}
        />
        <Toggle
          checked={!!settings.showcaseEnabled}
          onChange={(v) => set({ showcaseEnabled: v })}
          label="Public showcase"
          description="Show a public gallery of team entries."
        />
        <Toggle
          checked={settings.assistantEnabled !== false}
          onChange={(v) => set({ assistantEnabled: v })}
          label="AI assistant widget"
          description="Let visitors and participants ask the contest assistant questions."
        />
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <Label className="text-sm font-medium text-gray-200">{judgeTerm} feedback visible to teams</Label>
          <Select
            value={settings.feedbackVisibility ?? "after_results"}
            onValueChange={(v) => set({ feedbackVisibility: v as "never" | "after_results" })}
          >
            <SelectTrigger className={`${inputCls} mt-2 w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="after_results">After results are published</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <Label className="text-sm font-medium text-gray-200">Default appearance</Label>
          <Select
            value={settings.colorMode ?? "auto"}
            onValueChange={(v) => set({ colorMode: v === "auto" ? undefined : (v as "light" | "dark") })}
          >
            <SelectTrigger className={`${inputCls} mt-2 w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">By contest type (hackathon dark, symposium light)</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-gray-500">Visitors can still switch with the sun/moon button.</p>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-gray-300">Theme line</Label>
          <Input
            value={settings.theme ?? ""}
            onChange={(e) => set({ theme: e.target.value })}
            placeholder="e.g. Innovating for a Sustainable, Digital, and Inclusive Future"
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-gray-500">Displayed on the landing page.</p>
        </div>
        <div>
          <Label className="text-xs text-gray-300">Visibility</Label>
          <Select value={visibility} onValueChange={(v) => onVisibilityChange(v as Visibility)}>
            <SelectTrigger className={`${inputCls} w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — listed and open to everyone</SelectItem>
              <SelectItem value="unlisted">Unlisted — anyone with the link</SelectItem>
              <SelectItem value="private">Private — members only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-300">Support email</Label>
          <Input
            type="email"
            value={supportEmail}
            onChange={(e) => onSupportEmailChange(e.target.value)}
            placeholder="help@example.com"
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-gray-500">Shown as the contact address in contest emails and pages.</p>
        </div>
      </div>
    </SectionCard>
  );
}
