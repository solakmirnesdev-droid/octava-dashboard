<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import AppModal from '../components/AppModal.vue';
import IconRestore from '~icons/material-symbols/restore-from-trash-rounded';
import IconPurge from '~icons/material-symbols/delete-forever-outline-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';

/**
 * Everything that was deleted but not destroyed.
 *
 * AI-NOTE: this view is the reason deleting is safe to do. Without somewhere to
 * see and undo it, a soft delete is just a hidden record nobody knows how to get
 * back — which is worse than a hard one, because it looks like data loss and is
 * not. See AI-NOTES.md §5.
 *
 * AI-DECISION: songs and artists share this page rather than each keeping their
 * own. A bin has to be one place: somebody looking for what they deleted should
 * not first have to work out what kind of thing it was and go to the matching
 * screen. The artist bin used to be a toggle inside the artists list, where
 * nobody would look for it.
 *
 * Removed arrangements stay in the song editor on purpose — a version means
 * nothing away from the song it belongs to, and there is no global list of them
 * to build one from.
 */
const TABS = [
  { key: 'songs', label: 'Pjesme' },
  { key: 'artists', label: 'Izvođači' }
];
const tab = ref('songs');
const toasts = useToasts();
const auth = useAuthStore();

const songs = ref([]);
const artists = ref([]);
const meta = ref(null);
const loading = ref(true);
const busyId = ref(null);
const page = ref(1);

const when = (iso) => (iso ? new Date(iso).toLocaleString('bs') : '—');

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'songs') {
      const { data } = await client.get('/songs/trash', { params: { page: page.value, limit: 25 } });
      songs.value = data.songs || [];
      meta.value = data.meta;
    } else {
      // The artist bin is not paged: it holds what a person deleted by hand,
      // which is a short list, not an import gone wrong.
      const { data } = await client.get('/artists/trash');
      artists.value = data.artists || [];
      meta.value = null;
    }
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje kante nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

function pick(key) {
  tab.value = key;
  page.value = 1;
  load();
}

