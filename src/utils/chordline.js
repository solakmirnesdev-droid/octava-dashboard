/**
 * Mapping between a stored ChordPro line and the plain text a worker sees.
 *
 * The two indexes are not the same. In "[Am]tekst [F]ovdje" the letter "o" is
 * at index 6 on screen but index 13 in the source, because the bracket tokens
 * occupy space in one and not the other.
 *
 * AI-NOTE: that 13 was documented as 14 until a test pinned it down. Count it
 * out rather than trusting the prose: [Am] is 0-3, tekst 4-8, the space 9,
 * [F] 10-12, so "o" lands on 13. Every click-to-place operation has to
 * translate between them or chords land in the wrong place.
 */

/** Splits a source line into its visible text and the chords sitting over it. */
export function parseLine(source) {
  const chords = [];
  let plain = '';
  let i = 0;

  while (i < source.length) {
    if (source[i] === '[') {
      const end = source.indexOf(']', i);
      if (end !== -1) {
        chords.push({
          chord: source.slice(i + 1, end),
          column: plain.length,      // where it sits in the visible text
          sourceStart: i,
          sourceEnd: end + 1
        });
        i = end + 1;
        continue;
      }
    }
    plain += source[i];
    i++;
  }

  return { plain, chords };
}

/** Translates a column in the visible text to an index in the source. */
export function columnToSource(source, column) {
  let seen = 0;
  let i = 0;

  while (i < source.length && seen < column) {
    if (source[i] === '[') {
      const end = source.indexOf(']', i);
      if (end !== -1) { i = end + 1; continue; }
    }
    seen++;
    i++;
  }

  // Land after any chord already parked at this column, so a second chord
  // placed on the same syllable follows the first instead of splitting it.
  while (source[i] === '[') {
    const end = source.indexOf(']', i);
    if (end === -1) break;
    i = end + 1;
  }

  return i;
}

export function insertChord(source, column, chord) {
  const at = columnToSource(source, column);
  return source.slice(0, at) + '[' + chord + ']' + source.slice(at);
}

export function replaceChord(source, chordIndex, chord) {
  const { chords } = parseLine(source);
  const target = chords[chordIndex];
  if (!target) return source;

  return source.slice(0, target.sourceStart) + '[' + chord + ']' + source.slice(target.sourceEnd);
}

export function removeChord(source, chordIndex) {
  const { chords } = parseLine(source);
  const target = chords[chordIndex];
  if (!target) return source;

  return source.slice(0, target.sourceStart) + source.slice(target.sourceEnd);
}
