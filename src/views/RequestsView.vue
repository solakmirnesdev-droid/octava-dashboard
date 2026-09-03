<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { AppButton, AppBadge, AppCard, AppInput, AppSegmentedControl, AppEmptyState } from '../components/ui';
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
  { value: 'open', label: 'Otvoreni' },
  { value: 'in_progress', label: 'U radu' },
  { value: 'done', label: 'Riješeni' },
  { value: 'rejected', label: 'Odbijeni' },
  { value: 'all', label: 'Svi zahtjevi' }
];

const STATUS_LABEL = {
  open: 'Otvoren',
  in_progress: 'U radu',
  done: 'Riješen',
  rejected: 'Odbijen'
};

const STATUS_VARIANT = {
  open: 'accent',
  in_progress: 'warn',
  done: 'ok',
  rejected: 'danger'
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

      <AppButton
        :to="{ name: 'song-new' }"
        variant="primary"
        size="sm"
      >
        <template #icon>
          <IconAdd class="text-base" />
        </template>
        Nova pjesma
      </AppButton>
    </div>

    <!-- Quick Insights Metric Tiles -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          tab === 'open' ? '!border-accent ring-2 ring-accent/30' : '',
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
      </AppCard>

      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          tab === 'in_progress' ? '!border-warn ring-2 ring-warn/30' : '',
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
      </AppCard>

      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          tab === 'done' ? '!border-ok ring-2 ring-ok/30' : '',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('done')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCheckCircle class="text-sm text-ok" /> Riješeni
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">Objavljeni</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ tab === 'done' && meta ? meta.total : doneCount }}
          </span>
          <span class="text-[11px] text-faint">dodano</span>
        </div>
      </AppCard>

      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          tab === 'all' ? '!border-line-strong ring-2 ring-ink/10' : '',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="pick('all')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconVote class="text-sm text-accent" /> Glasova
          </span>
          <span class="text-[10px] text-faint font-mono">Ukupno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ totalVotes }}
          </span>
          <span class="text-[11px] text-faint">podrške</span>
        </div>
      </AppCard>
    </div>

    <!-- Filter Tabs & Real-time Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <AppSegmentedControl
        v-model="tab"
        :options="TABS"
        @update:model-value="load"
      />

      <div class="w-full sm:w-64">
        <AppInput
          v-model="searchQuery"
          placeholder="Filtriraj po naslovu / izvođaču…"
          clearable
        >
          <template #icon>
            <IconSearch />
          </template>
        </AppInput>
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="list" :rows="6" />

    <div v-else class="space-y-2.5">
      <AppCard
        v-for="r in filteredRequests"
        :key="r._id"
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-line-strong transition"
      >
        <div class="flex items-start gap-3.5 flex-1 min-w-0">
          <div class="flex flex-col items-center justify-center rounded-xl bg-surface border border-line px-3 py-1.5 min-w-[3.5rem] shadow-2xs">
            <span class="font-mono text-base font-black text-ink leading-tight flex items-center gap-1">
              <IconVote class="text-xs text-accent" />
              {{ r.votes || 1 }}
            </span>
            <span class="text-[9px] font-bold uppercase tracking-wider text-faint">glasova</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-sm text-ink truncate">{{ r.title }}</h3>
              <span class="text-muted font-medium text-xs truncate">· {{ r.artist }}</span>
              <AppBadge :variant="STATUS_VARIANT[r.status] || 'neutral'" size="xs" dot>
                {{ STATUS_LABEL[r.status] || r.status }}
              </AppBadge>
            </div>

            <div class="mt-1.5 flex items-center gap-3 text-[11px] text-faint">
              <span>Zatraženo: {{ when(r.createdAt) }}</span>
              <span v-if="r.email" class="text-muted">od: {{ r.email }}</span>
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          <AppButton
            v-if="r.status === 'open' || r.status === 'in_progress'"
            variant="accent"
            size="xs"
            @click="startSong(r)"
          >
            <template #icon>
              <IconAdd />
            </template>
            Kreiraj pjesmu
          </AppButton>

          <AppButton
            v-if="r.status === 'open'"
            variant="secondary"
            size="xs"
            :loading="busyId === r._id"
            @click="setStatus(r, 'in_progress')"
          >
            U rad
          </AppButton>

          <AppButton
            v-if="r.status !== 'done'"
            variant="ghost"
            size="xs"
            class="text-ok hover:bg-ok-soft"
            :loading="busyId === r._id"
            title="Označi kao riješeno"
            @click="setStatus(r, 'done')"
          >
            <template #icon>
              <IconCheckCircle />
            </template>
            Riješi
          </AppButton>

          <AppButton
            v-if="r.status !== 'rejected'"
            variant="ghost"
            size="xs"
            class="text-danger hover:bg-danger-soft"
            :loading="busyId === r._id"
            title="Odbij zahtjev"
            @click="setStatus(r, 'rejected')"
          >
            <template #icon>
              <IconCancel />
            </template>
          </AppButton>
        </div>
      </AppCard>

      <AppEmptyState
        v-if="!filteredRequests.length"
        title="Nema pronađenih zahtjeva"
        :description="searchQuery ? 'Nijedan zahtjev ne odgovara pretrazi.' : 'Nema zahtjeva za odabrani status.'"
      />
    </div>
  </section>
</template>
