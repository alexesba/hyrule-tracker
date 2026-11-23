import { writeFile } from 'node:fs/promises';

const files = 'https://objmap.zeldamods.org/game_files/';
const radar = 'https://radar.zeldamods.org/objs/';
const guide = 'https://www.zeldadungeon.net/breath-of-the-wild-walkthrough/';
const editor = 'https://raw.githubusercontent.com/marcrobledo/savegame-editors/master/zelda-botw/';
const zeldaXtreme = 'https://www.zeldaxtreme.com/breath-of-the-wild/';

async function get(url, format = 'json') {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response[format]();
}

function objects(query, field = 'MainField') {
  return get(`${radar}${field}/?q=${encodeURIComponent(query)}&withMapNames=true&limit=-1`);
}

const [{ markers }, labels, shrines, areas, names, hashes, guidePins, enemies, chests, landmarks, fairies] = await Promise.all([
  get(files + 'map_summary/MainField/static.json'),
  get(files + 'text/StaticMsg/LocationMarker.json'),
  get(files + 'text/StaticMsg/Dungeon.json'),
  get(files + 'ecosystem/MapTower.json'),
  get(files + 'names.json'),
  get(editor + 'zelda-botw.hashes.csv', 'text'),
  get(zeldaXtreme + 'map_data/markers.json?v=3'),
  objects('Enemy_Giant* OR Enemy_Golem* OR Enemy_Sandworm* OR Enemy_Lynel*'),
  objects('TBox_Field* OR TBox_Dungeon*'),
  objects('LocationTag'),
  objects('Npc_DressFairy*'),
]);

const rounding = n => Math.round(n * 10) / 10;
const point = ({ X, Z }) => [rounding(X), rounding(Z)];
const actorPoint = ({ pos: [x, , z] }) => [rounding(x), rounding(z)];
const slug = title => title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const wiki = title => 'https://www.zeldadungeon.net/wiki/' + encodeURIComponent(title.replaceAll(' ', '_'));
const keyRows = hashes.trim().split(/\r?\n/).map(line => line.split(';'));
const flags = new Set(keyRows.map(([, , name]) => name));
const korokFlags = new Map(keyRows.flatMap(([, , name]) => {
  const match = /^MainField_Npc_HiddenKorok(?:Fly|Ground)_(\d+)$/.exec(name);
  return match ? [[Number(match[1]), name]] : [];
}));
const bossFlags = new Map(keyRows.flatMap(([, , name]) => {
  const match = /^(?:MainField_)?(?:IsDefeated_)?Enemy_(?:Giant|Golem|Sandworm)\w*?_(\d+)$/.exec(name);
  return match ? [[Number(match[1]), name]] : [];
}));

const items = [];
const ids = new Set();
function add(category, id, name, at, data = {}) {
  const fullId = (category === 'main-quest' || category === 'dlc-quest' ? 'quest' : category) + ':' + id;
  if (ids.has(fullId)) return;
  ids.add(fullId);
  items.push({ id: fullId, category, name, ...(at && { at, layer: 'surface' }), ...data });
}

const towers = markers.Tower.map(pin => ({
  name: labels[pin.MessageID], at: point(pin.Translate), number: Number(pin.MessageID.slice(5)), flag: pin.SaveFlag,
}));
const ridge = (coordinates, [x, z]) => {
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [a, b] = coordinates[i];
    const [c, d] = coordinates[j];
    if ((b > z) !== (d > z) && x < (c - a) * (z - b) / (d - b) + a) inside = !inside;
  }
  return inside;
};
const regions = Object.entries(areas).flatMap(([number, shapes]) => shapes.flatMap(shape => {
  const polygons = shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
  return polygons.map(polygon => ({
    number: Number(number), polygon,
    bounds: polygon[0].reduce(([w, e, n, s], [x, z]) => [Math.min(w, x), Math.max(e, x), Math.min(n, z), Math.max(s, z)], [Infinity, -Infinity, Infinity, -Infinity]),
  }));
}));
function regionNumber(at) {
  const [x, z] = at;
  return regions.find(({ bounds: [w, e, n, s], polygon: [shell, ...holes] }) =>
    x >= w && x <= e && z >= n && z <= s && ridge(shell, at) && !holes.some(hole => ridge(hole, at)))?.number;
}
const towerByArea = new Map(towers.map(tower => [regionNumber(tower.at), tower]));

