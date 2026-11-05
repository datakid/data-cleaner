# Project structure

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
js/core/*.js                 engine, no DOM: parsing, detectors, table splitting (35-tables.js), 34 step types, Weft Query and condition trees (45-query.js), formulas (46-formula.js, 47-ops-formula.js), pipeline, insights, samples
js/ui/*.js                   interface: DOM helpers, engine client, state, selection, grid, forms, commands, panels, dialogs, query bar (52), column filters (53), find and replace (54), what's new (57), tabs (58)
js/tests/*.js                fixtures, engine tests (golden v2, bugs, query, trees, filters, cache, formulas, polish), UI drive tests (ui-drive, ui-v3, ui-p2, ui-p3, ui-p4)
docs/v3-baseline.md          the 2.6.2 test counts and timings that 3.0 is compared against
```
