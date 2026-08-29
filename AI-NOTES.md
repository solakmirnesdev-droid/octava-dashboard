# AI-NOTES — octava-dashboard

> **Entry file for every AI session on this project.** Read this first, before
> touching any code. Update it before you finish. It exists because context
> windows end and sessions reset — this file is the memory that survives.
>
> Single source of truth. [AGENTS.md](./AGENTS.md) points other tools here.

**Last updated:** 2026-08-29

---

## 1. What this project is

The internal tool the Octava catalogue is edited from: songs, arrangements,
artists, moderation, accounts. A Vue 3 SPA talking to `octava-backend`. Not
public, but it is the only surface that writes to the production database, which
is why the destructive actions here get more care than the public site's.

---

## 2. Stack & commands

| | |
|---|---|
| **Language / runtime** | JavaScript (ESM), Node 24 |
| **Framework** | Vue 3 + Vite 5, `<script setup>` |
| **Routing / state** | vue-router, Pinia |
| **Styling** | Tailwind 4 |
| **Icons** | `unplugin-icons` — `import IconX from '~icons/material-symbols/…'` |

```bash
npm install
npm run dev      # vite; the backend must be up on :4000
npm run build
```

**There is no test runner here.** The backend has 124 tests; this repo has none.
Anything important that can be pushed down into the API should be, because that
is where it can be covered.

---

## 3. Architecture map

```
src/
├── views/        one per route: Songs, SongEditor, Artists, Trash, Audit, …
├── components/   BulkBar, ArrangementsPanel, ChordLineEditor, ChordSheet, …
├── composables/  useToasts, useTheme
├── stores/       auth (hasRole), notifications
├── api/client.js axios: bearer token from localStorage, 401 → /login
└── style.css     the only place colours are defined
```

**Auth:** `stores/auth.js` exposes `hasRole(minimum)` comparing ranks
(`worker` 1 · `admin` 2 · `superadmin` 3). Routes gate with
`meta: { minimumRole }`. Never enumerate roles — an enumeration silently locks
out any rank added above the ones listed.

---

## 4. UI & design conventions

**Colour is semantic, never literal.** A component names the *role* a colour
plays and `style.css` decides how that role looks per theme. There is no
`text-black/40` anywhere any more, and adding one back breaks dark mode silently.

| Role | Token |
|---|---|
| Page ground / card | `bg-surface`, `bg-panel` |
| Hover, fill | `bg-raised`, `bg-sunken` |
| Hairlines | `border-line-soft`, `border-line`, `border-line-strong` |
| Text | `text-ink` → `text-body` → `text-muted` → `text-faint` → `text-dim` |
| On a solid | `text-on-ink`, `text-on-accent` |
| Accent | `text-accent`, `bg-accent-soft` |
| Status | `text-ok`/`bg-ok-soft`, `text-warn`/`bg-warn-soft`, `text-danger`/`bg-danger-soft` |

This is the same set as octava-app's `main.css`, deliberately: the two surfaces
are one product and should not need two vocabularies. Only one literal colour
survives — the modal backdrop in `ModerationView`, which stays dark in both
themes on purpose.

**Pattern-match from:** `views/SongsView.vue` (table, filters, pagination,
optimistic row updates), `views/TrashView.vue` (destructive actions).

**Buttons:** primary is `bg-ink text-on-ink hover:bg-accent`; secondary is
`border border-line-strong text-muted` with the hover border in whatever colour
the action means (`hover:border-ok`, `hover:border-danger`).

---

## 5. Decision log

### 2026-08-29 — Floating Editorial Chat Widget & Role Glow Badges

- **Problem:** Chat (`Uredništvo`) took up space on the main navigation bar and
  navigating to it interrupted editing workflows.
- **Decision:** Relocated chat to a floating bottom-right viewport widget
  (`ChatWidget.vue`) accessible across any route. Features live connection
  indicators, unread message badges, rich markdown formatting (**bold**,
  *italic*, ~~strike~~, `code`, chords `[Am]`, links), and a quick emoji
  palette.
- **Roles:** Consistent glowing yellow for `superadmin`, glowing orange for
  `admin`, and muted grey for `moderator`/`worker` defined in
  `roleBadgeClass()`.

### 2026-08-29 — Bounding-Box Spatial OCR Importer & Chord Placement UX

- **Problem:** OCR scanned chords from images collapsed whitespace, misaligning
  chords to the left of the lyrics.
