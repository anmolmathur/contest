import { pgTable, text, timestamp, uuid, varchar, integer, pgEnum, unique, index, boolean, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", [
  "Developer",
  "Technical Lead",
  "Product Owner",
  "Business SPOC",
  "QA",
  "Intern",
]);

export const trackEnum = pgEnum("track", [
  "Alumni Portal",
  "Admission Portal",
  "DigiVarsity 3.0",
  "Partner Portal",
  "Communications Portal",
  "Placement Portal",
  "Referral Portal",
]);

export const contestStatusEnum = pgEnum("contest_status", [
  "draft",
  "active",
  "completed",
  "archived",
]);

// Visibility controls whether archived/completed contests are publicly browseable
export const contestVisibilityEnum = pgEnum("contest_visibility", [
  "public",     // listed on platform home, results visible
  "unlisted",   // results visible by direct link only
  "private",    // only contest members can view
]);

// Contests Table
export const contests = pgTable("contests", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: contestStatusEnum("status").default("draft").notNull(),
  visibility: contestVisibilityEnum("visibility").default("public").notNull(),
  // When true, legacy non-scoped routes (/api/teams/all, /dashboard, /admin, /judging)
  // resolve to this contest. Exactly one contest should be marked isDefault for the
  // pre-multi-tenant UI to continue working.
  isDefault: boolean("is_default").default(false).notNull(),
  createdBy: uuid("created_by").notNull(),

  // Custom domain (Milestone 2)
  customDomain: varchar("custom_domain", { length: 255 }).unique(),
  customDomainVerifiedAt: timestamp("custom_domain_verified_at", { mode: "date" }),
  supportEmail: varchar("support_email", { length: 255 }),

  // Landing Page Content
  heroTitle: text("hero_title"),
  heroSubtitle: text("hero_subtitle"),
  heroCtaText: varchar("hero_cta_text", { length: 255 }),
  bannerImageUrl: varchar("banner_image_url", { length: 500 }),

  // Whitelabel branding (Milestone 2)
  // { primaryColor, secondaryColor, accentColor, faviconUrl, ogImageUrl, metaTitle, metaDescription, footerHtml }
  brandingConfig: jsonb("branding_config"),

  // Feature flags per contest
  // { teamPitches: bool, aiAssistant: bool, publicLeaderboard: bool, notifications: bool, mediaUploads: bool }
  featureFlags: jsonb("feature_flags"),

  // FAQ entries: Array of {question, answer}
  faqConfig: jsonb("faq_config"),

  // Rules Page Content (markdown)
  rulesContent: text("rules_content"),
  eligibilityRules: text("eligibility_rules"),
  teamStructureRules: text("team_structure_rules"),
  deliverableRules: text("deliverable_rules"),

  // Contest Configuration (JSON for flexibility)
  // Array of {name, key, weight, description}
  scoringCriteria: jsonb("scoring_criteria"),
  // Array of {phase, name, maxPoints, startDate, endDate, description, details[], deliverables[]}
  phaseConfig: jsonb("phase_config"),
  // Array of {rank, label, amount (nullable), color}
  prizes: jsonb("prizes"),
  // Array of {role, maxPerTeam}
  roleConfig: jsonb("role_config"),

  // ---- Contest type (hackathon | business_symposium) and generic engine config ----
  // Preset registry lives in lib/contest-types.ts. The type selects defaults and
  // vocabulary; everything below can still be edited per contest.
  contestType: varchar("contest_type", { length: 30 }).default("hackathon").notNull(),
  // Array of {key, label, type, required, placeholder?, helpText?, phases?, accept?, maxSizeMb?, options?}
  // See lib/submission-fields.ts. Null = legacy hackathon fields.
  submissionFields: jsonb("submission_fields"),
  // {min, max, step, labels: [{min, max, label}]}. Null = 0-100.
  scoringScale: jsonb("scoring_scale"),
  // {track, team, phase, judge, submission, member} display-name overrides
  terminology: jsonb("terminology"),
  // {exclusiveTracks, feedbackVisibility, showcaseEnabled, resultsPublished, allowedEmailDomains, ...}
  settings: jsonb("settings"),
  // Array of {id, day, start, end, title, kind, speakerIds[], venue, description}
  agenda: jsonb("agenda"),
  // Array of {id, name, title, org, bio, photoUrl, roles[]}
  speakers: jsonb("speakers"),
  // Live on-stage finale state: {phase, currentTeamId, scoringOpen, queue[], timerEndsAt, revealStage}
  liveState: jsonb("live_state"),
  // Category awards on top of ranked prizes: Array of {key, label, description, amount, winnerTeamId}
  awards: jsonb("awards"),

  maxTeams: integer("max_teams").default(50).notNull(),
  maxApprovedTeams: integer("max_approved_teams").default(10).notNull(),
  maxTeamMembers: integer("max_team_members").default(7).notNull(),

  startDate: timestamp("start_date", { mode: "date" }),
  endDate: timestamp("end_date", { mode: "date" }),
  registrationDeadline: timestamp("registration_deadline", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Dynamic Tracks Table (replaces pgEnum for new contests)
export const tracks = pgTable("tracks", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 255 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  contestIdx: index("tracks_contest_id_idx").on(table.contestId),
}));

