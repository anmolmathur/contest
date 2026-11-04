"use client";

import { useContest, useContestConfig } from "@/lib/contest-context";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback, type ComponentProps } from "react";
import { TeamMentorPanel } from "@/components/TeamMentorPanel";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import GlassCard from "@/components/GlassCard";
import { DynamicSubmissionForm } from "@/components/submissions/DynamicSubmissionForm";
import { CrewPanel } from "@/components/ideathon/CrewPanel";
import { NextActionCard } from "@/components/ideathon/NextActionCard";
import { ImpactMetricsPanel } from "@/components/ideathon/ImpactMetricsPanel";
import { SubmissionView } from "@/components/submissions/SubmissionView";
import { submissionValues, validateSubmission } from "@/lib/submission-fields";
import type { SubmissionValues } from "@/lib/contest-config";
import Leaderboard from "@/components/Leaderboard";
import MemberEmailRow, { type MemberRow } from "@/components/team/MemberEmailRow";
import BackgroundPattern from "@/components/BackgroundPattern";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  Plus,
  Send,
  CheckCircle,
  Award,
  Trophy,
  LogOut,
  User,
  Edit,
  Trash2,
  UserMinus,
  Crown,
  Shield,
  BookOpen,
  MessageSquareQuote,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const EMPTY_MEMBER: MemberRow = { email: "", name: "" };

/** Rows carry a stable id, so removing one doesn't hand its lookup result to the next. */
const firstMemberRow = () => [{ ...EMPTY_MEMBER, id: 0 }];

interface Team {
  id: string;
  name: string;
  track?: string | null;
  trackId?: string | null;
  createdBy: string;
  leaderId: string | null;
  approved: boolean;
  trackRef?: { id: string; name: string } | null;
  solutionPaths?: string[] | null;
  status?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  participantRole?: string | null;
  /** contest_users.role — "mentor" rows don't count toward team size */
  contestRole?: string | null;
}

type Submission = {
  id: string;
  phase: number;
  /** Generic values as stored (jsonb) */
  fields?: SubmissionValues | null;
  /** Merged values (fields + legacy hackathon columns), provided by the API */
  values?: SubmissionValues;
  // Legacy hackathon columns (still returned for old submissions)
  githubUrl?: string | null;
  demoUrl?: string | null;
  submissionDescription?: string | null;
  aiPromptsUsed?: string | null;
  aiToolsUtilized?: string | null;
  aiScreenshots?: string[] | null;
  submittedAt: string;
  updatedAt?: string;
};

interface SubmissionStatus {
  judgesScored: number;
  totalJudges: number;
  isComplete: boolean;
}

interface ContestMembership {
  id: string;
  role: string; // "admin" | "judge" | "participant" | "mentor"
  participantRole: string | null;
  teamId: string | null; // active team
}

/** A team I'm on (multi-team contests can have several). */
interface MyTeamRef {
  id: string;
  name: string;
  status?: string;
}

interface TeamFeedback {
  visible: boolean;
  phases: Array<{
    phase: number;
    name: string;
    averageWeighted: number | null;
    phasePoints: number | null;
    feedback: Array<{ jury: string; text: string }>;
  }>;
}

type LeaderboardEntries = ComponentProps<typeof Leaderboard>["entries"];

