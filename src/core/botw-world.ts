import catalog from '../../data/botw-world.json';
import type { IslandText } from './totk-island.js';
import { objectiveHint } from './totk-journal.js';
import type { WorldCategory, WorldItem } from './totk-world.js';

export const botwItems = catalog as WorldItem[];
export const botwById = new Map(botwItems.map(item => [item.id, item]));
export const plateauName: IslandText = ['Grande Planalto', 'Great Plateau'];
export const botwRegions = botwItems.filter(item => item.category === 'tower')
  .map(item => ({ id: item.id, name: item.name.replace(/ Tower$/, '') }))
  .sort((a, b) => a.name.localeCompare(b.name));

const shrineHint: IslandText = ['Ative o terminal da entrada e conclua a prova. O diário separa o desbloqueio do teleporte da conclusão.', 'Activate the entrance terminal and clear the trial. The journal tracks warp access and completion separately.'];
const hints: Partial<Record<WorldCategory, IslandText>> = {
  shrine: shrineHint,
  'dlc-shrine': shrineHint,
  tower: ['Escale a torre e ative o terminal Sheikah no topo para revelar a região.', 'Climb the tower and activate the Sheikah terminal at the top to reveal its region.'],
  korok: ['Procure o quebra-cabeça indicado junto ao marcador para ganhar uma Semente Korok.', 'Find the puzzle indicated at the pin to earn a Korok Seed.'],
  fairy: ['Pague o valor solicitado para abrir a fonte. Leve os materiais pedidos para melhorar as peças de armadura.', 'Pay the requested rupees to open the fountain. Bring the listed materials to upgrade armor.'],
  memory: ['Após falar com Impa sobre as fotos da Tábua Sheikah, compare a paisagem com a foto e examine o círculo brilhante no chão.', 'After speaking with Impa about the Sheikah Slate photos, match the scenery and examine the glowing spot on the ground.'],
  talus: ['Acerte o depósito de minério. Use uma bomba remota para atordoá-lo ou escale o corpo quando ele se abaixar.', 'Strike the ore deposit. Use a Remote Bomb to stagger it or climb its body when it lowers itself.'],
  molduga: ['De um ponto elevado, jogue uma bomba na areia. Detone quando a Molduga engolir a bomba e ataque enquanto ela estiver atordoada.', 'Throw a bomb onto the sand from a raised spot. Detonate it when the Molduga swallows it, then attack while it is stunned.'],
  temple: ['Siga a missão da Besta Divina, obtenha o mapa interno e ative os cinco terminais antes de enfrentar o Flagelo.', 'Follow the Divine Beast quest, obtain its interior map, and activate all five terminals before fighting the Blight.'],
};

export const botwHint = (item: WorldItem) => item.hint ?? hints[item.category] ?? objectiveHint(item);
