<script setup>
import { ref, computed } from 'vue';
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

async function remove(a) {
  if (!confirm(`Obrisati verziju „${a.label}"? Glasovi za nju se brišu s njom.`)) return;
  await run(
    () => client.delete(`/songs/${props.songId}/arrangements/${a._id}`),
    'Verzija obrisana.'
  );
}

const scoreOf = (a) => (a.ratingCount ? `★ ${Number(a.rating).toFixed(1)} (${a.ratingCount})` : 'bez ocjena');
const labelOf = (v) => DIFFICULTIES.find((d) => d.value === v)?.label || v;
</script>

<template>
  <section class="mb-6">
    <div class="mb-2 flex items-center justify-between">
      <h2 class="text-sm font-medium">Verzije ({{ arrangements.length }})</h2>
      <button
        class="rounded border border-black/15 px-4 py-2 text-sm hover:border-accent disabled:opacity-50"
        :disabled="adding || atLimit || busy"
        @click="startAdding"
      >
        <span class="flex items-center gap-1.5"><IconAdd /> Dodaj verziju</span>
      </button>
    </div>

    <p class="mb-3 text-sm text-black/45">
      Obrazac iznad uređuje <strong class="font-medium">glavnu</strong> verziju. Ocjene čitalaca
      idu na pojedinu verziju, ne na pjesmu.
      <span v-if="atLimit"> Dosegnut je najveći broj verzija (6).</span>
    </p>

    <ul class="space-y-2">
      <li
        v-for="a in arrangements" :key="a._id"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border px-4 py-3"
        :class="a.isPrimary ? 'border-accent/40 bg-accent/[0.03]' : 'border-black/15'"
      >
        <span class="font-medium">{{ a.label }}</span>
        <span class="text-sm text-black/50">
          {{ a.originalKey }}<template v-if="a.capo"> · kapo {{ a.capo }}</template>
          · {{ labelOf(a.difficulty) }} · {{ scoreOf(a) }}
        </span>
        <span
          v-if="a.isPrimary"
          class="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent"
        >glavna</span>

        <span class="ml-auto flex gap-2">
          <button
            v-if="!a.isPrimary"
            class="rounded border border-black/15 px-2.5 py-1 text-sm hover:border-accent disabled:opacity-50"
            :disabled="busy" @click="makePrimary(a)"
          ><span class="flex items-center gap-1.5"><IconStar /> Postavi kao glavnu</span></button>

          <button
            class="rounded border border-black/15 px-2.5 py-1 text-sm hover:border-accent disabled:opacity-50"
            :disabled="busy || arrangements.length <= 1"
            :title="arrangements.length <= 1 ? 'Posljednja verzija se ne može obrisati.' : ''"
            @click="remove(a)"
          ><span class="flex items-center gap-1.5"><IconDelete /> Obriši</span></button>
        </span>
      </li>
    </ul>

    <div v-if="adding" class="mt-3 rounded border border-black/15 px-4 py-3">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block">
          <span class="text-sm font-medium">Naziv verzije</span>
          <input
            v-model="draft.label" placeholder="npr. Lakša verzija"
            class="mt-1 w-full rounded border border-black/15 px-3 py-2 outline-none focus:border-accent"
          >
        </label>
        <label class="block">
          <span class="text-sm font-medium">Tonalitet</span>
          <select v-model="draft.originalKey" class="mt-1 w-full rounded border border-black/15 px-3 py-2 outline-none focus:border-accent">
            <option v-for="key in KEYS" :key="key">{{ key }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-medium">Kapodaster</span>
          <input
            v-model.number="draft.capo" type="number" min="0" max="12"
            class="mt-1 w-full rounded border border-black/15 px-3 py-2 outline-none focus:border-accent"
          >
        </label>
        <label class="block">
          <span class="text-sm font-medium">Težina</span>
          <select v-model="draft.difficulty" class="mt-1 w-full rounded border border-black/15 px-3 py-2 outline-none focus:border-accent">
            <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </label>
      </div>

      <label class="mt-4 block">
        <span class="text-sm font-medium">Tekst sa akordima</span>
        <textarea
          v-model="draft.content" rows="10"
          class="mt-1 w-full rounded border border-black/15 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          placeholder="[Am]tekst sa akordima u uglastim zagradama"
        />
      </label>

      <div class="mt-3 flex justify-end gap-2">
        <button class="rounded px-4 py-2 text-sm text-black/60 hover:text-accent" @click="adding = false">
          Odustani
        </button>
        <button
          class="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-50"
          :disabled="busy" @click="add"
        >{{ busy ? 'Spašavanje…' : 'Dodaj verziju' }}</button>
      </div>
    </div>
  </section>
</template>
