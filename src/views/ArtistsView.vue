<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import AppModal from '../components/AppModal.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { initials, avatarStyle } from '../utils/avatar';
import { filterByQuery } from '../utils/textFilter';
import { strum } from '../utils/chordAudio';
import { findFingering } from '../utils/chordEngine';
import { lockModalScroll } from '../utils/modalLock';
import client from '../api/client';
import { useRefreshOnVisible } from '../composables/useRefreshOnVisible';
import { useLiveData } from '../composables/useLiveData';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import IconAdd from '~icons/material-symbols/add-rounded';
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
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconClose from '~icons/material-symbols/close-rounded';
import IconGrid from '~icons/material-symbols/grid-view-rounded';
import IconList from '~icons/material-symbols/view-list-rounded';
import IconImage from '~icons/material-symbols/image-outline-rounded';
import IconLocation from '~icons/material-symbols/location-on-outline-rounded';
import IconViews from '~icons/material-symbols/visibility-rounded';
import IconSaved from '~icons/material-symbols/favorite-rounded';
import IconPlay from '~icons/material-symbols/play-circle-outline-rounded';
import IconVolume from '~icons/material-symbols/volume-up-rounded';
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded';
import IconPending from '~icons/material-symbols/pending-actions-rounded';
import IconWarning from '~icons/material-symbols/warning-rounded';

/**
 * Artists and discography management view.
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

/** Alphabet scrubber index for Ex-Yu music directories */
const ALPHABET = ['Sve', '#', 'A', 'B', 'C', 'Č', 'Ć', 'D', 'Dž', 'Đ', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'Lj', 'M', 'N', 'Nj', 'O', 'P', 'R', 'S', 'Š', 'T', 'U', 'V', 'Z', 'Ž'];
const activeLetter = ref('Sve');

/** Layout view mode: 'grid' or 'table' */
const viewMode = ref('grid');

/** Sorting modes */
const sortBy = ref('name_asc');

/** The flag is derived, never stored — one country has exactly one. */
const flagOf = (code) => (code && /^[A-Z]{2}$/.test(code)
  ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : '');

const artists = ref([]);

/** Server paging for the list, and the counts it cannot carry per page. */
const meta = ref(null);
const facets = ref({ total: 0, withoutCountry: 0, withoutImage: 0, countries: [] });
const genres = ref([]);
const loading = ref(true);
const filter = ref('');
const countryFilter = ref('');
const missingImage = ref(false);
const missingCountry = ref(false);
const saving = ref(false);

/** null = closed, {} = creating, {…} = editing. */
const editing = ref(null);
const form = ref({ name: '', country: '', origin: '', website: '', activeFrom: '', activeTo: '', bio: '', genres: [] });
const fileInput = ref(null);
const bioInput = ref(null);
const bioPreview = ref(false);

/** Bumped after an upload so the browser refetches instead of using its cache. */
const cacheKey = (a) => (a.imageUpdatedAt ? Date.parse(a.imageUpdatedAt) : 0);

const apiBase = import.meta.env.VITE_API_URL || '/api';
const failedImages = ref(new Set());

// The server returns exactly the page asked for; nothing left to narrow here.
const visible = computed(() => artists.value);

let isFetching = false;
const highlightedArtistIds = ref(new Set());
const badgePopping = ref(false);
const statsPopping = ref(false);
let highlightTimer = null;
let previousArtistMap = new Map();

function triggerUpdatePulse() {
  statsPopping.value = true;
  badgePopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
    badgePopping.value = false;
  }, 1200);
}

function trackAndHighlightArtists(newArtists) {
  if (previousArtistMap.size > 0) {
    const updatedIds = new Set();
    for (const a of newArtists) {
      const prev = previousArtistMap.get(a._id);
      if (!prev || prev.songCount !== a.songCount || prev.hasImage !== a.hasImage || prev.name !== a.name) {
        updatedIds.add(a._id);
      }
    }
    if (updatedIds.size > 0) {
      highlightedArtistIds.value = updatedIds;
      triggerUpdatePulse();
      clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => {
        highlightedArtistIds.value = new Set();
      }, 2400);
    }
  }

  const nextMap = new Map();
  for (const a of newArtists) {
    nextMap.set(a._id, { songCount: a.songCount, hasImage: a.hasImage, name: a.name });
  }
  previousArtistMap = nextMap;
}

watch(() => artists.value.length, (newLen, oldLen) => {
  if (oldLen !== undefined && newLen !== oldLen) {
    triggerUpdatePulse();
  }
});

/**
 * One page, filtered where the data is.
 *
 * AI-DECISION: this used to page through the whole roster — 29 requests and
 * 1.1MB for 2,813 performers — and then filter in the browser. Every filter it
 * applied has a server parameter behind it (q, country, letter, gap), and the
 * three numbers it tallied by hand now come from /artists/facets in one
 * aggregate. What is left is a page of 48.
 *
 * AI-TRAP: `gap` and `country` are mutually exclusive by construction. Asking
 * for artists with no country AND with country=RS returns nothing, which reads
 * as a broken filter rather than an impossible question — so the country
 * dropdown is cleared when a gap filter is turned on.
 */
async function load() {
  if (isFetching) return;
  isFetching = true;
  if (!artists.value.length) {
    loading.value = true;
  }
  try {
    const params = {
      page: page.value,
      limit: PER_PAGE,
      q: filter.value.trim() || undefined,
      country: countryFilter.value || undefined,
      letter: activeLetter.value !== 'Sve' ? activeLetter.value : undefined,
      gap: missingCountry.value ? 'country' : (missingImage.value ? 'image' : undefined)
    };

    const [{ data }, { data: g }, { data: f }] = await Promise.all([
      client.get('/artists', { params }),
      client.get('/genres'),
      client.get('/artists/facets')
    ]);

    artists.value = data.artists || [];
    meta.value = data.meta || null;
    facets.value = f;
    genres.value = g.genres || [];
    trackAndHighlightArtists(artists.value);
  } catch (err) {
    console.warn('Učitavanje izvođača nije uspjelo:', err);
    if (!artists.value.length) {
      toasts.error('Učitavanje nije uspjelo.');
    }
  } finally {
    isFetching = false;
    loading.value = false;
  }
}

const editor = ref(null);

async function revealEditor() {
  await nextTick();
  if (!editor.value) return;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  editor.value.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
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

function wrapSelection(prefix, suffix, defaultText = 'tekst') {
  if (!bioInput.value) return;
  const el = bioInput.value;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const current = form.value.bio || '';
  const selected = current.slice(start, end) || defaultText;
  const before = current.slice(0, start);
  const after = current.slice(end);

  form.value.bio = `${before}${prefix}${selected}${suffix}${after}`;

  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  });
}

