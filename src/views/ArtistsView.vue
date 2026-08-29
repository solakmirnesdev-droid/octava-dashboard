<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import AppModal from '../components/AppModal.vue';
import { initials, avatarStyle } from '../utils/avatar';
import { filterByQuery } from '../utils/textFilter';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import IconAdd from '~icons/material-symbols/add-circle-outline-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import IconUpload from '~icons/material-symbols/upload-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconEdit from '~icons/material-symbols/edit-outline-rounded';
import IconPerson from '~icons/material-symbols/person-outline-rounded';
import IconFormatBold from '~icons/material-symbols/format-bold-rounded';
import IconFormatItalic from '~icons/material-symbols/format-italic-rounded';
import IconFormatStrikethrough from '~icons/material-symbols/format-strikethrough-rounded';
import IconLink from '~icons/material-symbols/link-rounded';
import IconFormatListBulleted from '~icons/material-symbols/format-list-bulleted-rounded';
import IconFormatQuote from '~icons/material-symbols/format-quote-rounded';

/**
 * Artists, and everything that hangs off one.
 *
 * Until now they only came into existence as a side effect of adding a song,
 * so nobody could give one a portrait, a country or a genre. This is the first
 * place they can be created on purpose.
 */
const toasts = useToasts();
const auth = useAuthStore();

const MAX_BYTES = 10 * 1024;

/** Countries the catalogue actually covers, plus the ones it borders. */
const COUNTRIES = [
  { code: 'BA', name: 'Bosna i Hercegovina' },
  { code: 'HR', name: 'Hrvatska' },
  { code: 'RS', name: 'Srbija' },
  { code: 'ME', name: 'Crna Gora' },
  { code: 'MK', name: 'Sjeverna Makedonija' },
  { code: 'SI', name: 'Slovenija' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'YU', name: 'Jugoslavija (istorijski)' },
  { code: 'AT', name: 'Austrija' },
  { code: 'DE', name: 'Njemačka' },
  { code: 'BG', name: 'Bugarska' },
  { code: 'AL', name: 'Albanija' }
];

/** The flag is derived, never stored — one country has exactly one. */
const flagOf = (code) => (code && /^[A-Z]{2}$/.test(code)
  ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : '');

const artists = ref([]);
const genres = ref([]);
const loading = ref(true);
const filter = ref('');
const countryFilter = ref('');

/**
 * Narrows the grid to artists with no photograph.
 *
 * AI-NOTE: 139 artists, none of them with an image. Without a way to see who is
 * still missing one, filling them in means scrolling the whole grid and holding
 * the answer in your head — so nobody does it. See AI-NOTES.md §7.
 */
const missingImage = ref(false);
const saving = ref(false);

/** null = closed, {} = creating, {…} = editing. */
const editing = ref(null);
const form = ref({ name: '', country: '', bio: '', genres: [] });
const fileInput = ref(null);
/** Bumped after an upload so the browser refetches instead of using its cache. */
/**
 * AI-TRAP: this used to be `ref(Date.now())`, stamped onto every portrait URL.
 * A fresh value on every mount meant a fresh URL on every visit, so the day-long
 * Cache-Control that serveImage already sends never once got used — all 125
 * images were refetched every time the screen opened. That alone spent the
 * public rate limit, and the next write (saving an edited artist) came back 429.
 * The key is now the image's own update time: stable across visits, different
 * only when the picture actually changed.
 */
const cacheKey = (a) => (a.imageUpdatedAt ? Date.parse(a.imageUpdatedAt) : 0);

const apiBase = import.meta.env.VITE_API_URL || '/api';

const visible = computed(() => {
  // Narrow by the checkboxes first, then rank what is left: the ordering the
  // filter produces is the answer to the query, and applying it before the
  // other conditions would only sort rows that are about to be dropped.
  const narrowed = artists.value.filter(
    (a) => (!missingImage.value || !a.hasImage)
        && (!countryFilter.value || a.country === countryFilter.value)
  );
  // AI-NOTE: was `name.toLowerCase().includes(q)`, which missed both things
  // people actually type — "zeljko" for Željko, and any typo at all.
  return filterByQuery(narrowed, filter.value, (a) => a.name);
});

