"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JUDGE_EMAILS, ROLES, TRACKS } from "@/lib/constants";
import {
  Users,
  UsersRound,
  Award,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  LogOut,
  Home,
  Eye,
  Send,
  Key,
  ExternalLink,
  Crown,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  teamId: string | null;
  teamName: string | null;
  isTeamLeader?: boolean;
}

interface Team {
  id: string;
  name: string;
  track: string;
  approved: boolean;
  createdBy: string;
  leaderId: string | null;
  members?: User[];
  submissions?: any[];
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
  aiUsageScore: number;
  businessImpactScore: number;
  uxScore: number;
  innovationScore: number;
  executionScore: number;
  weightedScore: string;
}

interface Submission {
  id: string;
  teamId: string;
  teamName: string;
  track: string;
  phase: number;
  githubUrl: string;
  demoUrl: string;
  submissionDescription: string;
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

type TabType = "summary" | "users" | "teams" | "submissions" | "scores";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Create User Dialog
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
    department: "",
  });

  // Edit User Dialog
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    role: "",
    department: "",
  });

  // Reset Password Dialog
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // View Team Dialog
  const [viewTeamOpen, setViewTeamOpen] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Edit Team Dialog
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({
    name: "",
    track: "",
  });

  // View Submission Dialog
  const [viewSubmissionOpen, setViewSubmissionOpen] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  // Edit Submission Dialog
  const [editSubmissionOpen, setEditSubmissionOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [editSubmissionForm, setEditSubmissionForm] = useState({
    githubUrl: "",
    demoUrl: "",
    submissionDescription: "",
    aiPromptsUsed: "",
    aiToolsUtilized: "",
    aiScreenshots: [""],
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      // Check if user is a judge
      if (!JUDGE_EMAILS.includes(session?.user?.email || "")) {
        router.push("/dashboard");
        return;
      }
      loadAllData();
    }
  }, [status, session]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadUsers(), loadTeams(), loadScores(), loadSubmissions()]);
      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users/all");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await fetch("/api/teams/all");
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      console.error("Error loading teams:", err);
    }
  };

  const loadScores = async () => {
    try {
      const res = await fetch("/api/scores/all");
      const data = await res.json();
      setScores(data.scores || []);
    } catch (err) {
      console.error("Error loading scores:", err);
    }
  };

  const loadSubmissions = async () => {
    try {
      const res = await fetch("/api/submissions/all");
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error("Error loading submissions:", err);
    }
  };

  // User Actions
  const handleCreateUser = async () => {
    setError("");
    setSuccess("");

    if (!userForm.name || !userForm.email || !userForm.password || !userForm.role) {
      setError("Name, email, password, and role are required");
      return;
    }

    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("User created successfully!");
      setCreateUserOpen(false);
      setUserForm({ name: "", email: "", password: "", role: "", department: "" });
      loadUsers();
    } catch (err) {
      setError("Failed to create user");
    }
  };

  const handleEditUser = async () => {
    setError("");
    setSuccess("");

    if (!editingUser) return;

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("User updated successfully!");
      setEditUserOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError("Failed to update user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("User deleted successfully!");
      loadUsers();
    } catch (err) {
      setError("Failed to delete user");
    }
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
    });
    setEditUserOpen(true);
  };

  const openResetPassword = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword("");
    setResetPasswordOpen(true);
  };

  const handleResetPassword = async () => {
    setError("");
    setSuccess("");

    if (!resetPasswordUser) return;

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = await fetch(`/api/users/${resetPasswordUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess(`Password reset successfully for ${resetPasswordUser.name}`);
      setResetPasswordOpen(false);
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setError("Failed to reset password");
    }
  };

  // Team Actions
  const handleViewTeam = async (team: Team) => {
    setViewingTeam(team);
    try {
      const res = await fetch(`/api/teams/${team.id}`);
      const data = await res.json();
      setTeamMembers(data.members || []);
      setViewingTeam(data.team); // Update with full team data including leaderId
      setViewTeamOpen(true);
    } catch (err) {
      console.error("Error loading team details:", err);
    }
  };

  const handleSetTeamLeader = async (teamId: string, userId: string) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/teams/set-leader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Team leader updated successfully!");
      // Reload team data
      const teamRes = await fetch(`/api/teams/${teamId}`);
      const teamData = await teamRes.json();
      setTeamMembers(teamData.members || []);
      setViewingTeam(teamData.team);
      loadTeams();
    } catch (err) {
      setError("Failed to set team leader");
    }
  };

  const handleEditTeam = async () => {
    setError("");
    setSuccess("");

    if (!editingTeam) return;

    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
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
      setEditingTeam(null);
      loadTeams();
    } catch (err) {
      setError("Failed to update team");
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team? This will remove all members from the team.")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Team deleted successfully!");
      loadTeams();
      loadUsers();
    } catch (err) {
      setError("Failed to delete team");
    }
  };

  const openEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditTeamForm({
      name: team.name,
      track: team.track,
    });
    setEditTeamOpen(true);
  };

  // Submission Actions
  const handleViewSubmission = (submission: Submission) => {
    setViewingSubmission(submission);
    setViewSubmissionOpen(true);
  };

  const openEditSubmission = (submission: Submission) => {
    setEditingSubmission(submission);
    setEditSubmissionForm({
      githubUrl: submission.githubUrl,
      demoUrl: submission.demoUrl,
      submissionDescription: submission.submissionDescription || "",
      aiPromptsUsed: submission.aiPromptsUsed || "",
      aiToolsUtilized: submission.aiToolsUtilized || "",
      aiScreenshots: submission.aiScreenshots?.length > 0 ? submission.aiScreenshots : [""],
    });
    setEditSubmissionOpen(true);
  };

  const handleEditSubmission = async () => {
    setError("");
    setSuccess("");

    if (!editingSubmission) return;

    try {
      const res = await fetch(`/api/submissions/${editingSubmission.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: editSubmissionForm.githubUrl,
          demoUrl: editSubmissionForm.demoUrl,
          submissionDescription: editSubmissionForm.submissionDescription,
          aiPromptsUsed: editSubmissionForm.aiPromptsUsed,
          aiToolsUtilized: editSubmissionForm.aiToolsUtilized,
          aiScreenshots: editSubmissionForm.aiScreenshots.filter((url) => url.trim()),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Submission updated successfully!");
      setEditSubmissionOpen(false);
      setEditingSubmission(null);
      loadSubmissions();
    } catch (err) {
      setError("Failed to update submission");
    }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm("Are you sure you want to delete this submission? This will also delete all associated scores.")) return;

    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Submission deleted successfully!");
      loadSubmissions();
      loadScores();
    } catch (err) {
      setError("Failed to delete submission");
    }
  };

  const addSubmissionScreenshotField = () => {
    setEditSubmissionForm({
      ...editSubmissionForm,
      aiScreenshots: [...editSubmissionForm.aiScreenshots, ""],
    });
  };

  const removeSubmissionScreenshotField = (index: number) => {
    setEditSubmissionForm({
      ...editSubmissionForm,
      aiScreenshots: editSubmissionForm.aiScreenshots.filter((_, i) => i !== index),
    });
  };

  const updateSubmissionScreenshotField = (index: number, value: string) => {
    const newScreenshots = [...editSubmissionForm.aiScreenshots];
    newScreenshots[index] = value;
    setEditSubmissionForm({ ...editSubmissionForm, aiScreenshots: newScreenshots });
  };

  // Score Actions
  const handleDeleteScore = async (scoreId: string) => {
    if (!confirm("Are you sure you want to delete this score?")) return;

    try {
      const res = await fetch(`/api/scores/${scoreId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Score deleted successfully!");
      loadScores();
    } catch (err) {
      setError("Failed to delete score");
    }
  };

  // Summary Stats
  const stats = {
    totalUsers: users.length,
    usersWithTeams: users.filter((u) => u.teamId).length,
    usersWithoutTeams: users.filter((u) => !u.teamId).length,
    totalTeams: teams.length,
    approvedTeams: teams.filter((t) => t.approved).length,
    pendingTeams: teams.filter((t) => !t.approved).length,
    totalScores: scores.length,
    uniqueJudges: new Set(scores.map((s) => s.judgeId)).size,
    scoredSubmissions: new Set(scores.map((s) => s.submissionId)).size,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  const tabs = [
    { id: "summary" as TabType, label: "Summary", icon: BarChart3 },
    { id: "users" as TabType, label: "Users", icon: Users },
    { id: "teams" as TabType, label: "Teams", icon: UsersRound },
    { id: "submissions" as TabType, label: "Submissions", icon: Send },
    { id: "scores" as TabType, label: "Scores", icon: Award },
  ];

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
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="border-white/20 text-white bg-white/10 hover:bg-white/20"
              >
                <Home className="mr-2" size={20} />
                Dashboard
              </Button>
              <Button
                onClick={() => router.push("/judging")}
                className="bg-gradient-to-r from-hot-pink to-neon-purple"
              >
                <Award className="mr-2" size={20} />
                Judging
              </Button>
              <Button
                onClick={() => signOut({ callbackUrl: "/login" })}
                variant="outline"
                className="border-white/20 text-white bg-white/10 hover:bg-red-500/20 hover:border-red-500/30"
              >
                <LogOut className="mr-2" size={20} />
                Sign Out
              </Button>
            </div>
          </div>

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

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant="outline"
                className={`border-white/20 ${
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

          {/* Summary Tab */}
          {activeTab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Users className="text-neon-purple" size={32} />
                  <h3 className="text-2xl font-bold text-white">Users</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400">
                    <span>Total Users:</span>
                    <span className="text-white font-semibold">{stats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>In Teams:</span>
                    <span className="text-green-400 font-semibold">{stats.usersWithTeams}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Available:</span>
                    <span className="text-yellow-400 font-semibold">{stats.usersWithoutTeams}</span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <UsersRound className="text-electric-blue" size={32} />
                  <h3 className="text-2xl font-bold text-white">Teams</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400">
                    <span>Total Teams:</span>
                    <span className="text-white font-semibold">{stats.totalTeams}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Approved:</span>
                    <span className="text-green-400 font-semibold">{stats.approvedTeams}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Pending:</span>
                    <span className="text-yellow-400 font-semibold">{stats.pendingTeams}</span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Award className="text-hot-pink" size={32} />
                  <h3 className="text-2xl font-bold text-white">Scores</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400">
                    <span>Total Scores:</span>
                    <span className="text-white font-semibold">{stats.totalScores}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Active Judges:</span>
                    <span className="text-green-400 font-semibold">{stats.uniqueJudges}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Scored Submissions:</span>
                    <span className="text-electric-blue font-semibold">{stats.scoredSubmissions}</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Manage Users</h3>
                <Button
                  onClick={() => setCreateUserOpen(true)}
                  className="bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  <Plus className="mr-2" size={18} />
                  Create User
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Name</TableHead>
                      <TableHead className="text-gray-400">Email</TableHead>
                      <TableHead className="text-gray-400">Role</TableHead>
                      <TableHead className="text-gray-400">Department</TableHead>
                      <TableHead className="text-gray-400">Team</TableHead>
                      <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-white/10">
                        <TableCell className="text-white font-semibold">
                          <div className="flex items-center gap-2">
                            {user.name}
                            {user.isTeamLeader && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                                <Crown size={10} />
                                Leader
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400">{user.email}</TableCell>
                        <TableCell className="text-gray-400">{user.role}</TableCell>
                        <TableCell className="text-gray-400">{user.department || "-"}</TableCell>
                        <TableCell className="text-gray-400">{user.teamName || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => openResetPassword(user)}
                              variant="ghost"
                              size="sm"
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              title="Reset Password"
                            >
                              <Key size={16} />
                            </Button>
                            <Button
                              onClick={() => openEditUser(user)}
                              variant="ghost"
                              size="sm"
                              className="text-electric-blue hover:text-electric-blue hover:bg-electric-blue/10"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              onClick={() => handleDeleteUser(user.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              disabled={JUDGE_EMAILS.includes(user.email)}
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

          {/* Teams Tab */}
          {activeTab === "teams" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Manage Teams</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Name</TableHead>
                      <TableHead className="text-gray-400">Track</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Submissions</TableHead>
                      <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id} className="border-white/10">
                        <TableCell className="text-white font-semibold">{team.name}</TableCell>
                        <TableCell className="text-gray-400">{team.track}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              team.approved
                                ? "bg-green-500/20 text-green-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {team.approved ? "Approved" : "Pending"}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {team.submissions?.length || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => handleViewTeam(team)}
                              variant="ghost"
                              size="sm"
                              className="text-neon-purple hover:text-neon-purple hover:bg-neon-purple/10"
                            >
                              <Eye size={16} />
                            </Button>
                            <Button
                              onClick={() => openEditTeam(team)}
                              variant="ghost"
                              size="sm"
                              className="text-electric-blue hover:text-electric-blue hover:bg-electric-blue/10"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              onClick={() => handleDeleteTeam(team.id)}
                              variant="ghost"
                              size="sm"
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

          {/* Submissions Tab */}
          {activeTab === "submissions" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Manage Submissions</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Team</TableHead>
                      <TableHead className="text-gray-400">Phase</TableHead>
                      <TableHead className="text-gray-400">Submitted</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Scores</TableHead>
                      <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <TableRow key={submission.id} className="border-white/10">
                        <TableCell className="text-white font-semibold">
                          {submission.teamName}
                          <span className="text-xs text-gray-500 block">{submission.track}</span>
                        </TableCell>
                        <TableCell className="text-gray-400">Phase {submission.phase}</TableCell>
                        <TableCell className="text-gray-400">
                          {new Date(submission.submittedAt).toLocaleDateString()}
                          {submission.wasEdited && (
                            <span className="block text-xs text-amber-400">
                              Edited: {new Date(submission.updatedAt).toLocaleDateString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {submission.wasEdited ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                              Edited
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                              Original
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            submission.isFullyScored
                              ? "bg-green-500/20 text-green-400"
                              : submission.scoresCount > 0
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}>
                            {submission.scoresCount} / {submission.totalJudges}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => handleViewSubmission(submission)}
                              variant="ghost"
                              size="sm"
                              className="text-neon-purple hover:text-neon-purple hover:bg-neon-purple/10"
                            >
                              <Eye size={16} />
                            </Button>
                            <Button
                              onClick={() => openEditSubmission(submission)}
                              variant="ghost"
                              size="sm"
                              className="text-electric-blue hover:text-electric-blue hover:bg-electric-blue/10"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              onClick={() => handleDeleteSubmission(submission.id)}
                              variant="ghost"
                              size="sm"
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

          {/* Scores Tab */}
          {activeTab === "scores" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Manage Scores</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Team</TableHead>
                      <TableHead className="text-gray-400">Phase</TableHead>
                      <TableHead className="text-gray-400">Judge</TableHead>
                      <TableHead className="text-gray-400 text-center">AI</TableHead>
                      <TableHead className="text-gray-400 text-center">Business</TableHead>
                      <TableHead className="text-gray-400 text-center">UX</TableHead>
                      <TableHead className="text-gray-400 text-center">Innovation</TableHead>
                      <TableHead className="text-gray-400 text-center">Execution</TableHead>
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
                        <TableCell className="text-center text-gray-400">{score.aiUsageScore}</TableCell>
                        <TableCell className="text-center text-gray-400">{score.businessImpactScore}</TableCell>
                        <TableCell className="text-center text-gray-400">{score.uxScore}</TableCell>
                        <TableCell className="text-center text-gray-400">{score.innovationScore}</TableCell>
                        <TableCell className="text-center text-gray-400">{score.executionScore}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                            {score.weightedScore}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => handleDeleteScore(score.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          )}

          {/* Create User Dialog */}
          <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Create New User
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-gray-200">Name</Label>
                  <Input
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="Enter name"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Email</Label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="Enter email"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Password</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Enter password"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Role</Label>
                  <Select
                    value={userForm.role}
                    onValueChange={(value) => setUserForm({ ...userForm, role: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-200">Department (optional)</Label>
                  <Input
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    placeholder="Enter department"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <Button
                  onClick={handleCreateUser}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Reset Password Dialog */}
          <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Reset Password
                </DialogTitle>
              </DialogHeader>
              {resetPasswordUser && (
                <div className="space-y-4 mt-4">
                  <p className="text-gray-400">
                    Reset password for: <span className="text-white font-semibold">{resetPasswordUser.name}</span>
                    <span className="text-gray-500 block text-sm">{resetPasswordUser.email}</span>
                  </p>
                  <div>
                    <Label className="text-gray-200">New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <Button
                    onClick={handleResetPassword}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500"
                  >
                    Reset Password
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Edit User
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-gray-200">Name</Label>
                  <Input
                    value={editUserForm.name}
                    onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Email</Label>
                  <Input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Role</Label>
                  <Select
                    value={editUserForm.role}
                    onValueChange={(value) => setEditUserForm({ ...editUserForm, role: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-200">Department</Label>
                  <Input
                    value={editUserForm.department}
                    onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <Button
                  onClick={handleEditUser}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Team Dialog */}
          <Dialog open={viewTeamOpen} onOpenChange={setViewTeamOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Team Details
                </DialogTitle>
              </DialogHeader>
              {viewingTeam && (
                <div className="mt-4">
                  <div className="mb-6">
                    <h4 className="text-xl font-bold text-white mb-2">{viewingTeam.name}</h4>
                    <p className="text-gray-400">Track: {viewingTeam.track}</p>
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                        viewingTeam.approved
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {viewingTeam.approved ? "Approved" : "Pending Approval"}
                    </span>
                  </div>
                  <h5 className="text-lg font-semibold text-white mb-3">Team Members ({teamMembers.length})</h5>
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className={`bg-white/5 border rounded-lg p-3 flex items-center justify-between ${
                          member.id === viewingTeam.leaderId
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-white/10"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-semibold">{member.name}</p>
                            {member.id === viewingTeam.leaderId && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                                <Crown size={10} />
                                Team Leader
                              </span>
                            )}
                            {member.id === viewingTeam.createdBy && (
                              <span className="text-xs text-neon-purple">(Creator)</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{member.role}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                        {member.id !== viewingTeam.leaderId && (
                          <Button
                            onClick={() => handleSetTeamLeader(viewingTeam.id, member.id)}
                            variant="ghost"
                            size="sm"
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            title="Make Team Leader"
                          >
                            <Crown size={16} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  <Label className="text-gray-200">Team Name</Label>
                  <Input
                    value={editTeamForm.name}
                    onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Track</Label>
                  <Select
                    value={editTeamForm.track}
                    onValueChange={(value) => setEditTeamForm({ ...editTeamForm, track: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACKS.map((track) => (
                        <SelectItem key={track} value={track}>
                          {track}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleEditTeam}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Submission Dialog */}
          <Dialog open={viewSubmissionOpen} onOpenChange={setViewSubmissionOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Submission Details
                </DialogTitle>
              </DialogHeader>
              {viewingSubmission && (
                <div className="mt-4 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Team</p>
                      <p className="text-white font-semibold">{viewingSubmission.teamName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Phase</p>
                      <p className="text-white font-semibold">Phase {viewingSubmission.phase}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Submitted</p>
                      <p className="text-white">{new Date(viewingSubmission.submittedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Status</p>
                      <div className="flex items-center gap-2">
                        {viewingSubmission.wasEdited && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                            Edited
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          viewingSubmission.isFullyScored
                            ? "bg-green-500/20 text-green-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {viewingSubmission.scoresCount} / {viewingSubmission.totalJudges} Scored
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <a
                      href={viewingSubmission.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-electric-blue hover:underline"
                    >
                      <ExternalLink size={16} />
                      GitHub Repository
                    </a>
                    <a
                      href={viewingSubmission.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-hot-pink hover:underline"
                    >
                      <ExternalLink size={16} />
                      Live Demo
                    </a>
                  </div>

                  <div>
                    <p className="text-gray-400 text-sm mb-2">Description</p>
                    <p className="text-white text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-3">
                      {viewingSubmission.submissionDescription}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400 text-sm mb-2">AI Prompts Used</p>
                    <p className="text-white text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-3">
                      {viewingSubmission.aiPromptsUsed}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400 text-sm mb-2">AI Tools Utilized</p>
                    <p className="text-white text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-3">
                      {viewingSubmission.aiToolsUtilized}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400 text-sm mb-2">AI Screenshots</p>
                    <div className="space-y-2">
                      {viewingSubmission.aiScreenshots?.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-electric-blue hover:underline text-sm"
                        >
                          <ExternalLink size={14} />
                          Screenshot {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Submission Dialog */}
          <Dialog open={editSubmissionOpen} onOpenChange={setEditSubmissionOpen}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">
                  Edit Submission
                </DialogTitle>
                {editingSubmission && (
                  <p className="text-sm text-gray-400 mt-2">
                    {editingSubmission.teamName} - Phase {editingSubmission.phase}
                  </p>
                )}
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-gray-200">GitHub URL</Label>
                  <Input
                    value={editSubmissionForm.githubUrl}
                    onChange={(e) => setEditSubmissionForm({ ...editSubmissionForm, githubUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Demo URL</Label>
                  <Input
                    value={editSubmissionForm.demoUrl}
                    onChange={(e) => setEditSubmissionForm({ ...editSubmissionForm, demoUrl: e.target.value })}
                    placeholder="https://..."
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Description</Label>
                  <Textarea
                    value={editSubmissionForm.submissionDescription}
                    onChange={(e) => setEditSubmissionForm({ ...editSubmissionForm, submissionDescription: e.target.value })}
                    className="bg-white/5 border-white/10 text-white min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">AI Prompts Used</Label>
                  <Textarea
                    value={editSubmissionForm.aiPromptsUsed}
                    onChange={(e) => setEditSubmissionForm({ ...editSubmissionForm, aiPromptsUsed: e.target.value })}
                    className="bg-white/5 border-white/10 text-white min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">AI Tools Utilized</Label>
                  <Textarea
                    value={editSubmissionForm.aiToolsUtilized}
                    onChange={(e) => setEditSubmissionForm({ ...editSubmissionForm, aiToolsUtilized: e.target.value })}
                    className="bg-white/5 border-white/10 text-white min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">AI Screenshots (URLs)</Label>
                  {editSubmissionForm.aiScreenshots.map((url, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={url}
                        onChange={(e) => updateSubmissionScreenshotField(index, e.target.value)}
                        placeholder="https://..."
                        className="bg-white/5 border-white/10 text-white"
                      />
                      {editSubmissionForm.aiScreenshots.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeSubmissionScreenshotField(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSubmissionScreenshotField}
                    className="mt-2 border-white/20 text-white bg-white/10 hover:bg-white/20"
                  >
                    <Plus className="mr-2" size={16} />
                    Add Screenshot URL
                  </Button>
                </div>
                <Button
                  onClick={handleEditSubmission}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </div>
  );
}

