// Builds the drawn-ground mask each floor map uses to skip a pin in the blank margin.
// Run from the repo root: node scripts/build-map-land.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'data/atlas.json'), 'utf8'));
const imgDir = path.join(root, 'src/renderer/public/images/atlas');
const CELL = 8;
const REACH = 18;

function flatten(d) {
  const re = /([MmLlHhVvCcQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  const toks = [];
  let m;
  while ((m = re.exec(d))) toks.push(m[1] ?? m[2]);
  const rings = [];
  let ring = [];
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
  const num = () => Number(toks[i++]);
  const line = (x, y) => { ring.push([x, y]); cx = x; cy = y; };
  const quad = (x1, y1, x, y) => {
    const ox = cx, oy = cy;
    for (let s = 1; s <= 8; s++) {
      const t = s / 8, u = 1 - t;
      line(u * u * ox + 2 * u * t * x1 + t * t * x, u * u * oy + 2 * u * t * y1 + t * t * y);
    }
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    if (c === 'Z') { if (ring.length) rings.push(ring); ring = []; cx = sx; cy = sy; continue; }
    if (c === 'M') {
      if (ring.length) rings.push(ring);
      ring = [];
      const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0);
      line(x, y); sx = x; sy = y; cmd = rel ? 'l' : 'L'; continue;
    }
    if (c === 'L' || c === 'T') { line(num() + (rel ? cx : 0), num() + (rel ? cy : 0)); continue; }
    if (c === 'H') { line(num() + (rel ? cx : 0), cy); continue; }
    if (c === 'V') { line(cx, num() + (rel ? cy : 0)); continue; }
    if (c === 'Q') {
      const ox = cx, oy = cy;
      const x1 = num() + (rel ? ox : 0), y1 = num() + (rel ? oy : 0);
      const x = num() + (rel ? ox : 0), y = num() + (rel ? oy : 0);
      cx = ox; cy = oy; quad(x1, y1, x, y); continue;
    }
    if (c === 'C') {
      const ox = cx, oy = cy;
      const x1 = num() + (rel ? ox : 0), y1 = num() + (rel ? oy : 0);
      const x2 = num() + (rel ? ox : 0), y2 = num() + (rel ? oy : 0);
      const x = num() + (rel ? ox : 0), y = num() + (rel ? oy : 0);
      for (let s = 1; s <= 8; s++) {
        const t = s / 8, u = 1 - t;
        line(u * u * u * ox + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * oy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y);
      }
      continue;
    }
    if (c === 'A') { i += 5; line(num() + (rel ? cx : 0), num() + (rel ? cy : 0)); continue; }
    break;
  }
  if (ring.length) rings.push(ring);
  return rings;
}

function holds(rings, x, y) {
  let hits = 0;
  for (const ring of rings) {
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
      const [xi, yi] = ring[a], [xj, yj] = ring[b];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hits++;
    }
  }
  return hits % 2 === 1;
}

function landPaths(svg) {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/<g id="salidas">[\s\S]*?<\/g>/, '');
  return [...body.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map(hit => flatten(hit[1])).filter(rings => rings.length);
}

const out = {};
for (const place of atlas.places) {
  for (const map of place.maps ?? []) {
    if (!map.vb) continue;
    const file = path.join(imgDir, path.basename(map.image));
    if (!fs.existsSync(file)) continue;
    const paths = landPaths(fs.readFileSync(file, 'utf8'));
    const { vx, vy, vw, vh } = map.vb;
    const cols = Math.ceil(vw / CELL);
    const rows = Math.ceil(vh / CELL);
    const filled = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = vx + (col + 0.5) * CELL, y = vy + (row + 0.5) * CELL;
        if (paths.some(rings => holds(rings, x, y))) filled[row * cols + col] = 1;
      }
    }
    const reach = Math.ceil(REACH / CELL);
    const mask = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!filled[row * cols + col]) continue;
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            if (dx * dx + dy * dy > reach * reach) continue;
            const c = col + dx, r = row + dy;
            if (c >= 0 && r >= 0 && c < cols && r < rows) mask[r * cols + c] = 1;
          }
        }
      }
    }
    const bytes = Buffer.alloc(Math.ceil(mask.length / 8));
    for (let bit = 0; bit < mask.length; bit++) if (mask[bit]) bytes[bit >> 3] |= 1 << (bit & 7);
    out[`${place.id}:${map.id}`] = { vx, vy, vw, vh, cell: CELL, cols, rows, bits: bytes.toString('base64') };
  }
}
const dest = path.join(root, 'src/core/map-land.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${Object.keys(out).length} maps -> ${dest}`);
