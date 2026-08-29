<script setup>
import { ref, computed, watch, nextTick, useTemplateRef, onMounted } from 'vue';
import { useChat } from '../composables/useChat';
import { useToasts } from '../composables/useToasts';
import { initials, avatarColor, roleBadgeClass } from '../utils/avatar';
import IconChat from '~icons/material-symbols/forum-rounded';
import IconSend from '~icons/material-symbols/send-rounded';
import IconEmoji from '~icons/material-symbols/mood-rounded';
import IconBold from '~icons/material-symbols/format-bold-rounded';
import IconItalic from '~icons/material-symbols/format-italic-rounded';
import IconStrikethrough from '~icons/material-symbols/format-strikethrough-rounded';
import IconCode from '~icons/material-symbols/code-rounded';
import IconLink from '~icons/material-symbols/link-rounded';
import IconMusic from '~icons/material-symbols/music-note-rounded';
import IconSearch from '~icons/material-symbols/search-rounded';
import IconCheckDouble from '~icons/material-symbols/done-all-rounded';
import IconCheck from '~icons/material-symbols/check-rounded';
import IconArrowBack from '~icons/material-symbols/arrow-back-rounded';
import IconClose from '~icons/material-symbols/close-rounded';

const {
  connected, peers, messages, activeId, loading, me,
  connect, loadPeers, openThread, send, isOnline, totalUnread
} = useChat();

const toasts = useToasts();
const open = ref(false);
const draft = ref('');
const sending = ref(false);
const scroller = ref(null);
const textareaRef = useTemplateRef('textareaRef');
const searchPeer = ref('');
const showEmojiPicker = ref(false);

const EMOJIS = [
  '👍', '❤️', '🔥', '👏', '🎉', '🎵', '🎸', '🎹',
  '🎶', '😂', '😮', '🙏', '✨', '💡', '🚀', '💬',
  '⚡', '☕', '✅', '❌', '👌', '🙌', '💯', '🤔'
];

const active = computed(() => peers.value.find((p) => p._id === activeId.value) || null);

const filteredPeers = computed(() => {
  if (!searchPeer.value.trim()) return peers.value;
  const q = searchPeer.value.trim().toLowerCase();
  return peers.value.filter((p) =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    (p.role || '').toLowerCase().includes(q)
  );
});

