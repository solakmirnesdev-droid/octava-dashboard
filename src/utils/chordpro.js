/**
 * Client-side ChordPro parsing, mirroring the backend's src/utils/chords.js.
 *
 * A song body is one string with chord tokens inline, in brackets, at the
 * syllable where the change lands:
 *
 *   [Am]lyric goes [F]here
 *
 * Parsing it here rather than server-side lets transposition feel instant.
 */

const CHORD_TOKEN = /\[([^\]]*)\]/g;
const CHORD_SHAPE = /^([A-H])([#b]?)([^/]*)(?:\/([A-H])([#b]?))?$/;
const CHORD_SUFFIX = /^(?:maj|min|m|M|dim|aug|sus|add|alt|°|ø|Δ|\+|-|[0-9#b()])*$/;

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

function noteToIndex(letter, accidental) {
  if (letter === 'H') return SHARP_SCALE.indexOf('B');
  let base = SHARP_SCALE.indexOf(letter);
  if (base === -1) return -1;
  if (accidental === '#') base += 1;
  else if (accidental === 'b') base -= 1;
  return ((base % 12) + 12) % 12;
}

/** True for real chords, false for section markers like [Chorus] or [Refren]. */
export function isChord(symbol) {
  const match = CHORD_SHAPE.exec(symbol.trim());
  if (!match) return false;
  const [, letter, accidental, suffix] = match;
  if (suffix && !CHORD_SUFFIX.test(suffix)) return false;
  return noteToIndex(letter, accidental) !== -1;
}

export function transposeChord(chord, semitones, preferFlats = false) {
  const match = CHORD_SHAPE.exec(chord.trim());
  if (!match) return chord;

  const [, letter, accidental, suffix, bassLetter, bassAccidental] = match;
  if (suffix && !CHORD_SUFFIX.test(suffix)) return chord;

  const rootIndex = noteToIndex(letter, accidental);
  if (rootIndex === -1) return chord;

  const scale = preferFlats ? FLAT_SCALE : SHARP_SCALE;
  const at = (i) => scale[(((i + semitones) % 12) + 12) % 12];

  let out = at(rootIndex) + (suffix || '');

  if (bassLetter) {
    const bassIndex = noteToIndex(bassLetter, bassAccidental);
    if (bassIndex !== -1) out += '/' + at(bassIndex);
  }
  return out;
}

/**
 * Split a song body into lines, each a list of { chord, text } pairs.
 * A pair holds the chord that starts at that point and the lyric that follows
 * it, which is exactly what the two-row rendering needs.
 */
export function parseSong(content) {
  if (!content) return [];

  return content.split('\n').map((line) => {
    // A line that is only a section marker becomes a heading rather than a row.
    const heading = line.trim().match(/^\[([^\]]+)\]$/);
    if (heading && !isChord(heading[1])) {
      return { type: 'section', label: heading[1] };
    }

    const segments = [];
    let cursor = 0;
    let pending = null;

    for (const match of line.matchAll(CHORD_TOKEN)) {
      const before = line.slice(cursor, match.index);
      if (before || pending) segments.push({ chord: pending, text: before });
      pending = match[1].trim();
      cursor = match.index + match[0].length;
    }

    const tail = line.slice(cursor);
    if (tail || pending) segments.push({ chord: pending, text: tail });

    return { type: 'line', segments };
  });
}

/** Every distinct chord in a song, in order of first appearance. */
export function extractChords(content) {
  if (!content) return [];
  const seen = new Set();
  for (const match of content.matchAll(CHORD_TOKEN)) {
    const symbol = match[1].trim();
    if (symbol && isChord(symbol)) seen.add(symbol);
  }
  return [...seen];
}

export function transposeContent(content, semitones, targetKey) {
  if (!content) return content;
  const shift = ((semitones % 12) + 12) % 12;
  if (shift === 0) return content;

  const preferFlats = targetKey ? FLAT_KEYS.has(targetKey) : false;
  return content.replace(CHORD_TOKEN, (token, inner) => {
    if (!inner.trim()) return token;
    return '[' + transposeChord(inner, shift, preferFlats) + ']';
  });
}
