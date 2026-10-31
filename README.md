# Staff Movement Register

A web replacement for the office's paper movement register. Staff record when they step out
(Time Out) and when they are back (Time In); the boss sees who is out right now, reviews
entries, corrects mistakes with an audit trail, and prints or exports the register with the
same ten columns as the paper book:

| Sl. No. | Date | Name of Staff Member | Time Out | Purpose / Place of Visit | Permission Granted By | Time In | Total Time Away (in minutes) | Within 1-Hour Limit (Y/N) | Remarks |

Permission is still given verbally (v1). There are two roles: **staff** and **admin**.

```
movement-register/
├── api/   Hono on Cloudflare Workers + D1 (plain JavaScript)
│   ├── src/middleware   session check, admin guard, errors, rate limit
│   ├── src/routes       validate input, call one service, return JSON
│   ├── src/services     all business rules
│   ├── src/repo         all SQL (prepared statements)
│   ├── src/jobs         cron handlers
│   ├── src/lib          IST/UTC time, ADMIN_EMAILS, zod schemas, notify()
│   ├── migrations/      D1 schema
│   └── test/            Vitest
└── web/   React 19 + Vite, React Router, TanStack Query, Tailwind CSS v4, SheetJS
```

---

## Local setup (Windows, Git Bash)

Prerequisites: Node.js 22+, Git Bash, a Google account. In Git Bash, use `node.exe` instead of
`node` whenever you capture or redirect its output (`$(...)` or `>`).

### 1. Install

```bash
cd api && npm install && cd ..
cd web && npm install && cd ..
```

### 2. Create a Google OAuth client (once)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: configure it (Internal if
   you use Google Workspace, otherwise External and add yourself as a test user).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`
4. Copy the client ID and secret.

### 3. Configure the API

```bash
cp api/.dev.vars.example api/.dev.vars
node.exe -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # paste as JWT_SECRET
```

Edit `api/.dev.vars`: set `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and put your
own Google email in `ADMIN_EMAILS`. Keep `APP_URL=http://localhost:5173`.

### 4. Create the local database

```bash
cd api
npx wrangler d1 migrations apply movement-register-db --local
```

### 5. Run both servers (two terminals)

```bash
cd api && npx wrangler dev          # API on http://localhost:8787
cd web && npm run dev               # app on http://localhost:5173 (proxies /api to 8787)
```

### 6. Sign in

Open http://localhost:5173 and choose **Sign in with Google** with the email from `ADMIN_EMAILS`.
Your admin account is created automatically and you land on the admin dashboard. Add staff under
**Staff**; they can then sign in with their Google accounts. Nobody ever needs to run SQL.

> An admin must sign in once before staff can pick them under "Permission granted by".

### Tests and lint

```bash
cd api && npm test        # Vitest: services with fake repositories, plus repo SQL on the real migration
cd web && npm run lint
```

The SQL tests use Node's built-in `node:sqlite`, so they need Node 22.13 or newer.

### Trying the scheduled jobs locally

```bash
cd api && npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=*/10+3-12+*+*+1-6"   # overdue check
curl "http://localhost:8787/__scheduled?cron=0+12+*+*+1-6"        # end-of-day close
```

---

## How it behaves

- **Times.** Time Out and Time In always come from the server clock and are stored as UTC
  (`2026-10-31T07:13:57Z`). Everything is displayed in IST (`DD-MM-YYYY`, `hh:mm AM/PM`); date
  filters and the monthly report use IST calendar days.
- **Derived columns.** Minutes away and Y/N are computed in SQL, never stored, so a corrected Time In
  fixes both. Minutes are whole minutes; exactly the limit (60) is `Y`.
- **One open movement per person**, enforced in the service and by a partial unique index.
- **Admins** come only from `ADMIN_EMAILS`, checked on every request. The `role` column is kept in
  sync for display. Admin rows are created on first sign-in and are read-only on the Staff screen.
- **Corrections** require a reason, write one audit row per changed field in the same D1 batch,
  and send the entry back to `pending` review.
- **Overdue check** (every 10 minutes, 08:30–18:20 IST, Mon–Sat): open entries older than
  time limit + grace get the remark `Exceeded time limit`, once.
- **End-of-day close** (17:30 IST, Mon–Sat): entries still open that started before the office
  close time get `Time In not recorded`. Time In stays empty and the owner can no longer fill it in;
  the entry appears in the review queue for the admin to correct. The same applies to an entry
  left open from an earlier day.
- **Office close time** in Settings sets the cut-off used by the end-of-day job. The job itself runs
  at the cron time in `api/wrangler.jsonc` (17:30 IST); change that too if the office closes later.
- **Notifications** are in-app only (badges on the admin nav). `api/src/lib/notify.js` is the single
  hook for adding email or WhatsApp later.

Optional: set `VITE_OFFICE_NAME` (e.g. in `web/.env.local`) to put the office name in the printed
register's header.

---

## Production deployment (Cloudflare)

The app (Cloudflare Pages) and the API (Worker) must be served from **the same domain**, with
`/api/*` routed to the Worker, so the session cookie stays first-party. The example below uses
`movements.example.com` on a zone you manage in Cloudflare.

1. **Database schema** (once, then after every new migration):

   ```bash
   cd api
   npx wrangler d1 migrations apply movement-register-db --remote
   ```

   After this, never edit an applied migration; add a new numbered file instead.

2. **Secrets:**

   ```bash
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put ADMIN_EMAILS
   ```

3. **Non-secret vars:** in `api/wrangler.jsonc` set `vars.APP_URL` to `https://movements.example.com`,
   `vars.GOOGLE_CLIENT_ID`, and optionally `vars.ALLOWED_DOMAIN`.

4. **Route `/api/*` to the Worker:** add to `api/wrangler.jsonc`:

   ```jsonc
   "routes": [{ "pattern": "movements.example.com/api/*", "zone_name": "example.com" }]
   ```

   (Alternative: a Pages Function at `web/functions/api/[[path]].js` that forwards to the Worker
   through a service binding.)

5. **Deploy the Worker** (this also registers the cron triggers):

   ```bash
   cd api && npm run deploy
   ```

6. **Deploy the web app to Pages:**

   ```bash
   cd web && npm run build
   npx wrangler pages deploy dist --project-name movement-register
   ```

   Then add `movements.example.com` as a custom domain of the Pages project. Pages serves
   `index.html` for unknown paths, so client-side routes such as `/admin/register` work.

7. **Google Cloud Console:** add the production redirect URI
   `https://movements.example.com/api/auth/google/callback` to the OAuth client, and publish the
   consent screen (or set it to Internal for a Workspace domain).

In production the session cookie is marked `Secure` automatically because `APP_URL` starts with
`https://`, and CORS is disabled (same origin).
