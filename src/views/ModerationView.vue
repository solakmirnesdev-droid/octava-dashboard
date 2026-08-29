<script setup>
import { onMounted, ref, computed } from 'vue';
import AppModal from '../components/AppModal.vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import { initials, avatarColor } from '../utils/avatar';
import IconHide from '~icons/material-symbols/visibility-off-outline-rounded';
import IconShow from '~icons/material-symbols/visibility-outline-rounded';
import IconReviews from '~icons/material-symbols/rate-review-outline-rounded';
import IconComments from '~icons/material-symbols/chat-bubble-outline-rounded';
import IconStar from '~icons/material-symbols/star-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconWarning from '~icons/material-symbols/warning-rounded';
import IconCheck from '~icons/material-symbols/check-circle-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';

/**
 * Reviews and comments moderation view.
 */
const toasts = useToasts();

const tab = ref('reviews');          // reviews | comments
const status = ref('published');     // published | hidden | removed | all
const searchQuery = ref('');
const items = ref([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const loading = ref(false);

/** The row being hidden, and the reason typed for it. */
const hiding = ref(null);
const reason = ref('');

const STATUSES = [
  { value: 'published', label: 'Objavljeno', tone: 'ok' },
  { value: 'hidden',    label: 'Sakriveno', tone: 'danger' },
  { value: 'removed',   label: 'Autor uklonio', tone: 'faint' },
  { value: 'all',       label: 'Sve', tone: 'neutral' }
];

const PRESET_REASONS = [
  'Spam / neželjeni sadržaj',
  'Uvredljiv govor ili psovke',
  'Netačan ili besmislen tekst',
  'Kršenje pravila zajednice',
  'Nije vezano za pjesmu'
];

async function load() {
  loading.value = true;
  try {
    const { data } = await client.get(`/moderation/${tab.value}`, {
      params: { status: status.value, page: page.value, limit: 25 }
    });
    items.value = data.items || [];
    pages.value = data.pages || 1;
    total.value = data.total || 0;
  } catch {
    toasts.error('Učitavanje nije uspjelo.');
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
    const body = (row.body || '').toLowerCase();
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
      hidden: true, reason: reason.value.trim()
    });
    toasts.success('Sadržaj je sakriven.');
    hiding.value = null;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  }
}

