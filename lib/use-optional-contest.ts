"use client";

/**
 * Like `useContestConfig()` but safe outside a <ContestProvider> (legacy
 * /dashboard, /judging, /admin pages reuse the same components). Returns
 * `contest: null` and generic vocabulary when there is no provider.
 */
import { useContest, type Contest } from "@/lib/contest-context";
import { term, termPlural, type TermKey } from "@/lib/contest-config";
import { getPreset } from "@/lib/contest-types";

function useContestOrNull(): Contest | null {
  try {
    // useContest() is just useContext + a throw when the provider is missing;
    // the hook call itself happens unconditionally on every render.
    return useContest().contest;
  } catch {
    return null;
  }
}

export function useOptionalContestConfig() {
  const contest = useContestOrNull();
  const preset = getPreset(contest?.contestType);
  const terminology = contest ? (contest.terminology ?? preset.terminology) : null;
  return {
    contest,
    preset,
    t: (key: TermKey) => term(terminology, key),
    tp: (key: TermKey) => termPlural(terminology, key),
  };
}
