"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import GlowButton from "@/components/GlowButton";
import GlassCard from "@/components/GlassCard";
import BackgroundPattern from "@/components/BackgroundPattern";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
  Trophy,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Home,
  Key,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Globe,
  Settings,
} from "lucide-react";
import {
  DEFAULT_SCORING_CRITERIA,
  DEFAULT_PHASE_CONFIG,
  DEFAULT_PRIZES,
  DEFAULT_ROLE_CONFIG,
  DEFAULT_MAX_TEAMS,
  DEFAULT_MAX_APPROVED_TEAMS,
  DEFAULT_MAX_TEAM_MEMBERS,
  ROLES,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contest {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  bannerImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  customDomain?: string | null;
  customDomainVerifiedAt?: string | null;
  isDefault?: boolean;
}

interface PlatformUser {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  department: string | null;
  globalRole: string;
  teamId: string | null;
  teamName: string | null;
  createdAt: string | null;
}

type TabType = "stats" | "contests" | "users";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlatformAdminPage() {
  const { data: session, status } = useSession();

  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Data
  const [contests, setContests] = useState<Contest[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);

  // Contest dialogs
  const [contestDialogOpen, setContestDialogOpen] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [contestForm, setContestForm] = useState({
    name: "",
    slug: "",
    description: "",
    status: "draft",
    heroTitle: "",
    heroSubtitle: "",
    maxTeams: DEFAULT_MAX_TEAMS,
    maxApprovedTeams: DEFAULT_MAX_APPROVED_TEAMS,
    maxTeamMembers: DEFAULT_MAX_TEAM_MEMBERS,
    // NEW — clone-from flow in the create dialog
    cloneFromSlug: "" as string, // "" = create-from-scratch, else source slug
    shiftDatesByDays: 0,
    // NEW — custom domain (editable in both dialogs, optional)
    customDomain: "",
  });
  // Remember the original domain so we only hit the domain API when the admin
  // actually changed it (avoids a needless round-trip on plain field edits).
  const [originalDomain, setOriginalDomain] = useState<string>("");

  // User dialogs
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    globalRole: "user",
  });

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    globalRole: "user",
    role: "",
  });

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // -----------------------------------------------------------------------
  // Access check
  // -----------------------------------------------------------------------
  const isPlatformAdmin =
    status === "authenticated" && session?.user?.globalRole === "platform_admin";

  // -----------------------------------------------------------------------
  // Data loaders
  // -----------------------------------------------------------------------
  const loadContests = useCallback(async () => {
    try {
      const res = await fetch("/api/contests");
      const data = await res.json();
      setContests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading contests:", err);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users/all");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadContests(), loadUsers()]);
    setLoading(false);
  }, [loadContests, loadUsers]);

  useEffect(() => {
    if (isPlatformAdmin) {
      loadAllData();
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [isPlatformAdmin, status, loadAllData]);

  // -----------------------------------------------------------------------
  // Contest actions
  // -----------------------------------------------------------------------
  const openCreateContest = () => {
    setEditingContest(null);
    setContestForm({
      name: "",
      slug: "",
      description: "",
      status: "draft",
      heroTitle: "",
      heroSubtitle: "",
      maxTeams: DEFAULT_MAX_TEAMS,
      maxApprovedTeams: DEFAULT_MAX_APPROVED_TEAMS,
      maxTeamMembers: DEFAULT_MAX_TEAM_MEMBERS,
      cloneFromSlug: "",
      shiftDatesByDays: 0,
      customDomain: "",
    });
    setOriginalDomain("");
    setContestDialogOpen(true);
  };

  const openEditContest = (contest: Contest) => {
    setEditingContest(contest);
    setContestForm({
      name: contest.name,
      slug: contest.slug,
      description: contest.description || "",
      status: contest.status,
      heroTitle: contest.heroTitle || "",
      heroSubtitle: contest.heroSubtitle || "",
      maxTeams: DEFAULT_MAX_TEAMS,
      maxApprovedTeams: DEFAULT_MAX_APPROVED_TEAMS,
      maxTeamMembers: DEFAULT_MAX_TEAM_MEMBERS,
      cloneFromSlug: "",
      shiftDatesByDays: 0,
      customDomain: contest.customDomain || "",
    });
    setOriginalDomain(contest.customDomain || "");
    setContestDialogOpen(true);
  };

  // Contests eligible to clone from (any active or completed contest in the platform).
  const cloneableContests = contests.filter(
    (c) => c.status === "active" || c.status === "completed" || c.status === "archived",
  );

  /**
   * Push a domain change against /api/platform/contests/[slug]/domain.
   * Called from handleSaveContest after the base create/update succeeds,
   * and only when the domain value actually changed.
   */
  async function syncContestDomain(slug: string, nextDomain: string, prevDomain: string) {
    const clean = nextDomain.trim().toLowerCase();
    if (clean === prevDomain.trim().toLowerCase()) return; // no-op
    if (!clean) {
      // Admin cleared the field → remove
      const res = await fetch(`/api/platform/contests/${slug}/domain`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove domain");
      return;
    }
    // Admin set or changed the domain → upsert (starts unverified)
    const res = await fetch(`/api/platform/contests/${slug}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: clean }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save domain");
  }

  /**
   * Mark the already-saved domain as verified. Useful in dev where we don't
   * actually go through the reverse-proxy DNS dance; production admins can
   * still use it to force-accept a domain they've manually verified.
   */
  const handleVerifyDomain = async (slug: string) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/platform/contests/${slug}/domain`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to verify domain");
        return;
      }
      setSuccess("Domain marked as verified");
      loadContests();
    } catch {
      setError("Failed to verify domain");
    }
  };

  const handleSaveContest = async () => {
    if (!contestForm.name || !contestForm.slug) {
      setError("Name and slug are required");
      return;
    }
    // Validate custom domain format if provided (optional field).
    const domainTrim = contestForm.customDomain.trim().toLowerCase();
    if (domainTrim && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domainTrim)) {
      setError("Custom domain must be a valid hostname like 'ai.example.com'");
      return;
    }
    setError("");
    setSuccess("");

    try {
      let finalSlug = contestForm.slug;

      if (editingContest) {
        // --- UPDATE path ---------------------------------------------------
        const res = await fetch(`/api/contests/${editingContest.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contestForm),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to update contest");
          return;
        }
        setSuccess("Contest updated successfully");
      } else if (contestForm.cloneFromSlug) {
        // --- CLONE path ----------------------------------------------------
        // Copies tracks, cert templates, hero/rules/phase/scoring/prizes/FAQ
        // from the source. Starts in draft. No teams/scores/users copied.
        const res = await fetch(
          `/api/platform/contests/${contestForm.cloneFromSlug}/clone`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              newSlug: contestForm.slug,
              newName: contestForm.name,
              shiftDatesByDays: contestForm.shiftDatesByDays || 0,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to clone contest");
          return;
        }
        finalSlug = data.contest?.slug ?? contestForm.slug;
        setSuccess(
          `Cloned from "${contestForm.cloneFromSlug}". New contest is in draft — customize and activate from its admin page.`,
        );
      } else {
        // --- CREATE-FROM-SCRATCH path -------------------------------------
        const res = await fetch("/api/contests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...contestForm,
            scoringCriteria: DEFAULT_SCORING_CRITERIA,
            phaseConfig: DEFAULT_PHASE_CONFIG,
            prizes: DEFAULT_PRIZES,
            roleConfig: DEFAULT_ROLE_CONFIG,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create contest");
          return;
        }
        setSuccess("Contest created successfully");
      }

      // After the contest row exists, sync the custom domain if it changed.
      // For create/clone, prevDomain is "" so setting any value creates it.
      try {
        await syncContestDomain(finalSlug, contestForm.customDomain, originalDomain);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Domain update failed";
        setError(`Contest saved, but domain update failed: ${msg}`);
        loadContests();
        return; // keep the dialog open so the admin can retry the domain
      }

      setContestDialogOpen(false);
      loadContests();
    } catch {
      setError("Failed to save contest");
    }
  };

  const handleDeleteContest = async (contestSlug: string) => {
    if (!confirm("Are you sure you want to delete this contest? This will remove all associated data."))
      return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/contests/${contestSlug}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete contest");
        return;
      }
      setSuccess("Contest deleted");
      loadContests();
    } catch {
      setError("Failed to delete contest");
    }
  };

  // -----------------------------------------------------------------------
  // User actions
  // -----------------------------------------------------------------------
  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) {
      setError("Name, email, and password are required");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      setSuccess("User created successfully");
      setCreateUserOpen(false);
      setUserForm({ name: "", email: "", password: "", globalRole: "user" });
      loadUsers();
    } catch {
      setError("Failed to create user");
    }
  };

  const openEditUser = (user: PlatformUser) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name || "",
      email: user.email,
      globalRole: user.globalRole,
      role: user.role || "",
    });
    setEditUserOpen(true);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update user");
        return;
      }
      setSuccess("User updated successfully");
      setEditUserOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch {
      setError("Failed to update user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete user");
        return;
      }
      setSuccess("User deleted");
      loadUsers();
    } catch {
      setError("Failed to delete user");
    }
  };

  const openResetPassword = (user: PlatformUser) => {
    setResetPasswordUser(user);
    setNewPassword("");
    setResetPasswordOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/users/${resetPasswordUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }
      setSuccess(`Password reset for ${resetPasswordUser.name}`);
      setResetPasswordOpen(false);
      setResetPasswordUser(null);
      setNewPassword("");
    } catch {
      setError("Failed to reset password");
    }
  };

  // Auto-generate slug from name
  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  const stats = {
    totalContests: contests.length,
    activeContests: contests.filter((c) => c.status === "active").length,
    draftContests: contests.filter((c) => c.status === "draft").length,
    completedContests: contests.filter((c) => c.status === "completed" || c.status === "archived").length,
    totalUsers: users.length,
    platformAdmins: users.filter((u) => u.globalRole === "platform_admin").length,
  };

  // -----------------------------------------------------------------------
  // Render guards
  // -----------------------------------------------------------------------
  if (status === "loading") {
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
          <p className="text-gray-400 mb-6">Sign in to access the platform admin panel.</p>
          <Link href="/login">
            <GlowButton>Sign In</GlowButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BackgroundPattern />
        <GlassCard className="p-12 text-center max-w-md">
          <ShieldAlert className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            Only platform administrators can access this page. Your role is{" "}
            <span className="text-white font-mono">{session?.user?.globalRole}</span>.
          </p>
          <Link href="/dashboard">
            <GlowButton>Go to Dashboard</GlowButton>
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
          <p className="text-gray-400">Loading platform data...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Tabs config
  // -----------------------------------------------------------------------
  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "stats", label: "Overview", icon: BarChart3 },
    { id: "contests", label: "Contests", icon: Trophy },
    { id: "users", label: "Users", icon: Users },
  ];

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400",
    active: "bg-green-500/20 text-green-400",
    completed: "bg-blue-500/20 text-blue-400",
    archived: "bg-gray-500/20 text-gray-400",
  };

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
              <Globe className="text-neon-purple" size={48} />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent">
                  Platform Admin
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  Manage all contests and users across the platform
                </p>
              </div>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20">
                <Home className="mr-2" size={18} />
                Dashboard
              </Button>
            </Link>
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

          {/* ============================================================= */}
          {/* STATS TAB                                                      */}
          {/* ============================================================= */}
          {activeTab === "stats" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Trophy className="text-neon-purple" size={32} />
                    <h3 className="text-2xl font-bold text-white">Contests</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-400"><span>Total:</span><span className="text-white font-semibold">{stats.totalContests}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Active:</span><span className="text-green-400 font-semibold">{stats.activeContests}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Draft:</span><span className="text-yellow-400 font-semibold">{stats.draftContests}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Completed/Archived:</span><span className="text-blue-400 font-semibold">{stats.completedContests}</span></div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Users className="text-electric-blue" size={32} />
                    <h3 className="text-2xl font-bold text-white">Users</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-400"><span>Total Users:</span><span className="text-white font-semibold">{stats.totalUsers}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Platform Admins:</span><span className="text-hot-pink font-semibold">{stats.platformAdmins}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Regular Users:</span><span className="text-green-400 font-semibold">{stats.totalUsers - stats.platformAdmins}</span></div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Settings className="text-hot-pink" size={32} />
                    <h3 className="text-2xl font-bold text-white">Quick Actions</h3>
                  </div>
                  <div className="space-y-3">
                    <Button onClick={() => { setActiveTab("contests"); openCreateContest(); }} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue justify-start">
                      <Plus className="mr-2" size={16} />
                      Create New Contest
                    </Button>
                    <Button onClick={() => { setActiveTab("users"); setCreateUserOpen(true); }} variant="outline" className="w-full border-white/20 text-white bg-white/10 hover:bg-white/20 justify-start">
                      <Plus className="mr-2" size={16} />
                      Create New User
                    </Button>
                  </div>
                </GlassCard>
              </div>

              {/* Recent Contests */}
              {contests.length > 0 && (
                <GlassCard className="p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Recent Contests</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contests.slice(0, 6).map((c) => (
                      <div key={c.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-neon-purple/30 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-semibold truncate">{c.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[c.status] || statusColors.draft}`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-3 truncate">{c.description || "No description"}</p>
                        <div className="flex items-center gap-2">
                          <Link href={`/c/${c.slug}`}>
                            <Button variant="ghost" size="sm" className="text-electric-blue hover:bg-electric-blue/10 text-xs">
                              <ExternalLink size={12} className="mr-1" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/c/${c.slug}/admin`}>
                            <Button variant="ghost" size="sm" className="text-neon-purple hover:bg-neon-purple/10 text-xs">
                              <Settings size={12} className="mr-1" />
                              Admin
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* CONTESTS TAB                                                   */}
          {/* ============================================================= */}
          {activeTab === "contests" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">All Contests</h3>
                <Button onClick={openCreateContest} className="bg-gradient-to-r from-neon-purple to-electric-blue">
                  <Plus className="mr-2" size={18} />
                  Create Contest
                </Button>
              </div>
              {contests.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-400 text-lg mb-4">No contests yet</p>
                  <Button onClick={openCreateContest} className="bg-gradient-to-r from-neon-purple to-electric-blue">
                    <Plus className="mr-2" size={16} />
                    Create Your First Contest
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-gray-400">Name</TableHead>
                        <TableHead className="text-gray-400">Slug</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Domain</TableHead>
                        <TableHead className="text-gray-400">Created</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contests.map((c) => (
                        <TableRow key={c.id} className="border-white/10">
                          <TableCell className="text-white font-semibold">
                            {c.name}
                            {c.description && (
                              <span className="block text-xs text-gray-500 truncate max-w-xs">{c.description}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-400 font-mono text-sm">{c.slug}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[c.status] || statusColors.draft}`}>
                              {c.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs">
                            {c.customDomain ? (
                              <span className="flex items-center gap-1">
                                <span className="font-mono truncate max-w-[160px]">{c.customDomain}</span>
                                {c.customDomainVerifiedAt ? (
                                  <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">ok</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px]">pending</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/c/${c.slug}`}>
                                <Button variant="ghost" size="sm" className="text-electric-blue hover:bg-electric-blue/10">
                                  <ExternalLink size={16} />
                                </Button>
                              </Link>
                              <Link href={`/c/${c.slug}/admin`}>
                                <Button variant="ghost" size="sm" className="text-neon-purple hover:bg-neon-purple/10">
                                  <Settings size={16} />
                                </Button>
                              </Link>
                              <Button onClick={() => openEditContest(c)} variant="ghost" size="sm" className="text-amber-400 hover:bg-amber-500/10">
                                <Edit size={16} />
                              </Button>
                              <Button onClick={() => handleDeleteContest(c.slug)} variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
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
          {/* USERS TAB                                                      */}
          {/* ============================================================= */}
          {activeTab === "users" && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Platform Users</h3>
                <Button onClick={() => setCreateUserOpen(true)} className="bg-gradient-to-r from-neon-purple to-electric-blue">
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
                      <TableHead className="text-gray-400">Global Role</TableHead>
                      <TableHead className="text-gray-400">Legacy Role</TableHead>
                      <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-white/10">
                        <TableCell className="text-white font-semibold">{user.name || "Unnamed"}</TableCell>
                        <TableCell className="text-gray-400">{user.email}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            user.globalRole === "platform_admin"
                              ? "bg-hot-pink/20 text-hot-pink"
                              : "bg-gray-500/20 text-gray-400"
                          }`}>
                            {user.globalRole}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">{user.role || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button onClick={() => openResetPassword(user)} variant="ghost" size="sm" className="text-amber-400 hover:bg-amber-500/10" title="Reset Password">
                              <Key size={16} />
                            </Button>
                            <Button onClick={() => openEditUser(user)} variant="ghost" size="sm" className="text-electric-blue hover:bg-electric-blue/10">
                              <Edit size={16} />
                            </Button>
                            <Button
                              onClick={() => handleDeleteUser(user.id)}
                              variant="ghost" size="sm"
                              className="text-red-400 hover:bg-red-500/10"
                              disabled={user.id === session?.user?.id}
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
        </motion.div>
      </div>

      {/* ================================================================= */}
      {/* DIALOGS                                                            */}
      {/* ================================================================= */}

      {/* Contest Create / Edit Dialog */}
      <Dialog open={contestDialogOpen} onOpenChange={setContestDialogOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              {editingContest ? "Edit Contest" : "Create New Contest"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* ---- CLONE TOGGLE (create mode only) ---------------------- */}
            {!editingContest && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                <Label className="text-gray-200">Start with</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setContestForm({ ...contestForm, cloneFromSlug: "", shiftDatesByDays: 0 })}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${
                      !contestForm.cloneFromSlug
                        ? "border-neon-purple/50 bg-neon-purple/10 text-white"
                        : "border-white/10 bg-transparent text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    <div className="font-semibold">Blank contest</div>
                    <div className="text-xs opacity-80 mt-1">Start from scratch with platform defaults.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Default to the first cloneable contest so the dropdown shows a real value.
                      const first = cloneableContests[0]?.slug ?? "";
                      setContestForm({ ...contestForm, cloneFromSlug: first });
                    }}
                    disabled={cloneableContests.length === 0}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${
                      contestForm.cloneFromSlug
                        ? "border-electric-blue/50 bg-electric-blue/10 text-white"
                        : "border-white/10 bg-transparent text-gray-400 hover:bg-white/5"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold">Clone from existing</div>
                    <div className="text-xs opacity-80 mt-1">
                      {cloneableContests.length === 0
                        ? "No completed/active contests yet to clone from."
                        : "Copies rules, phases, scoring, prizes, tracks."}
                    </div>
                  </button>
                </div>
                {contestForm.cloneFromSlug && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-gray-200 text-sm">Source contest</Label>
                      <Select
                        value={contestForm.cloneFromSlug}
                        onValueChange={(v) => setContestForm({ ...contestForm, cloneFromSlug: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {cloneableContests.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              {c.name} ({c.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-200 text-sm">Shift phase dates by (days)</Label>
                      <Input
                        type="number"
                        value={contestForm.shiftDatesByDays}
                        onChange={(e) =>
                          setContestForm({ ...contestForm, shiftDatesByDays: parseInt(e.target.value) || 0 })
                        }
                        placeholder="e.g. 90 to push phases 3 months forward"
                        className="bg-white/5 border-white/10 text-white"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Rebases <code>phaseConfig</code> start/end dates relative to the clone.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- Core fields (both modes) ----------------------------- */}
            <div>
              <Label className="text-gray-200">Contest Name *</Label>
              <Input
                value={contestForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setContestForm({
                    ...contestForm,
                    name,
                    slug: editingContest ? contestForm.slug : autoSlug(name),
                    heroTitle: contestForm.heroTitle || name,
                  });
                }}
                placeholder="AI Hackathon 2025"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-200">Slug * (URL-friendly)</Label>
              <Input
                value={contestForm.slug}
                onChange={(e) => setContestForm({ ...contestForm, slug: e.target.value })}
                placeholder="ai-hackathon-2025"
                className="bg-white/5 border-white/10 text-white font-mono"
              />
              <p className="text-gray-500 text-xs mt-1">URL will be: /c/{contestForm.slug || "..."}</p>
            </div>

            {/* Fields below are hidden when cloning — they'll be copied from the source. */}
            {!contestForm.cloneFromSlug && (
              <>
                <div>
                  <Label className="text-gray-200">Description</Label>
                  <Textarea
                    value={contestForm.description}
                    onChange={(e) => setContestForm({ ...contestForm, description: e.target.value })}
                    placeholder="A brief description of the contest..."
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Status</Label>
                  <Select value={contestForm.status} onValueChange={(v) => setContestForm({ ...contestForm, status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-200">Hero Title</Label>
                  <Input
                    value={contestForm.heroTitle}
                    onChange={(e) => setContestForm({ ...contestForm, heroTitle: e.target.value })}
                    placeholder="Landing page headline"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-200">Hero Subtitle</Label>
                  <Textarea
                    value={contestForm.heroSubtitle}
                    onChange={(e) => setContestForm({ ...contestForm, heroSubtitle: e.target.value })}
                    placeholder="Landing page subtitle"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-200">Max Teams</Label>
                    <Input type="number" value={contestForm.maxTeams} onChange={(e) => setContestForm({ ...contestForm, maxTeams: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Max Approved</Label>
                    <Input type="number" value={contestForm.maxApprovedTeams} onChange={(e) => setContestForm({ ...contestForm, maxApprovedTeams: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-200">Max Members/Team</Label>
                    <Input type="number" value={contestForm.maxTeamMembers} onChange={(e) => setContestForm({ ...contestForm, maxTeamMembers: parseInt(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
              </>
            )}

            {/* ---- Custom domain (optional, both modes) ------------------ */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-gray-200 flex items-center gap-2">
                  <Globe size={14} /> Custom domain (optional)
                </Label>
                {editingContest?.customDomain && (
                  editingContest.customDomainVerifiedAt ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Verified</span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Pending verification</span>
                  )
                )}
              </div>
              <Input
                value={contestForm.customDomain}
                onChange={(e) => setContestForm({ ...contestForm, customDomain: e.target.value })}
                placeholder="leave blank to use the default URL (/c/{slug})"
                className="bg-white/5 border-white/10 text-white font-mono"
              />
              <p className="text-gray-500 text-xs">
                Once set and verified, visitors at <code>https://{contestForm.customDomain || "your-domain.com"}/</code> see this contest as a white-labeled site.
                Clear the field to remove the domain. Verification happens via a CNAME + visit to <code>/.well-known/contest-verify</code>.
              </p>
              {editingContest?.customDomain && !editingContest.customDomainVerifiedAt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyDomain(editingContest.slug)}
                  className="mt-1 border-yellow-500/30 text-yellow-400 bg-transparent hover:bg-yellow-500/10"
                >
                  Force-mark as verified (admin override)
                </Button>
              )}
            </div>

            {!editingContest && !contestForm.cloneFromSlug && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-blue-400 text-sm">
                  The contest will be created with default scoring criteria, phase configuration, prizes, and role settings.
                  You can customize these from the contest admin panel after creation.
                </p>
              </div>
            )}
            {!editingContest && contestForm.cloneFromSlug && (
              <div className="bg-electric-blue/10 border border-electric-blue/20 rounded-lg p-3">
                <p className="text-electric-blue text-sm">
                  Cloning will copy rules, phase config, scoring criteria, prizes, tracks, and certificate
                  templates from <span className="font-semibold">{contestForm.cloneFromSlug}</span>.
                  It will <span className="font-semibold">not</span> copy teams, users, submissions, or scores.
                  The new contest starts in <span className="font-semibold">draft</span>.
                </p>
              </div>
            )}

            <Button onClick={handleSaveContest} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
              {editingContest
                ? "Save Changes"
                : contestForm.cloneFromSlug
                  ? "Clone Contest"
                  : "Create Contest"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-200">Name</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Full name" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Email</Label>
              <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="user@example.com" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Password</Label>
              <PasswordInput value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Minimum 6 characters" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Global Role</Label>
              <Select value={userForm.globalRole} onValueChange={(v) => setUserForm({ ...userForm, globalRole: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="platform_admin">Platform Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateUser} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-200">Name</Label>
              <Input value={editUserForm.name} onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Email</Label>
              <Input type="email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Global Role</Label>
              <Select value={editUserForm.globalRole} onValueChange={(v) => setEditUserForm({ ...editUserForm, globalRole: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="platform_admin">Platform Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-200">Participant Role</Label>
              <Select value={editUserForm.role} onValueChange={(v) => setEditUserForm({ ...editUserForm, role: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEditUser} className="w-full bg-gradient-to-r from-neon-purple to-electric-blue">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Reset Password</DialogTitle>
          </DialogHeader>
          {resetPasswordUser && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-400">
                Reset password for: <span className="text-white font-semibold">{resetPasswordUser.name}</span>
                <span className="text-gray-500 block text-sm">{resetPasswordUser.email}</span>
              </p>
              <div>
                <Label className="text-gray-200">New Password</Label>
                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="bg-white/5 border-white/10 text-white" />
              </div>
              <Button onClick={handleResetPassword} className="w-full bg-gradient-to-r from-amber-500 to-orange-500">
                Reset Password
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
