# Hierarchical System Settings Architecture & Specification

## 1. Executive Overview

**SHEHSWAR ONE360** implements a **5-tier Cascading Inheritance** settings framework. Rather than hardcoding system behaviors or duplicating settings across entities, values cascade downwards from platform defaults to individual user preferences, allowing localized overrides at any tier.

### The 5 Cascading Levels
```
Level 1: Platform Level (Global defaults across entire SaaS deployment)
   │
   └── Level 2: Organization Level (Shehswar Group Holding defaults)
          │
          └── Level 3: Company Level (Subsidiary specific, e.g. Shehswar Chemicals)
                 │
                 └── Level 4: Branch Level (Regional office or depot specific)
                        │
                        └── Level 5: User Level (Individual personal preference)
```

---

## 2. Inheritance Resolution Algorithm

When a component or service requests a setting key (e.g., `general.timezone` or `security.session_timeout`):
1. Check if a **User-level** override exists. If present, return it.
2. Otherwise, check for a **Branch-level** override.
3. Otherwise, check for a **Company-level** override.
4. Otherwise, check for an **Organization-level** override.
5. If none are set, return the **Platform-level** default.

This resolution logic is implemented in `SettingsService.resolveHierarchy()` and verified by unit tests in `settings.service.spec.ts`.

---

## 3. Configuration Categories

1. **General & Regional**:
   - `general.language`: UI language (`en-US`, `ur-PK`).
   - `general.timezone`: Primary operational timezone (`Asia/Karachi`, `UTC`).
   - `general.currency`: Base operating currency (`PKR`, `USD`, `EUR`).
2. **Security & Access**:
   - `security.password_min_length`: Enforced password length (default: 12).
   - `security.session_timeout`: Max idle session duration in minutes (default: 30).
   - `security.mfa_enforced`: Multi-factor authentication requirement switch.
3. **Notifications**:
   - `notifications.email_alerts`: Global switch for email notifications.
   - `notifications.approval_digest`: Frequency of pending approval digests (`INSTANT`, `HOURLY`, `DAILY`).
4. **Appearance & UI**:
   - `appearance.theme`: Visual presentation mode (`DARK`, `LIGHT`, `SYSTEM`).
   - `appearance.density`: Table and card padding scale (`COMFORTABLE`, `COMPACT`).

---

## 4. UI Architecture & Features

- **Scope Selector Tabs**: Easily switch between Platform, Organization, Company, and Branch configuration panes.
- **Visual Inheritance Badges**: Identifies whether a setting value is actively inherited from a higher tier or overridden locally.
- **Reset to Inherited**: Allows administrators to clear localized overrides and restore parent defaults with a single click.
