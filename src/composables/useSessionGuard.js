import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';

/**
 * Keeps the dashboard session alive while somebody is working, and warns before
 * it ends when nobody is.
 *
 * AI-DECISION: the deadline is the token's own `exp`, not a timer counting
 * idle milliseconds. The two would drift apart the moment a laptop sleeps or a
 * second tab renews, and the one that actually signs you out is the token. So
 * this reads the real deadline and renews it; idleness is what happens when
 * nothing renews it.
 *
 * The consequence is the behaviour that was asked for: because activity renews,
 * the warning cannot appear while somebody is working. It only shows after
 * ~55 minutes in which nothing was clicked, typed or scrolled — so it never
 * interrupts an edit in progress.
 */

/** Warn once the session has this long left. */
const WARN_BEFORE_MS = 5 * 60 * 1000;

/**
 * Renew on activity only once this fraction of the token's life is spent, so a
 * busy hour costs a couple of small requests rather than one per click.
 *
 * A fraction rather than a fixed five minutes: it has to stay sensible whatever
 * STAFF_SESSION_MINUTES is set to, and a fixed threshold against a short session
 * leaves almost no window in which renewal can happen at all.
 */
const RENEW_AFTER_FRACTION = 0.5;

/**
 * What counts as being there.
 *
 * AI-TRAP: `mousemove` is deliberately absent. A nudged desk or a cat on the
 * keyboard tray would renew forever, and an unattended machine staying signed
 * in is the exact thing this is meant to prevent. These are all deliberate acts.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

export function useSessionGuard() {
  const auth = useAuthStore();

  const now = ref(Date.now());
  const dismissed = ref(false);
  const renewing = ref(false);

  let ticker = null;

  /** Milliseconds until the server stops accepting the token. */
  const msLeft = computed(() => {
    if (!auth.expiresAt) return null;
    return auth.expiresAt - now.value;
  });

  const expiringSoon = computed(() =>
    msLeft.value !== null && msLeft.value <= WARN_BEFORE_MS);

  const showWarning = computed(() =>
    auth.isAuthenticated && expiringSoon.value && msLeft.value > 0 && !dismissed.value);

  /** mm:ss, floored at zero so a late tick never renders a negative clock. */
  const countdown = computed(() => {
    const seconds = Math.max(0, Math.ceil((msLeft.value ?? 0) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  async function extend() {
    if (renewing.value) return;
    renewing.value = true;
    try {
      const ok = await auth.renew();
      if (ok) dismissed.value = false;
    } finally {
      renewing.value = false;
    }
  }

  /**
   * Milliseconds left, read from the clock rather than from `now`.
   *
   * `now` is refreshed by an interval, and a browser throttles those to about
   * once a minute in a tab that is not in front — fine for rendering a
   * countdown, up to a minute wrong for deciding whether to renew. Anything
   * with a deadline in it asks the clock.
   */
  const trueMsLeft = () => (auth.expiresAt ? auth.expiresAt - Date.now() : null);

  function onActivity() {
    if (!auth.isAuthenticated) return;

    const left = trueMsLeft();
    if (left === null) return;

    // Bring the visible countdown back in step; a throttled tab leaves it behind.
    now.value = Date.now();

    // Already gone: renewing is the server's business to refuse, and the 401
    // interceptor is what gets us back to the login screen.
    if (left <= 0) return expire();

    const span = auth.sessionLengthMs;
    if (span && span - left >= span * RENEW_AFTER_FRACTION) extend();
  }

  /** Woken up, switched back to: the countdown may be a minute behind. */
  function onVisible() {
    if (document.visibilityState === 'visible') onActivity();
  }

  function onStorage(event) {
    if (event.key === 'octava_staff_token') {
      auth.adoptStoredToken();
      dismissed.value = false;
    }
  }

  function tick() {
    now.value = Date.now();

    if (!auth.isAuthenticated || msLeft.value === null) return;

    if (msLeft.value <= 0) expire();
  }

  let expiring = false;

  /**
   * Sign out properly rather than leaving a dead token in localStorage for the
   * next person who opens the tab. Guarded, because the ticker and an activity
   * event can both reach this within the same second.
   */
  function expire() {
    if (expiring) return;
    expiring = true;
    auth.logout().finally(() => { window.location.href = '/login'; });
  }

  onMounted(() => {
    ticker = setInterval(tick, 1000);
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
  });

  onUnmounted(() => {
    clearInterval(ticker);
    for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
  });

  return {
    showWarning,
    countdown,
    renewing,
    extend,
    dismiss: () => { dismissed.value = true; }
  };
}
