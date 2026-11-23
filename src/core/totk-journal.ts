import { questCategories, secretCategories, worldItems, type WorldCategory, type WorldItem, type WorldProgress } from './totk-world.js';
import type { IslandText } from './totk-island.js';

export const bossCategories = new Set<WorldCategory>(['hinox', 'talus', 'molduga', 'flux', 'frox', 'gleeok', 'rematch', 'lynel', 'gloom']);
export const worldSections = [
  { id: 'exploration', label: ['Exploração', 'Exploration'], categories: ['shrine', 'dlc-shrine', 'tower', 'temple', 'lightroot', 'cave', 'well', 'chasm', 'location', 'stable', 'shop', 'lab', 'dispenser', 'bargainer', 'fairy', 'blossom'] },
  { id: 'collectibles', label: ['Colecionáveis', 'Collectibles'], categories: ['korok', 'tear', 'bubbul', 'schema', 'yiga', 'sage-will', 'old-map', 'addison', 'tablet', 'chest'] },
  { id: 'missions', label: ['Missões', 'Quests'], categories: [...questCategories, 'memory', 'voice'] },
  { id: 'combat', label: ['Combate', 'Combat'], categories: [...bossCategories] },
  { id: 'inventory', label: ['Inventário', 'Inventory'], categories: ['armor', 'recipe', 'compendium'] },
  { id: 'activities', label: ['Atividades', 'Activities'], categories: ['minigame'] },
] satisfies { id: string; label: IslandText; categories: WorldCategory[] }[];

export function journalPages(items: WorldItem[]) {
  return {
    checklist: items,
    threads: items.filter(item => questCategories.has(item.category) || ['tear', 'tablet', 'memory', 'voice'].includes(item.category)),
    hall: items.filter(item => bossCategories.has(item.category)),
    minigames: items.filter(item => item.category === 'minigame'),
    secrets: items.filter(item => item.featured || item.category === 'blossom' || secretCategories.has(item.category) && !bossCategories.has(item.category))
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured)),
  };
}
export const worldPages = journalPages(worldItems);
export type WorldListPage = keyof typeof worldPages;

export interface TotkHistoryEntry {
  at: number;
  counts: Partial<Record<WorldCategory, number>>;
}

