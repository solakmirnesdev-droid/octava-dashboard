<script setup>
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import ChordSheet from '../components/ChordSheet.vue';
import ImportPanel from '../components/ImportPanel.vue';
import ChordLineEditor from '../components/ChordLineEditor.vue';
import ArrangementsPanel from '../components/ArrangementsPanel.vue';
import { extractChords } from '../utils/chordpro';
import { useToasts } from '../composables/useToasts';
import IconDraft from '~icons/material-symbols/save-rounded';
import IconPublish from '~icons/material-symbols/publish-rounded';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();
const editor = useTemplateRef('editor');
const toasts = useToasts();

/**
 * AI-TRAP: our notation, not the American one. H is the twelfth degree and
 * sharps are written instead of flats — this list offered Bb and B while every
 * page in the app renders A# and H, so an editor picked a key the reader never
 * sees. The importer still understands the American spelling on the way in.
 */
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H',
              'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Hm'];

const form = ref({
  title: '', artist: '', originalKey: 'Am', capo: 0, year: null,
  difficulty: 'medium', tags: [], genres: [], content: '', status: 'draft'
});
const genres = ref([]);
// Visual placement is the default; the raw view stays for bulk paste and for
// fixing anything the click editor cannot express.
const mode = ref('visual');
const saving = ref(false);
const error = ref(null);

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

