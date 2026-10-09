import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('entry page is self-hosted and contains the garden navigation controls', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.ok(html.includes('id="garden-canvas"'));
  assert.ok(html.includes('id="view-list"'));
  assert.ok(html.includes('id="tour-button"'));
  assert.ok(html.includes('id="walk-button"'));
  assert.ok(html.includes('id="loading-screen"'));
  assert.ok(!/https?:\/\//i.test(html), 'no runtime CDN or remote asset references');
});