for (const tower of towers) add('tower', slug(tower.name), tower.name, tower.at, { key: tower.flag });
for (const pin of markers.Dungeon) {
  const id = pin.MessageID;
  const dlc = Number(id.slice(7)) >= 120;
  add(dlc ? 'dlc-shrine' : 'shrine', id, shrines[id], point(pin.Translate),
    { key: 'Clear_' + id, found: pin.SaveFlag, detail: shrines[id + '_sub'], guide: wiki(shrines[id]), ...(dlc && { edition: 'dlc' }) });
}
for (const kind of ['Place', 'Labo', 'Shop']) {
  for (const pin of markers[kind]) {
    const at = point(pin.Translate);
    const category = kind === 'Shop' ? 'shop' : kind === 'Labo' ? 'lab' : pin.Icon === 'Hatago' ? 'stable' : 'location';
    const name = labels[pin.MessageID] ?? labels[pin.SaveFlag?.slice(9)] ?? pin.SaveFlag?.slice(9);
    if (!name) continue;
    add(category, kind === 'Shop' ? `${pin.Icon}-${at.join(',')}` : pin.SaveFlag, kind === 'Shop' ? `${pin.Icon.slice(4).replace(/./, s => s.toUpperCase())} · ${name}` : name,
      at, { ...(kind !== 'Shop' && flags.has(pin.SaveFlag) && { key: pin.SaveFlag }), guide: wiki(name) });
  }
}
const placeIds = new Set(markers.Place.map(pin => pin.MessageID));
for (const pin of markers.Location) {
  const name = labels[pin.MessageID];
  if (!name || placeIds.has(pin.MessageID) || pin.ShowLevel < 4) continue;
  const key = 'Location_' + pin.MessageID;
  add('location', key, name, point(pin.Translate), flags.has(key) ? { key } : { tracking: 'location' });
}
for (const actor of landmarks) {
  const name = labels[actor.messageid];
  const key = 'Location_' + actor.messageid;
  if (name && !placeIds.has(actor.messageid) && flags.has(key)) add('location', key, name, actorPoint(actor), { key, guide: wiki(name) });
}

const korokHints = new Map(guidePins.filter(pin => pin.c === 'korok').flatMap(({ d }) => {
  const match = /^(.*?)\s*\(([A-Z]\d+)\)/.exec(d);
  return match ? [[match[2], match[1]]] : [];
}));
for (const pin of markers.Korok) add('korok', pin.id, 'Korok ' + pin.id, point(pin.Translate), {
  key: korokFlags.get(pin.hash_id), detail: korokHints.get(pin.id), seeds: 1, guide: guide + 'korok-seed-locations/',
});

