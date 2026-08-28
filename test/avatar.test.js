import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initials, avatarColor, avatarStyle } from '../src/utils/avatar.js';

describe('avatar', () => {
  test('inicijali iz jednog i vise imena', () => {
    assert.equal(initials('Zdravko Čolić'), 'ZČ');
    assert.equal(initials('Regina'), 'R');
  });

  test('prazno ime ne pada', () => {
    assert.doesNotThrow(() => initials(''));
    assert.doesNotThrow(() => initials(null));
  });

  test('boja je determinisana — isti izvodjac, isti avatar svaki put', () => {
    assert.equal(avatarColor('Bijelo Dugme'), avatarColor('Bijelo Dugme'));
    assert.ok(avatarStyle('Bijelo Dugme'));
  });
});
