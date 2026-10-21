import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAvatarFile, MAX_AVATAR_SIZE } from '../src/lib/avatar.js';

test('avatar uploads accept supported image formats up to 2 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.doesNotThrow(() => validateAvatarFile({ type, size: MAX_AVATAR_SIZE }));
  }
});

test('avatar uploads reject unsupported, empty, and oversized files', () => {
  for (const file of [null, { type: 'image/svg+xml', size: 50 }, { type: 'text/plain', size: 10 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: MAX_AVATAR_SIZE + 1 }]) {
    assert.throws(() => validateAvatarFile(file), /Choose/);
  }
});
