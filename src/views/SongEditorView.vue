<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import client from '../api/client';
import ChordSheet from '../components/ChordSheet.vue';
import ImportPanel from '../components/ImportPanel.vue';
import ChordLineEditor from '../components/ChordLineEditor.vue';
import FontSizeControl from '../components/FontSizeControl.vue';
import ArrangementsPanel from '../components/ArrangementsPanel.vue';
import { extractChords, transposeContent, transposeChord } from '../utils/chordpro';
import { useToasts } from '../composables/useToasts';
import { useSheetFontSize } from '../composables/useSheetFontSize';
import IconDraft from '~icons/material-symbols/save-rounded';
import IconPublish from '~icons/material-symbols/publish-rounded';
import IconImage from '~icons/material-symbols/image-outline-rounded';
import IconPlay from '~icons/material-symbols/play-circle-outline-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconCheck from '~icons/material-symbols/check-circle-rounded';
import IconTune from '~icons/material-symbols/tune-rounded';
import IconFullscreen from '~icons/material-symbols/fullscreen-rounded';
import IconFullscreenExit from '~icons/material-symbols/fullscreen-exit-rounded';
import IconExpandMore from '~icons/material-symbols/expand-more-rounded';
import IconExpandLess from '~icons/material-symbols/expand-less-rounded';
import IconSplitscreen from '~icons/material-symbols/splitscreen-rounded';
import IconEditNote from '~icons/material-symbols/edit-note-rounded';
import IconVisibility from '~icons/material-symbols/visibility-rounded';
import IconSync from '~icons/material-symbols/sync-rounded';
import IconSyncDisabled from '~icons/material-symbols/sync-disabled-rounded';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();
const route = useRoute();
const editor = useTemplateRef('editor');
const importPanelRef = ref(null);
const toasts = useToasts();
const { fontSize } = useSheetFontSize();

/**
 * AI-TRAP: our notation, not the American one. H is the twelfth degree and
 * sharps are written instead of flats — this list offered Bb and B while every
 * page in the app renders A# and H, so an editor picked a key the reader never
 * sees. The importer still understands the American spelling on the way in.
 */
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H',
              'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Hm'];

const DIFFICULTIES = [
  { value: 'easy', label: 'Lako' },
  { value: 'medium', label: 'Srednje' },
  { value: 'hard', label: 'Teško' }
];

const KNOWN_TAGS = [
  { key: 'bez-akorda', label: 'Bez akorda' },
  { key: 'neprovjereno', label: 'Neprovjereno' },
  { key: 'treba-provjeru', label: 'Treba provjeru' },
  { key: 'uvoz', label: 'Iz uvoza' }
];

const form = ref({
  title: '', artist: '', originalKey: 'Am', capo: 0, year: null,
  difficulty: 'medium', tags: [], genres: [], content: '', status: 'draft',
  youtube: ''
});
const genres = ref([]);
const newTag = ref('');
const mode = ref('visual');
const mobileTab = ref('editor');
const saving = ref(false);
const error = ref(null);
const showPlayer = ref(false);

// Workspace ergonomics and sizing states
const layoutMode = ref('pro'); // 'pro' (70/30) | 'split' (50/50) | 'editor' (100%) | 'preview' (100%)
const showDetails = ref(!props.id);
const isWide = ref(true);
const autoExpandHeight = ref(false);
const syncScroll = ref(true);
const isZenFullscreen = ref(false);

const editorContainerRef = ref(null);
const previewContainerRef = ref(null);
let isSyncingScroll = false;

function onEditorScroll(e) {
  if (!syncScroll.value || isSyncingScroll || !['pro', 'split'].includes(layoutMode.value)) return;
  const el = e.target;
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 0) return;
  const percentage = el.scrollTop / maxScroll;
  const target = previewContainerRef.value;
  if (target) {
    const targetMax = target.scrollHeight - target.clientHeight;
    if (targetMax > 0) {
      isSyncingScroll = true;
      target.scrollTop = percentage * targetMax;
      requestAnimationFrame(() => {
        isSyncingScroll = false;
      });
    }
  }
}

