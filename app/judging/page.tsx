"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import { JUDGE_EMAILS } from "@/lib/constants";
import { Award, ExternalLink } from "lucide-react";

interface Team {
  id: string;
  name: string;
  track: string;
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

export default function JudgingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamWithSubmissions[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
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

      // Load leaderboard
      const leaderboardRes = await fetch("/api/leaderboard");
      const leaderboardData = await leaderboardRes.json();
      setLeaderboardData(leaderboardData.leaderboard || []);

      setLoading(false);
    } catch (err) {
      console.error("Error loading judging data:", err);
      setLoading(false);
    }
  };

  const openScoringDialog = (submission: Submission, team: Team) => {
    setScoringSubmission(submission);
    setScoringTeam(team);
    setScores({
      aiUsageScore: 50,
      businessImpactScore: 50,
      uxScore: 50,
      innovationScore: 50,
      executionScore: 50,
    });
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

  const calculateWeightedScore = () => {
    return (
      scores.aiUsageScore * 0.35 +
      scores.businessImpactScore * 0.25 +
      scores.uxScore * 0.15 +
      scores.innovationScore * 0.1 +
      scores.executionScore * 0.15
    ).toFixed(2);
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
          <div className="flex items-center gap-4 mb-8">
            <Award className="text-neon-purple" size={48} />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
              Judging Portal
            </h1>
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
            <h2 className="text-3xl font-bold text-white mb-6">
              Teams & Submissions
            </h2>

            {teams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No submissions yet</p>
              </div>
            ) : (
              <div className="space-y-8">
                {teams.map((team) => (
                  <div key={team.id} className="border border-white/10 rounded-lg p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{team.name}</h3>
                    <p className="text-gray-400 mb-4">Track: {team.track}</p>

                    <div className="space-y-4">
                      {team.submissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-white font-semibold">
                              Phase {submission.phase}
                            </p>
                            <p className="text-sm text-gray-400">
                              Submitted:{" "}
                              {new Date(submission.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            onClick={() => openScoringDialog(submission, team)}
                            className="bg-gradient-to-r from-neon-purple to-electric-blue"
                          >
                            Score Submission
                          </Button>
                        </div>
                      ))}
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
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  <Slider
                    value={[scores.aiUsageScore]}
                    onValueChange={(value) =>
                      setScores({ ...scores, aiUsageScore: value[0] })
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
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
                  <Slider
                    value={[scores.businessImpactScore]}
                    onValueChange={(value) =>
                      setScores({ ...scores, businessImpactScore: value[0] })
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-200">UX (15% weight)</Label>
                    <span className="text-white font-bold">{scores.uxScore}</span>
                  </div>
                  <Slider
                    value={[scores.uxScore]}
                    onValueChange={(value) =>
                      setScores({ ...scores, uxScore: value[0] })
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
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
                  <Slider
                    value={[scores.innovationScore]}
                    onValueChange={(value) =>
                      setScores({ ...scores, innovationScore: value[0] })
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
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
                  <Slider
                    value={[scores.executionScore]}
                    onValueChange={(value) =>
                      setScores({ ...scores, executionScore: value[0] })
                    }
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Weighted Total */}
                <div className="bg-gradient-to-r from-neon-purple/20 via-electric-blue/20 to-hot-pink/20 border border-white/20 rounded-lg p-6">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-white">
                      Weighted Total Score:
                    </span>
                    <span className="text-4xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                      {calculateWeightedScore()}
                    </span>
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

