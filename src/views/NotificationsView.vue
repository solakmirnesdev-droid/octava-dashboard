<script setup>
import { onMounted, ref } from 'vue';
import { useNotificationsStore } from '../stores/notifications';
import { useToasts } from '../composables/useToasts';
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
 *
 * AI-DECISION: `tone` is a status token, not a decorative palette. A bug report
 * is a problem and reads `danger`; a registration is the site growing and reads
 * `ok`; everything else is ordinary traffic and stays on the accent. Colouring
 * all six differently would look livelier and mean nothing — the colour here is
 * meant to be scannable, so it only says "this one is different".
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

/**
 * How long ago, in Bosnian.
 *
 * AI-TRAP: written out rather than handed to Intl.RelativeTimeFormat. The same
 * failure this project already documented for region names applies here — a
 * build can accept 'bs' and answer in English — and the plural rule is the part
 * that gives it away: 1 sat, 2 sata, 5 sati. Getting "prije 5 sata" onto the
 * page is worse than showing nothing.
 */
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
      <h1 class="text-xl font-semibold tracking-tight">Obavještenja</h1>
      <span v-if="store.unread" class="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
        {{ store.unread }} novo
      </span>

      <div class="ml-auto flex items-center gap-2">
        <button
          class="rounded border border-line-strong px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          :class="unreadOnly ? 'border-accent bg-accent text-on-accent hover:text-on-accent' : ''"
          @click="toggleFilter"
        >{{ unreadOnly ? 'Samo nepročitana' : 'Sva' }}</button>

        <button
          class="flex items-center gap-1.5 rounded border border-line-strong px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-40"
          :disabled="!store.unread"
          @click="markAll"
        >
          <IconRead /> Označi sve
        </button>
      </div>
    </header>

    <p v-if="store.loading" class="text-sm text-faint">Učitavanje…</p>

    <p v-else-if="!store.items.length" class="rounded border border-line bg-panel px-4 py-8 text-center text-sm text-faint">
      {{ unreadOnly ? 'Nema nepročitanih obavještenja.' : 'Još nema obavještenja.' }}
    </p>

    <!--
      AI-DECISION: a grid, not a stack. Twenty-five notifications as full-width
      rows put three short lines against a metre of empty panel on any desk
      monitor, and the eye has to travel the whole width to find the next one.
      Three columns keep a screenful readable without scrolling.

      The detail was already in the payload and was being thrown away: the API
      populates `actor.username` and the song's slug and id, and all of it was
      being flattened into the pre-rendered `summary` string. The actor is now a
      face, and the song title is a link to its editor — which is where anybody
      reading a notification about a song is trying to get.
    -->
    <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="n in store.items" :key="n._id"
        class="flex flex-col rounded-lg border bg-panel p-3.5 transition-colors"
        :class="n.read ? 'border-line' : 'border-accent/40 bg-accent/[0.03]'"
      >
        <div class="flex items-center gap-2">
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded"
            :class="TONE_CHIP[kind(n.type).tone]"
          >
            <component :is="kind(n.type).icon" class="text-base" />
          </span>

          <span class="truncate text-sm font-medium">{{ kind(n.type).label }}</span>

          <!-- An unread dot rather than a button: marking one read individually
               is a click nobody wants; the batch button above covers the need. -->
          <span
            v-if="!n.read"
            class="ml-auto size-2 shrink-0 rounded-full bg-accent"
            aria-label="nepročitano"
          />
        </div>

        <!-- Guarded: the thing a notification points at can be deleted, which is
             why the summary is stored pre-rendered in the first place. -->
        <RouterLink
          v-if="n.song?._id"
          :to="{ name: 'song-edit', params: { id: n.song._id } }"
          class="mt-2.5 truncate text-sm font-medium text-accent hover:underline"
        >{{ n.song.title }}</RouterLink>

        <p v-if="n.summary" class="mt-1 line-clamp-2 text-sm leading-snug text-muted">{{ n.summary }}</p>

        <!-- mt-auto pins this to the bottom, so cards of different heights in a
             row still line their footers up. -->
        <div class="mt-auto flex items-center gap-2 pt-3 text-xs text-faint">
          <span v-if="n.actor?.username" class="flex min-w-0 items-center gap-1.5">
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
              :style="avatarStyle(n.actor.username)"
            >{{ initials(n.actor.username) }}</span>
            <span class="truncate">{{ n.actor.username }}</span>
          </span>

          <!-- Relative on the card, exact on hover: "prije 2 sata" is what you
               actually want to know, and it costs a line less than a timestamp. -->
          <time class="ml-auto shrink-0" :datetime="n.createdAt" :title="when(n.createdAt)">
            {{ ago(n.createdAt) }}
          </time>
        </div>
      </li>
    </ul>

    <nav v-if="store.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
      <button
        class="rounded border border-line-strong px-3 py-1.5 disabled:opacity-35"
        :disabled="page <= 1" @click="page--; load()"
      >Prethodna</button>
      <span class="text-faint">{{ page }} / {{ store.pages }}</span>
      <button
        class="rounded border border-line-strong px-3 py-1.5 disabled:opacity-35"
        :disabled="page >= store.pages" @click="page++; load()"
      >Sljedeća</button>
    </nav>
  </section>
</template>
