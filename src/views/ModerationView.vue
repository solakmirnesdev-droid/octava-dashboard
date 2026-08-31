<script setup>
import { onMounted, ref, computed } from 'vue';
import AppModal from '../components/AppModal.vue';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { initials, avatarStyle } from '../utils/avatar';

import IconHide from '~icons/material-symbols/visibility-off-rounded';
import IconShow from '~icons/material-symbols/visibility-rounded';
import IconReviews from '~icons/material-symbols/rate-review-outline-rounded';
import IconComments from '~icons/material-symbols/chat-bubble-outline-rounded';
import IconStar from '~icons/material-symbols/star-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconWarning from '~icons/material-symbols/warning-rounded';
import IconCheck from '~icons/material-symbols/check-circle-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconClose from '~icons/material-symbols/close-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import IconPerson from '~icons/material-symbols/person-rounded';
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded';

const toasts = useToasts();

const tab = ref('reviews');          // 'reviews' | 'comments'
const status = ref('published');     // 'published' | 'hidden' | 'removed' | 'all'
const searchQuery = ref('');
const items = ref([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const loading = ref(false);

const stats = ref({
  reviews: 0,
  hiddenReviews: 0,
  comments: 0,
  hiddenComments: 0
});

/** The row being hidden, and the reason typed for it. */
const hiding = ref(null);
const reason = ref('');

const STATUSES = [
  { value: 'published', label: 'Objavljeno', dot: 'bg-ok' },
  { value: 'hidden',    label: 'Sakriveno', dot: 'bg-danger' },
  { value: 'removed',   label: 'Autor uklonio', dot: 'bg-dim' },
  { value: 'all',       label: 'Sve', dot: 'bg-accent' }
];

const PRESET_REASONS = [
  'Spam / neželjeni sadržaj',
  'Uvredljiv govor ili psovke',
  'Netačan ili besmislen tekst',
  'Kršenje pravila zajednice',
  'Nije vezano za pjesmu'
];

const statsPopping = ref(false);

function triggerUpdatePulse() {
  statsPopping.value = true;
  setTimeout(() => {
    statsPopping.value = false;
  }, 1200);
}

async function fetchStats() {
  try {
    const { data } = await client.get('/moderation/counts');
    if (stats.value.reviews !== data.reviews || stats.value.hiddenReviews !== data.hiddenReviews || stats.value.comments !== data.comments) {
      triggerUpdatePulse();
    }
    stats.value = data;
  } catch (err) {
    console.warn('Dohvatanje brojača moderacije nije uspjelo:', err);
  }
}

async function load() {
  loading.value = true;
  try {
    const params = {
      page: page.value,
      limit: 25
    };
    if (status.value) params.status = status.value;

    const { data } = await client.get(`/moderation/${tab.value}`, { params });
    items.value = data.items || [];
    pages.value = data.pages || 1;
    total.value = data.total || 0;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Učitavanje moderacije nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value;
  const q = searchQuery.value.trim().toLowerCase();
  return items.value.filter((row) => {
    const user = (row.user?.username || '').toLowerCase();
    const email = (row.user?.email || '').toLowerCase();
    const song = (row.song?.title || '').toLowerCase();
    const body = (row.body || row.text || '').toLowerCase();
    return user.includes(q) || email.includes(q) || song.includes(q) || body.includes(q);
  });
});

function switchTo(next) {
  if (tab.value === next) return;
  tab.value = next;
  page.value = 1;
  load();
}

function setStatus(next) {
  if (status.value === next) return;
  status.value = next;
  page.value = 1;
  load();
}

function askHide(row) {
  hiding.value = row;
  reason.value = '';
}

function selectPresetReason(r) {
  reason.value = r;
}

async function confirmHide() {
  if (!reason.value.trim()) return;
  try {
    await client.patch(`/moderation/${tab.value}/${hiding.value._id}`, {
      hidden: true,
      reason: reason.value.trim()
    });
    toasts.success('Sadržaj je sakriven sa javnog sajta.');
    hiding.value = null;
    await Promise.all([load(), fetchStats()]);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Sakrivanje nije uspjelo.');
  }
}

async function restore(row) {
  try {
    await client.patch(`/moderation/${tab.value}/${row._id}`, { hidden: false });
    toasts.success('Sadržaj je vraćen u javni prikaz.');
    await Promise.all([load(), fetchStats()]);
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Vraćanje sadržaja nije uspjelo.');
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}. ${month} ${year}. u ${hours}:${minutes}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seconds < 60) return 'upravo sad';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours} h`;
  const days = Math.floor(hours / 24);
  return `prije ${days} d`;
}

function turn(p) {
  page.value = p;
  load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  load();
  fetchStats();
});
</script>

<template>
  <section class="pb-16 sm:pb-8 font-sans">
    <!-- TOP HEADER -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink flex items-center gap-2">
            Moderacija
          </h1>
          <span class="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent font-mono border border-accent/20">
            {{ total }} zapisa
          </span>
        </div>
        <p class="text-xs text-muted mt-0.5">
          Pregled i moderiranje recenzija i komentara korisnika na pjesmama.
        </p>
      </div>

      <!-- Segmented Tab: Recenzije | Komentari -->
      <div class="flex items-center rounded-xl border border-line-strong bg-panel p-1 shadow-2xs">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
          :class="tab === 'reviews' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
          @click="switchTo('reviews')"
        >
          <IconReviews class="text-base text-accent" />
          <span>Recenzije</span>
          <span
            v-if="stats.hiddenReviews"
            class="ml-1 rounded-full bg-danger-soft text-danger px-1.5 py-0.2 text-[10px] font-mono"
            title="Broj sakrivenih recenzija"
          >
            {{ stats.hiddenReviews }}
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
          :class="tab === 'comments' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
          @click="switchTo('comments')"
        >
          <IconComments class="text-base text-accent" />
          <span>Komentari</span>
          <span
            v-if="stats.hiddenComments"
            class="ml-1 rounded-full bg-danger-soft text-danger px-1.5 py-0.2 text-[10px] font-mono"
            title="Broj sakrivenih komentara"
          >
            {{ stats.hiddenComments }}
          </span>
        </button>
      </div>
    </div>

    <!-- METRIC STAT TILES (Click to filter) -->
    <div class="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <!-- Tile 1: Active Type Count -->
      <button
        type="button"
        class="flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all hover:shadow-sm active:scale-98 cursor-pointer"
        :class="[
          status === 'all' ? 'border-accent bg-accent-soft/20 shadow-2xs' : 'border-line bg-panel text-muted hover:border-accent/40',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('all')"
      >
        <div class="flex items-center justify-between text-xs font-medium">
          <span>{{ tab === 'reviews' ? 'Sve recenzije' : 'Svi komentari' }}</span>
          <IconReviews v-if="tab === 'reviews'" class="text-accent text-base" />
          <IconComments v-else class="text-accent text-base" />
        </div>
        <div class="mt-2 font-mono text-xl sm:text-2xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
          {{ tab === 'reviews' ? (stats.reviews + stats.hiddenReviews) : (stats.comments + stats.hiddenComments) }}
        </div>
      </button>

      <!-- Tile 2: Published -->
      <button
        type="button"
        class="flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all hover:shadow-sm active:scale-98 cursor-pointer"
        :class="[
          status === 'published' ? 'border-ok bg-ok-soft/30 shadow-2xs' : 'border-line bg-panel text-muted hover:border-ok/40',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('published')"
      >
        <div class="flex items-center justify-between text-xs font-medium">
          <span>Javno objavljeno</span>
          <IconCheck class="text-ok text-base" />
        </div>
        <div class="mt-2 font-mono text-xl sm:text-2xl font-black text-ok" :class="{ 'animate-count-bump': statsPopping }">
          {{ tab === 'reviews' ? stats.reviews : stats.comments }}
        </div>
      </button>

      <!-- Tile 3: Hidden (Moderated) -->
      <button
        type="button"
        class="flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all hover:shadow-sm active:scale-98 cursor-pointer"
        :class="[
          status === 'hidden' ? 'border-danger bg-danger-soft/30 shadow-2xs' : 'border-line bg-panel text-muted hover:border-danger/40',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('hidden')"
      >
        <div class="flex items-center justify-between text-xs font-medium">
          <span>Sakriveno (Moderisano)</span>
          <IconShield class="text-danger text-base" />
        </div>
        <div class="mt-2 font-mono text-xl sm:text-2xl font-black text-danger" :class="{ 'animate-count-bump': statsPopping }">
          {{ tab === 'reviews' ? stats.hiddenReviews : stats.hiddenComments }}
        </div>
      </button>

      <!-- Tile 4: Author Removed -->
      <button
        type="button"
        class="flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all hover:shadow-sm active:scale-98 cursor-pointer"
        :class="[
          status === 'removed' ? 'border-line-strong bg-raised shadow-2xs' : 'border-line bg-panel text-muted hover:border-line-strong',
          statsPopping ? 'animate-pulse-glow' : ''
        ]"
        @click="setStatus('removed')"
      >
        <div class="flex items-center justify-between text-xs font-medium">
          <span>Autor obrisao</span>
          <IconDelete class="text-muted text-base" />
        </div>
        <div class="mt-2 font-mono text-xl sm:text-2xl font-black text-ink" :class="{ 'animate-count-bump': statsPopping }">
          Arhivirano
        </div>
      </button>
    </div>

    <!-- TOOLBAR: Status filter pills & Search bar -->
    <div class="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4 text-xs sm:text-sm">
      <!-- Status Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <button
          v-for="s in STATUSES"
          :key="s.value"
          type="button"
          class="shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition cursor-pointer select-none"
          :class="status === s.value
            ? 'border-accent bg-ink text-on-ink shadow-xs'
            : 'border-line-strong bg-panel text-muted hover:border-accent hover:text-ink'"
          @click="setStatus(s.value)"
        >
          <span class="size-2 rounded-full" :class="s.dot" />
          <span>{{ s.label }}</span>
        </button>
      </div>

      <!-- Search Input with Clear Button -->
      <div class="relative w-full sm:w-80">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-base" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Pretraži po korisniku, pjesmi ili tekstu…"
          class="w-full rounded-xl border border-line-strong bg-panel py-2 pl-9 pr-8 text-xs font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition shadow-2xs"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer p-1 transition"
          aria-label="Obriši pretragu"
          @click="searchQuery = ''"
        >
          <IconClose class="text-xs" />
        </button>
      </div>
    </div>

    <!-- SKELETON LOADER -->
    <SkeletonLoader v-if="loading" type="list" :rows="6" />

    <!-- EMPTY STATE -->
    <div
      v-else-if="!filteredItems.length"
      class="flex flex-col items-center justify-center rounded-2xl border border-line bg-panel py-16 px-4 text-center my-4 shadow-2xs"
    >
      <div class="flex size-14 items-center justify-center rounded-2xl bg-raised text-muted mb-3">
        <IconCheck class="text-3xl text-ok" />
      </div>
      <p class="font-bold text-base text-ink">Nema zapisa za odabrani filter</p>
      <p class="text-xs text-muted max-w-sm mt-1">
        {{ searchQuery ? `Nijedan zapis ne odgovara pojmu „${searchQuery}”.` : 'Trenutno nema stavki sa ovim statusom moderacije.' }}
      </p>
      <button
        v-if="searchQuery || status !== 'all'"
        type="button"
        class="mt-4 rounded-xl border border-line-strong bg-surface px-4 py-2 text-xs font-bold text-ink hover:border-accent hover:text-accent transition shadow-2xs cursor-pointer"
        @click="searchQuery = ''; setStatus('all')"
      >
        Prikaži sve zapise
      </button>
    </div>

    <!-- MODERATION FEED CARDS -->
    <div v-else class="space-y-3.5">
      <article
        v-for="row in filteredItems"
        :key="row._id"
        class="group relative rounded-2xl border bg-panel p-4.5 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md"
        :class="[
          row.status === 'hidden'
            ? 'border-danger/40 bg-danger-soft/10 ring-1 ring-danger/20'
            : row.status === 'removed'
              ? 'border-line-soft bg-raised/30 opacity-75'
              : 'border-line hover:border-line-strong'
        ]"
      >
        <!-- Card Top Bar: Author, Song link, Rating & Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-line-soft">
          <!-- User Profile & Context -->
          <div class="flex items-center gap-3 min-w-0">
            <!-- User Avatar Badge -->
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black text-white shadow-2xs select-none"
              :style="avatarStyle(row.user?.username || row.user?.email || 'User')"
            >
              {{ initials(row.user?.username || row.user?.email || '?') }}
            </div>

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-bold text-sm text-ink truncate">
                  {{ row.user?.username || 'Nepoznat korisnik' }}
                </span>
                <span v-if="row.user?.email" class="text-xs text-muted font-mono truncate">
                  {{ row.user?.email }}
                </span>
              </div>

              <!-- Song & Timestamp -->
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                <div v-if="row.song" class="flex items-center gap-1 text-ink font-semibold">
                  <IconMusic class="text-xs text-accent shrink-0" />
                  <RouterLink
                    v-if="row.song._id"
                    :to="{ name: 'song-edit', params: { id: row.song._id } }"
                    class="text-accent hover:underline truncate max-w-[200px]"
                    title="Uredi povezanu pjesmu"
                  >
                    {{ row.song.title }}
                  </RouterLink>
                  <span v-else class="truncate max-w-[200px]">{{ row.song.title }}</span>
                </div>

                <span v-if="row.song" class="text-faint">•</span>

                <!-- Rating Score Stars if Review -->
                <div
                  v-if="row.rating"
                  class="flex items-center gap-1 rounded-lg bg-warn-soft px-2 py-0.5 text-warn font-bold font-mono text-xs border border-warn/20"
                >
                  <div class="flex items-center gap-0.5">
                    <IconStar v-for="i in row.rating" :key="i" class="text-xs fill-current" />
                  </div>
                  <span>{{ row.rating }}/5</span>
                </div>

                <span v-if="row.rating" class="text-faint">•</span>

                <time :datetime="row.createdAt" class="text-[11px] font-mono text-faint" :title="formatDate(row.createdAt)">
                  {{ timeAgo(row.createdAt) }}
                </time>
              </div>
            </div>
          </div>

          <!-- Status badge & Actions Toolbar -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <!-- Status Badge -->
            <span
              v-if="row.status === 'hidden'"
              class="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger border border-danger/20 flex items-center gap-1"
            >
              <span class="size-1.5 rounded-full bg-danger" />
              <span>Sakriveno</span>
            </span>
            <span
              v-else-if="row.status === 'removed'"
              class="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold text-muted border border-line-soft"
            >
              Autor obrisao
            </span>
            <span
              v-else
              class="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok border border-ok/20 flex items-center gap-1"
            >
              <span class="size-1.5 rounded-full bg-ok" />
              <span>Objavljeno</span>
            </span>

            <!-- Action Button: Hide or Restore -->
            <button
              v-if="row.status === 'hidden'"
              type="button"
              class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs font-bold text-ink hover:border-accent hover:text-accent active:scale-95 transition shadow-2xs cursor-pointer"
              title="Vrati sadržaj u javni prikaz na sajtu"
              @click="restore(row)"
            >
              <IconShow class="text-sm text-accent" />
              <span>Vrati</span>
            </button>

            <button
              v-else-if="row.status === 'published'"
              type="button"
              class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3 py-1.5 text-xs font-bold text-muted hover:border-danger hover:text-danger active:scale-95 transition shadow-2xs cursor-pointer"
              title="Sakrij sadržaj iz javnog prikaza"
              @click="askHide(row)"
            >
              <IconHide class="text-sm text-danger" />
              <span>Sakrij</span>
            </button>
          </div>
        </div>

        <!-- Body text quote container -->
        <div class="mt-3.5 rounded-xl bg-surface/60 p-3.5 text-xs sm:text-sm leading-relaxed text-ink border border-line-soft/80 shadow-2xs font-normal">
          <p class="whitespace-pre-wrap select-text">{{ row.body || row.text || '(Nema unesenog teksta)' }}</p>
        </div>

        <!-- Moderation Audit Banner (Visible when hidden) -->
        <div
          v-if="row.status === 'hidden' && row.moderatedAt"
          class="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-xl bg-danger/10 border border-danger/20 p-3 text-xs text-danger"
        >
          <div class="flex items-center gap-2">
            <IconWarning class="text-base shrink-0 text-danger" />
            <span>
              <strong>Razlog moderacije:</strong> {{ row.moderationReason || 'Nepreciziran razlog' }}
            </span>
          </div>
          <span class="text-danger/80 font-mono text-[11px]">
            Moderirao/la: <strong>{{ row.moderatedBy?.name || 'Administrator' }}</strong> · {{ formatDate(row.moderatedAt) }}
          </span>
        </div>
      </article>
    </div>

    <!-- PAGINATION -->
    <nav
      v-if="pages > 1"
      class="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm select-none"
    >
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3.5 py-2 font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-30 transition shadow-2xs active:scale-95 cursor-pointer"
        :disabled="page <= 1"
        @click="turn(page - 1)"
      >
        <IconPrev class="text-base" />
        <span>Prethodna</span>
      </button>

      <span class="font-mono text-xs font-bold text-muted bg-raised px-3 py-1.5 rounded-xl border border-line-soft">
        Stranica {{ page }} od {{ pages }}
      </span>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel px-3.5 py-2 font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-30 transition shadow-2xs active:scale-95 cursor-pointer"
        :disabled="page >= pages"
        @click="turn(page + 1)"
      >
        <span>Sljedeća</span>
        <IconNext class="text-base" />
      </button>
    </nav>

    <!-- HIDE MODAL DIALOG -->
    <AppModal
      :model-value="Boolean(hiding)"
      title="Sakrij sadržaj iz javnog prikaza"
      description="Sakriveni komentar ili recenzija više neće biti vidljivi na javnom sajtu, ali ostaju zabilježeni u moderatorskom tragu."
      confirm-label="Sakrij sadržaj"
      tone="danger"
      @update:model-value="(val) => { if (!val) hiding = null; }"
      @confirm="confirmHide"
    >
      <div class="mt-3 space-y-3.5">
        <!-- Quick Reason Presets -->
        <div>
          <label class="text-xs font-bold text-muted block mb-2">Izaberite razlog moderacije:</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="r in PRESET_REASONS"
              :key="r"
              type="button"
              class="rounded-xl border border-line-strong px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-ink transition cursor-pointer select-none"
              :class="{ '!border-accent !bg-accent-soft !text-accent font-bold shadow-2xs': reason === r }"
              @click="selectPresetReason(r)"
            >
              {{ r }}
            </button>
          </div>
        </div>

        <!-- Custom Reason Input -->
        <div>
          <label class="text-xs font-bold text-muted block mb-1.5">Detaljniji razlog / napomena:</label>
          <input
            v-model="reason"
            type="text"
            placeholder="Unesite ili dopunite razlog sakrivanja…"
            class="w-full rounded-xl border border-line-strong bg-panel px-3.5 py-2 text-xs font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition shadow-2xs"
            @keydown.enter="confirmHide"
          />
        </div>
      </div>
    </AppModal>
  </section>
</template>

