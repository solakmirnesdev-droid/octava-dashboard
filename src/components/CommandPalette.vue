<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../composables/useTheme';
import { useChat } from '../composables/useChat';
import client from '../api/client';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconSongs from '~icons/material-symbols/queue-music-rounded';
import IconArtists from '~icons/material-symbols/artist-rounded';
import IconStats from '~icons/material-symbols/bar-chart-rounded';
import IconShield from '~icons/material-symbols/shield-outline-rounded';
import IconTrash from '~icons/material-symbols/delete-outline-rounded';
import IconHistory from '~icons/material-symbols/history-rounded';
import IconAccounts from '~icons/material-symbols/manage-accounts-rounded';
import IconLock from '~icons/material-symbols/lock-outline-rounded';
import IconBell from '~icons/material-symbols/notifications-outline-rounded';
import IconRequest from '~icons/material-symbols/playlist-add-rounded';
import IconBug from '~icons/material-symbols/bug-report-outline-rounded';
import IconPrint from '~icons/material-symbols/graphic-eq-rounded';
import IconAdd from '~icons/material-symbols/add-rounded';
import IconTheme from '~icons/material-symbols/brightness-6-outline-rounded';
import IconChat from '~icons/material-symbols/forum-outline-rounded';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const router = useRouter();
const auth = useAuthStore();
const { cycle: cycleTheme } = useTheme();
const { openThread, peers } = useChat();

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const query = ref('');
const activeIndex = ref(0);
const songResults = ref([]);
const artistResults = ref([]);
const searching = ref(false);
const inputRef = ref(null);
let searchDebounce = null;

const staticActions = computed(() => {
  const list = [
    { id: 'nav-songs', label: 'Pjesme', category: 'Navigacija', icon: IconSongs, action: () => router.push({ name: 'songs' }) },
    { id: 'nav-song-new', label: 'Nova pjesma', category: 'Akcije', icon: IconAdd, action: () => router.push({ name: 'song-new' }) },
    { id: 'nav-artists', label: 'Izvođači', category: 'Navigacija', icon: IconArtists, action: () => router.push({ name: 'artists' }) },
    { id: 'nav-stats', label: 'Statistika', category: 'Navigacija', icon: IconStats, action: () => router.push({ name: 'stats' }) },
    { id: 'nav-notifications', label: 'Inbox obavještenja', category: 'Navigacija', icon: IconBell, action: () => router.push({ name: 'notifications' }) },
    { id: 'nav-requests', label: 'Zahtjevi čitalaca', category: 'Navigacija', icon: IconRequest, action: () => router.push({ name: 'requests' }) },
    { id: 'nav-reports', label: 'Prijave grešaka', category: 'Navigacija', icon: IconBug, action: () => router.push({ name: 'reports' }) }
  ];

  if (auth.hasRole('worker')) {
    list.push({ id: 'nav-fingerprints', label: 'Akustički otisci', category: 'Navigacija', icon: IconPrint, action: () => router.push({ name: 'fingerprints' }) });
  }

  if (auth.hasRole('admin')) {
    list.push(
      { id: 'nav-moderation', label: 'Moderacija komentara i recenzija', category: 'Navigacija', icon: IconShield, action: () => router.push({ name: 'moderation' }) },
      { id: 'nav-trash', label: 'Kanta za smeće', category: 'Navigacija', icon: IconTrash, action: () => router.push({ name: 'trash' }) },
      { id: 'nav-audit', label: 'Revizijski trag (Audit)', category: 'Navigacija', icon: IconHistory, action: () => router.push({ name: 'audit' }) }
    );
  }

  if (auth.isSuperadmin) {
    list.push({ id: 'nav-accounts', label: 'Urednički i korisnički nalozi', category: 'Navigacija', icon: IconAccounts, action: () => router.push({ name: 'accounts' }) });
  }

  list.push(
    { id: 'act-security', label: 'Sigurnost i 2FA postavke', category: 'Postavke', icon: IconLock, action: () => router.push({ name: 'security' }) },
    { id: 'act-theme', label: 'Promijeni temu (Svijetla / Tamna)', category: 'Postavke', icon: IconTheme, action: () => cycleTheme() }
  );

  return list;
});

const filteredStaticActions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return staticActions.value;
  return staticActions.value.filter((item) =>
    item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
  );
});

