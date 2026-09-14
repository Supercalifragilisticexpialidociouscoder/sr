# Sri Ram Enterprises — Fleet & Financial Intelligence

The company sends a spreadsheet. This reads it, works out what it means, and
tells the owner whether the business made money — and which truck did or did
not.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
```

The loop the product is built around:

```
upload  →  understand  →  analyse  →  drill down  →  report
```

Nobody types in hundreds of records the company already sent.

## The three places

**Overview** is the home page and answers *how did the business do?* for one
period, chosen once at the top. Everything under it takes that answer apart:
which vehicle, which cost, which transaction. **Fleet** is the registry of
trucks and drivers. **Reports** is the monthly business report and the CSV
exports. Import sits beside them as the primary action, not as a module.

Complexity lives behind drill-downs, not on the first screen.

## Reading the spreadsheet

`src/data/excel/` is the part that has to be right, because everything
downstream depends on it. It assumes nothing about the file.

**It finds the table.** Company workbooks open with a title, a subtitle and a
blank line before the headers. The header row is the one whose cells match the
most known column names, so it is found by scoring rather than assumed to be
row 1.

**It works out what each sheet is** from the distinctive fields it carries and,
secondarily, the tab's name. Only a fuel sheet has litres; only an expense
sheet has a head of expenditure. A tab called `Sheet1` is classified just as
well as one called `Trip Register`.

**It maps columns by meaning, not position.** `Ltrs`, `Qty (Ltr)`, `Litres` and
`Fuel Qty` are the same field. Every header is scored against every candidate
and claimed best-first, so a strong match wins its column outright. The review
screen shows every decision and lets any of them be corrected — the counts
update as you change them.

**It reads values the way people type them.** `₹12,540`, `9,432`, `(450)` for a
credit, `120 ltr`. Dates arrive as text, as Excel serial numbers and as real
dates in the same column; ambiguous numeric dates are read day-first, because
that is the convention where this data is typed.

**It knows one truck from three.** `TS09AB1234`, `TS 09 AB 1234` and
`TS-09-AB-1234` collapse to one vehicle, stored canonically so it also *displays*
one way.

**It normalises the vocabulary.** `HSD`, `Diesel Fuel` and `Fuel` all mean
diesel. `Fast Tag`, `FASTag` and `FastTag` mean FASTag. `Ad-blue`, `AdBlue` and
`urea` mean AdBlue. `Puncher` means puncture.

**It reports what it could not read** instead of dropping it. A row with an
unreadable date or no vehicle is listed with its row number and its values, and
everything else still imports.

**It catches re-uploads.** A record is fingerprinted on date, vehicle, type and
amount. Importing the same file twice finds every row already held and imports
nothing, unless you deliberately choose otherwise.

### The accounting rule, enforced at the door

Each expense category has exactly one owning ledger:

| Category | Lives as |
|---|---|
| Diesel, AdBlue | a fuel record |
| Maintenance, tyres, puncture, repairs, parts | a maintenance record |
| Driver | a driver payment |
| FASTag, toll, insurance, documents, other | a direct expense |

An expense row is routed to its owning ledger *during import*. A `HSD` line in a
combined ledger becomes a fuel record; `Driver Batta` becomes a driver payment.
So it does not matter how the company organises its workbook — a rupee cannot
be counted twice, because it only ever enters the ledger through one door.

## Where the numbers come from

Every screen reads one reducer through the selectors, and every formula lives in
`calc.ts`. The overview total, the vehicle row, the monthly report footer and
the CSV are the same function called with different scopes — there is no second
calculation to drift.

- **Division is always guarded.** A ratio with a zero denominator returns `null`
  and renders as a dash, never `0` or `NaN`. Mileage needs two diesel fills at
  different odometer readings, so until then it says so rather than inventing a
  figure.
- **Only completed trips are financial.** In-transit work has not been earned
  and cancelled work never will be.
- **AdBlue is not diesel.** It is dosed into its own tank, so it is reported
  separately and excluded from mileage and rate-per-litre.
- **Insights are derived, never guessed.** The product will say a truck's cost
  per km rose 11%, because it can subtract. It will not say why. An observation
  the data cannot support is not shown.

Any figure can be opened: the expense breakdown drills into the transactions
that make it up, and each one links to the vehicle it belongs to.

## Deploying to Cloudflare Pages

Static build, no server, no third-party requests at runtime.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | from `.nvmrc` (22) |

`public/_redirects` hands every path to the app (without it any route but `/`
404s on refresh). `public/_headers` caches fingerprinted assets and the fonts
for a year, never caches `index.html`, and sets a content-security policy that
permits this origin only.

Pages builds the repository's default branch — point it at this branch, or merge
to `main` first.

### Before the team uses it

Records live in `localStorage`: one browser, one device. Once this is on a URL
the office laptop and a driver's phone keep separate copies and nothing syncs.
Fine for one person; for shared use it needs a backend, and Cloudflare D1 with a
Worker would fit — the schema is already relational and the calculations run
over plain record arrays.

## Design

IBM Plex Sans and Plex Mono, self-hosted at 84 KB. Identifiers and figures are
set in mono because they are read character by character or compared down a
column. One leading figure per view, with the ledger that qualifies it beside
it — there is no grid of metric cards anywhere. Sections are a tracked label, a
rule and the actions. Each vehicle carries a colour fixed by its place in the
fleet, worn by its spine in the sidebar, its row in the registry and its bar in
every chart.

Charts are hand-built SVG. The palette was validated with a colourblindness
checker: revenue against expenses is blue↔gold (CVD ΔE 25.7); green and red are
reserved for profit polarity, where the zero baseline carries the sign
positionally; ranked bars use one colour because their row labels carry
identity.

## Layout

| Width | Navigation | Records |
|---|---|---|
| ≥ 1024px | sidebar with the live fleet, search and the actions | tables |
| 768–1023 | top bar with inline sections | tables |
| < 768px | bottom tab bar; dialogs become bottom sheets | record cards |

Tables become cards rather than losing columns; long text wraps rather than
truncating. The monthly report prints landscape, because its vehicle table
carries fourteen columns.

## What was verified

The import engine is tested against three deliberately different workbooks — a
tidy multi-sheet export, a messy one with title rows and mixed formats and bad
rows, and a single combined ledger — asserting classification, column mapping,
vehicle and driver resolution, value parsing, category routing, issue reporting
and duplicate detection. The same three are then driven through the real UI.

Beyond that: the full upload-to-report loop in a browser, with every figure
tied back from the overview to the report footer; page overflow, gutter
breaches and minimum text size at 390 / 768 / 1440; focus trapping, focus
restoration and control labelling; and the production bundle served the way
Cloudflare Pages serves it.