/**
 * Every artist, not the first hundred.
 *
 * AI-TRAP: this used to be a single request with `limit: 100`, which is the
 * API's maximum. With 139 artists in the catalogue that silently hid 39 of them
 * — they could not be edited, given a country, or given a photograph, and
 * nothing on the page said a page two existed. The cap is right; the client has
 * to walk the pages.
 */
async function fetchAllArtists() {
  const out = [];
  let page = 1;
  let pages = 1;

  do {
    const { data } = await client.get('/artists', { params: { page, limit: 100 } });
    out.push(...(data.artists || []));
    pages = data.meta?.pages || 1;
    page += 1;
  } while (page <= pages);

  return out;
}

async function load() {
  loading.value = true;
  try {
    const [all, { data: g }] = await Promise.all([fetchAllArtists(), client.get('/genres')]);
    artists.value = all;
    genres.value = g.genres || [];
  } catch {
    toasts.error('Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

/**
 * Brings the editor into view.
 *
 * AI-TRAP: the panel renders at the top of the page, above a grid of 125
 * artists. Pressing "Uredi" on anybody below the fold used to look like a dead
 * button — the form opened two thousand pixels above the viewport and the
 * screen did not move, so editing appeared not to exist at all. Anything that
 * opens this panel has to reveal it.
 */
const editor = ref(null);

async function revealEditor() {
  await nextTick();
  if (!editor.value) return;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  editor.value.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  // Focus the name rather than the panel: it says which artist you are on and
  // is the field most edits change.
  editor.value.querySelector('input')?.focus({ preventScroll: true });
}

const stagedImageFile = ref(null);
const stagedImagePreview = ref(null);
const stagedImageRemove = ref(false);

function resetStagedImage() {
  if (stagedImagePreview.value && stagedImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(stagedImagePreview.value);
  }
  stagedImageFile.value = null;
  stagedImagePreview.value = null;
  stagedImageRemove.value = false;
}

function startCreate() {
  editing.value = {};
  resetStagedImage();
  form.value = { name: '', country: '', origin: '', website: '', activeFrom: '', activeTo: '', bio: '', genres: [] };
  revealEditor();
}

function startEdit(a) {
  editing.value = a;
  loadEditSongs(a);
  resetStagedImage();
  form.value = {
    name: a.name,
    country: a.country || '',
    origin: a.origin || '',
    website: a.website || '',
    activeFrom: a.activeFrom || '',
    activeTo: a.activeTo || '',
    bio: a.bio || '',
    genres: (a.genres || []).map((g) => g.slug || g)
  };
  revealEditor();
}

function cancelEdit() {
  resetStagedImage();
  editing.value = null;
}

async function save() {
  if (!form.value.name.trim()) { toasts.error('Ime je obavezno.'); return; }
  saving.value = true;
  try {
    const body = {
      name: form.value.name.trim(),
      country: form.value.country || null,
      origin: form.value.origin,
      website: form.value.website,
      // '' clears the year, which is what the API expects; absent would leave
      // whatever the MusicBrainz pass wrote in place.
      activeFrom: form.value.activeFrom,
      activeTo: form.value.activeTo,
      bio: form.value.bio,
      genres: form.value.genres
    };
    const isNew = !editing.value?._id;
    const { data } = isNew
      ? await client.post('/artists', body)
      : await client.put(`/artists/${editing.value._id}`, body);

    const artistId = data.artist._id;

    // Apply staged image changes
    if (stagedImageFile.value) {
      await client.post(`/artists/${artistId}/image`, stagedImageFile.value, {
        headers: { 'Content-Type': 'image/webp' }
      });
    } else if (stagedImageRemove.value && !isNew && editing.value?.hasImage) {
      await client.delete(`/artists/${artistId}/image`);
    }

    resetStagedImage();
    toasts.success(isNew ? `Dodan: ${data.artist.name}` : 'Izmjene sačuvane.');
    editing.value = null;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Spašavanje nije uspjelo.');
  } finally {
    saving.value = false;
  }
}

/**
 * The songs filed under the artist being edited.
 *
 * AI-DECISION: read from the public GET /artists/:slug rather than a new admin
 * endpoint. That route already returns an artist's songs sorted and paged, and
 * it widens to include drafts when the caller is staff — which the dashboard
 * always is. A second endpoint would have been the same query with a different
 * name in front of it.
 *
 * Why it belongs here at all: the panel is where somebody decides to delete an
 * artist, and until now the only thing on the screen saying what that costs was
 * a number in the row behind it.
 */
const editSongs = ref([]);
const editSongsTotal = ref(0);
const editSongsLoading = ref(false);

async function loadEditSongs(artist) {
  editSongs.value = [];
  editSongsTotal.value = 0;
  if (!artist?.slug) return;

  editSongsLoading.value = true;
  try {
    const { data } = await client.get(`/artists/${artist.slug}`, { params: { limit: 100 } });
    editSongs.value = data.songs || [];
    editSongsTotal.value = data.meta?.total ?? editSongs.value.length;
  } catch {
    // A panel that cannot list the songs is still a usable panel; the count in
    // the row behind it is not wrong, only less detailed.
    editSongs.value = [];
  } finally {
    editSongsLoading.value = false;
  }
}

const removingArtist = ref(null);

/**
 * AI-TRAP: withSongs is what the API refuses to assume. Without it a deletion
 * of an artist who has songs comes back 409 and nothing happens — which is the
 * right default for anything calling the API, and wrong only here, where the
 * dialog has just said the number out loud and been answered.
 */
async function removeArtist(a) {
  try {
    const { data } = await client.delete(`/artists/${a._id}`, { params: { withSongs: 1 } });
    toasts.success(data.songs ? `Obrisan — ${data.songs} pjesama u kanti.` : 'Obrisan.');
    if (editing.value?._id === a._id) cancelEdit();
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Brisanje nije uspjelo.');
  }
}

/**
 * Validates image locally before staging it for upload upon save.
 */
async function pickImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_BYTES) {
    toasts.error(`Slika je ${(file.size / 1024).toFixed(1)} KB; najviše je 10 KB.`);
    event.target.value = '';
    return;
  }

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...head.slice(from, to));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') {
    toasts.error('Slika mora biti u WebP formatu.');
    event.target.value = '';
    return;
  }

  if (stagedImagePreview.value && stagedImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(stagedImagePreview.value);
  }

  stagedImageFile.value = file;
  stagedImagePreview.value = URL.createObjectURL(file);
  stagedImageRemove.value = false;
  event.target.value = '';
}

