import { findFingering } from './chordEngine';
import { getChordData } from './guitarChords';
import { strum } from './chordAudio';

/**
 * Sounds a chord symbol using the full chord engine with realistic acoustic guitar synthesis.
 *
 * @param {string} symbol - e.g. "Am", "D/F#", "G/H", "Cmaj7"
 * @param {number} [variant=0] - Shape variation index
 * @param {string} [instrument='guitar'] - Instrument tuning
 * @param {Object} [opts] - Strumming options { direction: 'down'|'up'|'arpeggio', volume }
 * @returns {boolean} whether audio was played
 */
export function playChord(symbol, variant = 0, instrument = 'guitar', opts = {}) {
  const shape = findFingering(symbol, variant, instrument);
  if (shape?.frets) {
    return strum(shape.frets, opts);
  }

  const legacyShape = getChordData(symbol);
  if (legacyShape?.frets) {
    return strum(legacyShape.frets.map((fret) => (fret === -1 ? null : fret)), opts);
  }

  return false;
}

