import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLine, columnToSource, insertChord, replaceChord, removeChord
} from '../src/utils/chordline.js';

describe('razdvajanje linije', () => {
  test('tekst i akordi se razdvajaju, kolone su u vidljivom tekstu', () => {
    const { plain, chords } = parseLine('[Am]tekst [F]ovdje');
    assert.equal(plain, 'tekst ovdje');
    assert.deepEqual(chords.map((c) => [c.chord, c.column]), [['Am', 0], ['F', 6]]);
  });

  test('linija bez akorda', () => {
    const { plain, chords } = parseLine('samo tekst');
    assert.equal(plain, 'samo tekst');
    assert.equal(chords.length, 0);
  });

  test('nezatvorena zagrada se tretira kao tekst, ne guta ostatak', () => {
    const { plain, chords } = parseLine('[Am tekst');
    assert.equal(plain, '[Am tekst');
    assert.equal(chords.length, 0);
  });
});

describe('kolona u izvor', () => {
  test('indeksi se razilaze tacno za duzinu tokena', () => {
    // "o" of "ovdje" is column 6 on screen and index 13 in the source:
    // [Am]=0-3, tekst=4-8, space=9, [F]=10-12, o=13. Getting this wrong is what
    // puts a chord on the wrong syllable.
    assert.equal(columnToSource('[Am]tekst [F]ovdje', 6), 13);
    assert.equal(columnToSource('[Am]tekst', 0), 4);
  });

  test('drugi akord na istom slogu ide iza prvog, ne kroz njega', () => {
    const source = '[Am]tekst';
    const out = insertChord(source, 0, 'F');
    assert.equal(out, '[Am][F]tekst');
    // The syllable survives: splitting it would produce "[Am][F]" inside a word.
    assert.equal(parseLine(out).plain, 'tekst');
  });
});

describe('izmjene', () => {
  test('umetanje na sredinu rijeci', () => {
    assert.equal(insertChord('tekst', 2, 'Am'), 'te[Am]kst');
  });

  test('zamjena cuva ostatak linije', () => {
    assert.equal(replaceChord('[Am]tekst [F]ovdje', 1, 'G'), '[Am]tekst [G]ovdje');
  });

  test('uklanjanje ne dira tekst', () => {
    const out = removeChord('[Am]tekst [F]ovdje', 0);
    assert.equal(out, 'tekst [F]ovdje');
    assert.equal(parseLine(out).plain, 'tekst ovdje');
  });

  test('nepostojeci indeks ne mijenja nista', () => {
    const source = '[Am]tekst';
    assert.equal(replaceChord(source, 9, 'G'), source);
    assert.equal(removeChord(source, 9), source);
  });

  test('umetanje pa uklanjanje vraca original', () => {
    const source = 'jedan dva tri';
    const withChord = insertChord(source, 6, 'Am');
    assert.equal(removeChord(withChord, 0), source);
  });
});
