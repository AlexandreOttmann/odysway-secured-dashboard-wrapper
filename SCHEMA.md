# Odysway Dashboard — Schema Reference & Dashboard Authoring Guide

This document is the single reference for building live dashboard HTML files on the Odysway analytics platform. It covers the database schema, the business logic definitions, and the exact API you must use to query data from a dashboard.

---

## How dashboards work

Dashboards are standalone HTML files dropped into `public/dashboards/`. They run inside a sandboxed `<iframe>` and communicate with the server via `postMessage`. **You never call the database directly** — you call the `query()` helper below, which forwards the request to the server, which queries Supabase.

All aggregation, filtering, and rendering logic lives in the dashboard's own JavaScript.

### The `query()` helper — copy this verbatim into every dashboard

```html
<script>
const _pending = {};
let _nextId = 0;
function query(view, body) {
  return new Promise((resolve, reject) => {
    const id = String(++_nextId);
    _pending[id] = { resolve, reject };
    setTimeout(() => { if (_pending[id]) { delete _pending[id]; reject(new Error('timeout')); } }, 30000);
    window.parent.postMessage({ type: 'query', view, body: body || {}, requestId: id }, '*');
  });
}
window.addEventListener('message', e => {
  const { type, requestId, data, error } = e.data || {};
  if (type !== 'query-result' && type !== 'query-error') return;
  const p = _pending[requestId]; if (!p) return; delete _pending[requestId];
  if (type === 'query-result') p.resolve(data); else p.reject(new Error(error || 'query failed'));
});
</script>
```

### Request shape

```js
const rows = await query('table_name', {
  select:  ['col1', 'col2'],          // optional — omit for all columns
  filters: {
    col: { eq: value },               // equal
    col: { in: [v1, v2] },            // in list
    col: { gte: value, lte: value },  // range (gte, gt, lte, lt)
    col: { is: null },                // IS NULL / IS TRUE / IS FALSE
  },
  order:  { column: 'col', ascending: false },  // optional
  limit:  5000,                       // optional, max 20 000
});
```

- Returns a flat array of row objects. The server transparently paginates Supabase if needed — just set `limit` to whatever total you need.
- Only tables listed in the platform's allowlist are queryable. Current allowlist: `activecampaign_deals`, `activecampaign_clients`.

### Registering a new dashboard

Add an entry to `public/dashboards/_manifest.json`:

```json
{ "slug": "my-dashboard", "title": "My Dashboard", "description": "...", "file": "my-dashboard.html", "live": true }
```

Then open `/d/my-dashboard` in the app. No server code required.

---

## Conventions

- **Language**: all business data is in French. Status values, pipeline names, lost reasons, etc. are French strings.
- **Money**: all monetary columns are in **EUR**, stored as decimal numbers (e.g. `1872.51`), never cents.
- **Dates**: `created_at`, `updated_at`, `mdate` are `timestamptz` (UTC). `departure_date`, `return_date` are `date` (no time component).
- **NULLs**: mirror tables preserve NULL when the source CRM has no value. Always guard with `|| 0`, `?? ''`, `COALESCE`, etc.
- **Test deals**: pre-filtered at ingestion — you will not see test contacts in `activecampaign_deals`.

---

## Pipeline logic — the most important concept

`pipeline_id` is the primary segmentation axis for deals. Understand this before writing any dashboard.

| `pipeline_id` | `pipeline_title` | Meaning |
|---|---|---|
| `1` | Prospects | Prospects pipeline. A deal here represents a traveler who has expressed interest (quote request, contact form, etc.) but has not yet paid. |
| `2` | Voyageurs | Converted client pipeline. A deal moves here when the client makes their **first payment**. This is the authoritative signal for a conversion. |
| `3` | Corbeille | Trash / archived. Exclude from all reports. |
| `4` | Gestions Départs | Operational departure management. **Not replicated — these deals do not exist in this database.** |

**Key rules for metrics:**

- **Lead** = Sum of deals in `pipeline_id = 1` and `pipeline_id = 2`, this definition might change depending on user input.
-**Prospect** = client enter their email on the odysway website and get registered as potentiel buyer.
- **Converti** **Traveler** **Voyageur** (conversion) = `pipeline_id = 2`, attributed by `COALESCE(conversion_date, created_at)`.
  - `conversion_date` is the timestamp when the deal moved to pipeline 2. Use it for revenue cohorts. Fall back to `created_at` only when `conversion_date` is NULL.
  - A pipeline-2 deal can have `status = 'Perdu'` — this means the client paid but subsequently cancelled. Include these in conversion counts; exclude them from revenue sums unless you specifically want refund analysis.
- **Revenue / margin**: filter `pipeline_id = 2` (or equivalently `status = 'Gagné'`) and sum `total_value` / `total_margin`.
- **Taux de conversion**: `count(pipeline_id = 2) / count(pipeline_id = 1)` for the same voyage and period.

**Standard period definitions** (use these consistently across dashboards):

