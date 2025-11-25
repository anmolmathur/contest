# Quick Start Guide

Get the Innovation Challenge Platform running in **5 minutes**! ⚡

## 📋 Prerequisites

Before you begin, ensure you have:
- ✅ Node.js 18+ installed ([Download](https://nodejs.org/))
- ✅ PostgreSQL 15+ running ([Local Setup](#database-setup) or [Cloud Options](#cloud-database-options))
- ✅ Git installed
- ✅ Terminal/Command Prompt access

## 🚀 Setup Steps

### Step 1: Install Dependencies (1 minute)

```bash
npm install
```

This installs all required packages:
- Next.js 15
- TypeScript 5
- Drizzle ORM
- NextAuth v5
- Tailwind CSS v4
- Framer Motion
- Shadcn/UI components

### Step 2: Configure Environment (1 minute)

Create a `.env` file in the project root:

```env
# Database Connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/hackathon_db"

# Authentication (Generate with: openssl rand -base64 32)
AUTH_SECRET="your-secret-key-here-please-change-in-production"

# Application URL
NEXTAUTH_URL="http://localhost:3000"
```

**🔐 Generate Secure AUTH_SECRET:**
```bash
openssl rand -base64 32
```

**💡 Important Notes:**
- Replace `password` with your actual PostgreSQL password
- Replace `AUTH_SECRET` with a secure random string
- For cloud databases, update `DATABASE_URL` with your connection string

### Step 3: Setup Database (2 minutes)

#### Option A: Local PostgreSQL

**macOS (Homebrew):**
```bash
# Start PostgreSQL
brew services start postgresql

# Create database
psql -U postgres
CREATE DATABASE hackathon_db;
\q
```

**Linux:**
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database
sudo -u postgres psql
CREATE DATABASE hackathon_db;
\q
```

**Windows:**
```bash
# Start PostgreSQL (via Services or pg_ctl)
# Then use psql to create database:
psql -U postgres
CREATE DATABASE hackathon_db;
\q
```

#### Option B: Cloud Database Options

**[Supabase](https://supabase.com)** (Recommended)
1. Create free account
2. Create new project
3. Copy connection string from Settings → Database
4. Update `DATABASE_URL` in `.env`

**[Neon](https://neon.tech)** (Serverless)
1. Create free account
2. Create new project
3. Copy connection string
4. Update `DATABASE_URL` in `.env`

**[Vercel Postgres](https://vercel.com/storage/postgres)**
1. Create Vercel account
2. Add Postgres database
3. Copy connection string
4. Update `DATABASE_URL` in `.env`

### Step 4: Run Database Migrations (30 seconds)

Push the database schema to your database:

```bash
npm run db:push
```

You should see:
```
✓ Applying changes
✓ Done!
```

**Verify Tables Were Created:**
```bash
npm run db:studio
```

This opens Drizzle Studio at http://localhost:4983

**Expected Tables:**
- ✅ users
- ✅ teams
- ✅ submissions
- ✅ scores
- ✅ accounts
- ✅ sessions
- ✅ verification_tokens

### Step 5: Start Development Server (30 seconds)

```bash
npm run dev
```

**Open in browser:** [http://localhost:3000](http://localhost:3000)

You should see the Innovation Challenge landing page! 🎉

## 🎯 First Steps in the Application

### 1. Register Users (Test Data)

Visit: http://localhost:3000/register

**Register Multiple Users with Different Roles:**

**Team 1 Example:**
```
User 1: john@example.com (Developer)
User 2: jane@example.com (Developer)
User 3: bob@example.com (Developer)
User 4: alice@example.com (Technical Lead)
User 5: charlie@example.com (Product Owner)
User 6: david@example.com (Business SPOC)
```

**Judge Accounts (Important!):**
```
shantanu@teamlease.com (Any role)
jaideep.k@teamlease.com (Any role)
anmol.mathur@teamlease.com (Any role)
```

**💡 Tips:**
- Use simple passwords for testing (e.g., "password")
- Create at least 6 users to form one complete team
- Remember to create the three judge accounts

### 2. Create a Team

1. **Login** as any registered user
2. Go to **Dashboard** (automatic redirect after login)
3. Click **"Create Team"** button
4. Fill in:
   - Team Name: "Innovation Squad"
   - Track: Select any (e.g., "DigiVarsity 3.0")
5. Click **Create**

**✅ Success!** You're now part of a team.

### 3. Add Team Members

As the team creator:

1. Click **"Add Member"** button
2. Select users from the available list
3. Add members to meet composition requirements:
   - 3 Developers
   - 1 Technical Lead
   - 1 Product Owner
   - 1 Business SPOC
   - Optional: 1 Intern or QA

**⚠️ Team Limit:** Only 5 teams can be created system-wide!

### 4. Submit Work

From your Dashboard:

1. Click **"Submit Work"**
2. Fill in the form:
   - **Phase**: Select phase (2, 3, or 4)
   - **GitHub URL**: `https://github.com/yourteam/project`
   - **Demo URL**: `https://yourproject.vercel.app`
   - **AI Prompts Used**: Document your AI prompts
   - **AI Tools Utilized**: List tools (ChatGPT, Copilot, etc.)
   - **AI Screenshots**: Add at least 1 URL
3. Click **Submit**

**✅ Success!** Your submission is now visible in the judging portal.

### 5. Judge Submissions

Login as a judge (one of the three judge emails):

1. **Auto-redirect** to `/judging`
2. View **Live Leaderboard**
3. Browse **Teams & Submissions**
4. Click **"Score Submission"** on any submission
5. View submission details:
   - GitHub and Demo links
   - AI evidence (prompts, tools, screenshots)
6. **Rate using sliders** (0-100):
   - AI Usage (35% weight)
   - Business Impact (25% weight)
   - UX (15% weight)
   - Innovation (10% weight)
   - Execution (15% weight)
7. See **Weighted Total Score** calculated in real-time
8. Click **Submit Scores**

**✅ Success!** Leaderboard updates automatically with animated rank changes.

## 📝 Useful Commands Reference

### Development
```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
```

### Database
```bash
npm run db:generate      # Generate migration files from schema
npm run db:push          # Apply schema changes to database
npm run db:studio        # Open Drizzle Studio (database GUI)
```

### Testing
```bash
# Check TypeScript errors
npx tsc --noEmit

# Check build
npm run build
```

## ✅ Installation Verification Checklist

Run through this checklist to ensure everything is working:

### Database Check
- [ ] PostgreSQL is running
- [ ] Database `hackathon_db` exists
- [ ] All 7 tables created successfully
- [ ] Drizzle Studio opens at http://localhost:4983

### Application Check
- [ ] Dev server starts without errors
- [ ] Landing page loads at http://localhost:3000
- [ ] Can navigate to `/register`
- [ ] Can navigate to `/login`
- [ ] Can navigate to `/rules`

### Functionality Check
- [ ] Can register new users
- [ ] Can login with registered users
- [ ] Can create a team (up to 5 teams)
- [ ] Can add team members
- [ ] Can create submissions
- [ ] Judges can access `/judging`
- [ ] Judges can score submissions
- [ ] Leaderboard displays correctly

**If all items are checked:** ✅ You're ready to go!

## 🔧 Common Issues & Solutions

### Issue: Database Connection Failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

**macOS:**
```bash
# Check if PostgreSQL is running
brew services list

# Start PostgreSQL
brew services start postgresql

# Verify connection
psql -U postgres -c "SELECT version();"
```

**Linux:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Enable on boot
sudo systemctl enable postgresql
```

**Windows:**
- Check Services (services.msc)
- Start "PostgreSQL" service
- Or use pg_ctl: `pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start`

### Issue: Port 3000 Already in Use

**Error:**
```
Error: Port 3000 is already in use
```

**Solutions:**

**Option 1: Kill the process**
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Option 2: Use different port**
```bash
PORT=3001 npm run dev
```

### Issue: Module Not Found

**Error:**
```
Error: Cannot find module 'next'
```

**Solution:**
```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

### Issue: TypeScript Errors

**Error:**
```
Type error: Cannot find module '@/components/...'
```

**Solutions:**

**Option 1: Restart TypeScript server**
- VS Code: Press `Cmd/Ctrl + Shift + P` → "Restart TS Server"

**Option 2: Check TypeScript**
```bash
npx tsc --noEmit
```

### Issue: Authentication Not Working

**Error:**
```
[auth][error] JWT session error
```

**Solution:**
- Ensure `AUTH_SECRET` is set in `.env`
- Generate new secret: `openssl rand -base64 32`
- Restart dev server: `npm run dev`

### Issue: Build Fails

**Error:**
```
Error: Build failed
```

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

### Issue: Drizzle Studio Won't Open

**Solution:**
```bash
# Kill any running Drizzle Studio instance
lsof -ti:4983 | xargs kill -9

# Restart Drizzle Studio
npm run db:studio
```

## 🎓 Learning Resources

### Understanding the Stack

**Next.js 15:**
- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

**Drizzle ORM:**
- [Drizzle Docs](https://orm.drizzle.team/)
- [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview)

**NextAuth v5:**
- [Auth.js Documentation](https://authjs.dev/)
- [NextAuth Guide](https://next-auth.js.org/)

**Tailwind CSS v4:**
- [Tailwind Docs](https://tailwindcss.com/docs)
- [Tailwind v4 Beta](https://tailwindcss.com/blog/tailwindcss-v4-beta)

**Framer Motion:**
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Animation Examples](https://www.framer.com/motion/examples/)

## 📂 Project Structure Quick Reference

```
contest/
├── app/
│   ├── api/               # API endpoints
│   ├── dashboard/         # Participant dashboard
│   ├── judging/          # Judge portal
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   └── rules/            # Rules page
├── components/           # Reusable UI components
├── lib/
│   ├── auth.ts          # NextAuth config
│   ├── constants.ts     # All constants
│   └── db/              # Database config & schema
├── drizzle/             # Database migrations
├── .env                 # Environment variables (create this!)
└── package.json         # Dependencies
```

## 🚀 Next Steps

Now that you have the platform running:

1. **Read the full documentation:**
   - [README.md](./README.md) - Comprehensive guide
   - [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Feature overview
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide

2. **Explore the features:**
   - Create multiple teams
   - Submit work for different phases
   - Score submissions as a judge
   - Watch the leaderboard update in real-time

3. **Customize for your needs:**
   - Update judge emails in `lib/constants.ts`
   - Modify tracks in `lib/constants.ts`
   - Adjust scoring weights in `lib/constants.ts`
   - Change team limits in `lib/constants.ts`

4. **Deploy to production:**
   - Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment options
   - Set up production database
   - Configure production environment variables
   - Deploy to Vercel, Docker, or VPS

## 💬 Getting Help

**Documentation:**
- Full guide: [README.md](./README.md)
- Features: [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)
- Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)

**Code Exploration:**
- Database schema: `lib/db/schema.ts`
- API routes: `app/api/`
- Constants: `lib/constants.ts`
- Components: `components/`

**Community:**
- Contact the development team
- Check GitHub issues (if public repo)
- Review API implementations

---

**⏱️ Total Time:** ~5 minutes

**🎉 Congratulations!** You now have a fully functional Innovation Challenge Management Platform running locally. Happy hacking! 🚀
