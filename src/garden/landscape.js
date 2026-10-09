import * as THREE from 'three';
import { POND_CONTROL, CORRIDOR_PATH } from './layout.js';

const TAU = Math.PI * 2;
const WATER_Y = 0.04;

const ISLAND_CENTER = new THREE.Vector2(2, -2);
const ROCKERY_CENTER = new THREE.Vector2(-13, 2);
const BRIDGE_FOOT = new THREE.Vector2(2, 6.2);
const BRIDGE_LANDING = new THREE.Vector2(2, -0.25);

const ROUTES = [
  { id: 'entry', width: 2, style: 'slab', pts: [[0, 18.6], [0, 16.2], [0.5, 13.2], [1.5, 10.2], [2, 8.2], [2, 6.7]] },
  { id: 'west', width: 1.5, style: 'pebble', pts: [[0.5, 13.2], [-3, 11.6], [-7, 9.6], [-11.5, 7.6], [-16.4, 5.2], [-17.8, 1], [-17.2, -3.4], [-14.8, -6.4], [-11, -7.3]] },
  { id: 'east', width: 1.4, style: 'pebble', pts: [[1.5, 10.2], [5, 10.6], [9, 9.2], [12.5, 6.2], [14, 2], [13.6, -2], [12, -4.6]] },
  { id: 'moon', width: 1.3, style: 'pebble', pts: [[12.5, 6.2], [15.7, 8.2], [19, 8.2], [19, 6.3], [19, 5], [19, 3.2]] },
  { id: 'rear', width: 1.2, style: 'pebble', pts: [[-6, -8.3], [-2, -7.9], [2, -8.7], [6, -8.3], [7.9, -7.8]] }
];

const STEPPING = [
  [[-11.8, 7.1], [-12.3, 6.1], [-12.7, 5.15], [-13, 4.35]],
  [[3.1, 12.3], [4.5, 13.2], [5.9, 13.9]],
  [[4, -8.1], [4.3, -7.3], [4.6, -6.6]],
  [[-16.9, -4.6], [-18.2, -5.6], [-19.3, -6.9], [-20, -8.4]]
];

export const GARDEN_PATHS = Object.freeze(
  ROUTES.map((route) => Object.freeze({ pts: Object.freeze(openCurve(route.pts, 0.3)), half: route.width / 2 }))
);