function valuesOf(sub: Submission): SubmissionValues {
  return sub.values ?? submissionValues(sub);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContestDashboardPage() {
  const { contest } = useContest();
  const { t, tp, submissionFields, settings, contestType } = useContestConfig();
  const isIdeathon = contestType === "ideathon";
  const { data: session, status } = useSession();
  const router = useRouter();

  // Membership / role state
  const [contestMembership, setContestMembership] =
    useState<ContestMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  const isRegistrationClosed = contest.registrationDeadline
    ? new Date() > new Date(contest.registrationDeadline)
    : false;

  // Team state
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [maxTeams, setMaxTeams] = useState(contest.maxTeams);
  // Every team I'm on, and whether the contest allows more than one (Ideathon)
  const [myTeams, setMyTeams] = useState<MyTeamRef[]>([]);
  const [multiTeam, setMultiTeam] = useState(false);
  const [switchingTeam, setSwitchingTeam] = useState(false);
  // Tracks/categories already claimed (only populated with settings.exclusiveTracks)
  const [takenTrackIds, setTakenTrackIds] = useState<string[]>([]);

  // Submissions
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionStatuses, setSubmissionStatuses] = useState<
    Record<string, SubmissionStatus | null>
  >({});

  // Jury feedback for the user's team (only filled once results are visible)
  const [teamFeedback, setTeamFeedback] = useState<TeamFeedback | null>(null);

  // Leaderboard
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntries>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dialogs
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [submitWorkOpen, setSubmitWorkOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);

  // Add-member form
  const [newMember, setNewMember] = useState<MemberRow>(EMPTY_MEMBER);

  // Create team form
  const [teamName, setTeamName] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [createRole, setCreateRole] = useState("");
  const [memberRows, setMemberRows] = useState(firstMemberRow);

  // Edit profile form
  const [profileForm, setProfileForm] = useState({ name: "", department: "" });
  const [profileRole, setProfileRole] = useState("");

  // Edit team form
  const [editTeamForm, setEditTeamForm] = useState({
    name: "",
    trackId: "",
  });

  // Submission form (fields come from the contest's submissionFields config)
  const [submitPhase, setSubmitPhase] = useState("");
  const [submitValues, setSubmitValues] = useState<SubmissionValues>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(
    null
  );
  const [isEditMode, setIsEditMode] = useState(false);

  // -----------------------------------------------------------------------
  // Derived helpers
  // -----------------------------------------------------------------------

  const slug = contest.slug;
  const apiBase = `/api/c/${slug}`;

  const isJudge =
    contestMembership?.role === "judge" ||
    contestMembership?.role === "admin";
  const isAdmin = contestMembership?.role === "admin";
  const isParticipant = contestMembership?.role === "participant";
  const isCreator = team?.createdBy === session?.user?.id;
  // Organisers (contest + platform admins) can manage any team they're on,
  // even after submissions or the registration deadline — the API allows it.
  const canManageTeam = isCreator || isAdmin;

  // Team roles the contest defines (e.g. Team Lead, Finance, Presenter)
  const roleOptions = (contest.roleConfig ?? []).filter((r) => r.role && r.role.trim());
  const hasTracks = contest.tracks.length > 0;
  const sortedTracks = [...contest.tracks].sort((a, b) => a.sortOrder - b.sortOrder);
  const trackWord = t("track");
  const phaseWord = t("phase");
  const judgesWord = tp("judge").toLowerCase();
  // "Submit Work" for hackathons, "Submit Entry" when the contest renames submissions.
  const submitNoun = /^submission$/i.test(t("submission")) ? "Work" : t("submission");

  // Phases that accept submissions (maxPoints > 0)
  const scorablePhases = (contest.phaseConfig ?? []).filter(
    (p) => p.maxPoints > 0
  );

  // Track name resolver
  const getTrackName = useCallback(
    (trackId?: string | null) => {
      if (!trackId) return "N/A";
      const tr = contest.tracks.find((x) => x.id === trackId);
      return tr ? tr.name : trackId;
    },
    [contest.tracks]
  );

  // -----------------------------------------------------------------------
  // Fetch the current user's contest membership (role, teamId)
  // Uses /api/c/[slug]/users/me — a lightweight endpoint returning the
  // requesting user's contest_users record. If this endpoint doesn't exist
  // yet, we fall back to the team count endpoint + session teamId.
  // -----------------------------------------------------------------------

  const fetchMembership = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Try the dedicated "me" endpoint first
      const res = await fetch(`${apiBase}/users/me`);
      if (res.ok) {
        const data = await res.json();
        setTakenTrackIds(Array.isArray(data.takenTrackIds) ? data.takenTrackIds : []);
        setMyTeams(Array.isArray(data.teams) ? data.teams : []);
        setMultiTeam(!!data.multiTeam);
        setContestMembership({
          id: data.id,
          role: data.role,
          participantRole: data.participantRole ?? null,
          teamId: data.teamId ?? null,
        });
        return;
      }

      // If user is not enrolled (404), auto-enroll them as participant
      if (res.status === 404) {
        const enrollRes = await fetch(`${apiBase}/users/enroll`, {
          method: "POST",
        });
        if (enrollRes.ok) {
          const data = await enrollRes.json();
          setContestMembership({
            id: data.id,
            role: data.role ?? "participant",
            participantRole: data.participantRole ?? null,
            teamId: data.teamId ?? null,
          });
          return;
        }
      }
    } catch {
      // endpoint may not exist yet
    }

    // Fallback: try the admin/judge users list and find ourselves
    try {
      const res = await fetch(`${apiBase}/users`);
      if (res.ok) {
        const usersData = await res.json();
        const me = (
          (Array.isArray(usersData) ? usersData : []) as Array<{
            id: string;
            userId: string;
            role: string;
            participantRole?: string | null;
            teamId?: string | null;
          }>
        ).find((u) => u.userId === session.user.id);
        if (me) {
          setContestMembership({
            id: me.id,
            role: me.role,
            participantRole: me.participantRole ?? null,
            teamId: me.teamId ?? null,
          });
          return;
        }
      }
    } catch {
      // user doesn't have judge access — that's fine
    }

    // Last resort: treat as participant with teamId from session (legacy)
    setContestMembership({
      id: "",
      role: "participant",
      participantRole: null,
      teamId: session.user.teamId ?? null,
    });
  }, [apiBase, session?.user?.id, session?.user?.teamId]);

  // -----------------------------------------------------------------------
  // Data loaders
  // -----------------------------------------------------------------------

  const loadTeamCount = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/teams/count`);
      if (res.ok) {
        const data = await res.json();
        setTeamCount(data.count);
        if (data.maxTeams) setMaxTeams(data.maxTeams);
      }
    } catch (err) {
      console.error("Error loading team count:", err);
    }
  }, [apiBase]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    }
  }, [apiBase]);

  const loadTeamData = useCallback(
    async (teamId: string) => {
      try {
        const teamRes = await fetch(`${apiBase}/teams/${teamId}`);
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeam(teamData.team);
          setTeamMembers(teamData.members || []);
        } else {
          setTeam(null);
          setTeamMembers([]);
        }
      } catch (err) {
        console.error("Error loading team:", err);
      }
    },
    [apiBase]
  );

  const loadSubmissions = useCallback(
    async (teamId: string) => {
      try {
        const res = await fetch(`${apiBase}/submissions/team/${teamId}`);
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.submissions || []);

          // Load scoring progress for each submission (count only — scores
          // and feedback stay hidden until results are published).
          const statusPromises = (data.submissions || []).map(
            async (sub: Submission): Promise<[string, SubmissionStatus | null]> => {
              try {
                const statusRes = await fetch(
                  `${apiBase}/submissions/${sub.id}`
                );
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  const judgesScored: number =
                    statusData.submission?.scoresCount ??
                    (statusData.submission?.scores || []).length;
                  const totalJudges: number =
                    statusData.submission?.totalJudges || 1;
                  return [
                    sub.id,
                    {
                      judgesScored,
                      totalJudges,
                      isComplete: judgesScored >= totalJudges,
                    },
                  ];
                }
              } catch {
                // ignore individual failures
              }
              return [sub.id, null];
            }
          );

          const statuses = await Promise.all(statusPromises);
          setSubmissionStatuses(Object.fromEntries(statuses));
        }
      } catch (err) {
        console.error("Error loading submissions:", err);
      }
    },
    [apiBase]
  );

  const loadFeedback = useCallback(
    async (teamId: string) => {
      try {
        const res = await fetch(`${apiBase}/teams/${teamId}/feedback`);
        if (res.ok) {
          setTeamFeedback(await res.json());
        } else {
          setTeamFeedback(null);
        }
      } catch {
        setTeamFeedback(null);
      }
    },
    [apiBase]
  );

  // -----------------------------------------------------------------------
  // Master data loader
  // -----------------------------------------------------------------------

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchMembership();
    } catch {
      // membership fetch handled internally
    }
    setMembershipLoading(false);
  }, [fetchMembership]);

  // Once membership is resolved, load the rest
  useEffect(() => {
    if (membershipLoading) return;

    const loadRest = async () => {
      await Promise.all([loadTeamCount(), loadLeaderboard()]);

      const teamId = contestMembership?.teamId;
      if (teamId) {
        await Promise.all([
          loadTeamData(teamId),
          loadSubmissions(teamId),
          loadFeedback(teamId),
        ]);
      }

      setLoading(false);
    };

    loadRest();
  }, [
    membershipLoading,
    contestMembership?.teamId,
    loadTeamCount,
    loadLeaderboard,
    loadTeamData,
    loadSubmissions,
    loadFeedback,
  ]);

  // -----------------------------------------------------------------------
  // Auth redirect
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadDashboardData();
    }
  }, [status, loadDashboardData, router]);

  // -----------------------------------------------------------------------
  // Handlers — Team
  // -----------------------------------------------------------------------

  const handleCreateTeam = async () => {
    setError("");
    setSuccess("");

    if (!teamName.trim() || (hasTracks && !selectedTrackId)) {
      setError(
        hasTracks
          ? `Please enter a ${t("team").toLowerCase()} name and choose a ${trackWord.toLowerCase()}`
          : `Please enter a ${t("team").toLowerCase()} name`
      );
      return;
    }

    try {
      // Set the creator's team role first (validated against roleConfig).
      if (
        roleOptions.length > 0 &&
        createRole &&
        createRole !== (contestMembership?.participantRole ?? "")
      ) {
        const ok = await saveParticipantRole(createRole);
        if (!ok) return;
      }

      const res = await fetch(`${apiBase}/teams/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          trackId: hasTracks ? selectedTrackId : undefined,
          members: memberRows
            .filter((m) => m.email.trim())
            .map(({ email, name }) => ({ email, name })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        // Someone else may have just claimed that track — refresh availability.
        if (data.code === "TRACK_TAKEN") {
          setSelectedTrackId("");
          await fetchMembership();
        }
        return;
      }

      setSuccess(`${t("team")} created successfully!`);
      setCreateTeamOpen(false);
      setTeamName("");
      setSelectedTrackId("");
      setCreateRole("");
      setMemberRows(firstMemberRow());

      // Reload everything
      await loadDashboardData();
    } catch {
      setError("Failed to create team");
    }
  };

  // Multi-team contests: choose which of my teams the dashboard works on.
  const handleSwitchTeam = async (teamId: string) => {
    if (!teamId || teamId === contestMembership?.teamId) return;
    setError("");
    setSwitchingTeam(true);
    try {
      const res = await fetch(`${apiBase}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeTeamId: teamId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Could not switch ${t("team").toLowerCase()}`);
        return;
      }
      setSubmissions([]);
      setTeamFeedback(null);
      await fetchMembership();
    } catch {
      setError(`Could not switch ${t("team").toLowerCase()}`);
    } finally {
      setSwitchingTeam(false);
    }
  };

  const handleAddMember = async () => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${apiBase}/teams/add-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newMember, teamId: team?.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Member added successfully!");
      setAddMemberOpen(false);
      setNewMember(EMPTY_MEMBER);
      if (team) {
        await loadTeamData(team.id);
      }
    } catch {
      setError("Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setError("");
    setSuccess("");

    if (!team) return;
    if (
      !confirm("Are you sure you want to remove this member from the team?")
    )
      return;

    try {
      const res = await fetch(`${apiBase}/teams/remove-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId: team.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Member removed successfully!");
      await loadTeamData(team.id);
    } catch {
      setError("Failed to remove member");
    }
  };

  const handleSetLeader = async (userId: string) => {
    setError("");
    setSuccess("");

    if (!team) return;

    try {
      const res = await fetch(`${apiBase}/teams/set-leader`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Team leader updated successfully!");
      await loadTeamData(team.id);
    } catch {
      setError("Failed to set team leader");
    }
  };

  const handleOpenEditTeam = () => {
    if (team) {
      setEditTeamForm({
        name: team.name,
        trackId: team.trackId || "",
      });
      setEditTeamOpen(true);
    }
  };

  const handleUpdateTeam = async () => {
    setError("");
    setSuccess("");

    if (!team) return;

    try {
      const res = await fetch(`${apiBase}/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTeamForm.name,
          ...(hasTracks && editTeamForm.trackId
            ? { trackId: editTeamForm.trackId }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        if (data.code === "TRACK_TAKEN") await fetchMembership();
        return;
      }

      setSuccess("Team updated successfully!");
      setEditTeamOpen(false);
      await loadTeamData(team.id);
    } catch {
      setError("Failed to update team");
    }
  };

  const handleDeleteTeam = async () => {
    setError("");
    setSuccess("");

    if (!team) return;
    if (
      !confirm(
        "Are you sure you want to delete this team? This action cannot be undone."
      )
    )
      return;

    try {
      const res = await fetch(`${apiBase}/teams/${team.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Team deleted successfully!");
      setTeam(null);
      setTeamMembers([]);
      setSubmissions([]);
      await loadDashboardData();
    } catch {
      setError("Failed to delete team");
    }
  };

  // -----------------------------------------------------------------------
  // Handlers — Profile
  // -----------------------------------------------------------------------

  /** PUT users/me — returns true on success, sets the page error otherwise. */
  const saveParticipantRole = async (role: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantRole: role || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update your role");
        return false;
      }
      setContestMembership((prev) =>
        prev ? { ...prev, participantRole: data.participantRole ?? null } : prev
      );
      return true;
    } catch {
      setError("Failed to update your role");
      return false;
    }
  };

  const handleOpenEditProfile = async () => {
    // Pre-load current profile data so existing values are visible
    setProfileForm({
      name: session?.user?.name || "",
      department: "",
    });
    setProfileRole(contestMembership?.participantRole ?? "");
    setEditProfileOpen(true);

    try {
      const res = await fetch("/api/users/profile");
      if (res.ok) {
        const data = await res.json();
        setProfileForm({
          name: data.user.name || "",
          department: data.user.department || "",
        });
      }
    } catch {
      // If fetch fails, we still show the dialog with session data
    }
  };

  const handleUpdateProfile = async () => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      if (
        isParticipant &&
        roleOptions.length > 0 &&
        profileRole !== (contestMembership?.participantRole ?? "")
      ) {
        const ok = await saveParticipantRole(profileRole);
        if (!ok) return;
        if (team) await loadTeamData(team.id);
      }

      setSuccess("Profile updated successfully!");
      setEditProfileOpen(false);
      router.refresh();
    } catch {
      setError("Failed to update profile");
    }
  };

  // -----------------------------------------------------------------------
  // Handlers — Submissions
  // -----------------------------------------------------------------------

  const resetSubmitForm = () => {
    setSubmitPhase("");
    setSubmitValues({});
    setSubmitError("");
    setEditingSubmission(null);
    setIsEditMode(false);
  };

  const handleOpenEditSubmission = (submission: Submission) => {
    setEditingSubmission(submission);
    setIsEditMode(true);
    setSubmitPhase(submission.phase.toString());
    setSubmitValues({ ...valuesOf(submission) });
    setSubmitError("");
    setSubmitWorkOpen(true);
  };

  const handleSelectSubmitPhase = (value: string) => {
    setSubmitPhase(value);
    setSubmitError("");
    // Submitting again for a phase updates that submission — start from it.
    const existing = submissions.find((s) => s.phase === Number(value));
    setSubmitValues(existing ? { ...valuesOf(existing) } : {});
  };

  const handleSubmitWork = async () => {
    setError("");
    setSuccess("");
    setSubmitError("");

    const phase = parseInt(submitPhase, 10);
    if (!submitPhase || Number.isNaN(phase)) {
      setSubmitError(`Please select a ${phaseWord.toLowerCase()}`);
      return;
    }

    // Same validation the API runs, so problems show up before the request.
    const check = validateSubmission(submissionFields, submitValues, phase);
    if (check.error !== undefined) {
      setSubmitError(check.error);
      return;
    }

    setSubmitting(true);
    try {
      const res =
        isEditMode && editingSubmission
          ? await fetch(`${apiBase}/submissions/${editingSubmission.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fields: check.values }),
            })
          : await fetch(`${apiBase}/submissions/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phase, fields: check.values }),
            });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || `Failed to save ${t("submission").toLowerCase()}`);
        return;
      }

      const word = t("submission");
      setSuccess(
        isEditMode || data.updated
          ? `${word} updated successfully!`
          : `${word} created successfully!`
      );
      setSubmitWorkOpen(false);
      resetSubmitForm();

      if (team) {
        await loadSubmissions(team.id);
      }
    } catch {
      setSubmitError(`Failed to save ${t("submission").toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <div className="text-center">
          <div className="text-white text-2xl mb-2">Loading Dashboard...</div>
          <p className="text-gray-400">{contest.name}</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen p-4 md:p-8">
      <BackgroundPattern />

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                Participant Dashboard
              </h1>
              <p className="text-gray-400 mt-1">{contest.name}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {isAdmin && (
                <Link href={`/c/${slug}/admin`}>
                  <Button className="bg-gradient-to-r from-red-600 to-orange-500">
                    <Shield className="mr-2" size={18} />
                    Admin
                  </Button>
                </Link>
              )}
              {isJudge && (
                <Link href={`/c/${slug}/judging`}>
                  <Button className="bg-gradient-to-r from-hot-pink to-neon-purple">
                    <Award className="mr-2" size={18} />
                    {t("judge")}
                  </Button>
                </Link>
              )}
              <Link href={`/c/${slug}/rules`}>
                <Button
                  variant="outline"
                  className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                >
                  <BookOpen className="mr-2" size={18} />
                  Rules
                </Button>
              </Link>
              <Button
                onClick={() => signOut({ callbackUrl: "/login" })}
                variant="outline"
                className="border-white/20 text-white bg-white/10 hover:bg-red-500/20 hover:border-red-500/30"
              >
                <LogOut className="mr-2" size={18} />
                Sign Out
              </Button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* User Profile Section                                         */}
          {/* ============================================================ */}

          <GlassCard className="p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-neon-purple to-electric-blue flex items-center justify-center flex-shrink-0">
                  <User className="text-white" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {session?.user?.name || "User"}
                  </h2>
                  <p className="text-gray-400">{session?.user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {session?.user?.userType === "internal" && (
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                        TeamLease employee
                      </span>
                    )}
                    {contestMembership && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          contestMembership.role === "admin"
                            ? "bg-red-500/20 border border-red-500/30 text-red-400"
                            : contestMembership.role === "judge"
                            ? "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                            : "bg-blue-500/20 border border-blue-500/30 text-blue-400"
                        }`}
                      >
                        {contestMembership.role === "admin" && (
                          <Shield size={12} />
                        )}
                        {contestMembership.role === "judge" && (
                          <Award size={12} />
                        )}
                        {contestMembership.role}
                      </span>
                    )}
                    {contestMembership?.participantRole && (
                      <span className="text-xs text-gray-500">
                        ({contestMembership.participantRole})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={handleOpenEditProfile}
                variant="outline"
                className="border-white/20 text-white bg-white/10 hover:bg-white/20"
              >
                <Edit className="mr-2" size={16} />
                Edit Profile
              </Button>
            </div>
          </GlassCard>

          {/* Edit Profile Dialog */}
          <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Edit Profile
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="profileName" className="text-gray-200">
                    Name
                  </Label>
                  <Input
                    id="profileName"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, name: e.target.value })
                    }
                    placeholder="Enter your name"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="profileDepartment"
                    className="text-gray-200"
                  >
                    Department
                  </Label>
                  <Input
                    id="profileDepartment"
                    value={profileForm.department}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        department: e.target.value,
                      })
                    }
                    placeholder="Enter your department"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                {isParticipant && roleOptions.length > 0 && (
                  <div>
                    <Label htmlFor="profileRole" className="text-gray-200">
                      Your role in the {t("team").toLowerCase()}
                    </Label>
                    <Select value={profileRole || undefined} onValueChange={setProfileRole}>
                      <SelectTrigger
                        id="profileRole"
                        className="w-full bg-white/5 border-white/10 text-white"
                      >
                        <SelectValue placeholder="Choose your role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r.role} value={r.role}>
                            {r.role}
                            {r.maxPerTeam ? ` (max ${r.maxPerTeam} per ${t("team").toLowerCase()})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  onClick={handleUpdateProfile}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ============================================================ */}
          {/* Error / Success Banners                                      */}
          {/* ============================================================ */}

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400"
            >
              {success}
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* Team Section                                                  */}
          {/* ============================================================ */}

          <GlassCard className="p-8 mb-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Users className="text-neon-purple" size={32} />
                <h2 className="text-3xl font-bold text-white">
                  {multiTeam && myTeams.length > 1 ? `Your ${tp("team")}` : `Your ${t("team")}`}
                </h2>
                {multiTeam && myTeams.length > 1 && (
                  <select
                    aria-label={`Switch ${t("team").toLowerCase()}`}
                    value={contestMembership?.teamId ?? ""}
                    disabled={switchingTeam}
                    onChange={(e) => handleSwitchTeam(e.target.value)}
                    className="h-9 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white"
                  >
                    {myTeams.map((mt) => (
                      <option key={mt.id} value={mt.id} className="bg-[#0a0a0a]">
                        {mt.name}
                        {mt.status === "eliminated" ? " (out)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {(!team || (multiTeam && (isParticipant || isAdmin))) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Dialog
                          open={createTeamOpen}
                          onOpenChange={setCreateTeamOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              disabled={teamCount >= maxTeams || (isRegistrationClosed && !isAdmin)}
                              className="bg-gradient-to-r from-neon-purple to-electric-blue"
                              onClick={() => setCreateTeamOpen(true)}
                            >
                              <Plus className="mr-2" size={20} />
                              {team ? `Create Another ${t("team")}` : `Create ${t("team")}`}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#0a0a0a] border-white/10 max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-bold text-white">
                                Create New {t("team")}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div>
                                <Label
                                  htmlFor="teamName"
                                  className="text-gray-200"
                                >
                                  Team Name
                                </Label>
                                <Input
                                  id="teamName"
                                  value={teamName}
                                  onChange={(e) => setTeamName(e.target.value)}
                                  placeholder="Enter team name"
                                  className="bg-white/5 border-white/10 text-white"
                                />
                              </div>
                              {hasTracks && (
                                <div>
                                  <Label
                                    htmlFor="track"
                                    className="text-gray-200"
                                  >
                                    Select {trackWord}
                                  </Label>
                                  <Select
                                    value={selectedTrackId}
                                    onValueChange={setSelectedTrackId}
                                  >
                                    <SelectTrigger
                                      id="track"
                                      className="w-full bg-white/5 border-white/10 text-white"
                                    >
                                      <SelectValue
                                        placeholder={`Choose a ${trackWord.toLowerCase()}`}
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sortedTracks.map((track) => {
                                        const taken = takenTrackIds.includes(track.id);
                                        return (
                                          <SelectItem
                                            key={track.id}
                                            value={track.id}
                                            disabled={taken}
                                          >
                                            {track.name}
                                            {taken ? " (taken)" : ""}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                  {settings.exclusiveTracks && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Each {trackWord.toLowerCase()} can be picked by only one{" "}
                                      {t("team").toLowerCase()}.
                                    </p>
                                  )}
                                </div>
                              )}
                              {isParticipant && roleOptions.length > 0 && (
                                <div>
                                  <Label
                                    htmlFor="createRole"
                                    className="text-gray-200"
                                  >
                                    Your role in the {t("team").toLowerCase()}
                                  </Label>
                                  <Select
                                    value={
                                      createRole ||
                                      contestMembership?.participantRole ||
                                      undefined
                                    }
                                    onValueChange={setCreateRole}
                                  >
                                    <SelectTrigger
                                      id="createRole"
                                      className="w-full bg-white/5 border-white/10 text-white"
                                    >
                                      <SelectValue placeholder="Choose your role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roleOptions.map((r) => (
                                        <SelectItem key={r.role} value={r.role}>
                                          {r.role}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {contest.maxTeamMembers > 1 && (
                                <div className="space-y-3">
                                  <div>
                                    <Label className="text-gray-200">Teammates</Label>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Add up to {contest.maxTeamMembers - 1} by email. Each one
                                      is notified automatically.
                                    </p>
                                  </div>
                                  {memberRows.map((row) => (
                                    <MemberEmailRow
                                      key={row.id}
                                      apiBase={apiBase}
                                      teamWord={t("team")}
                                      value={row}
                                      onChange={(next) =>
                                        setMemberRows((rows) =>
                                          rows.map((r) => (r.id === row.id ? { ...next, id: r.id } : r))
                                        )
                                      }
                                      onRemove={
                                        memberRows.length > 1
                                          ? () =>
                                              setMemberRows((rows) =>
                                                rows.filter((r) => r.id !== row.id)
                                              )
                                          : undefined
                                      }
                                    />
                                  ))}
                                  {memberRows.length < contest.maxTeamMembers - 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        setMemberRows((rows) => [
                                          ...rows,
                                          { ...EMPTY_MEMBER, id: Math.max(...rows.map((r) => r.id)) + 1 },
                                        ])
                                      }
                                      className="w-full bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
                                    >
                                      <Plus className="mr-2" size={16} />
                                      Add another teammate
                                    </Button>
                                  )}
                                </div>
                              )}
                              <Button
                                onClick={handleCreateTeam}
                                className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                              >
                                Create Team
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TooltipTrigger>
                    {(teamCount >= maxTeams || (isRegistrationClosed && !isAdmin)) && (
                      <TooltipContent>
                        <p>{isRegistrationClosed ? "Registration deadline has passed" : `All ${maxTeams} team slots are full`}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {!team ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg mb-4">
                  You are not part of any team yet
                </p>
                <p className="text-gray-500">
                  Create a team or wait to be added by a team creator
                </p>
                <p className="text-sm text-gray-600 mt-4">
                  Teams Created: {teamCount} / {maxTeams}
                </p>
              </div>
            ) : (
              <div>
                {/* Team Info */}
                <div className="mb-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-2xl font-bold text-white">
                        {team.name}
                      </h3>
                      {team.approved && (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold">
                          <Award size={16} />
                          Approved for Competition
                        </span>
                      )}
                    </div>
                    {((isCreator && submissions.length === 0) || isAdmin) && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleOpenEditTeam}
                          variant="outline"
                          size="sm"
                          className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                        >
                          <Edit className="mr-2" size={14} />
                          Edit Team
                        </Button>
                        <Button
                          onClick={handleDeleteTeam}
                          variant="outline"
                          size="sm"
                          className="border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                        >
                          <Trash2 className="mr-2" size={14} />
                          Delete Team
                        </Button>
                      </div>
                    )}
                  </div>
                  {(hasTracks || team.trackId || team.track) && (
                    <p className="text-gray-400">
                      {trackWord}:{" "}
                      {team.trackRef?.name ||
                        getTrackName(team.trackId) ||
                        team.track ||
                        "N/A"}
                    </p>
                  )}
                  {!team.approved && (
                    <p className="text-sm text-yellow-400 mt-2">
                      Your {t("team").toLowerCase()} is pending approval by the
                      organisers
                    </p>
                  )}
                  {isParticipant &&
                    roleOptions.length > 0 &&
                    !contestMembership?.participantRole && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                        <span>
                          Pick your role in the {t("team").toLowerCase()} (
                          {roleOptions.map((r) => r.role).join(", ")}).
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenEditProfile}
                          className="h-7 border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        >
                          Choose role
                        </Button>
                      </div>
                    )}
                </div>

                {/* Team Members */}
                <div className="mb-6">
                  <h4 className="text-xl font-bold text-white mb-4">
                    Team Members ({teamMembers.filter((m) => m.contestRole !== "mentor").length}/
                    {contest.maxTeamMembers})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamMembers.filter((m) => m.contestRole !== "mentor").map((member) => (
                      <div
                        key={member.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-semibold">
                              {member.name}
                            </p>
                            {member.id === team.leaderId && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                                <Crown size={12} />
                                Team Leader
                              </span>
                            )}
                            {member.id === team.createdBy && (
                              <span className="text-xs text-neon-purple">
                                (Creator)
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {member.participantRole || member.role}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.email}
                          </p>
                          {member.department && (
                            <p className="text-xs text-gray-500">
                              {member.department}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {member.id !== team.leaderId && (
                            <Button
                              onClick={() => handleSetLeader(member.id)}
                              variant="ghost"
                              size="sm"
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              title="Make Team Leader"
                            >
                              <Crown size={16} />
                            </Button>
                          )}
                          {canManageTeam &&
                            member.id !== session?.user?.id &&
                            (submissions.length === 0 || isAdmin) && (
                              <Button
                                onClick={() => handleRemoveMember(member.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <UserMinus size={16} />
                              </Button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Member Button */}
                {canManageTeam &&
                  teamMembers.filter((m) => m.contestRole !== "mentor").length < contest.maxTeamMembers && (
                    <Button
                      onClick={() => {
                        setAddMemberOpen(true);
                      }}
                      variant="outline"
                      className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                    >
                      <Plus className="mr-2" size={16} />
                      Add Member
                    </Button>
                  )}

                {/* Mentor panel. Leaders / creators can add & remove; ordinary
                    members see a read-only view of who's mentoring the team. */}
                <div className="mt-6">
                  <TeamMentorPanel
                    slug={contest.slug}
                    teamId={team.id}
                    canManage={team.leaderId === session?.user?.id || isCreator}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {/* Add Member Dialog */}
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Add Team Member
                </DialogTitle>
                <p className="text-sm text-gray-400 mt-2">
                  Enter your teammate&apos;s email. They&apos;ll be notified automatically.
                </p>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <MemberEmailRow
                  apiBase={apiBase}
                  teamWord={t("team")}
                  teamId={team?.id}
                  value={newMember}
                  onChange={setNewMember}
                />
                <Button
                  onClick={handleAddMember}
                  disabled={!newMember.email.trim()}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Team Dialog */}
          <Dialog open={editTeamOpen} onOpenChange={setEditTeamOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Edit {t("team")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="editTeamName" className="text-gray-200">
                    Team Name
                  </Label>
                  <Input
                    id="editTeamName"
                    value={editTeamForm.name}
                    onChange={(e) =>
                      setEditTeamForm({
                        ...editTeamForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="Enter team name"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                {hasTracks && (
                  <div>
                    <Label htmlFor="editTeamTrack" className="text-gray-200">
                      Select {trackWord}
                    </Label>
                    <Select
                      value={editTeamForm.trackId}
                      onValueChange={(value) =>
                        setEditTeamForm({ ...editTeamForm, trackId: value })
                      }
                    >
                      <SelectTrigger
                        id="editTeamTrack"
                        className="w-full bg-white/5 border-white/10 text-white"
                      >
                        <SelectValue
                          placeholder={`Choose a ${trackWord.toLowerCase()}`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedTracks.map((track) => {
                          const taken =
                            takenTrackIds.includes(track.id) &&
                            track.id !== team?.trackId;
                          return (
                            <SelectItem
                              key={track.id}
                              value={track.id}
                              disabled={taken}
                            >
                              {track.name}
                              {taken ? " (taken)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  onClick={handleUpdateTeam}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ============================================================ */}
          {/* Ideathon: crew checklist, gate decisions, impact metrics     */}
          {/* ============================================================ */}

          {isIdeathon && contestMembership && <NextActionCard role={contestMembership.role} />}

          {team && isIdeathon && session?.user?.id && (
            <>
              <CrewPanel
                teamId={team.id}
                myUserId={session.user.id}
                canEdit={contestMembership?.role === "participant"}
                onChanged={() => {
                  void fetchMembership();
                  void loadTeamData(team.id);
                }}
              />
              {settings.impactMetricsEnabled && (
                <ImpactMetricsPanel teamId={team.id} canEdit={contestMembership?.role === "participant"} />
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* Leaderboard Section                                           */}
          {/* ============================================================ */}

          <GlassCard className="p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-hot-pink" size={32} />
              <h2 className="text-3xl font-bold text-white">
                Live Leaderboard
              </h2>
            </div>

            {leaderboardData.length > 0 ? (
              <>
                <Leaderboard entries={leaderboardData} />
                {team && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-neon-purple/10 to-electric-blue/10 border border-white/20 rounded-lg">
                    {(() => {
                      const teamRank = leaderboardData.findIndex(
                        (entry) => entry.teamId === team.id
                      );
                      const teamEntry = leaderboardData[teamRank];

                      if (teamRank === -1) {
                        return (
                          <p className="text-gray-400 text-center">
                            Your team hasn&apos;t been scored yet
                          </p>
                        );
                      }

                      return (
                        <div className="text-center">
                          <p className="text-white text-lg mb-2">
                            <span className="font-bold text-3xl mr-2">
                              {teamRank === 0
                                ? "#1"
                                : teamRank === 1
                                ? "#2"
                                : teamRank === 2
                                ? "#3"
                                : `#${teamRank + 1}`}
                            </span>
                            Your Team&apos;s Rank
                          </p>
                          <p className="text-4xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent mb-2">
                            {teamEntry.totalScore.toFixed(2)} points
                          </p>
                          {teamRank < 3 && (
                            <p className="text-green-400 font-semibold mt-3">
                              You&apos;re in a prize position!
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">
                  No scores available yet
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  The leaderboard will update as the {judgesWord} evaluate{" "}
                  {tp("submission").toLowerCase()}
                </p>
              </div>
            )}
          </GlassCard>

          {/* ============================================================ */}
          {/* Submissions Section                                           */}
          {/* ============================================================ */}

          {team && (
            <GlassCard className="p-8 mb-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Send className="text-electric-blue" size={32} />
                  <h2 className="text-3xl font-bold text-white">
                    {tp("submission")}
                  </h2>
                </div>

                {contestMembership?.role !== "mentor" && scorablePhases.length > 0 && (
                  <Dialog
                    open={submitWorkOpen}
                    onOpenChange={(open) => {
                      setSubmitWorkOpen(open);
                      if (!open) resetSubmitForm();
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-electric-blue to-hot-pink">
                        <Plus className="mr-2" size={20} />
                        Submit {submitNoun}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-white">
                          {isEditMode
                            ? `Edit ${t("submission")}`
                            : `Submit Your ${submitNoun}`}
                        </DialogTitle>
                        <p className="text-sm text-gray-400 mt-2">
                          {isEditMode ? "Editing" : "Submitting for"}{" "}
                          {t("team").toLowerCase()}:{" "}
                          <span className="text-neon-purple font-semibold">
                            {team.name}
                          </span>
                          {isEditMode && editingSubmission && (
                            <span className="text-electric-blue ml-2">
                              ({phaseWord} {editingSubmission.phase})
                            </span>
                          )}
                        </p>
                      </DialogHeader>
                      <div className="space-y-5 mt-4">
                        {/* Phase selector */}
                        <div>
                          <Label className="text-gray-200">{phaseWord}</Label>
                          <Select
                            value={submitPhase}
                            onValueChange={handleSelectSubmitPhase}
                            disabled={isEditMode}
                          >
                            <SelectTrigger
                              className={`w-full bg-white/5 border-white/10 text-white ${
                                isEditMode ? "opacity-60 cursor-not-allowed" : ""
                              }`}
                            >
                              <SelectValue
                                placeholder={`Select ${phaseWord.toLowerCase()}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {scorablePhases.map((phase) => (
                                <SelectItem
                                  key={phase.phase}
                                  value={phase.phase.toString()}
                                >
                                  {phaseWord} {phase.phase} - {phase.name} (
                                  {phase.maxPoints} pts)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isEditMode ? (
                            <p className="text-xs text-gray-500 mt-1">
                              {phaseWord} cannot be changed when editing
                            </p>
                          ) : (
                            submitPhase &&
                            submissions.some(
                              (sub) => sub.phase === Number(submitPhase)
                            ) && (
                              <p className="text-xs text-amber-400 mt-1">
                                You already submitted for this{" "}
                                {phaseWord.toLowerCase()} — submitting again
                                updates it.
                              </p>
                            )
                          )}
                        </div>

                        {submitPhase ? (
                          <DynamicSubmissionForm
                            fields={submissionFields}
                            phase={Number(submitPhase)}
                            values={submitValues}
                            onChange={setSubmitValues}
                            contestId={contest.id}
                            teamId={team.id}
                            disabled={submitting}
                            solutionPaths={team.solutionPaths}
                          />
                        ) : (
                          <p className="text-sm text-gray-500">
                            Choose a {phaseWord.toLowerCase()} to see what to
                            hand in.
                          </p>
                        )}

                        {submitError && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                            {submitError}
                          </div>
                        )}

                        <Button
                          onClick={handleSubmitWork}
                          disabled={submitting || !submitPhase}
                          className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                        >
                          {submitting
                            ? "Saving..."
                            : isEditMode
                            ? `Update ${t("submission")}`
                            : "Submit"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {/* Submission List */}
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">
                    No {tp("submission").toLowerCase()} yet
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Submit your work for any open {phaseWord.toLowerCase()} to
                    get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => {
                    const submissionStatus =
                      submissionStatuses[submission.id];
                    const phaseInfo = (contest.phaseConfig ?? []).find(
                      (p) => p.phase === submission.phase
                    );
                    const wasEdited =
                      !!submission.updatedAt &&
                      new Date(submission.updatedAt).getTime() >
                        new Date(submission.submittedAt).getTime() + 1000;

                    return (
                      <div
                        key={submission.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                      >
                        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                          <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-xl font-bold text-white">
                                {phaseWord} {submission.phase}
                                {phaseInfo && (
                                  <span className="text-gray-400 font-normal text-base ml-2">
                                    - {phaseInfo.name}
                                  </span>
                                )}
                              </h3>
                              {phaseInfo && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-neon-purple/20 border border-neon-purple/30 text-neon-purple">
                                  {phaseInfo.maxPoints} pts max
                                </span>
                              )}
                              {wasEdited && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                                  Edited
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              Submitted:{" "}
                              {new Date(
                                submission.submittedAt
                              ).toLocaleDateString()}
                              {wasEdited && submission.updatedAt && (
                                <span className="text-amber-400 ml-2">
                                  (Updated:{" "}
                                  {new Date(
                                    submission.updatedAt
                                  ).toLocaleDateString()}
                                  )
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {contestMembership?.role !== "mentor" && (
                              <Button
                                onClick={() =>
                                  handleOpenEditSubmission(submission)
                                }
                                variant="outline"
                                size="sm"
                                className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                              >
                                <Edit className="mr-2" size={14} />
                                Edit
                              </Button>
                            )}

                            {/* Status Badge */}
                            {submissionStatus && (
                              <div className="text-right">
                                {submissionStatus.judgesScored === 0 ? (
                                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-semibold">
                                    Not Evaluated
                                  </span>
                                ) : submissionStatus.isComplete ? (
                                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold">
                                    <CheckCircle size={16} />
                                    Evaluated
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-semibold">
                                    Under Review
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {submissionStatus.judgesScored} /{" "}
                                  {submissionStatus.totalJudges} {judgesWord}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submitted values, rendered from the contest's field config */}
                        <SubmissionView
                          fields={submissionFields}
                          values={valuesOf(submission)}
                          phase={submission.phase}
                          compact
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}

          {/* ============================================================ */}
          {/* Jury Feedback (visible once results are published)            */}
          {/* ============================================================ */}

          {team &&
            teamFeedback?.visible &&
            teamFeedback.phases.some(
              (p) => p.averageWeighted !== null || p.feedback.length > 0
            ) && (
              <GlassCard className="p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquareQuote className="text-hot-pink" size={32} />
                  <h2 className="text-3xl font-bold text-white">
                    {t("judge")} Feedback
                  </h2>
                </div>
                <div className="space-y-6">
                  {teamFeedback.phases
                    .filter(
                      (p) => p.averageWeighted !== null || p.feedback.length > 0
                    )
                    .map((p) => {
                      const maxPts =
                        (contest.phaseConfig ?? []).find(
                          (pc) => pc.phase === p.phase
                        )?.maxPoints ?? null;
                      return (
                        <div
                          key={p.phase}
                          className="bg-white/5 border border-white/10 rounded-lg p-6"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                            <h3 className="text-xl font-bold text-white">
                              {phaseWord} {p.phase}
                              <span className="text-gray-400 font-normal text-base ml-2">
                                - {p.name}
                              </span>
                            </h3>
                            {p.averageWeighted !== null && (
                              <div className="text-right">
                                <p className="text-2xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                                  {p.phasePoints?.toFixed(2)}
                                  {maxPts !== null && (
                                    <span className="text-sm text-gray-400 font-normal">
                                      {" "}
                                      / {maxPts} pts
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Average score {p.averageWeighted.toFixed(1)} / 100
                                </p>
                              </div>
                            )}
                          </div>
                          {p.feedback.length > 0 ? (
                            <ul className="space-y-3">
                              {p.feedback.map((f, i) => (
                                <li
                                  key={i}
                                  className="border-l-2 border-hot-pink/50 pl-4"
                                >
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                    {f.jury}
                                  </p>
                                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                                    {f.text}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">
                              No written feedback for this{" "}
                              {phaseWord.toLowerCase()}.
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </GlassCard>
            )}

          {/* ============================================================ */}
          {/* Footer Navigation                                             */}
          {/* ============================================================ */}

          <footer className="py-8 border-t border-white/10 mt-8">
            <div className="flex flex-col md:flex-row items-center justify-between text-gray-400 gap-4">
              <p>
                &copy; {new Date().getFullYear()} {contest.name}
              </p>
              <div className="flex gap-6 text-sm">
                <Link
                  href={`/c/${slug}`}
                  className="hover:text-white transition-colors"
                >
                  Home
                </Link>
                <Link
                  href={`/c/${slug}/rules`}
                  className="hover:text-white transition-colors"
                >
                  Rules
                </Link>
                <Link
                  href={`/c/${slug}/dashboard`}
                  className="hover:text-white transition-colors font-semibold text-white"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </footer>
        </motion.div>
      </div>
    </div>
  );
}
