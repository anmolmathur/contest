"use client";

import { useContest } from "@/lib/contest-context";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import GlassCard from "@/components/GlassCard";
import BackgroundPattern from "@/components/BackgroundPattern";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UsersRound,
  Award,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Home,
  Eye,
  Send,
  Key,
  ExternalLink,
  Crown,
  FileText,
  Settings,
  Loader2,
  ShieldAlert,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Gavel,
  Layers,
  CheckCircle,
  XCircle,
} from "lucide-react";
import CertificateTab from "@/components/certificates/CertificateTab";
import type { ScoringCriterion, PhaseConfig, Prize, RoleConfig } from "@/lib/contest-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContestUserEntry {
  id: string;
  contestId: string;
  userId: string;
  role: string;
  participantRole: string | null;
  teamId: string | null;
  createdAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    globalRole: string;
  };
}

interface PlatformUser {
  id: string;
  name: string | null;
  email: string;
  globalRole: string;
}

interface Team {
  id: string;
  name: string;
  track: string | null;
  trackName: string | null;
  approved: boolean;
  leaderId: string | null;
  members: any[];
  submissions?: any[];
}

interface Track {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
}

interface Score {
  id: string;
  submissionId: string;
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  teamId: string;
  teamName: string;
  phase: number;
  criteriaScores: Record<string, number> | null;
  weightedScore: string;
}

interface Submission {
  id: string;
  teamId: string;
  teamName: string;
  track: string | null;
  phase: number;
  githubUrl: string;
  demoUrl: string;
  submissionDescription: string | null;
  aiPromptsUsed: string;
  aiToolsUtilized: string;
  aiScreenshots: string[];
  submittedAt: string;
  updatedAt: string;
  wasEdited: boolean;
  scoresCount: number;
  totalJudges: number;
  isFullyScored: boolean;
}

