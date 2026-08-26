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

const store = useNotificationsStore();
const toasts = useToasts();
const unreadOnly = ref(false);
const page = ref(1);

/** Icon and wording per event, so a row is readable without reading the type. */
const KINDS = {
  'review.created':  { icon: IconReview,  label: 'Nova recenzija' },
  'comment.created': { icon: IconComment, label: 'Novi komentar' },
  'request.created': { icon: IconRequest, label: 'Novi zahtjev' },
  'request.voted':   { icon: IconVote,    label: 'Glas za zahtjev' },
  'report.created':  { icon: IconBug,     label: 'Prijava greške' },
  'user.registered': { icon: IconPerson,  label: 'Nov korisnik' }
};
const kind = (type) => KINDS[type] || { icon: IconReview, label: type };

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

onMounted(load);
</script>

<template>
  <section>
    <header class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Obavještenja</h1>
      <span v-if="store.unread" class="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
        {{ store.unread }} novo
      </span>

      <div class="ml-auto flex items-center gap-2">
        <button
          class="rounded border border-black/15 px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          :class="unreadOnly ? 'border-accent bg-accent text-white hover:text-white' : ''"
          @click="toggleFilter"
        >{{ unreadOnly ? 'Samo nepročitana' : 'Sva' }}</button>

        <button
          class="flex items-center gap-1.5 rounded border border-black/15 px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-40"
          :disabled="!store.unread"
          @click="markAll"
        >
          <IconRead /> Označi sve
        </button>
      </div>
    </header>

    <p v-if="store.loading" class="text-sm text-black/45">Učitavanje…</p>

    <p v-else-if="!store.items.length" class="rounded border border-black/10 bg-white px-4 py-8 text-center text-sm text-black/45">
      {{ unreadOnly ? 'Nema nepročitanih obavještenja.' : 'Još nema obavještenja.' }}
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="n in store.items" :key="n._id"
        class="flex items-start gap-3 rounded border bg-white px-4 py-3"
        :class="n.read ? 'border-black/10' : 'border-accent/40 bg-accent/[0.03]'"
      >
        <component :is="kind(n.type).icon" class="mt-0.5 shrink-0 text-lg text-black/40" />

        <div class="min-w-0 flex-1">
          <p class="text-sm">
            <span class="font-medium">{{ kind(n.type).label }}</span>
            <span v-if="n.song" class="text-black/50"> — {{ n.song.title }}</span>
          </p>
          <p v-if="n.summary" class="mt-0.5 truncate text-sm text-black/60">{{ n.summary }}</p>
          <p class="mt-1 text-xs text-black/35">{{ when(n.createdAt) }}</p>
        </div>

        <!-- An unread dot rather than a button: marking one read individually is
             a click nobody wants; the batch button above covers the real need. -->
        <span v-if="!n.read" class="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="nepročitano" />
      </li>
    </ul>

    <nav v-if="store.pages > 1" class="mt-6 flex items-center justify-center gap-3 text-sm">
      <button
        class="rounded border border-black/15 px-3 py-1.5 disabled:opacity-35"
        :disabled="page <= 1" @click="page--; load()"
      >Prethodna</button>
      <span class="text-black/45">{{ page }} / {{ store.pages }}</span>
      <button
        class="rounded border border-black/15 px-3 py-1.5 disabled:opacity-35"
        :disabled="page >= store.pages" @click="page++; load()"
      >Sljedeća</button>
    </nav>
  </section>
</template>
