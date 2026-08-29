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
