"use client";

import { useContest } from "@/lib/contest-context";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import GlassCard from "@/components/GlassCard";
import BackgroundPattern from "@/components/BackgroundPattern";
import Leaderboard from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Award,
  ExternalLink,
  CheckCircle,
  XCircle,
  Home,
  Settings,
  LogOut,
  Users,
  Crown,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { ScoringCriterion, PhaseConfig } from "@/lib/contest-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  participantRole: string | null;
}

interface Team {
  id: string;
  name: string;
  track: string | null;
  trackName: string | null;
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
  submissionDescription: string | null;
  aiPromptsUsed: string;
  aiToolsUtilized: string;
  aiScreenshots: string[];
  submittedAt: string;
}

interface TeamWithSubmissions extends Team {
  submissions: Submission[];
}

interface ExistingScore {
  id: string;
  submissionId: string;
  judgeId: string;
  criteriaScores: Record<string, number> | null;
  weightedScore: string;
  phase: number;
}

interface ContestUserEntry {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContestJudgingPage() {
  const { contest } = useContest();
  const { data: session, status } = useSession();

  // Auth & access
  const [isJudge, setIsJudge] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [teams, setTeams] = useState<TeamWithSubmissions[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [scoresMap, setScoresMap] = useState<Map<string, ExistingScore>>(new Map());
  const [allScoresCount, setAllScoresCount] = useState<Map<string, number>>(new Map());
  const [judgeCount, setJudgeCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);

  // Scoring dialog
  const [scoringSubmission, setScoringSubmission] = useState<Submission | null>(null);
  const [scoringTeam, setScoringTeam] = useState<Team | null>(null);
  const [criteriaValues, setCriteriaValues] = useState<Record<string, number>>({});

  // Alerts
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const slug = contest.slug;
  const scoringCriteria: ScoringCriterion[] = contest.scoringCriteria ?? [];
  const phaseConfig: PhaseConfig[] = contest.phaseConfig ?? [];

  // Build a phase -> maxPoints lookup
  const phaseMaxPoints: Record<number, number> = {};
  for (const pc of phaseConfig) {
    if (pc.maxPoints > 0) {
      phaseMaxPoints[pc.phase] = pc.maxPoints;
    }
  }

  // -----------------------------------------------------------------------
  // Check judge access
  // -----------------------------------------------------------------------
  const checkJudgeAccess = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/c/${slug}/users`);
      if (!res.ok) {
        setIsJudge(false);
        return;
      }
      const data: ContestUserEntry[] = await res.json();
      const me = data.find((u) => u.userId === session.user.id || u.user?.id === session.user.id);
      if (me && (me.role === "judge" || me.role === "admin")) {
        setIsJudge(true);
      } else if (session.user.globalRole === "platform_admin") {
        setIsJudge(true);
      } else {
        setIsJudge(false);
      }
      // Count total judges
      const judges = data.filter((u) => u.role === "judge" || u.role === "admin");
      setJudgeCount(judges.length || 1);
    } catch {
      setIsJudge(false);
    }
  }, [session, slug]);

  // -----------------------------------------------------------------------
  // Load all judging data
  // -----------------------------------------------------------------------
  const loadJudgingData = useCallback(async () => {
    try {
      // Load teams with submissions
      const teamsRes = await fetch(`/api/c/${slug}/teams/all`);
      const teamsData = await teamsRes.json();
      setTeams(teamsData.teams || []);

      const approved = (teamsData.teams || []).filter((t: Team) => t.approved).length;
      setApprovedCount(approved);

      // Load leaderboard
      const lbRes = await fetch(`/api/c/${slug}/leaderboard`);
      const lbData = await lbRes.json();
      setLeaderboardData(lbData.leaderboard || []);

      // Load existing scores for the current judge only
      const myScoresRes = await fetch(`/api/c/${slug}/scores/all?judgeOnly=true`);
      const myScoresData = await myScoresRes.json();
      const newScoresMap = new Map<string, ExistingScore>();
      (myScoresData.scores || []).forEach((score: any) => {
        newScoresMap.set(score.submissionId, score);
      });
      setScoresMap(newScoresMap);

      // All scores for completeness count
      const allScoresRes = await fetch(`/api/c/${slug}/scores/all`);
      const allScoresData = await allScoresRes.json();
      const countMap = new Map<string, number>();
      (allScoresData.scores || []).forEach((score: any) => {
        const cur = countMap.get(score.submissionId) || 0;
        countMap.set(score.submissionId, cur + 1);
      });
      setAllScoresCount(countMap);

      setLoading(false);
    } catch (err) {
      console.error("Error loading judging data:", err);
      setLoading(false);
    }
  }, [slug]);

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (status === "authenticated") {
      checkJudgeAccess();
    }
  }, [status, checkJudgeAccess]);

  useEffect(() => {
    if (isJudge === true) {
      loadJudgingData();
    } else if (isJudge === false) {
      setLoading(false);
    }
  }, [isJudge, loadJudgingData]);

  // -----------------------------------------------------------------------
  // Scoring helpers
  // -----------------------------------------------------------------------
  const openScoringDialog = (submission: Submission, team: Team) => {
    setScoringSubmission(submission);
    setScoringTeam(team);

    const existingScore = scoresMap.get(submission.id);
    const initial: Record<string, number> = {};

    for (const c of scoringCriteria) {
      if (existingScore?.criteriaScores && existingScore.criteriaScores[c.key] !== undefined) {
        initial[c.key] = existingScore.criteriaScores[c.key];
      } else {
        initial[c.key] = 50;
      }
    }
    setCriteriaValues(initial);
  };

  const calculateWeightedScore = useCallback((): number => {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const c of scoringCriteria) {
      const val = criteriaValues[c.key] ?? 50;
      weightedSum += val * c.weight;
      totalWeight += c.weight;
    }
    if (totalWeight > 0 && totalWeight !== 1) {
      return weightedSum / totalWeight;
    }
    return weightedSum;
  }, [criteriaValues, scoringCriteria]);

  const calculatePhaseScore = useCallback(
    (phase: number): string => {
      const weighted = calculateWeightedScore();
      const maxPts = phaseMaxPoints[phase] || 25;
      return ((weighted / 100) * maxPts).toFixed(2);
    },
    [calculateWeightedScore, phaseMaxPoints]
  );

  const getPhaseMaxPoints = (phase: number) => phaseMaxPoints[phase] || 25;

  // -----------------------------------------------------------------------
  // Submit scores
  // -----------------------------------------------------------------------
  const handleSubmitScores = async () => {
    if (!scoringSubmission) return;
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/c/${slug}/scores/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: scoringSubmission.id,
          criteriaScores: criteriaValues,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit scores");
        return;
      }
      setSuccess("Scores submitted successfully!");
      setScoringSubmission(null);
      loadJudgingData();
    } catch {
      setError("Failed to submit scores");
    }
  };

  // -----------------------------------------------------------------------
  // Toggle team approval
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
      loadJudgingData();
    } catch {
      setError("Failed to update team approval status");
    }
  };

  // -----------------------------------------------------------------------
  // Render: loading / unauthenticated / access denied
  // -----------------------------------------------------------------------
  if (status === "loading" || (status === "authenticated" && isJudge === null)) {
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
          <p className="text-gray-400 mb-6">You need to sign in to access the judging portal.</p>
          <Link href="/login">
            <GlowButton>Sign In</GlowButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (isJudge === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <GlassCard className="p-12 text-center max-w-md">
          <ShieldAlert className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            You are not a judge for <span className="text-white font-semibold">{contest.name}</span>.
            Contact a contest admin if you believe this is an error.
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
          <p className="text-gray-400">Loading judging data...</p>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-4">
              <Award className="text-neon-purple" size={48} />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Judging Portal
                </h1>
                <p className="text-gray-400 text-sm mt-1">{contest.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/c/${slug}`}>
                <Button
                  variant="outline"
                  className="border-white/20 text-white bg-white/10 hover:bg-white/20"
                >
                  <Home className="mr-2" size={18} />
                  Contest Home
                </Button>
              </Link>
              <Link href={`/c/${slug}/admin`}>
                <Button className="bg-gradient-to-r from-electric-blue to-hot-pink">
                  <Settings className="mr-2" size={18} />
                  Admin Panel
                </Button>
              </Link>
            </div>
          </div>

