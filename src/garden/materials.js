import * as THREE from 'three';

function texture(seed, base, marks, repeat = 2) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < marks; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.3 + random() * 2.8;
    context.fillStyle = random() > 0.5 ? 'rgba(40,38,30,0.035)' : 'rgba(255,255,245,0.08)';
    context.beginPath();
    context.ellipse(x, y, radius * (1 + random() * 2), radius, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = 4;
  return map;
}

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#bd9a75';
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 95; i++) {
    const x = (i * 47.23) % 256;
    context.strokeStyle = i % 3 === 0 ? 'rgba(65,37,26,0.12)' : 'rgba(255,230,184,0.1)';
    context.lineWidth = i % 5 === 0 ? 2 : 0.5;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x + Math.sin(i) * 5, 75, x - Math.cos(i) * 7, 150, x + Math.sin(i * 3) * 4, 256);
    context.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 2);
  return map;
}

function waterBump() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#808080';
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 75; i++) {
    const x = (i * 89.17) % 256;
    const y = (i * 41.31) % 256;
    context.strokeStyle = i % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';
    context.lineWidth = 0.5 + (i % 3) * 0.35;
    context.beginPath();
    context.ellipse(x, y, 8 + i % 21, 1.8 + i % 4, -0.17, 0, Math.PI * 2);
    context.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5, 4);
  return map;
}

export function createPalette() {
  const plasterMap = texture(83, '#f5f1e8', 1700, 2);
  const stoneMap = texture(107, '#deddd1', 2600, 3);
  const earthMap = texture(11, '#d4d4c7', 2900, 5);
  const timberMap = woodTexture();
  const standard = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...options });
  return {
    plaster: standard('#eee9dc', { map: plasterMap }),
    plasterWarm: standard('#e5decc', { map: plasterMap }),
    wood: standard('#765039', { map: timberMap, roughness: 0.75 }),
    woodDark: standard('#4c3329', { map: timberMap, roughness: 0.81 }),
    roof: standard('#34454b', { map: stoneMap, roughness: 0.83, side: THREE.DoubleSide }),
    roofEdge: standard('#506065', { map: stoneMap, roughness: 0.84 }),
    stone: standard('#98988b', { map: stoneMap }),
    stoneLight: standard('#c5c5b8', { map: stoneMap }),
    stoneDark: standard('#616b66', { map: stoneMap }),
    moss: standard('#789269', { map: earthMap, side: THREE.DoubleSide }),
    grass: standard('#89a17a', { map: earthMap, side: THREE.DoubleSide }),
    path: standard('#c6bba2', { map: stoneMap, side: THREE.DoubleSide }),
    water: new THREE.MeshPhysicalMaterial({ color: '#426965', metalness: 0.15, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.09, transparent: true, opacity: 0.94, bumpMap: waterBump(), bumpScale: 0.095, side: THREE.DoubleSide, depthWrite: false }),
    lotus: standard('#5d8b64', { side: THREE.DoubleSide }),
    flower: standard('#f3bcc0', { side: THREE.DoubleSide, roughness: 0.8 }),
    leaf: standard('#628957', { side: THREE.DoubleSide }),
    leafLight: standard('#9bbb72', { side: THREE.DoubleSide }),
    leafDark: standard('#385e48', { side: THREE.DoubleSide }),
    bamboo: standard('#7b9f5d', { side: THREE.DoubleSide }),
    bambooLeaf: standard('#71905b', { side: THREE.DoubleSide }),
    pine: standard('#435f4e', { side: THREE.DoubleSide }),
    blossom: standard('#f1d1c7', { side: THREE.DoubleSide }),
    gold: standard('#c19e63', { metalness: 0.38, roughness: 0.42 })
  };
}
