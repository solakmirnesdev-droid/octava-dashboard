<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { useAuthStore } from '../stores/auth';
import AppModal from '../components/AppModal.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
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

  return filterByQuery(paired, filter.value, (r) => `${r.song.title} ${r.song.artist?.name || ''}`);
});

const PER_PAGE = 50;
const page = ref(1);

const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / PER_PAGE)));

const pageRows = computed(() => {
  const start = (page.value - 1) * PER_PAGE;
  return rows.value.slice(start, start + PER_PAGE);
});

watch([filter, showMissing], () => { page.value = 1; });
watch(pageCount, (count) => { if (page.value > count) page.value = count; });

function turn(to) {
  page.value = Math.min(pageCount.value, Math.max(1, to));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const withPrint = computed(() => rows.value.filter((r) => r.print).length);
const stale = computed(() => prints.value.filter((p) => p.stale).length);

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

const fileInput = ref(null);
const targetSong = ref(null);

function pick(song) {
  targetSong.value = song;
  fileInput.value.value = '';
  fileInput.value.click();
}

async function onFileSelected(event) {
  const file = event.target.files?.[0];
  const song = targetSong.value;
  if (!file || !song) return;

  busyId.value = song._id;
  try {
    const buf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    const audio = await ctx.decodeAudioData(buf);
    await ctx.close();

    const pcm = audio.getChannelData(0);
    const { hashes, seconds } = fingerprint(pcm, audio.sampleRate);
    if (!hashes.length) throw new Error('Snimak je prekratak ili previše tih za prepoznavanje.');

    await client.post('/recognize', {
      songId: song._id,
      hashes: packHashes(hashes),
      seconds
    });

    toasts.success(`Snimljen otisak: ${song.title}`, {
      detail: `${hashes.length} parova tačaka (${seconds.toFixed(1)} s)`
    });
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || err.message || 'Obrada zvuka nije uspjela.');
  } finally {
    busyId.value = null;
    targetSong.value = null;
  }
}

const capturing = ref(null);
const capturedSeconds = ref(0);
let mediaStream = null;
let mediaRecorder = null;
let captureChunks = [];
let captureTimer = null;

async function startCapture(song) {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioTrack = mediaStream.getAudioTracks()[0];
    if (!audioTrack) {
      mediaStream.getTracks().forEach((t) => t.stop());
      toasts.error('Niste označili „Share audio“ u dijalogu. Zvuk iz kartice je obavezan.');
      return;
    }

    capturing.value = song._id;
    capturedSeconds.value = 0;
    captureChunks = [];

    captureTimer = setInterval(() => {
      capturedSeconds.value += 1;
      if (capturedSeconds.value >= 180) stopCapture();
    }, 1000);

    const audioOnlyStream = new MediaStream([audioTrack]);
    mediaRecorder = new MediaRecorder(audioOnlyStream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) captureChunks.push(e.data);
    };

    mediaRecorder.onstop = () => processCapturedAudio(song);
    audioTrack.onended = () => stopCapture();

    mediaRecorder.start();
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      toasts.error('Snimanje zvuka iz kartice nije podržano ili nije uspjelo.');
    }
    stopCaptureCleanup();
  }
}

function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  stopCaptureCleanup();
}

function stopCaptureCleanup() {
  if (captureTimer) clearInterval(captureTimer);
  captureTimer = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

async function processCapturedAudio(song) {
  const songId = capturing.value || song?._id;
  capturing.value = null;
  if (!captureChunks.length || !songId) return;

  busyId.value = songId;
  try {
    const blob = new Blob(captureChunks, { type: 'audio/webm' });
    const buf = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    const audio = await ctx.decodeAudioData(buf);
    await ctx.close();

    const pcm = audio.getChannelData(0);
    const { hashes, seconds } = fingerprint(pcm, audio.sampleRate);
    if (!hashes.length) throw new Error('Snimak je prekratak ili previše tih za prepoznavanje.');

    await client.post('/recognize', {
      songId,
      hashes: packHashes(hashes),
      seconds
    });

    toasts.success(`Snimljen otisak: ${song?.title || ''}`, {
      detail: `${hashes.length} parova tačaka (${seconds.toFixed(1)} s)`
    });
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || err.message || 'Obrada snimljenog zvuka nije uspjela.');
  } finally {
    busyId.value = null;
    captureChunks = [];
  }
}

const removing = ref(null);

async function removePrint(song) {
  busyId.value = song._id;
  try {
    await client.delete(`/recognize/${song._id}`);
    toasts.success(`Uklonjen otisak: ${song.title}`);
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Brisanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs') : '—');
const kb = (bytes) => `${Math.round((bytes || 0) / 1024)} KB`;
const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

onMounted(load);
</script>

<template>
  <section>
    <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFileSelected">

    <div class="mb-6">
      <h1 class="text-xl font-semibold tracking-tight">
        Zvučni otisci
        <span class="ml-2 font-mono text-sm font-normal text-faint">{{ withPrint }} / {{ rows.length }}</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Prepoznavanje pjesme na sajtu pretražuje ove otiske. Bez otiska pjesma se ne može prepoznati.
      </p>
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

    <SkeletonLoader v-if="loading" type="table" :rows="8" :cols="5" />
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

    <AppModal
      :model-value="Boolean(removing)"
      title="Ukloniti zvučni otisak?"
      :description="removing ? `Otisak za pjesmu „${removing.title}“ biće uklonjen. Pjesma se više neće moći prepoznati slušanjem.` : ''"
      confirm-label="Ukloni otisak"
      tone="danger"
      @update:model-value="(open) => { if (!open) removing = null; }"
      @confirm="() => { const s = removing; removing = null; removePrint(s); }"
    />
  </section>
</template>