export function distanceToCorridor(x, z) {
  let best = Infinity;
  for (let i = 0; i < CORRIDOR_PATH.length - 1; i++) {
    const [ax, az] = CORRIDOR_PATH[i];
    const [bx, bz] = CORRIDOR_PATH[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export function nearGardenPath(x, z, pad = 0.3) {
  for (const route of GARDEN_PATHS) {
    const limit = route.half + pad;
    for (const p of route.pts) {
      if ((p.x - x) ** 2 + (p.y - z) ** 2 < limit * limit) return true;
    }
  }
  return false;
}

const COURTYARDS = [
  { id: 'hall-terrace', x: [-15.5, -4.5], z: [-13.5, -7], tile: 1, mats: ['stone', 'stoneLight'] },
  { id: 'entrance-forecourt', x: [-4.5, 4.5], z: [14.8, 18.4], tile: 0.8, mats: ['stoneLight', 'stone'] },
  { id: 'moon-courtyard', x: [19.8, 23.6], z: [1.2, 8.8], tile: 0.7, mats: ['stone', 'stoneLight'] }
];

const KEEP_OUT = [
  { x: [7.5, 12.5], z: [-9.6, -4.4] },
  { x: [-3, 3], z: [16, 18.6] }
];

const BEDS = [
  [-7, 15.4, 2.3, 1.2], [7, 15.6, 2.2, 1.2], [-20, 10.5, 3, 2], [20.5, 12.5, 2.6, 1.8],
  [-20.5, -12.5, 2.6, 1.8], [16.5, -12, 3, 1.6], [-1, -11.5, 2.6, 1.2], [21.7, 3, 1.2, 1]
];

const BERMS = [
  [-20, -15, 4.5, 3, 0.9], [19, -15, 4, 2.6, 0.8], [-21.5, 15, 3.5, 2.4, 0.7], [21.5, 15.5, 3, 2, 0.6], [-21.5, 0, 2.4, 4, 0.6]
];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

function fbm(x, y, z, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

function rockGeometry(seed, { detail = 1, rough = 0.45, cavity = 0, twist = 0, bend = 0 } = {}) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1 + (fbm(v.x * 1.7 + seed, v.y * 1.7 + seed * 0.37, v.z * 1.7 - seed) - 0.5) * rough * 2;
    if (cavity > 0) {
      const c = noise3(v.x * 3.1 - seed, v.y * 3.1 + seed, v.z * 3.1 + seed * 0.5);
      if (c > 0.56) r -= (c - 0.56) * cavity * 3.2;
    }
    r = Math.max(r, 0.34);
    v.multiplyScalar(r);
    v.y += Math.sin(v.y * 7 + seed) * 0.035 * rough;
    if (twist) {
      const a = v.y * twist;
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = v.x * ca - v.z * sa;
      v.z = v.x * sa + v.z * ca;
      v.x = x;
    }
    if (bend) v.x += bend * v.y * v.y;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function moundGeometry(seed, rough = 0.25, ws = 24, hs = 10) {
  const geo = new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + (fbm(x * 1.3 + seed, y * 1.3, z * 1.3 - seed) - 0.5) * rough * 2;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function flatStoneGeometry(seed) {
  const geo = new THREE.CylinderGeometry(1, 1.06, 1, 11, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 0.82 + 0.3 * noise3(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 - seed, seed * 0.3);
    const top = y > 0 ? 1 + (noise3(x * 2 + seed, 0, z * 2) - 0.5) * 0.4 : 1;
    pos.setXYZ(i, x * k, y * top, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function customGeometry(positions, indices, eye) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3(), center = new THREE.Vector3();
  for (let t = 0; t < indices.length; t += 3) {
    a.fromArray(positions, indices[t] * 3);
    b.fromArray(positions, indices[t + 1] * 3);
    c.fromArray(positions, indices[t + 2] * 3);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    center.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const dir = eye(center.clone()).sub(center);
    if (n.dot(dir) < 0) {
      const tmp = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = tmp;
    }
  }
  const uvs = [];
  for (let i = 0; i < positions.length; i += 3) uvs.push(positions[i] * 0.35, positions[i + 2] * 0.35);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const upEye = (c) => c.add(new THREE.Vector3(0, 10, 0));

function ringSurface(rings, center, eye) {
  const n = rings[0].length;
  const positions = [];
  for (const ring of rings) for (const p of ring) positions.push(p.x, p.y, p.z);
  positions.push(center.x, center.y, center.z);
  const indices = [];
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = r * n + i, b = r * n + j, c = (r + 1) * n + i, d = (r + 1) * n + j;
      indices.push(a, b, c, b, d, c);
    }
  }
  const last = (rings.length - 1) * n, ci = rings.length * n;
  for (let i = 0; i < n; i++) indices.push(last + i, last + ((i + 1) % n), ci);
  return customGeometry(positions, indices, eye);
}

function loopStrip(inner, outer, yInner, yOuter) {
  const n = inner.length;
  const positions = [];
  for (const p of inner) positions.push(p.x, yInner, p.y);
  for (const p of outer) positions.push(p.x, yOuter, p.y);
  const indices = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, j, n + i, j, n + j, n + i);
  }
  return customGeometry(positions, indices, upEye);
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function normalsOf(pts) {
  const s = signedArea(pts) > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const t = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    return new THREE.Vector2(t.y * s, -t.x * s);
  });
}

function tangentsOf(pts, closed) {
  return pts.map((p, i) => {
    const a = closed ? pts[(i - 1 + pts.length) % pts.length] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % pts.length] : pts[Math.min(pts.length - 1, i + 1)];
    return new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
  });
}

function offsetLoop(pts, normals, d) {
  return pts.map((p, i) => p.clone().addScaledVector(normals[i], typeof d === 'function' ? d(i) : d));
}

function centroid(pts) {
  const c = new THREE.Vector2();
  for (const p of pts) c.add(p);
  return c.multiplyScalar(1 / pts.length);
}

function insidePolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function closedCurve(control, count) {
  const curve = new THREE.CatmullRomCurve3(control.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  return curve.getSpacedPoints(count).slice(0, count).map((p) => new THREE.Vector2(p.x, p.z));
}

function openCurve(control, spacing) {
  const curve = new THREE.CatmullRomCurve3(control.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() / spacing));
  return curve.getSpacedPoints(n).map((p) => new THREE.Vector2(p.x, p.z));
}

function irregularLoop(cx, cz, rx, rz, count, seed, amount = 0.14) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const k = 1 + amount * (Math.sin(3 * a + seed) * 0.6 + Math.sin(5 * a + seed * 2.3) * 0.4) + (noise3(Math.cos(a) * 2 + seed, Math.sin(a) * 2, seed) - 0.5) * amount;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k));
  }
  return pts;
}

function mesh(geo, mat, { name, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

function instanced(geo, mat, items, name) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(items.length, 1));
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    d.position.set(it.p[0], it.p[1], it.p[2]);
    d.rotation.set(...(it.r || [0, 0, 0]));
    d.scale.set(...(it.s || [1, 1, 1]));
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  });
  m.count = items.length;
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  if (name) m.name = name;
  return m;
}

function yawFor(t) {
  return Math.atan2(-t.y, t.x);
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

function createShared() {
  const torus = new THREE.TorusGeometry(1, 0.42, 8, 18);
  const tp = torus.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    const k = 1 + (noise3(x * 2.2 + 4, y * 2.2, z * 2.2) - 0.5) * 0.5;
    tp.setXYZ(i, x * k, y * k, z * k * 1.3);
  }
  torus.computeVertexNormals();
  return {
    cavity: new THREE.SphereGeometry(1, 12, 9),
    torus,
    moss: moundGeometry(3.3, 0.45, 12, 5),
    cushion: moundGeometry(8.1, 0.35, 14, 6),
    box: new THREE.BoxGeometry(1, 1, 1),
    pebble: new THREE.IcosahedronGeometry(1, 0),
    bloom: new THREE.IcosahedronGeometry(1, 1),
    stones: Array.from({ length: 14 }, (_, i) => rockGeometry(i * 3.7 + 1.3, { detail: 1, rough: 0.5 })),
    boulders: Array.from({ length: 8 }, (_, i) => rockGeometry(i * 5.3 + 40, { detail: 2, rough: 0.55, cavity: 0.5 })),
    flats: Array.from({ length: 6 }, (_, i) => flatStoneGeometry(i * 2.9 + 7))
  };
}