function onPreviewScroll(e) {
  if (!syncScroll.value || isSyncingScroll || !['pro', 'split'].includes(layoutMode.value)) return;
  const el = e.target;
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 0) return;
  const percentage = el.scrollTop / maxScroll;
  const target = editorContainerRef.value;
  if (target) {
    const targetMax = target.scrollHeight - target.clientHeight;
    if (targetMax > 0) {
      isSyncingScroll = true;
      target.scrollTop = percentage * targetMax;
      requestAnimationFrame(() => {
        isSyncingScroll = false;
      });
    }
  }
}

const workspaceHeightClass = computed(() => {
  if (isZenFullscreen.value) return 'flex-1 h-full min-h-[500px] overflow-auto';
  if (autoExpandHeight.value) return 'min-h-[40rem] h-auto overflow-visible';
  if (!showDetails.value) return 'h-[calc(100vh-10.5rem)] min-h-[620px] overflow-auto';
  return 'h-[calc(100vh-16rem)] min-h-[500px] overflow-auto';
});

const workspaceGridClass = computed(() => {
  if (layoutMode.value === 'pro') return 'lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]';
  if (layoutMode.value === 'split') return 'lg:grid-cols-2';
  return 'grid-cols-1';
});

const transposeSemitones = ref(0);

const previewKey = computed(() => {
  if (transposeSemitones.value === 0) return form.value.originalKey;
  return transposeChord(form.value.originalKey, transposeSemitones.value);
});

const previewContent = computed(() => {
  if (transposeSemitones.value === 0) return form.value.content;
  return transposeContent(form.value.content, transposeSemitones.value, form.value.originalKey);
});

const usedChords = computed(() => extractChords(form.value.content));

const youtubeEmbedUrl = computed(() => {
  const yt = form.value.youtube || '';
  if (!yt) return null;
  const match = yt.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0` : null;
});

const songStats = computed(() => {
  const content = form.value.content || '';
  const lines = content.split('\n');
  const nonBlankLines = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith('['));
  const plainText = content.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText ? plainText.split(/\s+/).length : 0;
  const chords = extractChords(content);
  const estMins = Math.floor(words / 130);
  const estSecs = String(Math.round(((words % 130) / 130) * 60)).padStart(2, '0');
  return {
    linesCount: nonBlankLines.length,
    wordsCount: words,
    chordsCount: chords.length,
    uniqueChords: [...new Set(chords)].length,
    estDuration: `~${estMins}:${estSecs} min`
  };
});

function applyPermanentTranspose() {
  if (transposeSemitones.value === 0) return;
  form.value.content = previewContent.value;
  form.value.originalKey = previewKey.value;
  toasts.success(`Trajno transponovano u tonalitet ${form.value.originalKey}`);
  transposeSemitones.value = 0;
}

function handleEditorKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save(form.value.status || 'draft');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEditorKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
});

/** Kept beside the form rather than inside it: the panel owns these. */
const arrangements = ref([]);

/**
 * The panel returns the whole song after every change, so the form follows the
 * primary along with it — otherwise promoting a different version would leave
 * the textarea showing text that is no longer the one being edited.
 */
function onArrangementsChanged(song) {
  arrangements.value = song.arrangements || [];
  form.value.content = song.content;
  form.value.originalKey = song.originalKey;
  form.value.capo = song.capo;
}

async function loadSong(id) {
  if (!id) {
    if (route.query.title) form.value.title = String(route.query.title);
    if (route.query.artist) form.value.artist = String(route.query.artist);
    return;
  }
  try {
    const { data } = await client.get(`/songs/${id}`);
    form.value = {
      title: data.song.title,
      artist: data.song.artist?.name || '',
      originalKey: data.song.originalKey,
      capo: data.song.capo || 0,
      year: data.song.year || null,
      difficulty: data.song.difficulty || 'medium',
      tags: data.song.tags || [],
      genres: (data.song.genres || []).map((g) => g.slug),
      content: data.song.content,
      status: data.song.status
    };
    arrangements.value = data.song.arrangements || [];
    // Stored as a bare id, shown as a link — that is the form an editor
    // recognises and can open to check they pasted the right video.
    form.value.youtube = data.song.youtubeId
      ? `https://www.youtube.com/watch?v=${data.song.youtubeId}`
      : '';
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Pjesma nije pronađena.');
  }
}

watch(() => props.id, (nextId) => {
  loadSong(nextId);
});

onMounted(async () => {
  try {
    const { data } = await client.get('/genres');
    genres.value = data.genres || [];
  } catch {
    // The picker degrades to empty; the song can still be saved without one.
  }
  await loadSong(props.id);
});

