# Changelog

Newest first. Moved out of the README.

## What's new in 3.0
Weft 3.0 lets you find, filter and compute on specific columns the way you would in a spreadsheet, and every one of those changes is still a visible, undoable step. Recipes written for 2.x load and run with identical output, and their text is unchanged. A recipe only gets the `# weft recipe v3` header when it uses an or-group, a not, or a formula.

### Weft Query (the search box)
Type plain words as before, or aim at a column. Resolved column names are underlined in the box, mistakes show an amber badge with the reason, and a `?` button opens the cheat sheet (also in Commands as "Search syntax").

| Type | Meaning |
|---|---|
| `paid` | any column contains "paid" |
| `paid card` | contains "paid" and "card" |
| `"new york"` | any column contains the phrase |
| `status:paid` | the Status column contains "paid" |
| `status:=paid` | Status equals "paid" (trimmed, ignoring case) |
| `status:!=paid` | Status is not "paid" |
| `-status:paid`, `NOT status:paid` | leave those rows out |
| `amount>100`, `amount>=100`, `amount<0` | a numeric or date comparison that reads the column's own format |
| `amount:100..500` | between, including both ends |
| `date>2025-01-01`, `date:2025-01-01..2025-03-31` | dates, using your date order |
| `region:(emea\|apac)` | is one of |
| `status:=""`, `status:!=""` | is empty, is not empty |
| `notes:/^ref \d+$/i` | a pattern |
| `"order id":123`, `[order id]:123` | column names with spaces |
| `status:paid OR status:pending` | either (OR, AND and NOT are operators only in capitals) |
| `(a:x OR b:y) -c:z` | grouping |
| `=[amount] > [budget]` | a formula that compares columns |

If the text before a colon or comparison is not a column, the whole thing is searched as ordinary text, so `10:30` and `http://example.com` keep working. Typing the start of a column name suggests columns; after `column:` it suggests the 20 most common values with counts. Free words highlight in every column, aimed words only in their own column. **Make this a step** turns what you typed into a "keep rows where…" step with exactly the same rows, and clears the search.

### Column filters
Every header has a funnel, like Excel's AutoFilter. It opens a panel with Sort A to Z and Z to A, a value checklist with counts and a Blanks entry, and type-specific conditions: text (equals, begins with, contains, matches pattern and their opposites), numbers (=, ≠, >, ≥, <, ≤, between, top N, bottom N, above or below average) and dates (before, after, between, this month, last month, this year, last N days). The value list for a column ignores that column's own filter, as in Excel. A bar above the grid shows what is filtered with a remove button on each chip, **Clear all filters** and **Make this a step**. Relative choices such as "last 7 days" or "top 10" are turned into fixed values when you make them a step, and the step says "(fixed on …)". `Alt+↓` opens the funnel for the cursor column and `Ctrl+Shift+L` shows or hides the funnels. On a phone the panel is a bottom sheet. Filters belong to their tab and disappear, with a message, if a step removes their column.

### Find and Replace
With the search box focused, `Enter` and `Shift+Enter` (or `F3` and `Shift+F3` anywhere) move to the next or previous matching cell, with an outline and a count such as "3 of 128 matches". `Ctrl+H` opens Find and Replace: Find, Replace with, Within (all columns, chosen columns or the selection), Match case, Whole cell and Use pattern, with a live "N cells in M columns will change" preview of the first five before and after. Replace creates the ordinary find and replace step. Within a selection it records the cells themselves, because selections are not portable between files, and the dialog says so.

### Formulas
**Add column from formula…** (Commands, the Columns menu and the column header menu) makes a new column from an Excel-style formula such as `[Qty] * [Price]` or `IF([Amount] >= 1000, "Large", "Small")`. The dialog checks as you type, puts a caret under the problem, and offers column and function pickers and examples. Forty-eight functions are available: IF, IFS, IFERROR, AND, OR, NOT, ISBLANK, ISNUMBER, COALESCE, LEN, LEFT, RIGHT, MID, UPPER, LOWER, PROPER, TRIM, CONCAT, TEXTJOIN, SUBSTITUTE, REPLACE, FIND, SEARCH, CONTAINS, STARTSWITH, ENDSWITH, VALUE, TEXT, ROUND, ROUNDUP, ROUNDDOWN, ABS, MIN, MAX, SUM, AVERAGE, MOD, INT, DATE, YEAR, MONTH, DAY, WEEKDAY, DATEDIF, EDATE, REGEXMATCH, REGEXEXTRACT and REGEXREPLACE. A cell that cannot be calculated shows `#VALUE!`, `#DIV/0!`, `#REF!`, `#NAME?`, `#NUM!` or `#N/A`, and the step warns with the first three examples. `TODAY`, `NOW` and `RAND` are refused so a recipe gives the same answer every time. The recipe text line is `add column "Total" = [Qty] * [Price]`, and a formula can also be a condition: `keep rows where formula [Amount] > [Budget]`. Formulas are read by Weft's own parser; nothing is evaluated as program code.