const allItems = computed(() => {
  const items = [];
  // Add live search songs
  if (songResults.value.length) {
    songResults.value.forEach((s) => {
      items.push({
        id: `song-${s._id}`,
        label: s.title,
        sub: s.artist?.name || '',
        category: 'Pjesme',
        icon: IconSongs,
        action: () => router.push({ name: 'song-edit', params: { id: s._id } })
      });
    });
  }

  // Add live search artists
  if (artistResults.value.length) {
    artistResults.value.forEach((a) => {
      items.push({
        id: `artist-${a._id}`,
        label: a.name,
        sub: a.country || '',
        category: 'Izvođači',
        icon: IconArtists,
        action: () => router.push({ name: 'artists' })
      });
    });
  }

  // Add actions
  items.push(...filteredStaticActions.value);
  return items;
});

watch(query, (q) => {
  activeIndex.value = 0;
  clearTimeout(searchDebounce);
  const clean = q.trim();
  if (clean.length < 2) {
    songResults.value = [];
    artistResults.value = [];
    searching.value = false;
    return;
  }

  searching.value = true;
  searchDebounce = setTimeout(async () => {
    try {
      const [songRes, artistRes] = await Promise.allSettled([
        client.get('/songs/search', { params: { q: clean, limit: 5 } }),
        client.get('/artists', { params: { q: clean, limit: 5 } })
      ]);

      if (songRes.status === 'fulfilled') {
        songResults.value = songRes.value.data.songs || [];
      }
      if (artistRes.status === 'fulfilled') {
        artistResults.value = (artistRes.value.data.artists || []).slice(0, 4);
      }
    } catch {
      // Ignore background search errors
    } finally {
      searching.value = false;
    }
  }, 200);
});

function close() {
  isOpen.value = false;
  query.value = '';
  songResults.value = [];
  artistResults.value = [];
}

function selectItem(item) {
  if (!item) return;
  close();
  item.action();
}

function onKeyDown(e) {
  if (!isOpen.value) {
    // Open on Cmd+K or Ctrl+K (unless typing inside text inputs, except if modifier is pressed)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      // In SongEditor raw editor, Cmd+K inserts chord brackets if focused
      if (target.dataset?.chordproEditor) {
        return;
      }
      e.preventDefault();
      isOpen.value = true;
    }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % (allItems.value.length || 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + (allItems.value.length || 1)) % (allItems.value.length || 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (allItems.value[activeIndex.value]) {
      selectItem(allItems.value[activeIndex.value]);
    }
  }
}

watch(isOpen, async (val) => {
  if (val) {
    activeIndex.value = 0;
    await nextTick();
    inputRef.value?.focus();
  }
});

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      @click.self="close"
    >
      <div
        class="w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-label="Komandna paleta"
      >
        <!-- Search Input Header -->
        <div class="flex items-center gap-3 border-b border-line px-4 py-3.5 bg-surface/40">
          <IconSearch class="text-lg text-muted shrink-0" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Pretraži pjesme, izvođače, akcije ili navigaciju…"
            class="w-full bg-transparent text-sm text-ink placeholder-faint outline-none"
          />
          <kbd class="hidden sm:inline-block rounded border border-line px-1.5 py-0.5 text-[10px] font-mono font-medium text-faint bg-raised">
            ESC
          </kbd>
        </div>

        <!-- Results List -->
        <div class="max-h-[60vh] overflow-y-auto p-2 divide-y divide-line-soft">
          <div v-if="searching" class="px-4 py-3 text-xs text-faint italic">
            Pretraga kataloga…
          </div>

          <div v-if="!allItems.length && !searching" class="px-4 py-8 text-center text-sm text-faint">
            Nema rezultata za „{{ query }}“
          </div>

          <ul v-else class="space-y-0.5">
            <li
              v-for="(item, idx) in allItems"
              :key="item.id"
              class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors"
              :class="idx === activeIndex ? 'bg-accent-soft text-accent' : 'text-body hover:bg-raised'"
              @click="selectItem(item)"
              @mouseenter="activeIndex = idx"
            >
              <div class="flex items-center gap-3 min-w-0">
                <component
                  :is="item.icon"
                  class="text-base shrink-0"
                  :class="idx === activeIndex ? 'text-accent' : 'text-muted'"
                />
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ item.label }}</p>
                  <p v-if="item.sub" class="truncate text-xs opacity-75">{{ item.sub }}</p>
                </div>
              </div>

              <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-sunken text-faint">
                {{ item.category }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Footer Key Hints -->
        <div class="flex items-center justify-between border-t border-line bg-surface/50 px-4 py-2 text-[11px] text-faint">
          <div class="flex items-center gap-3">
            <span><kbd class="font-mono">↑↓</kbd> navigacija</span>
            <span><kbd class="font-mono">↵</kbd> odaberi</span>
          </div>
          <span>Octava Quick Jump</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
