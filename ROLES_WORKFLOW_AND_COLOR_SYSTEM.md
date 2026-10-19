# SHEHSWAR ONE360 — Role Hierarchies, Screen Workflows & Mobile Design System
**Document Type:** Technical & Commercial Architecture Guide  
**Application Ecosystem:** Enterprise ERP (Web) & Field Force Mobile App (Android / iOS)  
**Version:** 1.0.0  

---

# PART 1: User Roles, Logins & Screen Workflows

### Overview of User Accounts
**Yes, every role has separate logins, distinct security credentials, and role-scoped permissions.**
In the PostgreSQL database (`users`, `user_roles`, `user_market_assignments`), each user is bound to their organizational scope (Territory, Zone, Region, or National).

```
┌─────────────────────────────────────────────────────────────────┐
│                 Level 4: Super Admin / Management               │
│               (Full ERP, Strategy, Finance, Policy)             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│               Level 3: Business Manager (BM)                    │
│            (Regional Head - South Punjab, Central, etc.)         │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                 Level 2: Area Manager (AM)                      │
│            (Zonal Supervisor - Multan, Sahiwal, etc.)           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                Level 1: Sales Officer (SO)                      │
│            (Field Force - Multan Sadar, Shujabad, etc.)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Role-by-Role Breakdown

### 🧑‍🌾 1. Sales Officer (SO) — Field Force
* **Primary Device:** Android / iOS Mobile App (Field Force Companion)
* **Scope:** 1 Assigned Territory (e.g., Multan Sadar)
* **Test Login:** `usman.so.2885@shehswar.test` | Password: `Shehswar@2026!`
* **Screen & Workflow Responsibilities:**
  1. **Dealer Directory (Customer Portfolio):**
     - Views *only* the dealers assigned to their territory.
     - Live view of dealer credit limits, current outstanding balances, and aging ledgers.
  2. **Sales Order Booking (Primary Task):**
     - Selects dealer ➔ selects active finished products ➔ sets quantities and pricing phase.
     - Order is generated in `PENDING` state and appears on Area Manager’s dashboard instantly.
  3. **Payment Recovery & Cheque Collection:**
     - Collects cash, bank deposit slips, or cheques from dealers.
     - Snaps photos of bank deposit slips; uses OCR camera scanner to auto-extract amount and slip number.
     - Generates official `DRCPT-XXXX` payment receipts.
  4. **Live Warehouse Stock Lookup:**
     - Checks depot inventory before committing to delivery with dealers.
  5. **Personal Performance Dashboard:**
     - Monthly sales target vs. actual recovery.
     - Personal recovery percentage and salary justification score.

---

### 👨‍💼 2. Area Manager (AM) — Zonal Supervisor
* **Primary Device:** ERP Web & Mobile Tablet / App Management View
* **Scope:** 1 Zone (contains 3–6 Territories & multiple Sales Officers)
* **Test Login:** `bilal.am.2866@shehswar.test` | Password: `Shehswar@2026!`
* **Screen & Workflow Responsibilities:**
  1. **Order Moderation & Approval Queue:**
     - Reviews all `PENDING` orders booked by Sales Officers in the zone.
     - **Quantity & Rate Customization:** Can adjust order quantity (e.g., dealer requested 100 bags, but due to credit or stock limits, AM approves 60 bags).
     - Approves or Rejects orders with mandatory rejection notes.
  2. **Zonal Sales & Recovery Tracker:**
     - Monitors total zone target vs. booked sales vs. recovered cash.
     - Identifies underperforming territories and lagging officers.
  3. **Dealer Credit Control:**
     - Monitors dealers exceeding credit limits or defaulting on agreed payment cycles.
  4. **Field Force Attribution & Assignment:**
     - Reassigns dealers between Sales Officers within their zone.

---

### 🏛️ 3. Business Manager (BM) — Regional Head
* **Primary Device:** ERP Web Executive Portal
* **Scope:** 1 Entire Region / Province (contains multiple Zones & Area Managers)
* **Test Login:** `ahmed.bm.2833@shehswar.test` | Password: `Shehswar@2026!`
* **Screen & Workflow Responsibilities:**
  1. **Market Structure & 6-Tier Sales Performance Engine:**
     - Deep drill-down analytics: Region ➔ Zones ➔ Territories ➔ Officers ➔ Dealers.
     - Monitors **Salary Justification Ratio** (Sales Revenue ÷ Officer Cost) to ensure profitability.
  2. **Executive PDF Reports:**
     - One-click branded PDF reports generated across any tier for board reviews and regional meetings.
  3. **High-Value Approvals:**
     - Approves special credit limit extensions and exceptional commercial pricing phases (e.g., Seasonal Discount Schemes).
  4. **Regional Stock Allocation:**
     - Coordinates stock distribution between regional distribution depots.

---

### ⚙️ 4. Company Admin / Super Admin — National Headquarters
* **Primary Device:** ERP Web Full Suite
* **Scope:** National Organization / Multi-Company
* **Test Login:** `admin@shehswar.com` | Password: `password123` *(or super-admin test credentials)*
* **Screen & Workflow Responsibilities:**
  1. **Supply Chain & Warehouses:**
     - Raw material procurement, production batch costing, stock transfer gate passes, and inventory audits.
  2. **Financial General Ledger:**
     - Double-entry accounting, automated balance sheets, dealer ledgers, vendor payables.
  3. **RBAC & System Setup:**
     - Creating user accounts, assigning roles, defining document numbering formats, and managing product master catalogs.

---

# PART 2: Design System & Color Palette for Mobile App

To ensure the **Field Force Mobile App** perfectly matches the **Shehswar ONE360 ERP Website**, use this exact design token system:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIMARY BRAND IDENTITY                          │
│                                                                        │
│   #0D9488            #14B8A6            #0F766E            #042F2E     │
│  Brand Primary     Brand Light        Brand Dark       Brand Deepest   │
│  (Emerald 600)    (Teal Accent 500)  (Forest Teal 700)  (Dark BG 950)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Brand & Core Color Swatches

| Token Name | Hex Code | RGB | Mobile App Usage |
| :--- | :--- | :--- | :--- |
| **Brand Primary** | `#0D9488` | `rgb(13, 148, 136)` | Main Action Buttons, Active Tabs, Key Metrics |
| **Brand Primary Hover** | `#14B8A6` | `rgb(20, 184, 166)` | Button Pressed State, Highlight Accents |
| **Brand Dark** | `#0F766E` | `rgb(15, 118, 110)` | Header Bars, App Bars, Dark Mode Borders |
| **Brand Deepest** | `#042F2E` | `rgb(4, 47, 46)` | Deep Brand Backdrop, Splash Screen Accents |
| **Brand Light Tint** | `#CCFBF1` | `rgb(204, 251, 241)` | Badges, Tag Backgrounds, Selected Item Background |

