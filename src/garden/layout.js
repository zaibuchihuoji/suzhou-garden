export const GARDEN_BOUNDS = Object.freeze({ minX: -24, maxX: 24, minZ: -18, maxZ: 18 });

export const POND_CONTROL = Object.freeze([
  [-9.5, -1.5], [-8.5, -4.5], [-5.5, -6.2], [-2, -5.4], [1, -6.5], [4.5, -6], [7.5, -5.2],
  [9.8, -3], [10, 0], [8.5, 2.5], [6, 3.4], [4.2, 5.6], [2, 6.2], [-0.2, 5.4], [-2.5, 3.2],
  [-5.5, 3.8], [-8.2, 2.6], [-10, 0.8]
]);

export const LANDMARKS = Object.freeze({
  entrance: [0, 0, 17],
  hall: [-10, 0, -10],
  pavilion: [10, 0, -7],
  bridge: [2, 0, 3.7],
  moonGate: [19, 0, 5],
  rockery: [-13, 0, 2],
  pond: [0, 0, -1]
});

export const CORRIDOR_PATH = Object.freeze([[-3.4, 15.2], [-21.1, 15.2], [-21.1, -10], [-15.3, -10]]);
export const CORRIDOR_HALF_WIDTH = Object.freeze({ deck: 1.1, roof: 1.55 });

export const VIEWS = Object.freeze([
  { id: 'overview', index: '01', label: '全园胜景', subtitle: '一池三山 · 咫尺乾坤', position: [25, 22, 31], target: [0, 1.5, 0] },
  { id: 'entrance', index: '02', label: '入园探幽', subtitle: '曲径通幽 · 移步换景', position: [7, 8, 32], target: [0, 2.3, 15] },
  { id: 'hall', index: '03', label: '临水轩', subtitle: '凭栏听雨 · 坐看云起', position: [1, 7.5, 8], target: [-10, 2.2, -10] },
  { id: 'pavilion', index: '04', label: '听风亭', subtitle: '飞檐映水 · 四面来风', position: [17, 6.5, 5], target: [10, 2.5, -7] },
  { id: 'bridge', index: '05', label: '曲桥荷影', subtitle: '穿水而过 · 步步生莲', position: [1, 7.5, 16], target: [2, 1.6, 3] },
  { id: 'moonGate', index: '06', label: '月洞花墙', subtitle: '借景框景 · 别有洞天', position: [19, 5.7, 13], target: [19, 2.3, 5] },
  { id: 'rockery', index: '07', label: '叠石幽径', subtitle: '峰峦咫尺 · 石上生云', position: [-4.8, 9.6, 8.8], target: [-13, 1.8, 2] }
]);

export function getView(id) {
  return VIEWS.find((view) => view.id === id);
}

function insidePond(x, z) {
  let inside = false;
  for (let i = 0, j = POND_CONTROL.length - 1; i < POND_CONTROL.length; j = i++) {
    const [ax, az] = POND_CONTROL[i];
    const [bx, bz] = POND_CONTROL[j];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    if (Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)) < 0.3) return true;
  }
  return inside;
}

function onBridge(x, z) {
  return x > 1.08 && x < 2.92 && z > -0.8 && z < 8.2;
}

export function isWalkable(x, z) {
  if (x < -22.5 || x > 22.5 || z < -16.5 || z > 16.5) return false;
  if (x > -15.35 && x < -4.65 && z > -13.9 && z < -6.1) return false;
  if (Math.hypot(x + 13, z - 2) < 3.25) return false;
  if (z > 4.75 && z < 5.25 && x > 14.5 && x < 22.5 && Math.abs(x - 19) > 1.12) return false;
  if (onBridge(x, z) || ((x - 2) / 1.5) ** 2 + ((z + 2) / 1.25) ** 2 < 1) return true;
  return !insidePond(x, z);
}

export function walkHeight(x, z) {
  return onBridge(x, z) ? 0.18 + 1.3 * Math.cos((Math.PI * (3.7 - z)) / 9) : 0;
}

export function moveWalker([x, z], { forward, right }, yaw, distance) {
  const magnitude = Math.hypot(forward, right);
  if (!magnitude || !distance) return [x, z];
  const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * right) / magnitude;
  const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * right) / magnitude;
  const steps = Math.ceil(distance / 0.15);
  for (let step = 0; step < steps; step++) {
    const nx = x + (dx * distance) / steps;
    const nz = z + (dz * distance) / steps;
    if (isWalkable(nx, nz)) {
      x = nx;
      z = nz;
    } else if (isWalkable(nx, z)) {
      x = nx;
    } else if (isWalkable(x, nz)) {
      z = nz;
    }
  }
  return [Math.round(x * 1e6) / 1e6, Math.round(z * 1e6) / 1e6];
}
