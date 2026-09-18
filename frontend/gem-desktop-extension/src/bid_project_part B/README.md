# Current GeM scans (3.63.9)

The valid-save contract now applies to all three scan types. Bid To Be
Participated validates the Indian calendar-day window, active End Date,
120-day limit, supported product type, and payload fields in the API before
writing; its progress separates new, refreshed, and API-rejected records.
Awarded Bid/RA accepts only complete awarded rows with Start/End Dates in the
visible 2026 report range and likewise reports new versus refreshed records.
The awarded dashboard refreshes every ten seconds while visible. Legacy rows
which cannot appear in their corresponding frontend report are removed.

# Three-day opportunity page cutoff (3.64.1)

Bid To Be Participated enforces Bid Start Date: Latest First. Once the scan
reaches the first card older than the inclusive current-day-minus-three-days
window, it stops immediately and does not open that bid or any later page.
Cards with no visible Start Date are still opened for PDF fallback validation.

# Opportunity category allowlist (3.64.0)

Bid To Be Participated now accepts only Entry/Mid Desktop, High End Desktop,
All in One PC (V2), Fixed Computer Workstation, Toner/Ink Cartridges, and A4
and Legal Size MFP. PAC Only is rejected. For a bunch bid, every category must
be on this allowlist; A3 printers, UPS, scanners, laptops, projectors, and all
other mixed categories reject the complete bid.

# Previous disqualified alignment (3.63.8)

Disqualified Bid Tracking now uses the same one-calendar-month retention rule
in the extension, API, database, and dashboard. Old, future, or undated
disqualification records are rejected before a database write and are no longer
included in the extension's saved count. Progress separately reports new,
refreshed, and not-saved rows, so its valid count matches what the dashboard can
display.

# Previous opportunity scan (3.63.7)

Bid To Be Participated now reads the current Start Date from each GeM seller-list
card and uses the PDF Dated value only as a fallback. This covers valid PDFs whose
Dated line is not extractable and also preserves corrigendum-updated start dates.
Eligible opportunities are saved immediately after each bid is read, so pausing or
stopping in the middle of a page does not discard that page's completed work. The
popup's checked count is now preserved while a bid is opened and when the scan is
paused, stopped, or completed. Bid Offer Validity above 120 days remains rejected.

# Previous awarded Bid/RA scan (3.63.6)

The selected, already-filtered GeM seller-list tab itself is now moved into the
minimized worker window before any result control is clicked. This prevents a
GeM `window.open` child from ever being created in the user's working Chrome
window. The list tab is moved back to its original window and position without
activation when the scan ends.

Awarded result documents are now isolated in one unfocused, minimized worker
window. Direct result URLs are created there, and delayed GeM `window.open`
children are immediately adopted and moved there even when their opener is the
user-selected seller-list tab. The user's main Chrome window and Acxxel tab stay
in the foreground while worker tabs are read and closed.

Failed, stopped, and authentication-required popup messages now expire after
15 seconds. Their stored state is cleared and the relevant section returns to a
clean ready-to-scan message, while running and successful scan status remains
available normally.

Scripted GeM result buttons can create an active child tab even when the scan is
running from a background seller-list tab. The scanner now remembers the user's
current foreground tab immediately before each result click and restores that
tab (and its window) as soon as GeM creates the child. Result tabs continue to
be read and closed in the background.

The extension popup no longer exposes Start Date or Last Page filter controls.
Awarded scans keep the required fixed bounds internally: Start Date 01/01/2026
or later, through page 65. Date filtering for saved results belongs to the
dashboard report.

Part B now starts from the `Bid/RA Awarded` seller-list filter and queues every
awarded card, including bids where LAPS N TABS is Qualified, Not Evaluated,
Non-Qualified, Disqualified, or not listed. It no longer requires a card-level
`Technical Status: Qualified` label.

Because GeM does not serialize the Awarded selection into copied-tab URLs and
keeps the checkbox disabled there, the scan paginates the user's already-filtered
seller-list tab directly. Result pages still open in tracked background tabs; the
selected seller-list tab is never closed by the scanner.

When available, `View Bid Results` supplies each seller's evaluation status and
`View RA Results` supplies final prices and published L1/L2/L3 ranks. The two
results are merged by normalized seller name. The API stores seller statuses and
the dashboard displays all awarded records plus the LAPS N TABS status. Migration
0058 expands the saved status values. Run it before using this build.

---
# Historical pagination alignment (3.50.9)

