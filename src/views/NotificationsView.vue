<script setup>
import { onMounted, ref } from 'vue';
import { useNotificationsStore } from '../stores/notifications';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconReview from '~icons/material-symbols/rate-review-outline-rounded';
import IconComment from '~icons/material-symbols/chat-bubble-outline-rounded';
import IconRequest from '~icons/material-symbols/add-circle-outline-rounded';
import IconVote from '~icons/material-symbols/thumb-up-outline-rounded';
import IconRead from '~icons/material-symbols/mark-email-read-outline-rounded';
import IconBug from '~icons/material-symbols/bug-report-outline-rounded';
import IconPerson from '~icons/material-symbols/person-add-outline-rounded';
import IconNotifications from '~icons/material-symbols/notifications-outline-rounded';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';
import { initials, avatarStyle } from '../utils/avatar';

const store = useNotificationsStore();
const toasts = useToasts();
const unreadOnly = ref(false);
const page = ref(1);

/**
 * Icon, wording and tone per event.
 */
const KINDS = {
  'review.created':  { icon: IconReview,  label: 'Nova recenzija',   tone: 'accent' },
  'comment.created': { icon: IconComment, label: 'Novi komentar',    tone: 'accent' },
  'request.created': { icon: IconRequest, label: 'Novi zahtjev',     tone: 'accent' },
  'request.voted':   { icon: IconVote,    label: 'Glas za zahtjev',  tone: 'accent' },
  'report.created':  { icon: IconBug,     label: 'Prijava greške',   tone: 'danger' },
  'user.registered': { icon: IconPerson,  label: 'Nov korisnik',     tone: 'ok' }
};
const kind = (type) => KINDS[type] || { icon: IconReview, label: type, tone: 'accent' };

const TONE_CHIP = {
  accent: 'bg-accent-soft text-accent border border-accent/20',
  ok: 'bg-ok-soft text-ok border border-ok/20',
  danger: 'bg-danger-soft text-danger border border-danger/20'
};

async function load() {
  await store.fetchPage({ page: page.value, unreadOnly: unreadOnly.value });
}

async function toggleFilter(unread) {
  unreadOnly.value = unread;
  page.value = 1;
  await load();
}

async function markAll() {
  await store.markRead();
  toasts.success('Sve označeno kao pročitano.');
  if (unreadOnly.value) await load();
}

const when = (iso) => (iso ? new Date(iso).toLocaleString('bs') : '—');

/** Route to open when clicking the notification card. */
function targetRoute(n) {
  if (n.song?._id) return { name: 'song-edit', params: { id: n.song._id } };
  if (n.type === 'report.created') return { name: 'reports' };
  if (n.type === 'request.created' || n.type === 'request.voted') return { name: 'requests' };
  if (n.type === 'user.registered') return { name: 'accounts' };
  return null;
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function ago(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seconds < 60) return 'upravo sad';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `prije ${minutes} ${plural(minutes, 'minut', 'minute', 'minuta')}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours} ${plural(hours, 'sat', 'sata', 'sati')}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `prije ${days} ${plural(days, 'dan', 'dana', 'dana')}`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `prije ${weeks} ${plural(weeks, 'sedmice', 'sedmice', 'sedmica')}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `prije ${months} ${plural(months, 'mjesec', 'mjeseca', 'mjeseci')}`;

  const years = Math.floor(days / 365);
  return `prije ${years} ${plural(years, 'godine', 'godine', 'godina')}`;
}

onMounted(load);
</script>