### Also new
- **Pin column:** in the column header menu. Pinned columns stay at the left while you scroll sideways, and the choice is remembered for that file name.
- **Distribution:** the Column tab shows a 20-bar chart for number and date columns. Click a bar to filter the column to that range, click it again to clear.
- **Selection statistics:** with a column selected, the status bar shows Count, Sum, Avg, Min and Max, and says "of filtered rows" when a search or filter is active.
- **Example "Orders 2025":** 121 orders with mixed-case statuses, US and European amounts, dates, blanks and one duplicate, made to try filters and formulas on.
- **What's new card:** the start screen shows four things to try, each with a Try it button that opens the example. Help ▸ What's new brings it back.

### Bug fixes
- **B1:** a quick filter on a row's whole text now hides the same rows as the matching step.
- **B2:** the first search, later searches, the highlighter and a step now agree on capital I with a dot, ß, long s and Greek final sigma, because they share one normaliser.
- **B3:** the count in the Column tab and the rows it selects use one shared way of grouping values. This could not be reproduced as a difference, so a shared key and a test were added.
- **B4:** rows no longer stay blank after fast typing or sorting evicts the engine's view; the grid refreshes once, or tells you.
- **B5:** "any column" comparisons read each column in its own number or date format, including European numbers.
- **B6:** changing the date order recomputes only the open table; the others are recomputed when you open them.
- **B7:** the Markdown export always writes a header row, and the header option is greyed out with the reason.
- **B8:** phrases such as `"new york"` can be searched exactly.
- **B9:** "Make this a step" from a search keeps exactly the rows the view showed, checked by a 500-iteration fuzz on three seeds.
- **B10:** the query bar, autocomplete, funnel panel, Find and Replace and the formula form were looked at in Light, Dark and High contrast and on a 390 px phone width, and nothing overflows. The older screens were not re-inspected (see Not done yet).

### Measured performance
200,000 rows (18.7 MB), background engine, headless Chromium on a shared machine. The 2.6.2 column is the baseline run recorded before any 3.0 change (`docs/v3-baseline.md`); the 3.0 column is one run of `perf-test.html`. Times vary by about ±30% between runs, so five alternating runs of each version were also compared: free-text search had a median of 64 ms on 2.6.2 and 46 ms on 3.0, and read, trim, sort, remove and undo were within the noise of each other.

| Action | 2.6.2 | 3.0 | Budget |
|---|---|---|---|
| Read and detect | 502 ms | 598 ms | 3 s |
| Trim all columns | 282 ms | 322 ms | 0.6 s |
| Sort as a step | 374 ms | 229 ms | 0.9 s |
| Remove rows | 117 ms | 81 ms | 0.9 s |
| Free-text search, first run | 83 ms | 56 ms | 0.25 s |
| Fetch a page while scrolling | 21 ms | 6 ms | 0.1 s |
| Undo | 26 ms | 26 ms | 0.6 s |
| Query `amount>500 AND payment_status:paid`, first run | n/a | 146 ms | 0.25 s |
| Same query again | n/a | 42 ms | 0.06 s |
| Query with a pattern | n/a | 50 ms | 0.25 s |
| Distinct values of a text column | n/a | 52 ms | 0.15 s |
| Find the next match | n/a | 3 ms | 0.05 s |
| Formula column `ROUND(amount * 1.15, 2)` | n/a | 326 ms | 0.4 s |
| Formula search `=[amount] > 500`, first run | n/a | 77 ms | 0.6 s |

Page freezes: most runs show none. Some runs show one or two main-thread tasks of 50 to 70 ms; 2.6.2 shows the same (71 ms in its baseline run).

## What's new in 2.6.2
- **App-styled controls:** every dropdown opens an in-app menu instead of the browser's own list, checkboxes and radio buttons are drawn by Weft, number fields have Weft steppers, the search box has its own clear button, and the "Examples of steps" disclosure uses an app chevron. The underlying form fields are unchanged, so values, events and keyboard use work as before.

