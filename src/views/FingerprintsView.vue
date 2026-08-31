<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import client from '../api/client';
import { useRefreshOnVisible } from '../composables/useRefreshOnVisible';
import { useLiveData } from '../composables/useLiveData';
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
import IconAudio from '~icons/material-symbols/graphic-eq-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';

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
const statsPopping = ref(false);

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

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

const withPrint = computed(() => songs.value.filter((s) => printBySong.value.has(String(s._id))).length);
const withoutPrint = computed(() => Math.max(0, songs.value.length - withPrint.value));
const stale = computed(() => prints.value.filter((p) => p.stale).length);

let isFingerprintsFetching = false;

async function fetchAllSongs() {
  const { data: firstPage } = await client.get('/songs', { params: { page: 1, limit: 100, status: 'published' } });
  const out = [...(firstPage.songs || [])];
  const totalPages = firstPage.meta?.pages || 1;

  if (totalPages > 1) {
    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const BATCH_SIZE = 5;
    for (let i = 0; i < pageNumbers.length; i += BATCH_SIZE) {
      const batch = pageNumbers.slice(i, i + BATCH_SIZE);
      const responses = await Promise.all(
        batch.map((p) => client.get('/songs', { params: { page: p, limit: 100, status: 'published' } }))
      );
      for (const res of responses) {
        out.push(...(res.data.songs || []));
      }
    }
  }

  return out;
}

async function load() {
  if (isFingerprintsFetching) return;
  isFingerprintsFetching = true;
  if (!songs.value.length) {
    loading.value = true;
  }
  try {
    const [p, allSongs] = await Promise.all([
      client.get('/recognize'),
      fetchAllSongs()
    ]);
    prints.value = p.data.prints || [];
    version.value = p.data.version;
    songs.value = allSongs;
    triggerUpdatePulse();
  } catch (err) {
    console.warn('Učitavanje otisaka nije uspjelo:', err);
    if (!songs.value.length) {
      toasts.error(err.response?.data?.message || 'Učitavanje nije uspjelo.');
    }
  } finally {
    isFingerprintsFetching = false;
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
    triggerUpdatePulse();
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

    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find((m) => MediaRecorder.isTypeSupported(m)) || '';

    mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) captureChunks.push(e.data);
    };

    mediaRecorder.onstop = () => processCapturedAudio(song);

    audioTrack.onended = () => {
      if (capturing.value) stopCapture();
    };

    mediaRecorder.start(250);
    captureTimer = setInterval(() => {
      capturedSeconds.value += 1;
    }, 1000);

    toasts.info(`Snimanje zvuka za: ${song.title}`, {
      detail: 'Pustite pjesmu i kliknite „Zaustavi“ kada završi.'
    });
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      toasts.error(err.message || 'Pokretanje snimanja kartice nije uspjelo.');
    }
    cleanupCapture();
  }
}

function stopCapture() {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

function cleanupCapture() {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  capturing.value = null;
  capturedSeconds.value = 0;
  mediaRecorder = null;
  captureChunks = [];
}

async function processCapturedAudio(song) {
  const songId = capturing.value || song?._id;
  cleanupCapture();
  if (!songId || !captureChunks.length) return;

  busyId.value = songId;
  try {
    const blob = new Blob(captureChunks, { type: captureChunks[0]?.type || 'audio/webm' });
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

    toasts.success(`Snimljen otisak: ${song?.title || 'pjesma'}`, {
      detail: `${hashes.length} parova tačaka (${seconds.toFixed(1)} s)`
    });
    triggerUpdatePulse();
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || err.message || 'Obrada snimljenog zvuka nije uspjela.');
  } finally {
    busyId.value = null;
  }
}

const removing = ref(null);

async function removePrint(song) {
  busyId.value = song._id;
  try {
    await client.delete(`/recognize/${song._id}`);
    toasts.success(`Otisak uklonjen: ${song.title}`);
    triggerUpdatePulse();
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Uklanjanje nije uspjelo.');
  } finally {
    busyId.value = null;
  }
}

const kb = (b) => (b ? `${(b / 1024).toFixed(1)} KB` : '—');
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