const fairyNames = ['Cotera', 'Mija', 'Kaysa', 'Tera'];
for (const actor of fairies) {
  const index = Number(/^Npc_DressFairy_(0[0-3])$/.exec(actor.name)?.[1]);
  if (!Number.isNaN(index)) add('fairy', actor.name, fairyNames[index], actorPoint(actor), { guide: wiki(fairyNames[index]), featured: true });
}
for (const actor of enemies) {
  const { name, hash_id: hash, hard_mode: hard } = actor;
  if (/Little|_R$|SandwormR/.test(name) || (hard && !name.startsWith('Enemy_Lynel'))) continue;
  const category = name.startsWith('Enemy_Giant') ? 'hinox' : name.startsWith('Enemy_Golem') ? 'talus'
    : name.startsWith('Enemy_Sandworm') ? 'molduga' : 'lynel';
  add(category, hash, names[name] ?? ({ hinox: 'Hinox', talus: 'Stone Talus', molduga: 'Molduga', lynel: 'Lynel' })[category],
    actorPoint(actor), { ...(category === 'lynel' ? { tracking: 'location' } : { key: bossFlags.get(hash) }),
      ...(hard && { edition: 'dlc', detail: 'Master Mode' }) });
}
const chestKeys = new Set(keyRows.flatMap(([, , name]) => name?.startsWith('MainField_TBox_') ? [name] : []));
for (const actor of chests) {
  const key = `MainField_${actor.name}_${actor.hash_id}`;
  if (!chestKeys.has(key) || actor.hard_mode) continue;
  const drop = actor.drop?.[1];
  const reward = names[drop];
  add('chest', actor.hash_id, reward ?? 'Treasure Chest', actorPoint(actor),
    { key, detail: reward && 'Treasure Chest' });
}

// Convert the guide's Leaflet coordinates using shared tower landmarks.
const towerPairs = guidePins.filter(pin => pin.c === 'tower').flatMap(pin => {
  const match = towers.find(tower => slug(tower.name) === slug(pin.t));
  return match ? [{ p: pin.p, at: match.at }] : [];
});
function fit(pAxis, atAxis) {
  const avg = (values) => values.reduce((sum, x) => sum + x, 0) / values.length;
  const pMean = avg(towerPairs.map(({ p }) => p[pAxis]));
  const atMean = avg(towerPairs.map(({ at }) => at[atAxis]));
  const slope = towerPairs.reduce((sum, { p, at }) => sum + (p[pAxis] - pMean) * (at[atAxis] - atMean), 0)
    / towerPairs.reduce((sum, { p }) => sum + (p[pAxis] - pMean) ** 2, 0);
  return p => rounding((p - pMean) * slope + atMean);
}
if (towerPairs.length < 12) throw new Error('The map coordinate references no longer match');
const mapX = fit(1, 0);
const mapZ = fit(0, 1);
const guidePoint = ([y, x]) => [mapX(x), mapZ(y)];
const memoryDemos = new Map([
  ['Subdued Ceremony', 'Demo126_0'], ['Resolve and Grief', 'Demo127_0'], ["Zelda's Resentment", 'Demo128_0'],
  ['Blades of the Yiga', 'Demo129_0'], ['A Premonition', 'Demo130_0'], ['Silent Princess', 'Demo131_0'],
  ['To Mount Lanayru', 'Demo132_0'], ['Shelter from the Storm', 'Demo133_0'], ['Father and Daughter', 'Demo134_0'],
  ['Slumbering Power', 'Demo135_0'], ['Return of Calamity Ganon', 'Demo136_0'], ['Despair', 'Demo137_0'], ["Zelda's Awakening", 'Demo138_0'],
]);
const extraCategories = { memory: 'memory', shrinequest: 'shrine-quest', sidequest: 'quest', voice: 'voice' };
for (const pin of guidePins) {
  const category = extraCategories[pin.c];
  if (!category) continue;
  const flag = category === 'memory' ? 'IsPlayed_' + memoryDemos.get(pin.t) : undefined;
  add(category, slug(pin.t), pin.t, guidePoint(pin.p), {
    ...(flags.has(flag) && { key: flag }), ...(category !== 'voice' && { guide: wiki(pin.t) }),
    ...(category === 'voice' ? { edition: 'switch2' } : /^EX /.test(pin.t) ? { edition: 'dlc' } : {}),
  });
}
for (const [title, place, key] of [
  ["Mipha's Touch", "Zora's Domain", 'IsPlayed_Demo152_0'],
  ["Revali's Flap", 'Rito Village', 'IsPlayed_Demo151_0'],
  ["Daruk's Mettle", 'Goron City', 'IsPlayed_Demo150_0'],
  ["Urbosa's Hand", 'Gerudo Town', 'IsPlayed_Demo153_0'],
  ['The Master Sword', 'Korok Forest', 'Get_MasterSword_Finish'],
]) {
  const placeItem = items.find(item => slug(item.name) === slug(place));
  add('memory', slug(title), title, placeItem?.at, { key, guide: wiki(title) });
}
add('quest', 'a-gift-from-the-monks', 'A Gift from the Monks', items.find(item => item.name === 'Forgotten Temple')?.at,
  { key: 'IsGet_Armor_127_Head', guide: wiki('A Gift from the Monks') });

