# Feature Log

A chronological log of every feature added to MERN Shop, one commit at a time.
Each entry lists what changed, why, and where to find the code.

---

## Commit #1 — `chore: initialize monorepo with npm workspaces`

**Scope:** Project skeleton.

**What changed:**
- Initialized a **monorepo** using **npm workspaces** with three packages:
  - `client/` — React frontend (populated in Commit #3)
  - `server/` — Express backend (populated in Commit #2)
  - `shared/` — code shared between client and server (Zod schemas, types)
- Added repo-wide tooling: `.editorconfig`, `.nvmrc`, `.gitignore`.
- Wrote `README.md` with setup instructions and stack overview.
- Added `scripts/verify-workspaces.mjs` — a small assertion script that runs in CI and fails if a workspace is missing.

**Why:**
- Monorepos with workspaces let us install once, share types, and version all packages together.
- No Turborepo/Nx/Lerna — modern npm does workspaces natively.

---

## Commit #2 — `chore(server): setup TypeScript, ESLint, Prettier, tsconfig`

**Scope:** Backend tooling.

**What changed:**
- Configured TypeScript with **strict** settings: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noImplicitOverride`.
- Set up **ESLint 9 flat config** with `typescript-eslint` for type-aware linting.
- Set up **Prettier** with 100-char line width, double quotes, trailing commas.
- Added `tsx` for dev-time TS execution with hot reload.
- Added **Zod-based env validation** (`server/src/config/env.ts`) — the app refuses to boot if any required env var is missing/malformed.
- First test suite with **Vitest** (`server/src/index.test.ts`).
- Created `server/.env.example` as a safe template (real `.env` is gitignored).

**Why:**
- Strict TS catches entire classes of bugs at compile time.
- `zod` env validation means config errors fail at startup, not 30 seconds later during a request.
- `tsx` avoids the slow tsc → node cycle during development.

---

## Commit #3 — `chore(client): setup Vite + React 19 + Tailwind v4 + Vitest`

**Scope:** Frontend tooling.

**What changed:**
- **Vite 5** as the build tool (chosen over Vite 6 for compatibility with `vitest@2` and `@vitejs/plugin-react@4`).
- **React 19** + React DOM.
- **Tailwind CSS v4** via `@tailwindcss/vite` — no PostCSS, no `tailwind.config.js`. Config now lives in CSS via `@theme`.
- **Vitest + Testing Library** for component tests, with `jsdom` and `jest-dom` matchers.
- Split tsconfig into `tsconfig.app.json` (browser code) and `tsconfig.node.json` (Vite config itself).
- Path alias `@/` maps to `src/`.
- Vite dev proxy: `/api/*` → `http://localhost:5000` (our backend).
- First React component (`App.tsx`) styled with Tailwind's gradient + custom `@theme` tokens.
- Wrote `client/src/vite-env.d.ts` — reference types for Vite's env + jest-dom matchers.

**Why:**
- Vite 5 over 6 to avoid the duplicate-Vite type conflict we hit (see commit history for context).
- Tailwind v4 with the Vite plugin is significantly faster than v3's PostCSS pipeline.
- `@theme` in CSS gives us design tokens in one place.

---

## Commit #4 — `feat(server): add Express 5 app with helmet, cors, compression, health check`

**Scope:** First real HTTP server.

**What changed:**
- **Express 5 app factory** (`server/src/app.ts`) — returns a configured app; `server.ts` calls `.listen()`.
- **helmet** for security headers (CSP, HSTS, X-Frame-Options, etc.).
- **cors** configured to only allow `CLIENT_URL` origins, with credentials.
- **compression** — gzip responses.
- **cookie-parser** — parses `req.cookies`.
- **express.json / urlencoded** — body parsing with 10 KB limit.
- **morgan** (replaced later by Pino).
- **`AppError` class** (`server/src/utils/AppError.ts`) — typed error with status codes and static factories (`badRequest`, `unauthorized`, `notFound`, etc.).
- **`asyncHandler`** wrapper (`server/src/utils/asyncHandler.ts`) — forwards async errors to Express error middleware.
- **Centralized error handler** (`server/src/middleware/errorHandler.ts`) — handles `AppError`, `ZodError`, Mongo duplicate-key errors, and unknown errors. Hides messages in production.
- **404 handler** (`server/src/middleware/notFound.ts`).
- **Health endpoint** (`GET /api/health`).
- **Graceful shutdown** with SIGTERM/SIGINT handlers and a 10-second hard deadline.
- 12 tests covering health, error handling, and 404s.

**Why:**
- `createApp()` factory (instead of top-level `const app`) makes tests isolated.
- Central error handler means every route throws cleanly and gets consistent responses.
- Graceful shutdown prevents 500s during zero-downtime deploys.

---

## Commit #5 — `feat(db): connect MongoDB with Mongoose, retry logic, and health endpoint`

**Scope:** Database layer.

**What changed:**
- **Mongoose 8** connection manager (`server/src/config/db.ts`):
  - **Retry logic** — 5 attempts with 2-second delays.
  - **Connection pool** — `maxPoolSize: 10`, `minPoolSize: 2`.
  - **Timeouts** — `serverSelectionTimeoutMS: 5000` (fail fast in tests).
  - **`autoIndex`** off in production (indexes should be built deliberately in prod).
  - **Event listeners** for `connected`, `disconnected`, `reconnected`, `error`.
- **`getDbState()`** — maps `mongoose.connection.readyState` to a human string.
- **`disconnectDB()`** — clean shutdown helper.
- **`GET /api/health/db`** — separate **readiness** endpoint that returns 503 if the DB isn't connected.
- `createApp` now awaits `connectDB()` — the app refuses to start without a DB.
- Graceful shutdown now also disconnects from Mongo.
- 4 new tests for connection lifecycle.

**Why:**
- Separate **liveness** (`/health`) from **readiness** (`/health/db`) so load balancers do the right thing.
- Fail-fast DB connection prevents a broken API from serving traffic.

---

## Commit #6 — `feat(logging): add Pino structured logger with pretty dev output`

**Scope:** Observability.

**What changed:**
- **Pino logger** (`server/src/config/logger.ts`):
  - **Levels per env:** `silent` (test), `info` (prod), `debug` (dev).
  - **Pretty transport** in dev via `pino-pretty`; raw JSON in prod.
  - **Redaction** for `req.headers.authorization`, `req.body.password`, `*.token`, `*.secret`.
  - **Base fields** — every log includes `service: "mern-shop-api"` and `env`.
  - **ISO timestamps**.
- **Request ID middleware** (`server/src/middleware/requestId.ts`) — generates or honors `X-Request-ID`, attaches to `req.id`, echoes in response.
- **Request logger middleware** (`server/src/middleware/requestLogger.ts`) — replaces morgan. Compact serializers, custom log levels (5xx → error, 4xx → warn).
- Removed **morgan**.
- Replaced every `console.*` in the server with `logger.*`.
- 5 new tests for the logging layer.

**Why:**
- **Structured logs** are the only way to query real production traffic.
- **Request IDs** let you correlate logs across services for a single user request.
- **Redaction** prevents accidental password/token leaks into log storage.

---

## Commit #7 — `feat(user): add User model with bcrypt hashing, roles, and verification fields`

**Scope:** Core User model — the security foundation of the whole app.

**What changed:**
- **User schema** (`server/src/features/user/user.model.ts`) with:
  - `email` — unique, indexed, lowercased, regex-validated.
  - `password` — optional, `select: false`, bcrypt-hashed on save.
  - `name`, `role` (`user` | `admin`), `avatarUrl`.
  - **Email verification** fields (`emailVerified`, token hash, expiry) — all `select: false` except the boolean.
  - **Password reset** fields (token hash, expiry) — `select: false`.
  - **2FA** fields (`twoFactorEnabled`, `twoFactorMethod`, `twoFactorSecret` — `select: false`).
  - **OAuth accounts** subdocument array with compound unique index.
  - **Login lockout** fields (`loginAttempts`, `lockUntil` — `select: false`).
- **Instance methods:** `comparePassword`, `isLocked`, `incLoginAttempts`.
- **Static method:** `findByEmail(email, includePassword?)`.
- **Pre-save hook** hashes password only if modified.
- **`toJSON.transform`** strips all sensitive fields — belt-and-suspenders defense.
- **`types.ts`** — const objects + union types for `UserRole`, `TwoFactorMethod`, `OAuthProvider`.
- 13 tests including 3 negative tests that verify security guarantees.

**Why:**
- Every auth feature depends on this model. Getting it right once means no migrations later.
- `select: false` + `toJSON.transform` = two independent layers of defense against accidental leaks.
- Login lockout after 5 failures mitigates brute-force attacks.

---

## Commit #8 — `feat(auth): add signup endpoint with Zod validation and email verification token`

**Scope:** First user-facing endpoint.

**What changed:**
- **Crypto utils** (`server/src/utils/crypto.ts`):
  - `generateToken(bytes)` — cryptographically secure random hex.
  - `hashToken(raw)` — SHA-256 hash for DB storage.
- **Zod schemas** (`server/src/features/auth/auth.validation.ts`):
  - `signupSchema` — email, password (8+ chars, upper/lower/digit), name (2-80 chars).
  - `SignupInput` type inferred from the schema.
- **Signup service** (`auth.service.ts`) — checks for existing email, creates user, generates verification token, stores its hash + 24-hour expiry.
- **Signup controller** (`auth.controller.ts`) — validates body, calls service, returns 201 with user JSON.
- **Router** (`auth.routes.ts`) — `POST /api/auth/signup`.
- Mounted at `/api/auth` in `app.ts`.
- 9 tests including duplicate email, weak passwords, case-insensitivity, and a **MongoDB query injection** test.

**Why:**
- Storing the **hash** of the verification token means DB leaks don't expose usable tokens.
- Zod validation at the API boundary blocks injection attempts (`{"$ne": null}` etc.).
- 409 for duplicate email plus unique index = defense in depth.

**Fixed during this commit:** Parallel test files were sharing the same DB and clobbering each other. Added `--no-file-parallelism` to the test script.

---

## Commit #9 — `feat(auth): add Resend email service and email verification endpoint`

**Scope:** Real emails.

**What changed:**
- **Resend integration** (`server/src/config/email.ts`):
  - `sendEmail({ to, subject, html, text })` — returns boolean, logs errors, never throws (so a failed email doesn't roll back user creation).
- **Email template** (`emailTemplates/verifyEmail.ts`) — styled HTML + plain text fallback.
- **Barrel** (`emailTemplates/index.ts`).
- **Env additions:** `RESEND_API_KEY`, `EMAIL_FROM` — now required by Zod.
- **Signup service** now sends a real email with the verification URL.
- **Verify email service** (`verifyEmailUser`):
  - Looks up user by hashed token.
  - Checks expiry, clears stale tokens.
  - Idempotent (clicking twice is fine).
  - Clears token after success.
- **Verify email controller + route:** `POST /api/auth/verify-email`.
- 8 tests including expired tokens and single-use enforcement.

**Why:**
- **Fail-open on email** — if Resend is down, signup still succeeds. The user can request a resend later.
- **Single-use tokens** — after verification, the token is cleared from the DB.
- **Expired-token cleanup** — expired tokens are cleared on next use, preventing stale state.

---

## Commit #10 — `feat(auth): add login with JWT access/refresh tokens in httpOnly cookies`

**Scope:** Full login/logout + token rotation.

**What changed:**
- **JWT utilities** (`server/src/utils/jwt.ts`):
  - `signAccessToken(payload)` — 15-minute lifetime, HMAC-SHA256, separate secret.
  - `signRefreshToken(payload)` — 7-day lifetime, different secret.
  - `verifyAccessToken(token)` / `verifyRefreshToken(token)` — verify signature and enforce token type.
- **RefreshToken model** (`refreshToken.model.ts`):
  - Stores `userId`, `tokenHash` (SHA-256 of the JWT), `expiresAt`.
  - **TTL index** on `expiresAt` — MongoDB auto-deletes tokens after expiry.
- **Express type augmentation** (`server/src/types/express.d.ts`) — `req.user?: IUserDocument`.
- **Auth middleware** (`server/src/middleware/auth.ts`):
  - `protect` — requires `Authorization: Bearer ...`, verifies access token, attaches `req.user`.
  - `restrictTo(...roles)` — role-based access control.
- **Login service**:
  - Enumeration-resistant (same error message for unknown email or wrong password).
  - Timing-safe (dummy bcrypt compare for unknown emails).
  - Login lockout enforced (5 failures → 30-min lock).
  - Resets attempts on success.
- **Refresh service** — token rotation with **theft detection**: reusing a rotated token revokes ALL of a user's refresh tokens.
- **Logout service** — deletes the refresh token from DB.
- **Controllers** — `login`, `refresh`, `logout`, `me`.
- **Cookie config**: `httpOnly`, `secure` (in prod), `SameSite=Strict`, `path: /api/auth`, 7-day maxAge.
- **Routes:**
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me` (protected)
- 13 tests including lockout, rotation, and full flow.

**Why:**
- **Two tokens, two purposes** — access tokens are short-lived and stored in memory (XSS-safe); refresh tokens are long-lived and stored in httpOnly cookies (XSS can't read them, CSRF blocked by SameSite).
- **Rotation with theft detection** — if an old refresh token is reused, it means it was stolen. Revoke everything.
- **`protect` looks up the user every request** — ensures tokens don't carry stale role/permission data.

---

## Commit #11 — `feat(auth): add forgot password and reset password flow with email`

**Scope:** Password recovery.

**What changed:**
- **Zod schemas:**
  - `forgotPasswordSchema` — email only.
  - `resetPasswordSchema` — token (hex) + new password (same rules as signup).
- **Email template** (`forgotPassword.ts`) — red button, cautious tone, 30-minute expiry noted.
- **Forgot password service:**
  - Generates + stores hashed token (30-minute expiry).
  - **Silently returns success even if the email doesn't exist** — enumeration resistance.
  - Small `setTimeout` delay on the "not found" path to equalize timing.
- **Reset password service:**
  - Verifies hashed token, checks expiry.
  - Updates password (pre-save hook re-hashes).
  - Clears token fields.
  - **Resets login attempts and lockout** — successful reset unlocks the account.
  - **Revokes ALL refresh tokens** — forces re-login everywhere.
- **Controllers:**
  - `forgotPassword` — always returns the same message.
  - `resetPassword` — validates token, calls service.
- **Routes:**
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- 10 tests including full reset cycle (login with new password, fail with old), token reuse, lockout clearing, and revocation.

**Why:**
- **Enumeration resistance** — "If an account exists..." messaging is industry standard.
- **Token revocation on reset** — if an attacker had a session, resetting the password kicks them out.
- **Reusing `passwordSchema`** — one source of truth for password rules.

---

## Coming Next

- **Commit #12:** Redis integration (session store, rate limiting, caching).
- **Commit #13:** Rate limiting middleware.
- **Commit #14:** TOTP 2FA (Google Authenticator).
- **Commit #15:** Google OAuth (via Passport).
- **Commit #16:** Discord + Facebook OAuth.
- **Commit #17+:** Products, categories, cart, orders, Stripe, admin panel, analytics, live chat, tickets.

See the commit history on GitHub for the latest.