Part B now uses the existing acxxel-gem-click-control MAIN-world bridge from
Part A for Next and RA-result controls, including its Angular/jQuery handling and
single-click behavior. mainPaginationNextState discovery/scoring was ported from
gem-bid-sync.js into the isolated Part B module. Part A files are unchanged.

The dedicated list tab is created at #page-1 from the start. Page fingerprints
use rendered RA bid cards instead of arbitrary whole-document IDs. Navigation
waits 15 seconds, then 30 seconds for a late response before retrying the click;
it finally applies the existing hash bounce recovery and waits 20 seconds.
Retries are bounded so a stalled scan remains stoppable and reports incomplete.
This follows the existing scanner's approach with a bounded recovery limit.

27 tests pass, including MAIN bridge clicks and delayed-page responses without
double navigation. Reload extension 3.50.9 and refresh the GeM source tab before
retrying. Live GeM validation remains outstanding; no release is published.

---
# Current fix (3.50.7)

Filter restoration now scopes controls to the Financial Evaluated sidebar and
matches normalized visible labels instead of dynamic input IDs. Bid-row selection
controls are excluded. Desired radio options are selected first; unchecked radios
are never clicked to clear them. Pagination compares selected filter keys rather
than full DOM order. Restoration waits up to 60 seconds and records the exact
missing/disabled filter or login redirect in Copy status.

21 tests pass, including changed IDs, unrelated checkboxes, and radio selection.
The reported live GeM failure still needs verification after reloading 3.50.7.
Part A files remain unchanged.

---
# Current integration status (3.50.6)

Scan All Qualified RA Results now traverses the filtered list from page 1 to the
last disabled Next control. A dedicated inactive list tab reproduces the source
checkbox/radio filters; the user/Part A tab is never clicked or navigated.
Result tabs remain separate from the list tab and are cleaned up per bid.

Pagination waits for a stable changed bid signature and verifies consecutive page
numbers. Pages without qualified bids still advance. Missing Next, changed filters,
repeated pages, or stalled navigation mark the scan incomplete rather than complete.
Unique bid/RA pairs are processed once. Progress records page number and saved count.
Stop works between reads/navigation; in-flight saving finishes before stopping.

Reload the unpacked extension to 3.50.6, keep Financial Evaluated selected, and
click Scan All Qualified RA Results. No manual Next clicks are needed. Success
reports total pages and saved bids. Mocked pagination/extraction tests pass (19).
Live GeM pagination is not browser-verified; use Copy status if controls differ.
No Chrome Web Store release has been published.

---
Historical integration notes below are superseded by the status above.

# Current integration status (3.50.4)

Start from seller-bids with Financial Evaluated selected. Scan Qualified RA Results
reads the currently rendered cards without clicking or changing the source tab.
Only exact Technical Status: Qualified cards with View RA Results are queued.
Each retains its original GEM/year/B/id and associated GEM/year/R/id.

A dedicated tab opens the result href when available. For script-driven controls,
a dedicated copy of the list attempts to click the matching qualified card.
Result tabs spawned by that dedicated tab are tracked and cleaned up. If GeM does
not reproduce the card/filter state, scanning fails explicitly instead of clicking
or navigating a user's tab. All result identities are checked before saving.
Only the current list page is scanned; manually change pages and repeat.

Backend migration 0057 records ra_no and technical_status. Reports filter on
technical_status=qualified, independently of whether the company's price is listed.
Older records default to unknown and require re-scanning. A result's /R/ number
is never saved as the bid's /B/ number. Unknown company rank remains null.

Validation: 12 extension tests and 6 backend tests pass; frontend build passes.
Migration 0057 is applied locally. Live GeM HTML, scripted result navigation,
and concurrent combined-extension behavior have not been browser-verified.
Reload the unpacked extension to version 3.50.4. No release has been published.

---
Historical integration notes below are superseded by the status above.

# Current integration status (3.50.3)

The actual Part B directory is `src/bid_project_part B/` (existing renamed folder).
The manifest now uses its popup and background bootstrap. The bootstrap imports
Part A's unchanged background worker and the isolated Part B controller. The new
popup retains Part A controls and loads Part A's unchanged popup.js.

Financial Ranking has Scan Current Financial Result, Pause Scan, and Copy status.
It opens a new inactive tab, reads one standard financial-result table, requires
one unambiguous bid number and an exact company match, and posts the result to the
existing financial-rankings API. It does not crawl the technical bid list or verify
technical status separately. Tabs needing POST navigation, frames, or modal-only
state may not reopen by URL; these need captured page fixtures before support.

