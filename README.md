# Sri Ram Enterprises — Fleet & Financial Operations

A fleet and financial operations system for a transport business running out of
Telangana. It replaces the notebooks and spreadsheets used to track what each
truck did, what it earned, what it cost, and whether it is actually making
money.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
```

The app starts from the operator's own records — three vehicles, three drivers
and the September entries — imported in `src/data/initial.ts`. **Clear all
records** in the sidebar empties it; the same control restores the import once
the database is empty. Records live in `localStorage` on the device.

## Deploying to Cloudflare Pages

It is a static build with no server, no API and no third-party requests, so
Pages serves it as-is.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | read from `.nvmrc` (22) |
| Root directory | `/` |

Two files in `public/` do the deployment work and are copied into `dist/`:

- **`_redirects`** — `/* /index.html 200`. Without it every route except `/`
  returns 404 on refresh or when someone opens a shared link, because Pages
  looks for a file at that path. Real files under `/assets` and `/fonts` are
  matched before the rule is consulted.
- **`_headers`** — fingerprinted assets and the fonts are cached for a year and
  `index.html` is not cached at all, so a deploy takes effect immediately
  instead of leaving people on the old bundle. It also sets `nosniff`, a
  referrer policy, and a content-security policy that allows nothing but this
  origin — the app loads no scripts, fonts or styles from anywhere else.

**Production branch.** Pages tracks the repository's default branch. This work
is on `claude/youthful-brown-g75t8e`, so either merge it into `main` first, or
set that branch as the production branch under *Settings → Builds & deployments*.

### One thing to decide before the team uses it

Records are kept in `localStorage`, which belongs to one browser on one device.
Once this is on a URL, the office laptop and a driver's phone will each keep
their own separate copy — nothing syncs between them, and clearing browser data
loses that copy. That is fine for one person on one machine. For shared use it
needs a backend; Cloudflare D1 with a Worker would fit this data model closely,
since the schema is already relational and the calculations already run over
plain record arrays.

## The import

Source rows keep their original ids so a later sync can match them. Three
mapping decisions are worth knowing:

| Source | Here | Why |
|---|---|---|
| `expenses` row with category `Puncture` | a **maintenance** record | Punctures belong to the maintenance ledger (see below). It reaches the expense ledger once either way, and this keeps it out of the table where it could be entered twice. |
| `driver_payments` type `Salary`, note `Advance` | kept as **Salary** | Reinterpreting a money record is not the import's job. It is one click to change on the driver's page. |
| model year, tank capacity, licence expiry, two odometers | **left unset** | The source did not carry them, so the product reports them as unrecorded rather than inventing a zero. |

Everything the model treats as optional is optional for a reason: real records
arrive incomplete, and a fleet system that demands a licence expiry before it
will save a driver is a fleet system nobody uses.

## Architecture

```
src/
  data/        the whole domain — model, calculations, state, exports
    types.ts       seven entities + the accounting authority
    calc.ts        every business formula in the product
    selectors.ts   derived views (never stored)
    store.tsx      one reducer, one source of truth
    alerts.ts      operational warnings
    reports.ts     report tables + CSV serialisation
    initial.ts     the imported records
    format.ts      ₹, Indian digit grouping, plates, dates
  ui/          the design system — controls, dialogs, tables, charts
  shell/       app shell and the three navigation treatments
  features/    pages, composed from ui/ and data/
  styles/      tokens → base → components
```

### One source of truth

Every screen reads one reducer through the selectors. Nothing keeps a private
copy of a number, so logging a trip updates the vehicle, the fleet registry,
analytics and the reports in the same render. The fleet total and the analytics
headline call the same function, and an end-to-end test asserts they agree.

### Every formula in one place

`calc.ts` owns freight, fuel cost, revenue, expenses, profit and the ratios.
Two rules hold throughout:

- **Division is always guarded.** A ratio with a zero or missing denominator
  returns `null` and renders as a dash, never `0`, `NaN` or `∞`. Mileage needs
  two fills at different odometers before it means anything, so until then it
  says so.
- **Only completed trips are financial.** In-transit work has not been earned
  and cancelled work never will be.

### Double counting is structurally impossible

Each expense category has exactly one owning record type (`CATEGORY_SOURCE`):

| Category | Entered as |
|---|---|
| Diesel | a fuel entry |
| Service, tyres, puncture, repairs, parts | a maintenance record |
| Driver payment | a driver payment |
| FASTag, toll, insurance, permit, other | a direct expense |

`buildLedger()` normalises all four sources into one ledger, and the Add Expense
form offers only the categories it owns, routing the rest to their own form. A
diesel fill exists once and reaches the ledger once. The vehicle's Expenses tab
still shows everything in one list, tagged with where it came from.

Driver payments allocate to the driver's assigned vehicle; a payment to an
unassigned driver belongs to no truck but is still a real cost, so fleet totals
are computed business-wide and the difference is shown rather than hidden.

### Driver accounts

Pending pay is `salary earned − salary paid − advances`. Batta is an allowance
paid in full per trip, not an advance, so it does not reduce what is owed.
Accrual starts when payment records begin rather than at the joining date —
otherwise a driver who joined in 2025 but whose payments start in 2026 would
appear to be owed twenty months of back pay that was settled long ago.

## Design

The product is an instrument for running trucks, so it is built like one rather
than like a dashboard.

- **IBM Plex Sans and Plex Mono**, self-hosted (80 KB, no runtime request).
  Every identifier and every figure — plates, licence numbers, odometers, money
  — is set in mono, because those are read character by character or compared
  down a column.
- **One leading figure per view.** The readout puts the bottom line at 46px
  beside a ledger of the numbers that qualify it. There is no grid of metric
  cards anywhere in the product.
- **Sections are a tracked label, a rule, and the actions.** No bold heading
  over a paragraph explaining what the section is; the content does that.
- **Each vehicle has a colour**, fixed by its place in the fleet, worn by its
  spine in the sidebar, its row in the registry and its bar in every chart.

Charts are hand-built SVG. The palette was validated with a colourblindness
checker rather than chosen by eye: revenue vs expenses is blue↔gold (CVD ΔE
25.7), green and red are reserved for profit polarity where the zero baseline
carries the sign positionally, and ranked bars use one colour because their row
labels carry identity. Every chart has a tooltip and a table view.

## Responsive

Three deliberate layouts, not one squeezed down:

| Width | Navigation | Records |
|---|---|---|
| ≥ 1024px | sidebar with the live fleet and the quick actions | tables |
| 768–1023 | top bar with inline sections | tables |
| < 768px | bottom tab bar; dialogs become bottom sheets | record cards |

Tables become cards rather than losing columns, and a card wraps long text to
two lines rather than truncating it. Verified with automated passes at 390 /
768 / 1440 for page overflow, gutter breaches and minimum text size; end to end
for data flowing from a logged trip to the CSV export; and for focus trapping,
focus restoration and control labelling.
