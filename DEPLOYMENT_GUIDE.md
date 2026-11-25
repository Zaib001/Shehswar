# Shehswar ONE360 — Complete On-Premise Host & Global Access Guide

This guide provides the complete, professional enterprise solution to host **everything locally on the client's PC / Windows Server** (Database, Backend API, Frontend ERP Web, and Backups) while allowing staff and field officers to securely access the system **from everywhere in the world (smartphones, laptops, remote branches, and home)**.

---

## 🏛️ System Architecture

```text
[ Mobile / Laptop / Remote Branch ]
               │
               ▼ (Secure HTTPS via Cloudflare Tunnel)
     ┌────────────────────────────────────────────────────────┐
     │ CLIENT PC / ON-PREMISE SERVER                          │
     │                                                        │
     │  Cloudflare Tunnel (cloudflared Windows Service)       │
     │         │                                              │
     │         ▼                                              │
     │  Next.js Frontend ERP (:3000)                          │
     │         │ (Internal Proxy)                             │
     │         ▼                                              │
     │  NestJS Backend API (:4000)                            │
     │         │                                              │
     │         ▼                                              │
     │  PostgreSQL 16 Database Engine (:5432)                 │
     │         │                                              │
     │         ▼                                              │
     │  Daily Automated Local Backups (.sql dumps)            │
     └────────────────────────────────────────────────────────┘
```

---

## 🚀 Choose Your Deployment Method

| Feature | Option A: Docker All-in-One (Recommended) | Option B: Native Windows (Lightweight) |
|---|---|---|
| **PostgreSQL Database** | Containerized (Postgres 16 Alpine) | Native Windows Service (PostgreSQL 16) |
| **Backend & Frontend** | Containerized (`shehswar_api`, `shehswar_web`) | PM2 Windows Process Manager |
| **RAM Footprint** | ~1.5 GB | ~800 MB |
| **Setup Complexity** | 1 command (`docker compose up -d`) | Run installers & `.bat` scripts |
| **Best For** | Modern PCs with 8GB+ RAM & Virtualization | Standard office PCs with 4GB - 8GB RAM |

---

# 📦 METHOD A: Docker All-in-One (Recommended)

### Step 1: Install Docker Desktop on Client PC
1. Download **Docker Desktop for Windows** from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).
2. Install it with WSL2 backend (recommended).
3. In Docker Desktop Settings -> **General**, enable **"Start Docker Desktop when you log in"**.

### Step 2: Configure Environment
In the project root, verify your `.env` contains:
```env
DB_USER=shehswar_user
DB_PASSWORD=ShehswarSecure2026!
DB_NAME=shehswar_one360
JWT_ACCESS_SECRET=shehswar_enterprise_jwt_access_super_secret_key_2026_prod
JWT_REFRESH_SECRET=shehswar_enterprise_jwt_refresh_super_secret_key_2026_prod
```

### Step 3: Launch Everything
Open PowerShell or Command Prompt in the project folder:
```cmd
docker compose -f docker-compose.production.yml up -d --build
```
This automatically boots:
- ✅ **PostgreSQL 16 Database** (Data stored permanently on PC disk in `./postgres_data`)
- ✅ **Redis 7 Cache**
- ✅ **NestJS API Backend** on port `4000`
- ✅ **Next.js Web ERP** on port `3000`

---

# 💻 METHOD B: Native Windows (Without Docker)

