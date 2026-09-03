### 2026-08-31 — Reusable Design System Architecture & Atomic UI Primitives

- **What:**
  1. **Centralized CSS Primitives (`src/style.css`):**
     - Button utilities: `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-accent`.
     - Form controls: `input-base`, `textarea-base`, `select-base`.
     - Cards & surfaces: `card-base`, `card-interactive` (with hover-lift micro-physics), `card-glass`, `card-sunken`.
     - Badges & status pills: `badge-pill`, `badge-accent`, `badge-ok`, `badge-warn`, `badge-danger`.
  2. **Atomic UI Components (`src/components/ui/`):**
     - `<AppButton>`: Polymorphic (RouterLink / a / button) with `variant`, `size`, `loading` spinner, `disabled`, `block`, `#icon`, `#iconRight`.
     - `<AppBadge>`: Semantic status pills with `variant`, `size`, `dot` indicator, `pulse` animation.
     - `<AppCard>`: Standard container with `variant` (`default`, `interactive`, `glass`, `sunken`), `padding`, `as`.
     - `<AppInput>`: Form input with built-in `label`, `error`, `help`, `required`, `#icon`, clear button, and `v-model`.
     - `<AppSelect>`: Styled native select wrapper with options, label, error handling.
     - `<AppSegmentedControl>`: Standard pill tabs / segmented switcher with badges.
     - `<AppStatsCard>`: Standard dashboard metric card with value, subtitle, trend indicator, and `#icon`.
     - `<AppEmptyState>`: Standard dashed empty state container with icon and `#action`.
     - `<AppPagination>`: Standard table/grid pager with total count and responsive page jumps.
  3. **Standardized Views:** Refactored `StatsView.vue`, `RequestsView.vue`, `ReportsView.vue`, `SongsView.vue`, `AccountsView.vue`, and `SecurityView.vue` to use the design system, eliminating hundreds of lines of repetitive CSS/HTML.
- **Why:** Accelerates frontend development, prevents UI drift across pages, reduces CSS bundle overhead, and guarantees robust accessibility and mobile responsiveness.
- **Affects:** `src/style.css`, `src/components/ui/*`, `src/views/*`.

### 2026-08-31 — Song Editor UX: Pro 70/30 Layout, Zen Fullscreen, Dynamic Sizing & Sleek Rails

- **What:**
  1. **Pro 70/30 & Multi-Mode Layouts:** Added 4 desktop layout modes:
     - `Pro (70/30)`: Generous 70% width for the chord editor + 30% live companion preview (default).
     - `50/50`: Equal split.
     - `100% Uređivač`: Full-width single-column chord editor.
     - `100% Pregled`: Full-width live preview.
  2. **Zen Fullscreen Mode (`isZenFullscreen`):** 1-click button to expand the editor across the entire viewport (100vw/100vh) hiding navigation bars and margins for distraction-free editing.
  3. **Auto Details Collapse:** Song metadata is collapsed by default for existing songs, freeing up ~350px of vertical space directly for the lyrics and chords.
  4. **Expansive Viewport Height & Auto-expand:** Increased container height calculation (`calc(100vh - 10.5rem)` / `min-h-[620px]`) with toggleable full-document flow (`autoExpandHeight`).
  5. **Anti-Collision Chord Staggering & Compact Rails:** Enforced minimum 32px separation between chord chips even on short intro lines (e.g. `Uvod: [Fm] [Cm]...`), adjusted lane height (`h-[1.5em]`), and tightened section headers/lyrics margins to display 12-18 stanzas at once.
- **Why:** Prevent cramped editing on laptop screens, eliminate chord overlapping on short intro lines, and maximize usable screen real estate.
- **Affects:** `src/views/SongEditorView.vue`, `src/components/ChordLineEditor.vue`.

### 2026-08-30 — Traps worth not rediscovering

Written down a second time: the first copy was lost when this file was rewritten
before it reached a commit. Each of these cost real time to find.

- **Never infer how long a session lasts.** `useSessionGuard` kept "the longest
  remaining time we have ever seen" and renewed once a threshold of it was
  spent. Wrong twice: opening the dashboard on a half-spent token records a
  short span so the threshold is never reached, and any remount — a hot reload,
  and this repo has a second agent editing files — resets it mid-session. The
  session then expired under somebody actively working. `exp - iat` off the
  token is the real span and needs no state.
- **A ref updated by `setInterval` is fine for rendering and wrong for
  deciding.** Background tabs throttle timers to ~1/min, so anything with a
  deadline in it must read `Date.now()` directly. (This was the *first*
  diagnosis of the bug above and it was wrong — a plausible mechanism is not a
  cause. Correct practice regardless.)
- **The artist grid throttled itself.** `imageUrl` stamped `?v=${Date.now()}`
  fresh on every mount, so 125 portraits were refetched every visit and the
  day-long `Cache-Control` the API already sends never applied. That alone spent
  `publicLimiter` (120/min) and the *next write* — saving an edited artist —
  came back 429 with no message shown. The key is now the image's own
  `imageUpdatedAt`.
- **Search looked broken and was two typos.** The client called `/search`; the
  route is `/songs/search`, so every query 404'd into the catch and showed
  "Učitavanje nije uspjelo". With the path fixed it 400'd, because
  `songSearchQuery` is `.strict()` and never listed `page` although the
  controller had always paged. `.strict()` is worth keeping, but the schema is
  part of the endpoint's contract.
- **Long lists are paged in the client, never by the API** (`FingerprintsView`
  50, `ArtistsView` 48 — the grid is 2 columns at sm and 3 at lg). The whole set
  has to stay in memory or the typo-tolerant filter could only search the page
  it was sent. When inserting a pager, anchor on the *last* `</ul>`: ArtistsView
  has another list inside the editor panel, and the pager landed inside
  `v-if="editing"` where it never rendered.
