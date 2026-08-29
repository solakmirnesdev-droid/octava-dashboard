<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import IconVote from '~icons/material-symbols/thumb-up-outline-rounded';
import IconAdd from '~icons/material-symbols/add-rounded';

/**
 * Song requests submitted by readers, ranked by reader demand.
 */
const TABS = [
  { key: 'open', label: 'Otvoreni' },
  { key: 'in_progress', label: 'U radu' },
  { key: 'done', label: 'Riješeni' },
  { key: 'rejected', label: 'Odbijeni' },
  { key: 'all', label: 'Svi' }
];

const STATUS_LABEL = {
  open: 'Otvoren',
  in_progress: 'U radu',
  done: 'Riješen',
  rejected: 'Odbijen'
};

const STATUS_CLASS = {
  open: 'bg-accent-soft text-accent',
  in_progress: 'bg-warn-soft text-warn',
  done: 'bg-ok-soft text-ok',
  rejected: 'bg-danger-soft text-danger'
};

const router = useRouter();
const toasts = useToasts();

const tab = ref('open');
const requests = ref([]);
const meta = ref(null);
const loading = ref(true);
const busyId = ref(null);

async function load() {
  loading.value = true;
  try {
    const status = tab.value === 'all' ? undefined : tab.value;
    const { data } = await client.get('/requests', {
      params: { status, page: 1, limit: 50 }
    });
    requests.value = data.requests || [];
    meta.value = data.meta;
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
    toasts.success(`${request.title} → ${STATUS_LABEL[status]}`);
    await load();
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

const totalVotes = computed(() => requests.value.reduce((n, r) => n + (r.votes || 0), 0));
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('bs') : '—');
</script>

<template>
  <section>
    <div class="mb-6">
      <h1 class="text-xl font-semibold tracking-tight">
        Zahtjevi
        <span v-if="meta" class="ml-2 font-mono text-sm font-normal text-faint">{{ meta.total }}</span>
      </h1>
      <p class="mt-1 text-sm text-muted">
        Pjesme koje čitaoci traže, poredane po broju glasova.
        <span v-if="totalVotes" class="text-faint">Ukupno {{ totalVotes }} glasova na ovoj stranici.</span>
      </p>
    </div>

    <div class="mb-4 flex flex-wrap gap-2 border-b border-line pb-3 text-sm">
      <button
        v-for="t in TABS" :key="t.key"
        class="rounded px-3 py-1 transition"
        :class="tab === t.key ? 'bg-panel font-semibold text-accent shadow-xs' : 'text-muted hover:text-ink'"
        @click="pick(t.key)"
      >{{ t.label }}</button>
    </div>

    <SkeletonLoader v-if="loading" type="list" :rows="6" />
    <p v-else-if="!requests.length" class="rounded border border-line bg-panel px-4 py-8 text-center text-sm text-faint">
      Nema zahtjeva u ovoj kategoriji.
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="r in requests" :key="r._id"
        class="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3"
      >
        <!-- Votes first -->
        <span class="flex w-12 shrink-0 flex-col items-center rounded-lg border border-line-soft bg-surface/60 py-1">
          <IconVote class="text-xs text-accent" />
          <span class="font-mono text-sm font-bold">{{ r.votes }}</span>
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ r.title }}</p>
          <p class="truncate text-xs text-muted">{{ r.artist }}</p>
          <p v-if="r.note" class="mt-0.5 truncate text-xs italic text-faint">„{{ r.note }}“</p>
        </div>

        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
          :class="STATUS_CLASS[r.status]"
        >{{ STATUS_LABEL[r.status] }}</span>

        <span class="shrink-0 font-mono text-xs text-faint">{{ when(r.createdAt) }}</span>

        <div class="flex shrink-0 gap-2">
          <button
            v-if="r.status !== 'done'"
            class="flex items-center gap-1 rounded border border-line-strong px-2.5 py-1 text-xs text-muted
                   transition hover:border-accent hover:text-accent disabled:opacity-40"
            :disabled="busyId === r._id"
            @click="startSong(r)"
          ><IconAdd /> Napravi</button>

          <select
            class="rounded border border-line-strong bg-panel px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-40"
            :value="r.status"
            :disabled="busyId === r._id"
            @change="setStatus(r, $event.target.value)"
          >
            <option v-for="(label, key) in STATUS_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
      </li>
    </ul>
  </section>
</template>
