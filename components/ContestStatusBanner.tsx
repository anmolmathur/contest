"use client";

import { Lock, Archive, CheckCircle2 } from "lucide-react";

type Status = "draft" | "active" | "completed" | "archived";

/**
 * Rendered at the top of every /c/[slug]/* page when the contest is not
 * `active`. Communicates to the user that the contest is frozen (read-only)
 * and results are still viewable for historical reference.
 */
export function ContestStatusBanner({ status }: { status: Status }) {
  if (status === "active") return null;

  const cfg = {
    draft: {
      Icon: Lock,
      text: "This contest is in draft — only admins can see it.",
      cls: "bg-yellow-500/10 border-yellow-500/40 text-yellow-200",
    },
    completed: {
      Icon: CheckCircle2,
      text: "This contest has concluded. Results below are final and viewable for reference.",
      cls: "bg-emerald-500/10 border-emerald-500/40 text-emerald-200",
    },
    archived: {
      Icon: Archive,
      text: "This contest is archived. All data is read-only; results remain publicly viewable.",
      cls: "bg-slate-500/10 border-slate-500/40 text-slate-200",
    },
  } as const;

  const { Icon, text, cls } = cfg[status];

  return (
    <div className={`w-full border-b ${cls}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <Icon size={16} className="flex-shrink-0" />
        <span>{text}</span>
      </div>
    </div>
  );
}
