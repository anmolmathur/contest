"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import Leaderboard from "@/components/Leaderboard";
import BackgroundPattern from "@/components/BackgroundPattern";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JUDGE_EMAILS, MAX_APPROVED_TEAMS, PHASE_MAX_POINTS } from "@/lib/constants";
import { Award, ExternalLink, CheckCircle, XCircle, Home, Settings, LogOut, Users, Crown } from "lucide-react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
}

interface Team {
  id: string;
  name: string;
  track: string;
  approved: boolean;
  leaderId: string | null;
  members: TeamMember[];
}

interface Submission {
  id: string;
  teamId: string;
  phase: number;
  githubUrl: string;
  demoUrl: string;
  aiPromptsUsed: string;
  aiToolsUtilized: string;
  aiScreenshots: string[];
  submittedAt: string;
}

interface TeamWithSubmissions extends Team {
  submissions: Submission[];
}

interface ScoreFormData {
  aiUsageScore: number;
  businessImpactScore: number;
  uxScore: number;
  innovationScore: number;
  executionScore: number;
}

interface ExistingScore {
  id: string;
  submissionId: string;
  judgeId: string;
  aiUsageScore: number;
  businessImpactScore: number;
  uxScore: number;
  innovationScore: number;
  executionScore: number;
  weightedScore: string;
  phase: number;
}