Part B uses a dedicated runtime port and financialEvalSyncState. Pause/Resume is
available before saving; once submission starts, wait for the server response.
Pausing suspends the scan in place and Resume continues from the same page/task
instead of restarting. Worker restart is reported as interrupted; leftover tabs
are not reused or closed automatically.

Reload the unpacked extension from the original extension root, connect Acxxel,
open a financial-result page, and scan. Refresh the analyser report afterward.
Parser tests (7) and mocked controller tests (2) pass. Live GeM and concurrent
combined-extension testing remain necessary before Chrome Web Store publishing.
Nothing has been published.

---
Historical preparation notes below are superseded by the integration status above.

# Part B: GeM financial evaluation

Status: screenshot-based table parser and isolated tests implemented. The DOM
adapter assumes a standard HTML table and still needs actual page HTML validation.
Synchronization and extension registration are not implemented.

The analyser dashboard now exposes `/analyser-dashboard/financial-rankings`
through its Financial Ranking sidebar entry. The existing Django project provides
authenticated GET/POST `/api/gem/financial-rankings/` and the independent
`GemFinancialRanking` model (migration 0056). POST accepts one `bid_no`, optional
`lot_key` and `item_name`, and the parser's `sellers` array. Company rank is derived
on the server from published seller ranks, never accepted from the client.
No screenshot records are seeded into the database. The page displays an empty
state until actual results are saved; its Refresh button reloads saved results
and does not start an extension scan. Production requires deploying the backend
and frontend changes and running the migration.

Run tests from the repository root:
`node --test frontend/gem-desktop-extension/src/part-b/financial-ranking-content.test.cjs`

The supplied screenshot confirms that equal prices can have different published
ranks (847203.00 is both L1 and L2). The parser preserves those explicit ranks,
all tied rows, and exact decimal prices. Company matching accepts explicit names
or aliases, ignoring only case, whitespace, and trailing MSE/MII badges. Missing
or ambiguous company matches yield a null rank. The user confirmed the default
company name as `LAPS N TABS TECHNOLOGY PRIVATE LIMITED`; its screenshot rank is
L2 with total price INR 847203.00.

## Confirmed repository location

`frontend/gem-desktop-extension/src/part-b/`

The existing extension manifest reports version `3.50.2` at initial inspection.
Use the actual version at release time when selecting the next release version.

## Implementation boundaries

- Put all new extension code and isolated tests in this directory.
- Keep existing extension files, including `manifest.json`, `background.js`,
  `gem-content.js`, and `gem-bid-sync.js`, unchanged during development.
- Reserve `financialEvalSyncState` for Part B state. Do not read or write Part A
  state as Part B's lock, progress, or tab ownership record.
- Create a new inactive tab for each financial evaluation scan. Track the tab
  created by that run; never select, navigate, reuse, or close a Part A tab.
- Serialize scan starts in the Part B background controller. A storage key alone
  is not an atomic lock. Define restart recovery before enabling scans.
- No module should start scans merely because it is loaded.

## Planned files

- `financial-ranking-content.js`: read financial evaluation results using
  verified page structure; return explicit unreadable/pending states.
- `financial-ranking-sync.js`: coordinate scanning, cancellation, dedicated tab
  ownership, independent state, and authenticated persistence.
- Isolated extraction and controller tests using representative page fixtures
  and mocked Chrome APIs.

## Required functional inputs

The supplied Part B document specifies isolation and integration rules, but does
not include the financial results page structure or the earlier functional spec.
Before implementing extraction and persistence, establish:

1. Representative financial evaluation/RA page HTML, its URL shape, and examples
   of completed, pending, and tied results.
2. Exact company seller name or stable seller ID and any approved aliases.
3. Scan scope and navigation: which bids, products, dates, and entry page.
4. Treatment of ties, multiple lots, revised RA results, and unavailable prices.
5. Required dashboard fields and role visibility, following the existing app's
   authentication and authorization conventions.

Read explicit published ranks where available; do not assume row order or derive
an official rank from price without a confirmed business rule. Unknown company
rank must remain unknown rather than becoming a guessed rank.

## Integration and validation

Add the Django model/API and React UI to their existing projects once the data
contract is defined. No separate service, repository, or domain is needed.

Manifest V3 uses a single `background.service_worker` entry, not a background
array. At the reviewed integration stage, choose a compatible bootstrap for the
existing worker and Part B controller; preserve all Part A registrations.

Before registering Part B or bumping the manifest version, validate isolated
extraction and tab/state behavior. Then validate the combined extension locally,
including concurrent product upload, technical-result sync, and financial sync.
Publishing to the existing Chrome Web Store listing follows successful combined
testing. This preparation does not perform integration, deployment, or publishing.