function taihuRock(ctx, height, seed, mat) {
  const { palette, shared } = ctx;
  const r = rng(Math.floor(seed * 7919) + 17);
  const g = new THREE.Group();
  g.name = 'taihu-rock';
  const n = Math.min(5, Math.max(2, Math.round(height / 0.8)));
  const width = height * (0.27 + r() * 0.08);
  const half = (height / n) * 0.8;
  let ox = 0, oz = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = half + t * (height - 2 * half);
    const waist = 1 - 0.32 * Math.sin(t * Math.PI);
    const crown = i === n - 1 ? 1.18 : 1;
    const w = width * waist * crown * (0.85 + r() * 0.3);
    const geo = rockGeometry(seed * 3.1 + i * 1.7, { detail: 2, rough: 0.62, cavity: 1.15, twist: (r() - 0.5) * 1.3 });
    const lump = mesh(geo, mat || palette.stoneLight);
    lump.scale.set(w, half * 1.08, w * (0.62 + r() * 0.36));
    lump.position.set(ox, y, oz);
    lump.rotation.set((r() - 0.5) * 0.25, r() * TAU, (r() - 0.5) * 0.32);
    g.add(lump);
    const holes = 1 + Math.floor(r() * 3);
    for (let k = 0; k < holes; k++) {
      const a = r() * TAU, e = (r() - 0.5) * 0.9;
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      const cav = mesh(shared.cavity, palette.stoneDark, { cast: false });
      cav.position.copy(dir).multiplyScalar(0.84);
      cav.scale.set(0.18 + r() * 0.16, 0.24 + r() * 0.2, 0.18 + r() * 0.16);
      lump.add(cav);
    }
    if (i > 0 && r() < 0.65) {
      const a = r() * TAU;
      const dir = new THREE.Vector3(Math.cos(a), (r() - 0.5) * 0.4, Math.sin(a)).normalize();
      const ring = mesh(shared.torus, mat || palette.stoneLight);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      ring.position.copy(dir).multiplyScalar(0.86);
      ring.scale.setScalar(0.24 + r() * 0.1);
      lump.add(ring);
      const throat = mesh(shared.cavity, palette.stoneDark, { cast: false });
      throat.position.copy(dir).multiplyScalar(0.8);
      throat.scale.setScalar(0.17);
      lump.add(throat);
    }
    if (i === n - 1 || r() < 0.3) {
      const pads = 1 + Math.floor(r() * 2);
      for (let k = 0; k < pads; k++) {
        const moss = mesh(shared.moss, palette.moss, { cast: false });
        moss.position.set((r() - 0.5) * 0.6, 0.78 + r() * 0.08, (r() - 0.5) * 0.6);
        moss.scale.set(0.38 + r() * 0.2, 0.16, 0.32 + r() * 0.2);
        moss.rotation.y = r() * TAU;
        lump.add(moss);
      }
    }
    ox += (r() - 0.5) * w * 0.5;
    oz += (r() - 0.5) * w * 0.5;
  }
  const feet = 2 + Math.floor(r() * 3);
  for (let k = 0; k < feet; k++) {
    const a = r() * TAU;
    const s = width * (0.25 + r() * 0.25);
    const foot = mesh(pick(r, shared.stones), pick(r, [palette.stone, palette.stoneDark, mat || palette.stoneLight]));
    foot.position.set(Math.cos(a) * width * 0.95, s * 0.3, Math.sin(a) * width * 0.95);
    foot.scale.set(s, s * 0.6, s * 0.8);
    foot.rotation.y = r() * TAU;
    g.add(foot);
  }
  return g;
}

function buildGround(ctx) {
  const { palette, pond } = ctx;
  const g = new THREE.Group();
  g.name = 'garden-ground';
  const shape = new THREE.Shape();
  shape.moveTo(-26, -20);
  shape.lineTo(26, -20);
  shape.lineTo(26, 20);
  shape.lineTo(-26, 20);
  shape.closePath();
  shape.holes.push(new THREE.Path(pond.map((p) => new THREE.Vector2(p.x, -p.y))));
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.rotateX(-Math.PI / 2);
  g.add(mesh(geo, palette.grass, { name: 'ground', cast: false }));
  BERMS.forEach(([x, z, rx, rz, h], i) => {
    const bx = Math.max(-(22.55 - rx), Math.min(22.55 - rx, x));
    const bz = Math.max(-(16.55 - rz), Math.min(16.55 - rz, z));
    const berm = mesh(moundGeometry(i * 4.7 + 2, 0.3, 28, 10), palette.grass, { name: 'earth-berm' });
    berm.position.set(bx, -0.05, bz);
    berm.scale.set(rx, h, rz);
    berm.rotation.y = i * 0.7;
    g.add(berm);
  });
  return g;
}

