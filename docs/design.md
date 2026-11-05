# Design system

Warm ivory paper with clay as the accent, and ochre, sage, slate and rose as secondary colors. Each step type has its own color.

- **Type:** Instrument Serif, bundled in `fonts/`, for headings and the wordmark (falling back to the system serif), and the system sans for the UI. The font files are served from the app itself, so it still works fully offline.
- **Shapes:** rounded pill buttons, soft layered shadows.
- **Favicon:** `favicon.svg`, a vector redraw of your icon (a clay tile with a wavy thread and woven rows). `images/icon-256.jpg` is used as the large icon and the Apple touch icon.
- **Themes:** System (default), Light and Dark share one set of design tokens; dark values are defined once for `prefers-color-scheme: dark` and once for `[data-theme="dark"]`.
