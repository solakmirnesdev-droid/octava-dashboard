<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconVote from '~icons/material-symbols/thumb-up-outline-rounded';
import IconAdd from '~icons/material-symbols/add-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded';
import IconPending from '~icons/material-symbols/pending-actions-rounded';
import IconCancel from '~icons/material-symbols/cancel-outline-rounded';

/**
 * Song requests submitted by readers, ranked by reader demand.
 */
const TABS = [
  { key: 'open', label: 'Otvoreni' },
  { key: 'in_progress', label: 'U radu' },
  { key: 'done', label: 'Riješeni' },
  { key: 'rejected', label: 'Odbijeni' },
  { key: 'all', label: 'Svi zahtjevi' }
];

const STATUS_LABEL = {
  open: 'Otvoren',
  in_progress: 'U radu',
  done: 'Riješen',
  rejected: 'Odbijen'
};

const STATUS_CLASS = {
  open: 'bg-accent-soft text-accent border border-accent/20',
  in_progress: 'bg-warn-soft text-warn border border-warn/20',
  done: 'bg-ok-soft text-ok border border-ok/20',
  rejected: 'bg-danger-soft text-danger border border-danger/20'
};

const router = useRouter();
const toasts = useToasts();

const tab = ref('open');
const searchQuery = ref('');
const requests = ref([]);
const meta = ref(null);
const loading = ref(true);
const busyId = ref(null);
const statsPopping = ref(false);

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