| Label | Date range |
|---|---|
| `2025` | `2025-01-01` ≤ date `< 2026-01-01` |
| `2026 YTD` | `2026-01-01` ≤ date ≤ today |
| `Rolling 365` | today − 365 days ≤ date ≤ today |
| `All` | `2025-01-01` ≤ date ≤ today |

---

## `public.activecampaign_deals`

A row per CRM deal. Source of truth for revenue, margin, conversions, and acquisition channels.

| Column | Type | Description |
|---|---|---|
| `id` | bigint | Deal ID. Part of composite PK with `contact`. |
| `contact` | bigint | FK to `activecampaign_clients.contact`. |
| `title` | varchar | Deal title (usually voyage name + traveler name). |
| `status` | varchar | `'Ouvert'`, `'Gagné'`, `'Perdu'`, `'Supprimé'`. |
| `stage` | varchar | Sales stage name (free-form). |
| `stage_id` | text | AC stage numeric id. |
| `pipeline_id` | smallint | See pipeline logic above. |
| `pipeline_title` | varchar | Human-readable pipeline name (e.g. `'Prospects'`, `'Voyageurs'`). Use `pipeline_id` for filtering; use `pipeline_title` for display. |
| `owner_id` | text | AC owner id (sales rep). |
| `seller` | varchar | Display name of sales rep (e.g. `'Jean Dupont'`). |
| `currency` | text | Usually `'eur'`. |
| `win_probability` | smallint | 0–100. Set by AC. |
| `total_value` | numeric | Total deal value in EUR. |
| `price_per_traveler` | numeric | Base price per traveler. |
| `deposit_price` | numeric | Down-payment amount per traveler. |
| `indiv_room_price` | numeric | Single-room supplement per traveler. |
| `extension_price` | numeric | Optional extension per traveler. |
| `flight_ticket_price_per_traveler` | numeric | Flight cost per traveler. |
| `insurance_price_per_traveler` | numeric | Insurance cost per traveler. |
| `insurance_commission` | numeric | Commission earned on insurance. |
| `agent_cost` | numeric | Local agent purchase cost. Subtract from total to get true margin. |
| `nb_traveler` | numeric | Total travelers on the deal. |
| `nb_adults`, `nb_children`, `nb_teen`, `nb_under_age` | numeric | Demographic breakdown. |
| `applied_promo_per_traveler` | numeric | Promo applied per traveler. |
| `children_promo`, `promo_earlybird`, `promo_last_minute` | numeric | Promotion amounts. |
| `got_earlybird`, `got_last_minute` | boolean | Whether the promo was actually applied. |
| `promo_code` | varchar | Code used at checkout. |
| `total_paid` | numeric | Amount already paid by the customer. |
| `rest_to_pay` | numeric | Outstanding balance. |
| `rest_to_pay_per_traveler` | numeric | Per-pax outstanding. |
| `margin_per_traveler` | numeric | Margin per traveler. |
| `flight_margin` | numeric | Margin on the flight portion. |
| `total_margin` | numeric | Total deal margin in EUR. |
| `travel_type` | varchar | `'Voyage de Groupe'`, `'Voyage Individuel'`, etc. |
| `country` | varchar | Destination country (label). |
| `iso` | varchar | ISO country code (e.g. `'PE'`, `'JP'`). |
| `slug` | text | Voyage slug — the logical identifier for a voyage product. Groups all deals for the same trip. |
| `current_step` | text | Funnel step at last update. |
| `is_couple` | boolean | Couple booking flag. |
| `indiv_room` | boolean | Single room requested. |
| `is_cap_exploraction` | boolean | Premium insurance product chosen. |
| `include_flight` | boolean | Flight included in the package. |
| `flight_ticket_bought` | boolean | Operational: tickets purchased? |
| `insurance_choice` | varchar | Free-form insurance label. |
| `source` | varchar | Free-form source (legacy). |
| `acquisition_source` | text | Structured acquisition source. Prefer this over `source`. |
| `other_acquisition_source` | text | Free-form fallback when `acquisition_source` is "Autre". |
| `utm` | text | Raw UTM string. |
| `paiement_method` | varchar | Payment method label. |
| `lost_reason` | varchar | Set when `status = 'Perdu'`. |
| `departure_date`, `return_date` | timestamp | Travel dates. |
| `forecasted_closing_date` | timestamp | Sales forecast date. |
| `conversion_date` | timestamp | When the deal moved to pipeline 2 ("Gagné"). **Use for revenue cohorts.** |
| `created_at` | timestamptz | Deal creation time. |
| `mdate` | timestamptz | Last modification time (source CRM). |
| `updated_at` | timestamptz | Mirror-side last-updated timestamp. |

---

## `public.activecampaign_clients`

A row per CRM contact (customer). Contains PII — use with care.

