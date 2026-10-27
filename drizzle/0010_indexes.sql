-- 0010: indexes on foreign keys / hot lookup columns. Postgres does not index
-- FK columns automatically; these keep per-contest queries fast as contests
-- (and users) accumulate. Additive + idempotent; safe to re-run.
CREATE INDEX IF NOT EXISTS "tracks_contest_id_idx" ON "tracks" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contest_users_user_id_idx" ON "contest_users" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contest_users_team_id_idx" ON "contest_users" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contest_users_contest_role_idx" ON "contest_users" ("contest_id", "role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_contest_id_idx" ON "teams" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_track_id_idx" ON "teams" ("track_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scores_judge_id_idx" ON "scores" ("judge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_templates_contest_id_idx" ON "certificate_templates" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcements_contest_id_idx" ON "announcements" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_contest_id_idx" ON "notifications" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_owner_idx" ON "media_assets" ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_contest_id_idx" ON "media_assets" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_invitations_team_id_idx" ON "team_invitations" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_invitations_invitee_idx" ON "team_invitations" ("invitee_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "problem_statements_contest_id_idx" ON "problem_statements" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stage_decisions_contest_id_idx" ON "stage_decisions" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "impact_metrics_contest_id_idx" ON "impact_metrics" ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "impact_metrics_team_id_idx" ON "impact_metrics" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");