function removeImage() {
  if (stagedImagePreview.value && stagedImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(stagedImagePreview.value);
  }
  stagedImageFile.value = null;
  stagedImagePreview.value = null;
  stagedImageRemove.value = true;
}

/** Only the countries the loaded artists actually have. */
const presentCountries = computed(() => {
  const counts = new Map();
  for (const a of artists.value) {
    if (a.country) counts.set(a.country, (counts.get(a.country) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      count,
      name: COUNTRIES.find((c) => c.code === code)?.name || code
    }))
    .sort((x, y) => y.count - x.count);
});

/**
 * Paged in the client, like the fingerprints list and for the same reason: the
 * whole set stays in memory so the filter searches all 125 rather than whatever
 * page happened to be on screen, and only the rendering is cut.
 *
 * 48 a page because the grid is two columns at sm and three at lg — a number
 * divisible by both leaves no ragged last row at either width.
 */
const PER_PAGE = 48;
const page = ref(1);

const pageCount = computed(() => Math.max(1, Math.ceil(visible.value.length / PER_PAGE)));

const pageArtists = computed(() => {
  const start = (page.value - 1) * PER_PAGE;
  return visible.value.slice(start, start + PER_PAGE);
});

// Narrowing to fewer pages than the one being read would leave an empty grid
// with no way back to the rows that are still there.
watch([filter, countryFilter, missingImage], () => { page.value = 1; });
watch(pageCount, (count) => { if (page.value > count) page.value = count; });