async function restoreArtist(artist) {
  busyId.value = artist._id;
  try {
    await client.post(`/artists/${artist._id}/restore`);
    artists.value = artists.value.filter((a) => a._id !== artist._id);
    toasts.success(`Vraćen: ${artist.name}`);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Vraćanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

async function purgeArtist(artist) {
  busyId.value = artist._id;
  try {
    await client.delete(`/artists/${artist._id}/purge`);
    artists.value = artists.value.filter((a) => a._id !== artist._id);
    toasts.success(`Trajno uklonjen: ${artist.name}`);
  } catch (err) {
    // The API refuses while songs still point at them; say which, not just no.
    toasts.error(err.response?.data?.message || 'Uklanjanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const purgingArtist = ref(null);

onMounted(load);

function turn(to) {
  page.value = to;
  load();
}

async function restore(song) {
  busyId.value = song._id;
  try {
    await client.post(`/songs/${song._id}/restore`);
    songs.value = songs.value.filter((s) => s._id !== song._id);
    if (meta.value) meta.value.total -= 1;
    toasts.success(`Vraćeno: ${song.title}`, { detail: song.artist?.name });
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Vraćanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

/**
 * The only irreversible action left in the tool.
 *
 * AI-DECISION: it asks for the title to be typed rather than for a yes. A
 * confirm is muscle memory by the second one, and this takes the song's ratings
 * and reviews with it. Typing the title is a deliberate act that cannot be done
 * by reflex — and the dialog can show the title beside the field, which a
 * window.prompt could not.
 */
const purging = ref(null);
const typed = ref('');

const titleMatches = computed(() =>
  purging.value && typed.value.trim() === purging.value.title.trim());

function askPurge(song) {
  purging.value = song;
  typed.value = '';
}

async function purge() {
  const song = purging.value;
  if (!song || !titleMatches.value) return;
  purging.value = null;

  busyId.value = song._id;
  try {
    await client.delete(`/songs/${song._id}/purge`);
    songs.value = songs.value.filter((s) => s._id !== song._id);
    if (meta.value) meta.value.total -= 1;
    toasts.success(`Trajno uklonjeno: ${song.title}`);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Uklanjanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

/**
 * Emptying the whole bin at once.
 *
 * AI-DECISION: the phrase typed is a fixed one, not the count and not a title.
 * The single-song purge asks for that song's title, which works because the
 * dialog can show it — there is nothing equivalent to show for three hundred
 * mixed rows, and asking for a number invites typing whatever is on screen
 * without reading the sentence above it. A phrase in words has to be produced
 * rather than copied.
 *
 * AI-TRAP: one endpoint, not a loop over the rows on screen. The list is paged,
 * so a client-side loop empties the current page and reports success; and songs
 * have to go before artists or a deleted artist takes their trashed songs with
 * them into nothing. See trashController.js.
 */
const PHRASE = 'SIGURAN SAM';

const emptyOpen = ref(false);
const emptyBusy = ref(false);
const phrase = ref('');
const pending = ref(null);

const phraseMatches = computed(() => phrase.value.trim().toUpperCase() === PHRASE);

async function askEmpty() {
  phrase.value = '';
  pending.value = null;
  emptyOpen.value = true;

  // Counted fresh rather than read off the paged list, which only knows its
  // own tab and only the page in front of it.
  try {
    const { data } = await client.get('/trash/count');
    pending.value = data;
  } catch {
    pending.value = null;
  }
}

async function emptyTrash() {
  if (!phraseMatches.value) return;

  emptyBusy.value = true;
  try {
    const { data } = await client.delete('/trash');
    emptyOpen.value = false;

    const parts = [];
    if (data.songs) parts.push(`${data.songs} pjesama`);
    if (data.artists) parts.push(`${data.artists} izvođača`);
    toasts.success(parts.length ? `Trajno uklonjeno: ${parts.join(', ')}` : 'Kanta je već bila prazna.');

    // Reported, not hidden: an artist kept back still has songs pointing at
    // them, and finding that out later is worse than reading it now.
    if (data.kept?.length) {
      toasts.error(`Zadržano ${data.kept.length} izvođača — još imaju pjesme: ${data.kept.map((k) => k.name).join(', ')}`);
    }

    page.value = 1;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Pražnjenje nije uspjelo.');
  } finally {
    emptyBusy.value = false;
  }
}
</script>

<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">
        Kanta
        <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-faint">{{ meta.total }}</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Obrisano se ne prikazuje na sajtu, ali stoji ovdje dok ga neko ne ukloni trajno.
      </p>
    </div>

    <button
      v-if="auth.hasRole('superadmin')"
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 rounded border border-line-strong px-3 py-1.5 text-sm text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-40"
      :disabled="loading || !meta?.total"
      @click="askEmpty"
    ><IconPurge /> Očisti kantu</button>
  </div>

  <!-- Same tab bar the moderation queue uses. -->
  <div class="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
    <button
      v-for="t in TABS" :key="t.key"
      class="rounded px-3 py-1 transition"
      :class="tab === t.key ? 'bg-panel font-semibold text-accent shadow-xs' : 'text-muted hover:text-ink'"
      @click="pick(t.key)"
    >{{ t.label }}</button>
  </div>

  <p v-if="loading" class="text-sm text-muted">Učitavanje…</p>
  <p v-else-if="tab === 'songs' ? !songs.length : !artists.length" class="text-sm text-muted">Kanta je prazna.</p>

  <table v-else-if="tab === 'songs'" class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="py-2">Naslov</th>
        <th class="py-2">Izvođač</th>
        <th class="py-2">Obrisao</th>
        <th class="py-2">Kada</th>
        <th class="py-2 text-right">Radnja</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="song in songs" :key="song._id" class="border-b border-line-soft">
        <td class="py-2.5 font-medium">{{ song.title }}</td>
        <td class="py-2.5 text-muted">{{ song.artist?.name || '—' }}</td>
        <td class="py-2.5 text-muted">{{ song.deletedBy?.name || '—' }}</td>
        <td class="py-2.5 font-mono text-xs text-faint">{{ when(song.deletedAt) }}</td>
        <td class="py-2.5">
          <div class="flex justify-end gap-2">
            <button
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-ok hover:text-ok disabled:opacity-40"
              :disabled="busyId === song._id"
              @click="restore(song)"
            ><IconRestore /> Vrati</button>

            <!-- Superadmin only, matching the endpoint. Hiding it from everyone
                 else keeps the button from being a permission error waiting to
                 happen. -->
            <button
              v-if="auth.hasRole('superadmin')"
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-danger hover:text-danger disabled:opacity-40"
              :disabled="busyId === song._id"
              @click="askPurge(song)"
            ><IconPurge /> Ukloni trajno</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- v-else so it stays an immediate sibling of the table above: a comment or
       a blank element between them would break the chain and neither would
       render. -->
  <table v-else class="w-full text-sm">
    <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
      <tr>
        <th class="py-2">Izvođač</th>
        <th class="py-2">Zemlja</th>
        <th class="py-2">Obrisao</th>
        <th class="py-2 text-right">Radnja</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="artist in artists" :key="artist._id" class="border-b border-line-soft">
        <td class="py-2.5 font-medium">{{ artist.name }}</td>
        <td class="py-2.5 text-muted">
          <span v-if="artist.flag" class="mr-1">{{ artist.flag }}</span>{{ artist.country || '—' }}
        </td>
        <td class="py-2.5 text-muted">{{ artist.deletedBy?.name || '—' }}</td>
        <td class="py-2.5">
          <div class="flex justify-end gap-2">
            <button
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-ok hover:text-ok disabled:opacity-40"
              :disabled="busyId === artist._id"
              @click="restoreArtist(artist)"
            ><IconRestore /> Vrati</button>

            <!-- Superadmin only, matching the endpoint. A button that always
                 returns 403 is a worse answer than no button. -->
            <button
              v-if="auth.hasRole('superadmin')"
              class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                     transition hover:border-danger hover:text-danger disabled:opacity-40"
              :disabled="busyId === artist._id"
              @click="purgingArtist = artist"
            ><IconPurge /> Ukloni trajno</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <AppModal
    :model-value="Boolean(purgingArtist)"
    title="Trajno ukloniti izvođača?"
    :description="purgingArtist ? `„${purgingArtist.name}“ nestaje zauvijek. Ako još ima pjesama, uklanjanje će biti odbijeno.` : ''"
    confirm-label="Ukloni trajno"
    tone="danger"
    :busy="Boolean(busyId)"
    @update:model-value="(open) => { if (!open) purgingArtist = null; }"
    @confirm="() => { const a = purgingArtist; purgingArtist = null; purgeArtist(a); }"
  />

  <nav v-if="meta && meta.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page <= 1" @click="turn(page - 1)"
    ><span class="flex items-center gap-1"><IconPrev /> Prethodna</span></button>
    <span class="text-muted">{{ meta.page }} / {{ meta.pages }}</span>
    <button
      class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
      :disabled="page >= meta.pages" @click="turn(page + 1)"
    ><span class="flex items-center gap-1">Sljedeća <IconNext /></span></button>
  </nav>

  <AppModal
    :model-value="Boolean(purging)"
    title="Trajno ukloniti?"
    description="Ovo se ne može poništiti. Ocjene i recenzije nestaju zajedno s pjesmom."
    confirm-label="Ukloni trajno"
    tone="danger"
    :confirm-disabled="!titleMatches"
    :busy="Boolean(busyId)"
    @update:model-value="(open) => { if (!open) purging = null; }"
    @confirm="purge"
  >
    <label for="confirm-title" class="mb-1 block text-xs text-faint">
      Upiši naslov da potvrdiš:
    </label>
    <p class="mb-2 font-medium">{{ purging?.title }}</p>
    <input
      id="confirm-title" v-model="typed" type="text" autocomplete="off"
      class="w-full rounded border px-3 py-2 outline-none"
      :class="titleMatches ? 'border-ok' : 'border-line-strong focus:border-accent'"
      @keyup.enter="titleMatches && purge()"
    >
  </AppModal>

  <AppModal
    v-model="emptyOpen"
    title="Isprazniti kantu?"
    description="Ovo se ne može poništiti. Nestaju i ocjene, recenzije, komentari i prijave koje pripadaju tim pjesmama."
    confirm-label="Isprazni kantu"
    tone="danger"
    :confirm-disabled="!phraseMatches"
    :busy="emptyBusy"
    :dismissible="false"
    @confirm="emptyTrash"
  >
    <p v-if="pending" class="mb-3 text-sm">
      Trajno se uklanja
      <span class="font-mono font-semibold">{{ pending.songs }}</span> pjesama
      i <span class="font-mono font-semibold">{{ pending.artists }}</span> izvođača.
    </p>

    <label for="confirm-phrase" class="mb-1 block text-xs text-faint">
      Upiši <span class="font-mono font-semibold text-ink">SIGURAN SAM</span> da potvrdiš:
    </label>
    <input
      id="confirm-phrase" v-model="phrase" type="text" autocomplete="off"
      class="w-full rounded border px-3 py-2 font-mono uppercase outline-none"
      :class="phraseMatches ? 'border-ok' : 'border-line-strong focus:border-accent'"
      @keyup.enter="phraseMatches && emptyTrash()"
    >
  </AppModal>
</template>
