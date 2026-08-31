<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '../stores/notifications';
import { useToasts } from '../composables/useToasts';
import { initials, avatarStyle } from '../utils/avatar';

import IconBell from '~icons/material-symbols/notifications-outline-rounded';
import IconClose from '~icons/material-symbols/close-rounded';
import IconCheck from '~icons/material-symbols/check-rounded';
import IconDoneAll from '~icons/material-symbols/done-all-rounded';
import IconReview from '~icons/material-symbols/rate-review-outline-rounded';
import IconComment from '~icons/material-symbols/chat-bubble-outline-rounded';
import IconRequest from '~icons/material-symbols/add-circle-outline-rounded';
import IconVote from '~icons/material-symbols/thumb-up-outline-rounded';
import IconBug from '~icons/material-symbols/bug-report-outline-rounded';
import IconPerson from '~icons/material-symbols/person-add-outline-rounded';
import IconArrowForward from '~icons/material-symbols/arrow-forward-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const router = useRouter();
const store = useNotificationsStore();
const toasts = useToasts();

const activeTab = ref('all'); // 'all' | 'unread' | 'requests' | 'reports'
const panelRef = ref(null);

const KINDS = {
  'review.created':  { icon: IconReview,  label: 'Nova recenzija',   tone: 'accent' },
  'comment.created': { icon: IconComment, label: 'Novi komentar',    tone: 'accent' },
  'request.created': { icon: IconRequest, label: 'Novi zahtjev',     tone: 'accent' },
  'request.voted':   { icon: IconVote,    label: 'Glas za zahtjev',  tone: 'accent' },
  'report.created':  { icon: IconBug,     label: 'Prijava greške',   tone: 'danger' },
  'user.registered': { icon: IconPerson,  label: 'Nov korisnik',     tone: 'ok' },
  'song.updated':    { icon: IconMusic,   label: 'Izmjena pjesme',   tone: 'accent' }
};

const kind = (type) => KINDS[type] || { icon: IconReview, label: type || 'Obavijest', tone: 'accent' };

const TONE_CLASSES = {
  accent: 'bg-accent-soft text-accent border-accent/20',
  ok: 'bg-ok-soft text-ok border-ok/20',
  danger: 'bg-danger-soft text-danger border-danger/20'
};

const filteredItems = computed(() => {
  const all = store.items || [];
  if (activeTab.value === 'unread') {
    return all.filter((n) => !n.read);
  }
  if (activeTab.value === 'requests') {
    return all.filter((n) => n.type?.startsWith('request.'));
  }
  if (activeTab.value === 'reports') {
    return all.filter((n) => n.type === 'report.created');
  }
  return all;
});

function close() {
  emit('update:modelValue', false);
}

async function markAllRead() {
  await store.markRead();
  toasts.success('Sve obavijesti su označene kao pročitane.');
}

async function markSingleRead(notification, e) {
  if (e) e.stopPropagation();
  if (notification.read) return;
  await store.markRead([notification._id]);
}

function targetRoute(n) {
  if (n.song?._id) return { name: 'song-edit', params: { id: n.song._id } };
  if (n.type === 'report.created') return { name: 'reports' };
  if (n.type === 'request.created' || n.type === 'request.voted') return { name: 'requests' };
  if (n.type === 'user.registered') return { name: 'accounts' };
  return { name: 'notifications' };
}

function handleNotificationClick(n) {
  markSingleRead(n);
  close();
  const route = targetRoute(n);
  if (route) router.push(route);
}

function viewAllNotifications() {
  close();
  router.push({ name: 'notifications' });
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function ago(iso) {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seconds < 60) return 'upravo sad';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `prije ${minutes} ${plural(minutes, 'min', 'min', 'min')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours} ${plural(hours, 'h', 'h', 'h')}`;
  const days = Math.floor(hours / 24);
  return `prije ${days} ${plural(days, 'd', 'd', 'd')}`;
}