const mainQuests = [
  ['FirstTower', 'Follow the Sheikah Slate', 'FirstTower_Finish', 'great-plateau'],
  ['FindDungeon', 'The Isolated Plateau', 'IsGet_PlayerStole2', 'great-plateau'],
  ['Find_Impa', 'Seek Out Impa', 'Find_Impa_Finish', 'seek-out-impa'],
  ['Find_4Relic', 'Free the Divine Beasts', 'Find_4Relic_Finish', 'seek-out-impa'],
  ['Camera', 'Locked Mementos', 'Hateno_SheikPad_PowerUp_Finish', 'locked-mementos'],
  ['Fairy', 'Find the Fairy Fountain', 'FairyFountain_Finish', 'locked-mementos'],
  ['PictureMemory', 'Captured Memories', 'PictureMemory_Finish', 'captured-memories'],
  ['ZoraDomain', "Reach Zora's Domain", 'GotoZoraVillage_Finish', 'zoras-domain'],
  ['Water_Relic', 'Divine Beast Vah Ruta', 'IsGet_Obj_HeroSoul_Zora', 'vah-ruta-dungeon'],
  ['Wind_Relic', 'Divine Beast Vah Medoh', 'IsGet_Obj_HeroSoul_Rito', 'vah-medoh-dungeon'],
  ['Fire_Relic', 'Divine Beast Vah Rudania', 'IsGet_Obj_HeroSoul_Goron', 'vah-rudania-dungeon'],
  ['GerudoTown', 'Forbidden City Entry', 'IsGet_Armor_053_Head', 'gerudo-town'],
  ['Electric_Relic', 'Divine Beast Vah Naboris', 'IsGet_Obj_HeroSoul_Gerudo', 'vah-naboris-dungeon'],
  ['Get_MasterSword', "The Hero's Sword", 'Get_MasterSword_Finish', 'the-master-sword'],
  ['GanonQuest', 'Destroy Ganon', 'GameClear', 'hyrule-castle'],
];
for (const [id, name, key, path] of mainQuests) {
  const pin = guidePins.find(pin => pin.c === 'mainquest' && pin.t === name);
  const castle = items.find(item => item.name === 'Hyrule Castle');
  add('main-quest', id, name, id === 'GanonQuest' ? castle?.at : pin && guidePoint(pin.p), {
    key: flags.has(key) ? key : undefined, found: flags.has(id + '_Activated') ? id + '_Activated' : undefined, guide: guide + path + '/',
  });
}
for (const [name, quest] of [['Vah Ruta', 'Water_Relic'], ['Vah Medoh', 'Wind_Relic'], ['Vah Rudania', 'Fire_Relic'], ['Vah Naboris', 'Electric_Relic']]) {
  const pin = guidePins.find(pin => pin.c === 'beast' && pin.t.endsWith(name));
  add('temple', quest, 'Divine Beast ' + name, pin && guidePoint(pin.p),
    { key: items.find(item => item.id === 'quest:' + quest)?.key });
}
for (const [id, name, key, place] of [
  ['BalladOfHeroes', "EX The Champions' Ballad", 'BalladOfHeroes_Finish', 'Shrine of Resurrection'],
  ['TrialSword', 'EX Trial of the Sword', '100enemy_Clear_Senior', 'Korok Forest'],
]) {
  const pin = guidePins.find(pin => pin.c === 'landmark' && pin.t === place);
  add('dlc-quest', id, name, items.find(item => item.name === place)?.at ?? (pin && guidePoint(pin.p)),
    { key, edition: 'dlc', guide: wiki(name) });
}
for (const [title, place] of [
  ['EX Strange Mask Rumors', 'Woodland Stable'], ['EX Teleportation Rumors!', 'South Akkala Stable'],
  ['EX Treasure: Ancient Mask', 'Outpost Ruins'], ['EX Treasure: Fairy Clothes', 'Outpost Ruins'],
  ['EX Treasure: Twilight Relic', 'Outpost Ruins'], ['EX Treasure: Phantasma', 'Outpost Ruins'],
  ['EX Ancient Horse Rumors', 'Highland Stable'], ['EX Royal Guard Rumors', 'Riverside Stable'],
  ['EX Treasure: Merchant Hood', 'Deya Village Ruins'], ['EX Treasure: Garb of Winds', 'Deya Village Ruins'],
  ['EX Treasure: Usurper King', 'Deya Village Ruins'], ['EX Treasure: Dark Armor', 'Deya Village Ruins'],
  ["EX Champion Mipha's Song", "Ja'Abu Ridge"], ["EX Champion Revali's Song", 'Cuho Mountain'],
  ["EX Champion Daruk's Song", 'Golow River'], ["EX Champion Urbosa's Song", 'East Gerudo Mesa'],
]) {
  const anchor = items.find(item => slug(item.name) === slug(place));
  add('dlc-quest', slug(title), title, anchor?.at, { edition: 'dlc', detail: place, guide: wiki(title) });
}
add('quest', 'xenoblade-chronicles-2', 'Xenoblade Chronicles 2', items.find(item => item.name === 'Bridge of Hylia')?.at, {
  hint: ['À noite, procure as estrelas vermelhas na Ponte de Hylia, no olho esquerdo de Skull Lake e no topo de Hebra Peak.', 'At night, watch for red shooting stars at the Bridge of Hylia, the left eye of Skull Lake, and the summit of Hebra Peak.'],
  guide: wiki('Xenoblade Chronicles 2'),
});
for (const [name, id, quest] of [
  ['Illusory Waterblight Ganon', 'Zora', 'Water_Relic'], ['Illusory Windblight Ganon', 'Rito', 'Wind_Relic'],
  ['Illusory Fireblight Ganon', 'Goron', 'Fire_Relic'], ['Illusory Thunderblight Ganon', 'Gerudo', 'Electric_Relic'],
]) {
  add('rematch', id, name, items.find(item => item.id === 'temple:' + quest)?.at,
    { key: 'BalladOfHero' + id + '_Finish', edition: 'dlc', guide: wiki("EX Champion " + ({ Zora: "Mipha's", Rito: "Revali's", Goron: "Daruk's", Gerudo: "Urbosa's" })[id] + ' Song') });
}
const activities = [
  ["Pondo's Lodge", 'Snowball Bowling', 'Roll the snowball down the slope and aim to knock down all ten pins.'],
  ['Tabantha Bridge Stable', 'Boom Bam Golf', 'Strike the boulder across Tanagar Canyon and aim for the hole in as few hits as possible.'],
  ['Highland Stable', 'Mounted Obstacle Course', 'Take a horse to the course and clear the hurdles in order.'],
  ['Mounted Archery Camp', 'Mounted Archery', 'Stay on horseback and shoot the balloons before the timer runs out.'],
  ['Gerudo Town', 'Sand-Seal Racing', 'After freeing Vah Naboris, complete the course through the marked gates.'],
  ['Rito Village', 'Flight Range', 'Use the updraft and shoot the targets while gliding.'],
  ['Lurelin Village', 'Treasure Chest Game', 'Talk to Cloyne and choose one of the three chests.'],
  ['Ridgeland Tower', 'Bird-Man Research Study', 'Glide from the tower and land as far from the departure point as possible.'],
  ['Gut Check Rock', 'Gut Check Challenge', 'Climb the rock and collect the required rupees before you reach the top.'],
];
for (const [place, name, detail] of activities) {
  const at = items.find(item => item.name === place)?.at;
  add('minigame', slug(name), name, at, { detail, guide: wiki(name) });
}

