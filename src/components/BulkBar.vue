<script setup>
import { ref, computed } from 'vue';
import AppModal from './AppModal.vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import IconPublish from '~icons/material-symbols/visibility-rounded';
import IconUnpublish from '~icons/material-symbols/visibility-off-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconClose from '~icons/material-symbols/close-rounded';

/**
 * One edit across a selection.
 *
 * AI-DECISION: this exists because recategorising 1590 songs one row at a time
 * is not work anybody does — they write a script against the database instead,
 * and a script is the one kind of change the audit log cannot see. Routing bulk
 * edits through the API keeps them on the record. See AI-NOTES.md §5.
 */
const props = defineProps({
  ids: { type: Array, required: true },
  genres: { type: Array, default: () => [] },
  canDelete: { type: Boolean, default: false }
});

const emit = defineEmits(['done', 'clear']);

const toasts = useToasts();
const busy = ref(false);
const genre = ref('');
const tag = ref('');

const count = computed(() => props.ids.length);

async function run(action, value, describe) {
  if (busy.value || !count.value) return;
  busy.value = true;

  try {
    const { data } = await client.post('/songs/bulk', { ids: props.ids, action, value });

    // "Touched" and "requested" differ whenever some rows already had the value.
    // Saying so is the difference between a report and a reassurance.
    if (data.touched === 0) {
      toasts.success('Ništa nije promijenjeno', { detail: `Sve izabrane pjesme već ${describe}.` });
    } else if (data.touched < data.requested) {
      toasts.success(`Promijenjeno: ${data.touched} od ${data.requested}`, {
        detail: `Ostale su već ${describe}.`
      });
    } else {
      toasts.success(`Promijenjeno: ${data.touched}`);
    }

    emit('done');
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Grupna izmjena nije uspjela.');
  } finally {
    busy.value = false;
  }
}

function applyGenre(action) {
  if (!genre.value) return toasts.error('Izaberi žanr.');
  const name = props.genres.find((g) => g.slug === genre.value)?.name || genre.value;
  run(action, genre.value, action === 'addGenre' ? `imaju žanr ${name}` : `nemaju žanr ${name}`);
}

function applyTag(action) {
  const value = tag.value.trim().toLowerCase();
  if (!value) return toasts.error('Upiši tag.');
  run(action, value, action === 'addTag' ? `imaju tag ${value}` : `nemaju tag ${value}`);
}

const asking = ref(false);

function remove() {
  asking.value = true;
}
</script>

<template>
  <!-- Sticky at the foot of the viewport: positioned above mobile bottom nav on small screens -->
  <div
    class="sticky bottom-14 sm:bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line-strong
           bg-panel/95 backdrop-blur-md p-3 text-xs sm:text-sm shadow-2xl animate-in slide-in-from-bottom duration-200"
  >
    <div class="flex items-center gap-2 mr-1">
      <span class="font-bold text-ink">
        {{ count }} <span class="font-normal text-muted">izabrano</span>
      </span>
    </div>

    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        class="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted
               hover:border-ok hover:text-ok disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="run('status', 'published', 'su objavljene')"
      ><IconPublish class="text-sm" /> Objavi</button>

      <button
        class="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted
               hover:border-warn hover:text-warn disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="run('status', 'draft', 'su na čekanju')"
      ><IconUnpublish class="text-sm" /> Skini s objave</button>

      <span class="hidden sm:inline-block mx-1 h-4 w-px bg-line" aria-hidden="true" />

      <select
        v-model="genre"
        class="rounded-lg border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent shadow-2xs font-medium cursor-pointer"
        aria-label="Žanr"
      >
        <option value="">Žanr…</option>
        <option v-for="g in genres" :key="g._id" :value="g.slug">{{ g.name }}</option>
      </select>
      <button
        class="rounded-lg border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="applyGenre('addGenre')"
      >+ Žanr</button>
      <button
        class="rounded-lg border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="applyGenre('removeGenre')"
      >- Žanr</button>

      <span class="hidden sm:inline-block mx-1 h-4 w-px bg-line" aria-hidden="true" />

      <input
        v-model="tag" type="text" placeholder="tag…"
        class="w-20 sm:w-24 rounded-lg border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent shadow-2xs"
        aria-label="Tag"
        @keyup.enter="applyTag('addTag')"
      >
      <button
        class="rounded-lg border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="applyTag('addTag')"
      >+ Tag</button>
      <button
        class="rounded-lg border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="applyTag('removeTag')"
      >- Tag</button>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <button
        v-if="canDelete"
        class="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted
               hover:border-danger hover:text-danger disabled:opacity-40 transition cursor-pointer font-medium"
        :disabled="busy" @click="remove"
      ><IconDelete class="text-sm" /> Obriši</button>

      <button
        class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-faint hover:text-ink transition cursor-pointer font-medium"
        :disabled="busy" @click="emit('clear')"
      ><IconClose class="text-sm" /> Poništi</button>
    </div>

    <AppModal
      v-model="asking"
      title="Poslati u kantu?"
      :description="`${count} ${count === 1 ? 'pjesma ide' : 'pjesama ide'} u kantu. Mogu se vratiti odande u svakom trenutku.`"
      confirm-label="Obriši"
      tone="danger"
      :busy="busy"
      @confirm="() => { asking = false; run('delete', null, 'su obrisane'); }"
    />
  </div>
</template>
