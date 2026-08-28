import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The two copies of the chord parser must stay the same file.
 *
 * AI-DECISION: this is the most valuable test in the tool, and it tests no
 * behaviour at all. `chordpro.js` exists twice — once in the site, once here —
 * because the editor has to render a sheet exactly as a reader will see it. The
 * two are edited by different people at different times, and a fix applied to
 * one and not the other produces a preview that quietly lies: the worker signs
 * off on chords that will not be what ships. Nothing else in either repository
 * notices that, so this does.
 */
describe('ogledalo', () => {
  test('chordpro.js je identican onom u sajtu', () => {
    const mine = join(here, '../src/utils/chordpro.js');
    const theirs = join(here, '../../octava-app/app/utils/chordpro.js');

    let site;
    try {
      site = readFileSync(theirs, 'utf8');
    } catch {
      // A checkout without the sibling repository should not fail the suite —
      // there is simply nothing to compare against.
      console.log('    (octava-app nije prisutan, preskaceno)');
      return;
    }

    assert.equal(
      readFileSync(mine, 'utf8'), site,
      'chordpro.js se razisao izmedju dashboarda i sajta — prepisi jedan preko drugog'
    );
  });
});
