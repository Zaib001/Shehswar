# User Administration Architecture & Specification

## 1. Executive Overview

In **SHEHSWAR ONE360**, the `User` entity manages identity, authentication, session security, and access control for all internal personnel and external stakeholders.

### User Account Statuses
- `ACTIVE`: Fully authenticated user with valid operational access.
- `INACTIVE`: Temporarily disabled account (e.g. employee on leave).
- `SUSPENDED`: Blocked by security administrator due to compliance or audit review.
- `LOCKED`: Automatically secured after repeated failed authentication attempts.

---

## 2. Entity Schema & Standards

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | `PRIMARY KEY` | UUIDv7 primary identifier |
| `organizationId` | `VARCHAR(36)` | `NOT NULL, FK` | Enterprise holding scope |
| `companyId` | `VARCHAR(36)` | `NULLABLE, FK` | Primary operating company assignment |
| `employeeId` | `VARCHAR(36)` | `NULLABLE, FK` | Link to HR `Employee` master record |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | Login identifier and primary email address |
| `phone` | `VARCHAR(50)` | `NULLABLE` | Contact phone number for 2FA SMS |
| `passwordHash` | `VARCHAR(255)` | `NOT NULL` | Argon2id cryptographically salted hash |
| `firstName` | `VARCHAR(100)` | `NOT NULL` | Given name |
| `lastName` | `VARCHAR(100)` | `NOT NULL` | Family name |
| `status` | `ENUM` | `NOT NULL, DEFAULT ACTIVE` | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `LOCKED` |
| `roleId` | `VARCHAR(36)` | `NOT NULL, FK` | Primary RBAC role assignment |
| `lastLoginAt` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp of latest successful JWT issuance |
| `createdAt` | `TIMESTAMPTZ` | `NOT NULL` | Record creation timestamp |
| `updatedAt` | `TIMESTAMPTZ` | `NOT NULL` | Last modified timestamp |

---

## 3. Security & Multi-Company Binding

1. **Password Policy Enforcement**:
   - Minimum 12 characters.
   - At least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
   - Rate limiting on failed password verification.
2. **Employee Linkage**:
   - An operational user can be linked to an `Employee` master record, enabling automatic synchronization of department, reporting manager, and plant location.
3. **Session Management**:
   - JWT tokens include `userId`, `organizationId`, `companyId`, and `roleCode`.
   - Access tokens expire after 15 minutes; refresh tokens use cryptographic rotation in Redis/PostgreSQL.

---

## 4. UI Architecture & Features

- **User List**: Searchable by name, email, role, or company; filterable by account status; bulk status update capabilities.
- **User Detail**:
  - *Profile Overview*: Personal details, linked employee record, primary company, and role.
  - *Active Sessions*: Real-time view of active devices, IP addresses, and login timestamps with remote revocation action.
  - *Audit & Security*: Login history and status change trail.
- **User Form**: Step-by-step account onboarding verifying corporate email uniqueness, role assignment, and password strength.
