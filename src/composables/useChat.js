import { ref, computed, watch } from 'vue';
import { io } from 'socket.io-client';
import client from '../api/client';
import { useAuthStore } from '../stores/auth';

/**
 * The desk chat: one socket for the whole dashboard, shared by every view.
 *
 * AI-DECISION: module scope, not per-component. A socket opened inside a
 * component is opened again on every mount and closed on every route change,
 * so presence flickers offline each time somebody navigates and the unread
 * badge in the header would need a second connection of its own.
 *
 * AI-TRAP: presence arrives twice — once as a full list over HTTP so the page
 * can render before the handshake finishes, and once from the socket. The
 * socket's version is authoritative and replaces the list rather than merging
 * into it; merging leaves anybody who went offline during the handshake showing
 * as online until they next connect.
 */

const socket = ref(null);
const connected = ref(false);
const peers = ref([]);
const online = ref(new Set());
const messages = ref([]);
const activeId = ref(null);
const loading = ref(false);

const me = ref(null);

/** True when the server refused the handshake rather than the network failing. */
const authFailed = ref(false);

let stopWatchingToken = null;

export const totalUnread = computed(() =>
  peers.value.reduce((sum, p) => sum + (p.unread || 0), 0));

async function loadPeers() {
  const { data } = await client.get('/chat/peers');
  me.value = data.me;
  peers.value = data.peers;
  // Seeded from HTTP so the list is not blank while the socket connects; the
  // socket overwrites this the moment it says hello.
  online.value = new Set(data.peers.filter((p) => p.online).map((p) => p._id));
}

function bump(peerId, patch) {
  const peer = peers.value.find((p) => p._id === peerId);
  if (peer) Object.assign(peer, patch);
}

function connect() {
  if (socket.value) return;

  const auth = useAuthStore();
  const token = auth.token || localStorage.getItem('octava_staff_token');
  if (!token) return;

  // Same origin: /socket.io is proxied to the API in dev and served beside it
  // in production, exactly as /api is.
  const s = io({ path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });

  s.on('connect', () => { connected.value = true; authFailed.value = false; });
  s.on('disconnect', () => { connected.value = false; });

  /**
   * AI-TRAP: a refused handshake is not a network problem and must not be
   * retried like one. socket.io reconnects forever with the credentials it was
   * given, and the credential is exactly what the server rejected — so an
   * expired token becomes an invisible loop of failures behind a status dot
   * that only says "no connection". Stop, and say which of the two it was.
   */
  s.on('connect_error', (err) => {
    connected.value = false;
    if (String(err?.message) === 'unauthorized') {
      // Another tab may have renewed in the meantime; take its token first.
      auth.adoptStoredToken();
      if (auth.token && auth.token !== s.auth.token) {
        s.auth.token = auth.token;
        return;
      }
      authFailed.value = true;
      s.disconnect();
    }
  });

  /**
   * The socket has to follow the token, and nothing else makes it.
   *
   * AI-TRAP: socket.io reads `auth` once, at the handshake. useSessionGuard
   * renews the session on activity, so after a renewal the open socket is still
   * holding the token it was born with — fine while it stays open, and fatal
   * the moment anything makes it reconnect, because it presents a token the
   * server stopped accepting days ago. Reconnecting deliberately on the change
   * is what keeps the two in step; the session guard is not going to tell it.
   */
  stopWatchingToken = watch(() => auth.token, (fresh) => {
    if (!fresh) return disconnect();
    if (fresh === s.auth.token) return;

    s.auth.token = fresh;
    authFailed.value = false;
    s.disconnect();
    s.connect();
  });

  s.on('presence:state', ({ online: ids }) => { online.value = new Set(ids); });

  s.on('presence:change', ({ staff, online: isOnline }) => {
    const next = new Set(online.value);
    if (isOnline) next.add(staff); else next.delete(staff);
    // Replaced rather than mutated: a Set changed in place is the same object
    // and Vue has nothing to notice.
    online.value = next;
  });

  s.on('chat:message', (message) => {
    const other = message.from === me.value ? message.to : message.from;

    if (other === activeId.value) {
      messages.value.push(message);
      // Read on arrival only while the thread is actually open on screen.
      if (message.from !== me.value) s.emit('chat:read', { with: other });
    } else if (message.from !== me.value) {
      const peer = peers.value.find((p) => p._id === other);
      if (peer) peer.unread = (peer.unread || 0) + 1;
    }

    bump(other, { last: { body: message.body, at: message.createdAt, mine: message.from === me.value } });
  });

  s.on('chat:read', ({ by }) => {
    for (const m of messages.value) {
      if (m.to === by && !m.readAt) m.readAt = new Date().toISOString();
    }
  });

  socket.value = s;
}

function disconnect() {
  stopWatchingToken?.();
  stopWatchingToken = null;

  socket.value?.disconnect();
  socket.value = null;
  connected.value = false;
  online.value = new Set();
}

async function openThread(peerId) {
  activeId.value = peerId;
  messages.value = [];
  loading.value = true;

  try {
    const { data } = await client.get(`/chat/with/${peerId}`, { params: { limit: 100 } });
    messages.value = data.messages;
    socket.value?.emit('chat:read', { with: peerId });
    bump(peerId, { unread: 0 });
  } finally {
    loading.value = false;
  }
}

/** Resolves to an error string, or null when the message was accepted. */
function send(body) {
  const text = body.trim();
  if (!text || !activeId.value || !socket.value) return Promise.resolve('Nema veze sa serverom.');

  return new Promise((resolve) => {
    socket.value.emit('chat:send', { to: activeId.value, body: text }, (reply) => {
      resolve(reply?.error || null);
    });
  });
}

export function useChat() {
  return {
    connected, authFailed, peers, online, messages, activeId, loading, me, totalUnread,
    connect, disconnect, loadPeers, openThread, send,
    isOnline: (id) => online.value.has(id)
  };
}
