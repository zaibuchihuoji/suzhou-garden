import test from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/garden/layout.js';

const { GARDEN_BOUNDS, LANDMARKS, VIEWS, getView } = layout;

test('the garden contains distinct architectural and landscape landmarks', () => {
  const required = ['entrance', 'hall', 'pavilion', 'bridge', 'moonGate', 'rockery', 'pond'];
  for (const name of required) {
    assert.ok(LANDMARKS[name], `${name} is present`);
    const [x, , z] = LANDMARKS[name];
    assert.ok(x >= GARDEN_BOUNDS.minX && x <= GARDEN_BOUNDS.maxX, `${name} x is in bounds`);
    assert.ok(z >= GARDEN_BOUNDS.minZ && z <= GARDEN_BOUNDS.maxZ, `${name} z is in bounds`);
  }
  assert.equal(new Set(required.map((name) => LANDMARKS[name].join(','))).size, required.length);
});

test('every named view has an in-bounds focal point and an accessible camera', () => {
  assert.ok(VIEWS.length >= 6);
  assert.equal(new Set(VIEWS.map((view) => view.id)).size, VIEWS.length);
  for (const view of VIEWS) {
    assert.ok(view.label && view.subtitle && view.index);
    assert.equal(getView(view.id), view);
    const [x, y, z] = view.position;
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    assert.ok(y > 1.5 && y < 32, `${view.id} camera is above ground`);
    assert.ok(Math.abs(x) < 42 && Math.abs(z) < 42, `${view.id} camera is near the garden`);
    assert.ok(view.target[0] >= GARDEN_BOUNDS.minX && view.target[0] <= GARDEN_BOUNDS.maxX);
    assert.ok(view.target[2] >= GARDEN_BOUNDS.minZ && view.target[2] <= GARDEN_BOUNDS.maxZ);
  }
  assert.equal(getView('missing'), undefined);
});

test('close-up cameras avoid cutting through walls and foreground trees', () => {
  const entrance = getView('entrance');
  const moonGate = getView('moonGate');
  const bridge = getView('bridge');
  assert.ok(entrance.position[2] >= 29, 'the gate roof fits in the entrance frame');
  assert.ok(moonGate.position[0] < 23 && moonGate.position[2] > 7, 'the moon gate is viewed from inside the perimeter');
  assert.ok(bridge.position[0] < 5, 'the bridge foreground avoids the flowering tree');
});

test('rockery camera frames the complete rock formation', () => {
  const view = getView('rockery');
  assert.ok(Math.hypot(...view.position.map((value, i) => value - view.target[i])) > 12, 'the rockery does not fill and clip the frame');
});

test('walking is confined to dry garden paths, structures and the bridge', () => {
  assert.equal(layout.isWalkable(0, 11), true);
  assert.equal(layout.isWalkable(0, 0), false);
  assert.equal(layout.isWalkable(2, 4), true);
  assert.equal(layout.isWalkable(24, 0), false);
  assert.equal(layout.isWalkable(-10, -10), false);
  assert.equal(layout.isWalkable(19, 5), true);
  assert.equal(layout.isWalkable(16, 5), false);
});

test('WASD movement follows the view direction and cannot jump across the pond', () => {
  assert.deepEqual(layout.moveWalker([0, 10], { forward: 1, right: 0 }, 0, 1), [0, 9]);
  assert.deepEqual(layout.moveWalker([0, 10], { forward: 1, right: 0 }, Math.PI / 2, 1), [1, 10]);
  const [, z] = layout.moveWalker([0, 8.5], { forward: 1, right: 0 }, 0, 4);
  assert.ok(z > 4.5, 'a long frame cannot tunnel through the water');
  assert.ok(layout.walkHeight(2, 4) > layout.walkHeight(2, 7.9), 'the bridge rises above its ends');
});

test('the arched bridge connects the mainland route to the island', () => {
  const [, z] = layout.moveWalker([2, 7.5], { forward: 1, right: 0 }, 0, 9);
  assert.ok(z < -1.2, 'a walker can reach the island without walking into water');
});