// Contest Users Table (many-to-many with per-contest role)
export const contestUsers = pgTable("contest_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(), // 'admin' | 'judge' | 'participant' | 'mentor' | 'validator'
  // Primary team role (e.g. 'Developer', 'The Mastermind'). For validators: scope 'Data' | 'Finance'.
  participantRole: varchar("participant_role", { length: 100 }),
  // Additional team roles the same person also plays (string[]); see lib/team-capacity.ts
  extraRoles: jsonb("extra_roles"),
  teamId: uuid("team_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueContestUser: unique().on(table.contestId, table.userId),
  userIdx: index("contest_users_user_id_idx").on(table.userId),
  teamIdx: index("contest_users_team_id_idx").on(table.teamId),
  roleIdx: index("contest_users_contest_role_idx").on(table.contestId, table.role),
}));

// Users Table (Auth.js compatible)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  role: roleEnum("role"), // kept for backward compat (nullable; no longer required at signup)
  department: varchar("department", { length: 255 }),
  teamId: uuid("team_id"), // kept for backward compat
  globalRole: varchar("global_role", { length: 50 }).default("user").notNull(), // 'platform_admin' or 'user'
  // 'internal' = TeamLease employee (email on an internal domain, see lib/user-type.ts),
  // 'external' = student / outside participant. Derived at signup + every Google login.
  userType: varchar("user_type", { length: 20 }).default("external").notNull(),
  // Notification preferences per channel per event type
  // { email: { teamInvite: bool, phaseStarted: bool, ... }, inApp: { ... } }
  notificationPrefs: jsonb("notification_prefs"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Teams Table
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  track: trackEnum("track"), // kept for backward compat, made nullable
  contestId: uuid("contest_id").references(() => contests.id),
  trackId: uuid("track_id").references(() => tracks.id),
  createdBy: uuid("created_by").notNull(),
  leaderId: uuid("leader_id"),
  approved: boolean("approved").default(false).notNull(),
  // Ideathon: claimed problem from the Problem Bank, declared solution paths (string[]),
  // and elimination status after a gate stage.
  problemId: uuid("problem_id"),
  solutionPaths: jsonb("solution_paths"),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active' | 'eliminated' | 'withdrawn'
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  contestIdx: index("teams_contest_id_idx").on(table.contestId),
  trackIdx: index("teams_track_id_idx").on(table.trackId),
}));

// Submissions Table
export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  phase: integer("phase").notNull(),
  // Legacy hackathon columns — nullable since 0008. New code reads/writes
  // `fields` (keyed by contests.submissionFields[].key); hackathon contests
  // still mirror into these columns for older exports.
  githubUrl: varchar("github_url", { length: 255 }),
  demoUrl: varchar("demo_url", { length: 255 }),
  submissionDescription: text("submission_description"),
  aiPromptsUsed: text("ai_prompts_used"),
  aiToolsUtilized: text("ai_tools_utilized"),
  aiScreenshots: text("ai_screenshots").array(),
  // Generic submission values: Record<fieldKey, string | string[]>
  fields: jsonb("fields"),
  submittedAt: timestamp("submitted_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueTeamPhase: unique().on(table.teamId, table.phase),
}));

