import * as THREE from 'three';
import { nearGardenPath, distanceToCorridor } from './landscape.js';

const V = THREE.Vector3;
const UP = new V(0, 1, 0);
const FRONT = new V(0, 0, 1);
const TAU = Math.PI * 2;

const KEEP_OUT = [
  { x: -10, z: -10, hx: 5.6, hz: 4.2 },
  { x: 10, z: -7, r: 3.6 },
  { x: 0.5, z: 16.4, hx: 4.6, hz: 2.2 },
  { x: 2, z: 4.4, hx: 2.6, hz: 5 },
  { x: 19, z: 5, hx: 1.6, hz: 3.4 },
  { x: -13, z: 2, r: 3.3 },
  { x: 1, z: 11.5, hx: 2.4, hz: 4.5 }
];

const WILLOWS = [
  { x: -10.2, z: -3.2, size: 1.05 },
  { x: -1.5, z: -7.8, size: 0.95 },
  { x: 9.5, z: 4.4, size: 1 },
  { x: -5.5, z: 5, size: 0.9 },
  { x: 4.8, z: -8.2, size: 0.85 }
];

const PINES = [
  { x: -16, z: -0.5, size: 1.05 },
  { x: -17.5, z: -12.5, size: 1.2 },
  { x: 15, z: -11.5, size: 1.1 },
  { x: 2, z: -2, y: 0.25, size: 0.55, lean: 2.4 },
  { x: -15.8, z: 8.6, size: 0.85 }
];

const FLOWERING = [
  { x: -6.5, z: 11.5, kind: 'plum', size: 1 },
  { x: 7.5, z: 12, kind: 'cherry', size: 1.05 },
  { x: 15.5, z: 10, kind: 'plum', size: 0.9 },
  { x: 5, z: -11.5, kind: 'cherry', size: 1 },
  { x: -19, z: -5, kind: 'plum', size: 0.95 },
  { x: -13, z: 13, kind: 'cherry', size: 0.9 }
];

const BAMBOO = [
  { x: -21, z: -14.5, radius: 2.6, count: 40 },
  { x: 21, z: -13.5, radius: 2.4, count: 34 },
  { x: 21.8, z: -0.5, radius: 1.4, count: 20 },
  { x: -18.6, z: 12.6, radius: 2, count: 28 },
  { x: -1, z: -15.5, radius: 2, count: 26 }
];

const SHRUB_CLUSTERS = [
  [-15.8, -5.6, 1.6, 5], [-4.3, -12.8, 1.4, 4], [-16.6, 4.8, 1.5, 5], [-10.2, 6.4, 1.3, 4],
  [-4.6, 14.6, 1.6, 5], [5.6, 14.8, 1.6, 5], [-2.9, 9.6, 1, 3], [5.6, 9.2, 1.2, 3],
  [13.8, -3.6, 1.3, 4], [6.6, -11.6, 1.2, 3], [16.8, 9.8, 1.2, 3], [16.8, 0.2, 1.2, 3],
  [-20.2, -2, 1.6, 5], [19.8, -8.5, 1.5, 4], [12.5, 14.5, 1.8, 5], [-12.5, 13.8, 1.4, 4],
  [-19, 16, 1.4, 4], [-7, -15.5, 1.4, 4], [14, -15.5, 1.6, 4]
];

const LOTUS_BEDS = [
  { x: -6, z: 2.6, radius: 2.2, count: 70 },
  { x: 6.6, z: 1.8, radius: 1.9, count: 55 },
  { x: -4.2, z: -4.6, radius: 1.6, count: 40 },
  { x: 7.2, z: -3.6, radius: 1.4, count: 32 }
];

function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

function noise3(x, y, z) {
  return Math.sin(x * 1.7 + Math.sin(z * 2.3) * 1.3) * Math.cos(z * 1.9 - y * 1.1) * 0.5
    + Math.sin(y * 3.1 + x * 2.7 + z * 0.7) * 0.3
    + Math.sin(x * 5.3 - z * 4.1 + y * 2.9) * 0.2;
}

function pondValue(x, z) {
  return (x / 10) ** 2 + ((z + 0.5) / 6) ** 2;
}

function blocked(x, z, pad = 0) {
  return KEEP_OUT.some((k) => (k.r
    ? Math.hypot(x - k.x, z - k.z) < k.r + pad
    : Math.abs(x - k.x) < k.hx + pad && Math.abs(z - k.z) < k.hz + pad));
}

function inGarden(x, z, margin) {
  return x > -24 + margin && x < 24 - margin && z > -18 + margin && z < 18 - margin;
}