<template>
  <section class="pb-16 sm:pb-8">
    <!-- Top Header -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-ink">
          Obavijesti i inbox
        </h1>
        <p class="text-xs text-muted mt-0.5">
          Sve aktivnosti čitalaca, prijave grešaka, komentari i novi zahtjevi.
        </p>
      </div>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs sm:text-sm font-bold text-on-ink hover:bg-accent transition shadow-md active:scale-95 cursor-pointer disabled:opacity-40"
        :disabled="!store.unread"
        @click="markAll"
      >
        <IconRead class="text-base" />
        <span>Označi sve pročitanim</span>
      </button>
    </div>

    <!-- Navigation & Filter Toolbar -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-2 shadow-2xs text-xs">
      <div class="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line-strong overflow-x-auto scrollbar-none">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer shrink-0"
          :class="!unreadOnly ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="toggleFilter(false)"
        >
          <span>Sve obavijesti</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer shrink-0"
          :class="unreadOnly ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="toggleFilter(true)"
        >
          <span>Samo nepročitano</span>
          <span v-if="store.unread" class="ml-1 rounded-full bg-accent px-1.5 py-0.2 text-[10px] font-bold text-on-accent">
            {{ store.unread }}
          </span>
        </button>
      </div>
    </div>

    <SkeletonLoader v-if="store.loading" type="grid" :rows="6" />

    <div v-else-if="!store.items.length" class="rounded-2xl border border-line bg-panel p-12 text-center shadow-2xs">
      <IconNotifications class="mx-auto text-3xl text-dim mb-2" />
      <p class="text-sm font-bold text-ink">Nema obavijesti</p>
      <p class="text-xs text-muted mt-1 max-w-sm mx-auto">
        {{ unreadOnly ? 'Nema nepročitanih stavki u inboxu.' : 'Inbox je trenutno prazan.' }}
      </p>
    </div>

    <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="n in store.items" :key="n._id">
        <component
          :is="targetRoute(n) ? 'RouterLink' : 'div'"
          :to="targetRoute(n)"
          class="group flex h-full flex-col rounded-2xl border bg-panel p-4 shadow-2xs transition-all hover:shadow-sm"
          :class="[
            n.read ? 'border-line hover:border-line-strong' : 'border-accent/40 bg-accent/[0.02] ring-1 ring-accent/20',
            targetRoute(n) ? 'cursor-pointer' : ''
          ]"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-xl shadow-2xs"
              :class="TONE_CHIP[kind(n.type).tone]"
            >
              <component :is="kind(n.type).icon" class="text-base" />
            </span>

            <span class="truncate text-xs sm:text-sm font-bold text-ink">{{ kind(n.type).label }}</span>

            <span
              v-if="!n.read"
              class="ml-auto size-2.5 shrink-0 rounded-full bg-accent ring-2 ring-panel animate-pulse"
              aria-label="nepročitano"
            />
          </div>

          <div v-if="n.user" class="mt-3 flex items-center gap-2 text-xs">
            <div
              :style="avatarStyle(n.user.name || n.user.email)"
              class="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs"
            >
              {{ initials(n.user.name || n.user.email) }}
            </div>
            <span class="truncate font-semibold text-ink">{{ n.user.name || n.user.email }}</span>
          </div>

          <div v-if="n.song" class="mt-1.5 text-xs">
            <span class="font-bold text-ink">{{ n.song.title }}</span>
            <span v-if="n.song.artist" class="text-muted font-medium"> · {{ n.song.artist.name || n.song.artist }}</span>
          </div>

          <p v-if="n.body" class="mt-2 line-clamp-3 text-xs text-muted leading-relaxed whitespace-pre-wrap bg-surface/50 p-2 rounded-xl border border-line-soft font-mono">
            {{ n.body }}
          </p>

          <footer class="mt-auto pt-3 text-[11px] text-faint flex items-center justify-between border-t border-line-soft mt-3 font-mono">
            <time :datetime="n.createdAt" :title="when(n.createdAt)">{{ ago(n.createdAt) }}</time>
            <span v-if="targetRoute(n)" class="opacity-0 group-hover:opacity-100 text-accent font-bold font-sans transition-opacity">
              Pregledaj →
            </span>
          </footer>
        </component>
      </li>
    </ul>

    <!-- Pagination Controls -->
    <div v-if="store.meta && store.meta.pages > 1" class="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-xl border border-line bg-panel text-muted hover:border-line-strong hover:text-ink transition disabled:opacity-40 cursor-pointer"
        :disabled="page <= 1"
        @click="page--; load()"
      >
        <IconPrev class="text-sm" />
      </button>

      <span class="font-mono text-xs text-faint px-2">
        Stranica {{ page }} od {{ store.meta.pages }}
      </span>

      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-xl border border-line bg-panel text-muted hover:border-line-strong hover:text-ink transition disabled:opacity-40 cursor-pointer"
        :disabled="page >= store.meta.pages"
        @click="page++; load()"
      >
        <IconNext class="text-sm" />
      </button>
    </div>
  </section>
</template>
