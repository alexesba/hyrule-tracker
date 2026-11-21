import fs from 'node:fs/promises';
import path from 'node:path';
import { restyle } from './atlas-palette.mjs';

// Development import only. Runtime reads the bundled atlas and images.
const repo = 'https://raw.githubusercontent.com/antonioalvromero/Ocarina-Atlas/main/';
const load = async file => {
  const response = await fetch(repo + file);
  if (!response.ok) throw Error(response.status + ' ' + file);
  return response;
};
const [source, rules, license] = await Promise.all([
  load('src/data/oot.json').then(r => r.json()),
  load('src/lib/lichii-server.ts').then(r => r.text()),
  load('LICENSE').then(r => r.text()),
]);
const keys = new Map(source.items.map(item => [item.id, { hex32: [], hex64: [] }]));
for (const match of rules.matchAll(/\{\s*hashes:\s*\[([^\]]+)\],\s*itemIds:\s*\['([^']+)'\]\s*\}/g)) {
  keys.get(match[2])?.hex64.push(...Array.from(match[1].matchAll(/(0x[0-9a-f]+)n/gi), m => m[1]));
}
for (const match of rules.matchAll(/\{\s*hash:\s*(0x[0-9a-f]+),\s*itemId:\s*'([^']+)'\s*\}/gi)) {
  keys.get(match[2])?.hex32.push(Number(match[1]));
}
// Upstream gives these Gold Skulltula markers a neighbour's save keys. Each one takes the key pair
// holding its own flag, the one data/save-mapping.json reads for the spot its name and photos show.
const OWN_FLAG = {
  'lonlon-gs-02': '0x7d8ec14bdd1f6341', // wetland grotto crate (issue #18)
  'lonlon-gs-04': '0x25e6072d4df023b3', // stone tower
  'fuego-gs-03': '0x4d1b7e35ca0c6484', // mesh wall at the top of the scarecrow climb
  'fuego-gs-04': '0x7f498ada1c2e9c7a', // octagonal lava room
  'sombra-gs-01': '0xeafe60e592e9a3fb', // invisible scythe room
  'sombra-gs-02': '0xd23a7a2c9eced9ce', // falling spikes room
  'sombra-gs-03': '0xd7ffbe169189e50d', // pit in the fan corridor
};
const holder = new Map([...keys.values()].flatMap(k => k.hex64.map(h => [h.toLowerCase(), k])));
for (const [id, flag] of Object.entries(OWN_FLAG)) {
  if (!holder.has(flag)) throw Error('No save key ' + flag + ' for ' + id);
  keys.set(id, holder.get(flag));
}
// Upstream pins the wetland grotto inside Lon Lon Ranch; it is in south-east Hyrule Field.
const MOVED = { 'lonlon-gs-02': { place: 'llanura', at: { map: 'principal', x: 0.638, y: 0.768 } } };
const files = [source.map.image, ...source.places.flatMap(place => place.maps.map(map => map.image)),
  ...source.items.flatMap(item => item.images ?? [])];
const output = 'src/renderer/public/images/atlas';
const relative = file => 'images/atlas/' + path.posix.basename(file);
await fs.mkdir(output, { recursive: true });
const queue = [...new Set(files)];
const total = queue.length;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const file = queue.shift();
    if (!/^\/content\/(maps|media)\/[a-z0-9-]+\.(webp|svg)$/i.test(file)) throw Error('Unexpected asset path ' + file);
    const contents = Buffer.from(await (await load('public' + file)).arrayBuffer());
    if (file.endsWith('.svg')) {
      const svg = contents.toString('utf8');
      if (!svg.startsWith('<svg') || /<script|<foreignObject|\son[a-z]+=|href="(https?:|\/\/)/i.test(svg)) throw Error('Unsupported SVG ' + file);
    } else if (contents.toString('ascii', 0, 4) !== 'RIFF' || contents.toString('ascii', 8, 12) !== 'WEBP') {
      throw Error('Unsupported image ' + file);
    }
    await fs.writeFile(path.join(output, path.posix.basename(file)), file.endsWith('.svg') ? restyle(contents.toString('utf8')) : contents);
  }
}));
const map = { image: relative(source.map.image), width: source.map.width, height: source.map.height };
// SVG viewBox of each floor map: the live Link pin projects game coordinates into it.
const viewBox = async image => {
  if (!image.endsWith('.svg')) return undefined;
  const head = (await fs.readFile(path.join(output, path.posix.basename(image)), 'utf8')).slice(0, 512);
  const [vx, vy, vw, vh] = (head.match(/viewBox="([^"]+)"/)?.[1] ?? '').trim().split(/\s+/).map(Number);
  return [vx, vy, vw, vh].every(Number.isFinite) && vw > 0 && vh > 0 ? { vx, vy, vw, vh } : undefined;
};
const places = await Promise.all(source.places.map(async ({ id, name, kind, pin, maps, startMap }) => ({
  id, name, kind, pin, startMap,
  maps: await Promise.all(maps.map(async m => ({ id: m.id, label: m.label, image: relative(m.image), aspect: m.aspect, vb: await viewBox(m.image) }))),
})));
const items = source.items.map(({ id, place, cat, at, name, age, night, images = [] }) => ({
  id, place, cat, at, name, age, night, images: images.map(relative), ...keys.get(id), ...MOVED[id],
}));
await fs.writeFile('data/atlas.json', JSON.stringify({ map, places, items }, null, 2) + '\n');
await fs.writeFile('docs/atlas-license.txt', license);
console.log(`${places.length} atlas regions, ${items.length} locations, ${total} offline assets`);
