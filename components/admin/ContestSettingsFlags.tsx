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
import { DEFAULT_SYMPOSIUM_TEAM_VIDEO } from "@/lib/contest-config";
import { memberIdLabel } from "@/lib/member-identifier";
import VideoEmbed from "@/components/team/VideoEmbed";

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
  contestType,
}: {
  settings: SettingsForm;
  onSettingsChange: (next: SettingsForm) => void;
  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;
  supportEmail: string;
  onSupportEmailChange: (v: string) => void;
  trackTerm?: string;
  judgeTerm?: string;
  /** Picks the defaults shown as placeholders (video, ID label). */
  contestType?: string;
}) {
  const set = (patch: Partial<SettingsForm>) => onSettingsChange({ ...settings, ...patch });
  // teamCreationVideoUrl: absent → type default, "" → no video, URL → that video.
  const typeDefaultVideo = contestType === "business_symposium" ? DEFAULT_SYMPOSIUM_TEAM_VIDEO : "";
  const videoOn = settings.teamCreationVideoUrl !== "";
  const videoValue = typeof settings.teamCreationVideoUrl === "string" ? settings.teamCreationVideoUrl : "";
  const effectiveVideo = videoOn ? videoValue.trim() || typeDefaultVideo : "";
  const defaultIdLabel = memberIdLabel({ contestType, settings: {} });
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
        <div className="md:col-span-2 rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
          <Toggle
            checked={videoOn}
            onChange={(v) => set({ teamCreationVideoUrl: v ? undefined : "" })}
            label="Walkthrough video when creating a team"
            description="Shown at the top of the Create team dialog."
          />
          {videoOn && (
            <>
              <Label className="text-xs text-gray-300">Video URL (Vimeo, YouTube or .mp4)</Label>
              <Input
                value={videoValue}
                onChange={(e) => set({ teamCreationVideoUrl: e.target.value.trim() ? e.target.value : undefined })}
                placeholder={typeDefaultVideo || "https://player.vimeo.com/video/…"}
                className={inputCls}
              />
              <p className="text-[11px] text-gray-500">
                {typeDefaultVideo
                  ? "Leave blank to use the standard symposium walkthrough."
                  : "Paste a link to show a video; leave blank for none."}
              </p>
              {effectiveVideo && (
                <div className="max-w-md">
                  <VideoEmbed url={effectiveVideo} title="Team creation walkthrough" />
                </div>
              )}
            </>
          )}
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-gray-300">Participant ID label</Label>
          <Input
            value={typeof settings.memberIdLabel === "string" ? settings.memberIdLabel : ""}
            onChange={(e) => set({ memberIdLabel: e.target.value || undefined })}
            maxLength={60}
            placeholder={defaultIdLabel}
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Name of the optional ID asked for at sign-up and team creation (e.g. Enrollment Number, Employee ID, Roll Number).
            Leave blank for &quot;{defaultIdLabel}&quot;.
          </p>
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