// Scores Table
export const scores = pgTable("scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  judgeId: uuid("judge_id").notNull().references(() => users.id),
  // Legacy fixed columns (kept for backward compat with existing contest)
  aiUsageScore: integer("ai_usage_score"),
  businessImpactScore: integer("business_impact_score"),
  uxScore: integer("ux_score"),
  innovationScore: integer("innovation_score"),
  executionScore: integer("execution_score"),
  // Dynamic scoring for new contests with variable criteria
  criteriaScores: jsonb("criteria_scores"), // e.g. {"aiUtilization": 80, "presentationCommunication": 75}
  // Jury comments shown to the team once results are published
  feedback: text("feedback"),
  // Jury-only note, never shown to teams
  privateNote: text("private_note"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueJudgeSubmission: unique().on(table.submissionId, table.judgeId),
  judgeIdx: index("scores_judge_id_idx").on(table.judgeId),
}));

// Certificate Templates Table
export const certificateTemplates = pgTable("certificate_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  contestId: uuid("contest_id").references(() => contests.id), // null = platform-wide

  // Text customizations
  titleText: varchar("title_text", { length: 255 }).default("Certificate of Achievement").notNull(),
  subtitleText: varchar("subtitle_text", { length: 500 }).default("This certificate is awarded to").notNull(),
  eventName: varchar("event_name", { length: 255 }).default("Innovation Challenge").notNull(),
  footerText: text("footer_text"),
  signatureName: varchar("signature_name", { length: 255 }),
  signatureTitle: varchar("signature_title", { length: 255 }),

  // Logo customizations (URLs)
  primaryLogoUrl: varchar("primary_logo_url", { length: 500 }),
  secondaryLogoUrl: varchar("secondary_logo_url", { length: 500 }),

  // Style customizations
  primaryColor: varchar("primary_color", { length: 7 }).default("#7c3aed").notNull(),
  secondaryColor: varchar("secondary_color", { length: 7 }).default("#2563eb").notNull(),

  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  contestIdx: index("certificate_templates_contest_id_idx").on(table.contestId),
}));

// ================================================================
// Milestone 3/4 tables
// ================================================================

// Per-contest announcements (renderable markdown, pinned support)
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  publishedAt: timestamp("published_at", { mode: "date" }).defaultNow(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  contestIdx: index("announcements_contest_id_idx").on(table.contestId),
}));

// In-app notifications (fed by the dispatch layer; email sent out-of-band)
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contestId: uuid("contest_id").references(() => contests.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 64 }).notNull(), // 'team_invite', 'phase_started', etc.
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  actionUrl: varchar("action_url", { length: 500 }),
  readAt: timestamp("read_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
  contestIdx: index("notifications_contest_id_idx").on(table.contestId),
}));

// Uploaded media (pitch videos, images, logos, banners). Stored in S3 (or mock local disk in dev).
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contestId: uuid("contest_id").references(() => contests.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  kind: varchar("kind", { length: 64 }).notNull(), // 'pitch_video' | 'pitch_image' | 'banner' | 'certificate_logo' | 'submission_screenshot' | 'submission_file' | 'speaker_photo'
  bucket: varchar("bucket", { length: 255 }),
  objectKey: varchar("object_key", { length: 500 }),
  url: varchar("url", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index("media_assets_owner_idx").on(table.ownerUserId),
  contestIdx: index("media_assets_contest_id_idx").on(table.contestId),
}));

// Team pitches — participants advertise themselves to team leaders
export const teamPitches = pgTable("team_pitches", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  bioMarkdown: text("bio_markdown"),
  skills: jsonb("skills"), // string[]
  heroMediaUrl: varchar("hero_media_url", { length: 1000 }),
  videoUrl: varchar("video_url", { length: 1000 }),
  imageUrls: jsonb("image_urls"), // string[]
  lookingForRoles: jsonb("looking_for_roles"), // string[]
  visible: boolean("visible").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueContestUser: unique().on(table.contestId, table.userId),
}));

