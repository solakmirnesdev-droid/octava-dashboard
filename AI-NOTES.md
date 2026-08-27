# AI-NOTES — octava-dashboard

> **Entry file for every AI session on this project.** Read this first, before
> touching any code. Update it before you finish. It exists because context
> windows end and sessions reset — this file is the memory that survives.
>
> Single source of truth. [AGENTS.md](./AGENTS.md) points other tools here.

**Last updated:** 2026-08-27

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

---

## 6. Traps & gotchas

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

## 7. Open threads

- [ ] **No tests in this repo at all.** The backend has 124. Anything worth
      covering should move into the API where it can be.
- [ ] **Artist photographs: 0 of 139.** Uploadable here (WebP, ≤10 KB); the
      grid has a "bez slike" filter with a live count to work through them.
      Initials stand in until then. Needs Mirnes — press images carry rights and
      there is no source to pull from.
- [ ] Soft delete covers songs only. Deleting an artist in `ArtistsView` is still
      permanent — `artistAdminController.remove` hard-deletes.

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
