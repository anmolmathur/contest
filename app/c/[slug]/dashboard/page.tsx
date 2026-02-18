"use client";

import { useContest } from "@/lib/contest-context";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import GlassCard from "@/components/GlassCard";
import Leaderboard from "@/components/Leaderboard";
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
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Team {
  id: string;
  name: string;
  track?: string | null;
  trackId?: string | null;
  createdBy: string;
  leaderId: string | null;
  approved: boolean;
  trackRef?: { id: string; name: string } | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  participantRole?: string | null;
}

interface Submission {
  id: string;
  phase: number;
  githubUrl: string;
  demoUrl: string;
  submissionDescription: string;
  aiPromptsUsed: string;
  aiToolsUtilized: string;
  aiScreenshots: string[];
  submittedAt: string;
  updatedAt?: string;
}

interface ContestMembership {
  id: string;
  role: string; // "admin" | "judge" | "participant"
  participantRole: string | null;
  teamId: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContestDashboardPage() {
  const { contest } = useContest();
  const { data: session, status } = useSession();
  const router = useRouter();

  // Membership / role state
  const [contestMembership, setContestMembership] =
    useState<ContestMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  // Team state
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [maxTeams, setMaxTeams] = useState(contest.maxTeams);

  // Submissions
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionStatuses, setSubmissionStatuses] = useState<
    Record<string, any>
  >({});

  // Leaderboard
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

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