// Team invites / join requests between participants and team leaders
export const teamInvitations = pgTable("team_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  inviterUserId: uuid("inviter_user_id").notNull().references(() => users.id),
  inviteeUserId: uuid("invitee_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  direction: varchar("direction", { length: 16 }).notNull(), // 'invite' (leader→user) | 'request' (user→team)
  status: varchar("status", { length: 16 }).default("pending").notNull(), // 'pending' | 'accepted' | 'declined' | 'cancelled'
  message: text("message"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  teamIdx: index("team_invitations_team_id_idx").on(table.teamId),
  inviteeIdx: index("team_invitations_invitee_idx").on(table.inviteeUserId),
}));

// ================================================================
// Ideathon tables (0009)
// ================================================================

// Problem Bank: curated problems (open) and team proposals (proposed → approved/rejected)
export const problemStatements = pgTable("problem_statements", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  ownerDepartment: varchar("owner_department", { length: 255 }),
  sponsor: varchar("sponsor", { length: 255 }),
  // {metric, unit, direction: 'increase'|'decrease', from?, to?}
  metricTemplate: jsonb("metric_template"),
  maxTeams: integer("max_teams").default(1).notNull(),
  status: varchar("status", { length: 20 }).default("open").notNull(), // 'open' | 'proposed' | 'approved' | 'rejected' | 'closed'
  proposedByTeamId: uuid("proposed_by_team_id").references(() => teams.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  contestIdx: index("problem_statements_contest_id_idx").on(table.contestId),
}));

// Jury go/no-go decision for a team at a gate stage (phaseConfig[].gate)
export const stageDecisions = pgTable("stage_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  phase: integer("phase").notNull(),
  decision: varchar("decision", { length: 20 }).notNull(), // 'go' | 'conditional' | 'out'
  conditions: text("conditions"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueTeamPhase: unique().on(table.teamId, table.phase),
  contestIdx: index("stage_decisions_contest_id_idx").on(table.contestId),
}));

// Validated before/after impact metrics with finance valuation
export const impactMetrics = pgTable("impact_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  direction: varchar("direction", { length: 10 }).default("decrease").notNull(), // 'increase' | 'decrease'
  category: varchar("category", { length: 20 }).default("time").notNull(), // revenue|cost|time|risk|adoption|experience
  sourceSystem: varchar("source_system", { length: 255 }),
  method: text("method"),

  baselineValue: doublePrecision("baseline_value"),
  baselinePeriod: varchar("baseline_period", { length: 120 }),
  baselineEvidence: jsonb("baseline_evidence"), // string[] (urls)
  baselineStatus: varchar("baseline_status", { length: 20 }).default("draft").notNull(), // draft|submitted|validated|rejected
  baselineValidatorId: uuid("baseline_validator_id").references(() => users.id),
  baselineNote: text("baseline_note"),

  targetValue: doublePrecision("target_value"),

  actualValue: doublePrecision("actual_value"),
  actualPeriod: varchar("actual_period", { length: 120 }),
  actualEvidence: jsonb("actual_evidence"),
  actualStatus: varchar("actual_status", { length: 20 }).default("draft").notNull(),
  actualValidatorId: uuid("actual_validator_id").references(() => users.id),
  actualNote: text("actual_note"),

  // Finance valuation (whole rupees)
  realisedValueInr: integer("realised_value_inr"),
  recurringAnnualValueInr: integer("recurring_annual_value_inr"),
  recurringYears: integer("recurring_years").default(1),
  valuationBasis: text("valuation_basis"),
  financeStatus: varchar("finance_status", { length: 20 }).default("pending").notNull(), // pending|validated|rejected
  financeValidatorId: uuid("finance_validator_id").references(() => users.id),
  financeNote: text("finance_note"),

  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  contestIdx: index("impact_metrics_contest_id_idx").on(table.contestId),
  teamIdx: index("impact_metrics_team_id_idx").on(table.teamId),
}));

