import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { transposeChord, transposeKey, isChord, extractChords, normalizeNotation } from '../src/utils/chordpro.js';

describe('ex-jugoslovenska notacija', () => {
  test('dvanaesti stepen je H, ne B', () => {
    assert.equal(transposeChord('A', 2), 'H');
    assert.equal(transposeKey('Am', 2), 'Hm');
  });

  test('B se cita kao H, Bb kao A#', () => {
    // Input is forgiving; output is not. Both spellings have to land on the
    // right pitch or a chart typed elsewhere transposes into nonsense.
    assert.equal(normalizeNotation('[B]'), '[H]');
    assert.equal(normalizeNotation('[Bb]'), '[A#]');
  });

  test('izlaz je uvijek s povisilicama', () => {
    assert.equal(transposeChord('A', 1), 'A#');
    assert.equal(transposeChord('D', 1), 'D#');
  });

  test('prepoznavanje akorda', () => {
    assert.ok(isChord('Am'));
    assert.ok(isChord('C#m7'));
    assert.ok(isChord('D/F#'));
    assert.ok(!isChord('Refren'));
    assert.ok(!isChord('Strofa 1'));
  });

  test('vadjenje akorda preskace oznake dijelova', () => {
    assert.deepEqual(extractChords('[Strofa 1]\n[Am]tekst [F]ovdje [Am]opet'), ['Am', 'F']);
  });

  test('bas se transponuje zajedno s akordom', () => {
    assert.equal(transposeChord('D/F#', 2), 'E/G#');
  });
});