| Column | Type | Description |
|---|---|---|
| `id` | bigint | Internal id. Part of composite PK with `email`. |
| `contact` | bigint | AC contact id. **Join to `activecampaign_deals.contact` on this column.** Has UNIQUE constraint. |
| `email` | varchar | Email address. |
| `firstname`, `lastname` | varchar | Names. |
| `phone` | text | Phone number. |
| `birthdate` | timestamp | Date of birth. |
| `city`, `zip_code`, `address` | varchar/bigint/text | Postal info (often partial). |
| `iso_contact` | text | Client's country ISO. |
| `tags` | text[] | AC tag labels assigned to the contact. |
| `optin_newsletter` | boolean | Newsletter subscription flag. |
| `created_at`, `mdate`, `updated_at` | timestamptz | Timestamps. |

---

## `public.travel_dates`

Departure slots for each voyage. One row per (voyage, departure date).

| Column | Type | Description |
|---|---|---|
| `id` | uuid | PK. |
| `travel_slug` | varchar | Voyage slug — joins to `activecampaign_deals.slug` logically. |
| `departure_date`, `return_date` | date | Travel dates. |
| `min_travelers`, `max_travelers` | int | Capacity bounds. |
| `booked_seat` | int | Actual booked seats. |
| `starting_price`, `flight_price` | numeric | Display prices. |
| `include_flight`, `early_bird`, `last_minute`, `is_custom_travel`, `is_indiv_travel` | boolean | Flags. |
| `published` | boolean | Visible on the website. |
| `status` | text | `'open'`, `'guaranteed'`, `'cancelled'`, etc. |
| `closing_days` | bigint | Days before departure when booking closes. |
| `deleted`, `is_test` | boolean | **Always filter these out**: `deleted = false AND is_test = false`. |
| `created_at`, `updated_at` | timestamptz | Timestamps. |

---

## `public.booked_dates`

One row per booking (deal ↔ departure).

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Part of composite PK with `deal_id`. |
| `deal_id` | bigint | UNIQUE. Joins to `activecampaign_deals.id`. |
| `travel_date_id` | uuid | Joins to `travel_dates.id`. |
| `booked_places` | bigint | Seats consumed by this booking. |
| `payment_type` | text | `'deposit'`, `'full'`, `'balance'`, `'custom'`. |
| `transaction_id` | text | Stripe or Alma transaction id. |
| `is_option` | boolean | Reservation option (not yet paid). |
| `expiracy_date` | date | Option expiry date. |
| `deleted`, `is_test` | boolean | **Always filter these out.** |
| `created_at` | timestamptz | Booking creation time. |

---

## Logical relationships

```
activecampaign_clients (contact)
   └──< activecampaign_deals (contact)       ← pipeline 1 = prospect, pipeline 2 = converted
            └──< booked_dates (deal_id)
                       └── travel_dates (travel_date_id)

activecampaign_deals.slug  ──→  travel_dates.travel_slug
```

No foreign keys are enforced on the mirror (replication-safe). Join on the column names above.

---

## Dashboard authoring — worked example

```js
// Fetch all deals for the prospect/conversions analysis (pipeline 1 + 2)
const deals = await query('activecampaign_deals', {
  select: ['slug', 'pipeline_id', 'pipeline_title', 'status',
           'created_at', 'conversion_date', 'total_margin', 'nb_traveler'],
  filters: { pipeline_id: { in: [1, 2] } },
  limit: 20000,
});

const today = new Date();
const y2025 = { s: new Date('2025-01-01'), e: new Date('2026-01-01') };
const y2026 = { s: new Date('2026-01-01'), e: new Date(today.getTime() + 86400000) };

function inRange(dateStr, s, e) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= s && d < e;
}

// Prospect: pipeline 1, attributed by created_at
const prospects2025 = deals.filter(d => d.pipeline_id === 1 && inRange(d.created_at, y2025.s, y2025.e));

// Convertis: pipeline 2, attributed by COALESCE(conversion_date, created_at)
const conv2025  = deals.filter(d => d.pipeline_id === 2 && inRange(d.conversion_date || d.created_at, y2025.s, y2025.e));
const marge2025 = conv2025.reduce((sum, d) => sum + (d.total_margin || 0), 0);
```

---

## Tips

- **Status values are French**: `'Gagné'`, `'Perdu'`, `'Ouvert'`, `'Supprimé'`. Never use English equivalents.
- **Acquisition source**: prefer `acquisition_source` over `source` (legacy free-form). Fallback: `acquisition_source || source || 'unknown'`.
- **Margins vs revenue**: `total_margin` = net margin after agent costs. `total_value` = gross revenue. Use the appropriate one for your KPI.
- **Filter test/deleted rows** on `travel_dates` and `booked_dates`: `deleted = false AND is_test = false`. Not needed on `activecampaign_deals` (pre-filtered at ingestion).
- **Pipeline 4** (Gestions Départs) does not exist in this database.
- **NULL guards**: always treat numeric columns as potentially NULL — use `|| 0` in JS or `COALESCE` in SQL.
