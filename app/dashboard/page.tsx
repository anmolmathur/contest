"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import BackgroundPattern from "@/components/BackgroundPattern";
import { Users, Plus, Send, CheckCircle, Award, Trophy, LogOut, User, Edit, Trash2, UserMinus, Crown } from "lucide-react";
import { MAX_TEAMS, MAX_TEAM_MEMBERS, JUDGE_EMAILS } from "@/lib/constants";
import Leaderboard from "@/components/Leaderboard";

const tracks = [
  "Alumni Portal",
  "Admission Portal",
  "DigiVarsity 3.0",
  "Partner Portal",
  "Communications Portal",
  "Placement Portal",
  "Referral Portal",
];

interface Team {
  id: string;
  name: string;
  track: string;
  createdBy: string;
  leaderId: string | null;
  approved: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [submitWorkOpen, setSubmitWorkOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [submissionStatuses, setSubmissionStatuses] = useState<Record<string, any>>({});

  // Create team form
  const [teamName, setTeamName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");

  // Edit profile
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    department: "",
  });

  // Edit team
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editTeamForm, setEditTeamForm] = useState({
    name: "",
    track: "",
  });

  // Submit work form
  const [submitForm, setSubmitForm] = useState({
    phase: "",
    githubUrl: "",
    demoUrl: "",
    submissionDescription: "",
    aiPromptsUsed: "",
    aiToolsUtilized: "",
    aiScreenshots: [""],
  });

  // Edit submission state
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadDashboardData();
    }
  }, [status]);

  const loadDashboardData = async () => {
    try {
      // Load team count
      const countRes = await fetch("/api/teams/count");
      const countData = await countRes.json();
      setTeamCount(countData.count);
      setApprovedCount(countData.approvedCount || 0);

      // Load leaderboard for all users
      const leaderboardRes = await fetch("/api/leaderboard");
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setLeaderboardData(leaderboardData.leaderboard || []);
      }

      // Load user's team if exists
      if (session?.user?.teamId) {
        const teamRes = await fetch(`/api/teams/${session.user.teamId}`);
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeam(teamData.team);
          setTeamMembers(teamData.members);
        }

        // Load team submissions
        const submissionsRes = await fetch(
          `/api/submissions/team/${session.user.teamId}`
        );
        if (submissionsRes.ok) {
          const submissionsData = await submissionsRes.json();
          setSubmissions(submissionsData.submissions);

          // For each submission, get its scoring status
          const statusPromises = submissionsData.submissions.map(async (sub: Submission) => {
            const statusRes = await fetch(`/api/submissions/${sub.id}/status`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              return [sub.id, statusData];
            }
            return [sub.id, null];
          });

          const statuses = await Promise.all(statusPromises);
          setSubmissionStatuses(Object.fromEntries(statuses));
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading dashboard:", err);
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    setError("");
    setSuccess("");

    if (!teamName || !selectedTrack) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const res = await fetch("/api/teams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName, track: selectedTrack }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Team created successfully!");
      setCreateTeamOpen(false);
      router.refresh();
      loadDashboardData();
    } catch (err) {
      setError("Failed to create team");
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const res = await fetch("/api/teams/available-users");
      const data = await res.json();
      setAvailableUsers(data.users || []);
    } catch (err) {
      console.error("Error loading available users:", err);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      const res = await fetch("/api/teams/add-member", {
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
      loadDashboardData();
      loadAvailableUsers();
    } catch (err) {
      setError("Failed to add member");
    }
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
      aiScreenshots: submission.aiScreenshots?.length > 0 ? submission.aiScreenshots : [""],
    });
    setSubmitWorkOpen(true);
  };

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

  const handleSubmitWork = async () => {
    setError("");
    setSuccess("");

    // Validate all fields
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
        // Update existing submission
        res = await fetch(`/api/submissions/${editingSubmission.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubUrl: submitForm.githubUrl,
            demoUrl: submitForm.demoUrl,
            submissionDescription: submitForm.submissionDescription,
            aiPromptsUsed: submitForm.aiPromptsUsed,
            aiToolsUtilized: submitForm.aiToolsUtilized,
            aiScreenshots: submitForm.aiScreenshots.filter((url) => url.trim()),
          }),
        });
      } else {
        // Create new submission
        res = await fetch("/api/submissions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: parseInt(submitForm.phase),
            githubUrl: submitForm.githubUrl,
            demoUrl: submitForm.demoUrl,
            submissionDescription: submitForm.submissionDescription,
            aiPromptsUsed: submitForm.aiPromptsUsed,
            aiToolsUtilized: submitForm.aiToolsUtilized,
            aiScreenshots: submitForm.aiScreenshots.filter((url) => url.trim()),
          }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess(isEditMode ? "Submission updated successfully!" : (data.updated ? "Submission updated successfully!" : "Submission created successfully!"));
      setSubmitWorkOpen(false);
      resetSubmitForm();
      loadDashboardData();
    } catch (err) {
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
    } catch (err) {
      setError("Failed to update profile");
    }
  };

  const handleOpenEditTeam = () => {
    if (team) {
      setEditTeamForm({
        name: team.name,
        track: team.track,
      });
      setEditTeamOpen(true);
    }
  };

  const handleUpdateTeam = async () => {
    setError("");
    setSuccess("");

    if (!team) return;

    try {
      const res = await fetch(`/api/teams/${team.id}`, {
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
      loadDashboardData();
    } catch (err) {
      setError("Failed to update team");
    }
  };

  const handleDeleteTeam = async () => {
    setError("");
    setSuccess("");

    if (!team) return;

    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/teams/${team.id}`, {
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
      router.refresh();
      loadDashboardData();
    } catch (err) {
      setError("Failed to delete team");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setError("");
    setSuccess("");

    if (!team) return;

    if (!confirm("Are you sure you want to remove this member from the team?")) {
      return;
    }

    try {
      const res = await fetch("/api/teams/remove-member", {
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
      loadDashboardData();
    } catch (err) {
      setError("Failed to remove member");
    }
  };

  const handleSetLeader = async (userId: string) => {
    setError("");
    setSuccess("");

    if (!team) return;

    try {
      const res = await fetch("/api/teams/set-leader", {
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
      loadDashboardData();
    } catch (err) {
      setError("Failed to set team leader");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <BackgroundPattern />

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Participant Dashboard
            </h1>
            <div className="flex items-center gap-4">
              {JUDGE_EMAILS.includes(session?.user?.email || "") && (
                <Button
                  onClick={() => router.push("/judging")}
                  className="bg-gradient-to-r from-hot-pink to-neon-purple"
                >
                  <Award className="mr-2" size={20} />
                  Judge
                </Button>
              )}
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

          {/* User Profile Section */}
          <GlassCard className="p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-neon-purple to-electric-blue flex items-center justify-center">
                  <User className="text-white" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{session?.user?.name || "User"}</h2>
                  <p className="text-gray-400">{session?.user?.email}</p>
                  <p className="text-sm text-gray-500">{session?.user?.role || "No role assigned"}</p>
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
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Enter your name"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="profileDepartment" className="text-gray-200">
                    Department
                  </Label>
                  <Input
                    id="profileDepartment"
                    value={profileForm.department}
                    onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
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

          {/* Team Section */}
          <GlassCard className="p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="text-neon-purple" size={32} />
                <h2 className="text-3xl font-bold text-white">Your Team</h2>
              </div>

              {!team && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
                          <DialogTrigger asChild>
                            <Button
                              disabled={teamCount >= MAX_TEAMS}
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
                                <Label htmlFor="teamName" className="text-gray-200">
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
                                <Label htmlFor="track" className="text-gray-200">
                                  Select Track
                                </Label>
                                <Select
                                  value={selectedTrack}
                                  onValueChange={setSelectedTrack}
                                >
                                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Choose a track" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tracks.map((track) => (
                                      <SelectItem key={track} value={track}>
                                        {track}
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
                    {teamCount >= MAX_TEAMS && (
                      <TooltipContent>
                        <p>All {MAX_TEAMS} team slots are full</p>
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
                  Teams Created: {teamCount} / {MAX_TEAMS}
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                      {team.approved && (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold">
                          <Award size={16} />
                          Approved for Competition
                        </span>
                      )}
                    </div>
                    {team.createdBy === session?.user?.id && submissions.length === 0 && (
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
                  <p className="text-gray-400">Track: {team.track}</p>
                  {!team.approved && (
                    <p className="text-sm text-yellow-400 mt-2">
                      ⚠️ Your team is pending approval from judges
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <h4 className="text-xl font-bold text-white mb-4">Team Members ({teamMembers.length}/{MAX_TEAM_MEMBERS})</h4>
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
                              <span className="text-xs text-neon-purple">(Creator)</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{member.role}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
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
                          {team.createdBy === session?.user?.id && 
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

                {team.createdBy === session?.user?.id && teamMembers.length < MAX_TEAM_MEMBERS && (
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
                      All users are either already in teams or there are no registered users
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
                          <p className="text-white font-semibold">{user.name}</p>
                          <p className="text-sm text-gray-400">{user.role}</p>
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
                    onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })}
                    placeholder="Enter team name"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="editTeamTrack" className="text-gray-200">
                    Select Track
                  </Label>
                  <Select
                    value={editTeamForm.track}
                    onValueChange={(value) => setEditTeamForm({ ...editTeamForm, track: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Choose a track" />
                    </SelectTrigger>
                    <SelectContent>
                      {tracks.map((track) => (
                        <SelectItem key={track} value={track}>
                          {track}
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

          {/* Leaderboard Section - Available to ALL users */}
          <GlassCard className="p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-hot-pink" size={32} />
              <h2 className="text-3xl font-bold text-white">Live Leaderboard</h2>
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
                            Your team hasn't been scored yet
                          </p>
                        );
                      }

                      return (
                        <div className="text-center">
                          <p className="text-white text-lg mb-2">
                            <span className="font-bold text-3xl mr-2">
                              {teamRank === 0
                                ? "🥇"
                                : teamRank === 1
                                ? "🥈"
                                : teamRank === 2
                                ? "🥉"
                                : `#${teamRank + 1}`}
                            </span>
                            Your Team's Rank
                          </p>
                          <p className="text-4xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent mb-2">
                            {teamEntry.totalScore.toFixed(2)} points
                          </p>
                          {teamRank < 5 && (
                            <p className="text-green-400 font-semibold mt-3">
                              🎉 You're in a prize position!
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
                <p className="text-gray-400 text-lg">No scores available yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  The leaderboard will update as judges evaluate submissions
                </p>
              </div>
            )}
          </GlassCard>

          {/* Submissions Section */}
          {team && (
            <GlassCard className="p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Send className="text-electric-blue" size={32} />
                  <h2 className="text-3xl font-bold text-white">Submissions</h2>
                </div>

                <Dialog open={submitWorkOpen} onOpenChange={(open) => {
                  setSubmitWorkOpen(open);
                  if (!open) resetSubmitForm();
                }}>
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
                          {isEditMode ? "Editing" : "Submitting for"} team: <span className="text-neon-purple font-semibold">{team.name}</span>
                          {isEditMode && editingSubmission && (
                            <span className="text-electric-blue ml-2">(Phase {editingSubmission.phase})</span>
                          )}
                        </p>
                      )}
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label className="text-gray-200">Phase</Label>
                        <Select
                          value={submitForm.phase}
                          onValueChange={(value) =>
                            setSubmitForm({ ...submitForm, phase: value })
                          }
                          disabled={isEditMode}
                        >
                          <SelectTrigger className={`bg-white/5 border-white/10 text-white ${isEditMode ? "opacity-60 cursor-not-allowed" : ""}`}>
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">Phase 2 - Vibe Coding Sprint (25 pts)</SelectItem>
                            <SelectItem value="3">Phase 3 - Mid-Point Review (25 pts)</SelectItem>
                            <SelectItem value="4">Phase 4 - Grand Finale (50 pts)</SelectItem>
                          </SelectContent>
                        </Select>
                        {isEditMode && (
                          <p className="text-xs text-gray-500 mt-1">Phase cannot be changed when editing</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-gray-200">GitHub URL</Label>
                        <Input
                          value={submitForm.githubUrl}
                          onChange={(e) =>
                            setSubmitForm({ ...submitForm, githubUrl: e.target.value })
                          }
                          placeholder="https://github.com/..."
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>

                      <div>
                        <Label className="text-gray-200">Demo URL</Label>
                        <Input
                          value={submitForm.demoUrl}
                          onChange={(e) =>
                            setSubmitForm({ ...submitForm, demoUrl: e.target.value })
                          }
                          placeholder="https://..."
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>

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
                          placeholder="List all AI tools (ChatGPT, Copilot, etc.)..."
                          className="bg-white/5 border-white/10 text-white min-h-[100px]"
                        />
                      </div>

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

              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">No submissions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => {
                    const status = submissionStatuses[submission.id];
                    return (
                      <div
                        key={submission.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-6"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-white">
                                Phase {submission.phase}
                              </h3>
                              {submission.updatedAt && new Date(submission.updatedAt).getTime() > new Date(submission.submittedAt).getTime() + 1000 && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                                  Edited
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              Submitted:{" "}
                              {new Date(submission.submittedAt).toLocaleDateString()}
                              {submission.updatedAt && new Date(submission.updatedAt).getTime() > new Date(submission.submittedAt).getTime() + 1000 && (
                                <span className="text-amber-400 ml-2">
                                  (Updated: {new Date(submission.updatedAt).toLocaleDateString()})
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => handleOpenEditSubmission(submission)}
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                            >
                              <Edit className="mr-2" size={14} />
                              Edit
                            </Button>

                          {/* Status Badge */}
                          {status && (
                            <div className="text-right">
                              {status.judgesScored === 0 ? (
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-semibold">
                                  ⏳ Not Evaluated
                                </span>
                              ) : status.isComplete ? (
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold">
                                  <CheckCircle size={16} />
                                  Evaluated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-semibold">
                                  🔍 Under Review
                                </span>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {status.judgesScored} / {status.totalJudges} judges
                              </p>
                            </div>
                          )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <a
                            href={submission.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-electric-blue hover:underline"
                          >
                            View GitHub Repo →
                          </a>
                          <a
                            href={submission.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-hot-pink hover:underline"
                          >
                            View Demo →
                          </a>
                        </div>

                        {/* Score Display */}
                        {status && status.averageScore > 0 && (
                          <div className="border-t border-white/10 pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-gray-400 text-lg">
                                Average Score:
                              </span>
                              <span className="text-3xl font-bold bg-gradient-to-r from-neon-purple to-electric-blue bg-clip-text text-transparent">
                                {status.averageScore.toFixed(2)}
                              </span>
                            </div>

                            {/* Score Breakdown */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                              <div className="text-center bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">
                                  AI Usage (35%)
                                </p>
                                <p className="text-lg font-semibold text-white">
                                  {status.breakdown.aiUsage.toFixed(1)}
                                </p>
                              </div>
                              <div className="text-center bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">
                                  Business (25%)
                                </p>
                                <p className="text-lg font-semibold text-white">
                                  {status.breakdown.businessImpact.toFixed(1)}
                                </p>
                              </div>
                              <div className="text-center bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">UX (15%)</p>
                                <p className="text-lg font-semibold text-white">
                                  {status.breakdown.ux.toFixed(1)}
                                </p>
                              </div>
                              <div className="text-center bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">
                                  Innovation (10%)
                                </p>
                                <p className="text-lg font-semibold text-white">
                                  {status.breakdown.innovation.toFixed(1)}
                                </p>
                              </div>
                              <div className="text-center bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">
                                  Execution (15%)
                                </p>
                                <p className="text-lg font-semibold text-white">
                                  {status.breakdown.execution.toFixed(1)}
                                </p>
                              </div>
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
        </motion.div>
      </div>
    </div>
  );
}