---

## 2. Backgrounds & Surface Colors

### A. Dark Mode Palette (Default Enterprise Theme)
Recommended for high outdoor sunlight readability and OLED battery savings:

| Element | Hex Code | RGB | Mobile App Component |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#090D16` | `rgb(9, 13, 22)` | Main Screen Background (`Scaffold` / `View`) |
| **Surface Card** | `#0F172A` | `rgb(15, 23, 42)` | Order Cards, Dealer List Items, Bottom Sheets |
| **Raised Surface** | `#1E293B` | `rgb(30, 41, 59)` | Input Fields, Dropdown Containers, Dialogs |
| **Subtle Border** | `rgba(255,255,255,0.08)` | - | Card Dividers, Separators |
| **Text Primary** | `#F8FAFC` | `rgb(248, 250, 252)` | Headings, Dealer Names, Order Values |
| **Text Secondary** | `#94A3B8` | `rgb(148, 163, 184)` | Labels, Dates, Subtitles, Helper Notes |
| **Text Muted** | `#64748B` | `rgb(100, 116, 139)` | Disabled text, Placeholders |

### B. Light Mode Palette (Clean Corporate Daytime)
| Element | Hex Code | RGB | Mobile App Component |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F8FAFC` | `rgb(248, 250, 252)` | Screen Background |
| **Surface Card** | `#FFFFFF` | `rgb(255, 255, 255)` | List Items, White Cards |
| **Raised Surface** | `#F1F5F9` | `rgb(241, 245, 249)` | Input Backgrounds, Inset Sections |
| **Border Default** | `#E2E8F0` | `rgb(226, 232, 240)` | Card Borders, Outlines |
| **Text Primary** | `#0F172A` | `rgb(15, 23, 42)` | Dark Slate Headings and Titles |
| **Text Secondary** | `#475569` | `rgb(71, 85, 105)` | Secondary Body Text |

---

## 3. Status & Semantic Colors (Badges, Alerts & Indicators)

| Status | Color Name | Hex Code | Background Tint | Mobile App Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Approved / Dispatched** | Success | `#10B981` | `#ECFDF5` | Approved Orders, Successful Sync, Credit Paid |
| **Pending Approval** | Warning | `#F59E0B` | `#FFFBEB` | Awaiting AM Approval, Unsynced Queue Items |
| **Rejected / Overlimit** | Danger | `#EF4444` | `#FEF2F2` | Rejected Orders, Dealer Over-Credit Alert |
| **Invoice / In Review** | Info / Blue | `#2563EB` | `#EFF6FF` | Converted to Sale, Invoice Documents |

---

## 4. Mobile Code Snippet: Ready-to-Use Styling Objects

### React Native / StyleSheet Example:
```typescript
export const ShehswarColors = {
  // Brand
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDark: '#0F766E',
  primaryTint: '#CCFBF1',

  // Dark Theme Surfaces
  darkCanvas: '#090D16',
  darkSurface: '#0F172A',
  darkSurfaceRaised: '#1E293B',
  darkBorder: 'rgba(255, 255, 255, 0.08)',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Statuses
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',
};
```

### Flutter / Dart Example:
```dart
import 'package:flutter/material.dart';

class ShehswarTheme {
  static const Color primary = Color(0xFF0D9488);
  static const Color primaryLight = Color(0xFF14B8A6);
  static const Color primaryDark = Color(0xFF0F766E);
  static const Color primaryTint = Color(0xFFCCFBF1);

  // Dark Backgrounds
  static const Color darkCanvas = Color(0xFF090D16);
  static const Color darkSurface = Color(0xFF0F172A);
  static const Color darkRaised = Color(0xFF1E293B);

  // Status
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF2563EB);
}
```

---

## 5. Summary Flowchart for Developers

```
[Sales Officer Mobile App]
       │
       ▼ Books Order (SO-0094) ➔ Status: PENDING
       │
[Area Manager Web Portal / App Queue]
       │
       ├──► Approves or Customizes (e.g. Qty: 100 ➔ 60) ➔ Status: APPROVED
       │       │
       │       ▼ (Mobile App receives instant status update)
       │
       └──► Rejects with Reason ➔ Status: REJECTED
               │
               ▼ (Mobile App alerted: Order Rejected)

[Warehouse / ERP Finance]
       │
       ▼ Converts APPROVED Order to Sales Invoice ➔ Status: CONVERTED_TO_SALE
               │
               ├──► Physical Stock Deducted from Multan Depot
               └──► Dealer Ledger Debited with Invoice Value
```