function turn(to) {
  page.value = Math.min(pageCount.value, Math.max(1, to));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const withoutImage = computed(() => artists.value.filter((a) => !a.hasImage).length);

const imageUrl = (a) => `${apiBase}/artists/${a._id}/image?v=${cacheKey(a)}`;

onMounted(load);
</script>

<template>
  <section>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Izvođači</h1>
      <span class="text-sm text-faint">{{ artists.length }}</span>

      <select
        v-model="countryFilter"
        class="rounded border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent"
        aria-label="Filtriraj po zemlji"
      >
        <option value="">sve zemlje</option>
        <option v-for="c in presentCountries" :key="c.code" :value="c.code">
          {{ c.name }} ({{ c.count }})
        </option>
      </select>

      <span v-if="withoutImage" class="text-xs text-muted">
        {{ withoutImage }} bez slike
      </span>

      <input
        v-model="filter" placeholder="Filtriraj po imenu"
        class="ml-auto w-56 rounded border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent"
      >
      <button
        class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent"
        @click="startCreate"
      >
        <span class="flex items-center gap-1.5"><IconAdd /> Novi izvođač</span>
      </button>
    </div>

    <!-- The editor sits above the list rather than in a dialog: uploading a
         picture and checking it against the others is one task, not two. -->
    <div v-if="editing" ref="editor" class="mb-6 rounded border border-accent/30 bg-accent/[0.03] px-4 py-4">
      <h2 class="mb-3 text-sm font-medium">
        {{ editing._id ? `Uređivanje: ${editing.name}` : 'Novi izvođač' }}
      </h2>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block">
          <span class="text-sm font-medium">Ime</span>
          <input
            v-model="form.name"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
        </label>

        <label class="block">
          <span class="text-sm font-medium">Zemlja</span>
          <select
            v-model="form.country"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
            <option value="">— bez zemlje —</option>
            <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">
              {{ flagOf(c.code) }} {{ c.name }}
            </option>
          </select>
        </label>

        <label class="block">
          <span class="text-sm font-medium">Porijeklo <span class="font-normal text-faint">(grad)</span></span>
          <input
            v-model="form.origin" maxlength="80" placeholder="npr. Sarajevo"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
        </label>

        <label class="block">
          <span class="text-sm font-medium">Sajt <span class="font-normal text-faint">(nije obavezno)</span></span>
          <input
            v-model="form.website" maxlength="200" placeholder="https://"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
        </label>

        <label class="block">
          <span class="text-sm font-medium">Djeluje od <span class="font-normal text-faint">(godina)</span></span>
          <input
            v-model="form.activeFrom" type="number" min="1800" max="2100" placeholder="npr. 1974"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
        </label>

        <label class="block">
          <span class="text-sm font-medium">do <span class="font-normal text-faint">(prazno = i dalje aktivan)</span></span>
          <input
            v-model="form.activeTo" type="number" min="1800" max="2100" placeholder="npr. 1989"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
        </label>

        <!-- Everything above is shown on the artist's public page and the API
             has always accepted it; this form simply never sent any of it, so
             the only values that existed were whatever the MusicBrainz pass
             happened to write. -->
        <div class="lg:col-span-4">
          <span class="text-sm font-medium">Rubrike</span>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <label v-for="g in genres" :key="g.slug" class="flex items-center gap-1.5 text-sm">
              <input v-model="form.genres" type="checkbox" :value="g.slug" class="accent-accent">
              {{ g.name }}
            </label>
          </div>
        </div>
      </div>

      <!-- Biografija with Microsoft Word-like formatting toolbar -->
      <div class="mt-4">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium">Biografija</span>

          <div class="flex flex-wrap items-center gap-0.5 rounded border border-line-strong bg-raised/60 p-0.5 text-xs">
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-panel hover:text-ink transition"
              title="Podebljano (Bold) - **tekst**"
              @click="wrapSelection('**', '**', 'podebljano')"
            >
              <IconFormatBold class="text-sm" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-panel hover:text-ink transition"
              title="Kurziv (Italic) - *tekst*"
              @click="wrapSelection('*', '*', 'kurziv')"
            >
              <IconFormatItalic class="text-sm" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-panel hover:text-ink transition"
              title="Precrtano (Strikethrough) - ~~tekst~~"
              @click="wrapSelection('~~', '~~', 'precrtano')"
            >
              <IconFormatStrikethrough class="text-sm" />
            </button>

            <span class="mx-0.5 h-3.5 w-px bg-line" aria-hidden="true" />

            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-panel hover:text-ink transition"
              title="Link - [naslov](https://...)"
              @click="insertLink"
            >
              <IconLink class="text-sm" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-panel hover:text-ink transition"
              title="Lista sa tačkama"
              @click="insertLinePrefix('• ')"
            >
              <IconFormatListBulleted class="text-sm" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-panel hover:text-ink transition"
              title="Citat / Navod"
              @click="insertLinePrefix('> ')"
            >
              <IconFormatQuote class="text-sm" />
            </button>

            <span class="mx-0.5 h-3.5 w-px bg-line" aria-hidden="true" />

            <button
              type="button"
              class="rounded px-2 py-0.5 text-[11px] font-medium transition"
              :class="bioPreview ? 'bg-accent text-on-accent' : 'text-muted hover:bg-panel hover:text-ink'"
              @click="bioPreview = !bioPreview"
            >
              {{ bioPreview ? 'Uredi' : 'Pregled' }}
            </button>
          </div>
        </div>

        <div
          v-if="bioPreview"
          class="min-h-[5.5rem] rounded border border-line-strong bg-panel/70 p-3 text-xs leading-relaxed text-ink"
        >
          <div v-if="form.bio" v-html="renderBioPreview(form.bio)" />
          <span v-else class="text-faint italic">Prazna biografija…</span>
        </div>

        <textarea
          v-else
          ref="bioInput"
          v-model="form.bio"
          rows="3"
          maxlength="2000"
          placeholder="Upiši biografiju (koristi alatnu traku iznad za podebljano, kurziv, precrtano, linkove, liste)…"
          class="w-full rounded border border-line-strong bg-panel px-3 py-2 text-xs leading-relaxed outline-none focus:border-accent font-sans"
        />

        <div class="mt-1 flex items-center justify-between text-[11px] text-faint">
          <span>Formatiranje: **podebljano**, *kurziv*, ~~precrtano~~, [link](https://), • lista, > citat</span>
          <span>{{ (form.bio || '').length }} / 2000</span>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-4">
        <!-- Staged preview or existing saved image or fallback -->
        <img
          v-if="stagedImagePreview"
          :src="stagedImagePreview"
          alt="Pregled slike"
          class="size-16 rounded object-cover ring-2 ring-accent"
        >
        <img
          v-else-if="!stagedImageRemove && editing.hasImage"
          :src="imageUrl(editing)"
          alt=""
          class="size-16 rounded object-cover ring-1 ring-line"
        >
        <div v-else class="flex size-16 items-center justify-center rounded bg-raised text-dim">
          <IconPerson class="text-2xl" />
        </div>

        <div>
          <input ref="fileInput" type="file" accept="image/webp" class="hidden" @change="pickImage">
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded border border-line-strong px-3 py-1.5 text-sm hover:border-accent"
              @click="fileInput.click()"
            >
              <span class="flex items-center gap-1.5">
                <IconUpload />
                {{ (stagedImagePreview || (!stagedImageRemove && editing.hasImage)) ? 'Promijeni sliku' : 'Postavi sliku' }}
              </span>
            </button>
            <button
              v-if="stagedImagePreview || (!stagedImageRemove && editing.hasImage)"
              type="button"
              class="rounded border border-line-strong px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
              @click="removeImage"
            >
              <span class="flex items-center gap-1.5"><IconDelete /> Ukloni</span>
            </button>
          </div>
          <p class="mt-1 text-xs text-faint">WebP, najviše 10 KB. Slika se spašava klikom na „Sačuvaj”.</p>
        </div>
      </div>

      <div v-if="editing._id" class="mt-5 border-t border-line-soft pt-4">
        <h3 class="mb-2 text-sm font-medium">
          Pjesme
          <span class="ml-1 font-mono text-xs font-normal text-faint">{{ editSongsTotal }}</span>
        </h3>

        <p v-if="editSongsLoading" class="text-sm text-faint">Učitavanje…</p>
        <p v-else-if="!editSongs.length" class="text-sm text-muted">Nema nijedne pjesme.</p>

        <ul v-else class="max-h-64 divide-y divide-line-soft overflow-y-auto rounded border border-line">
          <li
            v-for="song in editSongs" :key="song._id"
            class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <RouterLink
              :to="`/songs/${song._id}/edit`"
              class="truncate text-body transition-colors hover:text-accent"
            >{{ song.title }}</RouterLink>

            <span
              v-if="song.status === 'draft'"
              class="shrink-0 rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-warn"
            >skica</span>
          </li>
        </ul>

      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded px-4 py-2 text-sm text-muted hover:text-accent" @click="cancelEdit">
          Zatvori
        </button>
        <button
          class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
          :disabled="saving" @click="save"
        >{{ saving ? 'Spašavanje…' : 'Sačuvaj' }}</button>
      </div>
    </div>

    <p v-if="loading" class="text-sm text-faint">Učitavanje…</p>

    <ul v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="a in pageArtists" :key="a._id"
        class="flex items-center gap-3 rounded border border-line bg-panel px-3 py-2"
      >
        <img
          v-if="a.hasImage" :src="imageUrl(a)" alt=""
          class="size-10 shrink-0 rounded object-cover ring-1 ring-line"
        >
        <!-- The same stand-in the public site draws, so what a reviewer sees
             here is what a reader sees there. -->
        <div
          v-else
          :style="avatarStyle(a.name)"
          class="flex size-10 shrink-0 items-center justify-center rounded text-sm font-semibold ring-1 ring-line"
        >{{ initials(a.name) }}</div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">
            <span v-if="a.flag" class="mr-1">{{ a.flag }}</span>{{ a.name }}
          </p>
          <p class="flex items-center gap-2 text-xs text-faint">
            <span>{{ a.songCount }} pjesama</span>
            <!-- Guarded on ratingCount, not on rating: an artist nobody has
                 rated scores 0, and printing "0.0" reads as a bad review
                 rather than as no reviews. -->
            <span v-if="a.ratingCount" class="font-mono">★ {{ a.rating.toFixed(1) }} ({{ a.ratingCount }})</span>
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <button
            class="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted transition hover:bg-raised hover:text-accent"
            title="Uredi izvođača"
            @click="startEdit(a)"
          >
            <IconEdit class="text-sm" />
            <span>Uredi</span>
          </button>
          <button
            v-if="auth.hasRole('admin')"
            class="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted transition hover:bg-danger-soft hover:text-danger"
            :title="a.songCount ? `Obriši izvođača i njegovih ${a.songCount} pjesama` : 'Obriši izvođača'"
            @click="removingArtist = a"
          >
            <IconDelete class="text-sm" />
            <span>Obriši</span>
          </button>
        </div>
      </li>
    </ul>

    <nav v-if="pageCount > 1" class="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
      <button
        class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
        :disabled="page <= 1" @click="turn(page - 1)"
      ><span class="flex items-center gap-1"><IconPrev /> Prethodna</span></button>

      <span class="text-muted">{{ page }} / {{ pageCount }}</span>

      <button
        class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
        :disabled="page >= pageCount" @click="turn(page + 1)"
      ><span class="flex items-center gap-1">Sljedeća <IconNext /></span></button>

      <span class="w-full text-center font-mono text-xs text-faint">
        {{ pageArtists.length }} od {{ visible.length }}
      </span>
    </nav>

    <AppModal
      :model-value="Boolean(removingArtist)"
      title="Obrisati izvođača?"
      :description="removingArtist
        ? (removingArtist.songCount
          ? `Sigurno? Zajedno s izvođačem „${removingArtist.name}“ u kantu ide i svih ${removingArtist.songCount} njegovih pjesama. Sve nestaje sa sajta, i sve se može vratiti zajedno.`
          : `„${removingArtist.name}“ ide u kantu i nestaje sa sajta. Može se vratiti.`)
        : ''"
      confirm-label="Obriši"
      tone="danger"
      @update:model-value="(open) => { if (!open) removingArtist = null; }"
      @confirm="() => { const a = removingArtist; removingArtist = null; removeArtist(a); }"
    />
  </section>
</template>
