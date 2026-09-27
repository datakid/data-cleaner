# Weft

Turn any pasted text into a clean table you can fix row by row and column by column. Every change is a visible, undoable step, and steps can be saved as recipes to reuse on the next file.

This is a rebuild of *Sift*. It runs entirely in the browser: no accounts, no uploads, and network access is blocked by a Content Security Policy.

## Entry points

| Path | Purpose |
|---|---|
| `index.html` | The app |
| `index.html#r=<code>` | Opens a shared recipe. The review dialog appears before anything runs. `#p=` links from Sift are also accepted. |
| `index.html?noworker=1` | Forces the engine onto the main thread (for debugging) |
| `index.html?theme=dark` / `?theme=light` | Forces a theme |
| `tests.html` | Engine tests: 226 checks (every step type's examples, recipe-text round-trips, 23 paste fixtures) |
| `ui-test.html` | Runs the full UI end to end (31 checks) and logs results to the console |

## Features

### Reading messy text
16 detectors, each with a plain-English explanation of how the text was read. Alternative readings appear as chips in the "Read as" bar.

- **Structured formats:** CSV/TSV/semicolon/pipe (with a consistency score), JSON, JSON lines, markdown tables, MySQL/psql box tables, and web tables copied from a browser (colspan and rowspan handled).
- **Column layouts:** fixed-width output such as `docker ps` or `ls -l`, and columns separated by runs of spaces (text copied from PDFs).
- **Records:** key: value blocks, and blocks of lines (addresses).
- **Logs:** logfmt, Apache/Nginx access logs, timestamped logs with level and source, and log lines ending in JSON.
- **Other:** bulleted lists, and plain lines as the fallback.
- **Clean-up detection:** title rows, the real header row, totals rows, page leftovers and repeated headers are found and offered as one-click fixes.
- **Reading dialog:** a live preview and settings for each reading, plus a ruler for fixed-width text. Click to add a column cut, click a cut to remove it, drag to move it; it also works from the keyboard.

### Cleaning
- **Selecting:** click rows, columns or cells; Shift and Ctrl/⌘ ranges; select all.
- **Deleting and keeping:** press Delete to remove rows, columns or cell contents; "Keep only selected".
- **Filtering:** "Remove rows like these" suggests a rule that matches your selected rows. The filter builder supports all/any, 15 comparisons, and a live preview of rows removed and kept.
- **33 step types:**
  - Rows: remove duplicates, remove empty rows, remove top/bottom rows, use a row as header, remove repeated headers, sort, split a cell's values into rows.
  - Columns: rename, delete, keep, duplicate, reorder, change type, fill blanks, fill down, merge, split, extract, split by structure (JSON, key-value, logfmt, fixed-width, pattern).
  - Text: trim, clean invisible characters, change case, find and replace, clean numbers, normalize dates.
  - Reshape: wide to long, long to wide, group and summarize.
  - Combine: join with a reference file, compare with a reference (diff).
- **Suggestions panel:** a problem list sorted by severity, each with Show rows, Adjust… and Fix.
- **Column tab:** type, empties, distinct values, min/max/average, and the most common values (click one to select those rows).
- **Cell tab:** the full value with whitespace made visible, and the history of how each step changed it.
- **Edit by example:** edit a cell, and Weft offers to apply the same change to similar cells.

### Recipes (saved pipelines)
- **Recipe panel:** a timeline of steps that can be muted, reordered (drag, or Alt+↑/↓), edited, duplicated and deleted. A step slider shows the data at any step.
- **Where new steps go:** new steps are inserted after the step you're viewing. Undo and redo cover every change.
- **Library:** save to the library in your browser, optionally with the result's shape so a future file that looks different gets a warning.
- **Applying to a new file:** columns renamed only by case, spaces or punctuation are matched automatically. If the recipe's reading doesn't fit the new file, you're asked which reading to use.
- **Sharing:** a compressed share link that carries only the steps (with a review gate), plus download and import of recipe files.
- **Recipe as text:** edit the recipe as text, one step per line, with error messages per line.
- **Autosave:** the recipe autosaves. Keeping the data itself in the browser (IndexedDB, up to 50 MB) is optional and off by default.

### Excel
- Opens .xlsx, .xlsm, .xlsb, .xls and .ods files using SheetJS 0.20.3 (`vendor/xlsx.full.min.js`). The library loads only when an Excel file is opened or exported, so startup is unaffected.
- Multi-sheet workbooks ask which sheet to clean. Merged cells are reported.
- "Download as Excel workbook" (and the Excel option in Export) writes numbers and ISO dates as real Excel values, freezes the header row, turns on filters and sizes the columns. Text that starts with = + - @ is stored as text, so no formulas are ever created.
- Reference files for join and compare can also be Excel files.

### Performance
Help ▸ Measure performance times reading, trimming, sorting, filtering, searching, scrolling and undo on 200,000 generated rows, checks each against its budget, and reports page freezes (long tasks). "Copy report" gives a text summary.

### Output
Export as Excel (.xlsx), CSV, TSV, JSON records, JSON columns, NDJSON, Markdown or plain lines. You choose the rows (final result, current view, or selected rows) and the columns. Options include formula-injection protection, an Excel-friendly mode (BOM and Windows line endings), and "Copy for spreadsheet".

### Interface
- **Commands:** a palette (Ctrl/⌘K) with search that allows typos and understands synonyms ("delete" finds "remove", "unpivot" finds "wide to long"). It lists every command, and disabled ones show the reason.
- **Menus:** toolbar menus and right-click menus are built from the same command list. Long-press opens the menu on touch screens.
- **Keyboard:** full grid navigation and a `?` shortcuts sheet.
- **Large files:** the grid only draws visible rows, so it stays fast on 200,000-row files. The engine runs in a Web Worker and falls back to the main thread automatically.
- **Look:** light and dark themes, three row densities, reduced-motion support, and ARIA roles.

## Design system
Warm ivory paper with clay as the accent, and ochre, sage, slate and rose as secondary colors. Each step type has its own color.

- **Type:** the system serif (New York / Iowan / Palatino) for headings, and system sans for the UI. No web fonts, to keep the app fully offline.
- **Shapes:** rounded pill buttons, soft layered shadows.
- **Favicon:** `favicon.svg`, a clay tile with one wavy thread straightening into two woven rows.

## Project structure
```
index.html  tests.html  ui-test.html  favicon.svg
vendor/xlsx.full.min.js      SheetJS 0.20.3, loaded only when needed
tools/favicon.html           builds favicon.ico and the Apple touch PNG
fonts/                       Instrument Serif (to be added)
css/weft.css                 design tokens + components
js/theme.js                  applies the saved theme before first paint
js/worker.js                 Web Worker host (importScripts core)
js/core/*.js                 engine, no DOM: parsing, detectors, 33 step types, pipeline, insights, samples
js/ui/*.js                   interface: DOM helpers, engine client, state, selection, grid, forms, commands, panels, dialogs
js/tests/*.js                fixtures, engine tests, UI drive test
```

## Data and storage
- **Table model:** columnar `{cols, data[c][r], n, rowIds}`. Each row has a stable ID that survives sorting, filtering and reordering.
- **Browser storage keys:**
  - `weft.session.v1`: the autosaved recipe.
  - `weft.library.v2`: saved recipes. Old `sift_library_v1` entries are migrated automatically.
  - `weft.prefs.v1`: settings.
  - `weft.recentCommands`, `weft.tips.v1`.
- **Optional data storage:** IndexedDB `weft-data/sessions`, used only if you turn on "Remember my data".

## Measured performance
Help ▸ Measure performance, 200,000 rows (18.7 MB), background engine on, run in the shared preview browser:

| Action | Time | Budget |
|---|---|---|
| Read and detect | 0.63–0.75 s | 3 s |
| Trim all columns | 0.24–0.28 s | 0.6 s |
| Sort as a step | 0.29–0.32 s | 0.9 s |
| Filter rows | 52–84 ms | 0.9 s |
| Search | 49–60 ms | 0.25 s |
| Fetch a page while scrolling | 4–12 ms | 100 ms |
| Undo | 9–14 ms | 0.6 s |

How it stays fast:
- Trim skips cells with nothing to trim and copies a column only when something in it changes.
- Search scans the columns directly instead of building an index.
- Undo and edits reuse every unchanged step's result.
- On the page, the work after each step is split into short tasks. The grid caches its scroll position and size instead of reading layout, and its rows use CSS containment.

Freezes: Weft's own code no longer runs longer than about 50 ms at a time. The shared preview browser still reports one freeze per run (70–105 ms, occasionally more when the machine is busy). Almost none of it is Weft's script (5 ms); the rest is browser work that couldn't be traced there. The real test is Help ▸ Measure performance on your own machine.
