<script setup>
import { ref, computed, onMounted } from 'vue';
import AppModal from './AppModal.vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import IconAdd from '~icons/material-symbols/add-circle-outline-rounded';
import IconStar from '~icons/material-symbols/star-outline-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';

/**
 * Versions of one song.
 *
 * Ratings hang off the version, not the song, so a second transcription is how
 * a wrong chart stops being the only chart — readers vote and the better one
 * rises. That is the whole reason this panel exists.
 *
 * The form above still edits whichever version is primary; this panel is where
 * the others live. Saying so on screen matters, because two places editing the
 * same text with no explanation is how an editor loses work.
 */
const props = defineProps({
  songId: { type: String, required: true },
  arrangements: { type: Array, default: () => [] }
});
const emit = defineEmits(['changed']);

const toasts = useToasts();
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H',
              'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Hm'];
const DIFFICULTIES = [
  { value: 'easy', label: 'Lako' },
  { value: 'medium', label: 'Srednje' },
  { value: 'hard', label: 'Teško' }
];

const adding = ref(false);
const busy = ref(false);
const draft = ref({ label: '', originalKey: 'Am', capo: 0, difficulty: 'medium', content: '' });

/**
 * Versions that were removed but not destroyed.
 *
 * AI-NOTE: deleting a version keeps its ratings now — other people's judgement
 * of whether the chart was right, gathered over time, which is the part nobody
 * can retype. A recoverable delete with nowhere to undo it is worse than a
 * permanent one, because it looks like data loss and is not.
 */
const removed = ref([]);

async function loadRemoved() {
  try {
    const { data } = await client.get(`/songs/${props.songId}/arrangements/removed`);
    removed.value = data.arrangements || [];
  } catch {
    // A song that never had one deleted is the normal case; not worth a toast.
    removed.value = [];
  }
}

onMounted(loadRemoved);

const atLimit = computed(() => props.arrangements.length >= 6);

function startAdding() {
  draft.value = { label: '', originalKey: 'Am', capo: 0, difficulty: 'medium', content: '' };
  adding.value = true;
}

async function run(fn, okMessage) {
  busy.value = true;
  try {
    const { data } = await fn();
    toasts.success(okMessage);
    emit('changed', data.song);
    return true;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
    return false;
  } finally {
    busy.value = false;
  }
}

async function add() {
  if (!draft.value.content.trim()) {
    toasts.error('Tekst verzije je obavezan.');
    return;
  }
  const ok = await run(
    () => client.post(`/songs/${props.songId}/arrangements`, draft.value),
    'Verzija dodana.'
  );
  if (ok) adding.value = false;
}

const makePrimary = (a) => run(
  () => client.patch(`/songs/${props.songId}/arrangements/${a._id}/primary`),
  `„${a.label}" je sada glavna verzija.`
);

/** The version the dialog is asking about; null while it is closed. */
const confirming = ref(null);

async function remove(a) {
  const ok = await run(
    () => client.delete(`/songs/${props.songId}/arrangements/${a._id}`),
    'Verzija obrisana. Može se vratiti ispod.'
  );
  if (ok) await loadRemoved();
}

async function restore(a) {
  const ok = await run(
    () => client.post(`/songs/${props.songId}/arrangements/${a._id}/restore`),
    `„${a.label}" je vraćena.`
  );
  if (ok) await loadRemoved();
}

const whenRemoved = (iso) => new Date(iso).toLocaleString('bs');

const scoreOf = (a) => (a.ratingCount ? `★ ${Number(a.rating).toFixed(1)} (${a.ratingCount})` : 'bez ocjena');
const labelOf = (v) => DIFFICULTIES.find((d) => d.value === v)?.label || v;
</script>

