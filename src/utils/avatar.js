/**
 * Stand-in portraits for artists with no photograph.
 *
 * AI-DECISION: initials in a colour drawn from the name, not a generic icon.
 * All 139 artists shared one grey silhouette, so a list of them read as a page
 * that had failed to load rather than a catalogue. Initials make each row
 * recognisable at a glance and cost nothing to serve.
 *
 * The palette is fixed rather than a free hue, because an arbitrary hue lands
 * on colours that fight the terracotta accent. These eight are muted and warm
 * enough to sit beside it. See AI-NOTES.md §4.
 */

const PALETTE = [
  '#b4472f', // the accent itself
  '#a8664a', // clay
  '#8a5a72', // plum
  '#5b7186', // slate
  '#7d8257', // olive
  '#b08442', // ochre
  '#6d8c76', // sage
  '#9c5433'  // rust
];

/**
 * Up to two initials.
 *
 * Bands keep their first two words ("Riblja Čorba" gives RČ) and single names
 * give one letter rather than a padded pair.
 */
export function initials(name) {
  if (!name) return '?';
  const clean = String(name).replace(/^[(\["'„«\s]+/, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const firstLetters = words
    .slice(0, 2)
    .map((w) => {
      const pure = w.replace(/^[^a-zA-Z0-9čćđšžČĆĐŠŽ]+/, '');
      return (pure && pure[0]) || w[0] || '';
    })
    .filter(Boolean)
    .join('');
  return (firstLetters || clean.slice(0, 2) || '?').toUpperCase();
}

/**
 * A stable colour for a name.
 *
 * AI-TRAP: this must stay a pure function of the name. Keying it on the id or
 * on list order would repaint an artist every time the data is reseeded, and
 * people recognise these by colour before they read them.
 */
export function avatarColor(name) {
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Inline style for the fallback circle: rich gradient ground, crisp white letters. */
export function avatarStyle(name) {
  const color = avatarColor(name);
  return {
    background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 75%, black))`,
    color: '#ffffff'
  };
}

/** Consistent badge style for user roles: superadmin (warn), admin (accent), moderator/worker (muted). */
export function roleBadgeClass(role) {
  switch (role) {
    case 'superadmin':
      return 'border border-warn/40 bg-warn-soft text-warn font-mono';
    case 'admin':
      return 'border border-accent/40 bg-accent-soft text-accent font-mono';
    case 'moderator':
    case 'worker':
    default:
      return 'border border-line bg-raised text-muted font-mono';
  }
}