onMounted(async () => {
  try {
    const { data } = await client.get('/genres');
    genres.value = data.genres || [];
  } catch {
    // The picker degrades to empty; the song can still be saved without one.
  }

  if (!props.id) return;
  try {
    const { data } = await client.get(`/songs/${props.id}`);
    form.value = {
      ...form.value,
      ...data.song,
      artist: data.song.artist?.name || '',
      // The API returns populated genre objects; the form works in slugs.
      genres: (data.song.genres || []).map((g) => g.slug || g)
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
});

function applyImport({ content, originalKey }) {
  form.value.content = content;
  if (originalKey) form.value.originalKey = originalKey;
}

function toggleGenre(slug) {
  const next = new Set(form.value.genres);
  next.has(slug) ? next.delete(slug) : next.add(slug);
  form.value.genres = [...next];
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
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-xl font-semibold tracking-tight">
      {{ props.id ? 'Uredi pjesmu' : 'Nova pjesma' }}
    </h1>
    <div class="flex gap-2">
      <button
        class="rounded border border-line-strong px-4 py-2 text-sm hover:border-accent"
        :disabled="saving" @click="save('draft')"
      >
        <span class="flex items-center gap-1.5"><IconDraft /> Sačuvaj skicu</span>
      </button>
      <button
        class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
        :disabled="saving" @click="save('published')"
      >
        <span class="flex items-center gap-1.5">
          <IconPublish /> {{ saving ? 'Spašavanje…' : 'Objavi' }}
        </span>
      </button>
    </div>
  </div>

  <p v-if="error" class="mb-4 rounded bg-accent-soft px-4 py-2 text-sm text-accent">{{ error }}</p>

  <ImportPanel @imported="applyImport" />

  <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <label class="block">
      <span class="text-sm font-medium">Naslov</span>
      <input v-model="form.title" class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent" />
    </label>
    <label class="block">
      <span class="text-sm font-medium">Izvođač</span>
      <input v-model="form.artist" class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent" />
    </label>
    <label class="block">
      <span class="text-sm font-medium">Tonalitet</span>
      <select v-model="form.originalKey" class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent">
        <option v-for="key in KEYS" :key="key">{{ key }}</option>
      </select>
    </label>
    <label class="block">
      <span class="text-sm font-medium">Kapodaster</span>
      <input v-model.number="form.capo" type="number" min="0" max="12"
             class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent" />
      <!-- The site reads this as a suggestion, never as an offset already
           applied to the symbols. Saying so here is what keeps the two ends
           agreeing: an editor who thinks the box shifts the chords will type
           shapes, and every key label on that song becomes wrong. -->
      <p class="mt-1.5 text-xs text-faint">Prijedlog za sviranje. Akordi u tekstu su ono što <em class="not-italic font-medium">zvuči</em> — kapodaster ih ne pomjera.</p>
    </label>

    <label class="block">
      <span class="text-sm font-medium">Godina <span class="font-normal text-faint">(nije obavezno)</span></span>
      <!-- The field has been on the schema and in the public payload since the
           beginning, but nothing ever sent one, so every song showed a blank
           where a year belongs. The API bounds it; this only has to offer it. -->
      <input v-model.number="form.year" type="number" min="1900" :max="new Date().getFullYear() + 1"
             placeholder="npr. 1974"
             class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent" />
    </label>

    <label class="block lg:col-span-2">
      <span class="text-sm font-medium">YouTube <span class="font-normal text-faint">(nije obavezno)</span></span>
      <input
        v-model="form.youtube"
        placeholder="Zalijepi link — youtube.com/watch?v=… ili youtu.be/…"
        class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
      >
    </label>
  </div>

  <!-- Only for a saved song: versions hang off an id that does not exist yet

       while the first one is still being written. -->

  <ArrangementsPanel

    v-if="props.id"

    :song-id="props.id"

    :arrangements="arrangements"

    @changed="onArrangementsChanged"

  />


  <div class="mb-6">
    <span class="text-sm font-medium">Rubrike</span>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
      <button
        v-for="genre in genres" :key="genre._id"
        type="button"
        class="rounded-full border px-3 py-1 text-xs transition"
        :class="form.genres.includes(genre.slug)
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line-strong text-muted hover:border-accent'"
        @click="toggleGenre(genre.slug)"
      >
        {{ genre.name }}
      </button>
    </div>
    <p class="mt-1.5 text-xs text-faint">
      Pjesma može biti u više rubrika — npr. Domaća i Zabavna istovremeno.
    </p>
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div>
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium">Tekst i akordi</span>

        <div class="flex items-center gap-1 rounded border border-line-strong p-0.5 text-xs">
          <button
            type="button" class="rounded px-2 py-1"
            :class="mode === 'visual' ? 'bg-ink text-on-ink' : 'text-muted hover:text-accent'"
            @click="mode = 'visual'"
          >Vizuelno</button>
          <button
            type="button" class="rounded px-2 py-1"
            :class="mode === 'raw' ? 'bg-ink text-on-ink' : 'text-muted hover:text-accent'"
            @click="mode = 'raw'"
          >Tekst</button>
        </div>
      </div>

      <div
        v-if="mode === 'visual'"
        class="h-[28rem] overflow-auto rounded border border-line-strong bg-panel p-4"
      >
        <ChordLineEditor v-model:content="form.content" />
      </div>

      <textarea
        v-else
        ref="editor"
        v-model="form.content"
        spellcheck="false"
        placeholder="[Am]prvi stih ide [F]ovdje&#10;[C]drugi stih ide [G]ovdje&#10;&#10;[Refren]&#10;[Am]tekst refrena"
        class="h-[28rem] w-full resize-none rounded border border-line-strong bg-panel p-4 font-mono text-[15px] leading-relaxed outline-none focus:border-accent"
        @keydown.meta.k.prevent="insertChordMarker"
        @keydown.ctrl.k.prevent="insertChordMarker"
      />

      <p class="mt-2 text-xs text-faint">
        <template v-if="mode === 'visual'">
          Klikni iznad stiha na mjesto gdje se akord mijenja. Klik na postojeći
          akord ga mijenja, prazno polje ga briše.
        </template>
        <template v-else>
          Akordi idu u uglastim zagradama, tačno na slogu gdje se mijenjaju.
          Oznake dijelova ([Refren], [Solo]) pišu se u svom redu.
        </template>
      </p>
    </div>

    <div>
      <div class="mb-2 flex items-center gap-3">
        <span class="text-sm font-medium">Pregled</span>
        <span v-if="usedChords.length" class="flex flex-wrap gap-1">
          <code
            v-for="chord in usedChords" :key="chord"
            class="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent"
          >{{ chord }}</code>
        </span>
      </div>
      <div class="h-[28rem] overflow-auto rounded border border-line bg-panel p-4">
        <ChordSheet :content="form.content" :original-key="form.originalKey" />
      </div>
    </div>
  </div>
</template>