<template>
  <section class="mb-4">
    <div class="mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-ink">Verzije ({{ arrangements.length }})</h2>
        <span class="text-[11px] text-faint">
          Obrazac iznad uređuje glavnu verziju.
          <span v-if="atLimit" class="text-warn">Dosegnut limit (6).</span>
        </span>
      </div>
      <button
        class="self-start sm:self-auto rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-accent disabled:opacity-50 transition cursor-pointer"
        :disabled="adding || atLimit || busy"
        @click="startAdding"
      >
        <span class="flex items-center gap-1"><IconAdd class="text-sm" /> Dodaj verziju</span>
      </button>
    </div>

    <ul class="space-y-1.5">
      <li
        v-for="a in arrangements" :key="a._id"
        class="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded border px-3 py-1.5 text-xs"
        :class="a.isPrimary ? 'border-accent/40 bg-accent/[0.03]' : 'border-line bg-panel/60'"
      >
        <span class="font-medium text-ink">{{ a.label }}</span>
        <span class="text-muted">
          {{ a.originalKey }}<template v-if="a.capo"> · kapo {{ a.capo }}</template>
          · {{ labelOf(a.difficulty) }} · {{ scoreOf(a) }}
        </span>
        <span
          v-if="a.isPrimary"
          class="rounded bg-accent-soft px-1.5 py-0.2 text-[9px] uppercase tracking-wide text-accent font-semibold"
        >glavna</span>

        <span class="ml-auto flex gap-1.5">
          <button
            v-if="!a.isPrimary"
            class="rounded border border-line-strong px-2 py-0.5 text-xs hover:border-accent disabled:opacity-50"
            :disabled="busy" @click="makePrimary(a)"
          ><span class="flex items-center gap-1"><IconStar /> Glavna</span></button>

          <button
            class="rounded border border-line-strong px-2 py-0.5 text-xs hover:border-danger hover:text-danger disabled:opacity-50"
            :disabled="busy || arrangements.length <= 1"
            :title="arrangements.length <= 1 ? 'Posljednja verzija se ne može obrisati.' : ''"
            @click="confirming = a"
          ><span class="flex items-center gap-1"><IconDelete /> Obriši</span></button>
        </span>
      </li>
    </ul>

    <div v-if="adding" class="mt-2.5 rounded border border-line-strong bg-panel p-3 text-xs">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block">
          <span class="text-sm font-medium">Naziv verzije</span>
          <input
            v-model="draft.label" placeholder="npr. Lakša verzija"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
        </label>
        <label class="block">
          <span class="text-sm font-medium">Tonalitet</span>
          <select v-model="draft.originalKey" class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent">
            <option v-for="key in KEYS" :key="key">{{ key }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-medium">Kapodaster</span>
          <input
            v-model.number="draft.capo" type="number" min="0" max="12"
            class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent"
          >
          <p class="mt-1.5 text-xs text-faint">Prijedlog — akordi u tekstu su ono što zvuči.</p>
        </label>
        <label class="block">
          <span class="text-sm font-medium">Težina</span>
          <select v-model="draft.difficulty" class="mt-1 w-full rounded border border-line-strong px-3 py-2 outline-none focus:border-accent">
            <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </label>
      </div>

      <label class="mt-4 block">
        <span class="text-sm font-medium">Tekst sa akordima</span>
        <textarea
          v-model="draft.content" rows="10"
          class="mt-1 w-full rounded border border-line-strong px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          placeholder="[Am]tekst sa akordima u uglastim zagradama"
        />
      </label>

      <div class="mt-3 flex justify-end gap-2">
        <button class="rounded px-4 py-2 text-sm text-muted hover:text-accent" @click="adding = false">
          Odustani
        </button>
        <button
          class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
          :disabled="busy" @click="add"
        >{{ busy ? 'Spašavanje…' : 'Dodaj verziju' }}</button>
      </div>
    </div>

    <!-- Only present once something is actually in it. -->
    <div v-if="removed.length" class="mt-4 rounded border border-line-soft p-3">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Obrisane verzije ({{ removed.length }})
      </h3>

      <ul class="space-y-1.5">
        <li
          v-for="a in removed" :key="a._id"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        >
          <span class="font-medium text-muted">{{ a.label }}</span>
          <span class="font-mono text-xs text-faint">{{ a.originalKey }}</span>
          <span v-if="a.ratingCount" class="text-xs text-faint">{{ a.ratingCount }} ocjena sačuvano</span>
          <span class="font-mono text-xs text-dim">{{ whenRemoved(a.deletedAt) }}</span>

          <button
            class="ml-auto rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                   transition hover:border-ok hover:text-ok disabled:opacity-40"
            :disabled="busy || atLimit"
            :title="atLimit ? 'Pjesma već ima šest verzija' : 'Vrati ovu verziju'"
            @click="restore(a)"
          >Vrati</button>
        </li>
      </ul>
    </div>

    <AppModal
      :model-value="Boolean(confirming)"
      title="Obrisati verziju?"
      :description="confirming ? `„${confirming.label}“ odlazi sa sajta, ali ostaje ovdje ispod. Ocjene se čuvaju.` : ''"
      confirm-label="Obriši"
      tone="danger"
      :busy="busy"
      @update:model-value="(open) => { if (!open) confirming = null; }"
      @confirm="() => { const a = confirming; confirming = null; remove(a); }"
    />
  </section>
</template>
