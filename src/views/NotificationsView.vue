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
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  danger: 'bg-danger-soft text-danger'
};

async function load() {
  await store.fetchPage({ page: page.value, unreadOnly: unreadOnly.value });
}

async function toggleFilter() {
  unreadOnly.value = !unreadOnly.value;
  page.value = 1;
  await load();
}

async function markAll() {
  await store.markRead();
  toasts.success('Sve označeno kao pročitano.');
  if (unreadOnly.value) await load();
}

const when = (iso) => new Date(iso).toLocaleString('bs');

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
  <section>
    <header class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Inbox</h1>
      <span v-if="store.unread" class="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
        {{ store.unread }} novo
      </span>

      <div class="ml-auto flex items-center gap-2">
        <button
          class="rounded border border-line-strong px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          :class="unreadOnly ? 'border-accent bg-accent text-on-accent hover:text-on-accent' : ''"
          @click="toggleFilter"
        >{{ unreadOnly ? 'Samo nepročitano' : 'Sve' }}</button>

        <button
          class="flex items-center gap-1.5 rounded border border-line-strong px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-40"
          :disabled="!store.unread"
          @click="markAll"
        >
          <IconRead /> Označi sve
        </button>
      </div>
    </header>

    <SkeletonLoader v-if="store.loading" type="grid" :rows="6" />

    <p v-else-if="!store.items.length" class="rounded border border-line bg-panel px-4 py-8 text-center text-sm text-faint">
      {{ unreadOnly ? 'Nema nepročitanih stavki u inboxu.' : 'Inbox je prazan.' }}
    </p>

    <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="n in store.items" :key="n._id">
        <component
          :is="targetRoute(n) ? 'RouterLink' : 'div'"
          :to="targetRoute(n)"
          class="group flex h-full flex-col rounded-lg border bg-panel p-3.5 transition-all"
          :class="[
            n.read ? 'border-line' : 'border-accent/40 bg-accent/[0.03]',
            targetRoute(n) ? 'hover:border-accent hover:bg-raised/40 cursor-pointer' : ''
          ]"
        >
          <div class="flex items-center gap-2">
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded"
              :class="TONE_CHIP[kind(n.type).tone]"
            >
              <component :is="kind(n.type).icon" class="text-base" />
            </span>

            <span class="truncate text-sm font-medium text-ink">{{ kind(n.type).label }}</span>

            <span
              v-if="!n.read"
              class="ml-auto size-2 shrink-0 rounded-full bg-accent"
              aria-label="nepročitano"
            />
          </div>

          <div v-if="n.user" class="mt-2.5 flex items-center gap-2 text-xs">
            <div
              :style="avatarStyle(n.user.name || n.user.email)"
              class="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold"
            >
              {{ initials(n.user.name || n.user.email) }}
            </div>
            <span class="truncate font-medium text-ink">{{ n.user.name || n.user.email }}</span>
          </div>

          <div v-if="n.song" class="mt-1 text-xs">
            <span class="font-medium text-ink">{{ n.song.title }}</span>
            <span v-if="n.song.artist" class="text-muted"> · {{ n.song.artist.name || n.song.artist }}</span>
          </div>

          <p v-if="n.body" class="mt-2 line-clamp-3 text-xs text-muted whitespace-pre-wrap">
            {{ n.body }}
          </p>

          <footer class="mt-auto pt-3 text-[11px] text-faint flex items-center justify-between">
            <time :datetime="n.createdAt" :title="when(n.createdAt)">{{ ago(n.createdAt) }}</time>
            <span v-if="targetRoute(n)" class="opacity-0 group-hover:opacity-100 text-accent transition-opacity">
              Otvori →
            </span>
          </footer>
        </component>
      </li>
    </ul>

    <nav v-if="store.meta && store.meta.pages > 1" class="mt-6 flex justify-center gap-2 text-sm">
      <button
        v-for="p in store.meta.pages" :key="p"
        class="size-8 rounded border text-xs"
        :class="page === p ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-panel hover:border-accent'"
        @click="page = p; load()"
      >{{ p }}</button>
    </nav>
  </section>
</template>
