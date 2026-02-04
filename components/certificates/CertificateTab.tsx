"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Download,
  Users,
  Trophy,
  FileText,
  Plus,
  Edit,
  Trash2,
  Star,
  Crown,
  Loader2,
  CheckCircle,
  Image as ImageIcon,
} from "lucide-react";
import { CertificateTemplate, WinningTeam, TeamMember } from "./types";

interface CertificateTabProps {
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

const RANK_COLORS = {
  gold: "from-yellow-400 to-amber-500",
  silver: "from-gray-300 to-gray-400",
  bronze: "from-amber-600 to-amber-700",
  copper: "from-orange-400 to-orange-500",
  steel: "from-slate-400 to-slate-500",
};

const RANK_BG = {
  gold: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
  silver: "bg-gray-400/20 border-gray-400/30 text-gray-300",
  bronze: "bg-amber-600/20 border-amber-600/30 text-amber-500",
  copper: "bg-orange-500/20 border-orange-500/30 text-orange-400",
  steel: "bg-slate-500/20 border-slate-500/30 text-slate-400",
};

export default function CertificateTab({ setError, setSuccess }: CertificateTabProps) {
  const [loading, setLoading] = useState(true);
  const [winners, setWinners] = useState<WinningTeam[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [downloadingMember, setDownloadingMember] = useState<string | null>(null);
  const [downloadingTeam, setDownloadingTeam] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Template form dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    isDefault: false,
    titleText: "Certificate of Achievement",
    subtitleText: "This certificate is awarded to",
    eventName: "AI Vibe Coding Challenge 2024",
    footerText: "",
    signatureName: "",
    signatureTitle: "",
    primaryLogoUrl: "",
    secondaryLogoUrl: "",
    primaryColor: "#7c3aed",
    secondaryColor: "#2563eb",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadWinners(), loadTemplates()]);
    setLoading(false);
  };

  const loadWinners = async () => {
    try {
      const res = await fetch("/api/certificates/winners?limit=5");
      const data = await res.json();
      setWinners(data.winners || []);
    } catch (err) {
      console.error("Error loading winners:", err);
      setError("Failed to load winners");
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/certificates/templates");
      const data = await res.json();
      setTemplates(data.templates || []);

      // Auto-select default template
      const defaultTemplate = data.templates?.find((t: CertificateTemplate) => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.id || null);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    }
  };

  const handleDownloadCertificate = async (member: TeamMember, team: WinningTeam) => {
    try {
      setDownloadingMember(member.id);
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          teamId: team.teamId,
          rank: team.rank,
          templateId: selectedTemplate,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate certificate");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${member.name?.replace(/\s+/g, "-") || "participant"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(`Certificate downloaded for ${member.name}`);
    } catch (err) {
      setError("Failed to download certificate");
    } finally {
      setDownloadingMember(null);
    }
  };

  const handleDownloadTeamCertificates = async (team: WinningTeam) => {
    try {
      setDownloadingTeam(team.teamId);

      for (const member of team.members) {
        await handleDownloadCertificateQuiet(member, team);
        // Small delay between downloads to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setSuccess(`All certificates downloaded for ${team.teamName}`);
    } catch (err) {
      setError("Failed to download team certificates");
    } finally {
      setDownloadingTeam(null);
    }
  };

  const handleDownloadAllCertificates = async () => {
    try {
      setDownloadingAll(true);

      for (const team of winners) {
        for (const member of team.members) {
          await handleDownloadCertificateQuiet(member, team);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setSuccess("All winner certificates downloaded successfully");
    } catch (err) {
      setError("Failed to download all certificates");
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDownloadCertificateQuiet = async (member: TeamMember, team: WinningTeam) => {
    const res = await fetch("/api/certificates/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        teamId: team.teamId,
        rank: team.rank,
        templateId: selectedTemplate,
      }),
    });

    if (!res.ok) throw new Error("Failed to generate certificate");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-${team.teamName.replace(/\s+/g, "-")}-${member.name?.replace(/\s+/g, "-") || "participant"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      isDefault: false,
      titleText: "Certificate of Achievement",
      subtitleText: "This certificate is awarded to",
      eventName: "AI Vibe Coding Challenge 2024",
      footerText: "",
      signatureName: "",
      signatureTitle: "",
      primaryLogoUrl: "",
      secondaryLogoUrl: "",
      primaryColor: "#7c3aed",
      secondaryColor: "#2563eb",
    });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (template: CertificateTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || "",
      isDefault: template.isDefault || false,
      titleText: template.titleText,
      subtitleText: template.subtitleText,
      eventName: template.eventName,
      footerText: template.footerText || "",
      signatureName: template.signatureName || "",
      signatureTitle: template.signatureTitle || "",
      primaryLogoUrl: template.primaryLogoUrl || "",
      secondaryLogoUrl: template.secondaryLogoUrl || "",
      primaryColor: template.primaryColor,
      secondaryColor: template.secondaryColor,
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name) {
      setError("Template name is required");
      return;
    }

    try {
      const url = editingTemplate
        ? `/api/certificates/templates/${editingTemplate.id}`
        : "/api/certificates/templates";

      const res = await fetch(url, {
        method: editingTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save template");
        return;
      }

      setSuccess(editingTemplate ? "Template updated successfully" : "Template created successfully");
      setTemplateDialogOpen(false);
      loadTemplates();
    } catch (err) {
      setError("Failed to save template");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const res = await fetch(`/api/certificates/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Failed to delete template");
        return;
      }

      setSuccess("Template deleted successfully");
      if (selectedTemplate === templateId) {
        setSelectedTemplate(null);
      }
      loadTemplates();
    } catch (err) {
      setError("Failed to delete template");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-neon-purple" size={32} />
        <span className="ml-3 text-gray-400">Loading certificate data...</span>
      </div>
    );
  }

  const totalMembers = winners.reduce((sum, team) => sum + team.members.length, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={24} />
            <div>
              <p className="text-gray-400 text-sm">Winning Teams</p>
              <p className="text-2xl font-bold text-white">{winners.length}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <Users className="text-electric-blue" size={24} />
            <div>
              <p className="text-gray-400 text-sm">Total Recipients</p>
              <p className="text-2xl font-bold text-white">{totalMembers}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="text-neon-purple" size={24} />
            <div>
              <p className="text-gray-400 text-sm">Templates</p>
              <p className="text-2xl font-bold text-white">{templates.length}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Template Selection & Management */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={20} />
            Certificate Templates
          </h3>
          <Button
            onClick={openCreateTemplate}
            className="bg-gradient-to-r from-neon-purple to-electric-blue"
          >
            <Plus className="mr-2" size={16} />
            Create Template
          </Button>
        </div>

        {templates.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No templates created yet. Create a template to customize your certificates.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template.id || null)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedTemplate === template.id
                    ? "border-neon-purple bg-neon-purple/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">{template.name}</h4>
                    {template.isDefault && (
                      <Star className="text-yellow-400 fill-yellow-400" size={14} />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTemplate(template);
                      }}
                      className="text-electric-blue hover:bg-electric-blue/10 h-7 w-7 p-0"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id!);
                      }}
                      className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: template.primaryColor }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: template.secondaryColor }}
                  />
                </div>
                <p className="text-xs text-gray-500 truncate">{template.eventName}</p>
                {selectedTemplate === template.id && (
                  <div className="flex items-center gap-1 mt-2 text-neon-purple text-xs">
                    <CheckCircle size={12} />
                    Selected
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Winners List */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy size={20} />
            Winning Teams & Certificates
          </h3>
          {winners.length > 0 && (
            <Button
              onClick={handleDownloadAllCertificates}
              disabled={downloadingAll}
              className="bg-gradient-to-r from-hot-pink to-neon-purple"
            >
              {downloadingAll ? (
                <Loader2 className="mr-2 animate-spin" size={16} />
              ) : (
                <Download className="mr-2" size={16} />
              )}
              Download All ({totalMembers} certificates)
            </Button>
          )}
        </div>

        {winners.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No approved teams with scores yet. Winners will appear here once judging is complete.
          </p>
        ) : (
          <div className="space-y-6">
            {winners.map((team) => (
              <motion.div
                key={team.teamId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-white/10 rounded-lg overflow-hidden"
              >
                {/* Team Header */}
                <div className={`p-4 bg-gradient-to-r ${RANK_COLORS[team.prizeColor]} bg-opacity-20`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold border ${RANK_BG[team.prizeColor]}`}>
                        {team.rankLabel}
                      </span>
                      <div>
                        <h4 className="text-lg font-bold text-white">{team.teamName}</h4>
                        <p className="text-sm text-gray-300">{team.track}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-300">
                        Score: <span className="font-bold text-white">{team.totalScore.toFixed(1)}</span>
                      </span>
                      <Button
                        onClick={() => handleDownloadTeamCertificates(team)}
                        disabled={downloadingTeam === team.teamId}
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        {downloadingTeam === team.teamId ? (
                          <Loader2 className="mr-2 animate-spin" size={14} />
                        ) : (
                          <Download className="mr-2" size={14} />
                        )}
                        Download All ({team.members.length})
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Member</TableHead>
                      <TableHead className="text-gray-400">Role</TableHead>
                      <TableHead className="text-gray-400">Email</TableHead>
                      <TableHead className="text-gray-400 text-right">Certificate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.members.map((member) => (
                      <TableRow key={member.id} className="border-white/10">
                        <TableCell className="text-white font-medium">
                          <div className="flex items-center gap-2">
                            {member.name}
                            {member.isLeader && (
                              <Crown className="text-amber-400" size={14} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400">{member.role}</TableCell>
                        <TableCell className="text-gray-400">{member.email}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => handleDownloadCertificate(member, team)}
                            disabled={downloadingMember === member.id}
                            variant="ghost"
                            size="sm"
                            className="text-electric-blue hover:bg-electric-blue/10"
                          >
                            {downloadingMember === member.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Download size={16} />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Template Form Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-gray-200">Template Name *</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="My Certificate Template"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={templateForm.isDefault}
                  onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                  className="rounded border-white/20"
                />
                <Label htmlFor="isDefault" className="text-gray-200 cursor-pointer">
                  Set as default template
                </Label>
              </div>

              <div className="col-span-2">
                <Label className="text-gray-200">Title Text</Label>
                <Input
                  value={templateForm.titleText}
                  onChange={(e) => setTemplateForm({ ...templateForm, titleText: e.target.value })}
                  placeholder="Certificate of Achievement"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-gray-200">Subtitle Text</Label>
                <Input
                  value={templateForm.subtitleText}
                  onChange={(e) => setTemplateForm({ ...templateForm, subtitleText: e.target.value })}
                  placeholder="This certificate is awarded to"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-gray-200">Event Name</Label>
                <Input
                  value={templateForm.eventName}
                  onChange={(e) => setTemplateForm({ ...templateForm, eventName: e.target.value })}
                  placeholder="AI Vibe Coding Challenge 2024"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-gray-200">Footer Text (optional)</Label>
                <Textarea
                  value={templateForm.footerText}
                  onChange={(e) => setTemplateForm({ ...templateForm, footerText: e.target.value })}
                  placeholder="Additional message or acknowledgment..."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-200">Signature Name</Label>
                <Input
                  value={templateForm.signatureName}
                  onChange={(e) => setTemplateForm({ ...templateForm, signatureName: e.target.value })}
                  placeholder="John Doe"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-200">Signature Title</Label>
                <Input
                  value={templateForm.signatureTitle}
                  onChange={(e) => setTemplateForm({ ...templateForm, signatureTitle: e.target.value })}
                  placeholder="CEO, TeamLease"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-gray-200 flex items-center gap-2">
                  <ImageIcon size={14} />
                  Primary Logo URL
                </Label>
                <Input
                  value={templateForm.primaryLogoUrl}
                  onChange={(e) => setTemplateForm({ ...templateForm, primaryLogoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="bg-white/5 border-white/10 text-white"
                />
                {templateForm.primaryLogoUrl && (
                  <div className="mt-2 p-2 bg-white/5 rounded-lg inline-block">
                    <img
                      src={templateForm.primaryLogoUrl}
                      alt="Primary logo preview"
                      className="max-h-12 object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <Label className="text-gray-200 flex items-center gap-2">
                  <ImageIcon size={14} />
                  Secondary Logo URL (optional)
                </Label>
                <Input
                  value={templateForm.secondaryLogoUrl}
                  onChange={(e) => setTemplateForm({ ...templateForm, secondaryLogoUrl: e.target.value })}
                  placeholder="https://example.com/partner-logo.png"
                  className="bg-white/5 border-white/10 text-white"
                />
                {templateForm.secondaryLogoUrl && (
                  <div className="mt-2 p-2 bg-white/5 rounded-lg inline-block">
                    <img
                      src={templateForm.secondaryLogoUrl}
                      alt="Secondary logo preview"
                      className="max-h-12 object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-gray-200">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={templateForm.primaryColor}
                    onChange={(e) => setTemplateForm({ ...templateForm, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={templateForm.primaryColor}
                    onChange={(e) => setTemplateForm({ ...templateForm, primaryColor: e.target.value })}
                    className="bg-white/5 border-white/10 text-white flex-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-200">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={templateForm.secondaryColor}
                    onChange={(e) => setTemplateForm({ ...templateForm, secondaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <Input
                    value={templateForm.secondaryColor}
                    onChange={(e) => setTemplateForm({ ...templateForm, secondaryColor: e.target.value })}
                    className="bg-white/5 border-white/10 text-white flex-1"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveTemplate}
              className="w-full bg-gradient-to-r from-neon-purple to-electric-blue mt-4"
            >
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
