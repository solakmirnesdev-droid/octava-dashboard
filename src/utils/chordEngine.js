/**
 * Generates guitar fingerings from chord intervals and the tuning.
 *
 * The old fingerings.js held 37 shapes typed out by hand, which covered the
 * open chords and nothing else — a song using G/B or Fmaj7 got no diagram at
 * all. Voicings are derivable: a chord is a set of pitch classes, a fretboard
 * maps (string, fret) to a pitch class, and the rest is a search over the
 * combinations a hand can actually hold.
 *
 * AI-DECISION: computed, not transcribed. Every root, quality and neck position
 * is covered without anyone maintaining a table, and each shape is checked for
 * playability rather than trusted. See AI-NOTES.md §4.
 *
 * Names follow the ex-Yugoslav alphabet used everywhere else here: H is the
 * twelfth degree, and there are no flats — A# never Bb.
 */

import { canonicalShapes, OPEN_ONLY } from './chordShapes.js';

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];

/** Standard tuning as MIDI numbers, low string first: E A D G H E. */
/**
 * The instruments the diagrams can be drawn for.
 *
 * AI-TRAP: the ukulele is RE-ENTRANT. Its G string sounds above its C string,
 * so string index 0 is not the lowest pitch — which every "the bass note is the
 * first sounding string" assumption gets wrong. Anything here that needs the
 * bass of a voicing has to find it by pitch, never by position.
 *
 * AI-DECISION: `maxNotes` is only set for the bass, and it is a musical limit
 * rather than a technical one. Four-note chords down at E1 are mud — the
 * intervals beat against each other badly enough that nobody voices them there.
 * What bass players actually use is the root with a fifth or an octave, so the
 * generator is capped at three and allowed to stop at two.
 */
/*
 * AI-TRAP: named CHORD_INSTRUMENTS, not CHORD_INSTRUMENTS. useTuner.js already exports
 * an INSTRUMENTS of its own — same word, unrelated shape: that one carries string
 * frequencies for pitch detection, this one carries MIDI tunings for generating
 * shapes. Nuxt auto-imports both, silently keeps one, and the loser is whichever
 * file it decided to ignore. Nothing breaks loudly; a component just receives an
 * object whose keys it does not have.
 */
export const CHORD_INSTRUMENTS = {
  guitar:  { tuning: [40, 45, 50, 55, 59, 64], minNotes: 3, maxNotes: 6, openShapes: true,  requireBass: true },
  bass:    { tuning: [28, 33, 38, 43],         minNotes: 2, maxNotes: 3, openShapes: false, requireBass: true },
  // All four strings, always: real ukulele charts practically never mute one,
  // and allowing it produced three-string shapes that outranked the standard
  // fingerings on score while looking nothing like them.
  ukulele: { tuning: [67, 60, 64, 69],         minNotes: 4, maxNotes: 4, openShapes: false, requireBass: false }
};

const DEFAULT_INSTRUMENT = 'guitar';

const TUNING = CHORD_INSTRUMENTS.guitar.tuning;

const STRINGS = 6;
const MAX_SPAN = 4;        // frets a hand covers without shifting
const MAX_FINGERS = 4;
const HIGHEST_FRET = 15;   // past this the diagrams stop being useful

/**
 * Intervals in semitones from the root.
 *
 * `optional` lists degrees that may be dropped when six strings cannot hold
 * everything — the fifth is the usual casualty in ninths and thirteenths,
 * since it adds no colour. It is never optional where it is the characteristic
 * note: diminished, augmented and power chords keep it.
 */
/**
 * Intervals in semitones from the root, with the name and formula shown under
 * the diagram so a shape is more than a picture to copy.
 *
 * `optional` lists degrees that may be dropped when six strings cannot hold
 * everything — the fifth is the usual casualty in ninths and thirteenths, since
 * it adds no colour. It is never optional where it is the characteristic note:
 * diminished, augmented and power chords keep it.
 *
 * The quality name is a translation key rather than a word: this table is read
 * by both catalogues, and 'dur' printed on the English site is not a label, it
 * is a bug.
 */
