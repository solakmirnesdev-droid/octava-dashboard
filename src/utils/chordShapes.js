/**
 * Movable chord shapes — the forms guitarists actually reach for.
 *
 * AI-DECISION: the search in chordEngine.js finds every playable voicing, but
 * "playable" and "the one people expect" are different things. Scoring alone
 * kept picking thin three-string shapes over the standard barre for F, Hm and
 * F#m, and no amount of weight-tuning fixed both at once without breaking C or
 * G. So the expected shape is stated outright and the search fills in around it.
 *
 * A shape is offsets from the root fret. Placed at fret 0 it becomes the open
 * chord, so E-shape at 0 is E and A-shape at 0 is A — open and barre forms are
 * one definition, not two. Strings sitting at offset 0 are open when the shape
 * sits at the nut and barred everywhere else.
 */

/** offsets: low E to high E, null = muted. root: string carrying the root. */
const MOVABLE = {
  // Root on the sixth string — the E family.
  E: {
    root: 0,
    forms: {
      '':      [0, 2, 2, 1, 0, 0],
      'm':     [0, 2, 2, 0, 0, 0],
      '7':     [0, 2, 0, 1, 0, 0],
      'm7':    [0, 2, 0, 0, 0, 0],
      'maj7':  [0, 2, 1, 1, 0, 0],
      '6':     [0, 2, 2, 1, 2, 0],
      'm6':    [0, 2, 2, 0, 2, 0],
      'sus4':  [0, 2, 2, 2, 0, 0],
      'sus2':  [0, 2, 4, 4, 0, 0],
      '7sus4': [0, 2, 0, 2, 0, 0],
      '9':     [0, 2, 0, 1, 0, 2],
      'm9':    [0, 2, 0, 0, 0, 2],
      'add9':  [0, 2, 4, 1, 0, 0],
      '5':     [0, 2, 2, null, null, null],
      'aug':   [0, 3, 2, 1, 1, 0],
      'dim7':  [0, 1, 2, 0, 2, null],
      'm7b5':  [0, 1, 0, 0, null, null],
      '7#5':   [0, 3, 0, 1, 1, 0],
      'mmaj7': [0, 2, 1, 0, 0, 0],
      '7b9':   [0, 2, 0, 1, 0, 1],
    }
  },
  // Root on the fifth string — the A family.
  A: {
    root: 1,
    forms: {
      '':      [null, 0, 2, 2, 2, 0],
      'm':     [null, 0, 2, 2, 1, 0],
      '7':     [null, 0, 2, 0, 2, 0],
      'm7':    [null, 0, 2, 0, 1, 0],
      'maj7':  [null, 0, 2, 1, 2, 0],
      '6':     [null, 0, 2, 2, 2, 2],
      'm6':    [null, 0, 2, 2, 1, 2],
      'sus4':  [null, 0, 2, 2, 3, 0],
      'sus2':  [null, 0, 2, 2, 0, 0],
      '7sus4': [null, 0, 2, 0, 3, 0],
      '9':     [null, 0, 2, 4, 2, 3],
      'm9':    [null, 0, 2, 4, 1, 3],
      'add9':  [null, 0, 2, 4, 2, 0],
      '5':     [null, 0, 2, null, null, null],
      'aug':   [null, 0, 3, 2, 2, 1],
      'm7b5':  [null, 0, 1, 0, 1, null],
      '7#5':   [null, 0, 3, 0, 2, 1],
      'mmaj7': [null, 0, 2, 1, 1, 0],
      '13':    [null, 0, 2, 0, 2, 2]
    }
  },
  // Root on the fourth string — the D family, for the top of the neck.
  D: {
    root: 2,
    forms: {
      '':      [null, null, 0, 2, 3, 2],
      'm':     [null, null, 0, 2, 3, 1],
      '7':     [null, null, 0, 2, 1, 2],
      'm7':    [null, null, 0, 2, 1, 1],
      'maj7':  [null, null, 0, 2, 2, 2],
      '6':     [null, null, 0, 2, 0, 2],
      'm6':    [null, null, 0, 2, 0, 1],
      'sus4':  [null, null, 0, 2, 3, 3],
      'sus2':  [null, null, 0, 2, 3, 0],
      '7sus4': [null, null, 0, 2, 1, 3],
      '5':     [null, null, 0, 2, null, null],
      'dim7':  [null, null, 0, 1, 0, 1],
      'm7b5':  [null, null, 0, 1, 1, 1]
    }
  }
};

/** Open-position shapes that belong to no movable family. C and G, mainly. */
const OPEN_ONLY = {
  'C':     [null, 3, 2, 0, 1, 0],
  'C7':    [null, 3, 2, 3, 1, 0],
  'Cmaj7': [null, 3, 2, 0, 0, 0],
  'Cadd9': [null, 3, 2, 0, 3, 0],
  'Csus4': [null, 3, 3, 0, 1, 1],
  'G':     [3, 2, 0, 0, 0, 3],
  'G7':    [3, 2, 0, 0, 0, 1],
  'Gmaj7': [3, 2, 0, 0, 0, 2],
  'Gsus4': [3, 3, 0, 0, 1, 3],
  'G6':    [3, 2, 0, 0, 0, 0],
  'F':     [1, 3, 3, 2, 1, 1],
  'Fmaj7': [null, null, 3, 2, 1, 0],
  'D':     [null, null, 0, 2, 3, 2],
  'A':     [null, 0, 2, 2, 2, 0],
  'E':     [0, 2, 2, 1, 0, 0],
  'H7':    [null, 2, 1, 2, 0, 2],
  'A7sus4':[null, 0, 2, 0, 3, 0],
  'Em6':   [0, 2, 2, 0, 2, 0]
};

/** Semitones above the open string that put the root under a shape's root string. */
const OPEN_PITCH = [4, 9, 2, 7, 11, 4];

/**
 * Every canonical shape for one chord, nearest the nut first.
 *
 * Returns the same objects the search does, so callers cannot tell which layer
 * a fingering came from.
 */
export function canonicalShapes(root, quality) {
  const out = [];

  for (const family of Object.values(MOVABLE)) {
    const offsets = family.forms[quality];
    if (!offsets) continue;

    // Where this family's root string has to be pressed to sound the root.
    let fret = (root - OPEN_PITCH[family.root] + 24) % 12;
    for (; fret <= 12; fret += 12) {
      if (fret > 11) break;
      const frets = offsets.map((o) => (o === null ? null : o + fret));
      if (frets.some((f) => f !== null && f > 15)) continue;

      // At the nut a zero offset is an open string; anywhere else it is barred.
      let barre = null;
      if (fret > 0) {
        const at = [];
        offsets.forEach((o, i) => { if (o === 0) at.push(i); });
        if (at.length > 1) barre = { fret, from: at[0], to: at[at.length - 1] };
      }
      out.push({ frets, barre, baseFret: fret <= 1 ? 1 : fret, position: fret, canonical: true });
    }
  }

  return out;
}

export { OPEN_ONLY };