export function worldTotals(marks: WorldProgress['marks'], items = worldItems): Partial<Record<WorldCategory, number>> {
  const counts: Partial<Record<WorldCategory, number>> = {};
  for (const item of items) {
    if (item.key !== undefined && marks[item.id] === 'done') counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

export function nearbyObjectives(progress: WorldProgress, items = worldItems) {
  const { player, marks } = progress;
  if (!player) return [];
  const [x, z] = player.at;
  const nearby = items.flatMap(item => {
    if (!item.at || item.layer !== player.layer || !['shrine', 'dlc-shrine', 'lightroot', 'tower', 'quest', 'cave', 'well', 'korok', 'memory'].includes(item.category)) return [];
    const mark = marks[item.id];
    if (mark !== 'pending' && mark !== 'found') return [];
    return [{ item, distance: Math.hypot(item.at[0] - x, item.at[1] - z) }];
  }).sort((a, b) => a.distance - b.distance);
  return nearby.slice(0, 8);
}

const hints: Partial<Record<WorldCategory, IslandText>> = {
  shrine: ['Examine a entrada e termine a prova para receber a Luz da Bênção. O diário distingue descoberta de conclusão.', 'Examine the entrance and clear the trial for a Light of Blessing. The journal distinguishes discovery from completion.'],
  tower: ['Entre na torre e ative o terminal para revelar o mapa da região. Algumas torres exigem liberar a entrada ou consertar o mecanismo.', 'Enter the tower and activate its terminal to reveal the region. Some towers require clearing the entrance or repairing the mechanism.'],
  lightroot: ['Procure abaixo de um santuário da superfície e toque a raiz para revelar esta parte das Profundezas.', 'Look beneath a surface shrine and touch the root to reveal this part of the Depths.'],
  korok: ['Procure um quebra-cabeça nas imediações. Se vir um Korok com mochila, leve-o até o amigo indicado pela fumaça para ganhar duas sementes.', 'Look for a puzzle nearby. If you see a Korok with a backpack, take it to the friend marked by smoke to earn two seeds.'],
  cave: ['Chegue até esta entrada para registrá-la. Cavernas com várias entradas aparecem mais de uma vez.', 'Reach this entrance to log it. Caves with multiple entrances appear more than once.'],
  well: ['Desça até o interior do poço para registrá-lo. Fera em Lookout Landing inicia a missão de procurar os poços.', 'Descend into the well to register it. Fera at Lookout Landing starts the quest to find the wells.'],
  chasm: ['Use este abismo para entrar nas Profundezas. Abra o paraglider na descida e leve sementes luminosas para iluminar o pouso.', 'Use this chasm to reach the Depths. Open the paraglider on the way down and bring Brightbloom Seeds to light your landing.'],
  tear: ['No geoglifo, encontre a única marca da lágrima preenchida e examine a poça. Depois das onze primeiras memórias, a última lágrima aparece na Península Espiral.', 'Find the filled tear shape within the geoglyph and examine the pool. The final tear appears on the spiral peninsula after the first eleven.'],
  bubbul: ['Entre na caverna indicada e procure o Bubbulfrog nas paredes e no teto. Acerte-o com uma flecha e recolha a gema.', 'Enter the indicated cave, look for the Bubbulfrog on the walls or ceiling, shoot it with an arrow, and pick up the gem.'],
  dispenser: ['Coloque cargas Zonai ou chifres elegíveis no recipiente. Os aparelhos recebidos dependem do dispensador.', 'Put Zonai Charges or eligible horns into the dish. The devices you receive depend on the dispenser.'],
  bargainer: ['Fale com a estátua para registrá-la e trocar poes pelas recompensas disponíveis.', 'Talk to the statue to record it and trade poes for available rewards.'],
  tablet: ['Fotografe o texto do tablete e leve a imagem a Wortsworth. O marcador acompanha a visita; a missão acompanha os registros entregues.', 'Photograph the tablet text and bring the picture to Wortsworth. The marker follows the visit; the quest follows your submissions.'],
  addison: ['Sustente a placa com materiais próximos usando Ultramão. Peça a Addison para soltá-la e converse novamente quando ela ficar em pé.', 'Brace the sign using nearby materials and Ultrahand. Ask Addison to let go, then talk to him once the sign stands.'],
  'sage-will': ['Abra o baú indicado no céu. Leve quatro Vontades dos Sábios a uma Estátua da Deusa para fortalecer um dos sábios.', 'Open the indicated chest in the sky. Take four Sage’s Wills to a Goddess Statue to strengthen a sage.'],
  'old-map': ['Abra o baú no céu para revelar a posição de outro baú nas Profundezas. O nome indica o tesouro subterrâneo associado.', 'Open the chest in the sky to reveal a second chest in the Depths. The name indicates the associated underground treasure.'],
  fairy: ['Ajude a trupe de músicos a chegar à fonte. Depois da serenata, a fada oferece melhorias de vestuário em troca dos materiais pedidos.', 'Help the musicians get to the fountain. After the serenade, the fairy upgrades armor in exchange for the requested materials.'],
  schema: ['Procure o construto da mina para receber um projeto utilizável com Autobuild.', 'Find the mine’s construct to obtain a blueprint you can use with Autobuild.'],
  yiga: ['Derrote o Yiga que guarda o esconderijo para liberar o baú com o projeto.', 'Defeat the Yiga guarding the hideout to unlock the chest containing the schematic.'],
  hinox: ['Mire no olho para derrubá-lo. Se for um Stalnox, finalize o olho quando ele se soltar.', 'Aim for the eye to knock it down. For a Stalnox, finish the eye when it falls out.'],
  talus: ['Ataque o depósito de minério no corpo. Use Ascend por baixo ou suba quando o inimigo estiver atordoado.', 'Attack the ore deposit on its body. Use Ascend from below or climb while it is stunned.'],
  molduga: ['Faça barulho na areia a partir de um lugar seguro. Quando ele saltar, use uma flecha com flor-bomba para expô-lo.', 'Make noise on the sand from safety. When it jumps, use a Bomb Flower arrow to expose it.'],
  flux: ['Use Ultramão para destacar o bloco brilhante. Ataque o núcleo quando a construção se desmontar.', 'Use Ultrahand to pull out the glowing block. Strike the core when the construct falls apart.'],
  frox: ['Atordoe o Frox pelo olho e quebre os depósitos de minério nas costas.', 'Stun the Frox by hitting its eye, then break the ore deposits on its back.'],
  gleeok: ['Acerte os três olhos para derrubá-lo. Olhos de Keese fundidos a flechas ajudam a atingir as cabeças.', 'Hit all three eyes to bring it down. Keese Eyeballs fused to arrows help hit the heads.'],
  rematch: ['As arenas das Profundezas permitem reenfrentar chefes dos templos depois de vencê-los na história.', 'Depths arenas let you rematch temple bosses after defeating them in the story.'],
  lynel: ['Desvie para contra-atacar ou atordoe com um tiro na cabeça para montar. O ponto registra o encontro, que pode reaparecer.', 'Dodge to counterattack or stun it with a headshot to mount. This marks an encounter that can respawn.'],
  gloom: ['Suba para um ponto alto e use ataques que atinjam várias mãos. Em alguns encontros, Phantom Ganon aparece ao derrotá-las.', 'Climb above the hands and use attacks that hit several at once. Some encounters spawn Phantom Ganon after the hands fall.'],
  blossom: ['Deixe uma fruta no recipiente sob a árvore. As luzes de Satori indicam temporariamente as entradas de cavernas da região.', 'Leave fruit in the bowl beneath the tree. Satori’s lights temporarily reveal nearby cave entrances.'],
  voice: ['Requer a edição Nintendo Switch 2 e o recurso ZELDA NOTES no aplicativo Nintendo Switch. Ouça a memória no local e marque-a no diário.', 'Requires the Nintendo Switch 2 Edition and ZELDA NOTES in the Nintendo Switch App. Listen at the location and check it off in the journal.'],
  temple: ['Siga a missão regional correspondente para liberar o acesso e os mecanismos do templo.', 'Follow the corresponding regional quest to unlock the temple and its mechanisms.'],
  armor: ['A entrada é concluída quando a peça é obtida. Procure pelo nome na categoria Baús para localizar uma recompensa conhecida.', 'The entry clears when the piece is obtained. Search Treasure chests for the name to find a known reward.'],
  recipe: ['Cozinhe o prato em uma panela para registrá-lo no caderno de receitas.', 'Cook the dish in a pot to register it in the recipe book.'],
  compendium: ['Fotografe o assunto com a Câmera ou compre a imagem no laboratório de Hateno, depois de liberar a opção.', 'Photograph the subject or buy its picture at Hateno Ancient Tech Lab after unlocking the option.'],
};

export const objectiveHint = (item: WorldItem) => item.hint ?? hints[item.category];