- **Decision:** Built `convertOcrBboxDataToChordPro` utilizing Tesseract's
  pixel-level bounding box coordinates (`x0`, `x1`) to match chords to the exact
  physical words underneath.
- **Visual Editor:** Added horizontal drag-and-drop on chord tokens with guide
  lines, inline popover with one-click suggestions from the song's existing
  chords, and raw-mode quick insert toolbars.

### 2026-08-29 — Moderation View Redesign

- **Redesign:** Replaced flat boxes with rich user avatar cards (`avatarColor`,
  `initials`), explicit status badges (`Objavljeno`, `Sakriveno`, `Uklonio autor`),
  quote containers, and one-click preset reasons in the hide modal.

### 2026-08-29 — Fingerprints can be taken from a tab, not only from a file

- **Problem:** a reference print needed an audio file, for each of 1569 songs.
  That, not the code, is what stood between the catalogue and working
  recognition — there are 0 prints stored.
- **Rejected:** pasting a YouTube URL for the server to fetch. It means
  downloading and keeping copies of recordings we have no right to, against
  YouTube's terms, at catalogue scale. The fingerprint being a hash does not
  change what has to happen to the audio first.
- **Chosen:** `getDisplayMedia` capture. The operator plays the song wherever
  they like and the dashboard takes the sound from that tab. Same shape as
  before — decoded here, only hashes sent, nothing written to disk.
- **AI-TRAP:** `video: true` is required even though the video track is stopped
  immediately. Chrome does not offer the tab picker for an audio-only request,
  so asking for audio alone leaves the operator with nothing to choose.
- **Also:** the `ended` listener on the audio track matters — stopping the share
  from Chrome's own bar must end the recording, or the row sits on "Zaustavi"
  over a stream that is already gone.
- **Paged in the client, 50 a row.** The list has to stay whole in memory or the
  typo-tolerant filter could only search the page it had been sent — proved by
  typing a misspelling from page 5 and still finding a song that lives on page
  1. Only the rendering is cut, which also removes what this actually cost:
  1569 rows with two buttons each, rebuilt on every keystroke.
- **Files:** `views/FingerprintsView.vue`.

### 2026-08-29 — Long lists are paged in the client, never by the API

- **Applies to:** `FingerprintsView` (50 a page) and `ArtistsView` (48 — the
  grid is two columns at sm and three at lg, and 48 divides by both, so no
  ragged last row at either width).
- **Why client-side:** the whole set has to stay in memory or the typo-tolerant
  filter could only search the page it had been sent. Verified both ways round:
  a misspelling typed on page 5 of the fingerprints list still finds a song that
  lives on page 1, and filtering from page 2 of the artists grid finds one from
  page 1.
- **Both pagers:** reset to page 1 when any filter changes, clamp when the list
  shrinks under the current page, and scroll to top on turn. Without the clamp a
  narrowing filter leaves an empty page with no way back.
- **AI-TRAP:** when inserting the pager, anchor on the *last* `</ul>` in the
  file, not the first — `ArtistsView` has a scrollable list inside the editor
  panel, and the pager landed after that one instead, where `v-if="editing"`
  meant it never rendered at all.
- **Files:** `views/FingerprintsView.vue`, `views/ArtistsView.vue`.

### 2026-08-29 — Dashboard search: one wrong path, one strict schema

- **Symptom:** "search doesn't work". Every query returned the unfiltered list.
- **Cause, part one:** the client called `/search`; the route is `/songs/search`.
  A 404 landed in the catch, which showed "Učitavanje nije uspjelo" — so it read
  as the backend failing rather than the URL being wrong.
- **Cause, part two:** with the path fixed, every query 400'd. `songSearchQuery`
  is `.strict()` and lists only `q` and `limit`, while the controller has always
  paged. Adding `page` to the schema was the whole fix.
- **Lesson:** `.strict()` is right, but it means the schema is part of the
  endpoint's contract — a controller that reads a parameter the schema does not
  list is a 400 waiting to happen, and the error names the parameter, not the
  cause.
- **The typo tolerance was already there** and good: "nisma pao" finds Nisam
  Pao, "Zelko Samardzic" finds Željko. The dashboard now also shows the
  `suggestion` the API returns, which it had been discarding.
- **Client-side filters** (artists, fingerprints) did plain `includes()`, so
  "zeljko" missed "Željko" and no typo worked at all. They now use `fuzzy.js`,
  mirrored from the API, through `utils/textFilter.js`. `mirror.test.js` grew a
  second list so that copy cannot drift from the server's.