### Step 1: Install Prerequisites
1. **Node.js 20+ LTS**: Download from [nodejs.org](https://nodejs.org).
2. **PostgreSQL 16 for Windows**:
   - Download the official installer from [enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
   - Set password (e.g. `postgrespassword`), port `5432`.
   - It runs automatically as a native background Windows Service (`postgresql-x64-16`).

### Step 2: Configure Local Database in `.env`
Open `.env` and set:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/shehswar_one360?schema=public"
```

### Step 3: Push Schema & Build
Double-click:
1. `scripts\build-production.bat` (installs dependencies, builds API and Next.js).
2. `npm run db:push` (creates all tables in the local PostgreSQL database).

### Step 4: Start Services via PM2
Double-click:
`start-production.bat`
This launches both backend and frontend in the background with auto-restart.

---

## 🔄 Step 3: Migrate Existing Data from Cloud (Render) to Local PC

If you have existing data on Render that the client wants on his local machine:
Run the provided script:
```cmd
scripts\migrate-from-cloud.bat
```
This automatically:
1. Connects to the cloud PostgreSQL database.
2. Creates an encrypted snapshot dump (`cloud_migration.dump`).
3. Restores all tables, records, dealers, products, and ledgers cleanly into the local PostgreSQL engine!

---

## 🌐 Step 4: Enable Global Access from Everywhere (Cloudflare Tunnel)

> [!IMPORTANT]
> **Why Cloudflare Tunnel?**
> In Pakistan and most countries, office/home ISPs (PTCL, StormFiber, Nayatel, Jazz) use **CGNAT**. You do NOT have a public IP, and port-forwarding on the router is impossible without an expensive static IP package.
> Cloudflare Tunnel creates a direct, outbound, encrypted tunnel to Cloudflare's global edge network:
> - **Zero router configuration**
> - **No static IP needed**
> - **Free automatic HTTPS/SSL certificate**
> - **Fast & DDoS protected**

### Option 1: Quick Free Tunnel (Ready in 2 Minutes, No Domain Required)
1. Download [cloudflared-windows-amd64.msi](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi) and install it.
2. In Command Prompt, run:
   ```cmd
   cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare will print a secure URL, for example:
   ```text
   https://shehswar-agro.trycloudflare.com
   ```
4. Share this URL with your client, staff, and sales officers. They can access the ERP immediately from any mobile browser or PC in the world.

### Option 2: Permanent Company Domain (e.g. `https://erp.clientcompany.com`)
1. Log into [dash.cloudflare.com](https://dash.cloudflare.com) -> **Zero Trust** -> **Networks** -> **Tunnels**.
2. Click **Add a Tunnel** -> choose **Cloudflared** -> Name it (e.g. `shehswar-local-server`).
3. Choose **Windows** -> Copy the install command:
   ```cmd
   cloudflared.exe service install <YOUR_TOKEN>
   ```
   *(Running this command installs the tunnel as a native Windows Service that boots automatically with the PC!)*
4. Under **Public Hostname**:
   - Subdomain: `erp`
   - Domain: `yourdomain.com`
   - Type: `HTTP`
   - URL: `localhost:3000`
5. Click **Save**. The application is now live at `https://erp.yourdomain.com` 24/7!

---

## 💾 Step 5: Automated Daily Local Database Backups

To ensure the client never loses financial data even if Windows crashes:
1. We have provided `scripts\backup-db.bat`.
2. When executed, it creates a timestamped SQL backup in the `backups\` folder:
   `backups\shehswar_backup_2026-11-25_15-30.sql`
3. **Automate Daily at 11:00 PM via Windows Task Scheduler**:
   - Open **Task Scheduler** in Windows -> Click **Create Basic Task**.
   - Name: `Shehswar Daily Backup`.
   - Trigger: **Daily** at `23:00` (11:00 PM).
   - Action: **Start a program** -> Browse to `D:\Shehswar360\scripts\backup-db.bat`.
   - Finish.

---

## ⚡ Step 6: Critical Windows Server Settings

On the client PC:
1. **Disable Sleep / Hibernate**:
   - Go to Windows Settings -> **Power & sleep** -> Set **Sleep** to **"Never"**.
2. **Configure Windows to Auto-Login or Run as Service**:
   - If using Docker or PM2 with `pm2-startup install`, services run automatically in the background on system startup.
3. **BIOS AC Power Recovery (Recommended)**:
   - In the PC's BIOS settings, enable **"Restore on AC Power Loss"** (Power On).
   - If electricity goes out and generator/UPS kicks in, the PC automatically turns itself back on without anyone having to press the power button!

---

## 📋 Summary Checklist for Client Handover

- [x] Local PostgreSQL database running on port `5432` with persistent storage.
- [x] Backend API running on port `4000`.
- [x] Frontend Web running on port `3000`.
- [x] Cloud database snapshot migrated to local PC (`scripts\migrate-from-cloud.bat`).
- [x] Cloudflare Tunnel running as a Windows Service for global HTTPS access.
- [x] Daily automated backup task configured (`scripts\backup-db.bat`).
- [x] Windows Sleep set to "Never".
