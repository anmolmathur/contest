"use client";
// STUB — replaced by the AI setup assistant implementation.
// Contract (keep stable):
//   mode "create": platform admin describes a contest in plain words; the
//     assistant proposes a full contest draft. onApply(draft) receives a
//     ContestDraft (fields accepted by POST /api/contests).
//   mode "edit": contest admin asks for changes to an existing contest;
//     onApply(patch) receives a partial ContestDraft (fields accepted by
//     PUT /api/contests/[slug]).
export interface ContestDraft {
  contestType?: "hackathon" | "business_symposium";
  name?: string;
  slug?: string;
  description?: string;
  [key: string]: unknown;
}

export function AiContestSetup(_props: {
  mode: "create" | "edit";
  contestSlug?: string;
  onApply: (draft: ContestDraft) => void;
  className?: string;
}) {
  return null;
}
