// Before a build, download atlas drawings that data/atlas.json names and this machine does not
// have yet. Images stay out of git; a release built without this step ships the name and not the file.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restyle } from './atlas-palette.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const atlas = JSON.parse(await fs.readFile(path.join(root, 'data/atlas.json'), 'utf8'));
const referenced = [
  atlas.map?.image,
  ...atlas.places.flatMap(place => (place.maps ?? []).map(map => map.image)),
  ...atlas.items.flatMap(item => item.images ?? []),
].filter(Boolean);
const files = [...new Set(referenced.map(file => String(file).split('?')[0]))];
const publicDir = path.join(root, 'src/renderer/public');
const source = 'https://raw.githubusercontent.com/antonioalvromero/Ocarina-Atlas/main/public/content/';

async function present(rel) {
  try {
    const stat = await fs.stat(path.join(publicDir, rel));
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

const missing = [];
for (const rel of files) {
  if (!rel.startsWith('images/atlas/')) throw new Error('Atlas image is outside images/atlas: ' + rel);
  if (!(await present(rel))) missing.push(rel);
}
if (!missing.length) {
  console.log(`Atlas images present (${files.length}).`);
  process.exit(0);
}

async function download(name) {
  for (const folder of ['maps', 'media']) {
    const response = await fetch(source + folder + '/' + name);
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(response.status + ' ' + folder + '/' + name);
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

const failed = [];
for (const rel of missing) {
  const name = path.posix.basename(rel);
  if (!/^[a-z0-9.-]+\.(webp|svg)$/i.test(name)) throw new Error('Unexpected atlas image ' + rel);
  const contents = await download(name);
  if (!contents) { failed.push(rel); continue; }
  let body = contents;
  if (name.endsWith('.svg')) {
    const svg = contents.toString('utf8');
    if (!svg.startsWith('<svg') || /<script|<foreignObject|\son[a-z]+=|href="(https?:|\/\/)/i.test(svg)) throw new Error('Unsupported SVG ' + name);
    body = Buffer.from(restyle(svg));
  } else if (contents.toString('ascii', 0, 4) !== 'RIFF' || contents.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('Unsupported image ' + name);
  }
  const dest = path.join(publicDir, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, body);
  console.log('Fetched ' + rel);
}
if (failed.length) {
  console.error('Referenced in data/atlas.json, missing here, and not in Ocarina Atlas:');
  for (const rel of failed) console.error('  ' + rel);
  process.exit(1);
}
console.log(`Fetched ${missing.length} atlas image${missing.length === 1 ? '' : 's'}.`);
