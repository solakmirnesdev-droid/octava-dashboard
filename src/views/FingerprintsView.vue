<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import AppModal from '../components/AppModal.vue';
import { fingerprint, packHashes, SAMPLE_RATE } from '../utils/fingerprint';
import IconUpload from '~icons/material-symbols/upload-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconWarn from '~icons/material-symbols/warning-outline-rounded';

/**
 * Acoustic fingerprints, one per song.
 *
 * AI-DECISION: this view exists because the recognise feature does not work
 * without it. The API could store, list and delete prints from the day it was
 * written, and nothing could put one in — so "Prepoznaj" on the site had an
 * empty index to search and answered "not found" to every song in the
 * catalogue. A capability nobody can reach is the same as one nobody built.
 *
 * AI-NOTE: the audio never leaves the browser. A file is decoded here, reduced
 * to a fingerprint here, and only the hashes are sent — a few kilobytes of
 * numbers that cannot be turned back into sound. That is deliberate: this tool
 * has no licence to hold recordings, and storing them would be the one thing in
 * this project that genuinely could not be defended.
 */
const toasts = useToasts();
const auth = useAuthStore();

const prints = ref([]);
const songs = ref([]);
const version = ref(null);
const loading = ref(true);
const busyId = ref(null);
const filter = ref('');
const showMissing = ref(true);

const printBySong = computed(() => new Map(prints.value.map((p) => [String(p.song?._id), p])));

const rows = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return songs.value
    .map((s) => ({ song: s, print: printBySong.value.get(String(s._id)) || null }))
    .filter((r) => {
      if (q && !(`${r.song.title} ${r.song.artist?.name || ''}`.toLowerCase().includes(q))) return false;
      return showMissing.value ? true : Boolean(r.print);
    });
});

const withPrint = computed(() => rows.value.filter((r) => r.print).length);
const stale = computed(() => prints.value.filter((p) => p.stale).length);

