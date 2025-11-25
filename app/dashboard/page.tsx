"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import { Users, Plus, Send, CheckCircle } from "lucide-react";

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
  submittedAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [submitWorkOpen, setSubmitWorkOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create team form
  const [teamName, setTeamName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");

  // Submit work form
  const [submitForm, setSubmitForm] = useState({
    phase: "",
    githubUrl: "",
    demoUrl: "",
    aiPromptsUsed: "",
    aiToolsUtilized: "",
    aiScreenshots: [""],
  });

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

  const handleSubmitWork = async () => {
    setError("");
    setSuccess("");

    // Validate all fields
    if (
      !submitForm.phase ||
      !submitForm.githubUrl ||
      !submitForm.demoUrl ||
      !submitForm.aiPromptsUsed ||
      !submitForm.aiToolsUtilized ||
      submitForm.aiScreenshots.filter((url) => url.trim()).length === 0
    ) {
      setError("All fields including AI evidence are required");
      return;
    }

    try {
      const res = await fetch("/api/submissions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: parseInt(submitForm.phase),
          githubUrl: submitForm.githubUrl,
          demoUrl: submitForm.demoUrl,
          aiPromptsUsed: submitForm.aiPromptsUsed,
          aiToolsUtilized: submitForm.aiToolsUtilized,
          aiScreenshots: submitForm.aiScreenshots.filter((url) => url.trim()),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Submission created successfully!");
      setSubmitWorkOpen(false);
      setSubmitForm({
        phase: "",
        githubUrl: "",
        demoUrl: "",
        aiPromptsUsed: "",
        aiToolsUtilized: "",
        aiScreenshots: [""],
      });
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
          <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
            Participant Dashboard
          </h1>

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
                              disabled={teamCount >= 5}
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
                    {teamCount >= 5 && (
                      <TooltipContent>
                        <p>All 5 team slots are full</p>
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
                  Teams Created: {teamCount} / 5
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{team.name}</h3>
                  <p className="text-gray-400">Track: {team.track}</p>
                </div>

                <div className="mb-6">
                  <h4 className="text-xl font-bold text-white mb-4">Team Members</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4"
                      >
                        <p className="text-white font-semibold">{member.name}</p>
                        <p className="text-sm text-gray-400">{member.role}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {team.createdBy === session?.user?.id && teamMembers.length < 6 && (
                  <Button
                    onClick={() => {
                      setAddMemberOpen(true);
                      loadAvailableUsers();
                    }}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <Plus className="mr-2" size={16} />
                    Add Member
                  </Button>
                )}
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

                <Dialog open={submitWorkOpen} onOpenChange={setSubmitWorkOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-electric-blue to-hot-pink">
                      <Plus className="mr-2" size={20} />
                      Submit Work
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-white">
                        Submit Your Work
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label className="text-gray-200">Phase</Label>
                        <Select
                          value={submitForm.phase}
                          onValueChange={(value) =>
                            setSubmitForm({ ...submitForm, phase: value })
                          }
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Phase 1 - Team Formation (25 pts)</SelectItem>
                            <SelectItem value="2">Phase 2 - Vibe Coding Sprint (25 pts)</SelectItem>
                            <SelectItem value="3">Phase 3 - Mid-Point Review (25 pts)</SelectItem>
                            <SelectItem value="4">Phase 4 - Grand Finale (50 pts)</SelectItem>
                          </SelectContent>
                        </Select>
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
                          className="mt-2 border-white/20 text-white"
                        >
                          <Plus className="mr-2" size={16} />
                          Add Screenshot URL
                        </Button>
                      </div>

                      <Button
                        onClick={handleSubmitWork}
                        className="w-full bg-gradient-to-r from-neon-purple to-electric-blue"
                      >
                        Submit
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
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Phase</TableHead>
                      <TableHead className="text-gray-400">GitHub</TableHead>
                      <TableHead className="text-gray-400">Demo</TableHead>
                      <TableHead className="text-gray-400">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <TableRow key={submission.id} className="border-white/10">
                        <TableCell className="text-white font-semibold">
                          Phase {submission.phase}
                        </TableCell>
                        <TableCell>
                          <a
                            href={submission.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-electric-blue hover:underline"
                          >
                            View Repo
                          </a>
                        </TableCell>
                        <TableCell>
                          <a
                            href={submission.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-hot-pink hover:underline"
                          >
                            View Demo
                          </a>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCard>
          )}
        </motion.div>
      </div>
    </div>
  );
}