export const QUALITIES = {
  "":       { labelKey: "major",       formula: "1 - 3 - 5",              steps: [0, 4, 7]             },
  "m":      { labelKey: "minor",       formula: "1 - b3 - 5",             steps: [0, 3, 7]             },
  "5":      { labelKey: "fifth",       formula: "1 - 5",                  steps: [0, 7]                },
  "6":      { labelKey: "sixth",       formula: "1 - 3 - 5 - 6",          steps: [0, 4, 7, 9],         optional: [7] },
  "m6":     { labelKey: "minor6",      formula: "1 - b3 - 5 - 6",         steps: [0, 3, 7, 9],         optional: [7] },
  "7":      { labelKey: "seventh",     formula: "1 - 3 - 5 - b7",         steps: [0, 4, 7, 10],        optional: [7] },
  "maj7":   { labelKey: "major7",      formula: "1 - 3 - 5 - 7",          steps: [0, 4, 7, 11],        optional: [7] },
  "m7":     { labelKey: "minor7",      formula: "1 - b3 - 5 - b7",        steps: [0, 3, 7, 10],        optional: [7] },
  "mmaj7":  { labelKey: "minorMajor7", formula: "1 - b3 - 5 - 7",         steps: [0, 3, 7, 11],        optional: [7] },
  "dim":    { labelKey: "dim",         formula: "1 - b3 - b5",            steps: [0, 3, 6]             },
  "dim7":   { labelKey: "dim7",        formula: "1 - b3 - b5 - bb7",      steps: [0, 3, 6, 9]          },
  "m7b5":   { labelKey: "halfDim",     formula: "1 - b3 - b5 - b7",       steps: [0, 3, 6, 10]         },
  "aug":    { labelKey: "aug",         formula: "1 - 3 - #5",             steps: [0, 4, 8]             },
  "7#5":    { labelKey: "augSeventh",  formula: "1 - 3 - #5 - b7",        steps: [0, 4, 8, 10]         },
  "sus2":   { labelKey: "sus2",        formula: "1 - 2 - 5",              steps: [0, 2, 7]             },
  "sus4":   { labelKey: "sus4",        formula: "1 - 4 - 5",              steps: [0, 5, 7]             },
  "7sus4":  { labelKey: "sevenSus4",   formula: "1 - 4 - 5 - b7",         steps: [0, 5, 7, 10],        optional: [7] },
  "add9":   { labelKey: "add9",        formula: "1 - 3 - 5 - 9",          steps: [0, 4, 7, 14],        optional: [7] },
  "madd9":  { labelKey: "minorAdd9",   formula: "1 - b3 - 5 - 9",         steps: [0, 3, 7, 14],        optional: [7] },
  "9":      { labelKey: "ninth",       formula: "1 - 3 - 5 - b7 - 9",     steps: [0, 4, 7, 10, 14],    optional: [7] },
  "maj9":   { labelKey: "major9",      formula: "1 - 3 - 5 - 7 - 9",      steps: [0, 4, 7, 11, 14],    optional: [7] },
  "m9":     { labelKey: "minor9",      formula: "1 - b3 - 5 - b7 - 9",    steps: [0, 3, 7, 10, 14],    optional: [7] },
  "11":     { labelKey: "eleventh",    formula: "1 - 5 - b7 - 9 - 11",    steps: [0, 7, 10, 14, 17],   optional: [7, 14] },
  "m11":    { labelKey: "minor11",     formula: "1 - b3 - 5 - b7 - 11",   steps: [0, 3, 7, 10, 17],    optional: [7, 14] },
  "13":     { labelKey: "thirteenth",  formula: "1 - 3 - b7 - 13",        steps: [0, 4, 10, 21],       optional: [7, 14] },
  "7b9":    { labelKey: "sevenFlat9",  formula: "1 - 3 - 5 - b7 - b9",    steps: [0, 4, 7, 10, 13],    optional: [7] },
  "7#9":    { labelKey: "sevenSharp9", formula: "1 - 3 - 5 - b7 - #9",    steps: [0, 4, 7, 10, 15],    optional: [7] }
};