// Auth.js Tables
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => ({
  userIdx: index("accounts_user_id_idx").on(table.userId),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => ({
  userIdx: index("sessions_user_id_idx").on(table.userId),
}));

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => ({
  compoundKey: unique().on(table.identifier, table.token),
}));

// Password reset tokens. The `token_hash` column stores SHA-256(rawToken)
// rather than the raw token itself, so a DB leak doesn't yield usable links.
// See lib/auth/password-reset.ts for the issue/consume helpers.
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("password_reset_tokens_user_id_idx").on(table.userId),
}));

// Relations
export const contestsRelations = relations(contests, ({ one, many }) => ({
  creator: one(users, {
    fields: [contests.createdBy],
    references: [users.id],
  }),
  tracks: many(tracks),
  teams: many(teams),
  contestUsers: many(contestUsers),
  certificateTemplates: many(certificateTemplates),
  problemStatements: many(problemStatements),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  contest: one(contests, {
    fields: [tracks.contestId],
    references: [contests.id],
  }),
  teams: many(teams),
}));

export const contestUsersRelations = relations(contestUsers, ({ one }) => ({
  contest: one(contests, {
    fields: [contestUsers.contestId],
    references: [contests.id],
  }),
  user: one(users, {
    fields: [contestUsers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [contestUsers.teamId],
    references: [teams.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  scores: many(scores),
  contestUsers: many(contestUsers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  members: many(users),
  submissions: many(submissions),
  contest: one(contests, {
    fields: [teams.contestId],
    references: [contests.id],
  }),
  trackRef: one(tracks, {
    fields: [teams.trackId],
    references: [tracks.id],
  }),
  problem: one(problemStatements, {
    fields: [teams.problemId],
    references: [problemStatements.id],
  }),
  contestMembers: many(contestUsers),
  stageDecisions: many(stageDecisions),
  impactMetrics: many(impactMetrics),
}));

export const problemStatementsRelations = relations(problemStatements, ({ one }) => ({
  contest: one(contests, {
    fields: [problemStatements.contestId],
    references: [contests.id],
  }),
  track: one(tracks, {
    fields: [problemStatements.trackId],
    references: [tracks.id],
  }),
}));

export const stageDecisionsRelations = relations(stageDecisions, ({ one }) => ({
  team: one(teams, {
    fields: [stageDecisions.teamId],
    references: [teams.id],
  }),
  contest: one(contests, {
    fields: [stageDecisions.contestId],
    references: [contests.id],
  }),
}));

export const impactMetricsRelations = relations(impactMetrics, ({ one }) => ({
  team: one(teams, {
    fields: [impactMetrics.teamId],
    references: [teams.id],
  }),
  contest: one(contests, {
    fields: [impactMetrics.contestId],
    references: [contests.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  team: one(teams, {
    fields: [submissions.teamId],
    references: [teams.id],
  }),
  scores: many(scores),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  submission: one(submissions, {
    fields: [scores.submissionId],
    references: [submissions.id],
  }),
  judge: one(users, {
    fields: [scores.judgeId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const certificateTemplatesRelations = relations(certificateTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [certificateTemplates.createdBy],
    references: [users.id],
  }),
  contest: one(contests, {
    fields: [certificateTemplates.contestId],
    references: [contests.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  contest: one(contests, {
    fields: [announcements.contestId],
    references: [contests.id],
  }),
  author: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  contest: one(contests, {
    fields: [notifications.contestId],
    references: [contests.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  owner: one(users, {
    fields: [mediaAssets.ownerUserId],
    references: [users.id],
  }),
  contest: one(contests, {
    fields: [mediaAssets.contestId],
    references: [contests.id],
  }),
  team: one(teams, {
    fields: [mediaAssets.teamId],
    references: [teams.id],
  }),
}));

export const teamPitchesRelations = relations(teamPitches, ({ one }) => ({
  contest: one(contests, {
    fields: [teamPitches.contestId],
    references: [contests.id],
  }),
  user: one(users, {
    fields: [teamPitches.userId],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  inviter: one(users, {
    fields: [teamInvitations.inviterUserId],
    references: [users.id],
  }),
  invitee: one(users, {
    fields: [teamInvitations.inviteeUserId],
    references: [users.id],
  }),
}));
