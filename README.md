# Innovation Challenge Management Platform

A production-ready, visually stunning management platform for the "Innovation Challenge: AI/Vibe Coding Hackathon" built with Next.js 15, TypeScript, PostgreSQL, and Drizzle ORM.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue) ![License](https://img.shields.io/badge/License-Proprietary-red)

## ✨ Features Overview

### 🎨 Award-Winning Design
- **Deep Dark Mode** - Rich #0a0a0a background with SVG grid pattern
- **Glassmorphism** - Backdrop blur effects with subtle transparency
- **Neon Gradient Palette** - Purple (#7c3aed), Blue (#2563eb), Pink (#db2777)
- **Framer Motion** - Smooth animations and page transitions
- **Responsive Design** - Mobile-first, works on all devices
- **Interactive Components** - Tilt effects, glowing buttons, animated timelines

### 🔐 Authentication & Authorization
- **NextAuth v5 (Auth.js)** with credentials provider
- **JWT Sessions** for fast, stateless authentication
- **Password Hashing** with bcryptjs (10 salt rounds)
- **Role-Based Access Control** - Six predefined roles
- **Protected Routes** via Next.js middleware
- **Judge Verification** - Email-based access control for judging portal

### 👥 User Management
Six predefined roles with strict validation:
- **Developer** - Core development team (3 per team)
- **Technical Lead** - Team technical leadership (1 per team)
- **Product Owner** - Product direction (1 per team)
- **Business SPOC** - Business alignment (1 per team)
- **QA** - Quality assurance (optional)
- **Intern** - Junior team member (optional, 1 per team)

Features:
- Department tracking
- Team assignment
- User profile management
- Available users list (users without teams)

### 🏆 Team Management
**Hard Constraints:**
- **Maximum 5 teams** system-wide (enforced at API level)
- **Team Size**: 5-6 members per team
- **Composition Rules**:
  - Exactly 3 Developers
  - Exactly 1 Technical Lead
  - Exactly 1 Product Owner
  - Exactly 1 Business SPOC
  - Optional: 1 Intern or QA (max 6 total)

**Features:**
- Team creator can add/manage members
- Seven mandatory tracks to choose from
- Real-time team count display
- Automatic UI disabling when limit reached
- Team member role validation

**Seven Mandatory Tracks:**
1. Alumni Portal
2. Admission Portal
3. DigiVarsity 3.0
4. Partner Portal
5. Communications Portal
6. Placement Portal
7. Referral Portal

### 📝 Submission System
**Phase-Based Submissions:**
- Phase 1: Team Formation (0 points)
- Phase 2: Vibe Coding Sprint (25% weight)
- Phase 3: Mid-Point Review (25% weight)
- Phase 4: Grand Finale (50% weight)

**Required Fields:**
- GitHub Repository URL (required)
- Live Demo URL (required)
- **AI Evidence (All Mandatory)**:
  - AI Prompts Used (textarea, required)
  - AI Tools Utilized (textarea, required)
  - AI Screenshots (minimum 1 URL, dynamic array)

**Features:**
- Form validation (all fields enforced)
- Submission history table
- Team-based access control
- Phase selection with descriptions
- Dynamic screenshot URL management

### 👨‍⚖️ Judging System
**Access Control:**
- Restricted to three judge emails:
  - shantanu@teamlease.com
  - jaideep.k@teamlease.com
  - anmol.mathur@teamlease.com

**Scoring Interface:**
- Five criteria with sliders (0-100):
  - **AI Usage**: 35% weight
  - **Business Impact**: 25% weight
  - **UX**: 15% weight
  - **Innovation**: 10% weight
  - **Execution**: 15% weight

**Features:**
- Real-time weighted score calculation
- Score upsert (judges can update their scores)
- Phase-weighted leaderboard (25%, 25%, 50%)
- Animated rank changes with Framer Motion
- Full submission details display (AI evidence included)
- Direct links to GitHub and Demo URLs
- Team and submission overview

### 🏅 Live Leaderboard
- Phase-weighted scoring calculation
- Multi-judge average scoring
- Animated rank transitions
- Real-time updates
- Team name and track display
- Total score with breakdown

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn/UI
- **Animation**: Framer Motion v12
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js 18+
- **Database**: PostgreSQL 15+
- **ORM**: Drizzle ORM v0.44
- **Authentication**: NextAuth v5 (Auth.js)
- **Password Hashing**: bcryptjs
- **Adapter**: @auth/drizzle-adapter

### Development Tools
- **Package Manager**: npm
- **Database Studio**: Drizzle Kit Studio
- **Linting**: ESLint 9
- **Type Checking**: TypeScript 5

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- PostgreSQL 15 or higher (local or cloud)
- npm or yarn package manager

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd contest
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/hackathon_db"

# Authentication
AUTH_SECRET="your-secret-key-here-please-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 4: Database Setup

#### Option A: Local PostgreSQL
```bash
# Start PostgreSQL service
# macOS (Homebrew)
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Create database
psql -U postgres
CREATE DATABASE hackathon_db;
\q
```

#### Option B: Cloud Database
Use services like:
- [Supabase](https://supabase.com) - PostgreSQL with generous free tier
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Vercel Postgres](https://vercel.com/storage/postgres) - Vercel-native database

Update `DATABASE_URL` in `.env` with your connection string.

### Step 5: Run Database Migrations
```bash
# Generate migration files
npm run db:generate

# Push schema to database
npm run db:push
```

Verify tables were created:
```bash
npm run db:studio
```

### Step 6: Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
contest/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── [...nextauth]/    # NextAuth handler
│   │   │   └── register/         # User registration
│   │   ├── teams/                # Team management
│   │   │   ├── create/           # Create team
│   │   │   ├── [id]/             # Get team details
│   │   │   ├── add-member/       # Add team member
│   │   │   ├── available-users/  # Get users without teams
│   │   │   ├── count/            # Get team count
│   │   │   └── all/              # Get all teams (judges only)
│   │   ├── submissions/          # Submission management
│   │   │   ├── create/           # Create submission
│   │   │   └── team/[teamId]/    # Get team submissions
│   │   ├── scores/               # Scoring system
│   │   │   └── submit/           # Submit/update scores
│   │   └── leaderboard/          # Get leaderboard data
│   ├── dashboard/                # Participant dashboard
│   ├── judging/                  # Judging portal (judges only)
│   ├── login/                    # Login page
│   ├── register/                 # Registration page
│   ├── rules/                    # Competition rules page
│   ├── layout.tsx                # Root layout with SessionProvider
│   ├── page.tsx                  # Landing page
│   ├── providers.tsx             # Client-side providers
│   └── globals.css               # Global styles
├── components/                   # Reusable components
│   ├── BackgroundPattern.tsx     # Animated SVG grid
│   ├── GlassCard.tsx             # Glassmorphism container
│   ├── GlowButton.tsx            # Animated glow button
│   ├── Leaderboard.tsx           # Animated leaderboard
│   ├── PrizeCard.tsx             # Prize display with count-up
│   ├── TimelineNode.tsx          # Timeline entry with animations
│   ├── TrackCard.tsx             # Track card with tilt effect
│   └── ui/                       # Shadcn components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── slider.tsx
│       ├── table.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── lib/                          # Utilities and configuration
│   ├── auth.ts                   # NextAuth configuration
│   ├── constants.ts              # All constants (tracks, roles, weights)
│   ├── imageHelper.ts            # Unsplash image utilities
│   ├── utils.ts                  # Utility functions
│   └── db/                       # Database configuration
│       ├── index.ts              # Database connection
│       └── schema.ts             # Drizzle schema
├── drizzle/                      # Migrations
│   ├── 0000_wise_freak.sql       # Initial migration
│   └── meta/                     # Migration metadata
├── middleware.ts                 # Route protection
├── drizzle.config.ts             # Drizzle Kit configuration
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration (v4)
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies
```

## 🗄 Database Schema

### Tables

#### users
User accounts with Auth.js compatibility
```typescript
{
  id: uuid (PK),
  name: text,
  email: text (unique, required),
  emailVerified: timestamp,
  image: text,
  password: text (hashed),
  role: enum (6 roles),
  department: varchar(255),
  teamId: uuid (FK -> teams),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### teams
Team information
```typescript
{
  id: uuid (PK),
  name: varchar(255) (unique, required),
  track: enum (7 tracks),
  createdBy: uuid (required),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### submissions
Project submissions with AI evidence
```typescript
{
  id: uuid (PK),
  teamId: uuid (FK -> teams),
  phase: integer (1-4, required),
  githubUrl: varchar(255) (required),
  demoUrl: varchar(255) (required),
  aiPromptsUsed: text (required),
  aiToolsUtilized: text (required),
  aiScreenshots: text[] (array, required),
  submittedAt: timestamp
}
```

#### scores
Judge scores for submissions
```typescript
{
  id: uuid (PK),
  submissionId: uuid (FK -> submissions),
  judgeId: uuid (FK -> users),
  aiUsageScore: integer (0-100),
  businessImpactScore: integer (0-100),
  uxScore: integer (0-100),
  innovationScore: integer (0-100),
  executionScore: integer (0-100),
  createdAt: timestamp,
  updatedAt: timestamp,
  UNIQUE(submissionId, judgeId)
}
```

#### accounts, sessions, verification_tokens
Auth.js required tables for authentication

### Enums

#### role
```
"Developer" | "Technical Lead" | "Product Owner" | 
"Business SPOC" | "QA" | "Intern"
```

#### track
```
"Alumni Portal" | "Admission Portal" | "DigiVarsity 3.0" | 
"Partner Portal" | "Communications Portal" | 
"Placement Portal" | "Referral Portal"
```

## 🔌 API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

### Team Management
- `POST /api/teams/create` - Create team (enforces 5 team limit)
- `GET /api/teams/count` - Get current team count
- `GET /api/teams/[id]` - Get team details with members
- `POST /api/teams/add-member` - Add member to team (validates composition)
- `GET /api/teams/available-users` - Get users without teams
- `GET /api/teams/all` - Get all teams with submissions (judges only)

### Submissions
- `POST /api/submissions/create` - Create submission (validates AI evidence)
- `GET /api/submissions/team/[teamId]` - Get team submissions

### Scoring & Leaderboard
- `POST /api/scores/submit` - Submit/update judge scores (judges only)
- `GET /api/leaderboard` - Get calculated leaderboard with phase weights

## 🎯 Pages

### Public Pages
- `/` - Landing page with hero, tracks, timeline, prizes
- `/register` - User registration with role selection
- `/login` - User login
- `/rules` - Competition details and rules

### Protected Pages (Require Authentication)
- `/dashboard` - Participant dashboard (team & submission management)
- `/judging` - Judging portal (judges only, verified by email)

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server (localhost:3000)

# Database
npm run db:generate      # Generate migration files from schema
npm run db:push          # Apply schema changes to database
npm run db:studio        # Open Drizzle Studio (database GUI)

# Production
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
```

### Database Management

#### View Database
```bash
npm run db:studio
```
Opens Drizzle Studio at http://localhost:4983

#### Create Migration
```bash
npm run db:generate
```
Generates migration files in `drizzle/` folder

#### Apply Migration
```bash
npm run db:push
```
Applies schema changes to database

### Adding New Components

All reusable components are in `/components`:
- `BackgroundPattern.tsx` - Animated SVG grid background
- `GlassCard.tsx` - Glassmorphism container with glow variants
- `GlowButton.tsx` - Animated button with pulsing glow effect
- `TrackCard.tsx` - Track display with tilt and hover effects
- `TimelineNode.tsx` - Animated timeline entry with scroll triggers
- `PrizeCard.tsx` - Prize display with count-up animation
- `Leaderboard.tsx` - Animated leaderboard with rank transitions

### Shadcn UI Components

Add new Shadcn components:
```bash
npx shadcn@latest add [component-name]
```

Available components are in `components/ui/`

## 🎨 Design System

### Color Palette
```css
/* Neon Gradients */
--neon-purple: #7c3aed;
--electric-blue: #2563eb;
--hot-pink: #db2777;

/* Background */
--background: #0a0a0a;

/* Glass Effects */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### Typography
- **Font**: System font stack (optimized for performance)
- **Headings**: Bold, gradient text
- **Body**: Gray-300 for readability

### Animations
- Page transitions: 0.5s ease
- Button hover: 0.3s ease
- Rank changes: Framer Motion layout animations
- Count-ups: Framer Motion useInView + useMotionValue

## 🚀 Business Rules

1. **Team Limit**: Maximum 5 teams can be created system-wide
2. **Team Composition**:
   - Exactly 3 Developers
   - Exactly 1 Technical Lead
   - Exactly 1 Product Owner
   - Exactly 1 Business SPOC
   - Optional: 1 Intern or 1 QA (not both)
   - Maximum 6 members total
3. **AI Evidence**: All submission forms require mandatory AI documentation (prompts, tools, screenshots)
4. **Judging Access**: Only three specific judge emails can access judging portal
5. **Scoring Weights**:
   - Criteria: AI Usage (35%), Business Impact (25%), UX (15%), Innovation (10%), Execution (15%)
   - Phases: Phase 2 (25%), Phase 3 (25%), Phase 4 (50%)

## 👨‍⚖️ Judge Configuration

The following emails have judge access (configured in `lib/constants.ts`):
```typescript
export const JUDGE_EMAILS = [
  "shantanu@teamlease.com",
  "jaideep.k@teamlease.com",
  "anmol.mathur@teamlease.com",
];
```

Judges are automatically redirected to `/judging` upon login.

## 🔒 Security Features

- Password hashing with bcryptjs (10 salt rounds)
- JWT sessions (stateless, fast)
- Protected API routes with session validation
- Role-based access control
- Judge email verification
- SQL injection prevention (parameterized queries via Drizzle)
- XSS prevention (React auto-escaping)
- CSRF protection (NextAuth built-in)

## 📚 Additional Documentation

- [QUICKSTART.md](./QUICKSTART.md) - 5-minute setup guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment options
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Complete feature list

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Port Already in Use
```
Error: Port 3000 is already in use
```
**Solution**: Kill process or use different port
```bash
lsof -ti:3000 | xargs kill -9
# OR
PORT=3001 npm run dev
```

### Module Not Found
**Solution**: Reinstall dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
**Solution**: Restart TypeScript server or check types
```bash
npx tsc --noEmit
```

## 📝 License

This project is proprietary and confidential. All rights reserved.

## 🤝 Support

For issues, questions, or feature requests:
- Check documentation files
- Review API route implementations
- Inspect database schema
- Contact the development team

## 🙏 Acknowledgments

Built with:
- Next.js 15
- TypeScript
- PostgreSQL
- Drizzle ORM
- NextAuth v5
- Tailwind CSS v4
- Framer Motion
- Shadcn/UI
- Lucide React

---

**Made with ❤️ for the Innovation Challenge: AI/Vibe Coding Hackathon**