function mergeGeometries(list) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of list) {
    vertexCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const o = (vo + i) * 3;
      position[o] = p.getX(i);
      position[o + 1] = p.getY(i);
      position[o + 2] = p.getZ(i);
      normal[o] = n.getX(i);
      normal[o + 1] = n.getY(i);
      normal[o + 2] = n.getZ(i);
      if (u) {
        uv[(vo + i) * 2] = u.getX(i);
        uv[(vo + i) * 2 + 1] = u.getY(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) index[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function limb(a, b, r0, r1, radial = 7) {
  const dir = new V().subVectors(b, a);
  const len = dir.length();
  const ext = r1 * 0.8;
  const g = new THREE.CylinderGeometry(r1, r0, len + ext, radial, 1, true);
  g.translate(0, (len + ext) / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.divideScalar(len)));
  g.translate(a.x, a.y, a.z);
  return g;
}

function grow(random, start, dir, length, steps, wobble, gravity = 0, twist = 0) {
  const points = [start.clone()];
  const d = dir.clone().normalize();
  const p = start.clone();
  const seg = length / steps;
  const side = new V(random.range(-1, 1), 0, random.range(-1, 1)).normalize();
  const phase = random.range(0, TAU);
  for (let i = 0; i < steps; i++) {
    const s = Math.sin(i * 1.4 + phase) * twist;
    d.x += random.range(-wobble, wobble) + side.x * s;
    d.y += random.range(-wobble, wobble) * 0.5 - gravity;
    d.z += random.range(-wobble, wobble) + side.z * s;
    d.normalize();
    p.addScaledVector(d, seg);
    points.push(p.clone());
  }
  return points;
}

function tube(points, r0, r1, radial) {
  const parts = [];
  const n = points.length - 1;
  for (let i = 0; i < n; i++) {
    parts.push(limb(points[i], points[i + 1], THREE.MathUtils.lerp(r0, r1, i / n), THREE.MathUtils.lerp(r0, r1, (i + 1) / n), radial));
  }
  return parts;
}

function roughen(geometry, amount, freq) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    p.setXYZ(i,
      x + noise3(x * freq, y * freq, z * freq) * amount,
      y + noise3(y * freq + 3, z * freq, x * freq) * amount * 0.3,
      z + noise3(z * freq + 7, x * freq, y * freq) * amount);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function compose(position, quaternion, scale) {
  const s = typeof scale === 'number' ? new V(scale, scale, scale) : scale;
  return new THREE.Matrix4().compose(position, quaternion, s);
}

function basisQuaternion(dir, hint) {
  const y = dir.clone().normalize();
  const z = hint.clone().addScaledVector(y, -hint.dot(y));
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = new V().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function yawQuaternion(yaw, tiltX = 0, tiltZ = 0) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ, 'YXZ'));
}

function randomQuaternion(random) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * TAU, random() * TAU, random() * TAU));
}

function tint(random, value, spread, hue) {
  const k = value * (1 + random.range(-spread, spread));
  return new THREE.Color(k * (1 + random.range(-hue, hue)), k, k * (1 + random.range(-hue, hue)));
}

function leafGeometry(width, length, fold, curl) {
  const w = width / 2;
  const f = fold * w;
  const c = curl * length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -w, length * 0.3, f,
    w, length * 0.3, f,
    0, length * 0.5, -c * 0.3,
    -w * 0.6, length * 0.68, f * 0.6 - c * 0.5,
    w * 0.6, length * 0.68, f * 0.6 - c * 0.5,
    0, length, -c
  ], 3));
  geometry.setIndex([0, 2, 3, 0, 3, 1, 2, 5, 3, 3, 4, 1, 3, 5, 6, 3, 6, 4]);
  geometry.computeVertexNormals();
  return geometry;
}

function foliageBlob(seed, amp, freq) {
  const g = new THREE.SphereGeometry(1, 18, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + amp * noise3(x * freq + seed, y * freq - seed * 0.5, z * freq + seed * 0.3);
    let ny = y * k;
    if (ny < -0.25) ny = -0.25 + (ny + 0.25) * 0.25;
    p.setXYZ(i, x * k, ny, z * k);
  }
  g.computeBoundingBox();
  const box = g.boundingBox;
  g.translate(0, -box.min.y, 0);
  g.scale(1, 1 / (box.max.y - box.min.y), 1);
  g.computeVertexNormals();
  return g;
}

function willowStrandGeometry() {
  const random = createRandom(71);
  const twig = new THREE.CylinderGeometry(0.003, 0.006, 1, 3, 1, true);
  twig.translate(0, -0.5, 0);
  const parts = [twig];
  const count = 30;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.6) / count;
    const yaw = i * 2.39996 + random.range(-0.3, 0.3);
    const spread = random.range(0.35, 0.7);
    const dir = new V(Math.cos(yaw) * Math.sin(spread), -Math.cos(spread), Math.sin(yaw) * Math.sin(spread));
    const leaf = leafGeometry(0.03 * (1 - t * 0.4), 0.075 * (1 - t * 0.35), 0.3, 0.12);
    const sway = Math.sin(t * 5.2) * 0.035;
    leaf.applyMatrix4(compose(new V(sway, -t, sway * 0.6), basisQuaternion(dir, new V(Math.cos(yaw), 0.2, Math.sin(yaw))), 1));
    parts.push(leaf);
  }
  return mergeGeometries(parts);
}

function needleTuftGeometry() {
  const positions = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996;
    const tilt = 0.2 + (i % 4) * 0.2;
    const dir = new V(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
    const tip = dir.multiplyScalar(0.24 + (i % 3) * 0.05);
    const side = new V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.012);
    positions.push(side.x, 0, side.z, -side.x, 0, -side.z, tip.x, tip.y, tip.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function blossomGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.CircleGeometry(0.028, 7);
    petal.scale(0.85, 1.1, 1);
    petal.translate(0, 0.026, 0);
    petal.rotateX(-0.4);
    petal.rotateZ((i / 5) * TAU);
    parts.push(petal);
  }
  return mergeGeometries(parts);
}

function stamenGeometry() {
  const g = new THREE.ConeGeometry(0.013, 0.028, 6);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, 0.012);
  return g;
}

