# Weft v3 baseline

Captured from the repository at 2.6.2 before any v3 change.

## Test counts

| Suite | Result |
| --- | --- |
| Core (`tests.html`) | 321 / 321 |
| UI (`ui-test.html`) | 119 / 119 |
| Golden v2 compatibility (`js/tests/golden-v2.js`) | 174 / 174 added on top of core, 495 / 495 total |

## Performance (200,000 rows, 18.7 MB CSV, headless Chromium, worker engine)

| Operation | Time | Budget |
| --- | --- | --- |
| Read and detect | 502 ms | 3000 ms |
| Trim whitespace on all columns | 282 ms | 600 ms |
| Sort by "amount" | 374 ms | 900 ms |
| Remove rows where "payment_status" is "paid" | 117 ms | 900 ms |
| Search for "lovelace" | 83 ms | 250 ms |
| Fetch a page of rows | 21 ms | 100 ms |
| Undo the last step | 26 ms | 600 ms |

Longest main-thread freeze 71 ms, one long task.

## Golden v2 recipes

`js/tests/golden-v2.js` holds every step example from the 2.6.2 operation table (DSL line, parsed config, input, output) and four multi-step recipes run over the vendor sample with a digest of the table after every step. `js/tests/golden-tests.js` replays them. They must keep passing unchanged through every v3 phase.

## Known version mismatch

README says 2.6.2, `W.version` says 2.6.1. Both become 3.0.0 at release.
