import * as THREE from 'three';
import { LANDMARKS, CORRIDOR_PATH } from './layout.js';

const HALF_PI = Math.PI / 2;
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitSphere = new THREE.SphereGeometry(0.5, 16, 12);
const discGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10).rotateX(HALF_PI);
const dripGeometry = new THREE.BoxGeometry(0.12, 0.07, 0.04);
const braceGeometry = createBraceGeometry();
const dummy = new THREE.Object3D();
dummy.rotation.order = 'YXZ';
const INSCRIBED = { circle: 1, hex: Math.cos(Math.PI / 6), oct: Math.cos(Math.PI / 8), flower: 0.66 };

function createBraceGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.55, 0);
  shape.lineTo(0.5, -0.06);
  shape.quadraticCurveTo(0.18, -0.08, 0.07, -0.34);
  shape.lineTo(0, -0.37);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 10 });
  geometry.translate(0, 0, -0.03);
  return geometry;
}

function placeGroup(parent, name, x = 0, y = 0, z = 0, ry = 0) {
  const group = new THREE.Group();
  if (name) group.name = name;
  group.position.set(x, y, z);
  group.rotation.y = ry;
  parent.add(group);
  return group;
}

function mesh(parent, geometry, material, x = 0, y = 0, z = 0, name) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  if (name) item.name = name;
  parent.add(item);
  return item;
}

function box(parent, material, w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  const item = mesh(parent, unitBox, material, x, y, z);
  item.scale.set(w, h, d);
  item.rotation.y = ry;
  return item;
}

function cylinder(parent, material, rTop, rBottom, h, x = 0, y = 0, z = 0, segments = 14) {
  return mesh(parent, new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, x, y + h / 2, z);
}

function instanced(parent, geometry, material, items, name) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geometry, material, items.length);
  items.forEach((item, i) => {
    if (item.matrix) {
      im.setMatrixAt(i, item.matrix);
      return;
    }
    const r = item.r ?? [0, 0, 0];
    const s = item.s ?? [1, 1, 1];
    dummy.position.set(item.p[0], item.p[1], item.p[2]);
    dummy.rotation.set(r[0], r[1], r[2], 'YXZ');
    dummy.scale.set(s[0], s[1], s[2]);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.computeBoundingSphere) im.computeBoundingSphere();
  if (name) im.name = name;
  parent.add(im);
  return im;
}

function beamMatrix(a, b, w, h) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vb = new THREE.Vector3(b[0], b[1], b[2]);
  dummy.position.copy(va).add(vb).multiplyScalar(0.5);
  dummy.scale.set(w, h, va.distanceTo(vb));
  dummy.lookAt(vb);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

function orientMatrix(position, target) {
  dummy.position.set(position[0], position[1], position[2]);
  dummy.scale.set(1, 1, 1);
  dummy.lookAt(target[0], target[1], target[2]);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

function segmentFrame(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return { length: Math.hypot(dx, dz), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ry: Math.atan2(-dz, dx) };
}

function rect(a, b) {
  return [[a, b], [-a, b], [-a, -b], [a, -b]];
}

function range(from, to, step) {
  const out = [];
  for (let v = from; v <= to + 1e-6; v += step) out.push(v);
  return out;
}

function outlinePoints(type, radius, cx = 0, cy = 0) {
  const settings = { circle: [64, 0], hex: [6, HALF_PI], oct: [8, Math.PI / 8], flower: [72, 0] };
  const [count, offset] = settings[type] ?? settings.circle;
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    const r = type === 'flower' ? radius * (0.84 + 0.16 * Math.cos(4 * a)) : radius;
    points.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return points;
}

function prism(parent, material, pointsXZ, y, h, name) {
  const shape = new THREE.Shape(pointsXZ.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geometry.rotateX(-HALF_PI);
  return mesh(parent, geometry, material, 0, y, 0, name);
}

function clipBar(bars, hx, hy, angle, offset, bw, depth) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const bx = -s * offset;
  const by = c * offset;
  let t0 = -1e9;
  let t1 = 1e9;
  for (const [p, d, h] of [[bx, c, hx], [by, s, hy]]) {
    if (Math.abs(d) < 1e-6) {
      if (Math.abs(p) > h) return;
      continue;
    }
    let lo = (-h - p) / d;
    let hi = (h - p) / d;
    if (lo > hi) [lo, hi] = [hi, lo];
    t0 = Math.max(t0, lo);
    t1 = Math.min(t1, hi);
  }
  if (t1 - t0 < 0.03) return;
  const tm = (t0 + t1) / 2;
  bars.push({ p: [bx + c * tm, by + s * tm, 0], r: [0, 0, angle], s: [t1 - t0, bw, depth] });
}

function latticePattern(bars, pattern, hx, hy, bw = 0.022, depth = 0.04) {
  if (pattern === 'diamond') {
    const reach = hx + hy;
    for (const o of range(-reach, reach, 0.15)) {
      clipBar(bars, hx, hy, Math.PI / 4, o, bw, depth);
      clipBar(bars, hx, hy, -Math.PI / 4, o, bw, depth);
    }
    return;
  }
  if (pattern === 'wan') {
    const c = 0.22;
    const q = c * 0.42;
    const nx = Math.max(1, Math.floor((hx * 2) / c));
    const ny = Math.max(1, Math.floor((hy * 2) / c));
    const ox = -((nx - 1) * c) / 2;
    const oy = -((ny - 1) * c) / 2;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const cx = ox + i * c;
        const cy = oy + j * c;
        bars.push(
          { p: [cx, cy, 0], s: [2 * q + bw, bw, depth] },
          { p: [cx, cy, 0], s: [bw, 2 * q + bw, depth] },
          { p: [cx + q, cy + q / 2, 0], s: [bw, q, depth] },
          { p: [cx - q / 2, cy + q, 0], s: [q, bw, depth] },
          { p: [cx - q, cy - q / 2, 0], s: [bw, q, depth] },
          { p: [cx + q / 2, cy - q, 0], s: [q, bw, depth] }
        );
      }
    }
    for (let i = 1; i < nx; i++) bars.push({ p: [ox + (i - 0.5) * c, 0, 0], s: [bw, hy * 2, depth * 0.8] });
    return;
  }
  if (pattern === 'step') {
    for (const inset of [0.05, 0.13, 0.21]) {
      const ax = hx - inset;
      const ay = hy - inset;
      if (ax < 0.05 || ay < 0.05) break;
      bars.push(
        { p: [0, ay, 0], s: [ax * 2, bw, depth] },
        { p: [0, -ay, 0], s: [ax * 2, bw, depth] },
        { p: [ax, 0, 0], s: [bw, ay * 2, depth] },
        { p: [-ax, 0, 0], s: [bw, ay * 2, depth] }
      );
    }
    bars.push({ p: [0, 0, 0], s: [bw, hy * 2, depth] }, { p: [0, 0, 0], s: [hx * 2, bw, depth] });
    for (const y of range(-hy + 0.32, hy - 0.32, 0.32)) bars.push({ p: [0, y, 0], s: [hx * 2, bw, depth] });
    return;
  }
  for (const o of range(-hy + 0.065, hy - 0.03, 0.13)) clipBar(bars, hx, hy, 0, o, bw, depth);
  for (const o of range(-hx + 0.065, hx - 0.03, 0.13)) clipBar(bars, hx, hy, HALF_PI, o, bw, depth);
}

function roundLattice(bars, pattern, r, cx, cy, bw = 0.04, depth = 0.07) {
  const step = r / 3;
  const angles = pattern === 'diamond' ? [Math.PI / 4, -Math.PI / 4] : pattern === 'radial' ? [] : [0, HALF_PI];
  for (const a of angles) {
    for (let o = -r + step / 2; o < r; o += step) {
      const half = Math.sqrt(Math.max(0, r * r - o * o));
      const c = Math.cos(a);
      const s = Math.sin(a);
      bars.push({ p: [cx - s * o, cy + c * o, 0], r: [0, 0, a], s: [half * 2, bw, depth] });
    }
  }
  if (pattern === 'radial') {
    for (let k = 0; k < 6; k++) bars.push({ p: [cx, cy, 0], r: [0, 0, (k * Math.PI) / 6], s: [r * 2, bw, depth] });
  }
}