const armorNames = new Set();
for (const [key, name] of Object.entries(names).sort(([left], [right]) => left.localeCompare(right))) {
  if (flags.has('IsRegisteredPictureBook_' + key)) add('compendium', key, name, undefined, { key: 'IsRegisteredPictureBook_' + key });
  if (/^Armor_/.test(key) && flags.has('IsGet_' + key) && !armorNames.has(name) && !/★|\*/.test(name)) {
    armorNames.add(name);
    add('armor', key, name, undefined, { key: 'IsGet_' + key });
  }
}
for (const [name, place, hint] of [
  ['Lord of the Mountain', 'Satori Mountain', ['Quando a luz verde aparecer, vá até o lago sob a cerejeira. Aproxime-se em silêncio se quiser montar.', 'When the green light appears, head to the pond beneath the cherry tree. Approach quietly if you want to mount.']],
  ['Hylian Shield', 'Lockup', ['No cárcere do castelo, derrote o Stalnox para abrir o baú do escudo.', 'Defeat the Stalnox in Hyrule Castle’s Lockup to reveal the shield chest.']],
  ['The Horned Statue', 'Hateno Village', ['Fale com a estátua na encosta perto da entrada da vila para trocar um recipiente de coração por vigor, ou vice-versa.', 'Talk to the statue on the slope near the village entrance to trade a heart container for stamina, or the reverse.']],
  ['Eventide Island', 'Eventide Island', ['Ao chegar à ilha, você perde o equipamento temporariamente. Use o que encontrar e leve as três esferas aos altares.', 'You temporarily lose your equipment on arrival. Use what you find and carry the three orbs to their pedestals.']],
  ['Kilton', 'Skull Lake', ['Procure Kilton à noite no lado oeste do lago. Depois de falar com ele, a loja passa a aparecer perto de vilas à noite.', 'Look for Kilton at night on the western side of the lake. Once you talk to him, his shop appears near villages at night.']],
  ['Horse God Malanya', 'Malanya Spring', ['Abra a fonte para poder recuperar cavalos registrados que morreram.', 'Open the fountain to revive registered horses that have died.']],
]) {
  add('location', 'secret-' + slug(name), name, items.find(item => item.name === place)?.at,
    { featured: true, hint, guide: wiki(name) });
}

for (const item of items) {
  if (!item.at) continue;
  const tower = towerByArea.get(regionNumber(item.at)) ?? towers.slice().sort((a, b) =>
    Math.hypot(item.at[0] - a.at[0], item.at[1] - a.at[1]) - Math.hypot(item.at[0] - b.at[0], item.at[1] - b.at[1]))[0];
  item.region = 'tower:' + slug(tower.name);
}

for (const [category, count] of Object.entries({ shrine: 120, 'dlc-shrine': 16, tower: 15, korok: 900, 'main-quest': 15 })) {
  const actual = items.filter(item => item.category === category && (category !== 'main-quest' || !item.edition));
  if (actual.length !== count || actual.some(item => !item.name || !item.at)) throw new Error(`Invalid ${category} catalog`);
}

await writeFile(new URL('../data/botw-world.json', import.meta.url), '[\n' + items.map(item => '  ' + JSON.stringify(item)).join(',\n') + '\n]\n');
console.log('Generated %d Breath of the Wild objectives', items.length);
