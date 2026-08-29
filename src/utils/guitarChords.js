/**
 * Guitar chord dictionary covering Ex-Yu notation (H, Hm, A#, etc.)
 * Frets are represented as [String6(E), String5(A), String4(D), String3(G), String2(B), String1(e)].
 * Values: -1 (muted / X), 0 (open / O), 1..N (fret number).
 */

export const GUITAR_CHORDS = {
  // Major chords
  'C':     { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
  'C#':    { frets: [-1, 4, 3, 1, 2, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'Db':    { frets: [-1, 4, 3, 1, 2, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'D':     { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  'D#':    { frets: [-1, -1, 1, 3, 4, 3], baseFret: 1 },
  'Eb':    { frets: [-1, -1, 1, 3, 4, 3], baseFret: 1 },
  'E':     { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  'F':     { frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: { from: 1, to: 6, fret: 1 } },
  'F#':    { frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: { from: 1, to: 6, fret: 2 } },
  'Gb':    { frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: { from: 1, to: 6, fret: 2 } },
  'G':     { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
  'G#':    { frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: { from: 1, to: 6, fret: 4 } },
  'Ab':    { frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: { from: 1, to: 6, fret: 4 } },
  'A':     { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  'A#':    { frets: [-1, 1, 3, 3, 3, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'Bb':    { frets: [-1, 1, 3, 3, 3, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'H':     { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },
  'B':     { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } }, // Ex-Yu H mapping

  // Minor chords
  'Cm':    { frets: [-1, 3, 5, 5, 4, 3], baseFret: 3, barre: { from: 1, to: 5, fret: 3 } },
  'C#m':   { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4, barre: { from: 1, to: 5, fret: 4 } },
  'Dbm':   { frets: [-1, 4, 6, 6, 5, 4], baseFret: 4, barre: { from: 1, to: 5, fret: 4 } },
  'Dm':    { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
  'D#m':   { frets: [-1, -1, 1, 3, 4, 2], baseFret: 1 },
  'Ebm':   { frets: [-1, -1, 1, 3, 4, 2], baseFret: 1 },
  'Em':    { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
  'Fm':    { frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: { from: 1, to: 6, fret: 1 } },
  'F#m':   { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: { from: 1, to: 6, fret: 2 } },
  'Gbm':   { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: { from: 1, to: 6, fret: 2 } },
  'Gm':    { frets: [3, 5, 5, 3, 3, 3], baseFret: 3, barre: { from: 1, to: 6, fret: 3 } },
  'G#m':   { frets: [4, 6, 6, 4, 4, 4], baseFret: 4, barre: { from: 1, to: 6, fret: 4 } },
  'Abm':   { frets: [4, 6, 6, 4, 4, 4], baseFret: 4, barre: { from: 1, to: 6, fret: 4 } },
  'Am':    { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
  'A#m':   { frets: [-1, 1, 3, 3, 2, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'Bbm':   { frets: [-1, 1, 3, 3, 2, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'Hm':    { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },
  'Bm':    { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },

  // Dominant 7th chords
  'C7':    { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  'C#7':   { frets: [-1, 4, 3, 4, 2, -1], baseFret: 1 },
  'D7':    { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
  'D#7':   { frets: [-1, -1, 1, 3, 2, 3], baseFret: 1 },
  'E7':    { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  'F7':    { frets: [1, 3, 1, 2, 1, 1], baseFret: 1, barre: { from: 1, to: 6, fret: 1 } },
  'F#7':   { frets: [2, 4, 2, 3, 2, 2], baseFret: 2, barre: { from: 1, to: 6, fret: 2 } },
  'G7':    { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  'G#7':   { frets: [4, 6, 4, 5, 4, 4], baseFret: 4, barre: { from: 1, to: 6, fret: 4 } },
  'A7':    { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], baseFret: 1 },
  'A#7':   { frets: [-1, 1, 3, 1, 3, 1], baseFret: 1, barre: { from: 1, to: 5, fret: 1 } },
  'H7':    { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },
  'B7':    { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },

  // Minor 7th chords
  'Cm7':   { frets: [-1, 3, 5, 3, 4, 3], baseFret: 3, barre: { from: 1, to: 5, fret: 3 } },
  'C#m7':  { frets: [-1, 4, 6, 4, 5, 4], baseFret: 4, barre: { from: 1, to: 5, fret: 4 } },
  'Dm7':   { frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },
  'Em7':   { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], baseFret: 1 },
  'Fm7':   { frets: [1, 3, 1, 1, 1, 1], baseFret: 1, barre: { from: 1, to: 6, fret: 1 } },
  'F#m7':  { frets: [2, 4, 2, 2, 2, 2], baseFret: 2, barre: { from: 1, to: 6, fret: 2 } },
  'Gm7':   { frets: [3, 5, 3, 3, 3, 3], baseFret: 3, barre: { from: 1, to: 6, fret: 3 } },
  'Am7':   { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], baseFret: 1 },
  'Hm7':   { frets: [-1, 2, 4, 2, 3, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },
  'Bm7':   { frets: [-1, 2, 4, 2, 3, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },

  // Major 7th chords
  'Cmaj7': { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], baseFret: 1 },
  'Dmaj7': { frets: [-1, -1, 0, 2, 2, 2], baseFret: 1 },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0], baseFret: 1 },
  'Fmaj7': { frets: [-1, -1, 3, 2, 1, 0], baseFret: 1 },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2], baseFret: 1 },
  'Amaj7': { frets: [-1, 0, 2, 1, 2, 0], baseFret: 1 },
  'Hmaj7': { frets: [-1, 2, 4, 3, 4, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },
  'Bmaj7': { frets: [-1, 2, 4, 3, 4, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } },

  // Suspended chords
  'Dsus4': { frets: [-1, -1, 0, 2, 3, 3], baseFret: 1 },
  'Esus4': { frets: [0, 2, 2, 2, 0, 0], baseFret: 1 },
  'Asus4': { frets: [-1, 0, 2, 2, 3, 0], baseFret: 1 },
  'Gsus4': { frets: [3, 3, 0, 0, 1, 3], baseFret: 1 },
  'Dsus2': { frets: [-1, -1, 0, 2, 3, 0], baseFret: 1 },
  'Asus2': { frets: [-1, 0, 2, 2, 0, 0], baseFret: 1 },
  'Hsus4': { frets: [-1, 2, 4, 4, 5, 2], baseFret: 2, barre: { from: 1, to: 5, fret: 2 } }
};

/**
 * Normalises chord name (e.g. cleans slash chords like Am/G -> Am, B -> H if wanted, etc.)
 */
export function getChordData(chordName) {
  if (!chordName) return null;
  const clean = chordName.trim();
  // Check exact
  if (GUITAR_CHORDS[clean]) return GUITAR_CHORDS[clean];

  // Try stripping bass note: e.g. "Am/G" -> "Am"
  const rootOnly = clean.split('/')[0];
  if (GUITAR_CHORDS[rootOnly]) return GUITAR_CHORDS[rootOnly];

  // Map American B to Ex-Yu H or vice-versa
  if (rootOnly.startsWith('B') && !rootOnly.startsWith('Bb')) {
    const asH = 'H' + rootOnly.slice(1);
    if (GUITAR_CHORDS[asH]) return GUITAR_CHORDS[asH];
  }

  return null;
}