function panel(parent, mats, w, h, { pattern = 'grid', frame = 0.05, paper = true, depth = 0.05, bar = 0.022, material } = {}) {
  const group = new THREE.Group();
  parent.add(group);
  const fm = material ?? mats.woodDark;
  box(group, fm, w, frame, depth * 1.3, 0, h / 2 - frame / 2, 0);
  box(group, fm, w, frame, depth * 1.3, 0, -h / 2 + frame / 2, 0);
  box(group, fm, frame, h - 2 * frame, depth * 1.3, -w / 2 + frame / 2, 0, 0);
  box(group, fm, frame, h - 2 * frame, depth * 1.3, w / 2 - frame / 2, 0, 0);
  const hx = w / 2 - frame;
  const hy = h / 2 - frame;
  const bars = [];
  latticePattern(bars, pattern, hx, hy, bar, depth);
  instanced(group, unitBox, fm, bars);
  if (paper) box(group, mats.plasterWarm, hx * 2, hy * 2, 0.008, 0, 0, -depth * 0.4);
  return group;
}

function doorLeaf(parent, mats, w, h, pattern) {
  const group = new THREE.Group();
  parent.add(group);
  const f = 0.055;
  const d = 0.07;
  box(group, mats.woodDark, f, h, d, -w / 2 + f / 2, h / 2, 0);
  box(group, mats.woodDark, f, h, d, w / 2 - f / 2, h / 2, 0);
  for (const y of [f / 2, h * 0.28, h * 0.36, h - f / 2]) box(group, mats.woodDark, w - 2 * f, f * 0.9, d, 0, y, 0);
  const waistH = h * 0.28 - f;
  box(group, mats.wood, w - 2 * f, waistH, 0.035, 0, f + waistH / 2, 0);
  box(group, mats.wood, w - 2 * f - 0.09, waistH - 0.12, 0.055, 0, f + waistH / 2, 0);
  box(group, mats.woodDark, w - 2 * f - 0.15, waistH - 0.2, 0.062, 0, f + waistH / 2, 0);
  const bandH = h * 0.08 - f * 0.9;
  box(group, mats.wood, w - 2 * f, bandH, 0.035, 0, h * 0.32, 0);
  box(group, mats.woodDark, w - 2 * f - 0.1, bandH * 0.5, 0.05, 0, h * 0.32, 0);
  const latBottom = h * 0.36 + f * 0.45;
  const latTop = h - f;
  const lattice = panel(group, mats, w - 2 * f, latTop - latBottom, { pattern, frame: 0.02, depth: 0.04 });
  lattice.position.y = (latTop + latBottom) / 2;
  return group;
}

function gooseBench(parent, mats, span, outward = 1) {
  const group = new THREE.Group();
  parent.add(group);
  const o = outward;
  box(group, mats.wood, span, 0.07, 0.38, 0, 0.46, 0.02 * o);
  box(group, mats.woodDark, span, 0.05, 0.05, 0, 0.41, 0.17 * o);
  box(group, mats.woodDark, span, 0.05, 0.05, 0, 0.41, -0.15 * o);
  const skirt = panel(group, mats, span, 0.38, { pattern: 'step', paper: false, frame: 0.035, depth: 0.035 });
  skirt.position.set(0, 0.2, 0.15 * o);
  const slats = [];
  const count = Math.max(4, Math.round(span / 0.11));
  const lower = [0.17 + 0.119, 0.5 + 0.173];
  const upper = [0.407 + 0.022, 0.847 + 0.108];
  for (let i = 0; i <= count; i++) {
    const x = -span / 2 + (i * span) / count;
    const edge = i === 0 || i === count;
    const w = edge ? 0.055 : 0.028;
    slats.push({ p: [x, lower[1], lower[0] * o], r: [0.6 * o, 0, 0], s: [w, 0.42, edge ? 0.06 : 0.026] });
    slats.push({ p: [x, upper[1], upper[0] * o], r: [0.2 * o, 0, 0], s: [w, 0.22, edge ? 0.06 : 0.026] });
  }
  instanced(group, unitBox, mats.woodDark, slats);
  const mid = box(group, mats.woodDark, span, 0.04, 0.05, 0, 0.847, 0.407 * o);
  mid.rotation.x = 0.6 * o;
  const top = box(group, mats.wood, span + 0.04, 0.06, 0.1, 0, 1.07, 0.452 * o);
  top.rotation.x = 0.2 * o;
  return group;
}

function columnWithBase(parent, mats, r, h, x, y, z) {
  box(parent, mats.stoneLight, r * 3.4, 0.09, r * 3.4, x, y + 0.045, z);
  cylinder(parent, mats.stone, r * 1.35, r * 1.6, 0.16, x, y + 0.09, z, 16);
  cylinder(parent, mats.woodDark, r * 0.9, r, h - 0.25, x, y + 0.25, z, 16);
  cylinder(parent, mats.wood, r * 0.98, r * 0.98, 0.05, x, y + h - 0.32, z, 16);
}

function brace(parent, mats, x, y, z, dir, ry = 0) {
  const item = mesh(parent, braceGeometry, mats.woodDark, x, y, z);
  item.rotation.y = ry;
  item.scale.x = dir;
  return item;
}