async function toBottom() {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

watch(messages, toBottom, { deep: true });

function toggleWidget() {
  open.value = !open.value;
  if (open.value) {
    toBottom();
  }
}

async function pick(peer) {
  await openThread(peer._id);
  toBottom();
  showEmojiPicker.value = false;
}

function backToPeers() {
  activeId.value = null;
  showEmojiPicker.value = false;
}

async function submit() {
  if (!draft.value.trim() || sending.value) return;

  sending.value = true;
  const error = await send(draft.value);
  sending.value = false;

  if (error) toasts.error(error);
  else {
    draft.value = '';
    showEmojiPicker.value = false;
  }
}

function applyWrap(prefix, suffix) {
  const el = textareaRef.value;
  if (!el) {
    draft.value += prefix + suffix;
    return;
  }
  const { selectionStart: start, selectionEnd: end, value } = el;
  const selected = value.slice(start, end);
  draft.value = value.slice(0, start) + prefix + selected + suffix + value.slice(end);

  const caret = selected ? end + prefix.length + suffix.length : start + prefix.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function insertEmoji(emoji) {
  const el = textareaRef.value;
  if (!el) {
    draft.value += emoji;
    return;
  }
  const { selectionStart: start, selectionEnd: end, value } = el;
  draft.value = value.slice(0, start) + emoji + value.slice(end);
  const caret = start + emoji.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function renderMessage(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  escaped = escaped.replace(/~~(.+?)~~/g, '<del class="opacity-75">$1</del>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="rounded bg-black/20 px-1 py-0.5 font-mono text-[11px]">$1</code>');
  escaped = escaped.replace(/\[([A-H][#b]?[^\]]*)\]/g, '<span class="inline-block rounded bg-black/20 border border-current/30 px-1 py-0.2 text-[11px] font-bold font-mono">$1</span>');
  escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline hover:opacity-80 break-all font-medium">$1</a>');

  return escaped;
}

const time = (at) => new Date(at).toLocaleTimeString('bs', { hour: '2-digit', minute: '2-digit' });
const day = (at) => new Date(at).toLocaleDateString('bs', { day: 'numeric', month: 'short' });

onMounted(() => {
  connect();
  loadPeers().catch(() => {});
});
</script>

<template>
  <div class="fixed bottom-5 right-5 z-50 font-sans">
    <!-- Floating Popup Window -->
    <div
      v-if="open"
      class="mb-3 w-[22rem] sm:w-[25rem] h-[32rem] max-h-[calc(100vh-6rem)] rounded-2xl border border-line-strong bg-panel shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <!-- HEADER: ACTIVE THREAD -->
      <header
        v-if="active"
        class="flex items-center justify-between border-b border-line-soft bg-raised/50 px-3.5 py-2.5"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-full hover:bg-raised text-muted hover:text-ink transition shrink-0"
            title="Nazad na listu kolega"
            @click="backToPeers"
          >
            <IconArrowBack class="text-base" />
          </button>

          <!-- Peer avatar & status -->
          <div class="relative shrink-0">
            <div
              class="flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-xs"
              :style="{ backgroundColor: avatarColor(active.name || active.email) }"
            >
              {{ initials(active.name || active.email) }}
            </div>
            <span
              class="absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-panel"
              :class="isOnline(active._id) ? 'bg-emerald-500' : 'bg-line-strong'"
            />
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h3 class="truncate text-xs font-bold text-ink leading-tight">{{ active.name || active.email }}</h3>
              <span
                v-if="active.role"
                class="rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase tracking-wider transition-all"
                :class="roleBadgeClass(active.role)"
              >
                {{ active.role }}
              </span>
            </div>
            <span class="text-[10px]" :class="isOnline(active._id) ? 'text-emerald-500 font-medium' : 'text-muted'">
              {{ isOnline(active._id) ? 'na vezi' : 'nije na vezi' }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-full hover:bg-raised text-muted hover:text-ink transition shrink-0"
          @click="open = false"
        >
          <IconClose class="text-base" />
        </button>
      </header>

      <!-- HEADER: PEERS DIRECTORY -->
      <header
        v-else
        class="flex items-center justify-between border-b border-line-soft bg-raised/50 px-4 py-2.5"
      >
        <div class="flex items-center gap-2">
          <IconChat class="text-base text-accent" />
          <h3 class="text-xs font-bold text-ink">Urednički Chat</h3>
          <span
            class="size-2 rounded-full"
            :class="connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
            :title="connected ? 'Povezan' : 'Spajanje…'"
          />
        </div>

        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-full hover:bg-raised text-muted hover:text-ink transition"
          @click="open = false"
        >
          <IconClose class="text-base" />
        </button>
      </header>

      <!-- BODY: ACTIVE THREAD -->
      <template v-if="active">
        <!-- Messages stream -->
        <div ref="scroller" class="flex-1 space-y-2.5 overflow-y-auto p-3.5 bg-surface/40">
          <div v-if="loading" class="flex items-center justify-center py-8 text-xs text-muted">
            <div class="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2" />
            Učitavam poruke…
          </div>

          <div v-else-if="!messages.length" class="flex flex-col items-center justify-center py-12 text-center text-xs text-muted">
            <span class="text-2xl mb-1">👋</span>
            <p class="font-semibold text-ink">Započnite razgovor</p>
            <p class="text-faint max-w-xs mt-0.5 text-[11px]">Napišite poruku kolegi {{ active.name || active.email }}.</p>
          </div>

          <!-- Message Bubbles -->
          <div
            v-for="m in messages"
            :key="m._id"
            class="flex"
            :class="m.from === me ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[82%] rounded-2xl px-3 py-2 text-xs shadow-xs"
              :class="[
                m.from === me
                  ? 'rounded-br-xs bg-accent text-on-accent'
                  : 'rounded-bl-xs bg-panel border border-line text-ink'
              ]"
            >
              <div
                class="whitespace-pre-wrap break-words leading-relaxed"
                v-html="renderMessage(m.body)"
              />
              <div
                class="mt-1 flex items-center justify-end gap-1 font-mono text-[9px] opacity-75"
                :class="m.from === me ? 'text-on-accent/80' : 'text-muted'"
              >
                <span>{{ day(m.createdAt) }} {{ time(m.createdAt) }}</span>
                <template v-if="m.from === me">
                  <IconCheckDouble v-if="m.readAt" class="text-xs text-emerald-300" title="Pročitano" />
                  <IconCheck v-else class="text-xs opacity-75" title="Poslano" />
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Composer -->
        <div class="border-t border-line-soft bg-panel p-2.5">
          <!-- Toolbar -->
          <div class="mb-1.5 flex items-center justify-between text-muted">
            <div class="flex items-center gap-0.5">
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                title="Podebljano (**tekst**)"
                @click="applyWrap('**', '**')"
              >
                <IconBold class="text-xs" />
              </button>
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                title="Kurziv (*tekst*)"
                @click="applyWrap('*', '*')"
              >
                <IconItalic class="text-xs" />
              </button>
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                title="Precrtano (~~tekst~~)"
                @click="applyWrap('~~', '~~')"
              >
                <IconStrikethrough class="text-xs" />
              </button>
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                title="Kod (`kod`)"
                @click="applyWrap('`', '`')"
              >
                <IconCode class="text-xs" />
              </button>
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                title="Akord ([Am])"
                @click="applyWrap('[', ']')"
              >
                <IconMusic class="text-[11px] text-accent" />
              </button>
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                title="Link"
                @click="applyWrap('[', '](https://)')"
              >
                <IconLink class="text-xs" />
              </button>
            </div>

            <!-- Emoji popover trigger -->
            <div class="relative">
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded hover:bg-raised hover:text-accent transition"
                :class="showEmojiPicker && 'bg-raised text-accent'"
                @click="showEmojiPicker = !showEmojiPicker"
              >
                <IconEmoji class="text-sm" />
              </button>

              <div
                v-if="showEmojiPicker"
                class="absolute bottom-8 right-0 z-30 grid grid-cols-6 gap-1 rounded-xl border border-line-strong bg-panel p-2 shadow-2xl backdrop-blur-md w-44"
              >
                <button
                  v-for="e in EMOJIS"
                  :key="e"
                  type="button"
                  class="flex size-6 items-center justify-center rounded hover:bg-raised hover:scale-125 transition text-sm"
                  @click="insertEmoji(e)"
                >
                  {{ e }}
                </button>
              </div>
            </div>
          </div>

          <!-- Input form -->
          <form class="flex items-end gap-1.5" @submit.prevent="submit">
            <textarea
              ref="textareaRef"
              v-model="draft"
              rows="1"
              placeholder="Napišite poruku…"
              class="max-h-24 flex-1 resize-y rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent leading-relaxed"
              @keydown.enter.exact.prevent="submit"
            />
            <button
              type="submit"
              class="flex size-8 items-center justify-center rounded-xl bg-accent text-on-accent transition hover:brightness-110 disabled:opacity-40 shadow-xs shrink-0"
              :disabled="!draft.trim() || sending || !connected"
            >
              <IconSend class="text-xs" />
            </button>
          </form>
        </div>
      </template>

      <!-- BODY: PEERS DIRECTORY -->
      <template v-else>
        <!-- Search bar -->
        <div class="p-2.5 border-b border-line-soft">
          <div class="relative">
            <IconSearch class="absolute left-2.5 top-2 text-xs text-muted" />
            <input
              v-model="searchPeer"
              type="text"
              placeholder="Pretraži kolege u uredništvu…"
              class="w-full rounded-lg border border-line-strong bg-surface py-1 pl-8 pr-3 text-xs outline-none focus:border-accent"
            />
          </div>
        </div>

        <!-- Colleagues list -->
        <ul class="divide-y divide-line-soft flex-1 overflow-y-auto">
          <li v-for="peer in filteredPeers" :key="peer._id">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-raised/60"
              @click="pick(peer)"
            >
              <div class="relative shrink-0">
                <div
                  class="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                  :style="{ backgroundColor: avatarColor(peer.name || peer.email) }"
                >
                  {{ initials(peer.name || peer.email) }}
                </div>
                <span
                  class="absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-panel"
                  :class="isOnline(peer._id) ? 'bg-emerald-500' : 'bg-line-strong'"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0 truncate">
                    <span class="truncate text-xs font-semibold text-ink">{{ peer.name || peer.email }}</span>
                    <span
                      v-if="peer.role"
                      class="shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase tracking-wider transition-all"
                      :class="roleBadgeClass(peer.role)"
                    >
                      {{ peer.role }}
                    </span>
                  </div>
                  <span
                    v-if="peer.unread"
                    class="shrink-0 rounded-full bg-accent px-1.5 py-0.2 font-mono text-[9px] font-bold text-on-accent shadow-xs"
                  >
                    {{ peer.unread }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-[11px] text-muted mt-0.5">
                  <span class="truncate">
                    <template v-if="peer.last">{{ peer.last.mine ? 'Vi: ' : '' }}{{ peer.last.body }}</template>
                    <template v-else class="capitalize">{{ peer.role }}</template>
                  </span>
                </div>
              </div>
            </button>
          </li>

          <li v-if="!filteredPeers.length" class="px-4 py-10 text-center text-xs text-muted">
            Nema pronađenih kolega.
          </li>
        </ul>
      </template>
    </div>

    <!-- Floating Chat Trigger Button -->
    <button
      type="button"
      class="group relative flex items-center gap-2 rounded-full border border-line-strong bg-ink px-4 py-2.5 text-xs font-semibold text-on-ink shadow-2xl transition-all duration-200 hover:bg-accent hover:scale-105 active:scale-95"
      @click="toggleWidget"
    >
      <IconChat class="text-base text-accent group-hover:text-on-ink transition-colors" />
      <span>Chat</span>

      <!-- Online live dot -->
      <span
        class="size-2 rounded-full"
        :class="connected ? 'bg-emerald-400' : 'bg-amber-400'"
      />

      <!-- Unread message counter badge -->
      <span
        v-if="totalUnread"
        class="flex size-5 items-center justify-center rounded-full bg-accent text-on-accent text-[10px] font-bold shadow-xs animate-bounce"
      >
        {{ totalUnread }}
      </span>
    </button>
  </div>
</template>