async function load() {
  loading.value = true;
  try {
    const status = tab.value === 'all' ? undefined : tab.value;
    const { data } = await client.get('/requests', {
      params: { status, page: 1, limit: 50 }
    });
    requests.value = data.requests || [];
    meta.value = data.meta;
    triggerUpdatePulse();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje zahtjeva nije uspjelo.');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function pick(key) {
  tab.value = key;
  load();
}

async function setStatus(request, status) {
  busyId.value = request._id;
  try {
    await client.patch(`/requests/${request._id}`, { status });
    request.status = status;
    toasts.success(`${request.title} → ${STATUS_LABEL[status]}`);
    triggerUpdatePulse();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Izmjena nije uspjela.');
  } finally {
    busyId.value = null;
  }
}

function startSong(request) {
  router.push({
    name: 'song-new',
    query: { title: request.title, artist: request.artist }
  });
}

const filteredRequests = computed(() => {
  if (!searchQuery.value.trim()) return requests.value;
  const q = searchQuery.value.trim().toLowerCase();
  return requests.value.filter((r) =>
    (r.title || '').toLowerCase().includes(q) ||
    (r.artist || '').toLowerCase().includes(q) ||
    (r.note || '').toLowerCase().includes(q)
  );
});

const totalVotes = computed(() => requests.value.reduce((n, r) => n + (r.votes || 0), 0));
const openCount = computed(() => requests.value.filter((r) => r.status === 'open').length);
const inProgressCount = computed(() => requests.value.filter((r) => r.status === 'in_progress').length);
const doneCount = computed(() => requests.value.filter((r) => r.status === 'done').length);

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Zahtjevi pjesama
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Pjesme i izvođači koje čitaoci traže, rangirani po broju glasova.
        </p>
      </div>

      <RouterLink
        :to="{ name: 'song-new' }"
        class="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs sm:text-sm font-bold text-on-ink hover:bg-accent transition shadow-md active:scale-95 cursor-pointer"
      >
        <IconAdd class="text-base" />
        <span>Nova pjesma</span>
      </RouterLink>
    </div>

    <!-- Quick Insights Metric Tiles (Interactive Fast Filters) -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <!-- 1. Otvoreni -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          tab === 'open' ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('open')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconPending class="text-sm text-accent" /> Otvoreni
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Čekaju</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ tab === 'open' && meta ? meta.total : openCount }}
          </span>
          <span class="text-[11px] text-faint">zahtjeva</span>
        </div>
      </div>

      <!-- 2. U radu -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          tab === 'in_progress' ? 'border-warn ring-2 ring-warn/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('in_progress')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconPending class="text-sm text-warn" /> U radu
          </span>
          <span class="text-[10px] text-warn font-bold font-mono">U toku</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-warn" :class="{ 'animate-count-bump': statsPopping }">
            {{ tab === 'in_progress' && meta ? meta.total : inProgressCount }}
          </span>
          <span class="text-[11px] text-faint">obrađuje se</span>
        </div>
      </div>

      <!-- 3. Riješeni -->
      <div
        class="rounded-2xl border bg-panel p-3.5 shadow-2xs transition-all cursor-pointer"
        :class="[
          tab === 'done' ? 'border-ok ring-2 ring-ok/30' : 'border-line hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('done')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCheckCircle class="text-sm text-ok" /> Riješeni
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">U bazi</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ tab === 'done' && meta ? meta.total : doneCount }}
          </span>
          <span class="text-[11px] text-faint">objavljeno</span>
        </div>
      </div>

      <!-- 4. Ukupno glasova -->
      <div
        class="rounded-2xl border border-line bg-panel p-3.5 shadow-2xs"
        :class="statsPopping ? 'animate-pulse-glow' : ''"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconVote class="text-sm text-accent" /> Ukupno glasova
          </span>
          <span class="text-[10px] text-faint font-mono">Potražnja</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ totalVotes }}
          </span>
          <span class="text-[11px] text-faint">glasova čitalaca</span>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs & Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <!-- Category Tabs -->
      <div class="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line-strong overflow-x-auto scrollbar-none">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer shrink-0"
          :class="tab === t.key ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="pick(t.key)"
        >
          <span>{{ t.label }}</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-64">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Pretraži zahtjeve…"
          class="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="list" :rows="6" />

    <div v-else-if="!filteredRequests.length" class="rounded-2xl border border-line bg-panel p-12 text-center shadow-2xs">
      <IconVote class="mx-auto text-3xl text-dim mb-2" />
      <p class="text-sm font-bold text-ink">Nema zahtjeva</p>
      <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
        {{ searchQuery ? `Nema pronađenih zahtjeva za pojam „${searchQuery}”.` : 'Trenutno nema zahtjeva u ovoj kategoriji.' }}
      </p>
    </div>

    <!-- Requests List -->
    <div v-else class="space-y-2.5">
      <article
        v-for="r in filteredRequests"
        :key="r._id"
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-line bg-panel p-4 shadow-2xs transition-all hover:border-line-strong hover:shadow-sm"
      >
        <div class="flex items-center gap-3.5 min-w-0 flex-1">
          <!-- Big Vote Box -->
          <div class="flex flex-col items-center justify-center rounded-xl border border-accent/20 bg-accent-soft/30 min-w-12 py-1.5 px-2 shrink-0">
            <IconVote class="text-xs text-accent" />
            <span class="font-mono text-sm font-black text-accent mt-0.5">{{ r.votes }}</span>
          </div>

          <!-- Title, Artist and Note -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="font-bold text-sm text-ink truncate">{{ r.title }}</h2>
              <span class="rounded-full px-2 py-0.2 text-[10px] font-bold font-mono" :class="STATUS_CLASS[r.status]">
                {{ STATUS_LABEL[r.status] }}
              </span>
            </div>
            <p class="text-xs text-muted mt-0.5 truncate font-medium">{{ r.artist }}</p>
            <p v-if="r.note" class="mt-1 text-xs italic text-faint line-clamp-2 bg-surface/60 p-1.5 rounded-lg border border-line-soft">
              „{{ r.note }}“
            </p>
          </div>
        </div>

        <!-- Meta Date & Action Controls -->
        <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line-soft">
          <span class="font-mono text-[11px] text-faint">{{ when(r.createdAt) }}</span>

          <div class="flex items-center gap-2">
            <button
              v-if="r.status !== 'done'"
              type="button"
              class="flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-on-ink hover:bg-accent transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40"
              :disabled="busyId === r._id"
              @click="startSong(r)"
            >
              <IconAdd class="text-sm" />
              <span>Napravi pjesmu</span>
            </button>

            <!-- Status Select Menu -->
            <select
              class="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none transition hover:border-line-strong focus:border-accent cursor-pointer disabled:opacity-40"
              :value="r.status"
              :disabled="busyId === r._id"
              @change="setStatus(r, $event.target.value)"
            >
              <option v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