export default function JudgingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamWithSubmissions[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [scoresMap, setScoresMap] = useState<Map<string, ExistingScore>>(new Map());
  const [allScoresCount, setAllScoresCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scoringSubmission, setScoringSubmission] = useState<Submission | null>(
    null
  );
  const [scoringTeam, setScoringTeam] = useState<Team | null>(null);
  const [scores, setScores] = useState<ScoreFormData>({
    aiUsageScore: 50,
    businessImpactScore: 50,
    uxScore: 50,
    innovationScore: 50,
    executionScore: 50,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [approvedCount, setApprovedCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      // Check if user is a judge
      if (!JUDGE_EMAILS.includes(session?.user?.email || "")) {
        router.push("/dashboard");
        return;
      }
      loadJudgingData();
    }
  }, [status, session]);

  const loadJudgingData = async () => {
    try {
      // Load teams with submissions
      const teamsRes = await fetch("/api/teams/all");
      const teamsData = await teamsRes.json();
      setTeams(teamsData.teams || []);

      // Count approved teams
      const approved = (teamsData.teams || []).filter((t: Team) => t.approved).length;
      setApprovedCount(approved);

      // Load leaderboard
      const leaderboardRes = await fetch("/api/leaderboard");
      const leaderboardData = await leaderboardRes.json();
      setLeaderboardData(leaderboardData.leaderboard || []);

      // Load existing scores for the current judge only
      const scoresRes = await fetch("/api/scores/all?judgeOnly=true");
      const scoresData = await scoresRes.json();
      const newScoresMap = new Map<string, ExistingScore>();
      (scoresData.scores || []).forEach((score: ExistingScore) => {
        newScoresMap.set(score.submissionId, score);
      });
      setScoresMap(newScoresMap);

      // Also load all scores to count completeness
      const allScoresRes = await fetch("/api/scores/all");
      const allScoresData = await allScoresRes.json();
      const scoresCountMap = new Map<string, number>();
      (allScoresData.scores || []).forEach((score: ExistingScore) => {
        const currentCount = scoresCountMap.get(score.submissionId) || 0;
        scoresCountMap.set(score.submissionId, currentCount + 1);
      });
      setAllScoresCount(scoresCountMap);

      setLoading(false);
    } catch (err) {
      console.error("Error loading judging data:", err);
      setLoading(false);
    }
  };

  const openScoringDialog = (submission: Submission, team: Team) => {
    setScoringSubmission(submission);
    setScoringTeam(team);
    
    // Check if there's an existing score and pre-populate the form
    const existingScore = scoresMap.get(submission.id);
    if (existingScore) {
      setScores({
        aiUsageScore: existingScore.aiUsageScore,
        businessImpactScore: existingScore.businessImpactScore,
        uxScore: existingScore.uxScore,
        innovationScore: existingScore.innovationScore,
        executionScore: existingScore.executionScore,
      });
    } else {
      setScores({
        aiUsageScore: 50,
        businessImpactScore: 50,
        uxScore: 50,
        innovationScore: 50,
        executionScore: 50,
      });
    }
  };

  const handleSubmitScores = async () => {
    if (!scoringSubmission) return;

    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/scores/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: scoringSubmission.id,
          ...scores,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess("Scores submitted successfully!");
      setScoringSubmission(null);
      loadJudgingData(); // Reload leaderboard
    } catch (err) {
      setError("Failed to submit scores");
    }
  };

  const handleToggleApproval = async (teamId: string, currentStatus: boolean) => {
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/teams/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, approved: !currentStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccess(data.message);
      loadJudgingData(); // Reload data
    } catch (err) {
      setError("Failed to update team approval status");
    }
  };

  const calculateWeightedScore = () => {
    return (
      scores.aiUsageScore * 0.35 +
      scores.businessImpactScore * 0.25 +
      scores.uxScore * 0.15 +
      scores.innovationScore * 0.1 +
      scores.executionScore * 0.15
    ).toFixed(2);
  };

  const calculatePhaseScore = (phase: number) => {
    const weightedScore = parseFloat(calculateWeightedScore());
    const maxPoints = PHASE_MAX_POINTS[phase as keyof typeof PHASE_MAX_POINTS] || 25;
    return ((weightedScore / 100) * maxPoints).toFixed(2);
  };

  const getPhaseMaxPoints = (phase: number) => {
    return PHASE_MAX_POINTS[phase as keyof typeof PHASE_MAX_POINTS] || 25;
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
            <div className="flex items-center gap-4">
              <Award className="text-neon-purple" size={48} />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                Judging Portal
              </h1>
            </div>
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
                onClick={() => router.push("/admin")}
                className="bg-gradient-to-r from-electric-blue to-hot-pink"
              >
                <Settings className="mr-2" size={20} />
                Admin Panel
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

          {/* Leaderboard Section */}
          <div className="mb-12">
            <Leaderboard entries={leaderboardData} />
          </div>

          {/* Teams and Submissions Section */}
          <GlassCard className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">
                Teams & Submissions
              </h2>
              <div className="text-right">
                <p className="text-sm text-gray-400">Approved Teams</p>
                <p className="text-2xl font-bold text-white">
                  {approvedCount} / {MAX_APPROVED_TEAMS}
                </p>
              </div>
            </div>

            {teams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No submissions yet</p>
              </div>
            ) : (
              <div className="space-y-8">
                {teams.map((team) => (
                  <div key={team.id} className="border border-white/10 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                          {team.approved && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold">
                              <CheckCircle size={16} />
                              Approved
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 mb-3">Track: {team.track}</p>
                        
                        {/* Team Members Section */}
                        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Users size={16} className="text-electric-blue" />
                            <span className="text-sm font-semibold text-gray-300">
                              Team Members ({team.members?.length || 0})
                            </span>
                          </div>
                          {team.members && team.members.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {team.members.map((member) => (
                                <div
                                  key={member.id}
                                  className={`flex flex-col gap-1 p-3 bg-white/5 rounded-lg border ${
                                    member.id === team.leaderId 
                                      ? "border-amber-500/30 bg-amber-500/5" 
                                      : "border-white/5"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium text-sm">
                                      {member.name || "Unnamed"}
                                    </span>
                                    {member.id === team.leaderId && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                                        <Crown size={10} />
                                        Leader
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-gray-400 text-xs truncate">
                                    {member.email}
                                  </span>
                                  {member.role && (
                                    <span className="text-xs text-electric-blue/80 mt-1">
                                      {member.role}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No members assigned</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleToggleApproval(team.id, team.approved)}
                        variant={team.approved ? "destructive" : "default"}
                        className={team.approved 
                          ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 ml-4"
                          : "bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 ml-4"
                        }
                        disabled={!team.approved && approvedCount >= MAX_APPROVED_TEAMS}
                      >
                        {team.approved ? (
                          <>
                            <XCircle className="mr-2" size={16} />
                            Unapprove
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2" size={16} />
                            Approve
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {team.submissions.map((submission) => {
                        const existingScore = scoresMap.get(submission.id);
                        const phaseMax = getPhaseMaxPoints(submission.phase);
                        const phaseScore = existingScore 
                          ? ((parseFloat(existingScore.weightedScore) / 100) * phaseMax).toFixed(2)
                          : null;
                        const judgesScored = allScoresCount.get(submission.id) || 0;
                        const totalJudges = JUDGE_EMAILS.length;
                        const isComplete = judgesScored >= totalJudges;
                        
                        return (
                          <div
                            key={submission.id}
                            className={`bg-white/5 border rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 ${
                              isComplete 
                                ? "border-green-500/30" 
                                : "border-white/10"
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-4 min-w-0 flex-1">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-white font-semibold whitespace-nowrap">
                                    Phase {submission.phase}
                                  </p>
                                  {/* Completeness Indicator */}
                                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap ${
                                    isComplete
                                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                      : judgesScored > 0
                                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                      : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                                  }`}>
                                    {judgesScored}/{totalJudges} judges
                                  </span>
                                  {isComplete && (
                                    <CheckCircle size={16} className="text-green-400" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 whitespace-nowrap">
                                  Submitted:{" "}
                                  {new Date(submission.submittedAt).toLocaleDateString()}
                                </p>
                              </div>
                              {existingScore ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 min-w-0">
                                  <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                  <div className="text-sm min-w-0">
                                    <p className="text-green-400 font-semibold whitespace-nowrap">Scored by you</p>
                                    <p className="text-gray-300 break-words">
                                      <span className="text-white font-medium">{phaseScore}</span>
                                      <span className="text-gray-500"> / {phaseMax} pts</span>
                                      <span className="text-gray-500 ml-2">(Weighted: {existingScore.weightedScore})</span>
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                  <span className="text-yellow-400 text-sm font-semibold whitespace-nowrap">⏳ Awaiting your score</span>
                                </div>
                              )}
                            </div>
                            <Button
                              onClick={() => openScoringDialog(submission, team)}
                              className={`flex-shrink-0 ${existingScore 
                                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                : "bg-gradient-to-r from-neon-purple to-electric-blue"
                              }`}
                            >
                              {existingScore ? "Edit Score" : "Score Submission"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Scoring Dialog */}
      <Dialog
        open={!!scoringSubmission}
        onOpenChange={() => setScoringSubmission(null)}
      >
        <DialogContent className="bg-gradient-to-br from-[#1a1525] via-[#12101a] to-[#0d1117] border border-purple-500/20 shadow-2xl shadow-purple-900/20 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-white">
              Score Submission
            </DialogTitle>
          </DialogHeader>

          {scoringSubmission && scoringTeam && (
            <div className="space-y-6 mt-4">
              {/* Submission Details */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  {scoringTeam.name} - Phase {scoringSubmission.phase}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <a
                    href={scoringSubmission.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-electric-blue hover:underline"
                  >
                    <ExternalLink size={16} />
                    GitHub Repository
                  </a>
                  <a
                    href={scoringSubmission.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-hot-pink hover:underline"
                  >
                    <ExternalLink size={16} />
                    Live Demo
                  </a>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-semibold mb-2">AI Prompts Used:</h4>
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">
                      {scoringSubmission.aiPromptsUsed}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">
                      AI Tools Utilized:
                    </h4>
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">
                      {scoringSubmission.aiToolsUtilized}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">
                      AI Screenshots:
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {scoringSubmission.aiScreenshots.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-electric-blue hover:underline break-all"
                        >
                          Screenshot {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scoring Instructions */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                <h4 className="text-blue-400 font-semibold mb-2">How to Score</h4>
                <p className="text-gray-300 text-sm mb-2">
                  Rate each criterion from <span className="text-green-400 font-bold">0 (Poor)</span> to <span className="text-green-400 font-bold">100 (Excellent)</span>. 
                  Drag the slider to the right for higher scores.
                </p>
                <p className="text-gray-400 text-sm">
                  The final score is calculated using weighted averages and scaled to the phase maximum: 
                  <span className="text-neon-purple font-semibold"> Phase 2: 25 pts</span>, 
                  <span className="text-electric-blue font-semibold"> Phase 3: 25 pts</span>, 
                  <span className="text-hot-pink font-semibold"> Phase 4: 50 pts</span>.
                </p>
              </div>

              {/* Scoring Form */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-200">
                      AI Usage (35% weight)
                    </Label>
                    <span className="text-white font-bold">
                      {scores.aiUsageScore}
                    </span>
                  </div>
                  <div className="relative">
                    <Slider
                      value={[scores.aiUsageScore]}
                      onValueChange={(value) =>
                        setScores({ ...scores, aiUsageScore: value[0] })
                      }
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Poor)</span>
                      <span>50</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-200">
                      Business Impact (25% weight)
                    </Label>
                    <span className="text-white font-bold">
                      {scores.businessImpactScore}
                    </span>
                  </div>
                  <div className="relative">
                    <Slider
                      value={[scores.businessImpactScore]}
                      onValueChange={(value) =>
                        setScores({ ...scores, businessImpactScore: value[0] })
                      }
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Poor)</span>
                      <span>50</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-200">UX (15% weight)</Label>
                    <span className="text-white font-bold">{scores.uxScore}</span>
                  </div>
                  <div className="relative">
                    <Slider
                      value={[scores.uxScore]}
                      onValueChange={(value) =>
                        setScores({ ...scores, uxScore: value[0] })
                      }
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Poor)</span>
                      <span>50</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-200">
                      Innovation (10% weight)
                    </Label>
                    <span className="text-white font-bold">
                      {scores.innovationScore}
                    </span>
                  </div>
                  <div className="relative">
                    <Slider
                      value={[scores.innovationScore]}
                      onValueChange={(value) =>
                        setScores({ ...scores, innovationScore: value[0] })
                      }
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Poor)</span>
                      <span>50</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-200">
                      Execution (15% weight)
                    </Label>
                    <span className="text-white font-bold">
                      {scores.executionScore}
                    </span>
                  </div>
                  <div className="relative">
                    <Slider
                      value={[scores.executionScore]}
                      onValueChange={(value) =>
                        setScores({ ...scores, executionScore: value[0] })
                      }
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Poor)</span>
                      <span>50</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>
                </div>

                {/* Weighted Total */}
                <div className="bg-gradient-to-r from-neon-purple/20 via-electric-blue/20 to-hot-pink/20 border border-white/20 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-bold text-white">
                      Weighted Score (0-100):
                    </span>
                    <span className="text-3xl font-bold text-white">
                      {calculateWeightedScore()}
                    </span>
                  </div>
                  <div className="border-t border-white/20 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-white">
                        Phase {scoringSubmission?.phase} Score (out of {getPhaseMaxPoints(scoringSubmission?.phase || 2)} pts):
                      </span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                        {calculatePhaseScore(scoringSubmission?.phase || 2)}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSubmitScores}
                  className="w-full bg-gradient-to-r from-neon-purple to-electric-blue text-lg py-6"
                >
                  Submit Scores
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

