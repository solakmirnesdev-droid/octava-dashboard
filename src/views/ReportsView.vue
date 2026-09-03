<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useRefreshOnVisible } from '../composables/useRefreshOnVisible';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { AppCard, AppButton, AppBadge, AppInput, AppSegmentedControl, AppEmptyState, AppPagination } from '../components/ui';
import IconExternal from '~icons/material-symbols/open-in-new-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconWarning from '~icons/material-symbols/warning-rounded';
import IconCheckCircle from '~icons/material-symbols/check-circle-rounded';
import IconCancel from '~icons/material-symbols/cancel-outline-rounded';
import IconReport from '~icons/material-symbols/report-outline-rounded';

/**
 * Issue reports submitted by readers against songs.
 */
const toasts = useToasts();
const appUrl = import.meta.env.VITE_APP_URL || 'https://octava.app';

const items = ref([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const open = ref(0);
const status = ref('open');
const searchQuery = ref('');
const loading = ref(false);
const statsPopping = ref(false);

const KINDS = {
  chords: 'Pogrešan akord',
  lyrics: 'Netačan tekst',
  key: 'Pogrešan tonalitet',
  duplicate: 'Duplikat',
  other: 'Drugo'
};

const KIND_VARIANTS = {
  chords: 'accent',
  lyrics: 'warn',
  key: 'ok',
  duplicate: 'danger',
  other: 'neutral'
};

const STATUSES = [
  { value: 'open', label: 'Otvorene' },
  { value: 'resolved', label: 'Riješene' },
  { value: 'rejected', label: 'Odbijene' },
  { value: 'all', label: 'Sve prijave' }
];

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get('/reports', {
      params: { status: status.value, page: page.value, limit: 25 }
    });
    items.value = data.reports || [];
    pages.value = data.pages || 1;
    total.value = data.total || 0;
    open.value = data.open || 0;
    triggerUpdatePulse();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje prijava nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

function setStatus(next) {
  status.value = next;
  page.value = 1;
  load();
}

async function close(report, nextStatus) {
  try {
    await client.patch(`/reports/${report._id}`, { status: nextStatus });
    report.status = nextStatus;
    toasts.success(nextStatus === 'resolved' ? 'Označeno kao riješeno.' : 'Odbijeno.');
    triggerUpdatePulse();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  }
}

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value;
  const q = searchQuery.value.trim().toLowerCase();
  return items.value.filter((r) =>
    (r.song?.title || '').toLowerCase().includes(q) ||
    (r.song?.artist?.name || '').toLowerCase().includes(q) ||
    (r.reporter?.email || '').toLowerCase().includes(q) ||
    (r.body || '').toLowerCase().includes(q) ||
    (KINDS[r.kind] || '').toLowerCase().includes(q)
  );
});

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