- **`vite build` dies with `'node:util' does not provide an export named
  styleText`.** Nothing to do with the config — `@iconify/utils` needs Node
  ≥20.12 and a plain shell here may resolve an older one. Check
  `ls ~/.nvm/versions/node` rather than trusting a version written down; the
  ones present change (as of 2026-08-30, v22.23.2 and v24.15.0).
- **An editor that opens above the fold reads as a dead button.** `ArtistsView`
  renders its panel at the top of a 125-card grid; pressing Uredi on a row near
  the bottom put the form ~2450px above the viewport and nothing moved.
  `revealEditor()` scrolls it in and focuses the name.

  challenges (TOTP authenticator app, email OTP, and single-use backup codes),
  with code verification, email OTP resend, and returning to password step.
- **Why:** The backend and `SecurityView.vue` enabled 2FA, but without 2FA
  handling on login, any user who activated 2FA was locked out in an infinite
  redirect loop.
- **Affects:** `stores/auth.js`, `views/LoginView.vue`.

### 2026-08-29 — UI Suite: Global Command Palette, Responsive Drawer, Skeleton Loaders & Chord Diagrams
- **Global Command Palette (`Cmd+K` / `Ctrl+K`):**
  - Instant spotlight search dialog (`CommandPalette.vue`) available from any view.
  - Teleported modal with fuzzy route navigation (Pjesme, Izvođači, Moderacija, Statistika, etc.), quick actions (Tema, Novi izvođač, Nova pjesma), and debounced live catalogue search for songs and artists.
  - Safe shortcut routing: disambiguates between global command palette and local ChordPro bracket-wrap shortcut in `SongEditorView.vue` using `dataset.chordproEditor`.
- **Responsive Mobile Drawer:**
  - Added slide-down collapsible navigation drawer with hamburger toggle button in `DashboardLayout.vue` for mobile and tablet screens.
  - Displays user profile, role badge, session guard indicator, and responsive navigation links with auto-close on route transitions.
- **Polished Skeleton Loading States:**
  - Created reusable `SkeletonLoader.vue` supporting 5 layout geometries (`table`, `grid`, `list`, `stats`, `card`) with smooth pulsing animations matching active theme tokens.
  - Replaced plain text `"Učitavanje…"` indicators across `SongsView.vue`, `ArtistsView.vue`, `StatsView.vue`, `RequestsView.vue`, `ReportsView.vue`, `ModerationView.vue`, `NotificationsView.vue`, `AuditView.vue`, `TrashView.vue`, `FingerprintsView.vue`.
- **Guitar Chord Diagrams & Fingering Previews:**
  - Built comprehensive 6-string chord dictionary in `utils/guitarChords.js` supporting standard and Ex-Yu notation (`H`, `Hm`, `H7`, `A#`, etc.) and slash chord normalization (`Am/G` -> `Am`).
  - Created vector SVG `ChordDiagram.vue` rendering nut/base frets, fret/string lines, barre bars, finger dots, and open/muted string indicators.
  - Integrated real-time diagram rendering in `ChordLineEditor.vue` inside the inline edit popover and on chip interaction.
  - Integrated expandable chord gallery and interactive click/hover chord diagram popovers in `ChordSheet.vue`.
- **Affects:** `components/CommandPalette.vue`, `components/SkeletonLoader.vue`, `components/ChordDiagram.vue`, `utils/guitarChords.js`, `components/ChordLineEditor.vue`, `components/ChordSheet.vue`, `layouts/DashboardLayout.vue`, `views/*.vue`.

### 2026-08-29 — Song editor tags & difficulty management and route sync
- **What:** Added difficulty dropdown and tag controls (standard toggle chips +
  custom tag input/remover) to `SongEditorView.vue`, plus reactive route sync
  when saving a new song and navigating to its editor.
- **Why:** Tags and difficulty exist in the backend schema and filter in
  `SongsView.vue`, but previously could not be inspected or edited on individual
  songs. Component reuse on route transitions left state out of sync without a
  props watcher.
- **Affects:** `views/SongEditorView.vue`.

### 2026-08-29 — Fingerprints view walking the full catalogue
- **What:** Replaced hardcoded `limit: 100` in `FingerprintsView.vue` with paginated
  `fetchAllSongs()` walking all published songs.
- **Why:** The previous limit hid ~1490 songs from being searched or having prints
  recorded.
- **Affects:** `views/FingerprintsView.vue`.

### 2026-08-27 — One dialog for both surfaces
- **What:** `AppModal.vue`, byte-identical in octava-app and octava-dashboard,
  replacing seven window.confirm/prompt calls and two hand-rolled overlays.
- **Why:** a native confirm cannot be styled, ignores the theme the reader
  chose, and on a phone renders as a system sheet that looks like it came from
  somewhere else. More to the point it is a yes/no with no room to say what is
  about to happen — which is exactly what a destructive action needs. Purging a
  song now shows the title beside the field that asks you to type it; a
  window.prompt could not.
- **Identical on purpose,** imports and all, so a fix in one is a copy away from
  the other. It uses explicit `import { ref, … } from 'vue'` even though Nuxt
  would auto-import them, because that is what makes the file portable.
- **Affects:** `LogoutButton`, `SongReviews`, `ReviewComments`, `ReportProblem`
  in the app; `ArrangementsPanel`, `BulkBar`, `TrashView`, `ArtistsView`,
  `SecurityView`, `ModerationView` in the dashboard.
