# Weft

Turn any pasted text into a clean table you can fix row by row and column by column. Every change is a visible, undoable step, and steps can be saved as recipes to reuse on the next file.

This is a rebuild of *Sift*. It runs entirely in the browser: no accounts, no uploads, and network access is blocked by a Content Security Policy.

## Entry points

| Path | Purpose |
|---|---|
| `index.html` | The app |
| `index.html#r=<code>` | Opens a shared recipe. The review dialog appears before anything runs. `#p=` links from Sift are also accepted. |
| `index.html?noworker=1` | Forces the engine onto the main thread (for debugging) |
| `index.html?theme=dark` / `?theme=light` / `?theme=system` | Forces a theme for this visit (doesn't change the saved choice) |
| `tests.html` | Engine tests: 251 checks (every step type's examples, recipe-text round-trips, 23 paste fixtures, parser parity, sort stability, suggestions scans) |
| `ui-test.html` | Runs the full UI end to end (34 checks, including the theme switch) and logs results to the console |
| `perf-test.html` | Runs the 200,000-row performance test automatically and logs the timings |
| `tools/bench.html` | Times each engine stage on its own (parsing, steps, view, issues, export), with no UI |

## What's new in 2.5
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
- **Look:** System, Light and Dark themes (System by default, with a soft fade when switching), three row densities, reduced-motion support, and ARIA roles.

## Design system
Warm ivory paper with clay as the accent, and ochre, sage, slate and rose as secondary colors. Each step type has its own color.

- **Type:** Instrument Serif, bundled in `fonts/`, for headings and the wordmark (falling back to the system serif), and the system sans for the UI. The font files are served from the app itself, so it still works fully offline.
- **Shapes:** rounded pill buttons, soft layered shadows.
- **Favicon:** `favicon.svg`, a vector redraw of your icon (a clay tile with a wavy thread and woven rows). `images/icon-256.jpg` is used as the large icon and the Apple touch icon.
- **Themes:** System (default), Light and Dark share one set of design tokens; dark values are defined once for `prefers-color-scheme: dark` and once for `[data-theme="dark"]`.

## Project structure
```
index.html  tests.html  ui-test.html  perf-test.html  favicon.svg
vendor/xlsx.full.min.js      SheetJS 0.20.3, loaded only when needed
tools/favicon.html           optional: builds a pixel-snapped favicon.ico from the icon design
fonts/                       Instrument Serif (Regular and Italic, OFL)
images/                      the icon you uploaded (256 and 150 px)
tools/bench.html             benchmark for each engine stage
css/weft.css                 design tokens + components
js/theme.js                  WeftTheme: applies System/Light/Dark before first paint, follows the device live
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
  - `weft.prefs.v1`: settings, including `theme` (`system`, `light` or `dark`; missing means `system`), density, date order and column widths.
  - `weft.recentCommands`, `weft.tips.v1`.
- **Optional data storage:** IndexedDB `weft-data/sessions`, used only if you turn on "Remember my data".

## Measured performance
Help ▸ Measure performance, 200,000 rows (18.7 MB), background engine on, run in the shared preview browser:

Times vary by about ±30% between runs on the shared preview machine. The 2.5 run measured 0.56 s to read, 220 ms to trim and 398 ms to sort as a step, with no freezes; that is the same as 2.1 within the noise.

| Action | 2.0 | 2.1 | Budget |
|---|---|---|---|
| Read and detect | 1.20 s | 0.52 s | 3 s |
| Trim all columns | 256 ms | 182 ms | 0.6 s |
| Sort as a step | 296 ms | 292 ms | 0.9 s |
| Filter rows | 71 ms | 64 ms | 0.9 s |
| Search | 49 ms | 57 ms | 0.25 s |
| Fetch a page while scrolling | 14 ms | 3 ms | 100 ms |
| Undo | 10 ms | 6 ms | 0.6 s |

On its own, sorting the view by a text column went from 128 ms to 18 ms.

How it stays fast:
- Trim skips cells with nothing to trim and copies a column only when something in it changes.
- Search scans the columns directly instead of building an index.
- Undo and edits reuse every unchanged step's result.
- On the page, the work after each step is split into short tasks. The grid caches its scroll position and size instead of reading layout, and its rows use CSS containment.

Freezes: Weft's own code no longer runs longer than about 50 ms at a time.

## Not done yet
- The per-column part of the suggestions scan (capital-letter variants, date shapes, values that look structured) still makes several passes over a 4,000-value sample for each column. It could be a single pass.
- Search still scans every cell for each query. For files much larger than 200,000 rows, an index built on demand would help.
- There is no `favicon.ico`. Modern browsers use `favicon.svg`. Very old browsers that need an `.ico` can use one built with `tools/favicon.html`.

## Next steps
- Make the per-column suggestion checks a single pass.
- Let the fill bars filter on click, for example "show rows where this column is empty".
- Add a high-contrast theme that uses the same design tokens.