useRefreshOnVisible(load);
onMounted(load);
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Prijave grešaka
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Prijave netačnih akorda, stihova ili tonaliteta od strane čitalaca.
        </p>
      </div>
    </div>

    <!-- Quick Insights Metric Tiles (Interactive Fast Filters) -->
    <div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <!-- 1. Otvorene -->
      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          status === 'open' ? '!border-accent ring-2 ring-accent/30' : '',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('open')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconWarning class="text-sm text-accent" /> Otvorene
          </span>
          <span class="text-[10px] text-accent font-bold font-mono">Čekaju</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ open }}
          </span>
          <span class="text-[11px] text-faint">prijava</span>
        </div>
      </AppCard>

      <!-- 2. Riješene -->
      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          status === 'resolved' ? '!border-ok ring-2 ring-ok/30' : '',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('resolved')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCheckCircle class="text-sm text-ok" /> Riješene
          </span>
          <span class="text-[10px] text-ok font-bold font-mono">Ispravljeno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
            {{ status === 'resolved' ? total : (total - open) }}
          </span>
          <span class="text-[11px] text-faint">prijava</span>
        </div>
      </AppCard>

      <!-- 3. Odbijene -->
      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          status === 'rejected' ? '!border-danger ring-2 ring-danger/30' : '',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('rejected')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconCancel class="text-sm text-danger" /> Odbijene
          </span>
          <span class="text-[10px] text-danger font-bold font-mono">Arhiva</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-danger" :class="{ 'animate-count-bump': statsPopping }">
            {{ status === 'rejected' ? total : 0 }}
          </span>
          <span class="text-[11px] text-faint">prijava</span>
        </div>
      </AppCard>

      <!-- 4. Ukupno -->
      <AppCard
        variant="interactive"
        padding="sm"
        :class="[
          status === 'all' ? '!border-accent ring-2 ring-accent/30' : '',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('all')"
      >
        <div class="flex items-center justify-between text-muted text-xs">
          <span class="font-medium flex items-center gap-1">
            <IconReport class="text-sm text-muted" /> Ukupno prijava
          </span>
          <span class="text-[10px] text-faint font-mono">Sveukupno</span>
        </div>
        <div class="mt-1.5 flex items-baseline gap-2">
          <span class="font-mono text-2xl sm:text-3xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
            {{ total }}
          </span>
          <span class="text-[11px] text-faint">u sistemu</span>
        </div>
      </AppCard>
    </div>

    <!-- Navigation Tabs & Search Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <AppSegmentedControl
        v-model="status"
        :options="STATUSES"
        @update:model-value="setStatus"
      />

      <div class="w-full sm:w-64">
        <AppInput
          v-model="searchQuery"
          placeholder="Pretraži prijave…"
          clearable
        >
          <template #icon>
            <IconSearch />
          </template>
        </AppInput>
      </div>
    </div>

    <SkeletonLoader v-if="loading" type="list" :rows="5" />

    <!-- Reports List -->
    <div v-else class="space-y-3">
      <AppCard
        v-for="r in filteredItems"
        :key="r._id"
        class="transition-all hover:border-line-strong"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-line-soft">
          <div class="flex items-center gap-2 flex-wrap">
            <AppBadge :variant="KIND_VARIANTS[r.kind] || 'neutral'" size="xs">
              {{ KINDS[r.kind] || r.kind }}
            </AppBadge>

            <template v-if="r.song">
              <RouterLink
                :to="{ name: 'song-edit', params: { id: r.song._id } }"
                class="font-bold text-sm text-ink hover:text-accent transition underline-offset-2 hover:underline"
              >
                {{ r.song.title }}
              </RouterLink>
              <a
                :href="`${appUrl}/pjesma/${r.song.slug}`"
                target="_blank"
                rel="noopener"
                class="text-faint hover:text-accent transition"
                title="Otvori na sajtu"
              >
                <IconExternal class="text-sm inline" />
              </a>
              <span class="text-xs text-muted font-medium">{{ r.song.artist?.name }}</span>
            </template>
            <span v-else class="text-xs text-faint italic">[obrisana pjesma]</span>
          </div>

          <span class="font-mono text-[11px] text-faint">{{ when(r.createdAt) }}</span>
        </div>

        <p class="mt-3 text-xs sm:text-sm text-ink whitespace-pre-wrap leading-relaxed bg-surface/50 p-3 rounded-xl border border-line-soft font-mono">
          {{ r.body }}
        </p>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div v-if="r.reporter?.email" class="text-faint text-[11px]">
            Prijavio/la: <span class="font-mono font-medium text-muted">{{ r.reporter.email }}</span>
          </div>
          <div v-else class="text-faint text-[11px]">Anonimna prijava čitaoca</div>

          <div v-if="r.status === 'open'" class="flex items-center gap-2">
            <AppButton
              variant="secondary"
              size="xs"
              class="!text-ok hover:!border-ok/40 hover:!bg-ok-soft"
              @click="close(r, 'resolved')"
            >
              <template #icon>
                <IconCheckCircle class="text-sm" />
              </template>
              Označi riješeno
            </AppButton>
            <AppButton
              variant="secondary"
              size="xs"
              class="!text-danger hover:!border-danger/40 hover:!bg-danger-soft"
              @click="close(r, 'rejected')"
            >
              <template #icon>
                <IconCancel class="text-sm" />
              </template>
              Odbij prijavu
            </AppButton>
          </div>
          <div v-else class="text-[11px] font-mono">
            Status:
            <AppBadge :variant="r.status === 'resolved' ? 'ok' : 'danger'" size="xs">
              {{ r.status === 'resolved' ? 'Riješeno' : 'Odbijeno' }}
            </AppBadge>
          </div>
        </div>
      </AppCard>

      <AppEmptyState
        v-if="!filteredItems.length"
        title="Nema prijava"
        :description="searchQuery ? `Nema prijava koje odgovaraju pojmu „${searchQuery}”.` : 'Trenutno nema prijava u ovoj kategoriji.'"
      />
    </div>

    <!-- Pagination Controls -->
    <AppPagination
      v-if="pages > 1"
      :page="page"
      :total-pages="pages"
      :total-items="total"
      :page-size="25"
      @update:page="page = $event; load()"
    />
  </section>
</template>