function applyImport({ content, originalKey, title, artist }) {
  if (content) form.value.content = content;
  if (originalKey) form.value.originalKey = originalKey;
  if (title && !form.value.title) form.value.title = title;
  if (artist && !form.value.artist) form.value.artist = artist;
  toasts.success('Tekst i akordi uspješno uvezeni.');
}

function toggleGenre(slug) {
  const next = new Set(form.value.genres);
  next.has(slug) ? next.delete(slug) : next.add(slug);
  form.value.genres = [...next];
}

function toggleTag(t) {
  const next = new Set(form.value.tags || []);
  next.has(t) ? next.delete(t) : next.add(t);
  form.value.tags = [...next];
}

function addCustomTag() {
  const val = newTag.value.trim().toLowerCase();
  if (!val) return;
  const next = new Set(form.value.tags || []);
  next.add(val);
  form.value.tags = [...next];
  newTag.value = '';
}

function removeTag(t) {
  form.value.tags = (form.value.tags || []).filter((x) => x !== t);
}

function insertTextAtCursor(str) {
  const el = editor.value;
  if (!el) {
    form.value.content = (form.value.content ? form.value.content + '\n' : '') + str;
    return;
  }
  const { selectionStart: start, selectionEnd: end, value } = el;
  form.value.content = value.slice(0, start) + str + value.slice(end);
  const caret = start + str.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function insertSection(name) {
  insertTextAtCursor(`\n[${name}]\n`);
}

function insertChord(chord) {
  insertTextAtCursor(`[${chord}]`);
}

/**
 * Wrap the current selection in brackets, or drop an empty pair at the caret.
 * Placing chords is the single most repeated action in this editor, so it is
 * bound to Ctrl/Cmd+K rather than requiring the worker to type brackets.
 */
function insertChordMarker() {
  const el = editor.value;
  if (!el) return;

  const { selectionStart: start, selectionEnd: end, value } = el;
  const selected = value.slice(start, end);
  form.value.content = value.slice(0, start) + '[' + selected + ']' + value.slice(end);

  // Drop the caret inside the brackets so the chord can be typed immediately.
  const caret = selected ? end + 2 : start + 1;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

async function save(status) {
  saving.value = true;
  error.value = null;
  try {
    const payload = { ...form.value, status };
    const creating = !props.id;
    const { data } = props.id
      ? await client.put(`/songs/${props.id}`, payload)
      : await client.post('/songs', payload);

    toasts.success(
      status === 'published'
        ? `Objavljeno: ${data.song.title}`
        : (creating ? `Skica sačuvana: ${data.song.title}` : `Izmjene sačuvane: ${data.song.title}`),
      { detail: data.song.artist?.name }
    );

    router.push({ name: 'song-edit', params: { id: data.song._id } });
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Spašavanje nije uspjelo.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    :class="[
      isZenFullscreen
        ? 'fixed inset-0 z-50 bg-base p-3 sm:p-5 overflow-hidden flex flex-col'
        : (isWide ? '-mx-2 sm:-mx-6 lg:-mx-10 xl:-mx-16 max-w-none transition-all duration-200' : 'transition-all duration-200')
    ]"
  >
    <!-- Top Header / Action Bar -->
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 class="text-base sm:text-lg font-bold tracking-tight text-ink">
          {{ props.id ? 'Uredi pjesmu' : 'Nova pjesma' }}
        </h1>

        <!-- Real-time Song Statistics Metric Pill -->
        <div class="hidden sm:flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] text-muted shadow-2xs">
          <span class="font-bold text-accent">{{ form.originalKey }}</span>
          <span>·</span>
          <span>{{ songStats.linesCount }} stihova</span>
          <span>·</span>
          <span>{{ songStats.wordsCount }} riječi</span>
          <span>·</span>
          <span>{{ songStats.estDuration }}</span>
          <span>·</span>
          <span class="font-semibold text-accent">{{ songStats.uniqueChords }} akorda</span>
        </div>

        <ImportPanel ref="importPanelRef" @imported="applyImport" />

        <button
          v-if="youtubeEmbedUrl"
          type="button"
          class="hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs"
          :class="showPlayer
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line-strong bg-panel text-muted hover:border-accent hover:text-ink'"
          @click="showPlayer = !showPlayer"
        >
          <IconPlay class="text-sm text-accent" />
          <span>{{ showPlayer ? 'Sakrij video' : 'Audio vodilica' }}</span>
        </button>
      </div>

      <!-- Right Controls: Workspace Layout, Ergonomics & Save -->
      <div class="flex items-center gap-2">
        <!-- Desktop Workspace Layout Switcher (Pro 70/30 / 50/50 / Editor / Preview) -->
        <div class="hidden lg:flex items-center gap-0.5 rounded-xl border border-line bg-panel p-0.5 shadow-2xs">
          <button
            type="button"
            class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
            :class="layoutMode === 'pro' ? 'bg-ink text-on-ink shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
            title="Široki uređivač + Live pregled (70/30)"
            @click="layoutMode = 'pro'"
          >
            <IconSplitscreen class="text-sm text-accent" />
            <span>70/30</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
            :class="layoutMode === 'split' ? 'bg-ink text-on-ink shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
            title="Paralelni prikaz: Uređivač i Pregled (50/50)"
            @click="layoutMode = 'split'"
          >
            <span>50/50</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
            :class="layoutMode === 'editor' ? 'bg-ink text-on-ink shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
            title="Maksimalni prostor: 100% širina za uređivanje"
            @click="layoutMode = 'editor'"
          >
            <IconEditNote class="text-sm" />
            <span>100% Uređivač</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
            :class="layoutMode === 'preview' ? 'bg-ink text-on-ink shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
            title="Fokus na pregled pjesmarice (100% širina)"
            @click="layoutMode = 'preview'"
          >
            <IconVisibility class="text-sm" />
            <span>100% Pregled</span>
          </button>
        </div>

        <!-- Fullscreen / Zen Mode Toggle Button -->
        <button
          type="button"
          class="flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition shadow-2xs cursor-pointer"
          :class="isZenFullscreen
            ? 'border-accent bg-accent text-on-accent font-bold ring-2 ring-accent/30'
            : 'border-line-strong bg-panel text-muted hover:border-accent hover:text-ink'"
          :title="isZenFullscreen ? 'Izađi iz punog ekrana (Esc)' : 'Otvori uređivač preko cijelog ekrana (Zen mod)'"
          @click="isZenFullscreen = !isZenFullscreen"
        >
          <IconFullscreen v-if="!isZenFullscreen" class="text-sm text-accent" />
          <IconFullscreenExit v-else class="text-sm" />
          <span>{{ isZenFullscreen ? 'Izađi' : 'Puni ekran' }}</span>
        </button>

        <!-- Auto-expand height toggle -->
        <button
          v-if="!isZenFullscreen"
          type="button"
          class="hidden lg:flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-ink transition shadow-2xs cursor-pointer"
          :class="autoExpandHeight ? 'border-accent text-accent bg-accent-soft font-bold' : ''"
          :title="autoExpandHeight ? 'Uključi unutrašnje skrolovanje' : 'Prikaži cijelu pjesmu bez unutrašnjeg skrolovanja'"
          @click="autoExpandHeight = !autoExpandHeight"
        >
          <span>{{ autoExpandHeight ? '↕️ Prilagodi visinu' : '↕️ Cijela pjesma' }}</span>
        </button>

        <!-- Sync Scroll toggle button -->
        <button
          v-if="['pro', 'split'].includes(layoutMode)"
          type="button"
          class="hidden lg:flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-2 py-1 text-xs font-medium transition shadow-2xs cursor-pointer"
          :class="syncScroll ? 'text-accent border-accent/40 bg-accent-soft font-semibold' : 'text-faint hover:text-ink'"
          :title="syncScroll ? 'Sinhronizovano skrolovanje uključeno' : 'Sinhronizovano skrolovanje isključeno'"
          @click="syncScroll = !syncScroll"
        >
          <IconSync v-if="syncScroll" class="text-sm" />
          <IconSyncDisabled v-else class="text-sm" />
          <span class="text-[11px]">{{ syncScroll ? 'Sync' : 'Bez sync' }}</span>
        </button>

        <div class="hidden lg:flex items-center gap-2">
          <button
            class="rounded-lg border border-line-strong bg-panel px-3 py-1.5 text-xs font-medium text-muted hover:border-accent hover:text-ink transition cursor-pointer shadow-2xs"
            :disabled="saving"
            title="Prečica: Cmd+S / Ctrl+S"
            @click="save('draft')"
          >
            <span class="flex items-center gap-1.5"><IconDraft class="text-sm" /> Sačuvaj skicu <kbd class="text-[10px] text-faint">⌘S</kbd></span>
          </button>
          <button
            class="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-on-accent hover:brightness-110 disabled:opacity-50 transition shadow-xs cursor-pointer active:scale-95"
            :disabled="saving"
            @click="save('published')"
          >
            <span class="flex items-center gap-1.5">
              <IconPublish class="text-sm" /> {{ saving ? 'Spašavanje…' : 'Objavi' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Collapsible YouTube Companion Player -->
    <div
      v-if="showPlayer && youtubeEmbedUrl"
      class="mb-3 rounded-2xl border border-line bg-panel p-3 shadow-md animate-in fade-in duration-200"
    >
      <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-line-soft">
        <span class="text-xs font-bold text-ink flex items-center gap-1.5">
          <IconPlay class="text-accent" /> Audio vodilica za usklađivanje akorda
        </span>
        <button
          type="button"
          class="text-xs text-muted hover:text-ink cursor-pointer p-0.5"
          @click="showPlayer = false"
        >
          ✕ Zatvori
        </button>
      </div>
      <div class="aspect-video max-h-56 w-full max-w-xl mx-auto rounded-xl overflow-hidden shadow-inner bg-black">
        <iframe
          :src="youtubeEmbedUrl"
          class="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
      </div>
    </div>

    <p v-if="error" class="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent border border-accent/30">{{ error }}</p>

    <!-- Compact Summary Bar when Details are Collapsed (Zen Mode) -->
    <div
      v-if="!showDetails"
      class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line-soft bg-panel/70 px-3.5 py-1.5 text-xs shadow-2xs backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <span class="font-bold text-ink">{{ form.title || 'Bez naslova' }}</span>
        <span class="text-faint">·</span>
        <span class="font-medium text-muted">{{ form.artist || 'Nepoznat izvođač' }}</span>
        <span class="text-faint">·</span>
        <span class="font-mono font-bold text-accent">{{ form.originalKey }}</span>
        <span v-if="form.capo > 0" class="text-muted font-mono text-[11px]">(Capo: {{ form.capo }})</span>
        <span v-if="form.difficulty" class="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase font-bold text-faint">
          {{ form.difficulty }}
        </span>
        <span v-if="form.tags?.length" class="text-[11px] text-faint">
          ({{ form.tags.join(', ') }})
        </span>
      </div>

      <button
        type="button"
        class="flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer"
        @click="showDetails = true"
      >
        <IconTune class="text-sm" />
        <span>Uredi detalje pjesme</span>
      </button>
    </div>

    <!-- Full Song Details Section (Collapsible) -->
    <div v-if="showDetails" class="mb-3.5 space-y-2.5 animate-in fade-in duration-200">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-wider text-muted">Osnovni podaci</span>
        <button
          type="button"
          class="flex items-center gap-1 rounded-lg border border-line-soft bg-surface/70 px-2 py-0.5 text-[11px] font-medium text-muted hover:border-accent hover:text-accent transition cursor-pointer shadow-2xs"
          title="Sklopi formu za maksimalan radni prostor stihova"
          @click="showDetails = false"
        >
          <IconExpandLess class="text-sm" />
          <span>Sklopi detalje (Zen)</span>
        </button>
      </div>

      <!-- Metadata Form Grid -->
      <div class="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
        <label class="block col-span-2 sm:col-span-2 lg:col-span-2">
          <span class="font-medium text-muted">Naslov</span>
          <input v-model="form.title" class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent shadow-2xs" />
        </label>
        <label class="block col-span-2 sm:col-span-1 lg:col-span-2">
          <span class="font-medium text-muted">Izvođač</span>
          <input v-model="form.artist" class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent shadow-2xs" />
        </label>
        <label class="block col-span-1 lg:col-span-1">
          <span class="font-medium text-muted">Tonalitet</span>
          <select v-model="form.originalKey" class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2 py-1.5 text-xs outline-none focus:border-accent font-mono font-bold text-accent shadow-2xs">
            <option v-for="key in KEYS" :key="key">{{ key }}</option>
          </select>
        </label>
        <label class="block col-span-1 lg:col-span-1">
          <span class="font-medium text-muted">Kapodaster</span>
          <input v-model.number="form.capo" type="number" min="0" max="12"
                 class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono shadow-2xs" />
        </label>

        <label class="block col-span-1 lg:col-span-1">
          <span class="font-medium text-muted">Težina</span>
          <select v-model="form.difficulty" class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2 py-1.5 text-xs outline-none focus:border-accent shadow-2xs">
            <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </label>

        <label class="block col-span-1 lg:col-span-1">
          <span class="font-medium text-muted">Godina <span class="font-normal text-faint">(opc.)</span></span>
          <input v-model.number="form.year" type="number" min="1900" :max="new Date().getFullYear() + 1"
                 placeholder="npr. 1974"
                 class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono shadow-2xs" />
        </label>

        <label class="block col-span-2 sm:col-span-3 lg:col-span-4">
          <span class="font-medium text-muted">YouTube link <span class="font-normal text-faint">(opciono)</span></span>
          <input
            v-model="form.youtube"
            placeholder="youtube.com/watch?v=… ili youtu.be/…"
            class="mt-1 w-full rounded-lg border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent shadow-2xs"
          >
        </label>
      </div>

      <ArrangementsPanel
        v-if="props.id"
        :song-id="props.id"
        :arrangements="arrangements"
        @changed="onArrangementsChanged"
      />

      <!-- Genres and Tags Box -->
      <div class="grid gap-3 sm:grid-cols-2 rounded-xl border border-line-soft bg-panel/50 p-3 text-xs shadow-2xs">
        <div>
          <span class="font-bold uppercase tracking-wider text-muted text-[10px]">Rubrike</span>
          <div class="mt-1.5 flex flex-wrap gap-1">
            <button
              v-for="genre in genres" :key="genre._id"
              type="button"
              class="rounded-full border px-2.5 py-0.5 text-xs transition cursor-pointer font-medium"
              :class="form.genres.includes(genre.slug)
                ? 'border-accent bg-accent-soft text-accent font-bold shadow-2xs'
                : 'border-line-strong text-muted hover:border-accent'"
              @click="toggleGenre(genre.slug)"
            >
              {{ genre.name }}
            </button>
          </div>
        </div>

        <div>
          <span class="font-bold uppercase tracking-wider text-muted text-[10px]">Tagovi</span>
          <div class="mt-1.5 flex flex-wrap items-center gap-1">
            <button
              v-for="t in KNOWN_TAGS" :key="t.key"
              type="button"
              class="rounded-full border px-2.5 py-0.5 text-xs transition cursor-pointer font-medium"
              :class="(form.tags || []).includes(t.key)
                ? 'border-accent bg-accent-soft text-accent font-bold shadow-2xs'
                : 'border-line-strong text-muted hover:border-accent'"
              @click="toggleTag(t.key)"
            >
              {{ t.label }}
            </button>

            <span
              v-for="t in (form.tags || []).filter((x) => !KNOWN_TAGS.some((k) => k.key === x))" :key="t"
              class="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-xs text-accent font-bold"
            >
              {{ t }}
              <button type="button" class="text-xs hover:opacity-75 cursor-pointer" @click="removeTag(t)">×</button>
            </span>

            <div class="flex items-center gap-1">
              <input
                v-model="newTag"
                type="text"
                placeholder="novi tag…"
                class="w-20 rounded-lg border border-line-strong bg-panel px-2 py-0.5 text-xs outline-none focus:border-accent shadow-2xs"
                @keyup.enter.prevent="addCustomTag"
              />
              <button
                type="button"
                class="rounded-lg border border-line-strong px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent cursor-pointer transition"
                @click="addCustomTag"
              >Dodaj</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Segment Switcher (< lg) -->
    <div class="lg:hidden mb-3 flex items-center rounded-xl bg-panel border border-line p-1 shadow-xs text-xs font-semibold">
      <button
        type="button"
        class="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
        :class="mobileTab === 'editor' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
        @click="mobileTab = 'editor'"
      >
        <span>✏️ Uređivač</span>
        <span class="text-[10px] font-mono opacity-70">({{ usedChords.length }} akorda)</span>
      </button>
      <button
        type="button"
        class="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
        :class="mobileTab === 'preview' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
        @click="mobileTab = 'preview'"
      >
        <span>👁️ Pregled uživo</span>
        <span v-if="previewKey" class="text-[10px] font-mono text-accent font-bold">({{ previewKey }})</span>
      </button>
    </div>

    <!-- Workspace Grid -->
    <div
      class="grid gap-4 pb-12 lg:pb-0"
      :class="workspaceGridClass"
    >
      <!-- Left Column: Editor (Active on lg when layoutMode !== 'preview' OR when mobileTab === 'editor') -->
      <div
        v-show="layoutMode !== 'preview'"
        class="flex flex-col min-w-0"
        :class="{ 'hidden lg:flex': mobileTab !== 'editor' }"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-ink">Tekst i akordi</span>
            <span class="text-[11px] font-mono text-faint">({{ usedChords.length }} akorda)</span>
          </div>

          <div class="flex items-center gap-2">
            <FontSizeControl />

            <button
              type="button"
              class="flex items-center gap-1 rounded-xl border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-ink shadow-2xs cursor-pointer"
              title="Učitaj sliku ili skeniraj akorde"
              @click="importPanelRef?.openWithImage()"
            >
              <IconImage class="text-xs text-accent" />
              <span class="hidden sm:inline">Učitaj sliku</span>
            </button>

            <div class="flex items-center gap-1 rounded-xl border border-line-strong bg-panel p-0.5 text-xs shadow-2xs">
              <button
                type="button" class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                :class="mode === 'visual' ? 'bg-ink font-bold text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
                @click="mode = 'visual'"
              >Vizuelno</button>
              <button
                type="button" class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                :class="mode === 'raw' ? 'bg-ink font-bold text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
                @click="mode = 'raw'"
              >Sirovo</button>
            </div>
          </div>
        </div>

        <!-- Raw Mode Quick Formatting Toolbar -->
        <div
          v-if="mode === 'raw'"
          class="mb-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-line-soft bg-raised/50 p-1.5 text-xs"
        >
          <div class="flex flex-wrap items-center gap-1">
            <span class="text-[10px] text-faint font-semibold uppercase tracking-wider px-1">Umetni:</span>
            <button
              v-for="sec in ['Uvod', 'Strofa', 'Refren', 'Solo', 'Kraj']"
              :key="sec"
              type="button"
              class="rounded-lg border border-line-strong bg-panel px-2 py-0.5 text-[11px] text-muted hover:border-accent hover:text-accent transition cursor-pointer"
              @click="insertSection(sec)"
            >
              [{{ sec }}]
            </button>
            <button
              type="button"
              class="rounded-lg border border-accent bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent hover:text-on-accent transition cursor-pointer"
              title="Prečica: Cmd+K / Ctrl+K"
              @click="insertChordMarker"
            >
              + [Akord] <span class="text-[9px] opacity-70">(Cmd+K)</span>
            </button>
          </div>

          <!-- Quick Chords Palette in Raw Mode -->
          <div v-if="usedChords.length" class="flex flex-wrap items-center gap-1">
            <button
              v-for="c in usedChords"
              :key="c"
              type="button"
              class="rounded-lg bg-panel border border-line px-1.5 py-0.5 text-[11px] font-mono font-bold text-accent hover:border-accent hover:bg-accent hover:text-on-accent transition shadow-2xs cursor-pointer"
              @click="insertChord(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <!-- Visual vs Raw Editor Container with Dynamic Resizable Height -->
        <div
          v-if="mode === 'visual'"
          ref="editorContainerRef"
          class="rounded-2xl border border-line bg-panel p-4 sm:p-5 shadow-sm transition-all"
          :class="workspaceHeightClass"
          @scroll="onEditorScroll"
        >
          <ChordLineEditor v-model:content="form.content" />
        </div>

        <textarea
          v-else
          ref="editor"
          v-model="form.content"
          spellcheck="false"
          :style="{ fontSize: fontSize + 'px' }"
          placeholder="[Am]prvi stih ide [F]ovdje&#10;[C]drugi stih ide [G]ovdje&#10;&#10;[Refren]&#10;[Am]tekst refrena"
          class="w-full resize-none rounded-2xl border border-line-strong bg-panel p-4 sm:p-5 font-mono font-semibold text-ink leading-relaxed outline-none focus:border-accent focus:bg-surface/30 transition-all shadow-sm"
          :class="workspaceHeightClass"
          @keydown.meta.k.prevent="insertChordMarker"
          @keydown.ctrl.k.prevent="insertChordMarker"
          @scroll="onEditorScroll"
        />

        <p class="mt-2 text-xs text-faint flex items-center justify-between">
          <span>
            <template v-if="mode === 'visual'">
              Kliknite iznad riječi da dodate akord, ili prevucite postojeći akord po traci.
            </template>
            <template v-else>
              Akordi se pišu u uglastim zagradama [Am] tačno na slogu gdje se mijenjaju.
            </template>
          </span>
          <span class="font-mono text-[11px] text-muted">{{ form.content.length }} karaktera</span>
        </p>
      </div>

      <!-- Right Column: Live Rendered Preview with Transpose Controls (Active on lg when layoutMode !== 'editor' OR when mobileTab === 'preview') -->
      <div
        v-show="layoutMode !== 'editor'"
        class="flex flex-col min-w-0"
        :class="{ 'hidden lg:flex': mobileTab !== 'preview' }"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-ink">Pregled uživo</span>
            <span v-if="usedChords.length" class="flex flex-wrap gap-1">
              <code
                v-for="chord in usedChords.slice(0, 5)" :key="chord"
                class="rounded-md bg-accent-soft px-1.5 py-0.2 text-[11px] font-bold font-mono text-accent"
              >{{ chord }}</code>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <FontSizeControl />

            <!-- Transposition Stepper Controls -->
            <div class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-2.5 py-1 text-xs shadow-2xs">
              <span class="text-[11px] text-faint">Transponuj:</span>
              <button
                type="button"
                class="flex size-5 items-center justify-center rounded-lg border border-line text-muted hover:border-accent hover:text-ink transition font-bold cursor-pointer"
                title="-1 polustepen"
                @click="transposeSemitones--"
              >
                -
              </button>

              <span class="font-mono font-bold text-accent min-w-[2.5rem] text-center text-xs">
                {{ previewKey }}
                <span v-if="transposeSemitones !== 0" class="text-[10px] font-normal text-muted">
                  ({{ transposeSemitones > 0 ? '+' : '' }}{{ transposeSemitones }})
                </span>
              </span>

              <button
                type="button"
                class="flex size-5 items-center justify-center rounded-lg border border-line text-muted hover:border-accent hover:text-ink transition font-bold cursor-pointer"
                title="+1 polustepen"
                @click="transposeSemitones++"
              >
                +
              </button>

              <button
                v-if="transposeSemitones !== 0"
                type="button"
                class="text-[10px] text-faint hover:text-accent underline ml-1 cursor-pointer"
                @click="transposeSemitones = 0"
              >
                Reset
              </button>

              <button
                v-if="transposeSemitones !== 0"
                type="button"
                class="flex items-center gap-1 rounded-lg bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent hover:brightness-110 ml-1 transition shadow-xs cursor-pointer"
                title="Trajno primijeni ovaj tonalitet na stihove i akorde pjesme"
                @click="applyPermanentTranspose"
              >
                <IconCheck class="text-xs" /> Primijeni
              </button>
            </div>
          </div>
        </div>

        <div
          ref="previewContainerRef"
          class="rounded-2xl border border-line bg-panel p-4 sm:p-5 shadow-sm transition-all"
          :class="workspaceHeightClass"
          @scroll="onPreviewScroll"
        >
          <ChordSheet :content="previewContent" :original-key="previewKey" />
        </div>
      </div>
    </div>

    <!-- Sticky Mobile Save & Publish Bar (< lg) -->
    <div class="lg:hidden fixed bottom-12 left-0 right-0 z-20 bg-panel/95 backdrop-blur-md border-t border-line px-3.5 py-2 flex items-center justify-between gap-2.5 shadow-2xl">
      <button
        type="button"
        class="flex-1 rounded-lg border border-line-strong bg-surface/80 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-ink active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        :disabled="saving"
        @click="save('draft')"
      >
        <IconDraft class="text-sm" /> <span>Sačuvaj skicu</span>
      </button>

      <button
        type="button"
        class="flex-1 rounded-lg bg-accent py-2 text-xs font-bold text-on-accent hover:brightness-110 active:scale-95 transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        :disabled="saving"
        @click="save('published')"
      >
        <IconPublish class="text-sm" /> <span>{{ saving ? 'Spašavanje…' : 'Objavi' }}</span>
      </button>
    </div>
  </div>
</template>
