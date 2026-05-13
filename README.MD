# Odysway Dashboards

Secure internal dashboard platform for Odysway analytics. Authenticated Google OAuth gate
(`@odysway.com` only), static HTML dashboards in sandboxed iframes, and a server-side
proxy for live-data queries against a sanitized read-only replica of the production database.

---

## Architecture

```
Production Supabase (untouched)
        │
        │  webhook + nightly cron (separate task — see "Out of scope")
        ▼
Secondary Supabase (sanitized replica)
  - dashboard schema, views only, no base tables, no PII
  - dashboard_reader role: SELECT on dashboard.* only
  - audit_writer role:     INSERT on public.audit_log only
        │
        │  server-side queries only (never in the browser)
        ▼
dashboards.odysway.com  (this repo — Nuxt 4, Vercel)
  - Google OAuth gate, hd=odysway.com enforced server-side
  - Static HTML dashboards in sandboxed iframes
  - /api/query/* proxy for live-data dashboards
  - Strict CSP, audit log on every query
```

---

## Secrets policy

**Secrets live in Vercel environment variables only. They are never committed.**

- `.env.example` contains empty placeholders — the only `.env*` file allowed in the repo.
- `.env`, `.env.local`, and all other `.env.*` files are gitignored.
- If you accidentally commit a secret, rotate it immediately, then scrub it from git history.

### Required environment variables

| Variable | Description |
|---|---|
| `NUXT_SUPABASE_URL` | Secondary Supabase project URL |
| `NUXT_SUPABASE_DASHBOARD_KEY` | API key bound to `dashboard_reader` role |
| `NUXT_SUPABASE_AUDIT_KEY` | API key bound to `audit_writer` role |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID (hd=odysway.com) |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NUXT_SESSION_PASSWORD` | Session encryption key — min 32 chars. Generate: `openssl rand -base64 32` |

---

## Getting started

```bash
npm install
cp .env.example .env          # fill in values, never commit .env
npm run dev
```

---

## Adding a dashboard

### Static dashboard (no live queries)

1. Create `public/dashboards/your-slug.html`. Embed data inline as JSON.
2. Add an entry to `public/dashboards/_manifest.json` with `"live": false`.
3. Run `npm run lint:dashboards` — must pass with no violations.
4. Open a PR and merge.

**Prompt for Claude Code:**
```
Generate a static HTML dashboard using Chart.js from cdn.jsdelivr.net.
Embed all data inline as a JavaScript object — no external API calls, no fetch().
Use only script sources from cdn.jsdelivr.net or unpkg.com.
Do not use eval(), new Function(), or inline event handlers (onclick=, onerror=, etc.).
Do not hardcode any API keys, tokens, or credentials.
```

### Live-data dashboard (postMessage)

1. Create `public/dashboards/your-slug.html`. Use `postMessage` to query data (see below).
2. Add an entry to `_manifest.json` with `"live": true`.
3. Ensure the view you want to query is in `server/utils/allowed-views.ts`.
4. Run `npm run lint:dashboards` and open a PR.

**postMessage query pattern** (inside the iframe):

```javascript
// Request data from the authenticated parent
window.parent.postMessage(
  { type: 'query', view: 'reservations_summary', params: {}, requestId: '1' },
  '*'
);

// Receive the response
window.addEventListener('message', function(event) {
  if (event.data.type === 'query-result' && event.data.requestId === '1') {
    renderTable(event.data.data);
  }
  if (event.data.type === 'query-error') {
    showError(event.data.error);
  }
});
```

**Prompt for Claude Code:**
```
Generate a live HTML dashboard that fetches data via postMessage to the parent window.
Use this exact pattern to request data: window.parent.postMessage({type:'query', view:'<VIEW_NAME>', params:{}, requestId:'1'}, '*').
Listen for {type:'query-result', requestId:'1', data:[...]} to render the data.
Do not use fetch() or XMLHttpRequest directly. Do not include API keys or tokens.
```

---

## Adding a queryable view

1. Write the view in Supabase: it must live in the `dashboard` schema, expose no PII (no names,
   emails, payment refs), and use only aggregated data.
2. Add a migration file to `supabase/migrations/` following the existing numbering.
3. Add the view name to `server/utils/allowed-views.ts`.
4. Document the view schema in `docs/views.md` (create the file if it doesn't exist yet).
5. Open a PR.

---

## What dashboards cannot do

- Include secrets, tokens, or API keys of any kind.
- Make direct `fetch()` or `XMLHttpRequest` calls to external APIs (use postMessage instead).
- Use `eval()`, `new Function()`, or pass a string to `setTimeout`/`setInterval`.
- Render unsanitized user input.
- Reference external script/style sources not in the CSP allowlist (`cdn.jsdelivr.net`, `unpkg.com`).

The `npm run lint:dashboards` script enforces all of the above in CI.

---

## Threat model

| Threat | Mitigation |
|---|---|
| Non-Odysway Google account signs in | `hd` claim + email domain verified server-side; `hd` hint alone is not trusted |
| Compromised dashboard HTML exfiltrates data | Sandboxed iframe (`allow-scripts`, no `allow-same-origin`) — cannot read parent cookies, localStorage, or DOM |
| Dashboard queries arbitrary DB tables | Server-side view allowlist in `allowed-views.ts`; unknown views return 400 |
| Dashboard injects raw SQL via query params | Params validated with Zod; only `.eq()` equality filters applied via the ORM |
| Secrets committed to the repo | `.gitignore`, lint script pattern-matching, CI should run `trufflehog` or `git-secrets` |
| Dashboard iframe navigates the parent | `sandbox="allow-scripts"` without `allow-top-navigation` blocks this |

**Important:** Dashboard data is still sensitive even though it contains no direct PII.
Do not share dashboard URLs externally, and do not screenshot dashboards to public Slack channels.

---

## CI checklist

```yaml
# Add to your GitHub Actions workflow
- name: Lint dashboards
  run: npm run lint:dashboards

- name: Secret scan
  run: npx trufflehog filesystem . --only-verified
```

---

## Database migrations

Migrations in `supabase/migrations/` target the **secondary** Supabase project only.
This app does not run them automatically — apply them manually via the Supabase dashboard
SQL editor or the Supabase CLI:

```bash
supabase db push --db-url "postgresql://..."
```

| File | Purpose |
|---|---|
| `001_schema.sql` | Creates `dashboard` schema and initial views |
| `002_role.sql` | Creates `dashboard_reader` and `audit_writer` roles with minimal grants |
| `003_audit.sql` | Creates `public.audit_log` table with RLS |

---

## Out of scope

The following are separate tasks not built here:

- **Primary → secondary sync**: webhooks from the production Supabase for write events
  (sanitized in transit via an Edge Function or Cloudflare Worker) plus a nightly
  reconciliation cron. Build this separately before going live with live-data dashboards.
- **Creating real sanitized views**: the views in `001_schema.sql` are stubs — replace
  `public.reservations` with the actual production table names once the sync is in place.
- **Google OAuth credentials**: set up in Google Cloud Console with the authorized redirect
  URI `https://dashboards.odysway.com/api/auth/google`. Operator task.
- **Supabase secondary project provisioning**: create the project, run the migrations,
  generate role-bound API keys. Operator task.