- **Files:** `views/SongsView.vue`, `views/ArtistsView.vue`,
  `views/FingerprintsView.vue`, `utils/textFilter.js`, `utils/fuzzy.js`,
  `test/mirror.test.js`; backend `middleware/schemas.js`.

### 2026-08-29 — Session warning is driven by the token, not by a local timer

- **Choice:** `useSessionGuard` reads the deadline off the held token's own
  `exp`, renews on deliberate activity, and shows `SessionNotice` when under
  five minutes remain.
- **Why not count idle time locally:** a local counter and the token drift apart
  the moment a laptop sleeps or a second tab renews — and the token is the thing
  that actually signs you out. Reading `exp` means the countdown is always the
  real one, and waking from sleep needs no special handling.
- **The warning cannot interrupt work.** Because activity renews, five-minutes-
  left is only reachable after ~55 minutes in which nothing was clicked, typed
  or scrolled. That was the requirement: it must never appear mid-edit.
- **`mousemove` is deliberately not an activity event.** A nudged desk would
  renew forever, and an unattended machine staying signed in is the whole point
  of the timeout. Only `pointerdown`, `keydown`, `wheel`, `touchstart` count.
- **Renewal is throttled** to once per five minutes of token life spent, so a
  busy hour costs about twelve small requests rather than one per click.
- **A corner notice, not a modal.** A dialog would steal focus and swallow the
  next keystroke of somebody returning to an unfinished chord sheet.
- **Tabs are kept in step** through the `storage` event; without it a quiet tab
  counts down toward a session the other tab already extended.
- **Files:** `composables/useSessionGuard.js`, `components/SessionNotice.vue`,
  `stores/auth.js`, `layouts/DashboardLayout.vue`.

### 2026-08-29 — Dashboard accounts are made by a superadmin, nowhere else

- **Choice:** `Nalozi => Uredništvo => Novi nalog` creates an editorial account
  (`POST /accounts/staff`, superadmin-only, audit-logged).
- **Why:** there was no way to make one from the product at all. The only path
  was `scripts/createAdmin.js`, which needs shell access on the server — so in
  practice nobody but Mirnes could ever be given a login. That script is now
  bootstrap-only: it covers the case where no superadmin exists yet to open the
  screen, and it is the one path that leaves no audit entry.
- **Password:** set by the superadmin and handed over in person, shown rather
  than masked. Not emailed **by choice** — mail works (`MAIL_PROVIDER=resend`),
  so an invite flow is buildable if wanted; a first login you can walk somebody
  through beats a link that expires or lands in spam, and the holder can replace
  it through the ordinary forgot-password flow, which covers staff. Minimum 12
  characters, higher than the 8 the public site asks for: a reader's account
  loses that reader's playlists, a dashboard account can empty the catalogue.
- **No "moderator" rank.** Hiding what a reader wrote is gated at `admin`, so a
  moderator *is* an admin here. Rejected adding a fourth rank: the ladder is
  ranked (`requireRole` asks for a minimum), so inserting one means re-reading
  every gate. `worker`'s label became "Urednik" — it was the last English word
  in a table headed "Uredništvo", and "Worker" read like it might be the
  moderator rank when it is the songs-only one.
- **Files:** `views/AccountsView.vue`; backend `controllers/accountController.js`,
  `routes/accounts.js`, `middleware/schemas.js`, `test/staffCreate.test.js`.

### 2026-08-29 — One bin for everything deleted

- **Choice:** `/trash` holds songs *and* artists behind two tabs, and is the
  only place either can be restored or purged from.
- **Why:** the bin only covered songs. Deleted artists lived behind a toggle
  inside `ArtistsView`, so finding something you had deleted meant knowing what
  *type* it was before you knew where to look. A bin that answers "what did I
  delete?" has to be one place.
- **Rejected:** pulling removed arrangements in too. A version means nothing
  away from the song it belongs to, and there is no global list of them to
  build the tab from — they stay in `ArrangementsPanel`.
- **Note:** the artist tab is deliberately unpaged (`meta = null` on that
  branch, which is also what hides the song pager and the header count when the
  tab is switched). It holds what a person deleted by hand — a short list, not
  an import gone wrong. Songs are paged 25 at a time; there are 307 in there.
- **Files:** `views/TrashView.vue`, `views/ArtistsView.vue` (duplicate bin removed).

### 2026-08-29 — Staged artist image upload on save
- **What:** In `ArtistsView.vue`, selecting or removing an artist portrait is now
  staged locally with a live preview and only committed to the database when the
  editor clicks "Sačuvaj" (Save).
