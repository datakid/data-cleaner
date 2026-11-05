# Measured performance

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