function handleDocumentPointerDown(e) {
  if (!props.modelValue) return;
  if (panelRef.value && !panelRef.value.contains(e.target) && !e.target.closest('[data-notification-trigger]')) {
    close();
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) {
    close();
  }
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    store.fetchPage({ page: 1 });
  }
});

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Transition
    enter-from-class="opacity-0 translate-y-2 scale-95"
    enter-active-class="transition duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
    leave-to-class="opacity-0 translate-y-1 scale-95"
    leave-active-class="transition duration-150 ease-in"
  >
    <div
      v-if="modelValue"
      ref="panelRef"
      class="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-11 z-50 w-[calc(100vw-16px)] sm:w-[430px] max-h-[85vh] sm:max-h-[580px] flex flex-col rounded-2xl sm:rounded-3xl border border-line-strong bg-panel/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 select-none overflow-hidden"
    >
      <!-- Panel Top Header -->
      <div class="p-3.5 sm:p-4 border-b border-line-soft bg-raised/40 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconBell class="text-base" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-ink">Obavještenja</h3>
              <span
                v-if="store.unread"
                class="rounded-full bg-accent px-2 py-0.2 text-[10px] font-bold text-on-accent font-mono animate-badge-pop"
              >
                {{ store.unread }} novo
              </span>
            </div>
            <p class="text-[11px] text-muted">Aktivnosti i događaji u redakciji</p>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="store.unread"
            type="button"
            class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:text-accent hover:bg-raised transition cursor-pointer"
            title="Označi sve pročitano"
            @click="markAllRead"
          >
            <IconDoneAll class="text-sm" />
            <span class="hidden sm:inline">Označi sve</span>
          </button>

          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink transition cursor-pointer"
            aria-label="Zatvori panel"
            @click="close"
          >
            <IconClose class="text-base" />
          </button>
        </div>
      </div>

      <!-- Filter Category Tabs -->
      <div class="flex items-center gap-1 px-3.5 py-2 border-b border-line-soft bg-surface/50 text-xs overflow-x-auto scrollbar-none">
        <button
          type="button"
          class="shrink-0 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer"
          :class="activeTab === 'all' ? 'bg-ink text-on-ink shadow-2xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="activeTab = 'all'"
        >
          Sve ({{ store.items?.length || 0 }})
        </button>

        <button
          type="button"
          class="shrink-0 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer flex items-center gap-1"
          :class="activeTab === 'unread' ? 'bg-ink text-on-ink shadow-2xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="activeTab = 'unread'"
        >
          <span>Nepročitano</span>
          <span
            v-if="store.unread"
            class="size-1.5 rounded-full bg-accent"
          />
        </button>

        <button
          type="button"
          class="shrink-0 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer"
          :class="activeTab === 'requests' ? 'bg-ink text-on-ink shadow-2xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="activeTab = 'requests'"
        >
          Zahtjevi
        </button>

        <button
          type="button"
          class="shrink-0 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer"
          :class="activeTab === 'reports' ? 'bg-ink text-on-ink shadow-2xs font-bold' : 'text-muted hover:text-ink hover:bg-raised'"
          @click="activeTab = 'reports'"
        >
          Prijave
        </button>
      </div>

      <!-- Notifications Scrollable Feed -->
      <div class="flex-1 overflow-y-auto divide-y divide-line-soft/80 overscroll-contain">
        <div
          v-for="n in filteredItems"
          :key="n._id"
          class="group relative flex items-start gap-3 p-3.5 hover:bg-raised/60 transition-colors cursor-pointer"
          :class="!n.read ? 'bg-accent-soft/10' : ''"
          @click="handleNotificationClick(n)"
        >
          <!-- Unread Glowing Indicator Pill -->
          <span
            v-if="!n.read"
            class="absolute left-1 top-4 size-1.5 rounded-full bg-accent"
          />

          <!-- Event Icon / Avatar -->
          <div class="relative shrink-0 mt-0.5">
            <div
              v-if="n.user?.name"
              class="size-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-2xs"
              :style="avatarStyle(n.user.name)"
            >
              {{ initials(n.user.name) }}
            </div>
            <div
              v-else
              class="size-8 rounded-xl border flex items-center justify-center shadow-2xs"
              :class="TONE_CLASSES[kind(n.type).tone]"
            >
              <component :is="kind(n.type).icon" class="text-sm" />
            </div>
          </div>

          <!-- Notification Content & Body -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] font-semibold text-muted uppercase tracking-wider">
                {{ kind(n.type).label }}
              </span>
              <span class="text-[10px] font-mono text-faint">
                {{ ago(n.createdAt) }}
              </span>
            </div>

            <!-- Subject / Title -->
            <p class="text-xs font-bold text-ink mt-0.5 group-hover:text-accent transition-colors leading-snug line-clamp-2">
              <span v-if="n.user?.name" class="text-ink font-semibold">{{ n.user.name }} — </span>
              {{ n.song?.title || n.message || n.subject || 'Događaj u redakciji' }}
            </p>

            <!-- Detail Snippet -->
            <p v-if="n.detail || n.song?.artist?.name" class="text-[11px] text-muted mt-0.5 line-clamp-1">
              {{ n.detail || n.song?.artist?.name }}
            </p>
          </div>

          <!-- Quick Read Check Action Button on Hover -->
          <button
            v-if="!n.read"
            type="button"
            class="shrink-0 size-6 flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-panel transition shadow-2xs opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Označi kao pročitano"
            @click="markSingleRead(n, $event)"
          >
            <IconCheck class="text-xs" />
          </button>
        </div>

        <!-- Empty State -->
        <div
          v-if="!filteredItems.length"
          class="flex flex-col items-center justify-center p-8 text-center"
        >
          <div class="size-12 rounded-2xl bg-raised flex items-center justify-center text-muted mb-2.5">
            <IconBell class="text-2xl text-faint" />
          </div>
          <p class="text-xs font-bold text-ink">Nema obavještenja</p>
          <p class="text-[11px] text-muted max-w-[220px] mt-0.5">
            {{ activeTab === 'unread' ? 'Sve vaše obavijesti su pregledane.' : 'Trenutno nema novih aktivnosti u ovoj kategoriji.' }}
          </p>
        </div>
      </div>

      <!-- Bottom Footer: Link to Full Page Inbox -->
      <div class="p-2.5 sm:p-3 border-t border-line-soft bg-panel flex items-center justify-between text-xs text-muted">
        <span class="text-[11px] font-mono text-faint">Octava Live Feed</span>

        <button
          type="button"
          class="flex items-center gap-1 font-bold text-accent hover:underline transition cursor-pointer text-xs"
          @click="viewAllNotifications"
        >
          <span>Otvori puni Inbox</span>
          <IconArrowForward class="text-xs" />
        </button>
      </div>
    </div>
  </Transition>
</template>
