/**
 * Client-safe shapes for the live finale API (GET/PUT /api/c/[slug]/live)
 * and the public showcase API (GET /api/c/[slug]/showcase). Shared by the
 * route handlers and the /live, /jury, /stage and /showcase pages.
 */
import type { LiveState, SubmissionValues } from "@/lib/contest-config";

export type LiveAction =
  | "setPhase"
  | "setQueue"
  | "setCurrent"
  | "next"
  | "openScoring"
  | "closeScoring"
  | "startTimer"
  | "clearTimer"
  | "reveal"
  | "reset";

export interface LivePutBody {
  action: LiveAction;
  phase?: number;
  queue?: string[];
  teamId?: string;
  seconds?: number;
  revealStage?: LiveState["revealStage"];
}

export interface LiveTeamRef {
  teamId: string;
  teamName: string;
  track: string | null;
}

export interface LiveCurrent extends LiveTeamRef {
  submissionId: string | null;
  /** Full submission values — only for judges/admins; `null` for everyone else. */
  values: SubmissionValues | null;
  headline: string;
}

export interface LiveLeaderboardEntry extends LiveTeamRef {
  rank: number;
  totalScore: number;
  /** Score earned in the live round (0..phase.maxPoints). */
  phaseScore: number;
  phaseScores: Record<string, number>;
}

export interface LiveJudgeStatus {
  id: string;
  name: string | null;
  scored: boolean;
}

export interface LivePayload {
  state: LiveState;
  phase: { phase: number; name: string; maxPoints: number } | null;
  current: LiveCurrent | null;
  queue: LiveTeamRef[];
  progress: { judgesTotal: number; judgesScored: number; scoresCount: number };
  /**
   * null while revealStage is "hidden" (admins always get it). For public
   * callers in "partial" the top-3 rows are withheld server-side and
   * `hiddenTop` says how many were withheld.
   */
  leaderboard: LiveLeaderboardEntry[] | null;
  hiddenTop: number;
  serverTime: number;
  /** What the caller may see. */
  viewer: "public" | "judge" | "admin";
  /** Admin-only extras. */
  teams?: LiveTeamRef[];
  judges?: LiveJudgeStatus[];
}

export interface ShowcaseLink {
  key: string;
  label: string;
  url: string;
}

export interface ShowcaseEntry {
  teamId: string;
  name: string;
  track: string | null;
  members: string[];
  headline: string;
  /** Set when the crew has not submitted yet and its assigned Problem Bank problem is shown instead. */
  problemTitle?: string | null;
  publicLinks: ShowcaseLink[];
}

export interface ShowcasePayload {
  contest: { name: string; slug: string };
  teams: ShowcaseEntry[];
  preview: boolean;
}