async function load() {
  loading.value = true;
  try {
    const [p, s] = await Promise.all([
      client.get('/recognize'),
      client.get('/songs', { params: { limit: 100, status: 'published' } })
    ]);
    prints.value = p.data.prints || [];
    version.value = p.data.version;
    songs.value = s.data.songs || [];
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

/**
 * Decodes anything the browser can play, at the one rate the fingerprint knows.
 *
 * AI-TRAP: copied from the site's useRecognizer, resampling and all. An
 * OfflineAudioContext asked for 8000Hz does a proper band-limited conversion;
 * taking every sixth sample by hand aliases everything above 4kHz down into the
 * range the constellation reads, and the print that comes out matches nothing —
 * silently, because a wrong number raises no error.
 */
async function decodeTo8k(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const decoder = new Ctx();
  try {
    const decoded = await decoder.decodeAudioData(arrayBuffer);
    const frames = Math.ceil(decoded.duration * SAMPLE_RATE);
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offline = new Offline(1, frames, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { samples: rendered.getChannelData(0), seconds: decoded.duration };
  } finally {
    decoder.close?.();
  }
}

const fileInput = ref(null);
const pending = ref(null);

function pick(song) {
  pending.value = song;
  fileInput.value.value = '';
  fileInput.value.click();
}

async function onFile(event) {
  const file = event.target.files?.[0];
  const song = pending.value;
  if (!file || !song) return;

  busyId.value = song._id;
  try {
    const { samples, seconds } = await decodeTo8k(await file.arrayBuffer());
    const pairs = fingerprint(samples);
    if (!pairs.length) {
      toasts.error('Iz ovog snimka nije izašao nijedan otisak.', { detail: 'Provjeri da nije tišina.' });
      return;
    }

    const bytes = packHashes(pairs);
    await client.put(`/recognize/${song._id}?seconds=${Math.round(seconds)}`, bytes, {
      headers: { 'Content-Type': 'application/octet-stream' }
    });

    toasts.success(`Otisak snimljen: ${song.title}`, {
      detail: `${pairs.length} parova iz ${Math.round(seconds)} s`
    });
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Otisak nije snimljen.', {
      detail: err.name === 'EncodingError' ? 'Browser ne može dekodirati ovaj format.' : undefined
    });
  } finally {
    busyId.value = null;
    pending.value = null;
  }
}

const removing = ref(null);

async function drop(song) {
  busyId.value = song._id;
  try {
    await client.delete(`/recognize/${song._id}`);
    toasts.success(`Otisak uklonjen: ${song.title}`);
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Uklanjanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs') : '—');
const kb = (n) => (n ? `${(n / 1024).toFixed(1)} KB` : '—');
</script>

<template>
  <section>
    <div class="mb-6">
      <h1 class="text-xl font-semibold tracking-tight">
        Otisci zvuka
        <span class="ml-2 font-mono text-sm font-normal text-faint">{{ withPrint }} / {{ rows.length }}</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Prepoznavanje pjesme na sajtu pretražuje ove otiske. Bez otiska pjesma se ne može prepoznati.
      </p>
      <!-- Said out loud, because it is the question anybody sensible asks first. -->
      <p class="mt-1 text-xs text-faint">
        Snimak se obrađuje u browseru i ne šalje se nigdje — na server ide samo otisak, iz kojeg se zvuk ne može vratiti.
      </p>
    </div>

    <div
      v-if="stale"
      class="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft/30 px-4 py-2.5 text-sm text-warn"
    >
      <IconWarn />
      {{ stale }} {{ stale === 1 ? 'otisak je' : 'otisaka je' }} iz starije verzije algoritma i više ne pogađa — snimi ih ponovo.
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border px-2.5 py-1 text-xs transition"
        :class="showMissing
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line-strong text-muted hover:border-accent hover:text-accent'"
        @click="showMissing = !showMissing"
      >{{ showMissing ? 'sve pjesme' : 'samo sa otiskom' }}</button>

      <input
        v-model="filter" placeholder="Filtriraj po naslovu ili izvođaču"
        class="ml-auto w-64 rounded border border-line-strong bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent"
      >
    </div>

    <p v-if="loading" class="text-sm text-faint">Učitavanje…</p>
    <p v-else-if="!rows.length" class="rounded border border-line bg-panel px-4 py-8 text-center text-sm text-faint">
      Nema pjesama koje odgovaraju filteru.
    </p>

    <table v-else class="w-full text-sm">
      <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
        <tr>
          <th class="pb-2">Pjesma</th>
          <th class="pb-2">Otisak</th>
          <th class="pb-2">Trajanje</th>
          <th class="pb-2">Snimljen</th>
          <th class="pb-2 text-right">Radnja</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.song._id" class="border-b border-line-soft">
          <td class="py-2.5">
            <span class="font-medium">{{ row.song.title }}</span>
            <span class="ml-2 text-xs text-faint">{{ row.song.artist?.name }}</span>
          </td>
          <td class="py-2.5">
            <span
              v-if="row.print && !row.print.stale"
              class="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok"
            >{{ row.print.hashCount }} parova · {{ kb(row.print.bytes) }}</span>
            <span
              v-else-if="row.print"
              class="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn"
            >stara verzija</span>
            <span v-else class="text-xs text-dim">nema</span>
          </td>
          <td class="py-2.5 font-mono text-xs text-muted">{{ row.print ? row.print.seconds + ' s' : '—' }}</td>
          <td class="py-2.5 font-mono text-xs text-faint">{{ when(row.print?.updatedAt) }}</td>
          <td class="py-2.5">
            <div class="flex justify-end gap-2">
              <button
                class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                       transition hover:border-accent hover:text-accent disabled:opacity-40"
                :disabled="busyId === row.song._id"
                @click="pick(row.song)"
              ><IconUpload /> {{ busyId === row.song._id ? 'Obrađujem…' : (row.print ? 'Zamijeni' : 'Snimi') }}</button>

              <!-- Admin only, matching the endpoint: a button that always
                   returns 403 is a worse answer than no button. -->
              <button
                v-if="row.print && auth.hasRole('admin')"
                class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                       transition hover:border-danger hover:text-danger disabled:opacity-40"
                :disabled="busyId === row.song._id"
                @click="removing = row.song"
              ><IconDelete /></button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFile">

    <AppModal
      :model-value="Boolean(removing)"
      title="Ukloniti otisak?"
      :description="removing ? `„${removing.title}“ se više neće moći prepoznati dok se ne snimi novi otisak.` : ''"
      confirm-label="Ukloni"
      tone="danger"
      :busy="Boolean(busyId)"
      @update:model-value="(open) => { if (!open) removing = null; }"
      @confirm="() => { const s = removing; removing = null; drop(s); }"
    />
  </section>
</template>