  // Available users for add-member
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);

  // Create team form
  const [teamName, setTeamName] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");

  // Edit profile form
  const [profileForm, setProfileForm] = useState({ name: "", department: "" });

  // Edit team form
  const [editTeamForm, setEditTeamForm] = useState({
    name: "",
    trackId: "",
  });

  // Submission form
  const [submitForm, setSubmitForm] = useState({
    phase: "",
    githubUrl: "",
    demoUrl: "",
    submissionDescription: "",
    aiPromptsUsed: "",
    aiToolsUtilized: "",
    aiScreenshots: [""],
  });
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
  const isCreator = team?.createdBy === session?.user?.id;

  // Phases that accept submissions (maxPoints > 0)
  const scorablePhases = (contest.phaseConfig ?? []).filter(
    (p) => p.maxPoints > 0
  );

  // Track name resolver
  const getTrackName = useCallback(
    (trackId?: string | null) => {
      if (!trackId) return "N/A";
      const t = contest.tracks.find((tr) => tr.id === trackId);
      return t ? t.name : trackId;
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
        const me = (Array.isArray(usersData) ? usersData : []).find(
          (u: any) => u.userId === session.user.id
        );
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
        setApprovedCount(data.approvedCount || 0);
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

          // Load scoring statuses for each submission
          const statusPromises = (data.submissions || []).map(
            async (sub: Submission) => {
              try {
                const statusRes = await fetch(
                  `${apiBase}/submissions/${sub.id}`
                );
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  // Calculate scoring status from scores array
                  const scores = statusData.submission?.scores || [];
                  const judgesScored = scores.length;
                  const totalJudges = 3; // fallback
                  const avgScore =
                    judgesScored > 0
                      ? scores.reduce(
                          (sum: number, s: any) =>
                            sum + (s.totalScore || 0),
                          0
                        ) / judgesScored
                      : 0;
                  return [
                    sub.id,
                    {
                      judgesScored,
                      totalJudges,
                      isComplete: judgesScored >= totalJudges,
                      averageScore: avgScore,
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

  const loadAvailableUsers = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/teams/available-users`);
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error loading available users:", err);
    }
  }, [apiBase]);

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
        await Promise.all([loadTeamData(teamId), loadSubmissions(teamId)]);
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

    if (!teamName || !selectedTrackId) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/teams/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName, trackId: selectedTrackId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Team created successfully!");
      setCreateTeamOpen(false);
      setTeamName("");
      setSelectedTrackId("");

      // Reload everything
      await loadDashboardData();
    } catch {
      setError("Failed to create team");
    }
  };

  const handleAddMember = async (userId: string) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${apiBase}/teams/add-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId: team?.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Member added successfully!");
      if (team) {
        await loadTeamData(team.id);
        await loadAvailableUsers();
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
        body: JSON.stringify(editTeamForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
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

  const handleOpenEditProfile = async () => {
    // Pre-load current profile data so existing values are visible
    setProfileForm({
      name: session?.user?.name || "",
      department: "",
    });
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
    setSubmitForm({
      phase: "",
      githubUrl: "",
      demoUrl: "",
      submissionDescription: "",
      aiPromptsUsed: "",
      aiToolsUtilized: "",
      aiScreenshots: [""],
    });
    setEditingSubmission(null);
    setIsEditMode(false);
  };

  const handleOpenEditSubmission = (submission: Submission) => {
    setEditingSubmission(submission);
    setIsEditMode(true);
    setSubmitForm({
      phase: submission.phase.toString(),
      githubUrl: submission.githubUrl,
      demoUrl: submission.demoUrl,
      submissionDescription: submission.submissionDescription || "",
      aiPromptsUsed: submission.aiPromptsUsed || "",
      aiToolsUtilized: submission.aiToolsUtilized || "",
      aiScreenshots:
        submission.aiScreenshots?.length > 0
          ? submission.aiScreenshots
          : [""],
    });
    setSubmitWorkOpen(true);
  };

  const handleSubmitWork = async () => {
    setError("");
    setSuccess("");

    if (
      !submitForm.phase ||
      !submitForm.githubUrl ||
      !submitForm.demoUrl ||
      !submitForm.submissionDescription ||
      !submitForm.aiPromptsUsed ||
      !submitForm.aiToolsUtilized ||
      submitForm.aiScreenshots.filter((url) => url.trim()).length === 0
    ) {
      setError("All fields including AI evidence are required");
      return;
    }

    try {
      let res;

      if (isEditMode && editingSubmission) {
        res = await fetch(
          `${apiBase}/submissions/${editingSubmission.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              githubUrl: submitForm.githubUrl,
              demoUrl: submitForm.demoUrl,
              submissionDescription: submitForm.submissionDescription,
              aiPromptsUsed: submitForm.aiPromptsUsed,
              aiToolsUtilized: submitForm.aiToolsUtilized,
              aiScreenshots: submitForm.aiScreenshots.filter((url) =>
                url.trim()
              ),
            }),
          }
        );
      } else {
        res = await fetch(`${apiBase}/submissions/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: parseInt(submitForm.phase),
            githubUrl: submitForm.githubUrl,
            demoUrl: submitForm.demoUrl,
            submissionDescription: submitForm.submissionDescription,
            aiPromptsUsed: submitForm.aiPromptsUsed,
            aiToolsUtilized: submitForm.aiToolsUtilized,
            aiScreenshots: submitForm.aiScreenshots.filter((url) =>
              url.trim()
            ),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess(
        isEditMode
          ? "Submission updated successfully!"
          : data.updated
          ? "Submission updated successfully!"
          : "Submission created successfully!"
      );
      setSubmitWorkOpen(false);
      resetSubmitForm();

      if (team) {
        await loadSubmissions(team.id);
      }
    } catch {
      setError("Failed to submit work");
    }
  };

  const addScreenshotField = () => {
    setSubmitForm({
      ...submitForm,
      aiScreenshots: [...submitForm.aiScreenshots, ""],
    });
  };

  const removeScreenshotField = (index: number) => {
    setSubmitForm({
      ...submitForm,
      aiScreenshots: submitForm.aiScreenshots.filter((_, i) => i !== index),
    });
  };

  const updateScreenshotField = (index: number, value: string) => {
    const newScreenshots = [...submitForm.aiScreenshots];
    newScreenshots[index] = value;
    setSubmitForm({ ...submitForm, aiScreenshots: newScreenshots });
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
                    Judge
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
                    <span className="text-sm text-gray-500">
                      {session?.user?.role || "No role assigned"}
                    </span>
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
                <h2 className="text-3xl font-bold text-white">Your Team</h2>
              </div>

              {!team && (
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
                              disabled={teamCount >= maxTeams}
                              className="bg-gradient-to-r from-neon-purple to-electric-blue"
                              onClick={() => setCreateTeamOpen(true)}
                            >
                              <Plus className="mr-2" size={20} />
                              Create Team
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#0a0a0a] border-white/10">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-bold text-white">
                                Create New Team
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
                              <div>
                                <Label
                                  htmlFor="track"
                                  className="text-gray-200"
                                >
                                  Select Track
                                </Label>
                                <Select
                                  value={selectedTrackId}
                                  onValueChange={setSelectedTrackId}
                                >
                                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Choose a track" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {contest.tracks
                                      .sort(
                                        (a, b) => a.sortOrder - b.sortOrder
                                      )
                                      .map((track) => (
                                        <SelectItem
                                          key={track.id}
                                          value={track.id}
                                        >
                                          {track.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
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
                    {teamCount >= maxTeams && (
                      <TooltipContent>
                        <p>All {maxTeams} team slots are full</p>
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
                    {isCreator && submissions.length === 0 && (
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
                  <p className="text-gray-400">
                    Track:{" "}
                    {team.trackRef?.name ||
                      getTrackName(team.trackId) ||
                      team.track ||
                      "N/A"}
                  </p>
                  {!team.approved && (
                    <p className="text-sm text-yellow-400 mt-2">
                      Your team is pending approval from judges
                    </p>
                  )}
                </div>

                {/* Team Members */}
                <div className="mb-6">
                  <h4 className="text-xl font-bold text-white mb-4">
                    Team Members ({teamMembers.length}/
                    {contest.maxTeamMembers})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamMembers.map((member) => (
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
                          {isCreator &&
                            member.id !== team.createdBy &&
                            submissions.length === 0 && (
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
                {isCreator &&
                  teamMembers.length < contest.maxTeamMembers && (
                    <Button
                      onClick={() => {
                        setAddMemberOpen(true);
                        loadAvailableUsers();
                      }}
                      variant="outline"
                      className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                    >
                      <Plus className="mr-2" size={16} />
                      Add Member
                    </Button>
                  )}
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
                  Select a user to add to your team
                </p>
              </DialogHeader>
              <div className="mt-4">
                {availableUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No available users to add</p>
                    <p className="text-sm text-gray-500 mt-2">
                      All users are either already in teams or there are no
                      registered participants
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <p className="text-white font-semibold">
                            {user.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {user.participantRole || user.role}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.department && (
                            <p className="text-xs text-gray-500 mt-1">
                              Department: {user.department}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => handleAddMember(user.id)}
                          className="bg-gradient-to-r from-neon-purple to-electric-blue"
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Team Dialog */}
          <Dialog open={editTeamOpen} onOpenChange={setEditTeamOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Edit Team
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
                <div>
                  <Label htmlFor="editTeamTrack" className="text-gray-200">
                    Select Track
                  </Label>
                  <Select
                    value={editTeamForm.trackId}
                    onValueChange={(value) =>
                      setEditTeamForm({ ...editTeamForm, trackId: value })
                    }
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Choose a track" />
                    </SelectTrigger>
                    <SelectContent>
                      {contest.tracks
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((track) => (
                          <SelectItem key={track.id} value={track.id}>
                            {track.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  The leaderboard will update as judges evaluate submissions
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
                    Submissions
                  </h2>
                </div>

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
                      Submit Work
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-white">
                        {isEditMode ? "Edit Submission" : "Submit Your Work"}
                      </DialogTitle>
                      {team && (
                        <p className="text-sm text-gray-400 mt-2">
                          {isEditMode ? "Editing" : "Submitting for"} team:{" "}
                          <span className="text-neon-purple font-semibold">
                            {team.name}
                          </span>
                          {isEditMode && editingSubmission && (
                            <span className="text-electric-blue ml-2">
                              (Phase {editingSubmission.phase})
                            </span>
                          )}
                        </p>
                      )}
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      {/* Phase selector */}
                      <div>
                        <Label className="text-gray-200">Phase</Label>
                        <Select
                          value={submitForm.phase}
                          onValueChange={(value) =>
                            setSubmitForm({ ...submitForm, phase: value })
                          }
                          disabled={isEditMode}
                        >
                          <SelectTrigger
                            className={`bg-white/5 border-white/10 text-white ${
                              isEditMode
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                          <SelectContent>
                            {scorablePhases.map((phase) => (
                              <SelectItem
                                key={phase.phase}
                                value={phase.phase.toString()}
                              >
                                Phase {phase.phase} - {phase.name} (
                                {phase.maxPoints} pts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isEditMode && (
                          <p className="text-xs text-gray-500 mt-1">
                            Phase cannot be changed when editing
                          </p>
                        )}
                      </div>

                      {/* GitHub URL */}
                      <div>
                        <Label className="text-gray-200">GitHub URL</Label>
                        <Input
                          value={submitForm.githubUrl}
                          onChange={(e) =>
                            setSubmitForm({
                              ...submitForm,
                              githubUrl: e.target.value,
                            })
                          }
                          placeholder="https://github.com/..."
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>

                      {/* Demo URL */}
                      <div>
                        <Label className="text-gray-200">Demo URL</Label>
                        <Input
                          value={submitForm.demoUrl}
                          onChange={(e) =>
                            setSubmitForm({
                              ...submitForm,
                              demoUrl: e.target.value,
                            })
                          }
                          placeholder="https://..."
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>

                      {/* Submission Description */}
                      <div>
                        <Label className="text-gray-200">
                          Submission Description (Required)
                        </Label>
                        <Textarea
                          value={submitForm.submissionDescription}
                          onChange={(e) =>
                            setSubmitForm({
                              ...submitForm,
                              submissionDescription: e.target.value,
                            })
                          }
                          placeholder="Describe your changes, updates, and include Google Drive URL for complete documentation..."
                          className="bg-white/5 border-white/10 text-white min-h-[120px]"
                        />
                      </div>

                      {/* AI Prompts Used */}
                      <div>
                        <Label className="text-gray-200">
                          AI Prompts Used (Required)
                        </Label>
                        <Textarea
                          value={submitForm.aiPromptsUsed}
                          onChange={(e) =>
                            setSubmitForm({
                              ...submitForm,
                              aiPromptsUsed: e.target.value,
                            })
                          }
                          placeholder="Document all AI prompts you used..."
                          className="bg-white/5 border-white/10 text-white min-h-[100px]"
                        />
                      </div>

                      {/* AI Tools Utilized */}
                      <div>
                        <Label className="text-gray-200">
                          AI Tools Utilized (Required)
                        </Label>
                        <Textarea
                          value={submitForm.aiToolsUtilized}
                          onChange={(e) =>
                            setSubmitForm({
                              ...submitForm,
                              aiToolsUtilized: e.target.value,
                            })
                          }
                          placeholder="List all AI tools (ChatGPT, Copilot, Claude, etc.)..."
                          className="bg-white/5 border-white/10 text-white min-h-[100px]"
                        />
                      </div>

                      {/* AI Screenshots */}
                      <div>
                        <Label className="text-gray-200">
                          AI Screenshots (URLs Required)
                        </Label>
                        {submitForm.aiScreenshots.map((url, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <Input
                              value={url}
                              onChange={(e) =>
                                updateScreenshotField(index, e.target.value)
                              }
                              placeholder="https://..."
                              className="bg-white/5 border-white/10 text-white"
                            />
                            {submitForm.aiScreenshots.length > 1 && (
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() => removeScreenshotField(index)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addScreenshotField}
                          className="mt-2 border-white/20 text-white bg-white/10 hover:bg-white/20"
                        >
                          <Plus className="mr-2" size={16} />
                          Add Screenshot URL
                        </Button>
                      </div>

                      <Button
                        onClick={handleSubmitWork}
                        className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                      >
                        {isEditMode ? "Update Submission" : "Submit"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Submission List */}
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">
                    No submissions yet
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Submit your work for any available phase to get started
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

                    return (
                      <div
                        key={submission.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                      >
                        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                          <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-xl font-bold text-white">
                                Phase {submission.phase}
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
                              {submission.updatedAt &&
                                new Date(submission.updatedAt).getTime() >
                                  new Date(
                                    submission.submittedAt
                                  ).getTime() +
                                    1000 && (
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
                              {submission.updatedAt &&
                                new Date(submission.updatedAt).getTime() >
                                  new Date(
                                    submission.submittedAt
                                  ).getTime() +
                                    1000 && (
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
                                  {submissionStatus.totalJudges} judges
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Links */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <a
                            href={submission.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-electric-blue hover:underline text-sm"
                          >
                            View GitHub Repo &rarr;
                          </a>
                          <a
                            href={submission.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-hot-pink hover:underline text-sm"
                          >
                            View Demo &rarr;
                          </a>
                        </div>

                        {/* Score Display (if available) */}
                        {submissionStatus &&
                          submissionStatus.averageScore > 0 && (
                            <div className="border-t border-white/10 pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-gray-400 text-lg">
                                  Average Score:
                                </span>
                                <span className="text-3xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                                  {submissionStatus.averageScore.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
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
