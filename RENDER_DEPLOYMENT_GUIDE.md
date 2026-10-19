# 🚀 SHEHSWAR ONE360 — Zero-Touch Render Deployment Guide

This project is fully configured for automated, zero-touch deployment on [Render](https://render.com).
Once deployed, **you do not need to do anything manually on Render ever again**:
- ✅ Database schema tables and indexes are automatically created and synchronized on every deploy (`prisma db push`).
- ✅ Administrator credentials (`admin@shehswar.com` / `Password123!`), enterprise organization, companies, and roles are automatically seeded and unlocked.
- ✅ API listens dynamically on Render's assigned port (`0.0.0.0:PORT`).
- ✅ Web frontend automatically discovers and proxies requests to the backend API without CORS issues.
- ✅ Future Git pushes trigger seamless auto-deployments with zero downtime.

---

## ⚡ Method 1: One-Click Deploy via Render Blueprint (Recommended)

Render reads [render.yaml](file:///d:/Shehswar360/render.yaml) from the repository and automatically provisions the PostgreSQL database, NestJS Backend API, and Next.js Web Frontend.

### Steps:
1. Push your code to your GitHub / GitLab repository:
   ```bash
   git add .
   git commit -m "feat: ready for render deployment"
   git push origin main
   ```
2. Open your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** (top right) ➔ Select **Blueprint**.
4. Connect your GitHub/GitLab repository.
5. Render will detect `render.yaml` and display:
   - **Database**: `shehswar-db` (PostgreSQL 16)
   - **Web Service**: `shehswar-api` (NestJS REST API)
   - **Web Service**: `shehswar-web` (Next.js Frontend)
6. Click **Apply**.

Render will now automatically:
- Provision the PostgreSQL database.
- Build and start `shehswar-api`, run database migrations, and seed the admin user.
- Build and start `shehswar-web` connected to `shehswar-api`.

Once complete, open the `shehswar-web` URL (e.g., `https://shehswar-web.onrender.com`) and log in!

---

## 🛠️ Method 2: Manual Web Service Setup (If not using Blueprint)

If you prefer creating services individually in Render:

### 1. Create PostgreSQL Database
- **Name**: `shehswar-db`
- **Database**: `shehswar_one360`
- **User**: `shehswar_user`
- Copy the **Internal Database URL**.

### 2. Create Backend API Web Service
- **Name**: `shehswar-api`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run render:build:api`
- **Start Command**: `npm run render:start:api`
- **Health Check Path**: `/health/live`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `DATABASE_URL`: *(paste your internal database URL)*
  - `JWT_ACCESS_SECRET`: *(click Generate or random 32+ char string)*
  - `JWT_REFRESH_SECRET`: *(click Generate or random 32+ char string)*
  - `STORAGE_PROVIDER`: `local`
  - `CORS_ORIGIN`: `*`

### 3. Create Frontend Web Service
- **Name**: `shehswar-web`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run render:build:web`
- **Start Command**: `npm run render:start:web`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `NEXT_PUBLIC_API_URL`: `https://shehswar-api.onrender.com` *(your API public URL)*
  - `BACKEND_API_URL`: `https://shehswar-api.onrender.com`

---

## 🔑 Default Administrator Credentials

Once deployed, the following Super Administrator account is seeded, unlocked, and immediately accessible:

| Field | Value |
|---|---|
| **URL** | `https://your-shehswar-web.onrender.com/login` |
| **Email** | `admin@shehswar.com` |
| **Password** | `Password123!` |
| **Role** | Super Administrator (Full Platform Scope) |
| **Status** | Active & Unlocked |

---

## 🔄 Automated Lifecycle (What happens on each deploy)

Whenever you push commits to GitHub, Render automatically:
1. Compiles monorepo packages and builds the application.
2. Checks PostgreSQL database schema and executes `prisma db push` to synchronize any new models, tables, columns, or indexes.
3. Verifies and idempotently updates the Administrator account and essential system seed records.
4. Boots the NestJS API server and Next.js frontend with zero downtime.