/** Written forms people actually type, mapped onto the keys above. */
const ALIASES = {
  'maj': '', 'M': '', 'dur': '', 'min': 'm', 'mol': 'm', '-': 'm',
  'maj7': 'maj7', 'Maj7': 'maj7', 'M7': 'maj7', 'Δ': 'maj7', '7M': 'maj7',
  'mMaj7': 'mmaj7', 'mM7': 'mmaj7', 'm(maj7)': 'mmaj7',
  '°': 'dim', 'o': 'dim', '°7': 'dim7', 'o7': 'dim7',
  'ø': 'm7b5', 'ø7': 'm7b5', 'm7-5': 'm7b5', 'min7b5': 'm7b5', 'halfdim': 'm7b5',
  '+': 'aug', '+5': 'aug', '#5': 'aug', 'aug7': '7#5', '7+5': '7#5', '7+': '7#5',
  'sus': 'sus4', 'sus47': '7sus4', '7sus': '7sus4',
  'add2': 'add9', '2': 'add9', 'm add9': 'madd9',
  'min9': 'm9', 'min7': 'm7', 'min6': 'm6', 'min11': 'm11',
  'dom7': '7', 'dom9': '9'
};

/**
 * Splits "C#m7/G#" into root, quality and bass.
 *
 * AI-TRAP: the root must be read before the quality, and 'm' must not be
 * matched inside 'maj7' — test C, Cm, Cmaj7 and Cm7 whenever this changes.
 */