## What's new in 2.6.1
- **Numbers:** a value such as `1.250` or `0.125` is no longer read as a European thousands separator, so sums and conversions keep their size.
- **Recipes:** manual row and cell steps are muted when a recipe runs on another file, and a recipe file you drop is shown for review before it runs.
- **Recipe text:** fixed-width splits with a cut list such as `at 0,6,12` can be read back, and a pattern that could freeze the page is refused when a recipe is imported.
- **Row IDs:** Group and summarize and Long to wide give their new rows fresh IDs, so a manual step can no longer hit the wrong row.
- **Split to rows:** a trailing delimiter no longer creates a blank row.
- **Excel export:** ZIP codes and other values with leading zeros stay text, dates are real dates, the header option is respected, and sheet names are valid. The vendored library cannot write a frozen header row, so Weft no longer claims to.
- **Suggestions:** the fixes for page numbers, totals rows and capital-letter variants now change exactly the rows they counted; MySQL and psql row-count footers are skipped with a note.
- **Title case:** an apostrophe no longer capitalises the next letter ("Don't", not "Don'T"; "O'Brien" is still right).
- **Merge columns:** merging from the first column keeps the new column in place.
- **Number display:** negative numbers keep their minus sign and very small numbers no longer show as 0.
- **Date order:** changing the date order refreshes old views and every open table.
- **Safer engine:** a request that takes more than 20 seconds offers "Keep waiting" or "Stop it", and stopping restarts the engine and restores your last good recipe; a failed load, undo or restore no longer corrupts what Weft remembers.
- **Tabs:** calls are tied to the table they were made for, new steps are refused while a tab is switching, steps added together are queued, hidden tables show fresh results when opened, renaming is saved, and "Reset" clears everything from the old file.
- **One-column tables:** duplicating, extracting or importing a one-column table, including from Excel, keeps its header row.
- **Remember my data:** reference files come back too, the browser database connection is reused, and a failed save tells you once.
- **Small fixes:** removing a reference re-runs the steps that use it, the workbook export waits for a running step and uses the file name you typed, "Keep as one table" on a web page says it keeps the largest table, an old view is never answered from the current one, and several dropped files open the first with a note.
- **Polish:** step previews for reshape steps no longer list "removed" rows, only two search indexes are kept in memory, Copy now follows the formula-protection setting and no longer prefixes numbers, blocked browser storage no longer breaks start-up, and the tab close control is no longer a button inside a button.
- **New: Split table at selected row.** Select the first row of a second table that stayed in the same tab and run "Split table at selected row"; that row and everything below it open in a new tab with the row as the header, and the original tab gets a step that removes them.

## What's new in 2.6
- **Several tables in one paste, each in its own tab.** Paste text or a copied web page that holds more than one table and Weft opens each table in a tab above the "Read as" bar. Tables are found by blank lines, by a change in column count with a new header, by markdown and database (MySQL, psql) output, and by document order for web tables. A short line above a table becomes its tab name, and footers such as "3 rows in set" stay with their table. A new table only starts on a clear header (markdown and database tables, or a header over numeric or date columns), so a single table with empty rows or ragged trailing columns stays in one tab. JSON, logs, address blocks and every built-in sample are never split. Up to 12 tables open at once. A message after the split says how many were found and has **Keep as one table** to undo it.
- **Every tab has its own recipe, undo history, search, filters, sort and scroll position.** Switching tabs is blocked while a step is still running, so a result can never land in the wrong tab. `Alt+Shift+←/→` moves between tabs, and the tab strip works with arrow keys, Home, End, `Delete` to close and `F2` to rename.
- **Open data in a new tab instead of replacing it.** Pasting or dropping onto loaded data now asks: Cancel, Replace this table, or Open in a new tab. The **+** button at the end of the strip adds a table from the clipboard or a file, copies the current result, or opens the selected rows as their own table.
- **Use another tab in Join and Compare.** The reference picker lists the other open tables next to "Choose a file". It uses that table's result as it is now; pick it again to refresh.
- **One workbook with every tab.** File ▸ Download all tables as one Excel workbook, or tick "Include every open table" in the Excel export. One sheet per table, with names made unique.
- **Remember my data keeps all tabs,** with each tab's recipe and chosen reading.
- **Bug fixes:** a failed paste no longer stacks the old recipe on top of the old data; "Remember my data" now restores copied web tables and the reading you chose, and no longer shows an error when nothing could be restored; Start over also clears loaded references; changing the reading drops stale row views; a failed load no longer leaves the open table half cleared; one table with empty rows or ragged columns is no longer cut into several tabs; a title line above a markdown, MySQL or psql table no longer becomes the header (the lines are skipped and the reading bar says how many).
- **Tests:** 42 new engine checks and 33 new UI checks. Table detection on a 200,000-row paste takes about 40 ms and is skipped for built-in test data. Loading is unchanged (engine bench: full load 430 ms before, 407-489 ms after).