async function restore(row) {
  try {
    await client.patch(`/moderation/${tab.value}/${row._id}`, { hidden: false });
    toasts.success('Sadržaj je ponovo vidljiv.');
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Nije uspjelo.');
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString('bs', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(load);
</script>

<template>
  <section class="space-y-4">
    <!-- Top Header Bar -->
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      <div class="flex items-center gap-3">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            Moderacija
            <span class="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent font-mono">
              {{ total }}
            </span>
          </h1>
          <p class="text-xs text-muted mt-0.5">Pregled i upravljanje recenzijama i komentarima korisnika</p>
        </div>

        <!-- Segmented Tab: Recenzije | Komentari -->
        <div class="flex items-center rounded-lg border border-line-strong bg-panel p-0.5 text-xs shadow-2xs ml-2">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition"
            :class="tab === 'reviews' ? 'bg-ink font-semibold text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
            @click="switchTo('reviews')"
          >
            <IconReviews class="text-sm text-accent" />
            <span>Recenzije</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition"
            :class="tab === 'comments' ? 'bg-ink font-semibold text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
            @click="switchTo('comments')"
          >
            <IconComments class="text-sm text-accent" />
            <span>Komentari</span>
          </button>
        </div>
      </div>

      <!-- Status Filters -->
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          v-for="s in STATUSES"
          :key="s.value"
          type="button"
          class="rounded-lg border px-3 py-1.5 font-medium transition"
          :class="status === s.value
            ? 'border-accent bg-accent text-on-accent shadow-xs'
            : 'border-line-strong bg-panel text-muted hover:border-accent hover:text-ink'"
          @click="setStatus(s.value)"
        >
          {{ s.label }}
        </button>
      </div>
    </header>

    <!-- Search & Quick Filter Bar -->
    <div class="flex items-center justify-between gap-3">
      <div class="relative w-full max-w-sm">
        <IconSearch class="absolute left-3 top-2.5 text-sm text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Pretraži po korisniku, pjesmi ili tekstu…"
          class="w-full rounded-lg border border-line-strong bg-panel py-1.5 pl-9 pr-3 text-xs outline-none focus:border-accent"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2.5 top-2 text-xs text-muted hover:text-ink"
          @click="searchQuery = ''"
        >
          ×
        </button>
      </div>

      <span class="text-xs text-faint">
        Prikazano: <strong class="font-mono text-ink">{{ filteredItems.length }}</strong> od {{ total }}
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-16 text-muted">
      <div class="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent mb-3" />
      <span class="text-xs">Učitavam zapise za moderaciju…</span>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!filteredItems.length"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-panel py-16 text-center text-xs text-muted"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-raised text-muted mb-3">
        <IconCheck class="text-2xl text-accent" />
      </div>
      <p class="font-semibold text-sm text-ink">Nema zapisa za odabrani filter</p>
      <p class="text-faint max-w-xs mt-1">
        {{ searchQuery ? 'Nijedan zapis ne odgovara pojmu pretrage.' : 'Trenutno nema stavki sa ovim statusom moderacije.' }}
      </p>
    </div>

    <!-- Moderation Cards List -->
    <div v-else class="space-y-3">
      <article
        v-for="row in filteredItems"
        :key="row._id"
        class="rounded-xl border bg-panel p-4 shadow-sm transition-all"
        :class="[
          row.status === 'hidden'
            ? 'border-danger/30 bg-danger/5'
            : row.status === 'removed'
              ? 'border-line bg-raised/30 opacity-75'
              : 'border-line hover:border-line-strong'
        ]"
      >
        <div class="flex items-start justify-between gap-3">
          <!-- User info & context -->
          <div class="flex items-center gap-3">
            <!-- User Avatar Badge -->
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
              :style="{ backgroundColor: avatarColor(row.user?.username || row.user?.email || 'User') }"
            >
              {{ initials(row.user?.username || row.user?.email || '?') }}
            </div>

            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-sm text-ink">
                  {{ row.user?.username || 'Nepoznat korisnik' }}
                </span>
                <span v-if="row.user?.email" class="text-xs text-muted font-mono">
                  {{ row.user?.email }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs text-muted mt-0.5">
                <!-- Connected Song -->
                <div v-if="row.song" class="flex items-center gap-1 text-ink font-medium">
                  <IconMusic class="text-xs text-accent" />
                  <RouterLink
                    v-if="row.song._id"
                    :to="{ name: 'song-edit', params: { id: row.song._id } }"
                    class="text-accent hover:underline"
                  >
                    {{ row.song.title }}
                  </RouterLink>
                  <span v-else>{{ row.song.title }}</span>
                </div>

                <span v-if="row.song" class="text-faint">·</span>

                <!-- Rating stars if review -->
                <div v-if="row.rating" class="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-500 font-semibold font-mono text-[11px]">
                  <IconStar class="text-xs fill-current" />
                  <span>{{ row.rating }} / 5</span>
                </div>

                <span v-if="row.rating" class="text-faint">·</span>

                <!-- Date -->
                <span class="text-faint">{{ formatDate(row.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Status Pill Badge -->
          <div class="shrink-0">
            <span
              v-if="row.status === 'published'"
              class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500"
            >
              <span class="size-1.5 rounded-full bg-emerald-500" />
              Objavljeno
            </span>

            <span
              v-else-if="row.status === 'hidden'"
              class="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger border border-danger/20"
            >
              <IconHide class="text-xs" />
              Sakriveno
            </span>

            <span
              v-else
              class="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-[11px] font-medium text-muted"
            >
              <IconDelete class="text-xs" />
              Uklonio autor
            </span>
          </div>
        </div>

        <!-- Comment / Review Text Body -->
        <div class="mt-3 rounded-lg border border-line-soft bg-raised/40 p-3 text-sm text-ink leading-relaxed">
          <p class="whitespace-pre-wrap">{{ row.body }}</p>
        </div>

        <!-- Hidden Reason Banner if Hidden -->
        <div
          v-if="row.status === 'hidden' && row.moderationReason"
          class="mt-2.5 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 p-2.5 text-xs text-danger"
        >
          <IconWarning class="text-sm shrink-0 mt-0.5" />
          <div>
            <span class="font-semibold">Razlog sakrivanja:</span> {{ row.moderationReason }}
            <span v-if="row.moderatedBy?.name" class="text-danger/80 block text-[11px] mt-0.5">
              Moderirao: <strong>{{ row.moderatedBy.name }}</strong>
            </span>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="mt-3.5 flex items-center justify-between pt-2.5 border-t border-line-soft text-xs">
          <div class="flex items-center gap-2">
            <RouterLink
              v-if="row.song?._id"
              :to="{ name: 'song-edit', params: { id: row.song._id } }"
              class="text-muted hover:text-accent font-medium transition"
            >
              Otvori pjesmu →
            </RouterLink>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="row.status === 'published'"
              type="button"
              class="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/5 px-3 py-1.5 font-semibold text-danger hover:bg-danger hover:text-white transition shadow-2xs"
              @click="askHide(row)"
            >
              <IconHide class="text-sm" />
              <span>Sakrij sadržaj</span>
            </button>

            <button
              v-else-if="row.status === 'hidden'"
              type="button"
              class="flex items-center gap-1.5 rounded-lg border border-accent bg-accent-soft px-3 py-1.5 font-semibold text-accent hover:bg-accent hover:text-on-accent transition shadow-2xs"
              @click="restore(row)"
            >
              <IconShow class="text-sm" />
              <span>Vrati objavu</span>
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- Pagination Navigation -->
    <nav v-if="pages > 1" class="mt-6 flex items-center justify-center gap-3 text-xs">
      <button
        type="button"
        class="rounded-lg border border-line-strong bg-panel px-3 py-1.5 font-medium disabled:opacity-35 hover:border-accent hover:text-ink transition"
        :disabled="page <= 1"
        @click="page--; load()"
      >
        ← Prethodna
      </button>
      <span class="font-mono text-muted">Stranica <strong>{{ page }}</strong> od {{ pages }}</span>
      <button
        type="button"
        class="rounded-lg border border-line-strong bg-panel px-3 py-1.5 font-medium disabled:opacity-35 hover:border-accent hover:text-ink transition"
        :disabled="page >= pages"
        @click="page++; load()"
      >
        Sljedeća →
      </button>
    </nav>

    <!-- Hide Reason Confirmation Modal -->
    <AppModal
      :model-value="Boolean(hiding)"
      title="Sakrij sadržaj"
      description="Razlog sakrivanja ostaje zabilježen u sistemu i vidljiv osoblju."
      confirm-label="Potvrdi i sakrij"
      tone="danger"
      :confirm-disabled="!reason.trim()"
      @update:model-value="(open) => { if (!open) hiding = null; }"
      @confirm="confirmHide()"
    >
      <div class="space-y-3 text-xs">
        <!-- Target content snippet preview -->
        <div class="rounded-lg border border-line bg-raised/50 p-2.5 text-muted">
          <span class="font-semibold text-ink block mb-0.5">Sadržaj koji se sakriva:</span>
          <p class="italic line-clamp-3 text-ink">„{{ hiding?.body }}”</p>
        </div>

        <!-- Quick Reason Selection Chips -->
        <div>
          <span class="font-semibold text-muted block mb-1.5">Brzi odabir razloga:</span>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="r in PRESET_REASONS"
              :key="r"
              type="button"
              class="rounded-md border px-2 py-1 text-[11px] transition"
              :class="reason === r
                ? 'border-accent bg-accent-soft font-semibold text-accent'
                : 'border-line-strong bg-panel text-muted hover:border-accent hover:text-ink'"
              @click="selectPresetReason(r)"
            >
              {{ r }}
            </button>
          </div>
        </div>

        <div>
          <label class="font-semibold text-muted block mb-1">Detaljan razlog:</label>
          <textarea
            v-model="reason"
            rows="3"
            maxlength="500"
            class="w-full rounded-lg border border-line-strong bg-panel p-2.5 text-xs outline-none focus:border-accent"
            placeholder="Unesite ili dopunite razlog sakrivanja…"
          />
        </div>
      </div>
    </AppModal>
  </section>
</template>
