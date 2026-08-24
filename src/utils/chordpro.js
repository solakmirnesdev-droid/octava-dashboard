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
/**
 * Conventional spelling for every key, following the circle of fifths.
 *
 * Transposing by pitch alone is not enough: A#, D# and G# are correct pitches
 * but nobody writes a chart in them. Db is five flats where C# is seven sharps,
 * so Db wins; C#m is four sharps where Dbm is eight flats, so C#m wins. The two
 * tables below encode which spelling a musician actually expects.
 */
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

/** Keys whose signature is written with flats. Everything else uses sharps. */
const FLAT_KEYS = new Set([
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'
]);

/** Splits a key name into its pitch class and mode. */
function parseKey(key) {
  const match = /^([A-H][#b]?)(m(?!aj))?$/.exec((key || '').trim());
  if (!match) return null;

  const [, root, minor] = match;
  const index = noteToIndex(root[0], root[1] || '');
  if (index === -1) return null;

  return { pitchClass: index, isMinor: Boolean(minor) };
}

/** The correctly spelled key you land in after shifting by N semitones. */
export function transposeKey(key, semitones) {
  const parsed = parseKey(key);
  if (!parsed) return key;

  const target = (((parsed.pitchClass + semitones) % 12) + 12) % 12;
  return parsed.isMinor ? MINOR_KEYS[target] : MAJOR_KEYS[target];
}

/** Whether a chart in this key should be written with flats. */
export function prefersFlats(key) {
  return FLAT_KEYS.has((key || '').trim());
}

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

/**
 * Transposes every chord in a song, spelling the result to match the key it
 * lands in rather than defaulting to sharps.
 *
 * @param {string} content     ChordPro-style song body
 * @param {number} semitones   the shift to apply
 * @param {string} [originalKey] the song's own key, used to work out the
 *                               destination key and therefore the spelling
 */
export function transposeContent(content, semitones, originalKey) {
  if (!content) return content;

  const shift = ((semitones % 12) + 12) % 12;
  if (shift === 0) return content;

  const targetKey = originalKey ? transposeKey(originalKey, semitones) : null;
  // With no key to go on, descending reads more naturally in flats.
  const preferFlats = targetKey ? prefersFlats(targetKey) : semitones < 0;

  return content.replace(CHORD_TOKEN, (token, inner) => {
    if (!inner.trim()) return token;
    return '[' + transposeChord(inner, shift, preferFlats) + ']';
  });
}