function plaque(parent, mats, w, h, x, y, z, board, glyph, ry = 0, inscription = '') {
  const group = placeGroup(parent, `plaque-${inscription}`, x, y, z, ry);
  box(group, board, w, h, 0.06, 0, 0, 0);
  for (const s of [-1, 1]) {
    box(group, glyph, w + 0.04, 0.025, 0.08, 0, s * (h / 2), 0);
    box(group, glyph, 0.025, h + 0.04, 0.08, s * (w / 2), 0, 0);
  }
  if (typeof document !== 'undefined' && inscription) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 512, 128);
    context.fillStyle = board === mats.woodDark ? '#e7c98b' : '#47594d';
    context.font = `600 ${inscription.length > 3 ? 75 : 88}px "Songti SC", "STSong", serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(inscription, 256, 68);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const lettering = mesh(group, new THREE.PlaneGeometry(w * 0.78, h * 0.79), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0.047);
    lettering.name = `inscription-${inscription}`;
  }
  return group;
}

function hangingLantern(parent, mats, glow, x, yTop, z, cord = 0.3) {
  const group = placeGroup(parent, 'lantern', x, yTop, z);
  mesh(group, new THREE.CylinderGeometry(0.012, 0.012, cord, 6), mats.woodDark, 0, -cord / 2, 0);
  const y0 = -cord;
  mesh(group, new THREE.CylinderGeometry(0.07, 0.15, 0.07, 14), mats.gold, 0, y0 - 0.035, 0);
  const body = mesh(group, unitSphere, glow, 0, y0 - 0.3, 0);
  body.scale.set(0.38, 0.48, 0.38);
  for (let k = 0; k < 3; k++) {
    const rib = mesh(group, new THREE.TorusGeometry(0.19, 0.006, 4, 24), mats.woodDark, 0, y0 - 0.3, 0);
    rib.rotation.y = (k * Math.PI) / 3;
    rib.scale.set(1, 1.26, 1);
  }
  const band = mesh(group, new THREE.TorusGeometry(0.19, 0.008, 4, 24), mats.gold, 0, y0 - 0.3, 0);
  band.rotation.x = HALF_PI;
  mesh(group, new THREE.CylinderGeometry(0.15, 0.07, 0.07, 14), mats.gold, 0, y0 - 0.565, 0);
  mesh(group, new THREE.ConeGeometry(0.045, 0.22, 8), mats.wood, 0, y0 - 0.71, 0);
  return group;
}

function stoneLantern(parent, mats, light, x, z) {
  const group = placeGroup(parent, 'stone-lantern', x, 0, z);
  cylinder(group, mats.stoneDark, 0.38, 0.42, 0.14, 0, 0, 0, 6);
  cylinder(group, mats.stone, 0.16, 0.22, 0.1, 0, 0.14, 0, 6);
  cylinder(group, mats.stone, 0.1, 0.13, 0.6, 0, 0.24, 0, 8);
  cylinder(group, mats.stoneLight, 0.3, 0.2, 0.12, 0, 0.84, 0, 6);
  box(group, light, 0.24, 0.26, 0.24, 0, 1.09, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, mats.stone, 0.06, 0.3, 0.06, sx * 0.15, 1.11, sz * 0.15);
  cylinder(group, mats.stone, 0.44, 0.42, 0.05, 0, 1.26, 0, 6);
  mesh(group, new THREE.ConeGeometry(0.44, 0.3, 6), mats.stone, 0, 1.46, 0);
  const knob = mesh(group, unitSphere, mats.stoneLight, 0, 1.66, 0);
  knob.scale.setScalar(0.14);
  mesh(group, new THREE.ConeGeometry(0.04, 0.12, 8), mats.stoneLight, 0, 1.78, 0);
  return group;
}

function curvedRoof(parent, mats, options) {
  const { outline, inner, innerY = -0.2, ridge = 0, height, lift, y = 0, thick = 0.14, ripple = 0.05, tile = 0.3, rings = 16, name } = options;
  const group = placeGroup(parent, name, 0, y, 0);
  const n = outline.length;
  const sides = outline.map((c, i) => {
    const d = outline[(i + 1) % n];
    const dx = d[0] - c[0];
    const dz = d[1] - c[1];
    const len = Math.hypot(dx, dz);
    const k = Math.max(4, Math.round(len / tile));
    return { i, c, d, len, k, samples: k * 4, nx: dz / len, nz: -dx / len };
  });
  const surf = (side, s, t, rippled) => {
    const px = side.c[0] + (side.d[0] - side.c[0]) * s;
    const pz = side.c[1] + (side.d[1] - side.c[1]) * s;
    const qx = ridge > 0 ? THREE.MathUtils.clamp(px, -ridge, ridge) : 0;
    const flare = Math.pow(Math.abs(2 * s - 1), 3);
    let yy = height * (0.22 * t + 0.78 * t * t) + lift * flare * (1 - t) * (1 - t);
    if (rippled) yy += ripple * Math.abs(Math.sin(Math.PI * side.k * s)) * (1 - 0.6 * t);
    return [px + (qx - px) * t, yy, pz - pz * t];
  };
  const perimeter = [];
  sides.forEach((side) => {
    for (let j = 0; j < side.samples; j++) perimeter.push([side, j / side.samples]);
  });
  const N = perimeter.length;
  const pos = [];
  const uv = [];
  const topIdx = [];
  const botIdx = [];
  const layer = (drop, rippled) => {
    const base = pos.length / 3;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      for (const [side, s] of perimeter) {
        const p = surf(side, s, t, rippled);
        pos.push(p[0], p[1] - drop, p[2]);
        uv.push(p[0] * 0.5, p[2] * 0.5 + p[1] * 0.5);
      }
    }
    return base;
  };
  const top = layer(0, true);
  const bot = layer(thick, false);
  const at = (base, r, i) => base + r * N + (i % N);
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < N; i++) {
      topIdx.push(at(top, r, i), at(top, r + 1, i + 1), at(top, r, i + 1), at(top, r, i), at(top, r + 1, i), at(top, r + 1, i + 1));
      botIdx.push(at(bot, r, i), at(bot, r, i + 1), at(bot, r + 1, i + 1), at(bot, r, i), at(bot, r + 1, i + 1), at(bot, r + 1, i));
    }
  }
  for (let i = 0; i < N; i++) {
    const ti = at(top, 0, i);
    const ti1 = at(top, 0, i + 1);
    const bi = at(bot, 0, i);
    const bi1 = at(bot, 0, i + 1);
    topIdx.push(ti, ti1, bi, ti1, bi1, bi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(topIdx.concat(botIdx));
  geometry.addGroup(0, topIdx.length, 0);
  geometry.addGroup(topIdx.length, botIdx.length, 1);
  geometry.computeVertexNormals();
  mesh(group, geometry, [mats.roof, mats.woodDark], 0, 0, 0, `${name}-tiles`);

  sides.forEach((side) => {
    const prev = sides[(side.i + n - 1) % n];
    let ox = side.nx + prev.nx;
    let oz = side.nz + prev.nz;
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol;
    oz /= ol;
    const e = surf(side, 0, 0, false);
    const pts = [
      new THREE.Vector3(e[0] + ox * 0.36, e[1] + 0.4, e[2] + oz * 0.36),
      new THREE.Vector3(e[0] + ox * 0.16, e[1] + 0.12, e[2] + oz * 0.16)
    ];
    for (let r = 0; r <= 10; r++) {
      const p = surf(side, 0, r / 10, false);
      pts.push(new THREE.Vector3(p[0], p[1] + 0.06 + ripple, p[2]));
    }
    mesh(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.075, 7), mats.roofEdge, 0, 0, 0, `${name}-hip-ridge`);
    mesh(group, new THREE.SphereGeometry(0.085, 10, 8), mats.roofEdge, pts[0].x, pts[0].y, pts[0].z);
  });

  const discs = [];
  const drips = [];
  sides.forEach((side) => {
    for (let m = 0; m < side.k; m++) {
      const p = surf(side, (m + 0.5) / side.k, 0, true);
      const pp = [p[0] + side.nx * 0.02, p[1] - 0.035, p[2] + side.nz * 0.02];
      discs.push({ matrix: orientMatrix(pp, [pp[0] + side.nx, pp[1], pp[2] + side.nz]) });
      const q = surf(side, m / side.k, 0, false);
      const qq = [q[0] + side.nx * 0.03, q[1] - thick - 0.02, q[2] + side.nz * 0.03];
      drips.push({ matrix: orientMatrix(qq, [qq[0] + side.nx, qq[1], qq[2] + side.nz]) });
    }
  });
  instanced(group, discGeometry, mats.roofEdge, discs, `${name}-tile-ends`);
  instanced(group, dripGeometry, mats.roofEdge, drips, `${name}-drip-tiles`);

  if (inner) {
    const rafters = [];
    sides.forEach((side) => {
      const ic = inner[side.i];
      const id = inner[(side.i + 1) % n];
      const count = Math.max(3, Math.floor(side.len / 0.3));
      for (let m = 0; m <= count; m++) {
        const s = m / count;
        const p = surf(side, s, 0, false);
        const a = [ic[0] + (id[0] - ic[0]) * s, innerY, ic[1] + (id[1] - ic[1]) * s];
        const b = [p[0] - side.nx * 0.05, p[1] - thick - 0.045, p[2] - side.nz * 0.05];
        rafters.push({ matrix: beamMatrix(a, b, 0.065, 0.065) });
      }
    });
    instanced(group, unitBox, mats.woodDark, rafters, `${name}-rafters`);
  }

  if (ridge > 0) {
    box(group, mats.roof, ridge * 2 + 0.1, 0.16, 0.38, 0, height + 0.04, 0);
    box(group, mats.roofEdge, ridge * 2 + 0.2, 0.26, 0.24, 0, height + 0.22, 0);
    box(group, mats.roofEdge, ridge * 2 + 0.3, 0.06, 0.3, 0, height + 0.37, 0);
    const motifs = [];
    for (let x = -ridge + 0.25; x < ridge - 0.1; x += 0.36) motifs.push({ p: [x, height + 0.22, 0], r: [0, 0, Math.PI / 4], s: [0.12, 0.12, 0.27] });
    instanced(group, unitBox, mats.roof, motifs, `${name}-ridge-pattern`);
    for (const sx of [-1, 1]) {
      const pts = [[ridge - 0.05, height + 0.2], [ridge + 0.28, height + 0.34], [ridge + 0.38, height + 0.66], [ridge + 0.18, height + 0.86], [ridge + 0.02, height + 0.74]]
        .map(([x, yy]) => new THREE.Vector3(sx * x, yy, 0));
      mesh(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.1, 8), mats.roofEdge, 0, 0, 0, `${name}-ridge-end`);
    }
    box(group, mats.roofEdge, 0.46, 0.3, 0.2, 0, height + 0.52, 0);
    const pearl = mesh(group, unitSphere, mats.roofEdge, 0, height + 0.78, 0);
    pearl.scale.setScalar(0.2);
  } else {
    cylinder(group, mats.roofEdge, 0.2, 0.3, 0.24, 0, height - 0.08, 0, 12);
    const bulb = mesh(group, unitSphere, mats.gold, 0, height + 0.34, 0);
    bulb.scale.set(0.34, 0.3, 0.34);
    cylinder(group, mats.gold, 0.05, 0.1, 0.16, 0, height + 0.46, 0, 10);
    const pearl = mesh(group, unitSphere, mats.gold, 0, height + 0.7, 0);
    pearl.scale.setScalar(0.17);
    mesh(group, new THREE.ConeGeometry(0.05, 0.26, 10), mats.gold, 0, height + 0.9, 0);
  }
  return group;
}

function gableGeometry(length, width, height, { ripple = 0.035, tile = 0.26, thick = 0.08, endLift = 0.2, nv = 12 } = {}) {
  const k = Math.max(4, Math.round(length / tile));
  const nu = k * 4;
  const row = nu + 1;
  const pos = [];
  const uv = [];
  const topIdx = [];
  const botIdx = [];
  const layer = (drop, rippled) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) {
      const z = -width / 2 + (width * j) / nv;
      const a = Math.abs(z) / (width / 2);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const x = -length / 2 + length * u;
        let y = height * Math.pow(1 - a, 1.6) + endLift * Math.pow(Math.abs(2 * u - 1), 6) * a;
        if (rippled) y += ripple * Math.abs(Math.sin(Math.PI * k * u)) * (0.35 + 0.65 * a);
        pos.push(x, y - drop, z);
        uv.push(x * 0.5, z * 0.5 + y * 0.5);
      }
    }
    return base;
  };
  const top = layer(0, true);
  const bot = layer(thick, false);
  const at = (base, i, j) => base + j * row + i;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      topIdx.push(at(top, i, j), at(top, i + 1, j + 1), at(top, i + 1, j), at(top, i, j), at(top, i, j + 1), at(top, i + 1, j + 1));
      botIdx.push(at(bot, i, j), at(bot, i + 1, j), at(bot, i + 1, j + 1), at(bot, i, j), at(bot, i + 1, j + 1), at(bot, i, j + 1));
    }
  }
  for (let i = 0; i < nu; i++) {
    topIdx.push(at(top, i, nv), at(bot, i, nv), at(top, i + 1, nv), at(top, i + 1, nv), at(bot, i, nv), at(bot, i + 1, nv));
    topIdx.push(at(top, i, 0), at(top, i + 1, 0), at(bot, i, 0), at(top, i + 1, 0), at(bot, i + 1, 0), at(bot, i, 0));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(topIdx.concat(botIdx));
  geometry.addGroup(0, topIdx.length, 0);
  geometry.addGroup(topIdx.length, botIdx.length, 1);
  geometry.computeVertexNormals();
  return geometry;
}

function pierceWall(parent, mats, { length, height, thick, windows = [], name, latticeMaterial }) {
  const group = placeGroup(parent, name);
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, 0);
  shape.lineTo(length / 2, 0);
  shape.lineTo(length / 2, height);
  shape.lineTo(-length / 2, height);
  for (const w of windows) shape.holes.push(new THREE.Path(outlinePoints(w.type, w.r, w.x, w.y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 4 });
  geometry.translate(0, 0, -thick / 2);
  mesh(group, geometry, mats.plaster, 0, 0, 0, `${name}-plaster`);
  const lm = latticeMaterial ?? mats.roofEdge;
  const bars = [];
  for (const w of windows) {
    const ring = new THREE.Shape(outlinePoints(w.type, w.r * (w.frame ?? 1.16), w.x, w.y));
    ring.holes.push(new THREE.Path(outlinePoints(w.type, w.r, w.x, w.y)));
    const ringGeometry = new THREE.ExtrudeGeometry(ring, { depth: thick + 0.06, bevelEnabled: false });
    ringGeometry.translate(0, 0, -(thick + 0.06) / 2);
    mesh(group, ringGeometry, w.frameMaterial ?? mats.stoneLight, 0, 0, 0, `${name}-window-frame`);
    if (w.open) continue;
    const rin = w.r * INSCRIBED[w.type] - 0.02;
    roundLattice(bars, w.pattern ?? 'grid', rin, w.x, w.y);
    mesh(group, new THREE.TorusGeometry(rin, 0.028, 6, 40), lm, w.x, w.y, 0);
    if (w.pattern === 'radial') {
      mesh(group, new THREE.TorusGeometry(rin * 0.45, 0.025, 6, 28), lm, w.x, w.y, 0);
      mesh(group, new THREE.TorusGeometry(rin * 0.75, 0.02, 6, 32), lm, w.x, w.y, 0);
    }
  }
  instanced(group, unitBox, lm, bars, `${name}-lattice`);
  return group;
}

function wallCap(parent, mats, length, thick, height, name) {
  const W = thick + 0.62;
  mesh(parent, gableGeometry(length + 0.24, W, 0.3, { ripple: 0.022, tile: 0.2, endLift: 0.1, thick: 0.05, nv: 8 }), [mats.roof, mats.plaster], 0, height + 0.1, 0, name);
  box(parent, mats.roofEdge, length + 0.08, 0.12, thick + 0.14, 0, height + 0.05, 0);
  box(parent, mats.roofEdge, length + 0.3, 0.14, 0.16, 0, height + 0.46, 0);
  box(parent, mats.roof, length + 0.2, 0.06, 0.24, 0, height + 0.37, 0);
  const discs = [];
  const motifs = [];
  for (let x = -length / 2 + 0.05; x <= length / 2; x += 0.2) for (const s of [-1, 1]) discs.push({ p: [x, height + 0.09, s * (W / 2 + 0.01)] });
  for (let x = -length / 2 + 0.25; x < length / 2 - 0.1; x += 0.5) motifs.push({ p: [x, height + 0.48, 0], r: [0, 0, Math.PI / 4], s: [0.13, 0.13, 0.19] });
  instanced(parent, discGeometry, mats.roofEdge, discs, `${name}-tile-ends`);
  instanced(parent, unitBox, mats.roofEdge, motifs, `${name}-ridge-motifs`);
  for (const sx of [-1, 1]) {
    const pts = [[length / 2 + 0.05, height + 0.42], [length / 2 + 0.22, height + 0.5], [length / 2 + 0.26, height + 0.7], [length / 2 + 0.12, height + 0.78]]
      .map(([x, y]) => new THREE.Vector3(sx * x, y, 0));
    mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.065, 6), mats.roofEdge, 0, 0, 0, `${name}-end`);
  }
}

function buildPerimeter(root, mats) {
  const g = placeGroup(root, 'perimeter-wall');
  const H = 3.0;
  const T = 0.42;
  const types = ['circle', 'hex', 'flower', 'oct'];
  const patterns = ['grid', 'diamond', 'radial', 'wan'];
  const runs = [
    { name: 'south-west-wall', a: [-23, 17], b: [-2.62, 17], spacing: 3.0 },
    { name: 'south-east-wall', a: [2.62, 17], b: [23, 17], spacing: 4.2 },
    { name: 'east-wall', a: [23, 17], b: [23, -17], spacing: 4.4, skip: [-5] },
    { name: 'north-wall', a: [23, -17], b: [-23, -17], spacing: 5.0 },
    { name: 'west-wall', a: [-23, -17], b: [-23, 17], spacing: 3.0 }
  ];
  let counter = 0;
  for (const run of runs) {
    const { length: L, mid, ry } = segmentFrame(run.a, run.b);
    const seg = placeGroup(g, run.name, mid[0], 0, mid[1], ry);
    const windows = range(-L / 2 + 1.8, L / 2 - 1.8, run.spacing)
      .filter((x) => !(run.skip ?? []).some((s) => Math.abs(s - x) < 1.3))
      .map((x) => {
        const type = types[counter % types.length];
        const pattern = patterns[counter % patterns.length] === 'wan' ? 'grid' : patterns[counter % patterns.length];
        counter += 1;
        return { type, r: type === 'flower' ? 0.58 : 0.5, x, y: 1.75, pattern };
      });
    pierceWall(seg, mats, { length: L, height: H, thick: T, windows, name: `${run.name}-body` });
    box(seg, mats.stoneDark, L, 0.5, T + 0.1, 0, 0.25, 0);
    box(seg, mats.stoneLight, L, 0.05, T + 0.12, 0, 0.52, 0);
    wallCap(seg, mats, L, T, H, `${run.name}-cap-roof`);
  }
  for (const [x, z] of [[-23, -17], [23, -17], [-23, 17], [23, 17]]) {
    box(g, mats.stoneDark, 0.82, 0.55, 0.82, x, 0.275, z);
    box(g, mats.plaster, 0.72, H + 0.2, 0.72, x, (H + 0.2) / 2, z);
    box(g, mats.roofEdge, 0.9, 0.12, 0.9, x, H + 0.26, z);
    const cap = mesh(g, new THREE.ConeGeometry(0.62, 0.42, 4), mats.roof, x, H + 0.53, z);
    cap.rotation.y = Math.PI / 4;
  }
}

function buildEntrance(root, mats, glow) {
  const [ex, , ez] = LANDMARKS.entrance;
  const g = placeGroup(root, 'entrance-gate', ex, 0, ez);
  const y0 = 0.28;
  box(g, mats.stone, 5.6, 0.22, 2.0, 0, 0.11, 0);
  box(g, mats.stoneLight, 5.7, 0.06, 2.1, 0, 0.25, 0);
  for (const s of [-1, 1]) {
    box(g, mats.stoneLight, 3.4, 0.14, 0.36, 0, 0.07, s * 1.58);
    box(g, mats.stoneLight, 3.2, 0.21, 0.3, 0, 0.105, s * 1.2);
  }
  for (const s of [-1, 1]) {
    box(g, mats.plaster, 1.25, 3.6, 1.5, s * 2.0, y0 + 1.8, 0);
    box(g, mats.stoneDark, 1.31, 0.5, 1.56, s * 2.0, y0 + 0.25, 0);
    box(g, mats.stoneLight, 1.33, 0.05, 1.58, s * 2.0, y0 + 0.52, 0);
    box(g, mats.roofEdge, 1.33, 0.07, 1.58, s * 2.0, y0 + 3.4, 0);
    box(g, mats.roofEdge, 1.4, 0.07, 1.66, s * 2.0, y0 + 3.5, 0);
    pierceWall(placeGroup(g, null, s * 2.0, y0 + 0.9, 0.76), mats, {
      length: 0.9, height: 2.0, thick: 0.04, name: 'entrance-gate-pier-panel',
      windows: [{ type: 'hex', r: 0.32, x: 0, y: 1.2, pattern: 'diamond' }]
    });
  }
  box(g, mats.plaster, 2.75, 0.83, 0.6, 0, y0 + 3.185, 0);
  for (const s of [-1, 1]) box(g, mats.stoneLight, 0.18, 2.78, 0.7, s * 1.28, y0 + 1.39, 0);
  box(g, mats.stoneLight, 2.74, 0.24, 0.72, 0, y0 + 2.9, 0);
  box(g, mats.woodDark, 2.4, 0.14, 0.16, 0, y0 + 0.07, -0.1);
  for (const s of [-1, 1]) plaque(g, mats, 1.8, 0.4, 0, y0 + 3.3, s * 0.33, mats.stoneLight, s > 0 ? mats.gold : mats.roofEdge, s > 0 ? 0 : Math.PI, '姑苏一园');
  for (const s of [-1, 1]) {
    const hinge = placeGroup(g, 'entrance-door', s * 1.19, y0 + 0.02, -0.15, -s * 1.25);
    const cx = -s * 0.595;
    box(hinge, mats.wood, 1.17, 2.72, 0.09, cx, 1.36, 0);
    box(hinge, mats.woodDark, 1.17, 0.08, 0.11, cx, 0.04, 0);
    box(hinge, mats.woodDark, 1.17, 0.08, 0.11, cx, 2.68, 0);
    box(hinge, mats.woodDark, 0.08, 2.72, 0.11, cx + 0.545, 1.36, 0);
    box(hinge, mats.woodDark, 0.08, 2.72, 0.11, cx - 0.545, 1.36, 0);
    const grooves = [];
    for (let i = 1; i < 5; i++) grooves.push({ p: [cx - 0.585 + i * 0.234, 1.36, 0], s: [0.014, 2.6, 0.096] });
    instanced(hinge, unitBox, mats.woodDark, grooves);
    const studs = [];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 7; r++) studs.push({ p: [cx - 0.39 + c * 0.26, 0.38 + r * 0.33, 0.05], s: [0.06, 0.06, 0.04] });
    instanced(hinge, unitSphere, mats.gold, studs);
    const knockerX = cx - s * 0.42;
    const plate = mesh(hinge, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), mats.gold, knockerX, 1.42, 0.055);
    plate.rotation.x = HALF_PI;
    mesh(hinge, new THREE.TorusGeometry(0.075, 0.012, 6, 20), mats.gold, knockerX, 1.34, 0.07);
  }
  for (const s of [-1, 1]) {
    box(g, mats.stone, 0.36, 0.5, 0.75, s * 1.62, y0 + 0.25, 1.05);
    box(g, mats.stoneLight, 0.4, 0.06, 0.8, s * 1.62, y0 + 0.53, 1.05);
    const drum = mesh(g, new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24), mats.stone, s * 1.62, y0 + 0.86, 1.05);
    drum.rotation.z = HALF_PI;
    for (const off of [-0.13, 0.13]) {
      const rim = mesh(g, new THREE.TorusGeometry(0.33, 0.025, 6, 24), mats.stoneLight, s * 1.62 + off, y0 + 0.86, 1.05);
      rim.rotation.y = HALF_PI;
    }
  }
  for (const z of [-0.6, 0.6]) {
    box(g, mats.woodDark, 5.2, 0.2, 0.18, 0, 3.98, z);
    box(g, mats.wood, 5.3, 0.07, 0.24, 0, 4.115, z);
  }
  const brackets = [];
  for (const z of [-0.6, 0.6]) {
    for (const x of range(-2.4, 2.4, 0.4)) {
      brackets.push({ p: [x, 4.2, z], s: [0.15, 0.1, 0.15] });
      brackets.push({ p: [x, 4.27, z], s: [0.32, 0.06, 0.12] });
      brackets.push({ p: [x, 4.27, z], s: [0.12, 0.06, 0.34] });
    }
  }
  instanced(g, unitBox, mats.woodDark, brackets, 'entrance-gate-brackets');
  curvedRoof(g, mats, { name: 'entrance-gate-roof', outline: rect(3.6, 1.8), inner: rect(2.62, 0.78), innerY: 0.2, ridge: 2.3, height: 1.25, lift: 0.5, y: 3.95, tile: 0.27, rings: 12 });
  for (const s of [-1, 1]) {
    hangingLantern(g, mats, glow, s * 1.7, 4.05, 1.2, 0.45);
    hangingLantern(g, mats, glow, s * 1.7, 4.05, -1.2, 0.45);
  }
}

function buildHall(root, mats, glow) {
  const [hx, , hz] = LANDMARKS.hall;
  const g = placeGroup(root, 'waterside-hall', hx, 0, hz);
  const P = 0.6;
  box(g, mats.stoneDark, 10.5, 0.16, 7.7, 0, 0.08, 0);
  box(g, mats.stone, 10.4, P - 0.1, 7.6, 0, (P - 0.1) / 2, 0);
  box(g, mats.stoneLight, 10.6, 0.12, 7.8, 0, P - 0.06, 0);
  const blocks = [];
  for (const x of range(-5.0, 5.0, 0.8)) for (const z of [-3.82, 3.82]) blocks.push({ p: [x, 0.3, z], s: [0.03, 0.3, 0.02] });
  instanced(g, unitBox, mats.stoneDark, blocks);
  for (let k = 0; k < 3; k++) box(g, mats.stoneLight, 2.6, (k + 1) * 0.2, 0.36, 0, (k + 1) * 0.1, 3.8 + (2 - k) * 0.36 + 0.18);
  for (const s of [-1, 1]) box(g, mats.stone, 0.24, 0.42, 1.1, s * 1.42, 0.21, 4.35);
  const xs = [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5];
  const colH = 3.3;
  for (const x of xs) for (const z of [3.0, 1.8, -3.0]) columnWithBase(g, mats, 0.15, colH, x, P, z);
  for (const x of [-4.5, 4.5]) for (const z of [-1.4, 0.2]) columnWithBase(g, mats, 0.15, colH, x, P, z);
  const wallH = 3.0;
  for (const s of [-1, 1]) {
    const side = placeGroup(g, null, s * 4.5, P, -0.6, HALF_PI);
    pierceWall(side, mats, {
      length: 4.8, height: wallH, thick: 0.26, name: 'waterside-hall-side-wall', latticeMaterial: mats.woodDark,
      windows: [{ type: 'oct', r: 0.8, x: 0, y: 1.65, pattern: 'diamond', frameMaterial: mats.woodDark, frame: 1.12 }]
    });
    box(side, mats.stoneDark, 4.8, 0.28, 0.32, 0, 0.14, 0);
  }
  const back = placeGroup(g, null, 0, P, -3.0);
  pierceWall(back, mats, {
    length: 9.0, height: wallH, thick: 0.28, name: 'waterside-hall-back-wall', latticeMaterial: mats.woodDark,
    windows: [
      { type: 'circle', r: 0.62, x: -2.7, y: 1.7, pattern: 'radial', frameMaterial: mats.woodDark },
      { type: 'flower', r: 0.72, x: 0, y: 1.7, pattern: 'grid', frameMaterial: mats.woodDark },
      { type: 'circle', r: 0.62, x: 2.7, y: 1.7, pattern: 'diamond', frameMaterial: mats.woodDark }
    ]
  });
  box(back, mats.stoneDark, 9.0, 0.28, 0.34, 0, 0.14, 0);
  const sillTop = P + 0.12;
  const leafTop = 3.3;
  const bays = [-3.6, -1.8, 0, 1.8, 3.6];
  const usable = 1.5;
  const lw = usable / 4;
  bays.forEach((bx, bi) => {
    const doorBay = Math.abs(bx) < 2;
    box(g, mats.woodDark, 1.8, 0.12, 0.2, bx, P + 0.06, 1.8);
    box(g, mats.woodDark, 1.8, 0.09, 0.16, bx, leafTop + 0.04, 1.8);
    const pattern = bi === 2 ? 'wan' : doorBay ? 'step' : 'diamond';
    for (let i = 0; i < 4; i++) {
      const cx = bx - usable / 2 + lw * (i + 0.5);
      if (doorBay) {
        const leaf = doorLeaf(g, mats, lw - 0.012, leafTop - sillTop, pattern);
        leaf.position.set(cx, sillTop, 1.8);
      } else {
        const win = panel(g, mats, lw - 0.012, leafTop - 1.56, { pattern, frame: 0.045 });
        win.position.set(cx, (leafTop + 1.56) / 2, 1.8);
      }
    }
    if (!doorBay) {
      box(g, mats.plaster, usable, 0.78, 0.26, bx, sillTop + 0.39, 1.8);
      box(g, mats.stoneLight, usable + 0.06, 0.06, 0.32, bx, 1.53, 1.8);
      box(g, mats.stoneDark, usable, 0.16, 0.28, bx, sillTop + 0.08, 1.8);
    }
    const transom = panel(g, mats, usable, 0.28, { pattern: 'step', frame: 0.035 });
    transom.position.set(bx, 3.5, 1.8);
    const fret = panel(g, mats, usable, 0.3, { pattern: bi % 2 ? 'wan' : 'step', paper: false, frame: 0.03, depth: 0.04 });
    fret.position.set(bx, 3.47, 3.0);
    if (bi !== 2) {
      const bench = gooseBench(g, mats, 1.48, 1);
      bench.position.set(bx, P, 3.0);
    }
  });
  for (const s of [-1, 1]) {
    const bench = gooseBench(g, mats, 0.95, s);
    bench.position.set(s * 4.5, P, 2.4);
    bench.rotation.y = HALF_PI;
  }
  for (const z of [3.0, 1.8, -3.0]) box(g, mats.woodDark, 9.3, 0.22, 0.18, 0, 3.73, z);
  for (const s of [-1, 1]) box(g, mats.woodDark, 0.18, 0.22, 6.3, s * 4.5, 3.73, 0);
  for (const z of [3.0, -3.0]) box(g, mats.wood, 9.4, 0.08, 0.26, 0, 3.88, z);
  for (const s of [-1, 1]) box(g, mats.wood, 0.26, 0.08, 6.4, s * 4.5, 3.88, 0);
  for (const x of xs) for (const s of [-1, 1]) if (Math.abs(x + s * 0.15) < 4.6) brace(g, mats, x, 3.62, 3.0, s);
  const brackets = [];
  for (const z of [3.0, -3.0]) {
    for (const x of range(-4.5, 4.5, 0.45)) {
      brackets.push({ p: [x, 3.965, z], s: [0.15, 0.09, 0.15] });
      brackets.push({ p: [x, 4.03, z], s: [0.34, 0.05, 0.11] });
      brackets.push({ p: [x, 4.03, z], s: [0.11, 0.05, 0.36] });
    }
  }
  for (const x of [-4.5, 4.5]) {
    for (const z of range(-2.5, 2.5, 0.5)) {
      brackets.push({ p: [x, 3.965, z], s: [0.15, 0.09, 0.15] });
      brackets.push({ p: [x, 4.03, z], s: [0.36, 0.05, 0.11] });
    }
  }
  instanced(g, unitBox, mats.woodDark, brackets, 'waterside-hall-brackets');
  plaque(g, mats, 1.7, 0.42, 0, 3.5, 1.92, mats.woodDark, mats.gold, 0, '临水轩');
  for (const x of [-2.7, 2.7]) hangingLantern(g, mats, glow, x, 3.62, 3.0, 0.28);
  hangingLantern(g, mats, glow, 0, 3.62, 2.4, 0.35);
  curvedRoof(g, mats, { name: 'waterside-hall-roof', outline: rect(6.1, 4.6), inner: rect(4.6, 3.1), innerY: 0.0, ridge: 2.6, height: 2.6, lift: 0.8, y: 4.0, tile: 0.3, rings: 16 });
}

function buildPavilion(root, mats, glow) {
  const [px, , pz] = LANDMARKS.pavilion;
  const g = placeGroup(root, 'wind-pavilion', px, 0, pz);
  const toBridge = Math.atan2(LANDMARKS.bridge[2] - pz, LANDMARKS.bridge[0] - px);
  const off = toBridge - Math.PI / 6;
  const hex = (r) => [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(off + (k * Math.PI) / 3) * r, Math.sin(off + (k * Math.PI) / 3) * r]);
  const F = 0.52;
  prism(g, mats.stoneDark, hex(2.84), 0, 0.12);
  prism(g, mats.stone, hex(2.75), 0.12, 0.3);
  prism(g, mats.stoneLight, hex(2.9), 0.42, 0.1, 'wind-pavilion-platform');
  const tangent = -(toBridge + HALF_PI);
  const dist = 2.9 * Math.cos(Math.PI / 6);
  for (let k = 0; k < 2; k++) {
    const h = (F * (k + 1)) / 3;
    const d = dist + 0.18 + (1 - k) * 0.36;
    box(g, mats.stoneLight, 1.7, h, 0.36, Math.cos(toBridge) * d, h / 2, Math.sin(toBridge) * d, tangent);
  }
  const cols = hex(2.0);
  const colH = 3.0;
  for (const [x, z] of cols) columnWithBase(g, mats, 0.13, colH, x, F, z);
  const brackets = [];
  for (let k = 0; k < 6; k++) {
    const a = cols[k];
    const b = cols[(k + 1) % 6];
    const { length: len, mid, ry } = segmentFrame(a, b);
    const side = placeGroup(g, `wind-pavilion-side-${k}`, mid[0], 0, mid[1], ry);
    box(side, mats.woodDark, len + 0.12, 0.2, 0.16, 0, 3.4, 0);
    box(side, mats.wood, len + 0.2, 0.07, 0.22, 0, 3.53, 0);
    const fret = panel(side, mats, len - 0.3, 0.26, { pattern: k % 2 ? 'wan' : 'step', paper: false, frame: 0.03, depth: 0.04 });
    fret.position.set(0, 3.17, 0);
    brace(side, mats, -len / 2, 3.3, 0, 1);
    brace(side, mats, len / 2, 3.3, 0, -1);
    if (k === 0) {
      plaque(side, mats, 0.9, 0.3, 0, 3.12, -0.07, mats.woodDark, mats.gold, Math.PI, '听风亭');
    } else {
      const bench = gooseBench(side, mats, len - 0.28, -1);
      bench.position.set(0, F, 0);
    }
    const angle = Math.atan2(mid[1], mid[0]);
    for (const [r, ang] of [[2.0, off + (k * Math.PI) / 3], [Math.hypot(mid[0], mid[1]), angle]]) {
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      brackets.push({ p: [x, 3.62, z], r: [0, -ang, 0], s: [0.16, 0.1, 0.16] });
      brackets.push({ p: [x, 3.71, z], r: [0, -ang, 0], s: [0.38, 0.06, 0.12] });
      brackets.push({ p: [x, 3.71, z], r: [0, -ang, 0], s: [0.12, 0.06, 0.36] });
      brackets.push({ p: [x, 3.8, z], r: [0, -ang, 0], s: [0.18, 0.08, 0.18] });
      brackets.push({ p: [x, 3.88, z], r: [0, -ang, 0], s: [0.46, 0.06, 0.12] });
    }
  }
  instanced(g, unitBox, mats.woodDark, brackets, 'wind-pavilion-brackets');
  curvedRoof(g, mats, { name: 'wind-pavilion-roof', outline: hex(3.3), inner: hex(2.05), innerY: 0.05, height: 2.5, lift: 1.0, y: 3.6, tile: 0.28, rings: 16, ripple: 0.045 });
  hangingLantern(g, mats, glow, 0, 4.3, 0, 1.05);
}

function corridorSegment(parent, mats, glow, a, b, index) {
  const W = 2.2;
  const H = 2.7;
  const F = 0.24;
  const { length: L, mid, ry } = segmentFrame(a, b);
  const g = placeGroup(parent, `covered-corridor-segment-${index}`, mid[0], 0, mid[1], ry);
  box(g, mats.stone, L + 0.4, F, W + 0.2, 0, F / 2, 0);
  for (const s of [-1, 1]) box(g, mats.stoneLight, L + 0.4, 0.06, 0.16, 0, F + 0.01, s * (W / 2 + 0.04));
  const pavers = [];
  for (const x of range(-L / 2, L / 2, 0.6)) pavers.push({ p: [x, F + 0.002, 0], s: [0.02, 0.004, W - 0.1] });
  instanced(g, unitBox, mats.stoneDark, pavers);
  const bays = Math.max(2, Math.round(L / 2.3));
  const step = L / bays;
  const half = W / 2 - 0.16;
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + i * step;
    for (const s of [-1, 1]) columnWithBase(g, mats, 0.1, H - F, x, F, s * half);
    box(g, mats.woodDark, 0.12, 0.16, W - 0.12, x, H - 0.02, 0);
    box(g, mats.woodDark, 0.08, 0.7, 0.08, x, H + 0.42, 0);
    for (const s of [-1, 1]) {
      brace(g, mats, x, H - 0.22, s * half, 1);
      brace(g, mats, x, H - 0.22, s * half, -1);
    }
  }
  for (const s of [-1, 1]) {
    box(g, mats.woodDark, L + 0.2, 0.2, 0.13, 0, H - 0.12, s * half);
    box(g, mats.wood, L + 0.3, 0.09, 0.12, 0, H + 0.08, s * (half + 0.1));
    box(g, mats.woodDark, L + 0.3, 0.08, 0.1, 0, H + 0.4, s * 0.5);
  }
  box(g, mats.woodDark, L + 0.3, 0.12, 0.12, 0, H + 0.82, 0);
  const RL = L + 0.5;
  const RW = W + 0.9;
  const RH = 0.95;
  mesh(g, gableGeometry(RL, RW, RH, { ripple: 0.035, tile: 0.26, endLift: 0.22 }), [mats.roof, mats.woodDark], 0, H + 0.08, 0, `covered-corridor-roof-${index}`);
  box(g, mats.roofEdge, RL + 0.1, 0.18, 0.2, 0, H + 0.08 + RH + 0.06, 0);
  box(g, mats.roof, RL, 0.08, 0.3, 0, H + 0.08 + RH - 0.02, 0);
  const motifs = [];
  for (let x = -RL / 2 + 0.3; x < RL / 2 - 0.2; x += 0.42) motifs.push({ p: [x, H + RH + 0.15, 0], r: [0, 0, Math.PI / 4], s: [0.11, 0.11, 0.23] });
  instanced(g, unitBox, mats.roof, motifs, `covered-corridor-roof-${index}-ridge-pattern`);
  for (const sx of [-1, 1]) {
    const pts = [[RL / 2, H + RH + 0.12], [RL / 2 + 0.2, H + RH + 0.22], [RL / 2 + 0.25, H + RH + 0.45], [RL / 2 + 0.1, H + RH + 0.55]]
      .map(([x, y]) => new THREE.Vector3(sx * x, y, 0));
    mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.075, 6), mats.roofEdge, 0, 0, 0, `covered-corridor-roof-${index}-end`);
  }
  const k = Math.max(4, Math.round(RL / 0.26));
  const discs = [];
  for (let m = 0; m < k; m++) {
    const x = -RL / 2 + (RL * (m + 0.5)) / k;
    for (const s of [-1, 1]) discs.push({ p: [x, H + 0.085, s * (RW / 2 + 0.01)] });
  }
  instanced(g, discGeometry, mats.roofEdge, discs, `covered-corridor-roof-${index}-tile-ends`);
  const openBay = Math.floor(bays / 2);
  for (let j = 0; j < bays; j++) {
    const cx = -L / 2 + (j + 0.5) * step;
    const span = step - 0.22;
    for (const s of [-1, 1]) {
      const fret = panel(g, mats, span, 0.26, { pattern: j % 2 ? 'step' : 'wan', paper: false, frame: 0.03, depth: 0.04 });
      fret.position.set(cx, H - 0.35, s * half);
    }
    if (j !== openBay) {
      const bench = gooseBench(g, mats, span, 1);
      bench.position.set(cx, F, half);
    }
    box(g, mats.plaster, span, 0.46, 0.2, cx, F + 0.23, -half);
    box(g, mats.stoneLight, span + 0.04, 0.06, 0.28, cx, F + 0.49, -half);
    box(g, mats.stoneDark, span, 0.08, 0.22, cx, F + 0.04, -half);
    if (j % 2 === 0) hangingLantern(g, mats, glow, cx, H + 0.75, 0, 0.75);
  }
}

function buildCorridor(root, mats, glow) {
  const g = placeGroup(root, 'covered-corridor');
  const path = CORRIDOR_PATH.map((point) => [point[0], point[1]]);
  for (let i = 0; i < path.length - 1; i++) corridorSegment(g, mats, glow, path[i], path[i + 1], i);
  [path[1], path[2]].forEach(([x, z], i) => {
    const corner = placeGroup(g, `covered-corridor-corner-${i}`, x, 0, z);
    box(corner, mats.stone, 2.4, 0.25, 2.4, 0, 0.125, 0);
    curvedRoof(corner, mats, { name: `covered-corridor-corner-roof-${i}`, outline: rect(1.6, 1.6), inner: rect(0.95, 0.95), innerY: -0.05, height: 1.05, lift: 0.42, y: 2.82, tile: 0.25, rings: 10 });
  });
}

function buildMoonGate(root, mats) {
  const [mx, , mz] = LANDMARKS.moonGate;
  const left = 14.5;
  const right = 23;
  const L = right - left;
  const cx = (left + right) / 2;
  const g = placeGroup(root, 'moon-gate', cx, 0, mz);
  const gx = mx - cx;
  const H = 3.6;
  const T = 0.45;
  const R = 1.3;
  const gy = 1.45;
  pierceWall(g, mats, {
    length: L, height: H, thick: T, name: 'moon-gate-wall',
    windows: [
      { type: 'circle', r: R, x: gx, y: gy, open: true, frame: 1.12 },
      { type: 'hex', r: 0.55, x: gx - 3.0, y: 1.8, pattern: 'diamond' },
      { type: 'flower', r: 0.6, x: gx + 2.85, y: 1.8, pattern: 'radial' }
    ]
  });
  const leftW = gx - 1.1 + L / 2;
  const rightW = L / 2 - (gx + 1.1);
  box(g, mats.stoneDark, leftW, 0.45, T + 0.1, -L / 2 + leftW / 2, 0.225, 0);
  box(g, mats.stoneDark, rightW, 0.45, T + 0.1, L / 2 - rightW / 2, 0.225, 0);
  box(g, mats.stoneLight, 1.5, 0.16, T + 0.3, gx, 0.08, 0);
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI * 2) / 24;
    const joint = box(g, mats.stone, 0.18, 0.025, T + 0.09, gx + Math.cos(a) * R * 1.06, gy + Math.sin(a) * R * 1.06, 0);
    joint.rotation.z = a;
  }
  wallCap(g, mats, L, T, H, 'moon-gate-cap-roof');
  for (const s of [-1, 1]) plaque(g, mats, 1.4, 0.38, gx, 3.2, s * (T / 2 + 0.03), mats.stoneLight, mats.roofEdge, s > 0 ? 0 : Math.PI, '月洞花墙');
  box(g, mats.stoneDark, 0.82, 0.55, 0.82, -L / 2, 0.275, 0);
  box(g, mats.plaster, 0.72, H + 0.2, 0.72, -L / 2, (H + 0.2) / 2, 0);
  box(g, mats.roofEdge, 0.9, 0.12, 0.9, -L / 2, H + 0.26, 0);
  const cap = mesh(g, new THREE.ConeGeometry(0.62, 0.42, 4), mats.roof, -L / 2, H + 0.53, 0, 'moon-gate-pier-roof');
  cap.rotation.y = Math.PI / 4;
}

function buildBridge(root, mats) {
  const [bx, , bz] = LANDMARKS.bridge;
  const g = placeGroup(root, 'arched-bridge', bx, 0, bz, Math.PI / 2);
  const half = 4.5;
  const W = 2.0;
  const base = -0.7;
  const archR = 1.75;
  const deck = (x) => 0.18 + 1.3 * Math.cos((Math.PI * x) / (2 * half));
  const pts = [new THREE.Vector2(-half, base), new THREE.Vector2(-archR, base)];
  for (let i = 1; i < 40; i++) {
    const a = Math.PI - (Math.PI * i) / 40;
    pts.push(new THREE.Vector2(Math.cos(a) * archR, base + Math.sin(a) * archR));
  }
  pts.push(new THREE.Vector2(archR, base), new THREE.Vector2(half, base));
  for (let i = 0; i <= 48; i++) {
    const x = half - (2 * half * i) / 48;
    pts.push(new THREE.Vector2(x, deck(x)));
  }
  const body = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: W, bevelEnabled: false });
  body.translate(0, 0, -W / 2);
  mesh(g, body, mats.stone, 0, 0, 0, 'arched-bridge-body');
  const steps = [];
  for (const x of range(-half + 0.17, half - 0.17, 0.34)) steps.push({ p: [x, deck(x) - 0.03, 0], s: [0.36, 0.14, W - 0.12] });
  instanced(g, unitBox, mats.stoneLight, steps, 'arched-bridge-steps');
  const edge = [];
  for (let i = 0; i < 40; i++) {
    const x0 = -half + (2 * half * i) / 40;
    const x1 = -half + (2 * half * (i + 1)) / 40;
    const y0 = deck(x0);
    const y1 = deck(x1);
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (const s of [-1, 1]) edge.push({ p: [(x0 + x1) / 2, (y0 + y1) / 2 - 0.13, s * (W / 2 + 0.02)], r: [0, 0, Math.atan2(y1 - y0, x1 - x0)], s: [len + 0.02, 0.16, 0.06] });
  }
  const voussoirs = [];
  const count = 19;
  for (let k = 0; k < count; k++) {
    const a = (Math.PI * (k + 0.5)) / count;
    const key = k === Math.floor(count / 2);
    const rr = archR + (key ? 0.17 : 0.14);
    for (const s of [-1, 1]) {
      voussoirs.push({ p: [Math.cos(a) * rr, base + Math.sin(a) * rr, s * (W / 2 + 0.025)], r: [0, 0, a], s: [key ? 0.36 : 0.28, (Math.PI * (archR + 0.14)) / count - 0.025, key ? 0.09 : 0.06] });
    }
  }
  for (const s of [-1, 1]) {
    for (const x of [-half + 0.5, half - 0.5]) edge.push({ p: [x, -0.25, s * (W / 2 + 0.02)], s: [0.9, 0.08, 0.05] });
  }
  instanced(g, unitBox, mats.stoneLight, edge, 'arched-bridge-fascia');
  instanced(g, unitBox, mats.stoneLight, voussoirs, 'arched-bridge-voussoirs');
  const posts = [];
  const caps = [];
  const panels = [];
  const rails = [];
  const reliefs = [];
  const postXs = range(-4, 4, 0.8);
  for (const s of [-1, 1]) {
    const z = s * (W / 2 - 0.1);
    postXs.forEach((x, i) => {
      const y = deck(x);
      posts.push({ p: [x, y + 0.39, z], s: [0.15, 0.78, 0.15] });
      caps.push({ p: [x, y + 0.86, z], s: [0.17, 0.2, 0.17] });
      posts.push({ p: [x, y + 0.79, z], s: [0.19, 0.04, 0.19] });
      if (i < postXs.length - 1) {
        const x1 = postXs[i + 1];
        const y1 = deck(x1);
        const mx = (x + x1) / 2;
        const my = (y + y1) / 2;
        const ang = Math.atan2(y1 - y, x1 - x);
        const len = Math.hypot(x1 - x, y1 - y);
        panels.push({ p: [mx, my + 0.32, z], r: [0, 0, ang], s: [len - 0.14, 0.4, 0.07] });
        rails.push({ p: [mx, my + 0.66, z], r: [0, 0, ang], s: [len, 0.09, 0.1] });
        reliefs.push({ p: [mx, my + 0.32, z], r: [0, 0, ang], s: [len - 0.4, 0.22, 0.09] });
      }
    });
    for (const sx of [-1, 1]) {
      const drum = mesh(g, new THREE.CylinderGeometry(0.3, 0.3, 0.12, 20), mats.stoneLight, sx * 4.38, deck(sx * 4.38) + 0.3, z);
      drum.rotation.x = HALF_PI;
      box(g, mats.stone, 0.5, 0.12, 0.16, sx * 4.3, deck(sx * 4.3) + 0.04, z);
    }
  }
  instanced(g, unitBox, mats.stoneLight, posts, 'arched-bridge-posts');
  instanced(g, unitSphere, mats.stoneLight, caps, 'arched-bridge-post-caps');
  instanced(g, unitBox, mats.stone, panels, 'arched-bridge-balustrade');
  instanced(g, unitBox, mats.stoneLight, rails, 'arched-bridge-handrail');
  instanced(g, unitBox, mats.stoneDark, reliefs, 'arched-bridge-relief');
}

export function buildArchitecture(group, palette) {
  const mats = palette;
  const glow = new THREE.MeshStandardMaterial({ color: 0xc8432c, emissive: 0xff5a22, emissiveIntensity: 0.55, roughness: 0.65 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffbe6a, emissiveIntensity: 0.8, roughness: 0.5 });
  const root = placeGroup(group, 'architecture');
  buildPerimeter(root, mats);
  buildEntrance(root, mats, glow);
  buildHall(root, mats, glow);
  buildPavilion(root, mats, glow);
  buildCorridor(root, mats, glow);
  buildMoonGate(root, mats);
  buildBridge(root, mats);
  for (const [x, z] of [[-16.6, -6.2], [3.4, 14.2], [16.0, 6.9], [12.8, -3.4]]) stoneLantern(root, mats, lamp, x, z);
  root.traverse((item) => {
    if (item.isMesh) {
      item.castShadow = true;
      item.receiveShadow = true;
    }
  });
  return root;
}