function bambooSprayGeometry() {
  const parts = [limb(new V(0, 0, 0), new V(0.32, 0.06, 0), 0.008, 0.004, 3)];
  const leaves = 6;
  for (let i = 0; i < leaves; i++) {
    const t = 0.35 + (0.65 * i) / (leaves - 1);
    const yaw = (i - (leaves - 1) / 2) * 0.45;
    const droop = 0.35 + (i % 2) * 0.35;
    const dir = new V(Math.cos(yaw) * Math.cos(droop), -Math.sin(droop), Math.sin(yaw) * Math.cos(droop));
    const leaf = leafGeometry(0.055, 0.3 + (i % 3) * 0.05, 0.18, 0.15);
    leaf.applyMatrix4(compose(new V(t * 0.32, t * 0.06, 0), basisQuaternion(dir, UP), 1));
    parts.push(leaf);
  }
  return mergeGeometries(parts);
}

function lotusPadGeometry(cup, notch, wave) {
  const rings = 4;
  const seg = 22;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rings; r++) {
    const rho = r / rings;
    for (let c = 0; c <= seg; c++) {
      const theta = notch / 2 + ((TAU - notch) * c) / seg;
      positions.push(rho * Math.cos(theta), cup * rho * rho + wave * rho * rho * Math.sin(theta * 7), rho * Math.sin(theta));
      uvs.push(0.5 + 0.5 * rho * Math.cos(theta), 0.5 + 0.5 * rho * Math.sin(theta));
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let c = 0; c < seg; c++) {
      const a = r * (seg + 1) + c;
      const b = a + seg + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function petalGeometry(length, width, cup) {
  const rows = 5;
  const cols = 4;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(0.999, u * 0.92 + 0.08)), 0.8);
    for (let j = 0; j <= cols; j++) {
      const v = -1 + (2 * j) / cols;
      positions.push(v * w, u * length, -cup * v * v * w + 0.15 * length * u * u);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function lotusFlowerGeometry() {
  const layers = [
    { n: 5, length: 0.13, width: 0.065, tilt: 0.22, offset: 0 },
    { n: 7, length: 0.16, width: 0.08, tilt: 0.6, offset: 0.4 },
    { n: 8, length: 0.17, width: 0.085, tilt: 1.0, offset: 0.2 }
  ];
  const parts = [];
  for (const layer of layers) {
    for (let i = 0; i < layer.n; i++) {
      const petal = petalGeometry(layer.length, layer.width, 0.7);
      petal.translate(0, 0, 0.015);
      petal.rotateX(layer.tilt);
      petal.rotateY((i / layer.n) * TAU + layer.offset);
      parts.push(petal);
    }
  }
  return mergeGeometries(parts);
}

function lotusPodGeometry() {
  const g = new THREE.CylinderGeometry(0.036, 0.022, 0.04, 10);
  g.translate(0, 0.045, 0);
  return g;
}

function lotusBudGeometry() {
  const profile = [[0, 0], [0.028, 0.02], [0.048, 0.07], [0.044, 0.12], [0.024, 0.17], [0, 0.215]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(profile, 9);
}

function tuftGeometry(seed, blades, height, width, bend) {
  const random = createRandom(seed);
  const positions = [];
  const indices = [];
  const segs = 3;
  for (let b = 0; b < blades; b++) {
    const yaw = b * 2.4 + random.range(-0.3, 0.3);
    const lean = random.range(0.12, bend);
    const h = height * random.range(0.6, 1.1);
    const w = width * random.range(0.7, 1.2);
    const out = new V(Math.cos(yaw), 0, Math.sin(yaw));
    const side = new V(-Math.sin(yaw), 0, Math.cos(yaw));
    const start = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const off = h * (Math.sin(lean) * t + 0.4 * lean * t * t);
      const y = h * Math.cos(lean * 0.6) * t;
      const half = w * (1 - t) * 0.5 + 0.002;
      positions.push(out.x * off - side.x * half, y, out.z * off - side.z * half, out.x * off + side.x * half, y, out.z * off + side.z * half);
    }
    for (let s = 0; s < segs; s++) {
      const a = start + s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function createMaterials(palette) {
  const cache = new Map();
  const solid = (key) => palette[key] ?? palette.leaf;
  const derive = (key, variant, shade, doubleSided) => {
    const id = `${key}:${variant}`;
    if (!cache.has(id)) {
      const m = solid(key).clone();
      if (doubleSided) m.side = THREE.DoubleSide;
      if (shade !== 1 && m.color) m.color.multiplyScalar(shade);
      cache.set(id, m);
    }
    return cache.get(id);
  };
  return {
    solid,
    sheet: (key) => derive(key, 'sheet', 1, true),
    shaded: (key, shade) => derive(key, `shade${shade}`, shade, false)
  };
}

function meshOf(geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function instanced(geometry, material, matrices, colors, name) {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = name;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

function addAll(parent, ...items) {
  for (const item of items) if (item) parent.add(item);
}

function towardPond(spec) {
  return spec.lean ?? Math.atan2(-0.5 - spec.z, -spec.x);
}

function rootFlare(random, parts, count, size, height, spread) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + random.range(-0.25, 0.25);
    parts.push(limb(
      new V(Math.cos(a) * 0.1 * size, height * size, Math.sin(a) * 0.1 * size),
      new V(Math.cos(a) * spread * size, -0.12, Math.sin(a) * spread * size),
      0.16 * size, 0.04 * size, 6));
  }
}

function buildWillow(root, shared, mats, random, spec) {
  const size = spec.size;
  const tree = new THREE.Group();
  tree.name = 'willow-tree';
  tree.position.set(spec.x, 0, spec.z);
  const lean = towardPond(spec);
  const leanDir = new V(Math.cos(lean), 0, Math.sin(lean));
  const trunkPts = grow(random, new V(0, -0.3, 0), new V(leanDir.x * 0.42, 1, leanDir.z * 0.42), 3.4 * size, 5, 0.06, 0, 0.1);
  const trunk = tube(trunkPts, 0.36 * size, 0.21 * size, 10);
  rootFlare(random, trunk, 6, size, 0.6, 0.62);
  const wood = [roughen(mergeGeometries(trunk), 0.035 * size, 4.5)];
  const anchors = [];
  const top = trunkPts[trunkPts.length - 1];
  const fork = trunkPts[trunkPts.length - 2];
  const mains = 7;
  for (let i = 0; i < mains; i++) {
    const a = (i / mains) * TAU + random.range(-0.35, 0.35);
    const dir = new V(Math.cos(a) * 0.75 + leanDir.x * 0.35, random.range(0.9, 1.35), Math.sin(a) * 0.75 + leanDir.z * 0.35);
    const pts = grow(random, i % 2 ? top : fork, dir, random.range(2, 2.8) * size, 5, 0.1, 0.16);
    wood.push(...tube(pts, 0.14 * size, 0.035 * size, 7));
    for (let k = 2; k < pts.length; k++) anchors.push(pts[k]);
    for (let k = 0; k < 2; k++) {
      const sub = new V(dir.x + random.range(-0.8, 0.8), random.range(0.4, 1), dir.z + random.range(-0.8, 0.8));
      const sp = grow(random, pts[2 + k], sub, random.range(0.9, 1.5) * size, 3, 0.15, 0.22);
      wood.push(...tube(sp, 0.055 * size, 0.018 * size, 5));
      for (let j = 1; j < sp.length; j++) anchors.push(sp[j]);
    }
  }
  const crown = top.clone().add(new V(0, 0.9 * size, 0));
  const matrices = [[], []];
  const colors = [[], []];
  const strands = Math.round(300 * size);
  for (let i = 0; i < strands; i++) {
    let p;
    if (random() < 0.65) {
      p = random.pick(anchors).clone().add(new V(random.range(-0.35, 0.35), random.range(-0.15, 0.15), random.range(-0.35, 0.35)));
    } else {
      const a = random() * TAU;
      const e = random.range(0.05, 1);
      p = crown.clone().add(new V(Math.cos(a) * Math.sqrt(e) * 2.5 * size, (1 - e) * size + random.range(-0.3, 0.2), Math.sin(a) * Math.sqrt(e) * 2.5 * size));
    }
    const length = THREE.MathUtils.clamp(p.y - random.range(0.4, 1.6), 0.8, 4.4 * size);
    const w = random.range(0.85, 1.35);
    const bucket = random() < 0.55 ? 0 : 1;
    matrices[bucket].push(compose(p, yawQuaternion(random() * TAU, random.range(-0.08, 0.08), random.range(-0.08, 0.08)), new V(w, length, w)));
    colors[bucket].push(tint(random, 1, 0.12, 0.05));
  }
  addAll(tree,
    meshOf(mergeGeometries(wood), mats.solid('woodDark'), 'willow-wood'),
    instanced(shared.willowStrand, mats.sheet('leaf'), matrices[0], colors[0], 'willow-foliage'),
    instanced(shared.willowStrand, mats.sheet('leafLight'), matrices[1], colors[1], 'willow-foliage-light'));
  root.add(tree);
}

function buildPine(root, shared, mats, random, spec) {
  const size = spec.size;
  const tree = new THREE.Group();
  tree.name = 'pine-tree';
  tree.position.set(spec.x, spec.y ?? 0, spec.z);
  const lean = towardPond(spec);
  const leanDir = new V(Math.cos(lean), 0, Math.sin(lean));
  const trunkPts = grow(random, new V(0, -0.5, 0), new V(leanDir.x * 0.75, 1, leanDir.z * 0.75), 4.8 * size, 7, 0.08, 0, 0.32);
  const trunk = tube(trunkPts, 0.36 * size, 0.1 * size, 9);
  rootFlare(random, trunk, 5, size, 0.45, 0.55);
  const wood = [roughen(mergeGeometries(trunk), 0.045 * size, 3.8)];
  const pads = [];
  for (let i = 2; i < trunkPts.length; i++) {
    const h = i / (trunkPts.length - 1);
    const a = i * 2.3 + random.range(-0.4, 0.4);
    const dir = new V(Math.cos(a), random.range(-0.05, 0.25), Math.sin(a));
    const len = random.range(1.3, 2.3) * size * (1.15 - h * 0.55);
    const pts = grow(random, trunkPts[i], dir, len, 3, 0.2, 0.04);
    wood.push(...tube(pts, 0.11 * size * (1.1 - h * 0.5), 0.03 * size, 6));
    pads.push({ c: pts[pts.length - 1].clone().add(new V(0, 0.12 * size, 0)), s: size * random.range(0.85, 1.25) * (1.1 - h * 0.4) });
    if (random() < 0.5) {
      const sub = new V(dir.x + random.range(-0.9, 0.9), random.range(0, 0.3), dir.z + random.range(-0.9, 0.9));
      const sp = grow(random, pts[1], sub, len * 0.5, 2, 0.2, 0.03);
      wood.push(...tube(sp, 0.05 * size, 0.02 * size, 5));
      pads.push({ c: sp[sp.length - 1].clone().add(new V(0, 0.1 * size, 0)), s: size * random.range(0.55, 0.8) });
    }
  }
  pads.push({ c: trunkPts[trunkPts.length - 1].clone().add(new V(0, 0.15 * size, 0)), s: size * 1.15 });
  const blobs = [];
  const blobColors = [];
  const tufts = [];
  const tuftColors = [];
  for (const pad of pads) {
    const pieces = 3 + Math.floor(random() * 2);
    for (let k = 0; k < pieces; k++) {
      const pos = pad.c.clone().add(new V(random.range(-0.45, 0.45) * pad.s, random.range(-0.16, -0.06) * pad.s, random.range(-0.45, 0.45) * pad.s));
      blobs.push(compose(pos, yawQuaternion(random() * TAU), new V(random.range(0.55, 0.85) * pad.s, random.range(0.22, 0.32) * pad.s, random.range(0.5, 0.8) * pad.s)));
      blobColors.push(tint(random, 0.7, 0.08, 0.04));
    }
    const count = Math.round(70 * pad.s);
    for (let k = 0; k < count; k++) {
      const a = random() * TAU;
      const under = random() < 0.15;
      const rho = under ? random.range(0.8, 1) : Math.sqrt(random());
      const rx = 0.95 * pad.s;
      const ry = 0.24 * pad.s;
      const y = under ? random.range(-0.12, 0) * pad.s : ry * Math.sqrt(1 - rho * rho) * random.range(0.7, 1.1);
      const pos = pad.c.clone().add(new V(Math.cos(a) * rho * rx, y, Math.sin(a) * rho * rx));
      const dir = new V(Math.cos(a) * rho * 1.3, under ? -0.35 : 1, Math.sin(a) * rho * 1.3);
      tufts.push(compose(pos, basisQuaternion(dir, new V(-Math.sin(a), 0, Math.cos(a))), random.range(0.85, 1.3) * Math.sqrt(size)));
      tuftColors.push(tint(random, 1.05, 0.15, 0.05));
    }
  }
  addAll(tree,
    meshOf(mergeGeometries(wood), mats.shaded('wood', 0.8), 'pine-wood'),
    instanced(shared.blob, mats.solid('pine'), blobs, blobColors, 'pine-foliage-mass'),
    instanced(shared.needleTuft, mats.sheet('pine'), tufts, tuftColors, 'pine-needles'));
  root.add(tree);
}

function buildFloweringTree(root, shared, mats, random, spec) {
  const size = spec.size;
  const plum = spec.kind === 'plum';
  const tree = new THREE.Group();
  tree.name = 'flowering-tree';
  tree.userData.kind = spec.kind;
  tree.position.set(spec.x, 0, spec.z);
  const lean = random() * TAU;
  const trunkPts = grow(random, new V(0, -0.2, 0), new V(Math.cos(lean) * 0.35, 1, Math.sin(lean) * 0.35), (plum ? 1.5 : 2) * size, 3, plum ? 0.22 : 0.1);
  const trunk = tube(trunkPts, 0.22 * size, 0.14 * size, 9);
  rootFlare(random, trunk, 4, size * 0.8, 0.45, 0.45);
  const wood = [roughen(mergeGeometries(trunk), 0.03 * size, 5)];
  const twigs = [];
  const branch = (start, dir, len, radius, depth) => {
    const pts = grow(random, start, dir, len, depth > 1 ? 3 : 2, plum ? 0.32 : 0.14, plum ? -0.04 : 0.04);
    wood.push(...tube(pts, radius, radius * 0.65, depth > 1 ? 6 : 4));
    if (depth <= 2) twigs.push({ pts, terminal: depth === 0, depth });
    if (depth === 0) return;
    const kids = depth >= 2 ? 3 : 2 + (random() < 0.5 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const from = k === 0 ? pts[pts.length - 1] : pts[1 + Math.floor(random() * (pts.length - 1))];
      const nd = new V(dir.x + random.range(-0.9, 0.9), dir.y + (plum ? random.range(0, 0.6) : random.range(-0.2, 0.4)), dir.z + random.range(-0.9, 0.9)).normalize();
      branch(from, nd, len * random.range(0.6, 0.78), radius * 0.62, depth - 1);
    }
  };
  const top = trunkPts[trunkPts.length - 1];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + random.range(-0.4, 0.4);
    branch(top, new V(Math.cos(a) * 0.8, random.range(0.7, 1.2), Math.sin(a) * 0.8), (plum ? 1.6 : 2) * size, 0.13 * size, 3);
  }
  const flowers = [];
  const flowerColors = [];
  const buds = [];
  const masses = [];
  const massColors = [];
  const limit = plum ? 2000 : 3200;
  for (const twig of twigs) {
    for (let s = 0; s < twig.pts.length - 1; s++) {
      const a = twig.pts[s];
      const b = twig.pts[s + 1];
      const samples = Math.ceil((a.distanceTo(b) / (plum ? 0.1 : 0.12)) * (plum ? 1 : 1.5) * (twig.depth >= 2 ? 0.55 : 1));
      for (let k = 0; k < samples && flowers.length < limit; k++) {
        const p = a.clone().lerp(b, random());
        const cluster = plum ? 1 + Math.floor(random() * 3) : 3 + Math.floor(random() * 4);
        const spread = plum ? 0.05 : 0.09;
        for (let c = 0; c < cluster; c++) {
          const pos = p.clone().add(new V(random.range(-spread, spread), random.range(-spread, spread * 0.6), random.range(-spread, spread)));
          flowers.push(compose(pos, randomQuaternion(random), random.range(0.8, 1.25)));
          flowerColors.push(tint(random, 1, 0.08, 0.04));
        }
        if (random() < (plum ? 0.3 : 0.12)) buds.push(compose(p.clone().add(new V(random.range(-0.04, 0.04), 0.02, random.range(-0.04, 0.04))), randomQuaternion(random), random.range(0.7, 1.1)));
      }
    }
    if (!plum && twig.terminal && random() < 0.55) {
      const end = twig.pts[twig.pts.length - 1];
      const r = random.range(0.22, 0.38);
      masses.push(compose(end.clone().add(new V(0, -r * 0.18, 0)), yawQuaternion(random() * TAU), new V(r * 1.1, r * 0.92, r * 1.0)));
      massColors.push(tint(random, 0.9, 0.06, 0.03));
    }
  }
  addAll(tree,
    meshOf(mergeGeometries(wood), plum ? mats.solid('woodDark') : mats.solid('wood'), 'flowering-wood'),
    instanced(shared.blossom, mats.sheet('blossom'), flowers, flowerColors, 'blossoms'),
    instanced(shared.stamen, mats.solid('gold'), flowers, null, 'blossom-stamens'),
    instanced(shared.bud, mats.solid('flower'), buds, null, 'blossom-buds'),
    instanced(shared.blob, mats.solid('blossom'), masses, massColors, 'blossom-masses'));
  root.add(tree);
}

function buildBambooGrove(root, shared, mats, random, spec) {
  const grove = new THREE.Group();
  grove.name = 'bamboo-grove';
  grove.position.set(spec.x, 0, spec.z);
  const inward = new V(-spec.x, 0, -spec.z).normalize();
  const culms = [];
  const nodes = [];
  const sprays = [];
  const sprayColors = [];
  const clumps = Array.from({ length: 3 }, () => {
    const a = random() * TAU;
    const r = random() * spec.radius * 0.45;
    return new V(Math.cos(a) * r, 0, Math.sin(a) * r);
  });
  for (let i = 0; i < spec.count; i++) {
    const c = random.pick(clumps);
    const a = random() * TAU;
    const r = Math.sqrt(random()) * spec.radius * 0.45;
    const p = new V(c.x + Math.cos(a) * r, -0.1, c.z + Math.sin(a) * r);
    const young = random() < 0.18;
    const height = young ? random.range(2.2, 3.6) : random.range(5.2, 8.4);
    const r0 = young ? random.range(0.025, 0.035) : random.range(0.038, 0.06);
    const lean = inward.clone().multiplyScalar(random.range(0.02, 0.07)).add(new V(random.range(-0.03, 0.03), 0, random.range(-0.03, 0.03)));
    const dir = new V(lean.x * 0.5, 1, lean.z * 0.5).normalize();
    const segBase = random.range(0.34, 0.46);
    const sprayScale = young ? 0.75 : 1;
    let travelled = 0;
    let k = 0;
    while (travelled < height) {
      const segLen = segBase * (0.55 + 0.45 * Math.min(1, k / 5));
      const h = travelled / height;
      const rad = r0 * (1 - 0.45 * h);
      const next = p.clone().addScaledVector(dir, segLen);
      culms.push(limb(p, next, rad, rad * 0.985, 6));
      const ring = new THREE.CylinderGeometry(rad * 1.16, rad * 1.16, 0.022, 6, 1, false);
      ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
      ring.translate(next.x, next.y, next.z);
      nodes.push(ring);
      if (h > 0.42) {
        const branches = h > 0.75 ? 2 : 1;
        for (let b = 0; b < branches; b++) {
          const yaw = k * Math.PI + b * 1.6 + random.range(-0.5, 0.5);
          sprays.push(compose(next, yawQuaternion(-yaw, 0, random.range(0.15, 0.55)), random.range(0.8, 1.25) * sprayScale));
          sprayColors.push(tint(random, 1, 0.12, 0.08));
        }
      }
      dir.addScaledVector(lean, 0.06 * (1 + h * 2)).normalize();
      p.copy(next);
      travelled += segLen;
      k++;
    }
    for (let t = 0; t < 3; t++) {
      sprays.push(compose(p, yawQuaternion(random() * TAU, 0, random.range(0.6, 1)), random.range(0.7, 1) * sprayScale));
      sprayColors.push(tint(random, 1.05, 0.1, 0.06));
    }
  }
  addAll(grove,
    meshOf(mergeGeometries(culms), mats.solid('bamboo'), 'bamboo-culms'),
    meshOf(mergeGeometries(nodes), mats.shaded('bamboo', 0.78), 'bamboo-nodes'),
    instanced(shared.spray, mats.sheet('bambooLeaf'), sprays, sprayColors, 'bamboo-leaves'));
  root.add(grove);
}

function buildShrubs(root, shared, mats, random, bases) {
  const group = new THREE.Group();
  group.name = 'shrub-planting';
  const kinds = {
    box: { m: [], c: [], geometry: shared.clipped, material: mats.solid('leafDark') },
    loose: { m: [], c: [], geometry: shared.blob, material: mats.solid('leaf') },
    azalea: { m: [], c: [], geometry: shared.blob, material: mats.solid('leafLight') }
  };
  const blooms = [];
  const bloomColors = [];
  for (const [cx, cz, radius, count] of SHRUB_CLUSTERS) {
    for (let i = 0; i < count; i++) {
      const a = random() * TAU;
      const d = Math.sqrt(random()) * radius;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const roll = random();
      const kind = roll < 0.4 ? 'box' : roll < 0.72 ? 'loose' : 'azalea';
      const s = random.range(0.45, 1.05) * (kind === 'loose' ? 1.2 : 1);
      if (blocked(x, z, 0.4) || pondValue(x, z) < 1.15 || !inGarden(x, z, s * 1.5 + 0.3)) continue;
      if (nearGardenPath(x, z, 0.5) || distanceToCorridor(x, z) < 1.9) continue;
      const height = s * (kind === 'box' ? random.range(0.8, 1.05) : random.range(0.95, 1.35));
      const sx = s * random.range(0.9, 1.15);
      const sz = s * random.range(0.9, 1.15);
      kinds[kind].m.push(compose(new V(x, -0.05, z), yawQuaternion(random() * TAU), new V(sx, height, sz)));
      kinds[kind].c.push(tint(random, 1, 0.12, 0.06));
      bases.push({ x, z, r: s });
      if (kind === 'azalea') {
        const n = Math.round(60 * s * s + 12);
        for (let k = 0; k < n; k++) {
          const ba = random() * TAU;
          const e = random.range(0, 1.25);
          const dir = new V(Math.cos(ba) * Math.sin(e), Math.cos(e), Math.sin(ba) * Math.sin(e));
          const pos = new V(x + dir.x * sx * 0.92, height * 0.45 + dir.y * height * 0.52, z + dir.z * sz * 0.92);
          const q = new THREE.Quaternion().setFromUnitVectors(FRONT, dir).multiply(new THREE.Quaternion().setFromAxisAngle(FRONT, random() * TAU));
          blooms.push(compose(pos, q, random.range(1.2, 1.6)));
          bloomColors.push(tint(random, 1, 0.1, 0.05));
        }
      }
    }
  }
  for (const [name, kind] of Object.entries(kinds)) addAll(group, instanced(kind.geometry, kind.material, kind.m, kind.c, `shrub-${name}`));
  addAll(group, instanced(shared.blossom, mats.sheet('flower'), blooms, bloomColors, 'azalea-blooms'));
  root.add(group);
}

function buildGroundCover(root, shared, mats, random, bases) {
  const group = new THREE.Group();
  group.name = 'ground-cover';
  const grass = [];
  const grassColors = [];
  const reeds = [];
  const reedColors = [];
  const tryTuft = (x, z, scale) => {
    if (blocked(x, z, 0.1) || pondValue(x, z) < 1.06 || !inGarden(x, z, 0.9)) return;
    if (nearGardenPath(x, z, 0.3) || distanceToCorridor(x, z) < 1.75) return;
    grass.push(compose(new V(x, 0, z), yawQuaternion(random() * TAU), new V(scale, scale * random.range(0.8, 1.2), scale)));
    grassColors.push(tint(random, 1, 0.15, 0.08));
  };
  for (const base of bases) {
    const n = 2 + Math.floor(random() * 4);
    for (let i = 0; i < n; i++) {
      const a = random() * TAU;
      const d = base.r * random.range(0.8, 1.6);
      tryTuft(base.x + Math.cos(a) * d, base.z + Math.sin(a) * d, random.range(0.7, 1.3));
    }
  }
  for (let i = 0; i < 40; i++) {
    const a = random() * TAU;
    const d = random.range(3.4, 4.4);
    tryTuft(-13 + Math.cos(a) * d, 2 + Math.sin(a) * d, random.range(0.8, 1.4));
  }
  for (let i = 0; i < 70; i++) {
    const a = random() * TAU;
    const k = Math.sqrt(random.range(1.07, 1.3));
    tryTuft(Math.cos(a) * 10 * k, -0.5 + Math.sin(a) * 6 * k, random.range(0.7, 1.2));
  }
  const arcs = [[2.3, 2.9], [3.3, 3.8], [-2.6, -2.1], [-0.9, -0.4], [0.35, 0.8]];
  for (const [a0, a1] of arcs) {
    const n = 9 + Math.floor(random() * 5);
    for (let i = 0; i < n; i++) {
      const a = random.range(a0, a1);
      const k = random.range(0.93, 1.0);
      const x = Math.cos(a) * 10 * k;
      const z = -0.5 + Math.sin(a) * 6 * k;
      if (blocked(x, z, 0.2)) continue;
      const s = random.range(0.8, 1.3);
      reeds.push(compose(new V(x, -0.1, z), yawQuaternion(random() * TAU), new V(s, s * random.range(0.9, 1.3), s)));
      reedColors.push(tint(random, 1, 0.14, 0.08));
    }
  }
  addAll(group,
    instanced(shared.grassTuft, mats.sheet('grass'), grass, grassColors, 'grass-tufts'),
    instanced(shared.reedTuft, mats.sheet('leaf'), reeds, reedColors, 'reed-clumps'));
  root.add(group);
}

function buildLotus(root, shared, mats, random, palette) {
  const lc = palette.lotus?.color;
  const lotusIsLeaf = Boolean(lc) && lc.g > lc.r * 1.05 && lc.g >= lc.b;
  const padKey = lotusIsLeaf ? 'lotus' : 'leaf';
  const flowerKey = lotusIsLeaf ? 'flower' : 'lotus';
  const bed = new THREE.Group();
  bed.name = 'lotus-bed';
  const pads = { m: [], c: [] };
  const cups = { m: [], c: [] };
  const stems = [];
  const flowers = { m: [], c: [] };
  const buds = [];
  for (const spec of LOTUS_BEDS) {
    let placed = 0;
    let tries = 0;
    while (placed < spec.count && tries < spec.count * 8) {
      tries++;
      const a = random() * TAU;
      const d = Math.sqrt(random()) * spec.radius;
      const x = spec.x + Math.cos(a) * d;
      const z = spec.z + Math.sin(a) * d * 0.8;
      if (pondValue(x, z) > 0.84 || Math.hypot(x - 2, z + 2) < 2.5 || (Math.abs(x - 2) < 2.8 && z > 0.3 && z < 8.5)) continue;
      placed++;
      const roll = random();
      if (roll < 0.6) {
        const s = random.range(0.2, 0.46);
        pads.m.push(compose(new V(x, 0.05 + random() * 0.012, z), yawQuaternion(random() * TAU, random.range(-0.03, 0.03), random.range(-0.03, 0.03)), s));
        pads.c.push(tint(random, 1, 0.12, 0.08));
        continue;
      }
      const kind = roll < 0.82 ? 'cup' : roll < 0.93 ? 'flower' : 'bud';
      const h = kind === 'cup' ? random.range(0.35, 1) : kind === 'flower' ? random.range(0.55, 1.15) : random.range(0.45, 0.95);
      const base = new V(x, -0.25, z);
      const dir = new V(random.range(-0.18, 0.18), 1, random.range(-0.18, 0.18)).normalize();
      const len = h + 0.25;
      stems.push(compose(base, new THREE.Quaternion().setFromUnitVectors(UP, dir), new V(1, len, 1)));
      const tip = base.clone().addScaledVector(dir, len);
      if (kind === 'cup') {
        cups.m.push(compose(tip, yawQuaternion(random() * TAU, random.range(-0.45, 0.45), random.range(-0.45, 0.45)), random.range(0.24, 0.4)));
        cups.c.push(tint(random, 1.05, 0.1, 0.06));
      } else if (kind === 'flower') {
        flowers.m.push(compose(tip, yawQuaternion(random() * TAU, random.range(-0.15, 0.15), random.range(-0.15, 0.15)), random.range(0.85, 1.25)));
        flowers.c.push(tint(random, 1, 0.08, 0.04));
      } else {
        buds.push(compose(tip, yawQuaternion(random() * TAU, random.range(-0.12, 0.12), random.range(-0.12, 0.12)), random.range(0.8, 1.2)));
      }
    }
  }
  addAll(bed,
    instanced(shared.lotusPad, mats.sheet(padKey), pads.m, pads.c, 'lotus-pads'),
    instanced(shared.lotusCup, mats.sheet(padKey), cups.m, cups.c, 'lotus-leaves-raised'),
    instanced(shared.lotusStem, mats.solid('leafDark'), stems, null, 'lotus-stems'),
    instanced(shared.lotusFlower, mats.sheet(flowerKey), flowers.m, flowers.c, 'lotus-flowers'),
    instanced(shared.lotusPod, mats.solid('gold'), flowers.m, null, 'lotus-pods'),
    instanced(shared.lotusBud, mats.solid(flowerKey), buds, null, 'lotus-buds'));
  root.add(bed);
}

function createSharedGeometry() {
  const stem = new THREE.CylinderGeometry(0.009, 0.012, 1, 5, 1, true);
  stem.translate(0, 0.5, 0);
  return {
    willowStrand: willowStrandGeometry(),
    needleTuft: needleTuftGeometry(),
    blob: foliageBlob(1.7, 0.2, 2.4),
    clipped: foliageBlob(4.1, 0.07, 1.8),
    blossom: blossomGeometry(),
    stamen: stamenGeometry(),
    bud: new THREE.IcosahedronGeometry(0.022, 0),
    spray: bambooSprayGeometry(),
    lotusPad: lotusPadGeometry(0.04, 0.32, 0.02),
    lotusCup: lotusPadGeometry(0.32, 0, 0.05),
    lotusStem: stem,
    lotusFlower: lotusFlowerGeometry(),
    lotusPod: lotusPodGeometry(),
    lotusBud: lotusBudGeometry(),
    grassTuft: tuftGeometry(11, 11, 0.38, 0.035, 0.7),
    reedTuft: tuftGeometry(23, 14, 1.5, 0.04, 0.35)
  };
}

export function buildVegetation(group, palette) {
  const mats = createMaterials(palette);
  const shared = createSharedGeometry();
  const root = new THREE.Group();
  root.name = 'vegetation';
  const bases = [];
  WILLOWS.forEach((spec, i) => {
    buildWillow(root, shared, mats, createRandom(1100 + i * 37), spec);
    bases.push({ x: spec.x, z: spec.z, r: 0.9 });
  });
  PINES.forEach((spec, i) => {
    buildPine(root, shared, mats, createRandom(2200 + i * 41), spec);
    if (!spec.y) bases.push({ x: spec.x, z: spec.z, r: 0.8 });
  });
  FLOWERING.forEach((spec, i) => {
    buildFloweringTree(root, shared, mats, createRandom(3300 + i * 43), spec);
    bases.push({ x: spec.x, z: spec.z, r: 0.7 });
  });
  BAMBOO.forEach((spec, i) => {
    buildBambooGrove(root, shared, mats, createRandom(4400 + i * 47), spec);
    bases.push({ x: spec.x, z: spec.z, r: spec.radius });
  });
  buildShrubs(root, shared, mats, createRandom(5500), bases);
  buildGroundCover(root, shared, mats, createRandom(6600), bases);
  buildLotus(root, shared, mats, createRandom(7700), palette);
  group.add(root);
  return root;
}
