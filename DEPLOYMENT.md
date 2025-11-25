# Deployment Guide

Complete guide for deploying the Innovation Challenge Platform to production environments.

## 📋 Pre-Deployment Checklist

### 1. Environment Variables

Ensure all production environment variables are configured:

```env
# Database (Production)
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Authentication (Production - MUST be different from development)
AUTH_SECRET="<generate-secure-random-string-minimum-32-chars>"

# Application URL (Production domain)
NEXTAUTH_URL="https://yourdomain.com"
```

**🔐 Generate Secure AUTH_SECRET:**
```bash
openssl rand -base64 32
```

**⚠️ Critical:**
- Never reuse development secrets in production
- Use SSL-enabled database connections (`sslmode=require`)
- Ensure AUTH_SECRET is truly random and secure
- Set NEXTAUTH_URL to your actual production domain

### 2. Database Preparation

#### Option A: Prepare Existing Database
```bash
# Ensure database exists and is accessible
# Run migrations
npm run db:push

# Verify with Drizzle Studio
npm run db:studio
```

#### Option B: Use Cloud Database Provider

**Recommended Providers:**

**[Supabase](https://supabase.com)** (Free tier available)
- PostgreSQL 15+ with connection pooling
- Automatic backups
- Point-in-time recovery
- SSL by default

**[Neon](https://neon.tech)** (Serverless PostgreSQL)
- Auto-scaling
- Branching (great for staging)
- Generous free tier
- Fast cold starts

**[Vercel Postgres](https://vercel.com/storage/postgres)** (If deploying to Vercel)
- Native integration
- Edge-optimized
- Simple setup

**[Railway](https://railway.app)** (PostgreSQL + App hosting)
- All-in-one solution
- Simple deployment
- Automatic SSL

### 3. Judge Email Configuration

Update judge emails in `/lib/constants.ts`:

```typescript
export const JUDGE_EMAILS: string[] = [
  "judge1@yourcompany.com",
  "judge2@yourcompany.com",
  "judge3@yourcompany.com",
];
```

**After deployment:**
- Register these three email accounts
- Test judging portal access
- Verify scoring functionality

### 4. Build Verification

Ensure the project builds without errors:

```bash
# Clean build
rm -rf .next node_modules
npm install
npm run build
```

Expected output:
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

If build fails:
- Check TypeScript errors: `npx tsc --noEmit`
- Review linter errors: `npm run lint`
- Verify environment variables are set

### 5. Database Schema Verification

Verify all tables exist:

```bash
npm run db:studio
```

**Required Tables:**
- ✅ users (with role, teamId fields)
- ✅ teams (with track, createdBy fields)
- ✅ submissions (with AI evidence fields)
- ✅ scores (with weighted criteria)
- ✅ accounts (Auth.js)
- ✅ sessions (Auth.js)
- ✅ verification_tokens (Auth.js)

## 🚀 Deployment Options

### Option 1: Vercel (Recommended) ⭐

**Best for:** Quick deployment, automatic scaling, global CDN

#### Step 1: Push to Git Repository

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial deployment"

# Push to GitHub/GitLab/Bitbucket
git remote add origin <your-repo-url>
git push -u origin main
```

#### Step 2: Deploy on Vercel

**Via Vercel Dashboard:**
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import your Git repository
4. Configure project:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```env
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
AUTH_SECRET=<your-production-secret>
NEXTAUTH_URL=https://your-app.vercel.app
```

**💡 Tips:**
- Add variables for all environments (Production, Preview, Development)
- Use Vercel Postgres for seamless integration
- Enable automatic deployments on git push

#### Step 4: Deploy

Click **"Deploy"** and wait for deployment to complete.

**Post-Deployment:**
1. Visit your deployed URL
2. Test all features:
   - User registration
   - Team creation
   - Submissions
   - Judging portal
   - Leaderboard

**Custom Domain (Optional):**
1. Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable

---

### Option 2: Docker 🐳

**Best for:** Self-hosted deployments, full control, reproducible environments

#### Step 1: Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Multi-stage build for optimal image size
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

#### Step 2: Update next.config.ts

Add standalone output:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Add this line
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "source.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
```

#### Step 3: Create docker-compose.yml

```yaml
version: '3.8'

services:
  # Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/hackathon_db
      AUTH_SECRET: ${AUTH_SECRET}
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  # Database
  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: hackathon_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Step 4: Create .dockerignore

```
node_modules
.next
.git
.env
.env.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
```

#### Step 5: Build and Run

```bash
# Build Docker image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access application:** http://localhost:3000

#### Step 6: Production Deployment

For production, update `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      DATABASE_URL: postgresql://user:pass@production-host/db?sslmode=require
      AUTH_SECRET: ${AUTH_SECRET}
      NEXTAUTH_URL: https://yourdomain.com
```

Deploy to cloud:
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**

---

### Option 3: VPS (Ubuntu/Debian) 🖥️

**Best for:** Full server control, cost-effective at scale

#### Step 1: Server Preparation

**Requirements:**
- Ubuntu 22.04 LTS or Debian 11+
- Minimum 2GB RAM
- 20GB+ storage
- Root or sudo access

**Install Dependencies:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

#### Step 2: PostgreSQL Setup

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user
psql
CREATE DATABASE hackathon_db;
CREATE USER hackathon WITH PASSWORD 'secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE hackathon_db TO hackathon;
\q

# Exit postgres user
exit
```

**Enable remote connections (if needed):**

Edit `/etc/postgresql/15/main/postgresql.conf`:
```
listen_addresses = '*'
```

Edit `/etc/postgresql/15/main/pg_hba.conf`:
```
host    all             all             0.0.0.0/0               md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

#### Step 3: Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/innovation-challenge
sudo chown -R $USER:$USER /var/www/innovation-challenge

# Clone repository
cd /var/www/innovation-challenge
git clone <your-repo-url> .

# Install dependencies
npm install

# Create .env file
nano .env
```

Add environment variables:
```env
DATABASE_URL="postgresql://hackathon:secure-password-here@localhost:5432/hackathon_db"
AUTH_SECRET="<generate-with-openssl-rand-base64-32>"
NEXTAUTH_URL="https://yourdomain.com"
```

```bash
# Run database migrations
npm run db:push

# Build application
npm run build

# Test start
npm start
```

#### Step 4: PM2 Setup

```bash
# Start with PM2
pm2 start npm --name "innovation-challenge" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command PM2 outputs

# Check status
pm2 status

# View logs
pm2 logs innovation-challenge
```

**PM2 Management Commands:**
```bash
pm2 restart innovation-challenge   # Restart app
pm2 stop innovation-challenge      # Stop app
pm2 delete innovation-challenge    # Remove from PM2
pm2 logs innovation-challenge      # View logs
pm2 monit                          # Monitor resources
```

#### Step 5: Nginx Configuration

Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/innovation-challenge
```

Add configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/innovation-challenge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot automatically updates Nginx config for HTTPS.

**Update NEXTAUTH_URL:**
```bash
cd /var/www/innovation-challenge
nano .env
# Change to: NEXTAUTH_URL="https://yourdomain.com"

# Restart application
pm2 restart innovation-challenge
```

#### Step 7: Firewall Setup

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

---

### Option 4: Railway 🚂

**Best for:** Simple deployment with database included

#### Steps:

1. Go to [railway.app](https://railway.app)
2. Connect GitHub repository
3. Add PostgreSQL database (Railway template)
4. Configure environment variables:
   ```
   DATABASE_URL: (auto-generated by Railway)
   AUTH_SECRET: <your-secret>
   NEXTAUTH_URL: https://<your-app>.railway.app
   ```
5. Deploy automatically on git push

---

### Option 5: DigitalOcean App Platform 🌊

**Best for:** Managed platform with database add-ons

#### Steps:

1. Create DigitalOcean account
2. Create App → Import from GitHub
3. Add PostgreSQL database (managed)
4. Configure environment variables
5. Deploy

---

## 📊 Post-Deployment

### 1. Health Check Verification

Test all critical endpoints:

```bash
# Homepage
curl https://yourdomain.com

# API health (create this endpoint if needed)
curl https://yourdomain.com/api/teams/count

# Check SSL
curl -I https://yourdomain.com
```

### 2. Database Verification

```bash
# Connect to production database
psql $DATABASE_URL

# Check tables
\dt

# Verify data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM teams;
\q
```

### 3. Feature Testing

**Test all features in production:**
- [ ] User registration works
- [ ] User login works
- [ ] Team creation works (up to 5 teams)
- [ ] Team member addition works
- [ ] Submission creation works
- [ ] Judge login redirects to /judging
- [ ] Judges can score submissions
- [ ] Leaderboard displays correctly
- [ ] All animations work
- [ ] Mobile responsive

### 4. Create Judge Accounts

Register the three judge accounts via the UI:
1. Visit https://yourdomain.com/register
2. Register each judge email
3. Verify they can access /judging

### 5. Performance Monitoring

**Recommended Tools:**
- **Vercel Analytics** (if using Vercel)
- **Google Analytics** (general analytics)
- **Sentry** (error tracking)
- **LogRocket** (session replay)
- **Uptime Robot** (uptime monitoring)

## 🔐 Security Best Practices

### 1. Environment Variables
- Never commit `.env` to git
- Use different secrets for production
- Rotate secrets periodically
- Use secret management services (AWS Secrets Manager, Vercel, etc.)

### 2. Database Security
- Enable SSL connections (`sslmode=require`)
- Use strong passwords (minimum 16 chars)
- Restrict database access by IP
- Enable automatic backups
- Set up point-in-time recovery

### 3. Application Security
- Keep dependencies updated: `npm audit fix`
- Enable rate limiting on API routes
- Set up CORS properly
- Use security headers (Next.js automatically includes many)
- Enable HTTPS only (force redirect)

### 4. Access Control
- Limit judge emails to verified addresses
- Implement session timeout
- Use secure password requirements
- Enable 2FA for admin accounts (if implemented)

## 🔄 Backup Strategy

### Database Backups

#### Automated Backups (PostgreSQL)

**Daily Backup Script:**
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/var/backups/postgres"
DB_NAME="hackathon_db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

pg_dump -U hackathon $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

**Setup Cron Job:**
```bash
crontab -e

# Add line for daily backup at 2 AM
0 2 * * * /path/to/backup-db.sh
```

#### Cloud Database Backups

Most cloud providers offer automatic backups:
- **Supabase**: Automatic daily backups (free tier)
- **Neon**: Point-in-time restore
- **Vercel Postgres**: Automatic backups
- **Railway**: Manual backup via CLI

### Application Backups

**Git-based backups:**
```bash
# Regular commits
git add .
git commit -m "Latest changes"
git push origin main
```

**File-based backups:**
```bash
# Backup entire application
tar -czf innovation-challenge-$(date +%Y%m%d).tar.gz /var/www/innovation-challenge
```

## 🚀 Performance Optimization

### 1. Caching
```typescript
// Add to next.config.ts
const nextConfig = {
  compress: true, // Enable gzip compression
  // ... other config
};
```

### 2. Database Connection Pooling

For serverless environments, use connection pooling:

**Supabase Pooler:**
```env
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"
```

**PgBouncer (VPS):**
```bash
sudo apt install pgbouncer
# Configure /etc/pgbouncer/pgbouncer.ini
```

### 3. CDN for Static Assets

If using Vercel, CDN is automatic. For VPS:
- Use Cloudflare CDN (free)
- Configure caching headers in Nginx

### 4. Database Indexing

Add indexes for frequently queried fields:
```sql
CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_submissions_team_id ON submissions(team_id);
CREATE INDEX idx_scores_submission_id ON scores(submission_id);
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, Vercel automatic)
- Deploy multiple instances
- Use managed database with read replicas

### Database Scaling
- Enable connection pooling
- Add read replicas for read-heavy operations
- Use caching layer (Redis) for leaderboard

### Monitoring
- Set up application monitoring
- Monitor database performance
- Track API response times
- Set up alerts for errors

## 🆘 Troubleshooting Production Issues

### Application Won't Start

**Check logs:**
```bash
# PM2
pm2 logs innovation-challenge

# Docker
docker-compose logs -f app

# Vercel
# Check deployment logs in Vercel dashboard
```

**Common issues:**
- Missing environment variables
- Database connection failed
- Port already in use
- Build errors

### Database Connection Issues

**Verify connectivity:**
```bash
psql $DATABASE_URL -c "SELECT version();"
```

**Check:**
- Database URL format
- SSL mode (`?sslmode=require`)
- Firewall rules
- Database user permissions

### Authentication Issues

**Check:**
- AUTH_SECRET is set
- NEXTAUTH_URL matches domain
- Cookies are allowed
- HTTPS is enabled (required for production)

### Performance Issues

**Monitor:**
```bash
# Server resources
htop

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Nginx logs
sudo tail -f /var/log/nginx/access.log
```

## 📞 Support & Resources

**Documentation:**
- [README.md](./README.md) - Comprehensive guide
- [QUICKSTART.md](./QUICKSTART.md) - Local setup guide
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Feature list

**External Resources:**
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Drizzle ORM Deployment](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**🎉 Congratulations!** Your Innovation Challenge Platform is now live in production!

Remember to:
- Monitor application performance
- Keep dependencies updated
- Perform regular backups
- Review security practices
- Scale as needed

Good luck with your Innovation Challenge! 🚀
