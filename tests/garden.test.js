import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildArchitecture } from '../src/garden/architecture.js';
import { buildLandscape } from '../src/garden/landscape.js';
import { buildVegetation } from '../src/garden/vegetation.js';

const material = new THREE.MeshBasicMaterial();
const palette = Object.fromEntries(
  ['plaster', 'plasterWarm', 'wood', 'woodDark', 'roof', 'roofEdge', 'stone', 'stoneLight', 'stoneDark', 'moss', 'grass', 'path', 'water', 'lotus', 'flower', 'leaf', 'leafLight', 'leafDark', 'bamboo', 'bambooLeaf', 'pine', 'blossom', 'gold']
    .map((key) => [key, material])
);

function names(group) {
  const result = [];
  group.traverse((item) => { if (item.name) result.push(item.name); });
  return result;
}

test('architecture gives every major destination a tangible structure', () => {
  const group = new THREE.Group();
  buildArchitecture(group, palette);
  const built = names(group);
  for (const name of ['entrance-gate', 'waterside-hall', 'wind-pavilion', 'covered-corridor', 'moon-gate', 'arched-bridge']) {
    assert.ok(built.includes(name), `${name} exists`);
  }
  assert.ok(built.filter((name) => name.includes('roof')).length >= 3);
  for (const inscription of ['姑苏一园', '临水轩', '听风亭', '月洞花墙']) {
    assert.ok(built.includes(`plaque-${inscription}`), `${inscription} is named on a plaque`);
  }
});

test('bridge spans from the entrance-side shore toward the pond island', () => {
  const group = new THREE.Group();
  buildArchitecture(group, palette);
  group.updateMatrixWorld(true);
  const bridge = group.getObjectByName('arched-bridge');
  const shore = new THREE.Vector3(-3.9, 0, 0).applyMatrix4(bridge.matrixWorld);
  const island = new THREE.Vector3(3.9, 0, 0).applyMatrix4(bridge.matrixWorld);
  assert.ok(Math.abs(shore.x - 2) < 1 && Math.abs(island.x - 2) < 1);
  assert.ok(Math.max(shore.z, island.z) > 6.8);
  assert.ok(Math.min(shore.z, island.z) < 0.5);
});

test('landscape has a continuous pond, shores, pathways and clustered rockery', () => {
  const group = new THREE.Group();
  buildLandscape(group, palette);
  const built = names(group);
  for (const name of ['pond-water', 'pond-shore', 'garden-path', 'rockery', 'pond-island']) {
    assert.ok(built.includes(name), `${name} exists`);
  }
  const water = group.getObjectByName('pond-water');
  assert.ok(water.geometry.attributes.position.count > 12);
  const moonPath = group.getObjectByName('path-moon');
  moonPath.geometry.computeBoundingBox();
  assert.ok(moonPath.geometry.boundingBox.max.z > 7 && moonPath.geometry.boundingBox.min.z < 4, 'moon-gate path passes through the opening');
});

test('planting includes bamboo, trees, flowers and water plants', () => {
  const group = new THREE.Group();
  buildVegetation(group, palette);
  const built = names(group);
  for (const name of ['bamboo-grove', 'willow-tree', 'pine-tree', 'flowering-tree', 'lotus-bed']) {
    assert.ok(built.includes(name), `${name} exists`);
  }
});
