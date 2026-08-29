<script setup>
import { ref, computed, watch, onMounted, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import client from '../api/client';
import ChordSheet from '../components/ChordSheet.vue';
import ImportPanel from '../components/ImportPanel.vue';
import ChordLineEditor from '../components/ChordLineEditor.vue';
import ArrangementsPanel from '../components/ArrangementsPanel.vue';
import { extractChords, transposeContent, transposeChord } from '../utils/chordpro';
import { useToasts } from '../composables/useToasts';
import IconDraft from '~icons/material-symbols/save-rounded';
import IconPublish from '~icons/material-symbols/publish-rounded';
import IconImage from '~icons/material-symbols/image-outline-rounded';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();
const route = useRoute();
const editor = useTemplateRef('editor');
const importPanelRef = ref(null);
const toasts = useToasts();

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
  difficulty: 'medium', tags: [], genres: [], content: '', status: 'draft'
});
const genres = ref([]);
const newTag = ref('');
// Visual placement is the default; the raw view stays for bulk paste and for
// fixing anything the click editor cannot express.
const mode = ref('visual');
const saving = ref(false);
const error = ref(null);

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
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold tracking-tight">
        {{ props.id ? 'Uredi pjesmu' : 'Nova pjesma' }}
      </h1>
      <ImportPanel ref="importPanelRef" @imported="applyImport" />
    </div>
    <div class="flex items-center gap-2">
      <button
        class="rounded border border-line-strong px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink transition"
        :disabled="saving" @click="save('draft')"
      >
        <span class="flex items-center gap-1.5"><IconDraft /> Sačuvaj skicu</span>
      </button>
      <button
        class="rounded bg-accent px-4 py-1 text-xs font-semibold text-on-accent hover:brightness-110 disabled:opacity-50 transition shadow-xs"
        :disabled="saving" @click="save('published')"
      >
        <span class="flex items-center gap-1.5">
          <IconPublish /> {{ saving ? 'Spašavanje…' : 'Objavi' }}
        </span>
      </button>
    </div>
  </div>

  <p v-if="error" class="mb-3 rounded bg-accent-soft px-3 py-1.5 text-xs text-accent">{{ error }}</p>

  <div class="mb-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6 text-xs">
    <label class="block lg:col-span-2">
      <span class="font-medium text-muted">Naslov</span>
      <input v-model="form.title" class="mt-1 w-full rounded border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent" />
    </label>
    <label class="block lg:col-span-2">
      <span class="font-medium text-muted">Izvođač</span>
      <input v-model="form.artist" class="mt-1 w-full rounded border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent" />
    </label>
    <label class="block lg:col-span-1">
      <span class="font-medium text-muted">Tonalitet</span>
      <select v-model="form.originalKey" class="mt-1 w-full rounded border border-line-strong bg-panel px-2 py-1.5 text-xs outline-none focus:border-accent font-mono font-semibold">
        <option v-for="key in KEYS" :key="key">{{ key }}</option>
      </select>
    </label>
    <label class="block lg:col-span-1">
      <span class="font-medium text-muted">Kapodaster</span>
      <input v-model.number="form.capo" type="number" min="0" max="12"
             class="mt-1 w-full rounded border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono" />
    </label>

    <label class="block lg:col-span-1">
      <span class="font-medium text-muted">Težina</span>
      <select v-model="form.difficulty" class="mt-1 w-full rounded border border-line-strong bg-panel px-2 py-1.5 text-xs outline-none focus:border-accent">
        <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
      </select>
    </label>

    <label class="block lg:col-span-1">
      <span class="font-medium text-muted">Godina <span class="font-normal text-faint">(opc.)</span></span>
      <input v-model.number="form.year" type="number" min="1900" :max="new Date().getFullYear() + 1"
             placeholder="npr. 1974"
             class="mt-1 w-full rounded border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent font-mono" />
    </label>

    <label class="block lg:col-span-4">
      <span class="font-medium text-muted">YouTube link <span class="font-normal text-faint">(opciono)</span></span>
      <input
        v-model="form.youtube"
        placeholder="youtube.com/watch?v=… ili youtu.be/…"
        class="mt-1 w-full rounded border border-line-strong bg-panel px-2.5 py-1.5 text-xs outline-none focus:border-accent"
      >
    </label>
  </div>

  <ArrangementsPanel
    v-if="props.id"
    :song-id="props.id"
    :arrangements="arrangements"
    @changed="onArrangementsChanged"
  />

  <div class="mb-3.5 grid gap-3 sm:grid-cols-2 rounded border border-line-soft bg-panel/40 p-2.5 text-xs">
    <div>
      <span class="font-semibold uppercase tracking-wider text-muted text-[10px]">Rubrike</span>
      <div class="mt-1 flex flex-wrap gap-1">
        <button
          v-for="genre in genres" :key="genre._id"
          type="button"
          class="rounded-full border px-2.5 py-0.5 text-xs transition"
          :class="form.genres.includes(genre.slug)
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line-strong text-muted hover:border-accent'"
          @click="toggleGenre(genre.slug)"
        >
          {{ genre.name }}
        </button>
      </div>
    </div>

    <div>
      <span class="font-semibold uppercase tracking-wider text-muted text-[10px]">Tagovi</span>
      <div class="mt-1 flex flex-wrap items-center gap-1">
        <button
          v-for="t in KNOWN_TAGS" :key="t.key"
          type="button"
          class="rounded-full border px-2.5 py-0.5 text-xs transition"
          :class="(form.tags || []).includes(t.key)
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line-strong text-muted hover:border-accent'"
          @click="toggleTag(t.key)"
        >
          {{ t.label }}
        </button>

        <span
          v-for="t in (form.tags || []).filter((x) => !KNOWN_TAGS.some((k) => k.key === x))" :key="t"
          class="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-xs text-accent"
        >
          {{ t }}
          <button type="button" class="text-xs hover:opacity-75" @click="removeTag(t)">×</button>
        </span>

        <div class="flex items-center gap-1">
          <input
            v-model="newTag"
            type="text"
            placeholder="novi tag…"
            class="w-20 rounded border border-line-strong bg-panel px-2 py-0.5 text-xs outline-none focus:border-accent"
            @keyup.enter.prevent="addCustomTag"
          />
          <button
            type="button"
            class="rounded border border-line-strong px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
            @click="addCustomTag"
          >Dodaj</button>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <!-- Left Column: Editor -->
    <div class="flex flex-col">
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Tekst i akordi</span>
          <span class="text-[11px] text-faint">({{ usedChords.length }} akorda)</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1 rounded border border-line-strong bg-panel px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-ink"
            title="Učitaj sliku ili skeniraj akorde"
            @click="importPanelRef?.openWithImage()"
          >
            <IconImage class="text-xs text-accent" />
            <span>Učitaj sliku</span>
          </button>

          <div class="flex items-center gap-1 rounded border border-line-strong bg-panel p-0.5 text-xs shadow-2xs">
            <button
              type="button" class="rounded px-2.5 py-1 transition"
              :class="mode === 'visual' ? 'bg-ink font-semibold text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
              @click="mode = 'visual'"
            >Vizuelno</button>
            <button
              type="button" class="rounded px-2.5 py-1 transition"
              :class="mode === 'raw' ? 'bg-ink font-semibold text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
              @click="mode = 'raw'"
            >Tekst</button>
          </div>
        </div>
      </div>

      <!-- Raw Mode Quick Formatting Toolbar -->
      <div
        v-if="mode === 'raw'"
        class="mb-2 flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-line-soft bg-raised/50 p-1.5 text-xs"
      >
        <div class="flex flex-wrap items-center gap-1">
          <span class="text-[10px] text-faint font-semibold uppercase tracking-wider px-1">Umetni:</span>
          <button
            v-for="sec in ['Uvod', 'Strofa', 'Refren', 'Solo', 'Kraj']"
            :key="sec"
            type="button"
            class="rounded border border-line-strong bg-panel px-2 py-0.5 text-[11px] text-muted hover:border-accent hover:text-accent transition"
            @click="insertSection(sec)"
          >
            [{{ sec }}]
          </button>
          <button
            type="button"
            class="rounded border border-accent bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent hover:text-on-accent transition"
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
            class="rounded bg-panel border border-line px-1.5 py-0.5 text-[11px] font-mono font-bold text-accent hover:border-accent hover:bg-accent hover:text-on-accent transition shadow-2xs"
            @click="insertChord(c)"
          >
            {{ c }}
          </button>
        </div>
      </div>

      <!-- Visual vs Raw Editor -->
      <div
        v-if="mode === 'visual'"
        class="h-[30rem] overflow-auto rounded-xl border border-line-strong bg-panel p-4 shadow-sm"
      >
        <ChordLineEditor v-model:content="form.content" />
      </div>

      <textarea
        v-else
        ref="editor"
        v-model="form.content"
        spellcheck="false"
        placeholder="[Am]prvi stih ide [F]ovdje&#10;[C]drugi stih ide [G]ovdje&#10;&#10;[Refren]&#10;[Am]tekst refrena"
        class="h-[30rem] w-full resize-none rounded-xl border border-line-strong bg-panel p-4 font-mono text-[14px] leading-relaxed outline-none focus:border-accent shadow-sm"
        @keydown.meta.k.prevent="insertChordMarker"
        @keydown.ctrl.k.prevent="insertChordMarker"
      />

      <p class="mt-2 text-xs text-faint flex items-center justify-between">
        <span>
          <template v-if="mode === 'visual'">
            Kliknite iznad riječi da dodate akord, ili prevucite postojeći akord horizontalno.
          </template>
          <template v-else>
            Akordi se pišu u uglastim zagradama [Am] tačno na slogu gdje se mijenjaju.
          </template>
        </span>
        <span class="font-mono text-[11px] text-muted">{{ form.content.length }} karaktera</span>
      </p>
    </div>

    <!-- Right Column: Live Rendered Preview with Transpose Controls -->
    <div class="flex flex-col">
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Pregled uživo</span>
          <span v-if="usedChords.length" class="flex flex-wrap gap-1">
            <code
              v-for="chord in usedChords" :key="chord"
              class="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-bold text-accent"
            >{{ chord }}</code>
          </span>
        </div>

        <!-- Transposition Stepper Controls -->
        <div class="flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-2 py-0.5 text-xs shadow-2xs">
          <span class="text-[11px] text-faint">Transponuj:</span>
          <button
            type="button"
            class="flex size-5 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-ink transition font-bold"
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
            class="flex size-5 items-center justify-center rounded border border-line text-muted hover:border-accent hover:text-ink transition font-bold"
            title="+1 polustepen"
            @click="transposeSemitones++"
          >
            +
          </button>

          <button
            v-if="transposeSemitones !== 0"
            type="button"
            class="text-[10px] text-faint hover:text-accent underline ml-1"
            @click="transposeSemitones = 0"
          >
            Reset
          </button>
        </div>
      </div>

      <div class="h-[30rem] overflow-auto rounded-xl border border-line bg-panel p-4 shadow-sm">
        <ChordSheet :content="previewContent" :original-key="previewKey" />
      </div>
    </div>
  </div>
</template>