function buildPond(ctx) {
  const { palette, pond, pondNormals, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'pond';
  const shape = new THREE.Shape(pond.map((p) => new THREE.Vector2(p.x, -p.y)));
  const waterGeo = new THREE.ShapeGeometry(shape, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const water = mesh(waterGeo, palette.water, { name: 'pond-water', cast: false });
  water.position.y = WATER_Y;
  water.renderOrder = 2;
  g.add(water);
  const c = centroid(pond);
  const ring2 = offsetLoop(pond, pondNormals, -0.7);
  const rings = [
    pond.map((p) => new THREE.Vector3(p.x, 0, p.y)),
    offsetLoop(pond, pondNormals, -0.12).map((p) => new THREE.Vector3(p.x, -0.42, p.y)),
    ring2.map((p) => new THREE.Vector3(p.x, -0.7, p.y)),
    ring2.map((p) => new THREE.Vector3(p.x + (c.x - p.x) * 0.5, -0.88, p.y + (c.y - p.y) * 0.5))
  ];
  const basinGeo = ringSurface(rings, new THREE.Vector3(c.x, -0.95, c.y), () => new THREE.Vector3(c.x, 4, c.y));
  g.add(mesh(basinGeo, palette.stoneDark, { name: 'pond-basin', cast: false }));
  const bed = [];
  for (let i = 0; i < 70; i++) {
    const x = -9 + rand() * 18, z = -6 + rand() * 11;
    if (!insidePolygon(x, z, ring2)) continue;
    const s = 0.08 + rand() * 0.25;
    bed.push({ p: [x, -0.82 + rand() * 0.1, z], r: [rand(), rand() * TAU, rand()], s: [s, s * 0.5, s * 0.8] });
  }
  g.add(instanced(shared.pebble, palette.stone, bed, 'pond-bed-stones'));
  return g;
}

function placeEdgeStone(ctx, group, x, z, yaw, w, h, d, mat, sink = 0.35) {
  const { shared, rand } = ctx;
  const s = mesh(pick(rand, shared.stones), mat);
  s.position.set(x, h * sink, z);
  s.scale.set(w, h, d);
  s.rotation.set((rand() - 0.5) * 0.25, yaw + (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.25);
  group.add(s);
  return s;
}

function buildShore(ctx) {
  const { palette, pond, pondNormals, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'pond-shore';
  const bank = loopStrip(offsetLoop(pond, pondNormals, -0.04), offsetLoop(pond, pondNormals, (i) => 0.75 + 0.35 * Math.sin(i * 0.37) ** 2), 0.016, 0.006);
  g.add(mesh(bank, palette.moss, { name: 'shore-moss-bank', cast: false }));
  const tangents = tangentsOf(pond, true);
  const stoneMats = [palette.stone, palette.stone, palette.stoneDark, palette.stoneLight];
  const moss = [];
  let carry = 0;
  for (let i = 0; i < pond.length; i++) {
    const p = pond[i], q = pond[(i + 1) % pond.length];
    carry += p.distanceTo(q);
    if (carry < 0.36 + rand() * 0.2) continue;
    carry = 0;
    if (p.distanceTo(BRIDGE_FOOT) < 1.25) continue;
    const n = pondNormals[i], yaw = yawFor(tangents[i]);
    const lo = 0.05 + rand() * 0.2;
    const w = 0.32 + rand() * 0.32, h = 0.2 + rand() * 0.16, d = 0.28 + rand() * 0.22;
    placeEdgeStone(ctx, g, p.x + n.x * lo, p.y + n.y * lo, yaw, w, h, d, pick(rand, stoneMats));
    if (rand() < 0.38) moss.push({ p: [p.x + n.x * lo, h * 0.95, p.y + n.y * lo], r: [0, rand() * TAU, 0], s: [w * 0.55, 0.05, d * 0.5] });
    if (rand() < 0.55) {
      const up = 0.45 + rand() * 0.35;
      const uw = 0.35 + rand() * 0.4, uh = 0.26 + rand() * 0.3;
      placeEdgeStone(ctx, g, p.x + n.x * up, p.y + n.y * up, yaw, uw, uh, 0.3 + rand() * 0.25, pick(rand, stoneMats), 0.45);
      if (rand() < 0.3) moss.push({ p: [p.x + n.x * up, uh * 1.15, p.y + n.y * up], r: [0, rand() * TAU, 0], s: [uw * 0.5, 0.05, uw * 0.4] });
    }
    if (rand() < 0.12) {
      const off = 0.6 + rand() * 0.4;
      const th = 0.55 + rand() * 0.45;
      const accent = mesh(pick(rand, shared.boulders), palette.stoneLight);
      accent.position.set(p.x + n.x * off, th * 0.55, p.y + n.y * off);
      accent.scale.set(0.3 + rand() * 0.15, th, 0.25 + rand() * 0.12);
      accent.rotation.set((rand() - 0.5) * 0.3, rand() * TAU, (rand() - 0.5) * 0.3);
      g.add(accent);
    }
    if (rand() < 0.3) {
      const off = -0.22 - rand() * 0.25;
      placeEdgeStone(ctx, g, p.x + n.x * off, p.y + n.y * off, yaw, 0.3 + rand() * 0.22, 0.16 + rand() * 0.08, 0.25 + rand() * 0.15, palette.stoneDark, -0.1);
    }
  }
  g.add(instanced(shared.moss, palette.moss, moss, 'shore-moss'));
  return g;
}

function buildIsland(ctx) {
  const { palette, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'pond-island';
  const outline = irregularLoop(ISLAND_CENTER.x, ISLAND_CENTER.y, 1.75, 1.6, 30, 2.4, 0.13);
  const cx = ISLAND_CENTER.x, cz = ISLAND_CENTER.y;
  const at = (k, y) => outline.map((p) => new THREE.Vector3(cx + (p.x - cx) * k, y, cz + (p.y - cz) * k));
  const rings = [at(1.14, -0.4), at(1, 0.1), at(0.74, 0.3), at(0.42, 0.44)];
  const eye = (c) => new THREE.Vector3(c.x + (c.x - cx) * 1.5, c.y + 2, c.z + (c.z - cz) * 1.5);
  g.add(mesh(ringSurface(rings, new THREE.Vector3(cx, 0.5, cz), eye), palette.moss, { name: 'island-earth' }));
  const normals = normalsOf(outline);
  const tangents = tangentsOf(outline, true);
  outline.forEach((p, i) => {
    const dir = new THREE.Vector2(p.x - cx, p.y - cz);
    if (p.distanceTo(BRIDGE_LANDING) < 0.7) return;
    const n = normals[i];
    const w = 0.3 + rand() * 0.25, h = 0.2 + rand() * 0.18;
    placeEdgeStone(ctx, g, p.x + n.x * 0.05, p.y + n.y * 0.05, yawFor(tangents[i]), w, h, 0.28 + rand() * 0.15, pick(rand, [palette.stone, palette.stoneDark, palette.stone]), 0.3);
    if (i % 3 === 0) placeEdgeStone(ctx, g, p.x - dir.x * 0.18, p.y - dir.y * 0.18, rand() * TAU, w * 0.9, h * 1.4, w * 0.8, palette.stone, 0.55);
  });
  const landing = mesh(shared.flats[0], palette.stoneLight, { name: 'island-landing' });
  landing.position.set(BRIDGE_LANDING.x, 0.12, BRIDGE_LANDING.y + 0.05);
  landing.scale.set(0.75, 0.1, 0.5);
  g.add(landing);
  const rock = taihuRock(ctx, 1.6, 21.7, palette.stoneLight);
  rock.position.set(cx - 0.6, 0.32, cz - 0.55);
  g.add(rock);
  for (let k = 0; k < 4; k++) {
    const b = mesh(pick(rand, shared.boulders), palette.stone);
    const a = 2.6 + k * 0.7;
    b.position.set(cx + Math.cos(a) * 0.9, 0.35, cz + Math.sin(a) * 0.8);
    const s = 0.22 + rand() * 0.2;
    b.scale.set(s, s * 0.8, s);
    g.add(b);
  }
  const moss = [];
  for (let k = 0; k < 7; k++) {
    const a = rand() * TAU, r = rand() * 1.1;
    moss.push({ p: [cx + Math.cos(a) * r, 0.42 - r * 0.2, cz + Math.sin(a) * r], r: [0, rand() * TAU, 0], s: [0.3 + rand() * 0.3, 0.06, 0.25 + rand() * 0.25] });
  }
  g.add(instanced(shared.cushion, palette.leafDark, moss, 'island-groundcover'));
  return g;
}

function ribbon(points, half, y) {
  const tangents = tangentsOf(points, false);
  const positions = [];
  points.forEach((p, i) => {
    const t = tangents[i];
    const wob = half * (1 + (noise3(p.x * 0.7, 0, p.y * 0.7) - 0.5) * 0.12);
    positions.push(p.x - t.y * wob, y, p.y + t.x * wob, p.x + t.y * wob, y, p.y - t.x * wob);
  });
  const indices = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return customGeometry(positions, indices, upEye);
}

function buildPaths(ctx) {
  const { palette, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'garden-path';
  const bricks = [], slabs = [], light = [], dark = [], motifs = [];
  for (const route of ROUTES) {
    const pts = openCurve(route.pts, 0.25);
    const half = route.width / 2;
    ctx.routes.push({ pts, half });
    g.add(mesh(ribbon(pts, half, 0.022), palette.path, { name: `path-${route.id}`, cast: false }));
    const tangents = tangentsOf(pts, false);
    pts.forEach((p, i) => {
      const t = tangents[i], yaw = yawFor(t);
      for (const side of [-1, 1]) {
        const o = half + 0.05;
        bricks.push({ p: [p.x - t.y * o * side, 0.04, p.y + t.x * o * side], r: [0, yaw + (rand() - 0.5) * 0.06, 0], s: [0.23, 0.09, 0.1] });
      }
    });
    if (route.style === 'slab') {
      for (let i = 0, row = 0; i < pts.length; i += 3, row++) {
        const p = pts[i], t = tangents[i], yaw = yawFor(t);
        const cols = row % 2 === 0 ? 2 : 3;
        const span = (route.width - 0.24) / cols;
        for (let c = 0; c < cols; c++) {
          const lat = -((route.width - 0.24) / 2) + span * (c + 0.5);
          slabs.push({ p: [p.x - t.y * lat, 0.035 + rand() * 0.012, p.y + t.x * lat], r: [0, yaw + (rand() - 0.5) * 0.04, 0], s: [0.68, 0.05, span - 0.05] });
        }
      }
    } else {
      const count = Math.floor(pts.length * 0.25 * route.width * 5);
      for (let k = 0; k < count; k++) {
        const i = Math.floor(rand() * pts.length);
        const p = pts[i], t = tangents[i];
        const lat = (rand() * 2 - 1) * (half - 0.1);
        const s = 0.05 + rand() * 0.04;
        (rand() < 0.6 ? light : dark).push({ p: [p.x - t.y * lat + t.x * (rand() - 0.5) * 0.25, 0.03, p.y + t.x * lat + t.y * (rand() - 0.5) * 0.25], r: [0, rand() * TAU, 0], s: [s, 0.022, s * 0.7] });
      }
      for (let i = 4; i < pts.length - 4; i += 9) {
        const p = pts[i];
        motifs.push({ p: [p.x, 0.035, p.y], r: [0, 0, 0], s: [0.1, 0.025, 0.1] });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          dark.push({ p: [p.x + Math.cos(a) * 0.26, 0.032, p.y + Math.sin(a) * 0.26], r: [0, -a, 0], s: [0.1, 0.022, 0.045] });
        }
      }
    }
  }
  g.add(instanced(shared.box, palette.stoneDark, bricks, 'path-edging'));
  g.add(instanced(shared.box, palette.stoneLight, slabs, 'path-slabs'));
  g.add(instanced(shared.pebble, palette.stoneLight, light, 'path-pebbles-light'));
  g.add(instanced(shared.pebble, palette.stoneDark, dark, 'path-pebbles-dark'));
  g.add(instanced(shared.pebble, palette.gold, motifs, 'path-mosaic-centres'));
  const steps = new THREE.Group();
  steps.name = 'stepping-stones';
  for (const line of STEPPING) {
    const pts = openCurve(line, 0.62);
    ctx.routes.push({ pts, half: 0.4 });
    pts.forEach((p) => {
      const s = mesh(pick(rand, shared.flats), pick(rand, [palette.stone, palette.stoneLight]));
      s.position.set(p.x + (rand() - 0.5) * 0.12, 0.05, p.y + (rand() - 0.5) * 0.12);
      s.scale.set(0.3 + rand() * 0.12, 0.09, 0.26 + rand() * 0.1);
      s.rotation.y = rand() * TAU;
      steps.add(s);
    });
  }
  g.add(steps);
  return g;
}

function buildCourtyards(ctx) {
  const { palette, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'courtyards';
  for (const court of COURTYARDS) {
    const [x0, x1] = court.x, [z0, z1] = court.z;
    const w = x1 - x0, d = z1 - z0;
    const base = mesh(shared.box, palette.path, { name: court.id, cast: false });
    base.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    base.scale.set(w, 0.024, d);
    g.add(base);
    const tilesA = [], tilesB = [], border = [];
    const nx = Math.floor((w - 0.3) / court.tile), nz = Math.floor((d - 0.3) / court.tile);
    const sx = (w - nx * court.tile) / 2, sz = (d - nz * court.tile) / 2;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const item = { p: [x0 + sx + (i + 0.5) * court.tile, 0.034 + rand() * 0.008, z0 + sz + (j + 0.5) * court.tile], r: [0, (rand() - 0.5) * 0.03, 0], s: [court.tile - 0.06, 0.04, court.tile - 0.06] };
        ((i + j) % 2 === 0 && rand() < 0.8 ? tilesA : tilesB).push(item);
      }
    }
    for (let x = x0 + 0.15; x < x1; x += 0.3) {
      border.push({ p: [x, 0.045, z0 + 0.06], s: [0.28, 0.08, 0.12] }, { p: [x, 0.045, z1 - 0.06], s: [0.28, 0.08, 0.12] });
    }
    for (let z = z0 + 0.15; z < z1; z += 0.3) {
      border.push({ p: [x0 + 0.06, 0.045, z], s: [0.12, 0.08, 0.28] }, { p: [x1 - 0.06, 0.045, z], s: [0.12, 0.08, 0.28] });
    }
    g.add(instanced(shared.box, palette[court.mats[0]], tilesA, `${court.id}-tiles`));
    g.add(instanced(shared.box, palette[court.mats[1]], tilesB, `${court.id}-tiles-alt`));
    g.add(instanced(shared.box, palette.stoneDark, border, `${court.id}-border`));
  }
  return g;
}

function buildRockery(ctx) {
  const { palette, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'rockery';
  g.position.set(ROCKERY_CENTER.x, 0, ROCKERY_CENTER.y);
  const base = mesh(moundGeometry(11.2, 0.35, 30, 10), palette.moss, { name: 'rockery-mound' });
  base.scale.set(3.4, 0.55, 3);
  g.add(base);
  const peaks = [
    [-0.2, -0.4, 4.4, 1.1], [1.4, 0.8, 3.1, 2.3], [-1.7, -1.2, 2.7, 3.7], [1.1, -1.5, 2.2, 4.9],
    [-2.4, 0.8, 1.9, 6.1], [2.4, -0.2, 1.5, 7.3], [0.2, -2.6, 1.4, 8.5], [-1.2, -2.5, 1.2, 9.7]
  ];
  const peakGroup = new THREE.Group();
  peakGroup.name = 'rockery-peaks';
  for (const [x, z, h, seed] of peaks) {
    const rock = taihuRock(ctx, h, seed, palette.stoneLight);
    rock.position.set(x, 0.15, z);
    rock.rotation.y = rand() * TAU;
    peakGroup.add(rock);
  }
  g.add(peakGroup);
  const grotto = new THREE.Group();
  grotto.name = 'rockery-grotto';
  for (const [x, z, h, seed] of [[-1, 2.2, 1.9, 12.4], [0.95, 2.4, 1.7, 13.9]]) {
    const pillar = taihuRock(ctx, h, seed, palette.stone);
    pillar.position.set(x, 0, z);
    grotto.add(pillar);
  }
  const lintel = mesh(rockGeometry(17.3, { detail: 2, rough: 0.6, cavity: 0.9 }), palette.stoneLight, { name: 'grotto-lintel' });
  lintel.position.set(0, 1.85, 2.3);
  lintel.scale.set(1.65, 0.48, 0.8);
  lintel.rotation.set(0.05, 0.1, -0.06);
  grotto.add(lintel);
  const throat = mesh(shared.cavity, palette.stoneDark, { name: 'grotto-shadow', cast: false });
  throat.position.set(0, 0.85, 1.65);
  throat.scale.set(0.75, 0.85, 0.55);
  grotto.add(throat);
  const crownMoss = mesh(shared.moss, palette.moss, { cast: false });
  crownMoss.position.set(0.1, 2.25, 2.3);
  crownMoss.scale.set(0.9, 0.18, 0.5);
  grotto.add(crownMoss);
  g.add(grotto);
  const fill = new THREE.Group();
  fill.name = 'rockery-boulders';
  for (let k = 0; k < 22; k++) {
    const a = rand() * TAU, r = 1.3 + rand() * 1.9;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
    if (z > 1.6 && Math.abs(x) < 0.7) continue;
    const s = 0.3 + rand() * 0.45;
    const b = mesh(pick(rand, shared.boulders), pick(rand, [palette.stone, palette.stoneLight, palette.stoneDark]));
    b.position.set(x, s * 0.45 + Math.max(0, 0.45 - r * 0.12), z);
    b.scale.set(s * (1 + rand() * 0.5), s * (0.7 + rand() * 0.4), s);
    b.rotation.set(rand() * 0.4, rand() * TAU, rand() * 0.4);
    fill.add(b);
  }
  for (const [x, z, s] of [[2.7, 1.2, 0.75], [3.1, -0.6, 0.95], [2.9, -1.8, 0.7], [3.4, 0.3, 0.5]]) {
    const b = mesh(pick(rand, shared.boulders), palette.stone);
    b.position.set(x, s * 0.3, z);
    b.scale.set(s * 1.2, s * 0.8, s);
    b.rotation.y = rand() * TAU;
    fill.add(b);
  }
  const ledges = [[1.6, 2.7, 0.18], [1.9, 1.9, 0.42], [1.6, 1.15, 0.68], [0.9, 0.6, 0.95]];
  ledges.forEach(([x, z, y], i) => {
    const step = mesh(shared.flats[i % shared.flats.length], palette.stone, { name: 'rockery-step' });
    step.position.set(x, y, z);
    step.scale.set(0.38, 0.12, 0.3);
    step.rotation.y = i * 0.8;
    fill.add(step);
  });
  g.add(fill);
  const moss = [];
  for (let k = 0; k < 26; k++) {
    const a = rand() * TAU, r = 0.8 + rand() * 2.6;
    moss.push({ p: [Math.cos(a) * r, 0.48 - r * 0.1, Math.sin(a) * r * 0.9], r: [0, rand() * TAU, 0], s: [0.3 + rand() * 0.4, 0.07, 0.25 + rand() * 0.3] });
  }
  g.add(instanced(shared.moss, palette.moss, moss, 'rockery-moss'));
  const ferns = [];
  for (let k = 0; k < 14; k++) {
    const a = rand() * TAU, r = 1 + rand() * 2.2;
    ferns.push({ p: [Math.cos(a) * r, 0.4 - r * 0.08, Math.sin(a) * r * 0.9], r: [0, rand() * TAU, 0], s: [0.22 + rand() * 0.2, 0.18 + rand() * 0.15, 0.22 + rand() * 0.2] });
  }
  g.add(instanced(shared.cushion, palette.leafDark, ferns, 'rockery-ferns'));
  return g;
}

function buildScholarRocks(ctx) {
  const { palette, shared } = ctx;
  const g = new THREE.Group();
  g.name = 'scholar-rocks';
  const specimens = [[-15, -8, 2.4, 31.1], [-3.2, 15.4, 2.6, 32.7], [3.4, 15.9, 1.5, 33.3], [21.9, 6.9, 2.8, 34.9], [13.4, -9.4, 1.8, 35.5], [3.9, 7.4, 1.2, 36.1]];
  for (const [x, z, h, seed] of specimens) {
    const plinth = mesh(shared.flats[Math.floor(seed) % shared.flats.length], palette.stoneDark, { name: 'rock-plinth' });
    plinth.position.set(x, 0.07, z);
    plinth.scale.set(h * 0.32, 0.14, h * 0.28);
    g.add(plinth);
    const rock = taihuRock(ctx, h, seed, palette.stoneLight);
    rock.position.set(x, 0.12, z);
    rock.rotation.y = seed;
    g.add(rock);
  }
  return g;
}

function buildBeds(ctx) {
  const { palette, shared, rand } = ctx;
  const g = new THREE.Group();
  g.name = 'planted-beds';
  const flowers = [], blossoms = [], cushionsA = [], cushionsB = [];
  BEDS.forEach(([cx, cz, rx, rz], b) => {
    const outline = irregularLoop(cx, cz, rx, rz, 22, b * 1.9 + 0.5, 0.12);
    const at = (k, y) => outline.map((p) => new THREE.Vector3(cx + (p.x - cx) * k, y, cz + (p.y - cz) * k));
    const eye = (c) => new THREE.Vector3(c.x + (c.x - cx), c.y + 3, c.z + (c.z - cz));
    g.add(mesh(ringSurface([at(1, 0.03), at(0.82, 0.17), at(0.48, 0.25)], new THREE.Vector3(cx, 0.28, cz), eye), palette.moss, { name: 'planted-bed', cast: false }));
    const tangents = tangentsOf(outline, true);
    outline.forEach((p, i) => {
      placeEdgeStone(ctx, g, p.x, p.y, yawFor(tangents[i]), 0.22 + rand() * 0.1, 0.13 + rand() * 0.07, 0.17 + rand() * 0.06, pick(rand, [palette.stone, palette.stoneDark]), 0.4);
    });
    const area = rx * rz;
    for (let k = 0; k < Math.ceil(area * 1.4); k++) {
      const a = rand() * TAU, r = Math.sqrt(rand()) * 0.75;
      const x = cx + Math.cos(a) * rx * r, z = cz + Math.sin(a) * rz * r;
      const s = 0.22 + rand() * 0.3;
      (rand() < 0.5 ? cushionsA : cushionsB).push({ p: [x, 0.2 - r * 0.1, z], r: [0, rand() * TAU, 0], s: [s, s * 0.8, s] });
    }
    for (let k = 0; k < Math.ceil(area * 10); k++) {
      const a = rand() * TAU, r = Math.sqrt(rand()) * 0.8;
      const x = cx + Math.cos(a) * rx * r, z = cz + Math.sin(a) * rz * r;
      const s = 0.035 + rand() * 0.03;
      (rand() < 0.55 ? flowers : blossoms).push({ p: [x, 0.3 - r * 0.12 + rand() * 0.12, z], r: [0, 0, 0], s: [s, s, s] });
    }
  });
  g.add(instanced(shared.cushion, palette.leaf, cushionsA, 'bed-groundcover'));
  g.add(instanced(shared.cushion, palette.leafLight, cushionsB, 'bed-groundcover-light'));
  g.add(instanced(shared.bloom, palette.flower, flowers, 'bed-flowers'));
  g.add(instanced(shared.bloom, palette.blossom, blossoms, 'bed-blossoms'));
  return g;
}

function makeFreeTest(ctx) {
  const guard = offsetLoop(ctx.pond, ctx.pondNormals, 1);
  const rects = [...COURTYARDS, ...KEEP_OUT];
  return (x, z, margin = 0.3) => {
    if (x < -23.5 || x > 23.5 || z < -17.5 || z > 17.5) return false;
    if (distanceToCorridor(x, z) < 1.95 + margin) return false;
    if (insidePolygon(x, z, guard)) return false;
    if (Math.hypot(x - ROCKERY_CENTER.x, z - ROCKERY_CENTER.y) < 4.2 + margin) return false;
    for (const r of rects) if (x > r.x[0] - margin && x < r.x[1] + margin && z > r.z[0] - margin && z < r.z[1] + margin) return false;
    for (const [bx, bz, rx, rz] of BEDS) if (((x - bx) / (rx + margin + 0.3)) ** 2 + ((z - bz) / (rz + margin + 0.3)) ** 2 < 1) return false;
    for (const route of ctx.routes) {
      const limit = (route.half + margin + 0.15) ** 2;
      for (const p of route.pts) if ((p.x - x) ** 2 + (p.y - z) ** 2 < limit) return false;
    }
    return true;
  };
}

function buildScatter(ctx) {
  const { palette, shared, rand, pond, pondNormals } = ctx;
  const g = new THREE.Group();
  g.name = 'scattered-stones';
  const free = makeFreeTest(ctx);
  let placed = 0;
  for (let k = 0; k < 400 && placed < 34; k++) {
    const x = -23 + rand() * 46, z = -17 + rand() * 34;
    if (!free(x, z, 0.4)) continue;
    placed++;
    const s = 0.2 + rand() * 0.45;
    const stone = mesh(pick(rand, shared.boulders), pick(rand, [palette.stone, palette.stoneDark, palette.stoneLight]));
    stone.position.set(x, s * 0.3, z);
    stone.scale.set(s * (1 + rand() * 0.6), s * (0.6 + rand() * 0.5), s);
    stone.rotation.set((rand() - 0.5) * 0.4, rand() * TAU, (rand() - 0.5) * 0.4);
    g.add(stone);
    if (rand() < 0.5) {
      const pebble = mesh(pick(rand, shared.stones), palette.stone);
      pebble.position.set(x + (rand() - 0.5) * s * 3, s * 0.12, z + (rand() - 0.5) * s * 3);
      pebble.scale.setScalar(s * 0.35);
      g.add(pebble);
    }
  }
  const tangents = tangentsOf(pond, true);
  for (let i = 0; i < pond.length; i += 5) {
    if (rand() < 0.45) continue;
    const off = 1.1 + rand() * 0.7;
    const n = pondNormals[i];
    const x = pond[i].x + n.x * off, z = pond[i].y + n.y * off;
    if (pond[i].distanceTo(BRIDGE_FOOT) < 1.8) continue;
    let clear = true;
    for (const route of ctx.routes) for (const p of route.pts) if ((p.x - x) ** 2 + (p.y - z) ** 2 < (route.half + 0.35) ** 2) clear = false;
    if (!clear) continue;
    const s = 0.2 + rand() * 0.3;
    placeEdgeStone(ctx, g, x, z, yawFor(tangents[i]), s * 1.3, s * 0.8, s, pick(rand, [palette.stone, palette.stoneDark]), 0.3);
  }
  const moss = [];
  for (let k = 0; k < 500 && moss.length < 60; k++) {
    const x = -23 + rand() * 46, z = -17 + rand() * 34;
    if (!free(x, z, 0.1)) continue;
    const s = 0.5 + rand() * 1.2;
    moss.push({ p: [x, -0.01, z], r: [0, rand() * TAU, 0], s: [s, 0.035, s * (0.5 + rand() * 0.5)] });
  }
  g.add(instanced(shared.moss, palette.moss, moss, 'lawn-moss'));
  return g;
}

export function buildLandscape(group, palette) {
  const root = new THREE.Group();
  root.name = 'landscape';
  const pond = closedCurve(POND_CONTROL, 128);
  const ctx = { palette, pond, pondNormals: normalsOf(pond), rand: rng(8128), shared: createShared(), routes: [] };
  root.add(buildGround(ctx));
  root.add(buildPond(ctx));
  root.add(buildShore(ctx));
  root.add(buildIsland(ctx));
  root.add(buildPaths(ctx));
  root.add(buildCourtyards(ctx));
  root.add(buildRockery(ctx));
  root.add(buildScholarRocks(ctx));
  root.add(buildBeds(ctx));
  root.add(buildScatter(ctx));
  group.add(root);
  return root;
}