## What was new in 2.5
- **Search shows where it matched:** while you search, each match is highlighted inside its cell, so you can see why a row was kept. Press `/` to jump to the search box.
- **Column fill bars:** a thin bar under each column name shows how much of the column is filled in: green when (almost) full, amber when partly empty, red when mostly empty. Hover over it to see the exact share.
- **Theme: System, Light or Dark.** System is the default, so Weft follows the device's appearance setting and switches live when it changes. A three-way switch in the header (monitor, sun, moon) sets it, as does View ▸ Theme or Commands; all three stay in sync. Your choice is saved in this browser. The theme is applied before the page first draws, so it never flashes the wrong colors, and the browser bar color matches. Switching fades the colors over about a quarter of a second (instantly if your device asks for reduced motion). The switch works with arrow keys and screen readers. On phones it appears only on the start screen, to keep the workspace header roomy (View ▸ Theme still works there).
- **Suggestions are cached:** each version of the table remembers its scan, so returning to a step or switching inspector tabs shows them instantly.
- **Faster first suggestions scan:** about 0.40 s down to about 0.26 s on 200,000 rows. The duplicate check hashes each row and compares only rows whose hashes collide, instead of building a long text key for every row. The extra-spaces and invisible-character checks are now one pass over the characters instead of a regex per cell. The empty-row and duplicate checks share one pass.
- **Tests for the 2.1 speed work:** 23 new engine tests. 16 cases check that the fast CSV parser gives exactly the same result as the original character-by-character parser (quotes, doubled quotes, line breaks inside quotes, CRLF, stray CR, a non-breaking space before a quote, tabs, no quoting). The rest cover sort stability, empty values sorting last in both directions, natural ordering ("item 2" before "item 10"), multi-key sorts across types, the suggestions cache, and the fill bars.
- **Dark mode checked** for the new highlights, bars and controls.

## What was new in 2.1
- **Faster CSV parsing:** the parser copies whole runs of text between separators instead of building each field one character at a time. Parsing 200,000 rows takes about 0.14 s instead of 0.55 s.
- **Faster sorting:** each distinct text value is ranked once, then rows are sorted by number. Sort keys are cached for each column. Sorting the view by a text column takes about 18 ms instead of 128 ms.
- **Faster suggestions scan:** cheap checks rule rows out before the expensive work, and a regex that was rebuilt on every use is now built once.
- **Smoother scrolling:** scroll events are batched to one repaint per frame.
- **Faster start:** the background engine starts as soon as its script loads, and gets up to 20 s to start on slow devices before Weft switches to the main thread.
- **Visual polish:** your icon is now the favicon (SVG) and the Apple touch icon. The landing page has a soft warm glow and a row of supported formats. Inspector tabs are segmented controls. The grid header and row numbers cast a shadow once you scroll. Empty-cell hatching is quieter. Changed cells are marked with a bar on the left edge. Selected rows have better contrast. The status bar is split into sections and shows a dot for the engine. Step cards fade their buttons until you hover over them. Toasts and dialog backgrounds are now frosted glass. Primary buttons have a subtle gradient.

## Done since 2.5
- **Single-pass column checks:** each column's suggestion checks (number formats, date shapes, ambiguous dates, capital-letter variants) now trim each value once and gather everything in one loop. A dedicated test confirms the new date-shape code gives exactly the same result as the old regex.
- **Search index on demand:** the first search on a table version scans the cells. From the second search on, Weft builds a lower-cased index, so later searches take about 6 ms instead of about 40 ms on 200,000 rows. Tables with more than 60 MB of text skip the index to save memory. A test checks that indexed and scanned results are the same.
- **Clickable fill bars:** clicking a column's fill bar (when the column has gaps) shows only the rows where that column is empty. "Show all rows" or Esc clears it, and "Make this a step" turns it into a filter.
- **High contrast:** View ▸ Contrast offers Match device (default, following the operating system's "increase contrast" setting), High or Standard. It works with Light, Dark and System, uses the same design tokens, and is applied before first paint. `?contrast=high` forces it for one visit.
