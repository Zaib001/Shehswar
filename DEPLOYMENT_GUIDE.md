# Shehswar ONE360 — Client PC / On-Premise Server Deployment Guide

This guide explains step-by-step how to host and run **Shehswar ONE360** directly on a Windows PC/Server at the client's office and make it accessible **from anywhere (home, mobile devices, remote branches, field officers)** 24/7.

---

## 🏗 System Architecture Overview

- **Frontend (Web ERP)**: Next.js (Port `3000`)
- **Backend (API)**: NestJS Core Engine (Port `4000`)
- **Database**: PostgreSQL (Hosted on cloud Render / local instance)
- **Process Manager**: PM2 (Auto-restarts if crashed, keeps running in background)
- **Public Internet Access**: Cloudflare Tunnel (100% Free, Secure HTTPS, No Router Port-Forwarding, Bypasses ISP CGNAT)

---

## 📋 Step 1: Client PC Prerequisites

Ensure the following are installed on the client machine:
1. **Node.js 20+ LTS**: Download from [nodejs.org](https://nodejs.org) (tick "Automatically install necessary tools").
2. **Git for Windows**: Download from [git-scm.com](https://git-scm.com).

Verify in PowerShell or Command Prompt:
```cmd
node -v
npm -v
git --version
```

---

## ⚙️ Step 2: Project Setup & Environment Configuration

1. Place or clone the project on the client PC (e.g., `C:\Shehswar360` or `D:\Shehswar360`).
2. In the project root, ensure your `.env` file exists with the production database URL:
```env
NODE_ENV=production
APP_NAME=shehswar-one360
PORT=4000
CORS_ORIGIN=*

# PostgreSQL Database Connection
DATABASE_URL="postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360"

# JWT Authentication Keys
JWT_ACCESS_SECRET="shehswar_enterprise_jwt_access_super_secret_key_2026_prod"
JWT_ACCESS_EXPIRATION="30d"
JWT_REFRESH_SECRET="shehswar_enterprise_jwt_refresh_super_secret_key_2026_prod"
JWT_REFRESH_EXPIRATION="30d"

# Internal proxy URL for Web app
NEXT_PUBLIC_API_URL=http://localhost:4000
BACKEND_API_URL=http://localhost:4000
```

---

## 🔨 Step 3: Build & Start the Application

### Option 1: One-Click (Recommended)
1. Double-click **`build-production.bat`** in the project folder.
   - It installs dependencies, generates Prisma client, and builds the production bundles.
2. Double-click **`start-production.bat`**.
   - It installs PM2 (if missing) and starts both API and Web services in the background.

### Option 2: Via Terminal
```cmd
# 1. Install & build
npm install
npm run db:generate
npm run build

# 2. Install PM2 process manager
npm install -g pm2

# 3. Launch both apps via ecosystem config
pm2 start ecosystem.config.js
pm2 save
```

Test locally in any browser on the host PC:
- **ERP Web**: [http://localhost:3000](http://localhost:3000)
- **API Health**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

## 🌐 Step 4: Making It Accessible from Everywhere (Global Internet Access)

### Why Cloudflare Tunnel is the Best Solution:
- **No Static IP needed**: Works on any home/office internet (PTCL, StormFiber, Nayatel, Jazz, etc.).
- **Bypasses CGNAT & Firewalls**: Zero router port-forwarding required.
- **Free Automatic SSL/HTTPS**: Generates trusted SSL certificates (`https://...`).
- **Free & Secure**: Powered by Cloudflare’s global edge network.

---

### Method A: Instant Free Quick Tunnel (No Domain Needed, 2 Minutes)

1. Download `cloudflared` for Windows:
   - Direct download: [cloudflared-windows-amd64.msi](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi)
2. Run the installer.
3. Open Command Prompt and run:
```cmd
cloudflared tunnel --url http://localhost:3000
```
4. Cloudflare will print a secure public link, for example:
   ```
   https://random-assigned-name.trycloudflare.com
   ```
5. Anyone from anywhere in the world on a phone, laptop, or desktop can now open that URL and access Shehswar ONE360!

---

### Method B: Permanent Custom Domain (e.g. `https://erp.shehswar.com` or `clientcompany.com`)

If the client owns a domain (registered on Cloudflare, Namecheap, GoDaddy, etc.):

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) -> **Zero Trust** -> **Networks** -> **Tunnels**.
2. Click **Add a Tunnel** -> choose **Cloudflared**.
3. Name it (e.g., `shehswar-server`).
4. Select **Windows** operating system:
   - Cloudflare will provide a one-line command to install the tunnel as a permanent Windows background service, e.g.:
     ```cmd
     cloudflared.exe service install <YOUR_TOKEN_HERE>
     ```
5. In the **Public Hostname** tab:
   - Subdomain: `erp`
   - Domain: `yourdomain.com` (e.g., `erp.yourdomain.com`)
   - Service Type: `HTTP`
   - URL: `localhost:3000`
6. Click **Save**.
7. Now **`https://erp.yourdomain.com`** is live 24/7 with enterprise-grade SSL and DDoS protection!

---

## 🔄 Step 5: Configure 24/7 Auto-Start on Windows Boot

To make sure Shehswar ONE360 and the tunnel automatically start when the PC turns on or reboots after a power failure:

### 1. Auto-Start PM2 with Windows:
Open Command Prompt as Administrator:
```cmd
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

### 2. Auto-Start Cloudflare Tunnel:
If using Method B (Cloudflare Zero Trust token), running:
```cmd
cloudflared service install <TOKEN>
```
automatically registers it as a native Windows Service (`services.msc`) that starts before any user even logs in!

---

## 🛡️ Step 6: Local Office Access (LAN / Wi-Fi)

To also access the system from other PCs/laptops on the same office Wi-Fi network without using the internet:
1. Find the server PC's Local IP address:
   ```cmd
   ipconfig
   ```
   *(e.g., `192.168.1.50`)*
2. Allow Port `3000` through Windows Defender Firewall (Run PowerShell as Admin):
   ```powershell
   New-NetFirewallRule -DisplayName "Shehswar ERP Web" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
3. Any device connected to the office Wi-Fi can now open:
   `http://192.168.1.50:3000`

---

## 📊 Useful Maintenance Commands

| Action | Command |
|---|---|
| View Running Status | `pm2 status` |
| View Live Logs | `pm2 logs` |
| Restart All Services | `pm2 restart all` |
| Stop Services | `pm2 stop all` |
| Pull Latest Updates | `git pull origin main` && `build-production.bat` && `pm2 restart all` |