- **Why:** Selecting a file previously sent `POST /artists/:id/image` immediately
  on the `change` event, altering the database before the user submitted or even
  if they cancelled the form. New artists can now also have an image staged during
  creation.
- **Affects:** `views/ArtistsView.vue`.

### 2026-08-29 — Live search in Songs view and Stats view interactivity
- **What:** Added live debounced search across all catalogue songs in `SongsView.vue`,
  clickable song rows in `StatsView.vue`, direct song editor links in `ModerationView.vue`,
  and event listener lifecycle cleanup in `ChordLineEditor.vue`.
- **Why:** Editors previously had to page through 1590 songs 25 at a time without
  a search bar on the primary songs table, and stats/moderation entries lacked
  direct navigation to song editing.
- **Affects:** `views/SongsView.vue`, `views/StatsView.vue`, `views/ModerationView.vue`,
  `components/ChordLineEditor.vue`.

### 2026-08-29 — Complete 2FA login verification flow
- **What:** `LoginView.vue` and `stores/auth.js` now handle two-factor authentication
  challenges (TOTP authenticator app, email OTP, and single-use backup codes),
  with code verification, email OTP resend, and returning to password step.
- **Why:** The backend and `SecurityView.vue` enabled 2FA, but without 2FA
  handling on login, any user who activated 2FA was locked out in an infinite
  redirect loop.
- **Affects:** `stores/auth.js`, `views/LoginView.vue`.

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

### 2026-08-27 — Bulk edits go through the API, not the database
- **What:** `components/BulkBar.vue` plus `POST /songs/bulk` — status, genre, tag
  and delete across a selection.
- **Why:** recategorising 1590 songs one row at a time is not work anybody does;
  they write a script against the database instead, and a script is the one kind
  of change the audit log cannot see. Making the bulk path convenient is what
  keeps it on the record.
- **Detail:** the toast distinguishes *requested* from *touched*. "Promijenjeno:
  2 od 5" is a report; a bare "gotovo" is a reassurance, and the difference
  matters when somebody is checking whether the edit landed.
- **Affects:** `SongsView.vue`, `BulkBar.vue`, backend `songController.bulk`.

### 2026-08-27 — Semantic tokens and dark mode
- **What:** 308 literal colour utilities across 15 files collapsed onto 22 named
  roles, switched with `light-dark()`.
- **Why:** same reasoning as octava-app. Additionally, green and emerald were
  being used interchangeably for "this succeeded", and Tailwind's `-50` grounds
  are fixed pale colours that become unreadable the moment the page goes dark.
  One `ok` token settles both.
- **Note:** the system preference needs no JavaScript — `color-scheme` on :root
  resolves it. The inline script in `index.html` only pins an explicit override.
- **Affects:** `style.css`, `composables/useTheme.js`, `components/ThemeSwitcher.vue`,
  `index.html`, 15 views and components.

### 2026-08-29 — Artist biography formatting toolbar
- **What:** added rich text formatting controls (bold, italic, strikethrough, links,
  bulleted lists, quotes, and live preview) to the artist biography field.
- **Why:** editors writing artist biographies need standard Word-like formatting to
  emphasize dates, band members, cross-links to sources, and quotations without
  manually guessing markdown syntax.
- **Affects:** `src/views/ArtistsView.vue`.

### 2026-08-29 — In-browser Image & OCR Auto-Converter for Song Editor
- **What:** integrated client-side OCR (`tesseract.js` + `ocrParser.js`) into `ImportPanel.vue`.
- **Why:** editors often transcribe chords from screenshots, mobile photos of sheet music,
  and physical songbooks. Allowing file drop, browse, or direct clipboard screenshot pasting
  (`Cmd+V` / `Ctrl+V`) with automatic column-based ChordPro alignment removes manual typing.
- **Affects:** `src/components/ImportPanel.vue`, `src/utils/ocrParser.js`, `src/views/SongEditorView.vue`.

---

## 6. Traps & gotchas

### Two-factor authentication returns no token on initial login
- **Symptom:** signing into an account with 2FA active causes a blank login redirect loop.
- **Cause:** `POST /auth/staff/login` returns `{ twoFactorRequired: true, challenge, methods }`.
  Saving `data.token` without checking `twoFactorRequired` writes the string `'undefined'` to
  storage and treats the session as valid.
- **Fix:** `stores/auth.js` checks `data.twoFactorRequired`, returns the challenge, and
  `LoginView.vue` prompts for the 6-digit verification code.
