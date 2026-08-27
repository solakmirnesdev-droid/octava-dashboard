<script setup>
import { ref, computed } from 'vue';
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

function remove() {
  // Deletion is recoverable now, so this asks once rather than making people
  // type the word "obriši" — but it still asks, because 200 rows is 200 rows.
  const ok = window.confirm(
    `Poslati ${count.value} ${count.value === 1 ? 'pjesmu' : 'pjesama'} u korpu?\n\n`
    + 'Mogu se vratiti iz korpe.'
  );
  if (ok) run('delete', null, 'su obrisane');
}
</script>

<template>
  <!-- Sticky at the foot of the viewport: the selection is made by scrolling
       through the list, so the controls have to stay where the eyes already are. -->
  <div
    class="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line-strong
           bg-panel p-3 text-sm shadow-lg"
  >
    <span class="mr-1 font-medium">
      {{ count }} <span class="font-normal text-muted">izabrano</span>
    </span>

    <button
      class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
             hover:border-ok hover:text-ok disabled:opacity-40"
      :disabled="busy" @click="run('status', 'published', 'su objavljene')"
    ><IconPublish /> Objavi</button>

    <button
      class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
             hover:border-warn hover:text-warn disabled:opacity-40"
      :disabled="busy" @click="run('status', 'draft', 'su na čekanju')"
    ><IconUnpublish /> Skini s objave</button>

    <span class="mx-1 h-5 w-px bg-sunken" aria-hidden="true" />

    <select
      v-model="genre"
      class="rounded border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent"
      aria-label="Žanr"
    >
      <option value="">Žanr…</option>
      <option v-for="g in genres" :key="g._id" :value="g.slug">{{ g.name }}</option>
    </select>
    <button
      class="rounded border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40"
      :disabled="busy" @click="applyGenre('addGenre')"
    >Dodaj</button>
    <button
      class="rounded border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40"
      :disabled="busy" @click="applyGenre('removeGenre')"
    >Ukloni</button>

    <span class="mx-1 h-5 w-px bg-sunken" aria-hidden="true" />

    <input
      v-model="tag" type="text" placeholder="tag…"
      class="w-24 rounded border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent"
      aria-label="Tag"
      @keyup.enter="applyTag('addTag')"
    >
    <button
      class="rounded border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40"
      :disabled="busy" @click="applyTag('addTag')"
    >Dodaj</button>
    <button
      class="rounded border border-line-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-40"
      :disabled="busy" @click="applyTag('removeTag')"
    >Ukloni</button>

    <button
      v-if="canDelete"
      class="ml-auto flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
             hover:border-danger hover:text-danger disabled:opacity-40"
      :disabled="busy" @click="remove"
    ><IconDelete /> Obriši</button>

    <button
      class="flex items-center gap-1 rounded px-2 py-1 text-xs text-faint hover:text-ink"
      :class="canDelete ? '' : 'ml-auto'"
      :disabled="busy" @click="emit('clear')"
    ><IconClose /> Poništi izbor</button>
  </div>
</template>