useRefreshOnVisible(load);
useLiveData(['songs'], load);
onMounted(load);
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <input ref="fileInput" type="file" accept="audio/*" class="hidden" @change="onFileSelected">

    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Zvučni otisci
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Akustični otisci pjesama za instant prepoznavanje muzike na Octavi.
        </p>
      </div>
    </div>

    <!-- Alert for stale algorithm hashes -->
    <div
      v-if="stale"
      class="mb-5 flex items-center gap-2.5 rounded-2xl border border-warn/30 bg-warn-soft/40 p-4 text-xs sm:text-sm text-warn shadow-2xs font-medium"
    >
      <IconWarn class="text-lg shrink-0" />
      <span>{{ stale }} {{ stale === 1 ? 'otisak je' : 'otisaka je' }} iz starije verzije algoritma i više ne pogađa — preporučeno je ponovno snimanje.</span>
    </div>

    <!-- Quick Insights Metric Tiles -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <!-- 1. Sa otiskom -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          !showMissing ? 'border-ok ring-2 ring-ok/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="showMissing = false"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCheckCircle class="text-sm text-ok" /> Sa otiskom
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">Spremno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ withPrint }}
          </span>
          <span class="text-[11px] text-faint">pjesama</span>
        </div>
      </div>

      <!-- 2. Bez otiska -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          showMissing ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="showMissing = true"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconAudio class="text-sm text-accent" /> Bez otiska
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Čeka snimanje</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ withoutPrint }}
          </span>
          <span class="text-[11px] text-faint">pjesama</span>
        </div>
      </div>

      <!-- 3. Zastarjeli otisci -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs"
        :class="statsPopping ? 'animate-pulse-glow' : ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconWarn class="text-sm text-warn" /> Zastarjeli otisci
          </span>
          <span class="text-[10px] text-warn font-bold font-mono">Stari algoritam</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-warn" :class="{ 'animate-count-bump': statsPopping }">
            {{ stale }}
          </span>
          <span class="text-[11px] text-faint">potrebno obnoviti</span>
        </div>
      </div>

      <!-- 4. Ukupno pjesama -->
      <div
        class="rounded-2xl border border-line bg-panel p-3.5 shadow-2xs"
        :class="statsPopping ? 'animate-pulse-glow' : ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconMusic class="text-sm text-muted" /> Ukupno u katalogu
          </span>
          <span class="text-[10px] text-faint font-mono">Katalog</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ songs.length }}
          </span>
          <span class="text-[11px] text-faint">objavljenih pjesama</span>
        </div>
      </div>
    </div>

    <!-- Navigation & Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <div class="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line-strong overflow-x-auto scrollbar-none">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer shrink-0"
          :class="showMissing ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="showMissing = true"
        >
          <span>Sve pjesme</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer shrink-0"
          :class="!showMissing ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="showMissing = false"
        >
          <span>Samo sa otiskom</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-64">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
        <input
          v-model="filter"
          type="search"
          placeholder="Pretraži po naslovu ili izvođaču…"
          class="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="table" :rows="8" :cols="5" />

    <div v-else-if="!rows.length" class="rounded-2xl border border-line bg-panel p-12 text-center shadow-2xs">
      <IconAudio class="mx-auto text-3xl text-dim mb-2" />
      <p class="text-sm font-bold text-ink">Nema rezultata</p>
      <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
        {{ filter ? `Nema pjesama koje odgovaraju pojmu „${filter}”.` : 'Nema pjesama u ovoj kategoriji.' }}
      </p>
    </div>

    <div v-else>
      <!-- Mobile Card List (< sm) -->
      <div class="sm:hidden space-y-2.5">
        <div
          v-for="row in pageRows"
          :key="'mob-f-' + row.song._id"
          class="rounded-2xl border border-line bg-panel p-4 shadow-2xs space-y-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-ink">{{ row.song.title }}</h3>
              <p class="text-xs text-muted font-medium">{{ row.song.artist?.name || '—' }}</p>
            </div>

            <div>
              <span
                v-if="row.print && !row.print.stale"
                class="rounded-full bg-ok-soft border border-ok/30 px-2 py-0.5 text-[10px] font-bold font-mono text-ok"
              >{{ row.print.seconds }}s · {{ kb(row.print.bytes) }}</span>
              <span
                v-else-if="row.print"
                class="rounded-full bg-warn-soft border border-warn/30 px-2 py-0.5 text-[10px] font-bold font-mono text-warn"
              >Stara verzija</span>
              <span v-else class="text-[10px] text-faint font-mono bg-surface border border-line-soft px-2 py-0.5 rounded-md">Bez otiska</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-line-soft">
            <button
              v-if="capturing === row.song._id"
              class="flex items-center gap-1 rounded-xl border border-warn bg-warn-soft px-2.5 py-1 text-xs
                     font-bold text-warn cursor-pointer"
              @click="stopCapture"
            ><IconStop /> Zaustavi {{ clock(capturedSeconds) }}</button>
            <button
              v-else
              class="flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs text-muted
                     transition hover:border-line-strong hover:text-ink disabled:opacity-40 cursor-pointer font-bold"
              :disabled="Boolean(busyId) || Boolean(capturing)"
              title="Uzmi zvuk iz kartice u kojoj svira pjesma"
              @click="startCapture(row.song)"
            ><IconTab class="text-sm" /> Kartica</button>

            <button
              class="flex items-center gap-1 rounded-xl bg-ink px-2.5 py-1 text-xs text-on-ink
                     hover:bg-accent transition disabled:opacity-40 cursor-pointer font-bold shadow-2xs active:scale-95"
              :disabled="busyId === row.song._id || Boolean(capturing)"
              @click="pick(row.song)"
            ><IconUpload class="text-sm" /> {{ busyId === row.song._id ? '…' : (row.print ? 'Zamijeni' : 'Snimi') }}</button>

            <button
              v-if="row.print && auth.hasRole('admin')"
              class="flex items-center gap-1 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 p-1 text-xs
                     transition disabled:opacity-40 cursor-pointer"
              :disabled="busyId === row.song._id"
              @click="removing = row.song"
            ><IconDelete class="text-sm" /></button>
          </div>
        </div>
      </div>

      <!-- Desktop Table (>= sm) -->
      <div class="hidden sm:block rounded-2xl border border-line bg-panel overflow-hidden shadow-2xs">
        <table class="w-full text-sm text-left">
          <thead class="bg-surface/80 backdrop-blur-sm text-faint font-mono text-[11px] font-bold tracking-wider uppercase border-b border-line">
            <tr>
              <th class="py-3 px-4">Pjesma</th>
              <th class="py-3 px-4">Otisak</th>
              <th class="py-3 px-4">Trajanje</th>
              <th class="py-3 px-4">Snimljen</th>
              <th class="py-3 px-4 text-right">Radnje</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-soft">
            <tr v-for="row in pageRows" :key="row.song._id" class="hover:bg-raised/40 transition-colors">
              <td class="py-3 px-4">
                <span class="font-bold text-ink">{{ row.song.title }}</span>
                <span class="ml-2 text-xs text-muted font-medium">{{ row.song.artist?.name }}</span>
              </td>
              <td class="py-3 px-4">
                <span
                  v-if="row.print && !row.print.stale"
                  class="rounded-full bg-ok-soft border border-ok/30 px-2 py-0.5 text-xs font-bold font-mono text-ok"
                >{{ row.print.hashCount }} parova · {{ kb(row.print.bytes) }}</span>
                <span
                  v-else-if="row.print"
                  class="rounded-full bg-warn-soft border border-warn/30 px-2 py-0.5 text-xs font-bold font-mono text-warn"
                >stara verzija</span>
                <span v-else class="text-xs text-faint font-mono">nema</span>
              </td>
              <td class="py-3 px-4 font-mono text-xs text-muted">{{ row.print ? row.print.seconds + ' s' : '—' }}</td>
              <td class="py-3 px-4 font-mono text-xs text-faint">{{ when(row.print?.updatedAt) }}</td>
              <td class="py-3 px-4">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="capturing === row.song._id"
                    class="flex items-center gap-1 rounded-xl border border-warn bg-warn-soft px-2.5 py-1 text-xs
                           font-bold text-warn"
                    @click="stopCapture"
                  ><IconStop /> Zaustavi {{ clock(capturedSeconds) }}</button>
                  <button
                    v-else
                    class="flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs text-muted
                           transition hover:border-line-strong hover:text-ink disabled:opacity-40 cursor-pointer font-bold"
                    :disabled="Boolean(busyId) || Boolean(capturing)"
                    title="Uzmi zvuk iz kartice u kojoj svira pjesma"
                    @click="startCapture(row.song)"
                  ><IconTab /> Sa kartice</button>

                  <button
                    class="flex items-center gap-1 rounded-xl bg-ink px-2.5 py-1 text-xs text-on-ink
                           hover:bg-accent transition disabled:opacity-40 cursor-pointer font-bold shadow-2xs active:scale-95"
                    :disabled="busyId === row.song._id || Boolean(capturing)"
                    @click="pick(row.song)"
                  ><IconUpload /> {{ busyId === row.song._id ? 'Obrađujem…' : (row.print ? 'Zamijeni' : 'Snimi') }}</button>

                  <button
                    v-if="row.print && auth.hasRole('admin')"
                    class="flex items-center gap-1 rounded-xl bg-danger-soft text-danger hover:bg-danger hover:text-on-danger border border-danger/30 px-2 py-1 text-xs
                           transition disabled:opacity-40 cursor-pointer"
                    :disabled="busyId === row.song._id"
                    @click="removing = row.song"
                  ><IconDelete /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="pageCount > 1" class="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-xl border border-line bg-panel text-muted hover:border-line-strong hover:text-ink transition disabled:opacity-40 cursor-pointer"
        :disabled="page <= 1"
        @click="turn(page - 1)"
      >
        <IconPrev class="text-sm" />
      </button>

      <span class="font-mono text-xs text-faint px-2">
        Stranica {{ page }} od {{ pageCount }}
      </span>

      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-xl border border-line bg-panel text-muted hover:border-line-strong hover:text-ink transition disabled:opacity-40 cursor-pointer"
        :disabled="page >= pageCount"
        @click="turn(page + 1)"
      >
        <IconNext class="text-sm" />
      </button>
    </div>

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
