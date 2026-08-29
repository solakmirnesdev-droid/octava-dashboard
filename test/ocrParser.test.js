import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanOcrText, isChordLine, convertOcrToChordPro, convertOcrBboxDataToChordPro } from '../src/utils/ocrParser.js';

describe('OCR čistač i konvertor', () => {
  it('čisti OCR artefakte (navodnike, crtice, rn umjesto m)', () => {
    const raw = '„Pjesma“ – Arn i F#rn';
    const cleaned = cleanOcrText(raw);
    assert.strictEqual(cleaned, '"Pjesma" - Am i F#m');
  });

  it('prepoznaje red s akordima', () => {
    assert.strictEqual(isChordLine('Am  C  G  D'), true);
    assert.strictEqual(isChordLine('Am  [C]  G/H  D7'), true);
    assert.strictEqual(isChordLine('ovo je tekst pjesme'), false);
    assert.strictEqual(isChordLine('Am tekst G'), false);
  });

  it('konvertuje akorde iznad teksta u ChordPro format', () => {
    const input = [
      'Am          F',
      'prvi stih teksta',
      'C           G',
      'drugi stih ovdje'
    ].join('\n');

    const result = convertOcrToChordPro(input);
    assert.match(result.content, /\[Am\]prvi stih \[F\]teksta/);
    assert.match(result.content, /\[C\]drugi stih \[G\]ovdje/);
    assert.ok(result.chords.includes('Am'));
    assert.ok(result.chords.includes('F'));
  });

  it('prepoznaje naslov i izvođača iz zaglavlja ako postoji', () => {
    const input = [
      'Oliver Dragojević - Cesarica',
      'Tonalitet: Am',
      'Am          F',
      'Zlatni konci litnje zore'
    ].join('\n');

    const result = convertOcrToChordPro(input);
    assert.strictEqual(result.artist, 'Oliver Dragojević');
    assert.strictEqual(result.title, 'Cesarica');
    assert.strictEqual(result.originalKey, 'Am');
    assert.match(result.content, /\[Am\]Zlatni konci \[F\]litnje zore/);
  });

  it('tačno raspoređuje akorde po prostornim koordinatama (bounding boxes)', () => {
    const ocrData = {
      lines: [
        {
          text: 'Am H7 E',
          bbox: { x0: 50, y0: 100, x1: 600, y1: 120 },
          words: [
            { text: 'Am', bbox: { x0: 50, y0: 100, x1: 80, y1: 120 } },
            { text: 'H7', bbox: { x0: 250, y0: 100, x1: 280, y1: 120 } },
            { text: 'E', bbox: { x0: 500, y0: 100, x1: 520, y1: 120 } }
          ]
        },
        {
          text: 'Imao je, kazu ljudi, u zivotu sve',
          bbox: { x0: 50, y0: 130, x1: 600, y1: 150 },
          words: [
            { text: 'Imao', bbox: { x0: 50, y0: 130, x1: 95, y1: 150 } },
            { text: 'je,', bbox: { x0: 105, y0: 130, x1: 130, y1: 150 } },
            { text: 'kazu', bbox: { x0: 245, y0: 130, x1: 285, y1: 150 } },
            { text: 'ljudi,', bbox: { x0: 295, y0: 130, x1: 345, y1: 150 } },
            { text: 'u', bbox: { x0: 430, y0: 130, x1: 445, y1: 150 } },
            { text: 'zivotu', bbox: { x0: 490, y0: 130, x1: 545, y1: 150 } },
            { text: 'sve', bbox: { x0: 555, y0: 130, x1: 585, y1: 150 } }
          ]
        }
      ]
    };

    const result = convertOcrBboxDataToChordPro(ocrData);
    assert.strictEqual(result.content, '[Am]Imao je, [H7]kazu ljudi, u [E]zivotu sve');
  });

  it('čisti OCR simbole (™ ® dots) i prepoznaje uvodne akorde', () => {
    const input = [
      'UVOD - D7...ES.D7.........GM',
      'Gm',
      'Jedina moja sreco sve moje najbolje',
      "Cm Cm™'Cm'Cm®",
      'mole te ove ruke u greh ne otplove'
    ].join('\n');

    const result = convertOcrToChordPro(input);
    assert.match(result.content, /\[Uvod\]/);
    assert.match(result.content, /\[D7\] \[D#\] \[D7\] \[Gm\]/);
    assert.match(result.content, /\[Gm\]Jedina moja/);
    assert.match(result.content, /\[Cm\]mole \[Cm\]te/);
  });
});
