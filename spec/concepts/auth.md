# Auth

## Description
Authentication and session management system supporting email/password login, registration, email verification, and password reset flows. Sessions are stored in the database and identified by HTTP-only cookies.

## Dependencies
- [Database](db.md) — `user`, `session`, `verificationToken` tables
- [Email](email.md) — sends verification and password reset emails
- [Middleware](middleware.md) — `kempo-auth` enforces session requirements on protected routes
- bcrypt — password hashing

## Context
Auth is the foundational system that all access control builds on. A user registers, gets a session, and that session token is used to check permissions throughout the system.

### Decisions
- **Cookie-based sessions**: Sessions use `session_token` HTTP-only cookies. No JWT, no Bearer tokens. This keeps the frontend simple (no token management) and sessions are revocable server-side.
- **Database-stored sessions**: Sessions are rows in the `session` table with expiration timestamps. This allows listing active sessions, revoking individual sessions, and cleaning up expired ones.
- **Separate verification tokens**: Email verification and password reset share the `verificationToken` table, distinguished by a `type` field.
- **Configurable session duration**: The `system:session_duration_days` setting controls session lifetime (default: 7 days).
- **Registration can be disabled**: The `system:allow_registration` setting controls whether new accounts can be created.
- **Email verification is optional**: The `system:require_email_verification` setting controls whether email verification is enforced.

## Implementation

### Auth Flows

**Registration:**
1. `POST /kempo/api/auth/register/email` → `registerEmail({ email, password, name })`
2. Creates user with hashed password
3. Creates session
4. Optionally sends verification email
5. Returns session token as cookie

**Login:**
1. `POST /kempo/api/auth/login/email` → `loginEmail(email, password)`
2. Verifies password hash
3. Creates session, cleans expired sessions
4. Returns session token as cookie

**Email Verification:**
1. `sendVerificationEmail({ userId, email, name })` creates a verification token and sends email
2. User clicks link with token
3. `POST /kempo/api/auth/verify-email` → `verifyEmail({ token })` marks email as verified

**Password Reset:**
1. `POST /kempo/api/forgot-password` → `requestPasswordReset({ email })` creates reset token, sends email
2. User clicks link with token
3. `POST /kempo/api/auth/reset-password` → `resetPassword({ token, password, logoutAll })` sets new password

**Session Check:**
1. `GET /kempo/api/auth/session` → `getSession({ token })` returns user data if session is valid

### Server Utils
| Util | Purpose |
|---|---|
| `registerEmail` | Create user account with email/password |
| `loginEmail` | Authenticate and create session |
| `logout` | Delete session by token |
| `getSession` | Validate session and return user data |
| `changePassword` | Change password for authenticated user |
| `requestPasswordReset` | Generate reset token and send email |
| `resetPassword` | Set new password using reset token |
| `sendVerificationEmail` | Generate verification token and send email |
| `verifyEmail` | Mark email as verified using token |

## Notes
- The login route is at `/auth/login/email` (not just `/auth/login`) to support future auth methods (OAuth, etc.).
- Password hashing uses bcrypt with default salt rounds.
- The `forgot-password` API route is at the top level (`/kempo/api/forgot-password/`) rather than under `/kempo/api/auth/`.
