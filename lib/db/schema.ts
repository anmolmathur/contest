import { pgTable, text, timestamp, uuid, varchar, integer, pgEnum, unique } from "drizzle-orm/pg-core";
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

// Users Table (Auth.js compatible)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  role: roleEnum("role"),
  department: varchar("department", { length: 255 }),
  teamId: uuid("team_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Teams Table
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  track: trackEnum("track").notNull(),
  createdBy: uuid("created_by").notNull(),
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
  aiPromptsUsed: text("ai_prompts_used").notNull(),
  aiToolsUtilized: text("ai_tools_utilized").notNull(),
  aiScreenshots: text("ai_screenshots").array().notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date" }).defaultNow(),
});

// Scores Table
export const scores = pgTable("scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  judgeId: uuid("judge_id").notNull().references(() => users.id),
  aiUsageScore: integer("ai_usage_score").notNull(),
  businessImpactScore: integer("business_impact_score").notNull(),
  uxScore: integer("ux_score").notNull(),
  innovationScore: integer("innovation_score").notNull(),
  executionScore: integer("execution_score").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  uniqueJudgeSubmission: unique().on(table.submissionId, table.judgeId),
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
export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  scores: many(scores),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
  submissions: many(submissions),
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