export function parseChord(symbol) {
  if (typeof symbol !== 'string') return null;
  const text = symbol.trim().replace(/[‘’]/g, "'");
  if (!text) return null;

  const m = /^([A-H])([#b]?)(.*)$/.exec(text);
  if (!m) return null;

  let root = NOTES.indexOf(m[1] === 'B' ? 'A#' : m[1]);   // foreign B reads as A#
  if (root < 0) return null;
  if (m[2] === '#') root = (root + 1) % 12;
  if (m[2] === 'b') root = (root + 11) % 12;

  let rest = m[3];
  let bass = null;

  const slash = rest.indexOf('/');
  if (slash >= 0) {
    const b = /^([A-H])([#b]?)$/.exec(rest.slice(slash + 1).trim());
    if (!b) return null;
    bass = NOTES.indexOf(b[1] === 'B' ? 'A#' : b[1]);
    if (bass < 0) return null;
    if (b[2] === '#') bass = (bass + 1) % 12;
    if (b[2] === 'b') bass = (bass + 11) % 12;
    rest = rest.slice(0, slash);
  }

  rest = rest.trim();
  const quality = Object.prototype.hasOwnProperty.call(QUALITIES, rest)
    ? rest
    : ALIASES[rest];
  if (quality === undefined) return null;

  return { root, quality, bass, symbol: text };
}

/** The canonical spelling, so 'Bb' and 'CMaj7' converge on one cache key. */
export function chordName({ root, quality, bass }) {
  return NOTES[root] + quality + (bass === null ? '' : '/' + NOTES[bass]);
}

/**
 * Can a hand hold this? Returns the barre if one is needed, or null if the
 * shape needs more fingers than exist.
 */
function playability(frets) {
  const fretted = [];
  for (let i = 0; i < frets.length; i++) if (frets[i] > 0) fretted.push(i);
  if (fretted.length <= MAX_FINGERS) return { barre: null };

  const low = Math.min(...fretted.map((i) => frets[i]));
  const at = fretted.filter((i) => frets[i] === low);
  const from = at[0];
  const to = at[at.length - 1];

  // A barre presses every string it crosses, so an open string under it dies.
  for (let i = from; i <= to; i++) if (frets[i] === 0) return null;

  const above = fretted.filter((i) => frets[i] > low).length;
  if (above > MAX_FINGERS - 1) return null;

  return { barre: { fret: low, from, to } };
}

/** Generates every playable voicing of one chord, best first. */
export function voicings(parsed, limit = 8, instrument = DEFAULT_INSTRUMENT) {
  const inst = CHORD_INSTRUMENTS[instrument] || CHORD_INSTRUMENTS[DEFAULT_INSTRUMENT];
  const tuning = inst.tuning;
  const strings = tuning.length;

  const { root, quality, bass } = parsed;
  const spec = QUALITIES[quality];
  if (!spec) return [];

  const optional = new Set(spec.optional || []);
  const wanted = new Set(spec.steps.map((s) => (root + s) % 12));
  const mustHave = new Set(
    spec.steps.filter((s) => !optional.has(s)).map((s) => (root + s) % 12)
  );

  // AI-TRAP: a slash chord's bass need not belong to the chord — C/H and Am/G
  // are ordinary. Requiring it to be a chord tone made G/B produce nothing.
  const bassNote = bass === null ? root : bass;
  const playable = new Set(wanted);
  playable.add(bassNote);

  const found = [];

  for (let base = 0; base + MAX_SPAN - 1 <= HIGHEST_FRET; base++) {
    const options = [];
    for (let s = 0; s < strings; s++) {
      const list = [null];
      const lo = base === 0 ? 0 : base;
      for (let f = lo; f < lo + MAX_SPAN; f++) {
        if (f > HIGHEST_FRET) break;
        if (playable.has((tuning[s] + f) % 12)) list.push(f);
      }
      if (base > 0 && playable.has(tuning[s] % 12)) list.push(0);
      options.push(list);
    }

    // Sounding strings must be contiguous: a muted string in the middle of the
    // shape is a damping technique, not something to put in front of a learner.
    const walk = (s, frets) => {
      if (s === strings) {
        const sounding = [];
        for (let i = 0; i < strings; i++) if (frets[i] !== null) sounding.push(i);
        const floor = quality === '5' ? 2 : inst.minNotes;
        if (sounding.length < floor || sounding.length > inst.maxNotes) return;
        if (sounding[sounding.length - 1] - sounding[0] + 1 !== sounding.length) return;

        /*
         * Which note is in the bass, and whether it matters at all.
         *
         * AI-TRAP: on a guitar or a bass the lowest pitch is the lowest string,
         * so the two can be used interchangeably. On a re-entrant ukulele they
         * are different — the G string sounds a fourth ABOVE the C — so the
         * lowest pitch has to be searched for rather than read off sounding[0].
         *
         * AI-DECISION: and on the ukulele the rule is then dropped entirely.
         * Every string sits inside one octave there, so no voicing has a bass in
         * the sense this test means; the ear hears a chord, not an inversion.
         * Enforcing it rejected the standard shapes outright — Am is 2000 on
         * every ukulele chart ever printed, and its lowest sounding pitch is C.
         * A generator that "correctly" refuses to draw Am is wrong about the
         * instrument, not about the theory.
         */
        if (inst.requireBass) {
          let lowest = sounding[0];
          for (const i of sounding) {
            if (tuning[i] + frets[i] < tuning[lowest] + frets[lowest]) lowest = i;
          }
          if ((tuning[lowest] + frets[lowest]) % 12 !== bassNote) return;
        } else if (bass !== null) {
          // A slash chord still has to contain the note it names, even where
          // the instrument cannot put it underneath.
          if (!sounding.some((i) => (tuning[i] + frets[i]) % 12 === bassNote)) return;
        }

        const pcs = new Set(sounding.map((i) => (tuning[i] + frets[i]) % 12));
        for (const need of mustHave) if (!pcs.has(need)) return;
        // Only the bass may sit outside the chord, and only once.
        for (const pc of pcs) if (!wanted.has(pc) && pc !== bassNote) return;

        const play = playability(frets);
        if (!play) return;

        found.push({ frets: frets.slice(), ...play, sounding, pcs: pcs.size });
        return;
      }
      for (const f of options[s]) {
        frets[s] = f;
        walk(s + 1, frets);
      }
      frets[s] = null;
    };
    walk(0, new Array(strings).fill(null));
  }

  for (const v of found) {
    const fretted = v.frets.filter((f) => f !== null && f > 0);
    const low = fretted.length ? Math.min(...fretted) : 0;
    const high = fretted.length ? Math.max(...fretted) : 0;
    v.baseFret = low <= 1 ? 1 : low;
    v.position = low;

    // A stretch across frets is what actually makes a shape hard, so it weighs
    // more than anything else. Muting the top string is penalised far harder
    // than muting the bottom one: a thumb rests on the low E anyway, while
    // silencing the high E mid-strum is awkward and thins the chord out.
    const mutedLow = v.sounding[0];
    const mutedHigh = strings - 1 - v.sounding[v.sounding.length - 1];

    v.score = (high - low) * 8
      + low * 4
      + (v.barre ? 4 : 0)
      + mutedLow * 2
      + mutedHigh * 12
      + fretted.length
      - v.pcs * 5;
  }

  found.sort((a, b) => a.score - b.score);

  /*
   * At most two shapes per neck position.
   *
   * AI-DECISION: it was one, to keep five ways of fingering the same fret from
   * becoming noise. But one silently threw away the fingering every printed
   * chart uses: ukulele Em is 0432 everywhere, and the generator found it, then
   * dropped it because the easier 0402 sits at the same position and scores a
   * point better. A reference that disagrees with every book on the shelf is
   * worse than one carrying a second row — and the second shape is reachable
   * through the position switcher rather than shown at once.
   */
  const PER_POSITION = 2;
  const out = [];
  const atPosition = new Map();
  const seenShape = new Set();
  for (const v of found) {
    const key = v.frets.join(',');
    const used = atPosition.get(v.position) || 0;
    if (seenShape.has(key) || used >= PER_POSITION) continue;
    seenShape.add(key);
    atPosition.set(v.position, used + 1);
    out.push({ frets: v.frets, barre: v.barre, baseFret: v.baseFret, position: v.position });
    if (out.length >= limit) break;
  }
  return out;
}

const cache = new Map();

/**
 * Every fingering for a chord symbol, cached. Empty array if unparseable.
 *
 * Three layers, in the order a player would think of them: the open shape they
 * learned first, then the movable forms up the neck, then whatever else the
 * search can find for positions the first two do not reach.
 */
export function fingeringsFor(symbol, instrument = DEFAULT_INSTRUMENT) {
  const parsed = parseChord(symbol);
  if (!parsed) return [];
  const inst = CHORD_INSTRUMENTS[instrument] || CHORD_INSTRUMENTS[DEFAULT_INSTRUMENT];

  // AI-TRAP: the instrument belongs in the cache key. Without it the first
  // lookup for "Am" fills the entry and every other instrument is handed
  // guitar shapes for the rest of the session — six numbers where a ukulele
  // has four, drawn without complaint.
  const key = instrument + ':' + chordName(parsed);
  if (cache.has(key)) return cache.get(key);

  const out = [];
  const seen = new Set();
  const add = (v) => {
    const k = v.frets.join(',');
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };

  // The hand-written open shapes and the CAGED forms are guitar tables; the
  // other instruments are generated from their tuning alone.
  if (parsed.bass === null && inst.openShapes) {
    const open = OPEN_ONLY[NOTES[parsed.root] + parsed.quality];
    if (open) {
      const fretted = open.filter((f) => f !== null && f > 0);
      const low = fretted.length ? Math.min(...fretted) : 0;
      const play = playability(open);
      add({ frets: open, barre: play ? play.barre : null, baseFret: low <= 1 ? 1 : low, position: low, canonical: true });
    }
    for (const s of canonicalShapes(parsed.root, parsed.quality).sort((a, b) => a.position - b.position)) {
      add(s);
    }
  }

  /*
   * AI-TRAP: there are two position filters, here and inside voicings(), and
   * relaxing only one changes nothing. The generator found ukulele Em's standard
   * 0432 and voicings() passed it through; this loop then dropped it because the
   * easier 0402 already held position 2. Both have to allow the second shape or
   * the fingering every printed chart uses never reaches the page.
   */
  for (const v of voicings(parsed, 20, instrument)) {
    if (out.length >= 8) break;
    if (out.filter((o) => o.position === v.position).length >= 2) continue;
    add(v);
  }

  out.sort((a, b) => (b.canonical ? 1 : 0) - (a.canonical ? 1 : 0) || a.position - b.position);
  const result = out.slice(0, 8);
  cache.set(key, result);
  return result;
}

/** The notes a chord is built from, for display under the diagram. */
export function chordNotes(symbol) {
  const parsed = parseChord(symbol);
  if (!parsed) return [];
  const spec = QUALITIES[parsed.quality];
  const seen = new Set();
  const out = [];
  for (const s of spec.steps) {
    const pc = (parsed.root + s) % 12;
    if (!seen.has(pc)) { seen.add(pc); out.push(NOTES[pc]); }
  }
  return out;
}

/**
 * One fingering, in the shape the diagram component expects.
 *
 * `variant` picks among the positions up the neck; it wraps, so a component
 * stepping through them never has to bounds-check. Unknown symbols return null
 * rather than a guess — an approximate shape drawn without warning is worse
 * than an honest gap.
 */
export function findFingering(symbol, variant = 0, instrument = DEFAULT_INSTRUMENT) {
  const parsed = parseChord(symbol);
  if (!parsed) return null;

  const all = fingeringsFor(symbol, instrument);
  if (!all.length) return null;

  const spec = QUALITIES[parsed.quality];
  const index = ((variant % all.length) + all.length) % all.length;

  return {
    ...all[index],
    name: chordName(parsed),
    qualityKey: spec?.labelKey || null,
    formula: spec?.formula || null,
    variant: index,
    variants: all.length
  };
}

/** How many positions exist for a symbol, for a variant picker. */
export function variantCount(symbol, instrument = DEFAULT_INSTRUMENT) {
  return fingeringsFor(symbol, instrument).length;
}

/**
 * The qualities worth putting on the reference page.
 *
 * All 27 are generated on demand, but a page listing every one of them for
 * every root is 324 diagrams — a dump, not a reference. These are the ones that
 * turn up in the songs here.
 */
export const COMMON_QUALITIES = [
  '', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', '6', 'm6', 'add9', 'dim', 'aug', '9', '5'
];

/** Every chord symbol on the reference page, grouped by root. */
export const CATALOGUE = NOTES.flatMap((root) => COMMON_QUALITIES.map((q) => root + q));

/**
 * Which finger presses which string, 1 = index to 4 = little.
 *
 * A barre is always the index finger, and the rest fall in order up the neck —
 * the way a hand naturally lands rather than the way a chart is drawn. Open and
 * muted strings get null.
 */
export function fingerNumbers({ frets, barre }) {
  const out = frets.map(() => null);

  const rest = [];
  frets.forEach((fret, i) => {
    if (fret === null || fret === 0) return;
    if (barre && fret === barre.fret && i >= barre.from && i <= barre.to) out[i] = 1;
    else rest.push({ fret, i });
  });

  rest.sort((a, b) => a.fret - b.fret || a.i - b.i);
  let next = barre ? 2 : 1;
  for (const { i } of rest) out[i] = next <= 4 ? next++ : 4;

  return out;
}