function insertLinePrefix(prefix) {
  if (!bioInput.value) return;
  const el = bioInput.value;
  const start = el.selectionStart ?? 0;
  const current = form.value.bio || '';
  const lineStart = current.lastIndexOf('\n', start - 1) + 1;
  const before = current.slice(0, lineStart);
  const after = current.slice(lineStart);

  form.value.bio = `${before}${prefix}${after}`;
  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length);
  });
}

function insertLink() {
  if (!bioInput.value) return;
  const el = bioInput.value;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const current = form.value.bio || '';
  const selected = current.slice(start, end) || 'tekst linka';
  const before = current.slice(0, start);
  const after = current.slice(end);

  const snippet = `[${selected}](https://)`;
  form.value.bio = `${before}${snippet}${after}`;
  nextTick(() => {
    el.focus();
    const urlStart = start + snippet.indexOf('https://');
    el.setSelectionRange(urlStart, urlStart + 8);
  });
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderBioPreview(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del class="opacity-75">$1</del>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent underline hover:no-underline">$1</a>');
  html = html.replace(/^• (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-accent/60 pl-2 text-muted italic my-1">$1</blockquote>');
  return html.replace(/\n/g, '<br>');
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
    editSongs.value = [];
  } finally {
    editSongsLoading.value = false;
  }
}

/**
 * Artist Discography Modal state and live filtering
 */
const selectedArtist = ref(null);
const artistSongs = ref([]);
const artistSongsLoading = ref(false);
const artistSongQuery = ref('');
const artistSongStatus = ref('all');
const artistSongSort = ref('title_asc');
const songBusyId = ref(null);

watch(selectedArtist, (val) => {
  lockModalScroll(Boolean(val));
});

onBeforeUnmount(() => {
  if (selectedArtist.value) lockModalScroll(false);
});

async function openArtistSongs(artist) {
  selectedArtist.value = artist;
  artistSongs.value = [];
  artistSongQuery.value = '';
  artistSongStatus.value = 'all';
  artistSongSort.value = 'title_asc';
  artistSongsLoading.value = true;

  try {
    let list = [];
    if (artist.slug) {
      try {
        const { data } = await client.get(`/artists/${artist.slug}`, { params: { limit: 250 } });
        list = data.artist?.songs || data.songs || [];
      } catch (err) {
        console.warn('Slug lookup failed, trying id:', err);
      }
    }
    if (!list.length && artist._id) {
      const { data } = await client.get('/songs', { params: { artist: artist._id, limit: 250 } });
      list = data.songs || [];
    }
    artistSongs.value = list;
  } catch (err) {
    toasts.error('Učitavanje pjesama nije uspjelo.');
  } finally {
    artistSongsLoading.value = false;
  }
}

function closeArtistSongs() {
  selectedArtist.value = null;
  artistSongs.value = [];
  artistSongQuery.value = '';
}

const artistPublishedCount = computed(() => artistSongs.value.filter((s) => s.status === 'published').length);
const artistDraftCount = computed(() => artistSongs.value.filter((s) => s.status === 'draft').length);
const artistNoChordsCount = computed(() => artistSongs.value.filter((s) => (s.tags || []).includes('bez-akorda') || !s.chords?.length).length);

const filteredArtistSongs = computed(() => {
  let list = artistSongs.value;

  if (artistSongStatus.value === 'published') {
    list = list.filter((s) => s.status === 'published');
  } else if (artistSongStatus.value === 'draft') {
    list = list.filter((s) => s.status === 'draft');
  } else if (artistSongStatus.value === 'bez-akorda') {
    list = list.filter((s) => (s.tags || []).includes('bez-akorda') || !s.chords?.length);
  }

  if (artistSongQuery.value.trim()) {
    list = filterByQuery(list, artistSongQuery.value, (s) => `${s.title} ${s.originalKey || ''} ${(s.tags || []).join(' ')}`);
  }

  return [...list].sort((a, b) => {
    if (artistSongSort.value === 'title_asc') return (a.title || '').localeCompare(b.title || '', 'bs');
    if (artistSongSort.value === 'title_desc') return (b.title || '').localeCompare(a.title || '', 'bs');
    if (artistSongSort.value === 'views') return (b.views || 0) - (a.views || 0);
    if (artistSongSort.value === 'key') return (a.originalKey || '').localeCompare(b.originalKey || '', 'bs');
    return 0;
  });
});

function playTonic(keyName, e) {
  if (e) e.stopPropagation();
  if (!keyName) return;
  try {
    const fingering = findFingering(keyName.trim());
    if (fingering && fingering.frets) {
      strum(fingering.frets, { direction: 'down', volume: 0.7 });
    }
  } catch (err) {
    console.warn('Greška pri reprodukciji akorda:', err);
  }
}

async function toggleSongStatus(song, e) {
  if (e) e.stopPropagation();
  if (songBusyId.value === song._id) return;
  const previous = song.status;
  const next = previous === 'published' ? 'draft' : 'published';
  song.status = next;
  songBusyId.value = song._id;

  try {
    await client.patch(`/songs/${song._id}`, { status: next });
    toasts.success(
      next === 'published' ? `Objavljeno: ${song.title}` : `Skinuto s objave: ${song.title}`
    );
  } catch (err) {
    song.status = previous;
    toasts.error(err.response?.data?.message || 'Promjena statusa nije uspjela.');
  } finally {
    songBusyId.value = null;
  }
}

const removingArtist = ref(null);

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

const presentCountries = computed(() =>
  facets.value.countries.map((c) => ({
    code: c.code,
    count: c.count,
    name: COUNTRIES.find((x) => x.code === c.code)?.name || c.code
  }))
);

const PER_PAGE = 48;
const page = ref(1);

const pageCount = computed(() => Math.max(1, meta.value?.pages || 1));

const pageArtists = computed(() => {
  return artists.value;
});

watch([filter, countryFilter, missingImage, missingCountry, activeLetter], () => {
  page.value = 1;
  load();
});
watch(page, load);
watch(pageCount, (count) => { if (page.value > count) page.value = count; });

function turn(to) {
  page.value = Math.min(pageCount.value, Math.max(1, to));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const withoutImage = computed(() => facets.value.withoutImage);
const withoutCountry = computed(() => facets.value.withoutCountry);

const imageUrl = (a) => `${apiBase}/artists/${a._id}/image?v=${cacheKey(a)}`;

// The list fetches once. Another session, a script or an import can change
// what it is showing; coming back to the tab refetches.
useRefreshOnVisible(load);

// Live while somebody is looking at it: each card shows a song count, so a song moving changes this screen too.
// useRefreshOnVisible covers the other half — coming back to a tab that sat
// hidden, and a page restored from the bfcache, where no socket event arrives.
useLiveData(['artists', 'songs'], load);

onMounted(load);
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header / Action Row -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Izvođači
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Katalog muzičkih izvođača, biografije, profilne slike i diskografija.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <!-- Grid / Table View Switcher -->
        <div class="flex items-center rounded-xl border border-line-strong bg-panel p-1 shadow-2xs">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer"
            :class="viewMode === 'grid' ? 'bg-ink text-on-ink font-bold shadow-xs' : 'text-muted hover:text-ink'"
            title="Prikaz u mreži (kartice)"
            @click="viewMode = 'grid'"
          >
            <IconGrid class="text-sm" />
            <span class="hidden sm:inline">Mreža</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer"
            :class="viewMode === 'table' ? 'bg-ink text-on-ink font-bold shadow-xs' : 'text-muted hover:text-ink'"
            title="Tabelarni prikaz"
            @click="viewMode = 'table'"
          >
            <IconList class="text-sm" />
            <span class="hidden sm:inline">Tabela</span>
          </button>
        </div>

        <!-- Create Artist Button -->
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs sm:text-sm font-bold text-on-accent hover:brightness-110 active:scale-95 transition shadow-xs cursor-pointer"
          @click="startCreate"
        >
          <IconAdd class="text-base" />
          <span>Novi izvođač</span>
        </button>
      </div>
    </div>

    <!-- Quick Insights Metric Tiles (Clickable as fast filters) -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <!-- 1. Ukupno izvođača -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          !missingImage && !missingCountry && activeLetter === 'Sve' && !filter && !countryFilter ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="countryFilter = ''; missingImage = false; missingCountry = false; activeLetter = 'Sve'; filter = ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconPerson class="text-sm text-accent" /> Ukupno izvođača
          </span>
          <span class="text-[10px] text-faint font-mono">Katalog</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ artists.length }}
          </span>
          <span class="text-[11px] text-faint">u bazi</span>
        </div>
      </div>

      <!-- 2. Bez slike -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          missingImage ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="missingImage = !missingImage"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconImage class="text-sm text-accent" /> Bez slike
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Treba sliku</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-accent" :class="{ 'animate-count-bump': statsPopping }">
            {{ withoutImage }}
          </span>
          <span class="text-[11px] text-faint">izvođača</span>
        </div>
      </div>

      <!-- 3. Bez države -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          missingCountry ? 'border-warn ring-2 ring-warn/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="missingCountry = !missingCountry"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconLocation class="text-sm text-warn" /> Bez države
          </span>
          <span class="text-[10px] text-warn font-bold font-mono">Nepopunjeno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-warn" :class="{ 'animate-count-bump': statsPopping }">
            {{ withoutCountry }}
          </span>
          <span class="text-[11px] text-faint">izvođača</span>
        </div>
      </div>

      <!-- 4. Sa slikom -->
      <div
        class="rounded-2xl border border-line bg-panel p-3.5 shadow-2xs"
        :class="statsPopping ? 'animate-pulse-glow' : ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCheckCircle class="text-sm text-ok" /> Sa slikom
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">Pokriveno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ Math.max(0, artists.length - withoutImage) }}
          </span>
          <span class="text-[11px] text-faint font-mono">({{ artists.length ? Math.round(((artists.length - withoutImage) / artists.length) * 100) : 0 }}%)</span>
        </div>
      </div>
    </div>

    <!-- Alphabet Scrubber Bar (Ex-Yu Music Index) -->
    <div class="mb-4 rounded-2xl border border-line bg-panel/80 backdrop-blur-sm p-1.5 shadow-2xs">
      <div class="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
        <button
          v-for="letter in ALPHABET"
          :key="letter"
          type="button"
          class="shrink-0 rounded-lg px-2 py-1 text-xs font-bold transition cursor-pointer active:scale-95"
          :class="activeLetter === letter
            ? 'bg-accent text-on-accent shadow-xs scale-105'
            : 'text-muted hover:bg-raised hover:text-ink'"
          @click="activeLetter = letter"
        >
          {{ letter }}
        </button>
      </div>
    </div>

    <!-- Search, Country & Sort Filter Bar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line-soft bg-panel p-2.5 shadow-2xs text-xs">
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[16rem]">
        <!-- Search Input with Clear Button -->
        <div class="relative flex-1 max-w-xs">
          <IconSearch class="absolute left-2.5 top-2 text-xs text-muted" />
          <input
            v-model="filter"
            type="text"
            placeholder="Pretraži izvođače po imenu…"
            class="w-full rounded-xl border border-line-strong bg-surface py-1.5 pl-8 pr-7 text-xs outline-none focus:border-accent shadow-2xs transition-colors"
          />
          <button
            v-if="filter"
            type="button"
            class="absolute right-2 top-2 text-xs text-muted hover:text-ink cursor-pointer"
            @click="filter = ''"
          >
            <IconClose />
          </button>
        </div>

        <!-- Country Filter -->
        <select
          v-model="countryFilter"
          class="rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent shadow-2xs font-medium cursor-pointer"
          aria-label="Filtriraj po zemlji"
        >
          <option value="">Sve zemlje ({{ presentCountries.reduce((s, c) => s + c.count, 0) }})</option>
          <option v-for="c in presentCountries" :key="c.code" :value="c.code">
            {{ flagOf(c.code) }} {{ c.name }} ({{ c.count }})
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <!-- Sort Dropdown -->
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] text-faint font-medium hidden sm:inline">Sortiraj:</span>
          <select
            v-model="sortBy"
            class="rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent shadow-2xs font-medium cursor-pointer"
            aria-label="Sortiraj izvođače"
          >
            <option value="name_asc">Ime (A → Z)</option>
            <option value="name_desc">Ime (Z → A)</option>
            <option value="songs_desc">Najviše pjesama</option>
            <option value="songs_asc">Najmanje pjesama</option>
            <option value="images_first">Sa slikom prvo</option>
          </select>
        </div>

        <span class="text-xs text-faint font-mono font-medium pl-1">
          {{ visible.length }} izvođača
        </span>
      </div>
    </div>

    <!-- Artist Editor Drawer / Elevated Card -->
    <div
      v-if="editing"
      ref="editor"
      class="mb-6 rounded-2xl border-2 border-accent/40 bg-panel p-4 sm:p-6 shadow-xl animate-in fade-in duration-200"
    >
      <div class="flex items-center justify-between border-b border-line-soft pb-3 mb-4">
        <h2 class="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
          <IconPerson class="text-accent" />
          {{ editing._id ? `Uređivanje: ${editing.name}` : 'Novi izvođač' }}
        </h2>
        <button
          type="button"
          class="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink cursor-pointer transition"
          @click="cancelEdit"
        >
          <IconClose class="text-lg" />
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block">
          <span class="text-xs font-bold text-muted">Ime izvođača / benda *</span>
          <input
            v-model="form.name"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium"
            placeholder="npr. Oliver Dragojević"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold text-muted">Zemlja</span>
          <select
            v-model="form.country"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium cursor-pointer"
          >
            <option value="">— bez zemlje —</option>
            <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">
              {{ flagOf(c.code) }} {{ c.name }}
            </option>
          </select>
        </label>

        <label class="block">
          <span class="text-xs font-bold text-muted">Porijeklo <span class="font-normal text-faint">(grad)</span></span>
          <input
            v-model="form.origin" maxlength="80" placeholder="npr. Sarajevo, Split"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold text-muted">Sajt / Link <span class="font-normal text-faint">(opcionalno)</span></span>
          <input
            v-model="form.website" maxlength="200" placeholder="https://"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold text-muted">Djeluje od <span class="font-normal text-faint">(godina)</span></span>
          <input
            v-model="form.activeFrom" type="number" min="1800" max="2100" placeholder="npr. 1974"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium"
          />
        </label>

        <label class="block">
          <span class="text-xs font-bold text-muted">do <span class="font-normal text-faint">(prazno = aktivan)</span></span>
          <input
            v-model="form.activeTo" type="number" min="1800" max="2100" placeholder="npr. 1991"
            class="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent shadow-2xs font-medium"
          />
        </label>

        <!-- Rubrike / Genres -->
        <div class="lg:col-span-2">
          <span class="text-xs font-bold text-muted">Muzički žanrovi</span>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <label
              v-for="g in genres" :key="g.slug"
              class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition"
              :class="form.genres.includes(g.slug)
                ? 'border-accent bg-accent-soft text-accent font-bold shadow-2xs'
                : 'border-line bg-surface text-muted hover:border-accent'"
            >
              <input v-model="form.genres" type="checkbox" :value="g.slug" class="accent-accent hidden" />
              <span>{{ g.name }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Biografija with formatting toolbar -->
      <div class="mt-4">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-bold text-muted">Biografija izvođača</span>

          <div class="flex flex-wrap items-center gap-0.5 rounded-lg border border-line-strong bg-surface p-0.5 text-xs">
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-raised hover:text-ink transition cursor-pointer"
              title="Podebljano (Bold) - **tekst**"
              @click="wrapSelection('**', '**', 'podebljano')"
            >
              <IconFormatBold class="text-sm" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-raised hover:text-ink transition cursor-pointer"
              title="Kurziv (Italic) - *tekst*"
              @click="wrapSelection('*', '*', 'kurziv')"
            >
              <IconFormatItalic class="text-sm" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-raised hover:text-ink transition cursor-pointer"
              title="Precrtano (Strikethrough) - ~~tekst~~"
              @click="wrapSelection('~~', '~~', 'precrtano')"
            >
              <IconFormatStrikethrough class="text-sm" />
            </button>

            <span class="mx-0.5 h-3.5 w-px bg-line" aria-hidden="true" />

            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted hover:bg-raised hover:text-ink transition cursor-pointer"
              title="Umetni link"
              @click="insertLink"
            >
              <IconLink class="text-sm" />
            </button>

            <button
              type="button"
              class="ml-1 rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer transition"
              :class="bioPreview ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
              @click="bioPreview = !bioPreview"
            >
              {{ bioPreview ? 'Uređivanje' : 'Pregled' }}
            </button>
          </div>
        </div>

        <div v-if="bioPreview" class="min-h-[7rem] max-h-48 overflow-y-auto rounded-xl border border-line bg-surface p-3 text-xs leading-relaxed text-ink shadow-inner">
          <div v-if="form.bio" v-html="renderBioPreview(form.bio)" />
          <span v-else class="text-faint italic">Tekst biografije je prazan.</span>
        </div>

        <textarea
          v-else
          ref="bioInput"
          v-model="form.bio"
          rows="4"
          placeholder="Unesite kratku biografiju, historiju benda ili diskografske podatke..."
          class="w-full rounded-xl border border-line-strong bg-surface p-3 text-xs outline-none focus:border-accent shadow-2xs font-sans leading-relaxed"
        />
      </div>

      <!-- Slika izvođača & Preview -->
      <div class="mt-4 rounded-xl border border-line-soft bg-surface/70 p-3.5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <!-- Live Preview Avatar -->
          <div class="relative size-16 shrink-0 rounded-2xl overflow-hidden ring-2 ring-line shadow-md bg-panel flex items-center justify-center">
            <img
              v-if="stagedImagePreview || (!stagedImageRemove && editing.hasImage)"
              :src="stagedImagePreview || imageUrl(editing)"
              alt="Profilna slika"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              :style="avatarStyle(form.name || '?')"
              class="w-full h-full flex items-center justify-center font-bold text-lg text-white"
            >
              {{ initials(form.name || '?') }}
            </div>
          </div>

          <div>
            <span class="text-xs font-bold text-ink block">Profilna slika izvođača</span>
            <span class="text-[11px] text-faint block mt-0.5">WebP format, do 10 KB (preporučeno 256×256 px).</span>
          </div>
        </div>

        <div>
          <input ref="fileInput" type="file" accept="image/webp,image/jpeg,image/png" class="hidden" @change="pickImage" />
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent hover:text-ink transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              @click="fileInput.click()"
            >
              <IconUpload class="text-sm text-accent" />
              <span>{{ (stagedImagePreview || (!stagedImageRemove && editing.hasImage)) ? 'Promijeni sliku' : 'Postavi sliku' }}</span>
            </button>
            <button
              v-if="stagedImagePreview || (!stagedImageRemove && editing.hasImage)"
              type="button"
              class="rounded-xl border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              @click="removeImage"
            >
              <IconDelete class="text-sm" /> <span>Ukloni</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Songs by this artist -->
      <div v-if="editing._id" class="mt-5 border-t border-line-soft pt-4">
        <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <IconMusic class="text-accent" />
          Pjesme u katalogu
          <span class="font-mono text-ink font-bold ml-1">({{ editSongsTotal }})</span>
        </h3>

        <div v-if="editSongsLoading" class="py-2">
          <SkeletonLoader type="list" :rows="3" />
        </div>
        <p v-else-if="!editSongs.length" class="text-xs text-muted italic">Ovaj izvođač trenutno nema unesenih pjesama.</p>

        <ul v-else class="max-h-48 divide-y divide-line-soft overflow-y-auto rounded-xl border border-line bg-surface/50">
          <li
            v-for="song in editSongs" :key="song._id"
            class="flex items-center justify-between gap-3 px-3.5 py-2 text-xs hover:bg-raised transition-colors"
          >
            <RouterLink
              :to="{ name: 'song-edit', params: { id: song._id } }"
              class="truncate font-semibold text-ink hover:text-accent flex items-center gap-1.5"
            >
              <IconMusic class="text-xs text-accent/70 shrink-0" />
              <span>{{ song.title }}</span>
            </RouterLink>

            <span
              v-if="song.status === 'draft'"
              class="shrink-0 rounded-md bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn font-mono"
            >skica</span>
          </li>
        </ul>
      </div>

      <!-- Bottom Save / Cancel Actions -->
      <div class="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-line-soft">
        <button
          type="button"
          class="rounded-xl border border-line-strong px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:border-line transition cursor-pointer"
          @click="cancelEdit"
        >
          Odustani
        </button>
        <button
          type="button"
          class="rounded-xl bg-accent px-5 py-2 text-xs font-bold text-on-accent hover:brightness-110 disabled:opacity-50 transition shadow-xs cursor-pointer active:scale-95"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Spašavanje…' : 'Sačuvaj izvođača' }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <SkeletonLoader v-if="loading" type="grid" :rows="12" />

    <!-- Empty State -->
    <div
      v-else-if="!visible.length"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-panel py-16 text-center text-xs text-muted"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-raised text-muted mb-3">
        <IconPerson class="text-2xl text-accent" />
      </div>
      <p class="font-bold text-sm text-ink">Nema pronađenih izvođača</p>
      <p class="text-faint max-w-xs mt-1">
        {{ filter ? 'Nijedan izvođač ne odgovara zadatom filteru.' : 'Trenutno nema zapisa sa odabranim kriterijumima.' }}
      </p>
    </div>

    <!-- GRID VIEW MODE: Modern Artist Cards -->
    <div v-else-if="viewMode === 'grid'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <article
        v-for="a in pageArtists"
        :key="a._id"
        class="group relative flex flex-col justify-between rounded-2xl border border-line bg-panel p-4.5 shadow-sm hover:border-accent/80 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
        :class="highlightedArtistIds.has(a._id) ? 'animate-live-flash ring-2 ring-accent' : ''"
        @click="openArtistSongs(a)"
      >
        <!-- Top row: Avatar + Artist Info -->
        <div>
          <div class="flex items-center gap-3.5">
            <!-- Artist Photo Avatar with Zoom Hover -->
            <div class="relative size-14 shrink-0 rounded-2xl overflow-hidden ring-2 ring-line-soft shadow-xs group-hover:ring-accent/50 transition-all bg-surface select-none">
              <img
                v-if="a.hasImage && !failedImages.has(a._id)"
                :src="imageUrl(a)"
                :alt="a.name"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                @error="failedImages.add(a._id)"
              />
              <div
                v-else
                :style="avatarStyle(a.name)"
                class="w-full h-full flex items-center justify-center font-black text-sm text-white shadow-inner tracking-wider"
              >
                {{ initials(a.name) }}
              </div>

              <!-- Missing photo indicator tag -->
              <span
                v-if="!a.hasImage"
                class="absolute bottom-0 inset-x-0 bg-warn/90 text-on-accent text-[9px] font-bold text-center py-0.2 uppercase tracking-tight"
                title="Nedostaje fotografija izvođača"
              >
                Bez slike
              </span>
            </div>

            <!-- Name & Origin metadata -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span v-if="a.flag || flagOf(a.country)" class="text-base shrink-0 select-none">
                  {{ a.flag || flagOf(a.country) }}
                </span>
                <h3 class="font-bold text-sm text-ink group-hover:text-accent transition-colors leading-snug line-clamp-2">
                  {{ a.name }}
                </h3>
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span v-if="a.origin" class="truncate font-medium text-muted flex items-center gap-0.5">
                  <IconLocation class="text-xs text-faint" /> {{ a.origin }}
                </span>
                <span v-else-if="a.country" class="truncate font-medium text-muted flex items-center gap-0.5">
                  <IconLocation class="text-xs text-faint" /> {{ COUNTRIES.find(c => c.code === a.country)?.name || a.country }}
                </span>
                <span v-else class="text-[11px] text-faint italic">Ex-Yu regija</span>
              </div>
            </div>
          </div>

          <!-- Genre badges if present -->
          <div v-if="a.genres?.length" class="mt-3 flex flex-wrap gap-1">
            <span
              v-for="g in a.genres.slice(0, 3)"
              :key="g.slug || g"
              class="rounded-lg bg-raised px-2 py-0.5 text-[10px] font-semibold text-muted border border-line-soft truncate max-w-[110px]"
            >
              {{ g.name || g }}
            </span>
            <span v-if="a.genres.length > 3" class="text-[10px] text-faint font-mono self-center">
              +{{ a.genres.length - 3 }}
            </span>
          </div>
        </div>

        <!-- Bottom Row: Song Count Pill & Direct Action Buttons -->
        <div class="mt-4 pt-3 border-t border-line-soft flex items-center justify-between gap-2">
          <!-- Song count badge opening the artist songs drawer -->
          <button
            type="button"
            class="flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold font-mono transition shadow-2xs hover:scale-105 cursor-pointer"
            :class="a.songCount
              ? 'bg-accent-soft text-accent border border-accent/20 hover:bg-accent hover:text-on-accent'
              : 'bg-raised text-faint border border-line-soft'"
            :title="`Prikaži sve pjesme izvođača ${a.name}`"
            @click.stop="openArtistSongs(a)"
          >
            <IconMusic class="text-xs" />
            <span>{{ a.songCount || 0 }} {{ a.songCount === 1 ? 'pjesma' : 'pjesama' }}</span>
          </button>

          <div class="flex items-center gap-1 shrink-0" @click.stop>
            <button
              type="button"
              class="flex size-7 items-center justify-center rounded-lg border border-line-strong bg-surface text-muted hover:border-accent hover:text-accent active:scale-90 transition cursor-pointer shadow-2xs"
              title="Uredi profil izvođača"
              @click="startEdit(a)"
            >
              <IconEdit class="text-sm" />
            </button>

            <button
              v-if="auth.hasRole('admin')"
              type="button"
              class="flex size-7 items-center justify-center rounded-lg border border-line-strong bg-surface text-muted hover:border-danger hover:text-danger active:scale-90 transition cursor-pointer shadow-2xs"
              title="Obriši izvođača"
              @click="removingArtist = a"
            >
              <IconDelete class="text-sm" />
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- TABLE VIEW MODE: Dense Spotify/Linear-Style Data Table -->
    <div v-else class="rounded-2xl border border-line bg-panel overflow-hidden shadow-sm">
      <table class="w-full text-sm">
        <thead class="border-b border-line bg-raised/40 text-left text-xs uppercase tracking-wide text-faint">
          <tr>
            <th class="py-3 px-4">Izvođač</th>
            <th class="py-3 px-4">Zemlja i grad</th>
            <th class="py-3 px-4">Žanrovi</th>
            <th class="py-3 px-4 text-center">Pjesme</th>
            <th class="py-3 px-4 text-center">Slika</th>
            <th class="py-3 px-4 text-right">Radnje</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line-soft">
          <tr
            v-for="a in pageArtists"
            :key="a._id"
            class="group hover:bg-raised/60 transition-all duration-200 cursor-pointer"
            :class="highlightedArtistIds.has(a._id) ? 'animate-live-flash' : ''"
            @click="openArtistSongs(a)"
          >
            <td class="py-2.5 px-4">
              <div class="flex items-center gap-3">
                <div class="size-9 shrink-0 rounded-xl overflow-hidden ring-1 ring-line bg-surface flex items-center justify-center">
                  <img
                    v-if="a.hasImage && !failedImages.has(a._id)"
                    :src="imageUrl(a)"
                    :alt="a.name"
                    class="w-full h-full object-cover"
                    @error="failedImages.add(a._id)"
                  />
                  <div
                    v-else
                    :style="avatarStyle(a.name)"
                    class="w-full h-full flex items-center justify-center font-bold text-xs text-white"
                  >
                    {{ initials(a.name) }}
                  </div>
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span v-if="a.flag || flagOf(a.country)">{{ a.flag || flagOf(a.country) }}</span>
                    <span class="font-bold text-ink group-hover:text-accent transition-colors truncate">
                      {{ a.name }}
                    </span>
                  </div>
                </div>
              </div>
            </td>

            <td class="py-2.5 px-4 text-xs text-muted">
              <div class="flex items-center gap-1">
                <span>{{ a.origin || '—' }}</span>
                <span v-if="a.country" class="text-faint">({{ a.country }})</span>
              </div>
            </td>

            <td class="py-2.5 px-4 text-xs text-muted">
              <div v-if="a.genres?.length" class="flex flex-wrap gap-1">
                <span
                  v-for="g in a.genres.slice(0, 2)"
                  :key="g.slug || g"
                  class="rounded bg-raised px-1.5 py-0.2 text-[10px] font-medium text-muted"
                >
                  {{ g.name || g }}
                </span>
              </div>
              <span v-else class="text-faint">—</span>
            </td>

            <td class="py-2.5 px-4 text-center" @click.stop="openArtistSongs(a)">
              <span class="font-mono text-xs font-bold text-accent bg-accent-soft px-2 py-0.5 rounded-full hover:bg-accent hover:text-on-accent transition shadow-2xs">
                {{ a.songCount || 0 }}
              </span>
            </td>

            <td class="py-2.5 px-4 text-center">
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="a.hasImage ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'"
              >
                {{ a.hasImage ? 'Ima sliku' : 'Bez slike' }}
              </span>
            </td>

            <td class="py-2.5 px-4 text-right" @click.stop>
              <div class="inline-flex items-center gap-1">
                <button
                  type="button"
                  class="rounded-lg border border-line-strong bg-panel px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent transition shadow-2xs cursor-pointer flex items-center gap-1"
                  @click="startEdit(a)"
                >
                  <IconEdit class="text-xs" /> <span>Uredi</span>
                </button>
                <button
                  v-if="auth.hasRole('admin')"
                  type="button"
                  class="rounded-lg border border-line-strong bg-panel p-1 text-xs text-muted hover:border-danger hover:text-danger transition shadow-2xs cursor-pointer"
                  title="Obriši"
                  @click="removingArtist = a"
                >
                  <IconDelete class="text-xs" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Toolbar -->
    <nav v-if="pageCount > 1" class="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm border-t border-line-soft pt-4">
      <span class="font-mono text-xs text-muted">
        Prikazano <strong class="text-ink">{{ pageArtists.length }}</strong> od {{ visible.length }} izvođača
      </span>

      <div class="flex items-center gap-2">
        <button
          class="rounded-xl border border-line-strong bg-panel px-3 py-1.5 hover:border-accent hover:text-ink disabled:opacity-30 transition cursor-pointer shadow-2xs"
          :disabled="page <= 1"
          @click="turn(page - 1)"
        >
          <span class="flex items-center gap-1"><IconPrev /> Prethodna</span>
        </button>

        <span class="text-muted font-mono font-medium px-2">{{ page }} / {{ pageCount }}</span>

        <button
          class="rounded-xl border border-line-strong bg-panel px-3 py-1.5 hover:border-accent hover:text-ink disabled:opacity-30 transition cursor-pointer shadow-2xs"
          :disabled="page >= pageCount"
          @click="turn(page + 1)"
        >
          <span class="flex items-center gap-1">Sljedeća <IconNext /></span>
        </button>
      </div>
    </nav>

    <!-- Artist Songs & Discography Modal / Drawer -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150 ease-out"
        leave-active-class="transition-opacity duration-100 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0 pointer-events-none"
      >
        <div
          v-if="selectedArtist"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          data-print="hide"
          @keydown.esc="closeArtistSongs"
        >
          <!-- Scrim backdrop -->
          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            @click="closeArtistSongs"
          />

          <!-- Modal Dialog Panel -->
          <div
            class="relative w-full max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-line bg-panel shadow-2xl overflow-hidden outline-none animate-in slide-in-from-bottom-4 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <!-- Mobile Drag Indicator -->
            <div class="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-line-strong/80" />

            <!-- Header Section: Artist Info & Actions -->
            <div class="p-4 sm:p-6 border-b border-line bg-surface/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="flex items-center gap-3.5 sm:gap-4 min-w-0">
                <!-- Large Avatar -->
                <div class="relative size-16 sm:size-18 shrink-0 rounded-2xl overflow-hidden ring-2 ring-line-strong shadow-md bg-panel flex items-center justify-center select-none">
                  <img
                    v-if="selectedArtist.hasImage && !failedImages.has(selectedArtist._id)"
                    :src="imageUrl(selectedArtist)"
                    :alt="selectedArtist.name"
                    class="w-full h-full object-cover"
                    @error="failedImages.add(selectedArtist._id)"
                  />
                  <div
                    v-else
                    :style="avatarStyle(selectedArtist.name)"
                    class="w-full h-full flex items-center justify-center font-black text-xl text-white shadow-inner"
                  >
                    {{ initials(selectedArtist.name) }}
                  </div>
                </div>

                <!-- Artist Metadata -->
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span v-if="selectedArtist.flag || flagOf(selectedArtist.country)" class="text-lg select-none">
                      {{ selectedArtist.flag || flagOf(selectedArtist.country) }}
                    </span>
                    <h2 class="text-lg sm:text-2xl font-black tracking-tight text-ink truncate">
                      {{ selectedArtist.name }}
                    </h2>
                  </div>

                  <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span v-if="selectedArtist.origin" class="flex items-center gap-1 font-medium">
                      <IconLocation class="text-xs text-accent" /> {{ selectedArtist.origin }}
                    </span>
                    <span v-else-if="selectedArtist.country" class="flex items-center gap-1 font-medium">
                      <IconLocation class="text-xs text-accent" /> {{ COUNTRIES.find(c => c.code === selectedArtist.country)?.name || selectedArtist.country }}
                    </span>

                    <span v-if="selectedArtist.activeFrom" class="font-mono text-faint">
                      Djeluje: {{ selectedArtist.activeFrom }}–{{ selectedArtist.activeTo || 'danas' }}
                    </span>

                    <div v-if="selectedArtist.genres?.length" class="flex flex-wrap gap-1">
                      <span
                        v-for="g in selectedArtist.genres.slice(0, 3)"
                        :key="g.slug || g"
                        class="rounded-md bg-raised px-1.5 py-0.2 text-[10px] font-semibold text-muted border border-line-soft"
                      >
                        {{ g.name || g }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Top Action Buttons -->
              <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                <RouterLink
                  :to="{ name: 'song-new', query: { artist: selectedArtist.name } }"
                  class="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-bold text-on-ink hover:bg-accent transition shadow-md active:scale-95 cursor-pointer"
                  @click="closeArtistSongs"
                >
                  <IconAdd class="text-base" />
                  <span>Nova pjesma</span>
                </RouterLink>

                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-ink transition shadow-2xs cursor-pointer"
                  title="Uredi profil i podatke izvođača"
                  @click="startEdit(selectedArtist); closeArtistSongs()"
                >
                  <IconEdit class="text-sm text-accent" />
                  <span class="hidden sm:inline">Uredi profil</span>
                </button>

                <button
                  type="button"
                  class="rounded-xl p-2 text-muted hover:bg-raised hover:text-ink transition cursor-pointer"
                  title="Zatvori pregled"
                  @click="closeArtistSongs"
                >
                  <IconClose class="text-lg" />
                </button>
              </div>
            </div>

            <!-- Body Section: Search, Filters & Songs List -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <!-- Fast Metric Cards -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div
                  class="rounded-xl border bg-panel p-3 shadow-2xs cursor-pointer transition"
                  :class="artistSongStatus === 'all' ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong'"
                  @click="artistSongStatus = 'all'"
                >
                  <div class="flex items-center justify-between text-muted text-xs">
                    <span class="font-medium flex items-center gap-1"><IconMusic class="text-sm text-accent" /> Ukupno</span>
                    <span class="text-[10px] text-faint font-mono">Pjesme</span>
                  </div>
                  <div class="mt-1 font-mono text-xl sm:text-2xl font-black text-ink">
                    {{ artistSongs.length }}
                  </div>
                </div>

                <div
                  class="rounded-xl border bg-panel p-3 shadow-2xs cursor-pointer transition"
                  :class="artistSongStatus === 'published' ? 'border-ok ring-1 ring-ok' : 'border-line hover:border-line-strong'"
                  @click="artistSongStatus = 'published'"
                >
                  <div class="flex items-center justify-between text-muted text-xs">
                    <span class="font-medium flex items-center gap-1"><IconCheckCircle class="text-sm text-ok" /> Objavljeno</span>
                    <span class="text-[10px] text-ok font-bold font-mono">Aktivno</span>
                  </div>
                  <div class="mt-1 font-mono text-xl sm:text-2xl font-black text-ok">
                    {{ artistPublishedCount }}
                  </div>
                </div>

                <div
                  class="rounded-xl border bg-panel p-3 shadow-2xs cursor-pointer transition"
                  :class="artistSongStatus === 'draft' ? 'border-warn ring-1 ring-warn' : 'border-line hover:border-line-strong'"
                  @click="artistSongStatus = 'draft'"
                >
                  <div class="flex items-center justify-between text-muted text-xs">
                    <span class="font-medium flex items-center gap-1"><IconPending class="text-sm text-warn" /> Skice</span>
                    <span class="text-[10px] text-warn font-bold font-mono">Čeka</span>
                  </div>
                  <div class="mt-1 font-mono text-xl sm:text-2xl font-black text-warn">
                    {{ artistDraftCount }}
                  </div>
                </div>

                <div
                  class="rounded-xl border bg-panel p-3 shadow-2xs cursor-pointer transition"
                  :class="artistSongStatus === 'bez-akorda' ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong'"
                  @click="artistSongStatus = 'bez-akorda'"
                >
                  <div class="flex items-center justify-between text-muted text-xs">
                    <span class="font-medium flex items-center gap-1"><IconWarning class="text-sm text-accent" /> Bez akorda</span>
                    <span class="text-[10px] text-accent font-bold font-mono">Obrada</span>
                  </div>
                  <div class="mt-1 font-mono text-xl sm:text-2xl font-black text-accent">
                    {{ artistNoChordsCount }}
                  </div>
                </div>
              </div>

              <!-- Search & Filter Toolbar -->
              <div class="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line-soft bg-surface/60 p-2 text-xs shadow-2xs">
                <!-- Search Input with Clear Button -->
                <div class="relative flex-1 min-w-[14rem]">
                  <IconSearch class="absolute left-3 top-2.5 text-xs text-muted" />
                  <input
                    v-model="artistSongQuery"
                    type="text"
                    placeholder="Pretraži pjesme po nazivu, tonalitetu, tagovima…"
                    class="w-full rounded-xl border border-line-strong bg-panel py-2 pl-9 pr-8 text-xs text-ink outline-none focus:border-accent shadow-2xs font-medium placeholder:text-dim"
                  />
                  <button
                    v-if="artistSongQuery"
                    type="button"
                    class="absolute right-2.5 top-2.5 text-xs text-muted hover:text-ink cursor-pointer"
                    @click="artistSongQuery = ''"
                  >
                    <IconClose />
                  </button>
                </div>

                <!-- Status Filter Tabs -->
                <div class="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line-strong overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 font-bold transition cursor-pointer text-xs shrink-0"
                    :class="artistSongStatus === 'all' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
                    @click="artistSongStatus = 'all'"
                  >
                    Sve ({{ artistSongs.length }})
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 font-bold transition cursor-pointer text-xs shrink-0"
                    :class="artistSongStatus === 'published' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
                    @click="artistSongStatus = 'published'"
                  >
                    Objavljeno ({{ artistPublishedCount }})
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 font-bold transition cursor-pointer text-xs shrink-0"
                    :class="artistSongStatus === 'draft' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
                    @click="artistSongStatus = 'draft'"
                  >
                    Skice ({{ artistDraftCount }})
                  </button>
                </div>

                <!-- Sort Selector -->
                <select
                  v-model="artistSongSort"
                  class="rounded-xl border border-line-strong bg-panel px-3 py-2 text-xs font-medium outline-none focus:border-accent shadow-2xs cursor-pointer"
                >
                  <option value="title_asc">Naziv (A → Z)</option>
                  <option value="title_desc">Naziv (Z → A)</option>
                  <option value="views">Najgledanije</option>
                  <option value="key">Po tonalitetu</option>
                </select>
              </div>

              <!-- Loading State -->
              <div v-if="artistSongsLoading" class="py-6">
                <SkeletonLoader type="list" :rows="6" />
              </div>

              <!-- Empty Catalog State -->
              <div
                v-else-if="!artistSongs.length"
                class="rounded-2xl border border-dashed border-line-strong bg-surface/30 p-10 text-center shadow-2xs"
              >
                <IconMusic class="mx-auto text-3xl text-dim mb-2" />
                <p class="text-sm font-bold text-ink">Nema unesenih pjesama</p>
                <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Ovaj izvođač trenutno nema pjesama u katalogu.
                </p>
                <RouterLink
                  :to="{ name: 'song-new', query: { artist: selectedArtist.name } }"
                  class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-on-accent hover:brightness-110 transition shadow-xs"
                  @click="closeArtistSongs"
                >
                  <IconAdd class="text-base" />
                  <span>Dodaj prvu pjesmu</span>
                </RouterLink>
              </div>

              <!-- Empty Search Filter State -->
              <div
                v-else-if="!filteredArtistSongs.length"
                class="rounded-2xl border border-line bg-surface/30 p-8 text-center shadow-2xs"
              >
                <IconSearch class="mx-auto text-2xl text-dim mb-1" />
                <p class="text-xs font-bold text-ink">Nema pronađenih pjesama</p>
                <p class="text-[11px] text-muted mt-0.5">
                  Nijedna pjesma ne odgovara filteru "{{ artistSongQuery }}".
                </p>
                <button
                  type="button"
                  class="mt-3 inline-flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs text-accent font-semibold hover:border-accent transition shadow-2xs cursor-pointer"
                  @click="artistSongQuery = ''; artistSongStatus = 'all'"
                >
                  Poništi filtere
                </button>
              </div>

              <!-- Populated Discography Songs List -->
              <div v-else class="rounded-2xl border border-line bg-panel overflow-hidden shadow-2xs divide-y divide-line-soft">
                <div
                  v-for="song in filteredArtistSongs"
                  :key="song._id"
                  class="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-raised/40 transition-colors"
                >
                  <!-- Song Title, Key & Info -->
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <!-- Key Pill with Audio Strum Button -->
                    <button
                      v-if="song.originalKey"
                      type="button"
                      class="flex items-center gap-1 rounded-lg border border-accent/20 bg-accent-soft px-2 py-1 text-xs font-mono font-black text-accent hover:bg-accent hover:text-on-accent transition shadow-2xs shrink-0 cursor-pointer"
                      :title="`Odsviraj početni akord ${song.originalKey}`"
                      @click.stop="playTonic(song.originalKey, $event)"
                    >
                      <IconVolume class="text-xs" />
                      <span>{{ song.originalKey }}</span>
                    </button>

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <RouterLink
                          :to="{ name: 'song-edit', params: { id: song._id } }"
                          class="font-bold text-xs sm:text-sm text-ink group-hover:text-accent transition-colors truncate"
                          :title="`Uredi pjesmu ${song.title}`"
                          @click="closeArtistSongs"
                        >
                          {{ song.title }}
                        </RouterLink>

                        <span
                          v-if="song.capo"
                          class="rounded-md bg-raised border border-line-soft px-1.5 py-0.2 text-[10px] font-mono text-muted"
                        >
                          Capo {{ song.capo }}
                        </span>
                      </div>

                      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span v-if="song.year" class="font-mono text-faint">{{ song.year }}</span>
                        <span v-if="song.year && song.genres?.length" class="text-faint">·</span>
                        <span v-if="song.genres?.length" class="text-faint truncate max-w-xs">
                          {{ song.genres.map(g => g.name || g).join(', ') }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Right Side: Status Badge, Metrics & Actions -->
                  <div class="flex items-center gap-2.5 sm:gap-3 self-end sm:self-center shrink-0">
                    <!-- Stats if present -->
                    <div v-if="song.views" class="hidden md:flex items-center gap-1.5 text-xs text-muted font-mono">
                      <span class="flex items-center gap-0.5"><IconViews class="text-xs text-faint" /> {{ song.views }}</span>
                      <span v-if="song.favorites" class="flex items-center gap-0.5 text-accent"><IconSaved class="text-xs" /> {{ song.favorites }}</span>
                    </div>

                    <!-- Status Badges -->
                    <span
                      class="rounded-lg px-2 py-0.5 text-[10px] font-bold font-mono border"
                      :class="song.status === 'published'
                        ? 'bg-ok-soft text-ok border-ok/20'
                        : 'bg-warn-soft text-warn border-warn/20'"
                    >
                      {{ song.status === 'published' ? 'Objavljeno' : 'Skica' }}
                    </span>

                    <span
                      v-if="(song.tags || []).includes('bez-akorda') || !song.chords?.length"
                      class="rounded-lg bg-accent-soft text-accent border border-accent/20 px-2 py-0.5 text-[10px] font-bold font-mono"
                    >
                      Bez akorda
                    </span>

                    <!-- Quick Status Toggle -->
                    <button
                      type="button"
                      class="rounded-xl border border-line-strong bg-panel px-2.5 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-ink transition shadow-2xs cursor-pointer disabled:opacity-40"
                      :disabled="songBusyId === song._id"
                      :title="song.status === 'published' ? 'Prebaci u skicu' : 'Objavi pjesmu na sajtu'"
                      @click.stop="toggleSongStatus(song, $event)"
                    >
                      <span>{{ song.status === 'published' ? 'Skini s objave' : 'Objavi' }}</span>
                    </button>

                    <!-- Direct Edit Link -->
                    <RouterLink
                      :to="{ name: 'song-edit', params: { id: song._id } }"
                      class="flex size-7 items-center justify-center rounded-xl border border-line-strong bg-surface text-muted hover:border-accent hover:text-accent active:scale-90 transition cursor-pointer shadow-2xs"
                      title="Otvori u punom uređivaču"
                      @click="closeArtistSongs"
                    >
                      <IconEdit class="text-sm" />
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer Section -->
            <div class="p-3 sm:p-4 border-t border-line bg-surface/50 flex items-center justify-between text-xs text-muted">
              <span class="font-mono">
                Prikazano <strong class="text-ink">{{ filteredArtistSongs.length }}</strong> od {{ artistSongs.length }} pjesama
              </span>

              <button
                type="button"
                class="rounded-xl border border-line-strong bg-panel px-4 py-1.5 text-xs font-semibold text-ink hover:border-accent transition shadow-2xs cursor-pointer"
                @click="closeArtistSongs"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Dialog -->
    <AppModal
      :model-value="Boolean(removingArtist)"
      title="Obrisati izvođača?"
      :description="removingArtist
        ? (removingArtist.songCount
          ? `Sigurno? Zajedno s izvođačem „${removingArtist.name}“ u kantu ide i svih ${removingArtist.songCount} njegovih pjesama. Sve nestaje sa sajta, i sve se može vratiti zajedno.`
          : `„${removingArtist.name}“ ide u kantu i nestaje sa sajta. Može se vratiti.` )
        : ''"
      confirm-label="Obriši"
      tone="danger"
      @update:model-value="(open) => { if (!open) removingArtist = null; }"
      @confirm="() => { const a = removingArtist; removingArtist = null; removeArtist(a); }"
    />
  </section>
</template>
