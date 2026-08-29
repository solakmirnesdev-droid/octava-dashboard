<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import AppModal from '../components/AppModal.vue';
import { fingerprint, packHashes, SAMPLE_RATE } from '../utils/fingerprint';
import { filterByQuery } from '../utils/textFilter';
import IconUpload from '~icons/material-symbols/upload-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import IconTab from '~icons/material-symbols/pip-rounded';
import IconStop from '~icons/material-symbols/stop-circle-rounded';
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
  const paired = songs.value
    .map((s) => ({ song: s, print: printBySong.value.get(String(s._id)) || null }))
    .filter((r) => (showMissing.value ? true : Boolean(r.print)));

  // Title and performer together, so either one finds the row — and through the
  // same matcher the API uses, so a typo that finds a song under Pjesme finds it
  // here too rather than looking like one of the two screens is broken.
  return filterByQuery(paired, filter.value, (r) => `${r.song.title} ${r.song.artist?.name || ''}`);
});

/**
 * Paged here rather than by the API.
 *
 * AI-DECISION: the whole catalogue is already in memory — that is what lets the
 * filter be typo-tolerant across all 1569 songs rather than across one page. Ask
 * the server for a page and the filter could only ever search what it had been
 * sent. So the list stays whole and only the rendering is cut, which also fixes
 * what this was really costing: 1569 rows with two buttons each, built on every
 * keystroke.
 */
const PER_PAGE = 50;
const page = ref(1);

const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / PER_PAGE)));

const pageRows = computed(() => {
  const start = (page.value - 1) * PER_PAGE;
  return rows.value.slice(start, start + PER_PAGE);
});

// Filtering to fewer pages than the one being read would otherwise leave an
// empty table with no way back.
watch([filter, showMissing], () => { page.value = 1; });
watch(pageCount, (count) => { if (page.value > count) page.value = count; });

function turn(to) {
  page.value = Math.min(pageCount.value, Math.max(1, to));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const withPrint = computed(() => rows.value.filter((r) => r.print).length);
const stale = computed(() => prints.value.filter((p) => p.stale).length);

/**
 * Walks every page of published songs, so the entire catalogue is searchable
 * rather than only the first 100 songs.
 */
async function fetchAllSongs() {
  const out = [];
  let page = 1;
  let pages = 1;

  do {
    const { data } = await client.get('/songs', { params: { page, limit: 100, status: 'published' } });
    out.push(...(data.songs || []));
    pages = data.meta?.pages || 1;
    page += 1;
  } while (page <= pages);

  return out;
}

async function load() {
  loading.value = true;
  try {
    const [p, allSongs] = await Promise.all([
      client.get('/recognize'),
      fetchAllSongs()
    ]);
    prints.value = p.data.prints || [];
    version.value = p.data.version;
    songs.value = allSongs;
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
  await ingest(song, await file.arrayBuffer());
  pending.value = null;
}

/**
 * Capturing the audio of a browser tab.
 *
 * AI-DECISION: this exists because sourcing an audio file for each of 1569
 * songs is the thing actually standing between the catalogue and working
 * recognition. Asking the server to fetch the audio from a URL was rejected:
 * that means downloading and storing copies of recordings we have no right to,
 * whatever the fingerprint is later used for. Capture keeps the existing shape
 * instead — the audio is decoded in this tab, only hashes are sent, and nothing
 * is written to disk at any point.
 *
 * AI-TRAP: `video: true` is required even though the video track is discarded
 * immediately. Chrome will not offer the tab picker for an audio-only request,
 * so asking for audio alone silently leaves the operator with no tab to choose.
 */
const capturing = ref(null);
const capturedSeconds = ref(0);
let recorder = null;
let captureTimer = null;

async function startCapture(song) {
  if (capturing.value || busyId.value) return;

  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch {
    // Dismissing the picker is a decision, not a failure worth a red toast.
    return;
  }

  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach((t) => t.stop());
    toasts.error('Ta kartica nije podijelila zvuk.', {
      detail: 'U prozoru za dijeljenje uključi „Podijeli zvuk kartice".'
    });
    return;
  }

  // The picture is never looked at; keeping it would record the screen for no
  // reason and cost memory for the length of a whole song.
  stream.getVideoTracks().forEach((t) => t.stop());

  const audioOnly = new MediaStream(stream.getAudioTracks());
  const chunks = [];
  recorder = new MediaRecorder(audioOnly);
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  recorder.onstop = async () => {
    clearInterval(captureTimer);
    audioOnly.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType });
    capturing.value = null;
    recorder = null;
    if (blob.size) await ingest(song, await blob.arrayBuffer());
  };

  capturedSeconds.value = 0;
  captureTimer = setInterval(() => { capturedSeconds.value += 1; }, 1000);
  capturing.value = song._id;
  recorder.start();

  // Stopping the share from Chrome's own bar has to end the recording too, or
  // the row sits on "Zaustavi" over a stream that no longer exists.
  stream.getAudioTracks()[0].addEventListener('ended', stopCapture);
}

function stopCapture() {
  if (recorder?.state === 'recording') recorder.stop();
}

const clock = (total) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

/** The one path from decoded audio to a stored print, whatever produced it. */
async function ingest(song, arrayBuffer) {
  busyId.value = song._id;
  try {
    const { samples, seconds } = await decodeTo8k(arrayBuffer);
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
        „Sa kartice" uzima zvuk iz kartice u kojoj pjesma svira — pusti je bilo gdje i zaustavi na kraju. „Snimi" uzima gotov audio fajl.<br>Zvuk se obrađuje u browseru i ne šalje se nigdje — na server ide samo otisak, iz kojeg se zvuk ne može vratiti.
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
        <tr v-for="row in pageRows" :key="row.song._id" class="border-b border-line-soft">
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
              <!-- Capture from a tab: play the song anywhere and take the sound
                   straight from it, rather than hunting down an audio file. -->
              <button
                v-if="capturing === row.song._id"
                class="flex items-center gap-1 rounded border border-warn bg-warn-soft px-2.5 py-1 text-xs
                       font-medium text-warn"
                @click="stopCapture"
              ><IconStop /> Zaustavi {{ clock(capturedSeconds) }}</button>
              <button
                v-else
                class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                       transition hover:border-accent hover:text-accent disabled:opacity-40"
                :disabled="Boolean(busyId) || Boolean(capturing)"
                title="Uzmi zvuk iz kartice u kojoj svira pjesma"
                @click="startCapture(row.song)"
              ><IconTab /> Sa kartice</button>

              <button
                class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                       transition hover:border-accent hover:text-accent disabled:opacity-40"
                :disabled="busyId === row.song._id || Boolean(capturing)"
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

    <!-- Says how many rows the filter actually found, not just which page this
         is: "50 od 1569" is the number somebody working through the catalogue
         is keeping track of. -->
    <nav v-if="pageCount > 1" class="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
      <button
        class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
        :disabled="page <= 1" @click="turn(page - 1)"
      ><span class="flex items-center gap-1"><IconPrev /> Prethodna</span></button>

      <span class="text-muted">{{ page }} / {{ pageCount }}</span>

      <button
        class="rounded border border-line-strong px-3 py-1.5 hover:border-accent disabled:opacity-30"
        :disabled="page >= pageCount" @click="turn(page + 1)"
      ><span class="flex items-center gap-1">Sljedeća <IconNext /></span></button>

      <span class="w-full text-center font-mono text-xs text-faint">
        {{ pageRows.length }} od {{ rows.length }}
      </span>
    </nav>

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
