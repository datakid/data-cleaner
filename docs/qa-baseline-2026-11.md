# QA baseline, November 2026

Captured from `main` (a3aac54) before the quality pass, on 2026-11-15.

Environment: headless Chromium 153.0.8010.12 driven by Playwright 1.63.0, Linux container with 1 CPU, `python3 -m http.server`, light theme, 1280 × 900 viewport.

## Test counts

| Suite | Baseline |
| --- | --- |
| Core (`tests.html`, main thread) | 1127 / 1127 |
| UI (`ui-test.html`, worker engine) | 313 / 314 |
| UI (`ui-test.html?noworker=1`) | 69 / 69, then the harness stops (see below) |

### Failing at baseline

- `P4 moving to a far column does not hide it under the pinned ones` (`js/tests/ui-p4.js`). Column 12 lands at 448 px from the left edge while the row numbers (56 px) plus two pinned columns (400 px) end at 456 px, so it sits 8 px under the pinned columns. Not fixed in the baseline commit; it joins the bug list.

### No-worker run

`ui-test.html?noworker=1` runs 69 checks and then stops with `Cannot read properties of null (reading 'postMessage')` at `js/tests/ui-drive.js:209`. The harness posts to `Engine.worker` directly, so it cannot go further without a worker. This is a limit of the test harness, not an app failure. The engine checks in `tests.html` run on the main thread, and main-thread behaviour of the app is checked separately in the final smoke test.

## Performance (200,000 rows, 18.7 MB CSV, worker engine)

| Operation | Time | Budget |
| --- | --- | --- |
| Read and detect | 976 ms | 3000 ms |
| Trim whitespace on all columns | 261 ms | 600 ms |
| Weft Query, first run | 166 ms | 250 ms |
| Weft Query, same query again | 43 ms | 60 ms |
| Weft Query with a regex | 57 ms | 250 ms |
| List the distinct values of a column | 77 ms | 150 ms |
| Find the next match from the middle | 2 ms | 50 ms |
| Sort by "amount" | 274 ms | 900 ms |
| Remove rows where "payment_status" is "paid" | 136 ms | 900 ms |
| Search rows for "lovelace" | 106 ms | 250 ms |
| Fetch a page of rows while scrolling | 23 ms | 100 ms |
| Undo the last step | 26 ms | 600 ms |
| Add a formula column `ROUND(amount * 1.15, 2)` | 571 ms (634 and 493 on two repeats) | 400 ms |
| Add a text formula column | 269 ms | 400 ms |
| Formula search, first run | 247 ms | 600 ms |
| Formula search, same formula again | 34 ms | 60 ms |

Longest main-thread freeze 56 ms, one long task.

### Over budget at baseline

`Add a formula column: ROUND(amount * 1.15, 2)` took 571, 634 and 493 ms against a 400 ms budget in three runs. It is the first formula step of the run, so it includes cold compilation, and this container has a single CPU shared by the page and the worker. The other formula steps are inside budget. It is recorded as the reference for the final comparison rather than treated as a regression.