type TabType =
  | "summary"
  | "users"
  | "judges"
  | "tracks"
  | "teams"
  | "submissions"
  | "scores"
  | "certificates"
  | "settings";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContestAdminPage() {
  const { contest } = useContest();
  const { data: session, status } = useSession();

  const slug = contest.slug;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Data
  const [contestUsers, setContestUsers] = useState<ContestUserEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);

  // Dialogs
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState("");
  const [addUserRole, setAddUserRole] = useState("participant");
  const [addUserParticipantRole, setAddUserParticipantRole] = useState("");
  const [selectedPlatformUser, setSelectedPlatformUser] = useState<PlatformUser | null>(null);

  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<ContestUserEntry | null>(null);
  const [editRoleValue, setEditRoleValue] = useState("");

  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [trackForm, setTrackForm] = useState({ name: "", description: "", icon: "" });

  const [viewSubmissionOpen, setViewSubmissionOpen] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  const [viewTeamOpen, setViewTeamOpen] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);

  // Settings form (contest config)
  const [settingsForm, setSettingsForm] = useState({
    name: contest.name,
    slug: contest.slug,
    description: contest.description || "",
    status: contest.status,
    heroTitle: contest.heroTitle || "",
    heroSubtitle: contest.heroSubtitle || "",
    rulesContent: contest.rulesContent || "",
    maxTeams: contest.maxTeams,
    maxApprovedTeams: contest.maxApprovedTeams,
    maxTeamMembers: contest.maxTeamMembers,
  });
  const [scoringCriteriaForm, setScoringCriteriaForm] = useState<ScoringCriterion[]>(
    contest.scoringCriteria || []
  );
  const [phaseConfigForm, setPhaseConfigForm] = useState<PhaseConfig[]>(
    contest.phaseConfig || []
  );
  const [prizesForm, setPrizesForm] = useState<Prize[]>(contest.prizes || []);
  const [roleConfigForm, setRoleConfigForm] = useState<RoleConfig[]>(
    contest.roleConfig || []
  );

  // -----------------------------------------------------------------------
  // Access check
  // -----------------------------------------------------------------------
  const checkAdminAccess = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/c/${slug}/users`);
      if (!res.ok) {
        // Might also be platform admin
        if (session.user.globalRole === "platform_admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
        return;
      }
      const data: ContestUserEntry[] = await res.json();
      const me = data.find((u) => u.userId === session.user.id || u.user?.id === session.user.id);
      if (me && me.role === "admin") {
        setIsAdmin(true);
      } else if (session.user.globalRole === "platform_admin") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch {
      if (session.user.globalRole === "platform_admin") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    }
  }, [session, slug]);

  // -----------------------------------------------------------------------
  // Data loaders
  // -----------------------------------------------------------------------
  const loadContestUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/users`);
      if (res.ok) {
        const data = await res.json();
        setContestUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error loading contest users:", err);
    }
  }, [slug]);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/teams/all`);
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      console.error("Error loading teams:", err);
    }
  }, [slug]);

  const loadTracks = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(Array.isArray(data) ? data : data.tracks || []);
      }
    } catch (err) {
      console.error("Error loading tracks:", err);
    }
  }, [slug]);

  const loadScores = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/scores/all`);
      const data = await res.json();
      setScores(data.scores || []);
    } catch (err) {
      console.error("Error loading scores:", err);
    }
  }, [slug]);

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${slug}/submissions/all`);
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error("Error loading submissions:", err);
    }
  }, [slug]);

  const loadPlatformUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users/all");
      const data = await res.json();
      setPlatformUsers(data.users || []);
    } catch (err) {
      console.error("Error loading platform users:", err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadContestUsers(),
      loadTeams(),
      loadTracks(),
      loadScores(),
      loadSubmissions(),
    ]);
    setLoading(false);
  }, [loadContestUsers, loadTeams, loadTracks, loadScores, loadSubmissions]);

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (status === "authenticated") {
      checkAdminAccess();
    }
  }, [status, checkAdminAccess]);

  useEffect(() => {
    if (isAdmin === true) {
      loadAllData();
    } else if (isAdmin === false) {
      setLoading(false);
    }
  }, [isAdmin, loadAllData]);

  // -----------------------------------------------------------------------
  // User actions
  // -----------------------------------------------------------------------
  const handleAddUserToContest = async () => {
    if (!selectedPlatformUser) {
      setError("Select a user to add");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/users/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedPlatformUser.id,
          role: addUserRole,
          participantRole: addUserRole === "participant" ? addUserParticipantRole : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add user");
        return;
      }
      setSuccess(`${selectedPlatformUser.name || selectedPlatformUser.email} added to contest`);
      setAddUserOpen(false);
      setSelectedPlatformUser(null);
      setAddUserSearch("");
      loadContestUsers();
    } catch {
      setError("Failed to add user");
    }
  };

  const handleChangeRole = async () => {
    if (!editRoleUser) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/users/${editRoleUser.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRoleValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change role");
        return;
      }
      setSuccess("Role updated");
      setEditRoleOpen(false);
      setEditRoleUser(null);
      loadContestUsers();
    } catch {
      setError("Failed to change role");
    }
  };

  const handleRemoveUser = async (contestUserId: string) => {
    if (!confirm("Remove this user from the contest?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/users/${contestUserId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to remove user");
        return;
      }
      setSuccess("User removed from contest");
      loadContestUsers();
    } catch {
      setError("Failed to remove user");
    }
  };

  // -----------------------------------------------------------------------
  // Track actions
  // -----------------------------------------------------------------------
  const openCreateTrack = () => {
    setEditingTrack(null);
    setTrackForm({ name: "", description: "", icon: "" });
    setTrackDialogOpen(true);
  };

  const openEditTrack = (track: Track) => {
    setEditingTrack(track);
    setTrackForm({
      name: track.name,
      description: track.description || "",
      icon: track.icon || "",
    });
    setTrackDialogOpen(true);
  };

  const handleSaveTrack = async () => {
    if (!trackForm.name) {
      setError("Track name is required");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const url = editingTrack
        ? `/api/c/${slug}/tracks/${editingTrack.id}`
        : `/api/c/${slug}/tracks`;
      const method = editingTrack ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trackForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save track");
        return;
      }
      setSuccess(editingTrack ? "Track updated" : "Track created");
      setTrackDialogOpen(false);
      loadTracks();
    } catch {
      setError("Failed to save track");
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm("Delete this track? Teams using it may be affected.")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/tracks/${trackId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete track");
        return;
      }
      setSuccess("Track deleted");
      loadTracks();
    } catch {
      setError("Failed to delete track");
    }
  };

  const handleMoveTrack = async (trackId: string, direction: "up" | "down") => {
    const sorted = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((t) => t.id === trackId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Swap sortOrder values between the two tracks
    const currentTrack = sorted[idx];
    const swapTrack = sorted[swapIdx];

    setError("");
    try {
      // Update both tracks' sortOrder
      const [res1, res2] = await Promise.all([
        fetch(`/api/c/${slug}/tracks/${currentTrack.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swapTrack.sortOrder }),
        }),
        fetch(`/api/c/${slug}/tracks/${swapTrack.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: currentTrack.sortOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) {
        setError("Failed to reorder tracks");
        return;
      }
      loadTracks();
    } catch {
      setError("Failed to reorder tracks");
    }
  };

  // -----------------------------------------------------------------------
  // Team actions
  // -----------------------------------------------------------------------
  const handleToggleApproval = async (teamId: string, currentStatus: boolean) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/teams/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, approved: !currentStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update approval");
        return;
      }
      setSuccess(data.message || "Team approval updated");
      loadTeams();
    } catch {
      setError("Failed to update team approval");
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Delete this team? All members will be unassigned.")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/teams/${teamId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete team");
        return;
      }
      setSuccess("Team deleted");
      loadTeams();
      loadContestUsers();
    } catch {
      setError("Failed to delete team");
    }
  };

  // -----------------------------------------------------------------------
  // Score actions
  // -----------------------------------------------------------------------
  const handleDeleteScore = async (scoreId: string) => {
    if (!confirm("Delete this score?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/scores/${scoreId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete score");
        return;
      }
      setSuccess("Score deleted");
      loadScores();
    } catch {
      setError("Failed to delete score");
    }
  };

  // -----------------------------------------------------------------------
  // Submission actions
  // -----------------------------------------------------------------------
  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm("Delete this submission and all associated scores?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/c/${slug}/submissions/${submissionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete submission");
        return;
      }
      setSuccess("Submission deleted");
      loadSubmissions();
      loadScores();
    } catch {
      setError("Failed to delete submission");
    }
  };

  // -----------------------------------------------------------------------
  // Settings save
  // -----------------------------------------------------------------------
  const handleSaveSettings = async () => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/contests/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settingsForm,
          scoringCriteria: scoringCriteriaForm,
          phaseConfig: phaseConfigForm,
          prizes: prizesForm,
          roleConfig: roleConfigForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save settings");
        return;
      }
      setSuccess("Contest settings saved. Reload the page to see changes.");
    } catch {
      setError("Failed to save settings");
    }
  };

  // Scoring criteria helpers
  const addScoringCriterion = () => {
    setScoringCriteriaForm([
      ...scoringCriteriaForm,
      { name: "", key: "", weight: 0.1, description: "" },
    ]);
  };
  const removeScoringCriterion = (index: number) => {
    setScoringCriteriaForm(scoringCriteriaForm.filter((_, i) => i !== index));
  };
  const updateScoringCriterion = (index: number, field: string, value: string | number) => {
    const updated = [...scoringCriteriaForm];
    (updated[index] as any)[field] = value;
    setScoringCriteriaForm(updated);
  };
  const moveScoringCriterion = (index: number, direction: "up" | "down") => {
    const updated = [...scoringCriteriaForm];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setScoringCriteriaForm(updated);
  };

  // Phase config helpers
  const addPhaseConfig = () => {
    const nextPhase = phaseConfigForm.length > 0 ? Math.max(...phaseConfigForm.map((p) => p.phase)) + 1 : 1;
    setPhaseConfigForm([
      ...phaseConfigForm,
      { phase: nextPhase, name: "", maxPoints: 0, startDate: "", endDate: "", description: "", details: [], deliverables: [] },
    ]);
  };
  const removePhaseConfig = (index: number) => {
    setPhaseConfigForm(phaseConfigForm.filter((_, i) => i !== index));
  };
  const updatePhaseConfig = (index: number, field: string, value: any) => {
    const updated = [...phaseConfigForm];
    (updated[index] as any)[field] = value;
    setPhaseConfigForm(updated);
  };

  // Prize helpers
  const addPrize = () => {
    const nextRank = prizesForm.length > 0 ? Math.max(...prizesForm.map((p) => p.rank)) + 1 : 1;
    setPrizesForm([...prizesForm, { rank: nextRank, label: "", amount: null, color: "gold" }]);
  };
  const removePrize = (index: number) => {
    setPrizesForm(prizesForm.filter((_, i) => i !== index));
  };
  const updatePrize = (index: number, field: string, value: any) => {
    const updated = [...prizesForm];
    (updated[index] as any)[field] = value;
    setPrizesForm(updated);
  };

  // Role config helpers
  const addRoleConfig = () => {
    setRoleConfigForm([...roleConfigForm, { role: "", maxPerTeam: 1 }]);
  };
  const removeRoleConfig = (index: number) => {
    setRoleConfigForm(roleConfigForm.filter((_, i) => i !== index));
  };
  const updateRoleConfig = (index: number, field: string, value: any) => {
    const updated = [...roleConfigForm];
    (updated[index] as any)[field] = value;
    setRoleConfigForm(updated);
  };

  // -----------------------------------------------------------------------
  // Summary stats
  // -----------------------------------------------------------------------
  const stats = {
    totalUsers: contestUsers.length,
    participants: contestUsers.filter((u) => u.role === "participant").length,
    judges: contestUsers.filter((u) => u.role === "judge").length,
    admins: contestUsers.filter((u) => u.role === "admin").length,
    totalTeams: teams.length,
    approvedTeams: teams.filter((t) => t.approved).length,
    totalSubmissions: submissions.length,
    totalScores: scores.length,
    totalTracks: tracks.length,
  };

  // Filtered users for search
  const filteredPlatformUsers = addUserSearch
    ? platformUsers.filter(
        (u) =>
          (u.name?.toLowerCase().includes(addUserSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(addUserSearch.toLowerCase())) &&
          !contestUsers.some((cu) => cu.userId === u.id)
      )
    : [];

  // -----------------------------------------------------------------------
  // Render guards
  // -----------------------------------------------------------------------
  if (status === "loading" || (status === "authenticated" && isAdmin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <Loader2 className="animate-spin text-neon-purple" size={48} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <GlassCard className="p-12 text-center max-w-md">
          <ShieldAlert className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Not Signed In</h2>
          <p className="text-gray-400 mb-6">You need to sign in to access the admin panel.</p>
          <Link href="/login">
            <GlowButton>Sign In</GlowButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <GlassCard className="p-12 text-center max-w-md">
          <ShieldAlert className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            You are not an admin for <span className="text-white font-semibold">{contest.name}</span>.
          </p>
          <Link href={`/c/${slug}`}>
            <GlowButton>Back to Contest</GlowButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <div className="text-center">
          <Loader2 className="animate-spin text-neon-purple mx-auto mb-4" size={48} />
          <p className="text-gray-400">Loading admin data...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Tabs config
  // -----------------------------------------------------------------------
  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "summary", label: "Summary", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "judges", label: "Judges", icon: Gavel },
    { id: "tracks", label: "Tracks", icon: Layers },
    { id: "teams", label: "Teams", icon: UsersRound },
    { id: "submissions", label: "Submissions", icon: Send },
    { id: "scores", label: "Scores", icon: Award },
    { id: "certificates", label: "Certificates", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen p-8">
      <BackgroundPattern />

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                Admin Panel
              </h1>
              <p className="text-gray-400 text-sm mt-1">{contest.name}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/c/${slug}`}>
                <Button variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20">
                  <Home className="mr-2" size={18} />
                  Contest Home
                </Button>
              </Link>
              <Link href={`/c/${slug}/judging`}>
                <Button className="bg-gradient-to-r from-hot-pink to-neon-purple">
                  <Award className="mr-2" size={18} />
                  Judging
                </Button>
              </Link>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
              {success}
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant="outline"
                className={`border-white/20 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-neon-purple/20 text-neon-purple border-neon-purple/30"
                    : "text-gray-400 bg-white/5 hover:bg-white/10"
                }`}
              >
                <tab.icon className="mr-2" size={18} />
                {tab.label}
              </Button>
            ))}
          </div>

          {/* ============================================================= */}
          {/* SUMMARY TAB                                                    */}
          {/* ============================================================= */}
          {activeTab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Users className="text-neon-purple" size={32} />
                  <h3 className="text-2xl font-bold text-white">Users</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400"><span>Total:</span><span className="text-white font-semibold">{stats.totalUsers}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Participants:</span><span className="text-green-400 font-semibold">{stats.participants}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Judges:</span><span className="text-electric-blue font-semibold">{stats.judges}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Admins:</span><span className="text-hot-pink font-semibold">{stats.admins}</span></div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <UsersRound className="text-electric-blue" size={32} />
                  <h3 className="text-2xl font-bold text-white">Teams</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400"><span>Total:</span><span className="text-white font-semibold">{stats.totalTeams}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Approved:</span><span className="text-green-400 font-semibold">{stats.approvedTeams}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Pending:</span><span className="text-yellow-400 font-semibold">{stats.totalTeams - stats.approvedTeams}</span></div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Send className="text-hot-pink" size={32} />
                  <h3 className="text-2xl font-bold text-white">Submissions</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400"><span>Total:</span><span className="text-white font-semibold">{stats.totalSubmissions}</span></div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Award className="text-yellow-400" size={32} />
                  <h3 className="text-2xl font-bold text-white">Scores</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400"><span>Total:</span><span className="text-white font-semibold">{stats.totalScores}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Tracks:</span><span className="text-electric-blue font-semibold">{stats.totalTracks}</span></div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* ============================================================= */}
          {/* USERS TAB                                                      */}
          {/* ============================================================= */}
          {activeTab === "users" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Contest Users</h3>
                <Button
                  onClick={() => { setAddUserOpen(true); loadPlatformUsers(); }}
                  className="bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  <Plus className="mr-2" size={18} />
                  Add User
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Name</TableHead>
                      <TableHead className="text-gray-400">Email</TableHead>
                      <TableHead className="text-gray-400">Contest Role</TableHead>
                      <TableHead className="text-gray-400">Participant Role</TableHead>
                      <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contestUsers.map((cu) => (
                      <TableRow key={cu.id} className="border-white/10">
                        <TableCell className="text-white font-semibold">{cu.user?.name || "Unnamed"}</TableCell>
                        <TableCell className="text-gray-400">{cu.user?.email}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            cu.role === "admin" ? "bg-hot-pink/20 text-hot-pink" :
                            cu.role === "judge" ? "bg-electric-blue/20 text-electric-blue" :
                            "bg-green-500/20 text-green-400"
                          }`}>
                            {cu.role}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">{cu.participantRole || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => { setEditRoleUser(cu); setEditRoleValue(cu.role); setEditRoleOpen(true); }}
                              variant="ghost" size="sm"
                              className="text-electric-blue hover:text-electric-blue hover:bg-electric-blue/10"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              onClick={() => handleRemoveUser(cu.id)}
                              variant="ghost" size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          )}

          {/* ============================================================= */}
          {/* JUDGES TAB                                                     */}
          {/* ============================================================= */}
          {activeTab === "judges" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Judges</h3>
              </div>
              {contestUsers.filter((cu) => cu.role === "judge" || cu.role === "admin").length === 0 ? (
                <p className="text-gray-400 text-center py-12">No judges assigned to this contest. Go to Users tab to add judges.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-gray-400">Name</TableHead>
                        <TableHead className="text-gray-400">Email</TableHead>
                        <TableHead className="text-gray-400">Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contestUsers.filter((cu) => cu.role === "judge" || cu.role === "admin").map((cu) => (
                        <TableRow key={cu.id} className="border-white/10">
                          <TableCell className="text-white font-semibold">{cu.user?.name || "Unnamed"}</TableCell>
                          <TableCell className="text-gray-400">{cu.user?.email}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              cu.role === "admin" ? "bg-hot-pink/20 text-hot-pink" : "bg-electric-blue/20 text-electric-blue"
                            }`}>
                              {cu.role}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          )}

          {/* ============================================================= */}
          {/* TRACKS TAB                                                     */}
          {/* ============================================================= */}
          {activeTab === "tracks" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Tracks</h3>
                <Button onClick={openCreateTrack} className="bg-gradient-to-r from-neon-purple to-electric-blue">
                  <Plus className="mr-2" size={18} />
                  Add Track
                </Button>
              </div>
              {tracks.length === 0 ? (
                <p className="text-gray-400 text-center py-12">No tracks created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-gray-400 w-24">Order</TableHead>
                        <TableHead className="text-gray-400">Name</TableHead>
                        <TableHead className="text-gray-400">Description</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tracks.sort((a, b) => a.sortOrder - b.sortOrder).map((track, idx, sortedArr) => (
                        <TableRow key={track.id} className="border-white/10">
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-6 text-center">{idx + 1}</span>
                              <div className="flex flex-col">
                                <Button
                                  onClick={() => handleMoveTrack(track.id, "up")}
                                  variant="ghost"
                                  size="sm"
                                  disabled={idx === 0}
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                  <ArrowUp size={14} />
                                </Button>
                                <Button
                                  onClick={() => handleMoveTrack(track.id, "down")}
                                  variant="ghost"
                                  size="sm"
                                  disabled={idx === sortedArr.length - 1}
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                  <ArrowDown size={14} />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-white font-semibold">{track.name}</TableCell>
                          <TableCell className="text-gray-400 max-w-xs truncate">{track.description || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button onClick={() => openEditTrack(track)} variant="ghost" size="sm" className="text-electric-blue hover:bg-electric-blue/10">
                                <Edit size={16} />
                              </Button>
                              <Button onClick={() => handleDeleteTrack(track.id)} variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          )}

          {/* ============================================================= */}
          {/* TEAMS TAB                                                      */}
          {/* ============================================================= */}
          {activeTab === "teams" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Teams</h3>
                <p className="text-gray-400 text-sm">
                  Approved: {stats.approvedTeams} / {contest.maxApprovedTeams}
                </p>
              </div>
              {teams.length === 0 ? (
                <p className="text-gray-400 text-center py-12">No teams yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-gray-400">Name</TableHead>
                        <TableHead className="text-gray-400">Track</TableHead>
                        <TableHead className="text-gray-400">Members</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow key={team.id} className="border-white/10">
                          <TableCell className="text-white font-semibold">{team.name}</TableCell>
                          <TableCell className="text-gray-400">{team.trackName || team.track || "-"}</TableCell>
                          <TableCell className="text-gray-400">{team.members?.length || 0}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              team.approved ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                              {team.approved ? "Approved" : "Pending"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                onClick={() => { setViewingTeam(team); setViewTeamOpen(true); }}
                                variant="ghost" size="sm" className="text-neon-purple hover:bg-neon-purple/10"
                              >
                                <Eye size={16} />
                              </Button>
                              <Button
                                onClick={() => handleToggleApproval(team.id, team.approved)}
                                variant="ghost" size="sm"
                                className={team.approved ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"}
                                disabled={!team.approved && stats.approvedTeams >= contest.maxApprovedTeams}
                              >
                                {team.approved ? <XCircle size={16} /> : <CheckCircle size={16} />}
                              </Button>
                              <Button onClick={() => handleDeleteTeam(team.id)} variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          )}

          {/* ============================================================= */}
          {/* SUBMISSIONS TAB                                                */}
          {/* ============================================================= */}
          {activeTab === "submissions" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Submissions</h3>
              </div>
              {submissions.length === 0 ? (
                <p className="text-gray-400 text-center py-12">No submissions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-gray-400">Team</TableHead>
                        <TableHead className="text-gray-400">Phase</TableHead>
                        <TableHead className="text-gray-400">Submitted</TableHead>
                        <TableHead className="text-gray-400">Scores</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((sub) => (
                        <TableRow key={sub.id} className="border-white/10">
                          <TableCell className="text-white font-semibold">{sub.teamName}</TableCell>
                          <TableCell className="text-gray-400">Phase {sub.phase}</TableCell>
                          <TableCell className="text-gray-400">
                            {new Date(sub.submittedAt).toLocaleDateString()}
                            {sub.wasEdited && <span className="block text-xs text-amber-400">Edited</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              sub.isFullyScored ? "bg-green-500/20 text-green-400" :
                              sub.scoresCount > 0 ? "bg-blue-500/20 text-blue-400" :
                              "bg-gray-500/20 text-gray-400"
                            }`}>
                              {sub.scoresCount} / {sub.totalJudges}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                onClick={() => { setViewingSubmission(sub); setViewSubmissionOpen(true); }}
                                variant="ghost" size="sm" className="text-neon-purple hover:bg-neon-purple/10"
                              >
                                <Eye size={16} />
                              </Button>
                              <Button onClick={() => handleDeleteSubmission(sub.id)} variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          )}

          {/* ============================================================= */}
          {/* SCORES TAB                                                     */}
          {/* ============================================================= */}
          {activeTab === "scores" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Scores</h3>
              </div>
              {scores.length === 0 ? (
                <p className="text-gray-400 text-center py-12">No scores yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-gray-400">Team</TableHead>
                        <TableHead className="text-gray-400">Phase</TableHead>
                        <TableHead className="text-gray-400">Judge</TableHead>
                        <TableHead className="text-gray-400 text-center">Weighted</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scores.map((score) => (
                        <TableRow key={score.id} className="border-white/10">
                          <TableCell className="text-white font-semibold">{score.teamName}</TableCell>
                          <TableCell className="text-gray-400">Phase {score.phase}</TableCell>
                          <TableCell className="text-gray-400">{score.judgeName}</TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                              {score.weightedScore}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button onClick={() => handleDeleteScore(score.id)} variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          )}

          {/* ============================================================= */}
          {/* CERTIFICATES TAB                                               */}
          {/* ============================================================= */}
          {activeTab === "certificates" && (
            <CertificateTab setError={setError} setSuccess={setSuccess} />
          )}

          {/* ============================================================= */}
          {/* SETTINGS TAB                                                   */}
          {/* ============================================================= */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Basic Info */}
              <GlassCard className="p-6">
                <h3 className="text-2xl font-bold text-white mb-6">Contest Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-200">Name</Label>
                    <Input value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Slug</Label>
                    <Input value={settingsForm.slug} onChange={(e) => setSettingsForm({ ...settingsForm, slug: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-gray-200">Description</Label>
                    <Textarea value={settingsForm.description} onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Status</Label>
                    <Select value={settingsForm.status} onValueChange={(v) => setSettingsForm({ ...settingsForm, status: v })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </GlassCard>

              {/* Landing Page */}
              <GlassCard className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Landing Page Content</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-200">Hero Title</Label>
                    <Input value={settingsForm.heroTitle} onChange={(e) => setSettingsForm({ ...settingsForm, heroTitle: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Hero Subtitle</Label>
                    <Textarea value={settingsForm.heroSubtitle} onChange={(e) => setSettingsForm({ ...settingsForm, heroSubtitle: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
              </GlassCard>

              {/* Rules */}
              <GlassCard className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Rules Content (Markdown)</h3>
                <Textarea value={settingsForm.rulesContent} onChange={(e) => setSettingsForm({ ...settingsForm, rulesContent: e.target.value })} className="bg-white/5 border-white/10 text-white min-h-[200px] font-mono text-sm" />
              </GlassCard>

              {/* Team Constraints */}
              <GlassCard className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Team Constraints</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-200">Max Teams</Label>
                    <Input type="number" value={settingsForm.maxTeams} onChange={(e) => setSettingsForm({ ...settingsForm, maxTeams: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Max Approved Teams</Label>
                    <Input type="number" value={settingsForm.maxApprovedTeams} onChange={(e) => setSettingsForm({ ...settingsForm, maxApprovedTeams: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Max Team Members</Label>
                    <Input type="number" value={settingsForm.maxTeamMembers} onChange={(e) => setSettingsForm({ ...settingsForm, maxTeamMembers: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
              </GlassCard>

              {/* Scoring Criteria Editor */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Scoring Criteria</h3>
                  <Button onClick={addScoringCriterion} variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20">
                    <Plus className="mr-2" size={16} />
                    Add Criterion
                  </Button>
                </div>
                <div className="space-y-4">
                  {scoringCriteriaForm.map((criterion, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => moveScoringCriterion(index, "up")} disabled={index === 0} className="text-gray-400 hover:text-white h-8 w-8 p-0">
                            <ArrowUp size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => moveScoringCriterion(index, "down")} disabled={index === scoringCriteriaForm.length - 1} className="text-gray-400 hover:text-white h-8 w-8 p-0">
                            <ArrowDown size={14} />
                          </Button>
                          <span className="text-gray-400 text-sm font-medium">#{index + 1}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeScoringCriterion(index)} className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-gray-300 text-xs">Name</Label>
                          <Input value={criterion.name} onChange={(e) => updateScoringCriterion(index, "name", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="AI Utilization" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Key</Label>
                          <Input value={criterion.key} onChange={(e) => updateScoringCriterion(index, "key", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm font-mono" placeholder="aiUtilization" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Weight (0-1)</Label>
                          <Input type="number" step="0.01" min="0" max="1" value={criterion.weight} onChange={(e) => updateScoringCriterion(index, "weight", parseFloat(e.target.value) || 0)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                        <div className="md:col-span-3">
                          <Label className="text-gray-300 text-xs">Description</Label>
                          <Input value={criterion.description} onChange={(e) => updateScoringCriterion(index, "description", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="Description for judges" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {scoringCriteriaForm.length > 0 && (
                    <p className="text-gray-500 text-sm">
                      Total weight: {scoringCriteriaForm.reduce((sum, c) => sum + c.weight, 0).toFixed(2)} (should equal 1.00)
                    </p>
                  )}
                </div>
              </GlassCard>

              {/* Phase Config Editor */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Phase Configuration</h3>
                  <Button onClick={addPhaseConfig} variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20">
                    <Plus className="mr-2" size={16} />
                    Add Phase
                  </Button>
                </div>
                <div className="space-y-4">
                  {phaseConfigForm.map((phase, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-semibold">Phase {phase.phase}</span>
                        <Button variant="ghost" size="sm" onClick={() => removePhaseConfig(index)} className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-gray-300 text-xs">Phase Number</Label>
                          <Input type="number" value={phase.phase} onChange={(e) => updatePhaseConfig(index, "phase", parseInt(e.target.value) || 0)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Name</Label>
                          <Input value={phase.name} onChange={(e) => updatePhaseConfig(index, "name", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Max Points</Label>
                          <Input type="number" value={phase.maxPoints} onChange={(e) => updatePhaseConfig(index, "maxPoints", parseInt(e.target.value) || 0)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                        <div className="md:col-span-3">
                          <Label className="text-gray-300 text-xs">Description</Label>
                          <Input value={phase.description} onChange={(e) => updatePhaseConfig(index, "description", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Prize Editor */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Prizes</h3>
                  <Button onClick={addPrize} variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20">
                    <Plus className="mr-2" size={16} />
                    Add Prize
                  </Button>
                </div>
                <div className="space-y-3">
                  {prizesForm.map((prize, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <Label className="text-gray-300 text-xs">Rank</Label>
                          <Input type="number" value={prize.rank} onChange={(e) => updatePrize(index, "rank", parseInt(e.target.value) || 0)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Label</Label>
                          <Input value={prize.label} onChange={(e) => updatePrize(index, "label", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="1st Place" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Amount</Label>
                          <Input type="number" value={prize.amount ?? ""} onChange={(e) => updatePrize(index, "amount", e.target.value ? parseInt(e.target.value) : null)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="Optional" />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-gray-300 text-xs">Color</Label>
                            <Select value={prize.color} onValueChange={(v) => updatePrize(index, "color", v)}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gold">Gold</SelectItem>
                                <SelectItem value="silver">Silver</SelectItem>
                                <SelectItem value="bronze">Bronze</SelectItem>
                                <SelectItem value="copper">Copper</SelectItem>
                                <SelectItem value="steel">Steel</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removePrize(index)} className="text-red-400 hover:bg-red-500/10 h-9 w-9 p-0">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Role Config Editor */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Role Configuration</h3>
                  <Button onClick={addRoleConfig} variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20">
                    <Plus className="mr-2" size={16} />
                    Add Role
                  </Button>
                </div>
                <div className="space-y-3">
                  {roleConfigForm.map((rc, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div>
                          <Label className="text-gray-300 text-xs">Role Name</Label>
                          <Input value={rc.role} onChange={(e) => updateRoleConfig(index, "role", e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="Developer" />
                        </div>
                        <div>
                          <Label className="text-gray-300 text-xs">Max Per Team</Label>
                          <Input type="number" value={rc.maxPerTeam} onChange={(e) => updateRoleConfig(index, "maxPerTeam", parseInt(e.target.value) || 1)} className="bg-white/5 border-white/10 text-white text-sm" />
                        </div>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => removeRoleConfig(index)} className="text-red-400 hover:bg-red-500/10 h-9 w-9 p-0">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Save button */}
              <div className="flex justify-end">
                <GlowButton onClick={handleSaveSettings}>
                  Save All Settings
                </GlowButton>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ================================================================= */}
      {/* DIALOGS                                                            */}
      {/* ================================================================= */}

      {/* Add User to Contest */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add User to Contest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-200">Search Platform Users</Label>
              <Input
                value={addUserSearch}
                onChange={(e) => setAddUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="bg-white/5 border-white/10 text-white"
              />
              {addUserSearch && filteredPlatformUsers.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-white/10 rounded-lg">
                  {filteredPlatformUsers.slice(0, 10).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedPlatformUser(u); setAddUserSearch(u.name || u.email); }}
                      className={`w-full text-left px-3 py-2 hover:bg-white/10 transition-colors ${
                        selectedPlatformUser?.id === u.id ? "bg-neon-purple/20" : ""
                      }`}
                    >
                      <p className="text-white text-sm">{u.name || "Unnamed"}</p>
                      <p className="text-gray-400 text-xs">{u.email}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedPlatformUser && (
                <p className="text-sm text-green-400 mt-2">
                  Selected: {selectedPlatformUser.name || selectedPlatformUser.email}
                </p>
              )}
            </div>
            <div>
              <Label className="text-gray-200">Contest Role</Label>
              <Select value={addUserRole} onValueChange={setAddUserRole}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="judge">Judge</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addUserRole === "participant" && contest.roleConfig && contest.roleConfig.length > 0 && (
              <div>
                <Label className="text-gray-200">Participant Role</Label>
                <Select value={addUserParticipantRole} onValueChange={setAddUserParticipantRole}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {contest.roleConfig.map((rc) => (
                      <SelectItem key={rc.role} value={rc.role}>{rc.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleAddUserToContest} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
              Add User to Contest
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Change Role</DialogTitle>
          </DialogHeader>
          {editRoleUser && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-400">
                Changing role for <span className="text-white font-semibold">{editRoleUser.user?.name || editRoleUser.user?.email}</span>
              </p>
              <div>
                <Label className="text-gray-200">New Role</Label>
                <Select value={editRoleValue} onValueChange={setEditRoleValue}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">Participant</SelectItem>
                    <SelectItem value="judge">Judge</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleChangeRole} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
                Update Role
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Track Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={setTrackDialogOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              {editingTrack ? "Edit Track" : "Create Track"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-200">Track Name</Label>
              <Input value={trackForm.name} onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })} placeholder="e.g. AI Innovation" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Description</Label>
              <Textarea value={trackForm.description} onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Icon (emoji or icon name)</Label>
              <Input value={trackForm.icon} onChange={(e) => setTrackForm({ ...trackForm, icon: e.target.value })} placeholder="e.g. brain" className="bg-white/5 border-white/10 text-white" />
            </div>
            <Button onClick={handleSaveTrack} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
              {editingTrack ? "Save Changes" : "Create Track"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Submission Dialog */}
      <Dialog open={viewSubmissionOpen} onOpenChange={setViewSubmissionOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Submission Details</DialogTitle>
          </DialogHeader>
          {viewingSubmission && (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-400 text-sm">Team</p><p className="text-white font-semibold">{viewingSubmission.teamName}</p></div>
                <div><p className="text-gray-400 text-sm">Phase</p><p className="text-white font-semibold">Phase {viewingSubmission.phase}</p></div>
                <div><p className="text-gray-400 text-sm">Submitted</p><p className="text-white">{new Date(viewingSubmission.submittedAt).toLocaleString()}</p></div>
                <div><p className="text-gray-400 text-sm">Scores</p><p className="text-white">{viewingSubmission.scoresCount} / {viewingSubmission.totalJudges}</p></div>
              </div>
              <div className="flex gap-4">
                <a href={viewingSubmission.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-electric-blue hover:underline">
                  <ExternalLink size={16} />GitHub
                </a>
                <a href={viewingSubmission.demoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-hot-pink hover:underline">
                  <ExternalLink size={16} />Demo
                </a>
              </div>
              {viewingSubmission.submissionDescription && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Description</p>
                  <p className="text-white text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-3">{viewingSubmission.submissionDescription}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-sm mb-2">AI Prompts Used</p>
                <p className="text-white text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-3">{viewingSubmission.aiPromptsUsed}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-2">AI Tools Utilized</p>
                <p className="text-white text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-3">{viewingSubmission.aiToolsUtilized}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Team Dialog */}
      <Dialog open={viewTeamOpen} onOpenChange={setViewTeamOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Team Details</DialogTitle>
          </DialogHeader>
          {viewingTeam && (
            <div className="mt-4">
              <div className="mb-6">
                <h4 className="text-xl font-bold text-white mb-2">{viewingTeam.name}</h4>
                <p className="text-gray-400">Track: {viewingTeam.trackName || viewingTeam.track || "-"}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                  viewingTeam.approved ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                }`}>
                  {viewingTeam.approved ? "Approved" : "Pending"}
                </span>
              </div>
              <h5 className="text-lg font-semibold text-white mb-3">Members ({viewingTeam.members?.length || 0})</h5>
              <div className="space-y-2">
                {viewingTeam.members?.map((member: any) => (
                  <div key={member.id} className={`bg-white/5 border rounded-lg p-3 ${
                    member.id === viewingTeam.leaderId ? "border-amber-500/30 bg-amber-500/5" : "border-white/10"
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold">{member.name || "Unnamed"}</p>
                      {member.id === viewingTeam.leaderId && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                          <Crown size={10} />
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
