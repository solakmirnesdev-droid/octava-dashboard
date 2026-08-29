<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, useTemplateRef } from 'vue';
import { useChat } from '../composables/useChat';
import { useToasts } from '../composables/useToasts';
import { initials, avatarColor, roleBadgeClass } from '../utils/avatar';
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

const {
  connected, authFailed, peers, messages, activeId, loading, me,
  connect, loadPeers, openThread, send, isOnline
} = useChat();

const toasts = useToasts();
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

async function pick(peer) {
  await openThread(peer._id);
  toBottom();
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

  // Bold: **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  escaped = escaped.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Strikethrough: ~~text~~
  escaped = escaped.replace(/~~(.+?)~~/g, '<del class="opacity-75">$1</del>');
  // Inline code: `text`
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="rounded bg-black/20 px-1 py-0.5 font-mono text-[11px]">$1</code>');
  // Chords: [Am]
  escaped = escaped.replace(/\[([A-H][#b]?[^\]]*)\]/g, '<span class="inline-block rounded bg-black/20 border border-current/30 px-1 py-0.2 text-[11px] font-bold font-mono">$1</span>');
  // URLs: https://...
  escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline hover:opacity-80 break-all font-medium">$1</a>');

  return escaped;
}

const time = (at) => new Date(at).toLocaleTimeString('bs', { hour: '2-digit', minute: '2-digit' });
const day = (at) => new Date(at).toLocaleDateString('bs', { day: 'numeric', month: 'short' });

onMounted(async () => {
  connect();
  try {
    await loadPeers();
  } catch {
    toasts.error('Spisak sagovornika nije učitan.');
  }
});

onBeforeUnmount(() => {});
</script>

<template>
  <div class="space-y-4">
    <!-- Top Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
          Uredništvo / Poruke
        </h1>
        <p class="text-xs text-muted mt-0.5">Interna komunikacija i razmjena poruka među urednicima</p>
      </div>

      <div class="flex items-center gap-2">
        <!--
          Three states, not two. A refused handshake shown as "Povezivanje…"
          sends somebody to check their wifi for a problem the server already
          decided: the token expired. It never resolves, because socket.io was
          told to stop retrying credentials the server rejected.
        -->
        <span
          class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="authFailed
            ? 'bg-danger-soft text-danger'
            : connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'"
        >
          <span
            class="size-2 rounded-full"
            :class="authFailed
              ? 'bg-danger'
              : connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
          />
          {{ authFailed
            ? 'Sesija je istekla — prijavi se ponovo'
            : connected ? 'Povezan u realnom vremenu' : 'Povezivanje…' }}
        </span>
      </div>
    </div>

    <!-- Main Chat Workspace -->
    <div class="grid gap-4 lg:grid-cols-12">

      <!-- Left Sidebar: Colleagues list -->
      <aside class="flex flex-col rounded-xl border border-line bg-panel shadow-sm lg:col-span-4 h-[36rem] overflow-hidden">
        <!-- Search Colleagues -->
        <div class="p-3 border-b border-line-soft">
          <div class="relative">
            <IconSearch class="absolute left-2.5 top-2.5 text-xs text-muted" />
            <input
              v-model="searchPeer"
              type="text"
              placeholder="Pretraži kolege…"
              class="w-full rounded-lg border border-line-strong bg-surface py-1.5 pl-8 pr-3 text-xs outline-none focus:border-accent"
            />
          </div>
        </div>

        <!-- Peer list -->
        <ul class="divide-y divide-line-soft flex-1 overflow-y-auto">
          <li v-for="peer in filteredPeers" :key="peer._id">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-raised/60"
              :class="peer._id === activeId ? 'bg-accent-soft/70 border-l-3 border-accent' : ''"
              @click="pick(peer)"
            >
              <!-- Colleague Avatar -->
              <div class="relative shrink-0">
                <div
                  class="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                  :style="{ backgroundColor: avatarColor(peer.name || peer.email) }"
                >
                  {{ initials(peer.name || peer.email) }}
                </div>
                <span
                  class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-panel"
                  :class="isOnline(peer._id) ? 'bg-emerald-500' : 'bg-line-strong'"
                  :title="isOnline(peer._id) ? 'Na vezi' : 'Nije na vezi'"
                />
              </div>

              <!-- Info -->
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
                    class="shrink-0 rounded-full bg-accent px-1.5 py-0.2 font-mono text-[10px] font-bold text-on-accent shadow-xs"
                  >
                    {{ peer.unread }}
                  </span>
                </div>

                <div class="flex items-center justify-between text-[11px] text-muted mt-0.5">
                  <span class="truncate">
                    <template v-if="peer.last">{{ peer.last.mine ? 'Vi: ' : '' }}{{ peer.last.body }}</template>
                    <template v-else class="capitalize">{{ peer.role }}</template>
                  </span>
                  <span
                    class="size-1.5 rounded-full shrink-0 ml-1"
                    :class="isOnline(peer._id) ? 'bg-emerald-500' : 'bg-transparent'"
                  />
                </div>
              </div>
            </button>
          </li>

          <li v-if="!filteredPeers.length" class="px-4 py-12 text-center text-xs text-muted">
            Nema pronađenih kolega u uredništvu.
          </li>
        </ul>
      </aside>

      <!-- Right Column: Conversation Box -->
      <section class="flex flex-col rounded-xl border border-line bg-panel shadow-sm lg:col-span-8 h-[36rem] overflow-hidden">
        <template v-if="active">
          <!-- Active Conversation Header -->
          <header class="flex items-center justify-between border-b border-line-soft bg-raised/30 px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="relative shrink-0">
                <div
                  class="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                  :style="{ backgroundColor: avatarColor(active.name || active.email) }"
                >
                  {{ initials(active.name || active.email) }}
                </div>
                <span
                  class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-panel"
                  :class="isOnline(active._id) ? 'bg-emerald-500' : 'bg-line-strong'"
                />
              </div>

              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-sm font-bold text-ink leading-none">{{ active.name || active.email }}</h2>
                  <span
                    v-if="active.role"
                    class="rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase tracking-wider transition-all"
                    :class="roleBadgeClass(active.role)"
                  >
                    {{ active.role }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="text-[11px]" :class="isOnline(active._id) ? 'text-emerald-500 font-medium' : 'text-muted'">
                    {{ isOnline(active._id) ? 'na vezi' : 'nije na vezi' }}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <!-- Messages Stream -->
          <div ref="scroller" class="flex-1 space-y-3 overflow-y-auto p-4 bg-surface/50">
            <div v-if="loading" class="flex items-center justify-center py-12 text-xs text-muted">
              <div class="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2" />
              Učitavam poruke…
            </div>

            <div v-else-if="!messages.length" class="flex flex-col items-center justify-center py-16 text-center text-xs text-muted">
              <span class="text-2xl mb-2">👋</span>
              <p class="font-semibold text-ink">Nema prethodnih poruka</p>
              <p class="text-faint max-w-xs mt-0.5">Započnite razgovor sa kolegom {{ active.name || active.email }}.</p>
            </div>

            <!-- Message Bubbles -->
            <div
              v-for="m in messages"
              :key="m._id"
              class="flex"
              :class="m.from === me ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs"
                :class="[
                  m.from === me
                    ? 'rounded-br-xs bg-accent text-on-accent'
                    : 'rounded-bl-xs bg-panel border border-line text-ink'
                ]"
              >
                <!-- Rendered Markdown Body with formatting & links -->
                <div
                  class="whitespace-pre-wrap break-words leading-relaxed"
                  v-html="renderMessage(m.body)"
                />

                <!-- Timestamp & Read Status -->
                <div
                  class="mt-1 flex items-center justify-end gap-1 font-mono text-[10px] opacity-75"
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

          <!-- Bottom Message Input Composer -->
          <div class="border-t border-line-soft bg-panel p-3">
            <!-- Formatting & Emoji Toolbar -->
            <div class="mb-2 flex flex-wrap items-center justify-between gap-1 text-muted">
              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                  title="Podebljano (**tekst**)"
                  @click="applyWrap('**', '**')"
                >
                  <IconBold class="text-sm" />
                </button>

                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                  title="Kurziv (*tekst*)"
                  @click="applyWrap('*', '*')"
                >
                  <IconItalic class="text-sm" />
                </button>

                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                  title="Precrtano (~~tekst~~)"
                  @click="applyWrap('~~', '~~')"
                >
                  <IconStrikethrough class="text-sm" />
                </button>

                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                  title="Kod (`kod`)"
                  @click="applyWrap('`', '`')"
                >
                  <IconCode class="text-sm" />
                </button>

                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                  title="Akord ([Am])"
                  @click="applyWrap('[', ']')"
                >
                  <IconMusic class="text-xs text-accent" />
                </button>

                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-ink transition"
                  title="Link [tekst](url)"
                  @click="applyWrap('[', '](https://)')"
                >
                  <IconLink class="text-sm" />
                </button>
              </div>

              <!-- Emoji Popover Toggle -->
              <div class="relative">
                <button
                  type="button"
                  class="flex size-7 items-center justify-center rounded hover:bg-raised hover:text-accent transition"
                  :class="showEmojiPicker && 'bg-raised text-accent'"
                  title="Umetni emoji"
                  @click="showEmojiPicker = !showEmojiPicker"
                >
                  <IconEmoji class="text-base" />
                </button>

                <!-- Emoji Picker Panel -->
                <div
                  v-if="showEmojiPicker"
                  class="absolute bottom-9 right-0 z-30 grid grid-cols-6 gap-1 rounded-xl border border-line-strong bg-panel p-2 shadow-2xl backdrop-blur-md w-48"
                >
                  <button
                    v-for="e in EMOJIS"
                    :key="e"
                    type="button"
                    class="flex size-7 items-center justify-center rounded hover:bg-raised hover:scale-125 transition text-base"
                    @click="insertEmoji(e)"
                  >
                    {{ e }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Input Box & Send Button -->
            <form class="flex items-end gap-2" @submit.prevent="submit">
              <textarea
                ref="textareaRef"
                v-model="draft"
                rows="2"
                placeholder="Napišite poruku (podržava **bold**, *italic*, [akorde], linkove)…"
                class="max-h-32 flex-1 resize-y rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs outline-none focus:border-accent leading-relaxed"
                @keydown.enter.exact.prevent="submit"
              />

              <button
                type="submit"
                class="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-40 shadow-xs shrink-0"
                :disabled="!draft.trim() || sending || !connected"
              >
                <IconSend class="text-sm" />
                <span>{{ sending ? 'Šaljem…' : 'Pošalji' }}</span>
              </button>
            </form>

            <div class="mt-1 flex items-center justify-between text-[10px] text-faint">
              <span><strong>Enter</strong> za slanje · <strong>Shift + Enter</strong> za novi red</span>
              <span v-if="draft.length">{{ draft.length }} znakova</span>
            </div>
          </div>
        </template>

        <!-- No Peer Selected Placeholder -->
        <div v-else class="flex flex-1 flex-col items-center justify-center text-center p-8 text-xs text-muted">
          <div class="flex size-14 items-center justify-center rounded-full bg-raised text-muted mb-3">
            <IconSend class="text-2xl text-accent" />
          </div>
          <p class="font-semibold text-sm text-ink">Odaberite sagovornika</p>
          <p class="text-faint max-w-xs mt-1">Kliknite na člana uredništva sa lijeve strane za početak razgovora.</p>
        </div>
      </section>
    </div>
  </div>
</template>
