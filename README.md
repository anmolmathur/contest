# Multi-Contest Management Platform

A production-ready, multi-contest management platform for running hackathons and innovation challenges. Built with Next.js 16, TypeScript, PostgreSQL, and Drizzle ORM.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![License](https://img.shields.io/badge/License-Proprietary-red)

## Key Capabilities

- **Multi-Contest Support** - Create and run multiple independent contests, each with its own configuration, users, tracks, scoring criteria, and prizes
- **Dynamic Scoring** - Per-contest scoring criteria with configurable weights (supports any number of criteria)
- **Per-Contest Roles** - Same user can be a judge in one contest and a participant in another
- **Customizable Landing Pages** - Each contest has its own landing page, rules page, and branding
- **Two-Level Admin** - Platform Admin (global) + Contest Admin (per-contest)
- **Docker Deployment** - Multi-stage Dockerfile with standalone Next.js output

## Architecture Overview

```
URL Structure:
/                          Platform home (lists all contests)
/c/<slug>                  Contest landing page
/c/<slug>/rules            Contest rules page
/c/<slug>/dashboard        Participant dashboard
/c/<slug>/judging          Judge scoring portal
/c/<slug>/admin            Contest admin panel (9 tabs)
/platform/admin            Platform admin (contests + users)
/login, /register          Authentication
```

### Role Hierarchy

| Level | Role | Scope | Capabilities |
|-------|------|-------|-------------|
| Platform | `platform_admin` | Global | Create/manage all contests, manage all users |
| Contest | `admin` | Per-contest | Manage users, teams, tracks, settings for one contest |
| Contest | `judge` | Per-contest | Score submissions for one contest |
| Contest | `participant` | Per-contest | Join teams, submit work for one contest |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | NextAuth v5 (JWT + Credentials) |
| Styling | Tailwind CSS v4 + Shadcn/UI |
| Animation | Framer Motion |
| Deployment | Docker (multi-stage, standalone) |

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `contests` | Contest configuration (name, slug, status, hero content, rules, scoring criteria, phase config, prizes, role config) |
| `tracks` | Dynamic tracks per contest (replaces hardcoded enum) |
| `contest_users` | Per-contest role assignments (admin/judge/participant) with participant role |
| `users` | Platform users with `globalRole` (platform_admin / user) |
| `teams` | Teams linked to contests via `contestId` |
| `submissions` | Project submissions with AI evidence |
| `scores` | Judge scores with dynamic `criteriaScores` (jsonb) |
| `certificate_templates` | Certificate templates per contest |

### Key Design Decisions

- **Dynamic scoring**: `contests.scoringCriteria` (jsonb array) + `scores.criteriaScores` (jsonb) allow any number of scoring criteria per contest
- **Backward compatibility**: Legacy fixed score columns (`aiUsageScore`, etc.) kept for existing data; new contests use `criteriaScores` jsonb
- **Legacy `JUDGE_EMAILS`**: Still checked as fallback alongside new `isPlatformAdmin()` for backward compat

## Project Structure

```
app/
  api/
    c/[slug]/              Contest-scoped APIs
      teams/               Team CRUD, add/remove members, approve
      submissions/         Submission CRUD
      scores/              Score submit, list, delete
      leaderboard/         Dynamic leaderboard
      tracks/              Track CRUD
      users/               User assignment, role changes
      judges/              List judges
    contests/              Contest CRUD (platform admin)
    users/                 Platform user management
    auth/                  Authentication
  c/[slug]/                Contest frontend pages
    page.tsx               Landing page
    rules/page.tsx         Rules page
    dashboard/page.tsx     Participant dashboard
    judging/page.tsx       Judge portal
    admin/page.tsx         Contest admin (9 tabs)
    layout.tsx             Contest context provider
  platform/admin/page.tsx  Platform admin
lib/
  db/schema.ts             Drizzle schema (all tables)
  auth.ts                  NextAuth config (JWT + globalRole)
  contest-auth.ts          Authorization helpers (isPlatformAdmin, canAdminContest, etc.)
  contest-context.tsx      React context for contest data
  constants.ts             Default values for new contests
drizzle/                   Migration files
```

## Quick Start (Development)

```bash
# 1. Clone and install
git clone https://github.com/anmolmathur/contest.git
cd contest
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AUTH_SECRET

# 3. Run database migrations
npx drizzle-kit push

# 4. Start dev server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Application URL (e.g., `https://your-domain.com`) |
| `NODE_ENV` | No | `production` for production builds |

## Docker Deployment

The app uses a multi-stage Dockerfile with Next.js standalone output:

```bash
# Build and run
docker build -t contest .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e AUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="https://your-domain.com" \
  contest
```

See **[DEPLOYMENT-PRODUCTION.md](./DEPLOYMENT-PRODUCTION.md)** for full production deployment instructions for your DevOps team.

## Docker Compose (with existing stack)

```yaml
contest:
  build:
    context: ./contest
    dockerfile: Dockerfile
  ports:
    - "3000:3000"
  environment:
    - DATABASE_URL=postgresql://contestuser:password@postgres:5432/hackathon_db
    - AUTH_SECRET=${CONTEST_AUTH_SECRET}
    - NEXTAUTH_URL=https://your-domain.com
    - NODE_ENV=production
  depends_on:
    postgres:
      condition: service_healthy
```

## Post-Deployment: Database Migration

After deploying a new version with schema changes:

```bash
# From the project directory, pointing at the production DB
DATABASE_URL="postgresql://user:pass@host:5432/db" npx drizzle-kit push

# Set platform admin users
psql -U dbuser -d hackathon_db -c "
  UPDATE users SET global_role = 'platform_admin'
  WHERE email IN ('admin@example.com');
"
```

## Contest Admin Guide

### Creating a New Contest
1. Login as a Platform Admin
2. Go to `/platform/admin` > Contests tab > "Create Contest"
3. Set name, slug, description, status
4. After creation, go to `/c/<slug>/admin` > Settings tab to configure:
   - Scoring criteria (names, weights)
   - Phase configuration (names, dates, max points)
   - Prizes
   - Team constraints
   - Role configuration
   - Landing page content
   - Rules content

### Assigning Users to a Contest
1. Go to `/c/<slug>/admin` > Users tab
2. Click "Add User" > search by name or email
3. Select contest role: **Admin**, **Judge**, or **Participant**

### Making Someone a Contest Admin
- From `/c/<slug>/admin` > Users tab, add them with role **Admin** or edit existing user's role to **Admin**
- Platform Admins automatically have admin access to all contests

## API Reference

### Platform APIs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/contests` | Public | List all contests |
| POST | `/api/contests` | Platform Admin | Create contest |
| GET/PUT/DELETE | `/api/contests/[slug]` | Varies | Contest CRUD |
| GET | `/api/users/all` | Platform Admin | List all users |
| POST | `/api/users/create` | Platform Admin | Create user |
| PUT/DELETE | `/api/users/[id]` | Platform Admin | Update/delete user |

### Contest-Scoped APIs (`/api/c/[slug]/...`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `teams/all`, `teams/create` | Participant+ | Team management |
| POST | `teams/add-member`, `teams/remove-member` | Participant+ | Member management |
| POST | `teams/approve` | Admin | Approve/reject teams |
| POST | `submissions/create` | Participant | Submit work |
| GET | `submissions/all` | Judge+ | View all submissions |
| POST | `scores/submit` | Judge | Score a submission |
| GET | `scores/all` | Judge+ | View all scores |
| GET | `leaderboard` | Public | Contest leaderboard |
| GET/POST | `tracks` | Admin | Track management |
| POST | `users/assign` | Admin | Assign user to contest |
| PUT | `users/[id]/role` | Admin | Change user's contest role |

## Security

- Password hashing with bcryptjs (10 salt rounds)
- JWT sessions (stateless)
- `isPlatformAdmin()` + legacy `JUDGE_EMAILS` dual auth checks
- Per-contest role verification on all contest-scoped APIs
- SQL injection prevention via Drizzle ORM parameterized queries
- CSRF protection (NextAuth built-in)

## Additional Documentation

- [DEPLOYMENT-PRODUCTION.md](./DEPLOYMENT-PRODUCTION.md) - Production deployment guide for DevOps
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - General deployment options

## License

This project is proprietary and confidential. All rights reserved.
