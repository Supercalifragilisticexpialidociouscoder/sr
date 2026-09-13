# Sri Ram Enterprises — Fleet & Financial Operations

A fleet and financial operations system for a transport business. It replaces the
notebooks and spreadsheets used to track what each vehicle did, what it earned,
what it cost, and whether it is actually making money.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
```

The app opens with a seeded demo fleet of three vehicles and roughly nine months
of trips, diesel, expenses, maintenance and driver payments, so it can be judged
with real data in it. **Clear all records** in the sidebar empties it to start
real use; the same control restores the demo fleet once the database is empty.
Records live in `localStorage` on the device.

## Architecture

```
src/
  data/        the entire domain — model, calculations, state, exports
    types.ts       seven stored entities + the accounting authority
    calc.ts        every business formula in the product
    selectors.ts   derived views (never stored)
    store.tsx      one reducer, one source of truth
    alerts.ts      operational warnings
    reports.ts     report tables + CSV serialisation
    seed.ts        deterministic demo data
    format.ts      ₹, Indian digit grouping, dates
  ui/          the design system — controls, dialogs, tables, charts
  shell/       app shell and the three navigation treatments
  features/    pages, composed from ui/ and data/
  styles/      tokens → base → components
```

### One source of truth

Every screen reads from one reducer through the selectors in `selectors.ts`.
Nothing keeps a private copy of a number, so logging a trip updates the vehicle,
the fleet registry, analytics and the reports in the same render. The fleet
totals and the analytics headline call the same function, and an end-to-end test
asserts they agree.

### Every formula in one place

`calc.ts` owns freight, fuel cost, revenue, expenses, profit and all the ratios.
Two rules hold throughout:

- **Division is always guarded.** A ratio with a zero or missing denominator
  returns `null`, which the UI renders as an explicit dash rather than `0`,
  `NaN` or `∞`. A vehicle with costs but no completed kilometres shows "—" for
  cost per km, because that figure is genuinely unknowable.
- **Only completed trips are financial.** In-transit work has not been earned
  and cancelled work never will be, so neither contributes to revenue,
  kilometres or tonnage.

### Double counting is structurally impossible

This was the central modelling decision. Each expense category has exactly one
owning record type (`CATEGORY_SOURCE` in `types.ts`):

| Category | Entered as |
|---|---|
| Diesel | a fuel entry |
| Service, tyres, puncture, repairs, parts | a maintenance record |
| Driver payment | a driver payment |
| FASTag, toll, insurance, permit, other | a direct expense |

`buildLedger()` normalises all four sources into one ledger, and the Add Expense
form offers only the categories it owns — the others are routed to their own
form. A diesel fill therefore exists once and reaches the ledger once. The
vehicle's Expenses tab still shows everything in one list, tagged with where it
came from. FASTag recharges represent tag-paid tolls and the `toll` category is
for cash tolls, so those cannot overlap either.

A driver payment is allocated to the driver's assigned vehicle; a payment to an
unassigned driver belongs to no truck but is still a real cost, so fleet totals
are computed business-wide and the difference is shown rather than hidden.

### Driver accounts

Pending pay is `salary earned − salary paid − advances`. Batta is an allowance
paid in full per trip, not an advance, so it does not reduce what is owed.
Accrual starts when payment records begin rather than at the joining date —
otherwise adding a driver who joined four years ago would invent several lakh of
liability on their first day.

## Design system

Tokens in `styles/tokens.css` define every colour, space, radius, control height
and type step; no component hard-codes a value. Near-black planes, hairline
borders, gold for primary actions, green and red reserved for financial
polarity.

Charts are hand-built SVG so the marks obey the same tokens as everything else.
The palette was validated with a colourblindness checker rather than chosen by
eye: the revenue/expense pair is blue↔gold (CVD ΔE 25.7), green/red is reserved
for profit polarity where the zero baseline carries the sign positionally, and
expense categories use a single-hue ramp with the row label carrying identity.
Every chart has a hover tooltip and a "show the numbers" table.

## Responsive

Three deliberate layouts, not one squeezed down:

| Width | Navigation | Records |
|---|---|---|
| ≥ 1024px | persistent sidebar, quick actions always visible | tables |
| 768–1023 | top bar with inline sections | tables |
| < 768px | bottom tab bar; dialogs become bottom sheets | record cards |

Tables become cards rather than losing columns, and a card wraps long text to
two lines rather than truncating it. Wide report previews scroll inside their
own container. Verified with an automated pass at 390 / 768 / 1440 that checks
page overflow, gutter breaches and minimum text size on every page.
