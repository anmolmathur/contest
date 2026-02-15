# Production Deployment Guide

This document is for the DevOps team. It covers everything needed to deploy the Multi-Contest Management Platform in a production environment using Docker.

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Docker Engine | 20.10+ |
| Docker Compose | v2+ |
| PostgreSQL | 16+ (can run in Docker or externally) |
| Node.js (for migrations only) | 20+ |
| RAM | 2 GB |
| Disk | 10 GB |

## Architecture

```
┌──────────────────────────────────────────────┐
│  Docker Host                                 │
│                                              │
│  ┌────────────┐       ┌──────────────────┐   │
│  │  contest    │──────▶│  PostgreSQL 16    │   │
│  │  (Next.js)  │       │  (port 5432)     │   │
│  │  port 3000  │       └──────────────────┘   │
│  └────────────┘                               │
│       │                                       │
│  ┌────▼───────┐                               │
│  │  Reverse   │  (nginx/ngrok/cloudflare)     │
│  │  Proxy     │                               │
│  │  port 443  │                               │
│  └────────────┘                               │
└──────────────────────────────────────────────┘
```

The application is a **Next.js 16** app compiled to standalone output and served by `node server.js` inside the container. It connects to PostgreSQL for all data storage and uses JWT-based sessions (no Redis or session store required).

---

## 1. Environment Variables

Create a `.env` file or configure these in your orchestrator:

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@postgres:5432/hackathon_db` | PostgreSQL connection string. Use the Docker network hostname if PostgreSQL runs in the same compose stack. |
| `AUTH_SECRET` | Yes | *(generate below)* | Secret key for signing JWT tokens. Must be at least 32 characters. |
| `NEXTAUTH_URL` | Yes | `https://contest.yourdomain.com` | The public-facing URL of the application (used for auth callbacks). |
| `NODE_ENV` | No | `production` | Set automatically in the Docker image. |

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

> **Security:** Never reuse development secrets. `AUTH_SECRET` and database passwords must be unique per environment.

---

## 2. Docker Build

The project ships with a multi-stage `Dockerfile` in the repo root.

### Build the image

```bash
cd /path/to/contest
docker build -t contest:latest .
```

### Build-time notes

The Dockerfile sets a dummy `DATABASE_URL` at build time because Next.js validates the database connection during `next build` for certain ORM operations. The **real** `DATABASE_URL` is provided at runtime via environment variables and overrides the build-time value.

If your build fails because it cannot reach the database, update the build-time `DATABASE_URL` in the Dockerfile to point to any reachable PostgreSQL instance (it is only used during build, never at runtime).

---

## 3. Docker Compose

Below is a production-ready `docker-compose.yaml`. Adjust passwords, ports, and volumes to match your environment.

```yaml
services:
  contest:
    build:
      context: ./contest          # path to the cloned repo
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://contestuser:CHANGE_ME@postgres:5432/hackathon_db
      - AUTH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL
      - NEXTAUTH_URL=https://contest.yourdomain.com
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"              # expose to host for migrations; remove in locked-down environments
    environment:
      POSTGRES_DB: hackathon_db
      POSTGRES_USER: contestuser
      POSTGRES_PASSWORD: CHANGE_ME
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U contestuser -d hackathon_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### Start the stack

```bash
docker compose up -d
```

### Verify

```bash
# Check containers are running
docker compose ps

# Check app logs
docker compose logs -f contest

# Test HTTP response
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

---

## 4. Database Setup & Migrations

### 4.1 First-time schema push

Drizzle ORM manages the schema. Run migrations **from the host machine** (or a CI runner with Node.js installed) pointing at the production database:

```bash
cd /path/to/contest

# Install dependencies (needed for drizzle-kit)
npm ci

# Push schema to the production database
DATABASE_URL="postgresql://contestuser:CHANGE_ME@localhost:5432/hackathon_db" npx drizzle-kit push
```

> **Note:** If PostgreSQL is only accessible inside the Docker network (port not exposed to host), you can either:
> 1. Temporarily expose port 5432, run the migration, then remove the port mapping.
> 2. Run `npx drizzle-kit push` from inside a temporary container on the same Docker network.

### 4.2 Verify tables

```bash
docker exec -it postgres psql -U contestuser -d hackathon_db -c "\dt"
```

**Expected tables:**

| Table | Purpose |
|-------|---------|
| `users` | Platform user accounts |
| `teams` | Teams (linked to contests) |
| `submissions` | Project submissions |
| `scores` | Judge scores |
| `contests` | Contest configuration |
| `tracks` | Dynamic tracks per contest |
| `contest_users` | Per-contest role assignments |
| `certificate_templates` | Certificate templates |
| `accounts` | NextAuth accounts |
| `sessions` | NextAuth sessions |
| `verification_tokens` | NextAuth tokens |

### 4.3 Set platform admin users

After the schema is created, promote admin users:

```bash
docker exec -it postgres psql -U contestuser -d hackathon_db -c "
  UPDATE users SET global_role = 'platform_admin'
  WHERE email IN ('admin1@yourdomain.com', 'admin2@yourdomain.com');
"
```

Platform admins can:
- Create and manage all contests
- Manage all platform users
- Access any contest's admin panel

---

## 5. Reverse Proxy / HTTPS

The container listens on port 3000 (HTTP). Place a reverse proxy in front for HTTPS termination.

### Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name contest.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/contest.crt;
    ssl_certificate_key /etc/ssl/private/contest.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeout for long-running requests (certificate generation)
        proxy_read_timeout 120s;
    }
}
```

### Cloudflare / ngrok

If using Cloudflare Tunnel or ngrok, point the tunnel to `http://localhost:3000`. Update `NEXTAUTH_URL` to match the public URL.