- **Files:** `stores/auth.js`, `views/LoginView.vue`.

### Component reuse across router transitions skips onMounted
- **Symptom:** creating a song and saving it redirects to `/songs/:id/edit`, but the arrangements
  panel and song details stay unpopulated.
- **Cause:** Vue Router reuses the mounted `SongEditorView.vue` component when the path changes
  between `/songs/new` and `/songs/:id/edit`.
- **Fix:** watch `props.id` explicitly to re-fetch and initialize state.
- **Files:** `views/SongEditorView.vue`.

### An ASCII quote inside a template literal ends the HTML attribute
- **Symptom:** the dashboard would not compile — "Unterminated template" in
  ArtistsView, pointing at a line that looked fine.
- **Cause:** `:description="… `„${name}" …`"`. The straight quote closing the
  Bosnian pair terminated the attribute long before Vue saw the backtick.
- **Fix:** the typographic closing quote, which is the right character anyway.
- **Files:** `views/ArtistsView.vue`, `components/ArrangementsPanel.vue`.

### A scroll lock counter cannot live inside the component
- **Symptom:** scrolling came back while a dialog was still covering the page.
- **Cause:** the counter was declared in `<script setup>`, so every AppModal had
  its own. Several are mounted at once — the layout renders one LogoutButton for
  the desktop nav and another for the mobile drawer — and Teleport lifts each
  dialog out of its hidden container, so more than one can be live.
- **Fix:** the count lives on `document.body.dataset.modalCount`.
- **Files:** `components/AppModal.vue`.

### A dialog whose leave transition never finishes freezes the page
- **Symptom:** in a tab that is not compositing, `transitionend` never fires, so
  Vue never removes the element. A `fixed inset-0` overlay at opacity 0 then
  swallows every click with nothing on screen to explain it.
- **Fix:** the leave state also sets `pointer-events-none`, so a stalled overlay
  is at worst invisible rather than page-breaking.
- **Files:** `components/AppModal.vue`.

### The artist grid silently showed only the first 100 of 139
- **Symptom:** 39 artists could not be edited, given a country, or given a
  photograph. Nothing on the page suggested more existed.
- **Cause:** `ArtistsView` made one request with `limit: 100`, which is the
  API's maximum. The cap is right; the client has to walk the pages.
- **Fix:** `fetchAllArtists()` follows `meta.pages`. Any view that lists
  something unpaginated needs the same treatment.
- **Files:** `views/ArtistsView.vue`.

### A soft delete needs somewhere to undo it, every time
- **Symptom:** deleting a version kept its ratings but the panel offered no way
  back, so from the editor's side it was indistinguishable from destruction.
- **Fix:** `ArrangementsPanel` lists removed versions with what they still hold
  and a restore button, and the confirm text says what actually happens rather
  than the old warning about votes being deleted.
- **Note:** the same rule applies to anything else given a soft delete here.
- **Files:** `components/ArrangementsPanel.vue`.

### Selection must not survive a filter change
- **Symptom:** none yet — this is why `SongsView` clears it.
- **Cause:** a selection carried across a filter lets somebody act on rows they
  can no longer see. For a bulk edit that is the one unacceptable failure.
- **Files:** `views/SongsView.vue`.

### A row that is a link needs `@click.stop` on its controls
- **Symptom:** ticking a checkbox or toggling status also navigated to the editor.
- **Cause:** the whole `<tr>` opens the song, deliberately — the title alone gave
  no sign it was clickable.
- **Fix:** every interactive cell inside the row stops propagation.
- **Files:** `views/SongsView.vue`.

---

### Never infer a session's length from what you have observed

- **Symptom:** the countdown rendered correctly and the manual "Ostani
  prijavljen" button worked, but *automatic* renewal on activity never fired
  once. The session then expired under somebody actively working — the exact
  failure the feature exists to prevent.
- **Cause:** the composable kept `lifetimeMs`, "the longest remaining time we
  have ever seen", and renewed once `lifetimeMs - left` passed a threshold.
  Wrong twice. Open the dashboard on a half-spent token and it records a short
  span, so the threshold is never reached: with a 360s session opened at 328s
  left, 41s remaining counted as only 287s spent against a 300s trigger. And
  anything that remounts the component — a hot reload, and this repo has a
  second agent editing files — resets the span again mid-session.
- **Fix:** `auth.sessionLengthMs`, read from the token as `exp - iat`. The full
  span is a fact the token already carries; deriving it needs state, and the
  state was the bug. Threshold is now a fraction of that span, so it stays
  sensible whatever `STAFF_SESSION_MINUTES` is.
- **First diagnosis was wrong** and worth recording: background tabs really do
  throttle `setInterval` to ~1/min, and that looked like the cause. Reading the
  clock directly in `onActivity` is correct practice and stayed, but it fixed
  nothing — the observed span did. A plausible mechanism is not a cause.
- **Files:** `stores/auth.js`, `composables/useSessionGuard.js`.

### The artist grid throttled itself, and saving came back 429

- **Symptom:** "editing artists doesn't work". Pressing Sačuvaj did nothing —
  no toast, no error, panel stayed open. The catalogue looked fine.
- **Cause:** two things stacked. `imageUrl` stamped `?v=${imageVersion}` where
  `imageVersion = ref(Date.now())` — a *new value on every mount*, so every
  visit produced 125 brand-new URLs and the day-long `Cache-Control` that
  `serveImage` already sends never once applied. 125 image requests + the list
  call exceeded `publicLimiter` (120/min), so the tail of the grid 429'd and so
  did the next write.
- **Fix:** the cache key is now the image's own `imageUpdatedAt` (added to
  `toCard()`), stable across visits and different only when the picture changed.
  Backend gives stored images their own bucket and skips them in `publicLimiter`.
- **Note:** a failed save showing no message at all is what made this so hard to
  see. Worth checking the error path if it happens again.
- **Files:** `views/ArtistsView.vue`; backend `models/Artist.js`,
  `middleware/rateLimit.js`, `app.js`.

### An editor that opens above the fold looks like a dead button

- **Symptom:** "I need an option to edit artists" — for an artist near the
  bottom of 125, pressing Uredi appeared to do nothing.
- **Cause:** the panel renders at the top of the page. Opening it from row 120
  put the form ~2450px above the viewport and the page did not move, so on a
  full screen nothing visibly happened.
- **Fix:** `revealEditor()` — `nextTick`, `scrollIntoView` (honouring
  `prefers-reduced-motion`), and focus into the name field.
- **Note:** applies to any panel that renders somewhere other than where it was
  triggered from.
- **Files:** `views/ArtistsView.vue`.

### `vite build` dies on Node 20.11 with a `styleText` error

- **Symptom:** `failed to load config from vite.config.js` =>
  `'node:util' does not provide an export named 'styleText'`. Nothing to do with
  the config; the dev server on :8000 keeps running fine the whole time.
- **Cause:** `@iconify/utils` imports `styleText`, added in Node **20.12**.
  `/usr/local/bin/node` on this machine is v20.11.1, so a plain shell gets it
  while the dev server was started under an nvm version that has it.
- **Fix:** build with `~/.nvm/versions/node/v20.19.0/bin` on PATH. Do not go
  editing the config or reinstalling deps — the build is not broken.

## 7. Open threads

- [ ] **Artist biographies: 0 of 125.** Every living artist has an empty `bio`.
      The field is editable here; nobody has ever filled one in.
- [ ] **Artist photographs: 81 of 125.** 44 still show initials. The grid has a
      "bez slike" filter with a live count. Sourced from Wikimedia Commons by
      `mbid` => Wikidata => P18, never by name, and never `CC BY-NC` / `CC BY-ND`
      (NC forbids the use, ND forbids the crop).
- [ ] **307 songs sitting in the bin**, paged 25 at a time, left over from the
      import cleanup. Needs Mirnes: purge them or restore them.

Closed since the last pass: this repo now has 21 tests (`npm test`), and artists
soft-delete like songs and share the bin at `/trash`.

---

## 8. Anchor comments in code

| Tag | Use for |
|---|---|
| `AI-NOTE:` | Context a reader needs to not break this code |
| `AI-DECISION:` | Why it was built this way — link the AI-NOTES section |
| `AI-TRAP:` | A footgun; what happens if you "fix" it naively |
| `AI-TODO:` | Deliberate incomplete work, with what's missing |

```bash
rg 'AI-(NOTE|DECISION|TRAP|TODO):'
```

---

## 9. Session protocol

**Start:** read this file, `rg 'AI-(NOTE|DECISION|TRAP|TODO):'` over the area you
are touching, then check §7.

**Before ending** — or when Mirnes says "do a recap": add a §5 entry for every
non-obvious choice with its *why*, a §6 entry for every trap that cost time,
update §4 if a visual pattern changed, update §7, drop anchor comments, bump the
date. Record failed approaches too — they are the entry most often forgotten.
