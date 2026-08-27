# Elemeentra — Web Platform

Custom-coded Next.js 14 + MySQL platform for Elemeentra (Web Design,
Development & Digital Growth). Built against the approved PRD v4.

This repo currently contains **Phase 1**: database schema, authentication
system, and the Admin Panel foundation (login + protected dashboard shell +
sidebar navigation). Later phases (public site, blog/portfolio CRUD,
multi-language, dark mode toggle wiring, analytics, etc.) build on top of
this foundation, following the PRD's own phase order (§24).

---

## 1. Prerequisites

- **Node.js** 18.18+ (Next.js 14 requirement) — you have v22, that's fine.
- **XAMPP** (Apache + MySQL/MariaDB) for local development, matching PRD §23.
  - Start **MySQL** from the XAMPP control panel. You don't need Apache —
    Next.js runs its own dev server.

## 2. First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in real values
cp .env.example .env.local
```

Edit `.env.local`:

- `DB_USER` / `DB_PASSWORD` — your XAMPP MySQL credentials (default XAMPP:
  user `root`, empty password).
- `JWT_SECRET` — generate a real one: `openssl rand -base64 48`
- `ADMIN_PATH` — generate a real one: `openssl rand -hex 8`
  (this becomes your admin panel's secret URL segment — keep it private,
  don't commit it, don't share it outside the team).

```bash
# 3. Create the database + all tables
npm run db:migrate

# 4. Create the Super Admin account (this is how you'll log in)
npm run db:seed -- --email you@elemeentra.com --password "Str0ngP@ssw0rd" --name "Abu Bakar"

# 5. Start the dev server
npm run dev
```

## 3. Using the Admin Panel

- Public site: http://localhost:3000
- Admin panel: **http://localhost:3000/&lt;your-ADMIN_PATH&gt;/login**
  (e.g. `http://localhost:3000/elemeentra-cms-x7k2m9pq/login`)
- Visiting `http://localhost:3000/admin` directly returns a plain 404 —
  this is intentional (PRD §30, admin URL security). The panel only exists
  at your secret `ADMIN_PATH`.

Log in with the email/password you passed to `npm run db:seed`.

## 4. What's implemented in Phase 1

- Full MySQL schema (`database/schema.sql`) — every table from the PRD:
  users, roles, services, projects, posts, categories, tags, comments,
  contact_messages, newsletter_subscribers, team_members,
  user_social_links, media, settings, reviews, auth_logs.
- Role-based permission system with the 6 system roles from PRD §18
  (Super Admin, CEO, Admin, Editor, Contributor, Author).
- JWT auth (httpOnly, Secure in production, SameSite=Lax cookie) with
  bcrypt (cost 12) password hashing.
- Account lockout after 5 failed attempts (15 min), IP-based rate limiting,
  and a server-side `auth_logs` audit trail.
- Secret admin URL (`ADMIN_PATH`) with literal `/admin` returning 404.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) applied globally via
  middleware, per PRD §30 (OWASP Top 10).
- Admin dashboard shell: sidebar (PRD §35 nav order, permission-aware),
  topbar, and live stats cards (PRD §6.2) reading real counts from MySQL.

## 5. What's next (later phases, per PRD §24)

Phase 2 continues with the remaining Admin CRUD modules (Blog, Services,
Reviews, Contacts, Newsletter, Media Library, Comments, Team, Users & Roles,
Settings), followed by the public site, SEO system, dark mode, and
multi-language support.

### Phase 2 progress so far

- **Portfolio module** (`/admin/portfolio`) — list with live search, add/edit
  forms (cover image + gallery + tech tags), delete with confirmation.
  Every write action is permission-checked server-side against the logged-in
  user's role (not just hidden in the UI).
- **Shared image upload pipeline** (`/api/admin/upload`) — converts any
  upload to WebP via Sharp, saves a full-size + thumbnail version under
  `/public/uploads/YYYY/MM/`, generates a tiny base64 blur placeholder, and
  records everything in the `media` table so the future Media Library module
  can browse every upload made from any part of the admin panel.
- **Shared API auth helper** (`src/lib/api-auth.ts`) — every future admin API
  route reuses `requirePermission(request, module, action)` for consistent
  401/403 handling.

## 6. Deployment (Hostinger)

See PRD §11 for the full hPanel setup. Short version:

```bash
npm run build
# Upload .next/, public/, package.json, next.config.mjs to Hostinger
# npm install --production on the server
# Set the same env vars from .env.local in hPanel → Environment Variables
# Start with: npm start  (or PM2 for process management)
```