          {/* Alerts */}
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

          {/* Leaderboard */}
          <div className="mb-12">
            <Leaderboard entries={leaderboardData} />
          </div>

          {/* Teams & Submissions */}
          <GlassCard className="p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h2 className="text-3xl font-bold text-white">Teams & Submissions</h2>
              <div className="text-right">
                <p className="text-sm text-gray-400">Approved Teams</p>
                <p className="text-2xl font-bold text-white">
                  {approvedCount} / {contest.maxApprovedTeams}
                </p>
              </div>
            </div>

            {teams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No teams yet</p>
              </div>
            ) : (
              <div className="space-y-8">
                {teams.map((team) => (
                  <div key={team.id} className="border border-white/10 rounded-lg p-6">
                    {/* Team header */}
                    <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                          {team.approved && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-semibold">
                              <CheckCircle size={16} />
                              Approved
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 mb-3">
                          Track: {team.trackName || team.track || "N/A"}
                        </p>

                        {/* Team Members */}
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
                                  <span className="text-gray-400 text-xs truncate">{member.email}</span>
                                  {(member.participantRole || member.role) && (
                                    <span className="text-xs text-electric-blue/80 mt-1">
                                      {member.participantRole || member.role}
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

                      {/* Approval toggle */}
                      <Button
                        onClick={() => handleToggleApproval(team.id, team.approved)}
                        variant={team.approved ? "destructive" : "default"}
                        className={
                          team.approved
                            ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 ml-4"
                            : "bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 ml-4"
                        }
                        disabled={!team.approved && approvedCount >= contest.maxApprovedTeams}
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

                    {/* Submissions for this team */}
                    <div className="space-y-4">
                      {team.submissions && team.submissions.length > 0 ? (
                        team.submissions.map((submission) => {
                          const existingScore = scoresMap.get(submission.id);
                          const phaseMax = getPhaseMaxPoints(submission.phase);
                          const phaseScore = existingScore
                            ? (
                                (parseFloat(existingScore.weightedScore) / 100) *
                                phaseMax
                              ).toFixed(2)
                            : null;
                          const judgesScored = allScoresCount.get(submission.id) || 0;
                          const totalJudges = judgeCount || 1;
                          const isComplete = judgesScored >= totalJudges;

                          return (
                            <div
                              key={submission.id}
                              className={`bg-white/5 border rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 ${
                                isComplete ? "border-green-500/30" : "border-white/10"
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-4 min-w-0 flex-1">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-white font-semibold whitespace-nowrap">
                                      Phase {submission.phase}
                                    </p>
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded-full font-semibold whitespace-nowrap ${
                                        isComplete
                                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                          : judgesScored > 0
                                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                          : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                                      }`}
                                    >
                                      {judgesScored}/{totalJudges} judges
                                    </span>
                                    {isComplete && <CheckCircle size={16} className="text-green-400" />}
                                  </div>
                                  <p className="text-sm text-gray-400 whitespace-nowrap">
                                    Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                                  </p>
                                </div>

                                {existingScore ? (
                                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 min-w-0">
                                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                                    <div className="text-sm min-w-0">
                                      <p className="text-green-400 font-semibold whitespace-nowrap">
                                        Scored by you
                                      </p>
                                      <p className="text-gray-300 break-words">
                                        <span className="text-white font-medium">{phaseScore}</span>
                                        <span className="text-gray-500"> / {phaseMax} pts</span>
                                        <span className="text-gray-500 ml-2">
                                          (Weighted: {existingScore.weightedScore})
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                    <span className="text-yellow-400 text-sm font-semibold whitespace-nowrap">
                                      Awaiting your score
                                    </span>
                                  </div>
                                )}
                              </div>

                              <Button
                                onClick={() => openScoringDialog(submission, team)}
                                className={`flex-shrink-0 ${
                                  existingScore
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                    : "bg-gradient-to-r from-neon-purple to-electric-blue"
                                }`}
                              >
                                {existingScore ? "Edit Score" : "Score Submission"}
                              </Button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-gray-500 text-sm py-2">No submissions yet</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Scoring Dialog                                                     */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={!!scoringSubmission} onOpenChange={() => setScoringSubmission(null)}>
        <DialogContent className="bg-gradient-to-br from-[#1a1525] via-[#12101a] to-[#0d1117] border border-purple-500/20 shadow-2xl shadow-purple-900/20 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-white">Score Submission</DialogTitle>
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
                  {scoringSubmission.submissionDescription && (
                    <div>
                      <h4 className="text-white font-semibold mb-2">Description:</h4>
                      <p className="text-gray-400 text-sm whitespace-pre-wrap">
                        {scoringSubmission.submissionDescription}
                      </p>
                    </div>
                  )}
                  <div>
                    <h4 className="text-white font-semibold mb-2">AI Prompts Used:</h4>
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">
                      {scoringSubmission.aiPromptsUsed}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">AI Tools Utilized:</h4>
                    <p className="text-gray-400 text-sm whitespace-pre-wrap">
                      {scoringSubmission.aiToolsUtilized}
                    </p>
                  </div>
                  {scoringSubmission.aiScreenshots && scoringSubmission.aiScreenshots.length > 0 && (
                    <div>
                      <h4 className="text-white font-semibold mb-2">AI Screenshots:</h4>
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
                  )}
                </div>
              </div>

              {/* Scoring Instructions */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2">How to Score</h4>
                <p className="text-gray-300 text-sm mb-2">
                  Rate each criterion from{" "}
                  <span className="text-green-400 font-bold">0 (Poor)</span> to{" "}
                  <span className="text-green-400 font-bold">100 (Excellent)</span>. Drag the slider
                  to adjust.
                </p>
                <p className="text-gray-400 text-sm">
                  The final score is calculated using weighted averages and scaled to the phase
                  maximum.
                  {phaseConfig
                    .filter((p) => p.maxPoints > 0)
                    .map((p, i) => (
                      <span key={p.phase} className="ml-2">
                        <span className="text-neon-purple font-semibold">
                          Phase {p.phase}: {p.maxPoints} pts
                        </span>
                        {i <
                          phaseConfig.filter((pp) => pp.maxPoints > 0).length - 1 && ","}
                      </span>
                    ))}
                </p>
              </div>

              {/* Dynamic Scoring Sliders */}
              <div className="space-y-6">
                {scoringCriteria.map((criterion) => (
                  <div key={criterion.key}>
                    <div className="flex justify-between mb-1">
                      <Label className="text-gray-200">
                        {criterion.name}{" "}
                        <span className="text-gray-500">
                          ({(criterion.weight * 100).toFixed(0)}% weight)
                        </span>
                      </Label>
                      <span className="text-white font-bold">
                        {criteriaValues[criterion.key] ?? 50}
                      </span>
                    </div>
                    {criterion.description && (
                      <p className="text-xs text-gray-500 mb-2">{criterion.description}</p>
                    )}
                    <div className="relative">
                      <Slider
                        value={[criteriaValues[criterion.key] ?? 50]}
                        onValueChange={(value) =>
                          setCriteriaValues((prev) => ({ ...prev, [criterion.key]: value[0] }))
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
                ))}

                {/* Weighted Total */}
                <div className="bg-gradient-to-r from-neon-purple/20 via-electric-blue/20 to-hot-pink/20 border border-white/20 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-bold text-white">Weighted Score (0-100):</span>
                    <span className="text-3xl font-bold text-white">
                      {calculateWeightedScore().toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-white/20 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-white">
                        Phase {scoringSubmission.phase} Score (out of{" "}
                        {getPhaseMaxPoints(scoringSubmission.phase)} pts):
                      </span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                        {calculatePhaseScore(scoringSubmission.phase)}
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
