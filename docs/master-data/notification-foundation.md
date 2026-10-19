# Notification Foundation Architecture & Specification

## 1. Executive Overview

In **SHEHSWAR ONE360**, the `NotificationService` powers real-time, categorized alerts and messages to enterprise users across web app banners, modal drawers, and background dispatch queues.

### Categories
1. `APPROVAL`: Workflow approvals requiring user review or action (e.g. Purchase order pending approval).
2. `SECURITY`: Security alerts, new device logins, or password reset confirmations.
3. `WARNING`: System alerts, credit ceiling limits, or low stock warnings.
4. `SYSTEM`: Maintenance schedules, feature releases, and system updates.

### Priority Levels
- `URGENT`: Critical alerts requiring immediate user action; triggers desktop badges and priority toast notifications.
- `HIGH`: Important operational notices displayed prominently at top of feeds.
- `NORMAL`: Standard daily operational events.
- `LOW`: Informational background status updates.

---

## 2. Entity Schema & Standards

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `userId` | `VARCHAR(36)` | `NOT NULL, FK` | Recipient user account |
| `title` | `VARCHAR(255)` | `NOT NULL` | Short summary title |
| `message` | `TEXT` | `NOT NULL` | Detailed notification message |
| `category` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'SYSTEM'` | `APPROVAL`, `SECURITY`, `WARNING`, `SYSTEM` |
| `priority` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'NORMAL'` | `URGENT`, `HIGH`, `NORMAL`, `LOW` |
| `isRead` | `BOOLEAN` | `NOT NULL, DEFAULT false` | Read status indicator |
| `metadata` | `JSONB` | `NULLABLE` | Deep-link routing metadata (`{ "route": "approvals", "id": "req-12" }`) |
| `createdAt` | `TIMESTAMPTZ` | `NOT NULL` | Dispatch timestamp |

---

## 3. Real-Time UI Architecture & Notification Center

The Notification Center is integrated into the application header and full notification view:
- **Header Bell Icon**: Features a live unread badge count counter and quick dropdown preview.
- **Dedicated Notification Center View**:
  - Filter by Category (`All`, `Approval`, `Security`, `Warning`, `System`).
  - Filter by Read Status (`Unread Only`, `All`).
  - Priority Indicators: Distinct visual color bands for Urgent (red), High (amber), Normal (teal), and Low (slate).
  - Bulk Actions: `Mark All as Read` and `Clear Read Notifications`.
  - Deep Navigation: Clicking an approval notification immediately navigates to the relevant authorization panel.
