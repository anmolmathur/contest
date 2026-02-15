import { pgTable, text, timestamp, uuid, varchar, integer, pgEnum, unique, boolean, jsonb } from "drizzle-orm/pg-core";
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

// Contests Table
export const contests = pgTable("contests", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  status: contestStatusEnum("status").default("draft").notNull(),
  createdBy: uuid("created_by").notNull(),

  // Landing Page Content
  heroTitle: text("hero_title"),
  heroSubtitle: text("hero_subtitle"),
  heroCtaText: varchar("hero_cta_text", { length: 255 }),
  bannerImageUrl: varchar("banner_image_url", { length: 500 }),

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

  maxTeams: integer("max_teams").default(50).notNull(),
  maxApprovedTeams: integer("max_approved_teams").default(10).notNull(),
  maxTeamMembers: integer("max_team_members").default(7).notNull(),

  startDate: timestamp("start_date", { mode: "date" }),
  endDate: timestamp("end_date", { mode: "date" }),
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
});

// Contest Users Table (many-to-many with per-contest role)
export const contestUsers = pgTable("contest_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  contestId: uuid("contest_id").notNull().references(() => contests.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(), // 'admin', 'judge', 'participant'
  participantRole: varchar("participant_role", { length: 100 }), // e.g. 'Developer', 'Team Lead'
  teamId: uuid("team_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueContestUser: unique().on(table.contestId, table.userId),
}));

// Users Table (Auth.js compatible)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  role: roleEnum("role"), // kept for backward compat
  department: varchar("department", { length: 255 }),
  teamId: uuid("team_id"), // kept for backward compat
  globalRole: varchar("global_role", { length: 50 }).default("user").notNull(), // 'platform_admin' or 'user'
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
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Submissions Table
export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  phase: integer("phase").notNull(),
  githubUrl: varchar("github_url", { length: 255 }).notNull(),
  demoUrl: varchar("demo_url", { length: 255 }).notNull(),
  submissionDescription: text("submission_description"),
  aiPromptsUsed: text("ai_prompts_used").notNull(),
  aiToolsUtilized: text("ai_tools_utilized").notNull(),
  aiScreenshots: text("ai_screenshots").array().notNull(),
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
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueJudgeSubmission: unique().on(table.submissionId, table.judgeId),
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
  eventName: varchar("event_name", { length: 255 }).default("AI Vibe Coding Challenge 2024").notNull(),
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
});

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
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => ({
  compoundKey: unique().on(table.identifier, table.token),
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
  contestMembers: many(contestUsers),
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