---

## 6. Updating the Application

When a new version of the code is available:

```bash
cd /path/to/contest

# 1. Pull latest code
git pull origin main

# 2. Check if there are new migration files in drizzle/
ls -la drizzle/

# 3. Apply any schema changes
DATABASE_URL="postgresql://contestuser:CHANGE_ME@localhost:5432/hackathon_db" npx drizzle-kit push

# 4. Rebuild and restart the container
docker compose up -d --build contest

# 5. Verify
docker compose logs -f contest
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

> **Zero-downtime deployments:** For zero downtime, run the new container on a different port, verify health, then switch the reverse proxy. The app is stateless (JWT sessions), so multiple instances can run simultaneously.

---

## 7. Backup & Restore

### Automated backup

```bash
#!/bin/bash
# backup-db.sh
BACKUP_DIR="/var/backups/contest"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker exec postgres pg_dump -U contestuser hackathon_db \
  > "$BACKUP_DIR/hackathon_db_$TIMESTAMP.sql"

# Keep last 30 days
find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete
```

**Cron (daily at 2 AM):**
```bash
0 2 * * * /path/to/backup-db.sh
```

### Restore from backup

```bash
docker exec -i postgres psql -U contestuser hackathon_db < /var/backups/contest/hackathon_db_YYYYMMDD_HHMMSS.sql
```

---

## 8. Monitoring & Health Checks

### Container health

```bash
# Status of all services
docker compose ps

# Resource usage
docker stats contest postgres
```

### Application health

```bash
# Homepage loads
curl -sf http://localhost:3000 > /dev/null && echo "OK" || echo "FAIL"

# API responds
curl -sf http://localhost:3000/api/contests > /dev/null && echo "OK" || echo "FAIL"
```

### Database health

```bash
docker exec postgres pg_isready -U contestuser -d hackathon_db
```

### Log monitoring

```bash
# Application logs
docker compose logs -f --tail=100 contest

# Database logs
docker compose logs -f --tail=100 postgres
```

---

## 9. Security Checklist

- [ ] `AUTH_SECRET` is a unique, randomly generated 32+ character string
- [ ] Database password is strong and unique
- [ ] PostgreSQL port (5432) is **not** exposed publicly (only within Docker network or localhost)
- [ ] HTTPS is enforced via reverse proxy
- [ ] `NEXTAUTH_URL` matches the actual public URL
- [ ] `.env` files are not committed to git (`.gitignore` already excludes them)
- [ ] Platform admin accounts are set via SQL (not via public registration)
- [ ] Regular database backups are configured

---

## 10. Troubleshooting

### Container won't start

```bash
docker compose logs contest
```

Common causes:
- `DATABASE_URL` is wrong or database is unreachable
- Port 3000 already in use on the host
- Missing environment variables

### Database connection refused

```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Test connection from contest container
docker exec contest sh -c 'wget -qO- http://postgres:5432 || echo "Port reachable"'
```

- Ensure both containers are on the same Docker network
- Verify the hostname in `DATABASE_URL` matches the service name in docker-compose

### Auth/login not working

- Verify `NEXTAUTH_URL` matches the URL users access (including protocol and port)
- Verify `AUTH_SECRET` is set and consistent across restarts
- Check that cookies are not blocked (HTTPS required for secure cookies in production)

### Schema migration fails

```bash
# Check current tables
docker exec postgres psql -U contestuser -d hackathon_db -c "\dt"

# If using a non-superuser, grant schema permissions
docker exec postgres psql -U postgres -d hackathon_db -c "
  GRANT ALL ON SCHEMA public TO contestuser;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO contestuser;
"
```

> **Tip:** If `drizzle-kit push` fails with permission errors, your database user may need `CREATE` privileges on the `public` schema. Use a superuser for migrations if needed.

---

## 11. Post-Deployment: Creating the First Contest

After deployment, a platform admin needs to create the first contest:

1. **Login** at `https://contest.yourdomain.com/login` with a platform admin account
2. Navigate to **`/platform/admin`**
3. Go to the **Contests** tab and click **Create Contest**
4. Fill in:
   - **Name** and **Slug** (URL-friendly, e.g. `ai-hackathon-2026`)
   - **Description** and **Status** (draft/active)
5. After creation, go to **`/c/<slug>/admin`** > **Settings** tab to configure:
   - Scoring criteria and weights
   - Phase configuration (timeline)
   - Prizes
   - Team constraints
   - Landing page content
   - Rules content
6. Go to the **Users** tab to assign judges, admins, and participants
7. Go to the **Tracks** tab to create project tracks

The contest is now ready for participants at `/c/<slug>`.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start stack | `docker compose up -d` |
| Stop stack | `docker compose down` |
| Rebuild app | `docker compose up -d --build contest` |
| View app logs | `docker compose logs -f contest` |
| View DB logs | `docker compose logs -f postgres` |
| Run migration | `DATABASE_URL="..." npx drizzle-kit push` |
| Backup DB | `docker exec postgres pg_dump -U contestuser hackathon_db > backup.sql` |
| Restore DB | `docker exec -i postgres psql -U contestuser hackathon_db < backup.sql` |
| Set admin | `docker exec postgres psql -U contestuser -d hackathon_db -c "UPDATE users SET global_role='platform_admin' WHERE email='admin@example.com';"` |
| Check health | `curl -sf http://localhost:3000 && echo OK` |
