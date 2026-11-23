export type IslandText = readonly [pt: string, en: string];
export type IslandPoint = readonly [x: number, z: number];
export type IslandMark = 'unknown' | 'pending' | 'found' | 'done';
export type IslandRule = { key: string | number; values?: readonly string[] };

export interface IslandObjective {
  id: string;
  kind: 'shrine' | 'korok' | 'cave' | 'bubbul' | 'gear' | 'place' | 'secret';
  name: IslandText;
  hint: IslandText;
  at?: IslandPoint;
  rule?: IslandRule;
  found?: IslandRule;
  seeds?: number;
}

const shrine = (
  id: string, name: string, index: number, at: IslandPoint, hint: IslandText,
): IslandObjective => ({
  id, kind: 'shrine', name: [name, name], at, hint,
  rule: { key: 'DungeonState.Dungeon0' + index, values: ['Clear'] },
  found: { key: 'IsVisitLocation.Dungeon0' + index },
});

export const islandShrines: IslandObjective[] = [
  shrine('ukouh', 'Ukouh', 60, [275, 913], ['A oeste do Templo do Tempo, no alto da escadaria. Ensina Ultrahand.', 'West of the Temple of Time, above the stairs. Teaches Ultrahand.']),
  shrine('in-isa', 'In-isa', 62, [26, 1504], ['Na margem sudoeste, do outro lado do lago. Ensina Fuse.', 'On the southwest shore, across the lake. Teaches Fuse.']),
  shrine('gutanbac', 'Gutanbac', 61, [709, 1383], ['No alto da montanha nevada a leste. Ensina Ascend.', 'High on the snowy mountain to the east. Teaches Ascend.']),
  shrine('nachoyah', 'Nachoyah', 63, [389, 1661], ['Na parte alta da Sala do Despertar. Volte depois de receber Recall e liberar a viagem rápida.', 'Above the Room of Awakening. Return after learning Recall and unlocking fast travel.']),
];

const korok = (
  at: IslandPoint, hash: number, seeds: number, name: IslandText, hint?: IslandText,
): IslandObjective => ({
  id: 'korok-' + hash.toString(16), kind: 'korok', name, at, seeds,
  hint: hint ?? ['Procure o desafio Korok ao redor do ponto. Confira a altura no mapa do jogo se estiver em outro nível da ilha.', 'Look for the Korok puzzle around this spot. Check the elevation on the in-game map if you are on another level of the island.'],
  rule: seeds === 2 ? { key: hash, values: ['Clear'] } : { key: hash },
});

const koroks = [
  korok([521, 1324], 0x1e5826d2, 1, ['Trilha de flores', 'Flower trail'], ['Toque a primeira flor e siga as que surgirem até a última.', 'Touch the first flower and follow the ones that appear until the trail ends.']),
  korok([246, 822], 0x3bafd364, 1, ['Ruínas a oeste do templo', 'Ruins west of the temple']),
  korok([464, 881], 0xafb76fe6, 1, ['Ao sul do Templo do Tempo', 'South of the Temple of Time']),
  korok([113, 1081], 0xb33c6725, 1, ['Pedra na ilhota do lago', 'Rock on the lake islet'], ['Erga a pedra na pequena ilha.', 'Lift the rock on the little island.']),
  korok([29, 1255], 0x0fc7d184, 2, ['Amigo do outro lado do trilho', 'Friend across the rail'], ['Monte uma plataforma suspensa com gancho e atravesse o trilho com o Korok. O amigo espera a oeste.', 'Make a platform with a hook and take the Korok along the rail. Its friend is waiting to the west.']),
  korok([24, 1558], 0xe5203d31, 1, ['Sudoeste de In-isa', 'Southwest of In-isa']),
  korok([313, 1436], 0x95bfab1d, 1, ['Ilha alta do centro', 'High central island']),
  korok([424, 1504], 0x95ecfe71, 1, ['Ruínas perto da arena', 'Ruins near the arena']),
  korok([450, 1522], 0xf43f3b6a, 1, ['Sob a borda da arena', 'Below the edge of the arena']),
  korok([229, 1644], 0x1cf1e638, 1, ['Ao sul da caverna do lago', 'South of Pondside Cave']),
  korok([542, 1581], 0xf56c3378, 1, ['Entre a arena e a neve', 'Between the arena and the snow']),
  korok([631, 1531], 0x37828748, 1, ['Nas ruínas da encosta leste', 'Ruins on the eastern slope']),
  korok([622, 1658], 0x770548cd, 1, ['Dente-de-leão sobre a caverna', 'Dandelion above Pit Cave'], ['Golpeie a flor e agarre a semente antes que toque o chão.', 'Strike the flower and catch the seed before it lands.']),
  korok([475, 1699], 0x79ee2b64, 2, ['Amigo do outro lado do trilho sul', 'Friend across the southern rail'], ['Leve o Korok sobre o trilho até a fogueira no sul. Um carrinho com ventilador ajuda na subida.', 'Take the Korok along the rail to the campfire to the south. A fan-powered cart helps on the climb.']),
  korok([760, 1341], 0x3d4b6033, 1, ['Perto da árvore oca', 'Near the hollow tree']),
  korok([377, 1732], 0xf4b5b1d3, 1, ['Acima da Sala do Despertar', 'Above the Room of Awakening']),
  korok([343, 1756], 0x5c09b4c1, 1, ['Na borda sul da ilha alta', 'On the south edge of the high island']),
];

const caves = [
  { id: 'pondside', number: '0017', name: ['Caverna do Lago', 'Pondside Cave'], at: [170, 1634], frog: [170, 1634], hint: ['Siga a passagem depois de In-isa. O baú da túnica fica perto da outra saída.', 'Follow the passage after In-isa. The tunic chest is near the far exit.'] },
  { id: 'mining', number: '0019', name: ['Caverna da Mineração', 'Mining Cave'], at: [380, 1632], frog: [380, 1632], hint: ['Ilumine o túnel com sementes Brightbloom. Há um construto da forja perto da saída leste.', 'Light the tunnel with Brightbloom Seeds. The Forge Construct is near its east exit.'] },
  { id: 'pit', number: '0013', name: ['Caverna do Poço', 'Pit Cave'], at: [587, 1625], frog: [587, 1625], hint: ['A entrada baixa fica antes da subida nevada. Cozinhe pimentas perto da entrada para resistir ao frio.', 'The low entrance is before the snowy climb. Cook peppers near the entrance for cold resistance.'] },
  { id: 'bottomless', number: '0011', name: ['Caverna Sem Fundo', 'Bottomless Cave'], at: [712, 1449], frog: [712, 1449], hint: ['A entrada baixa fica na encosta nevada. Cuidado com os Like Likes ao subir pelo interior.', 'The lower entrance is on the snowy slope. Watch for Like Likes as you climb inside.'] },
] as const;

export const islandPlaces: IslandObjective[] = [
  { id: 'temple', kind: 'place', name: ['Templo do Tempo', 'Temple of Time'], at: [453, 800], hint: ['Suba até a porta ao norte da ilha. Volte com as três primeiras Luzes da Bênção.', 'Climb to the door in the north. Return with the first three Lights of Blessing.'], rule: { key: 'IsVisitLocation.AncientTimeShrine' } },
  { id: 'awakening', kind: 'place', name: ['Sala do Despertar', 'Room of Awakening'], at: [381, 1750], hint: ['Volte aqui por viagem rápida para chegar a Nachoyah.', 'Fast travel back here to reach Nachoyah.'] },
  { id: 'refinery', kind: 'place', name: ['Refinaria de cristais', 'Crystal Refinery'], at: [357, 1651], hint: ['Converse com o construto antes de Nachoyah. Cargas cristalizadas aumentam a capacidade de energia.', 'Talk to the construct before Nachoyah. Crystallized charges increase your energy capacity.'], rule: { key: 'IsAccessed_BatteryExchangeObj_FirstSkyIsland' } },
  { id: 'forge', kind: 'place', name: ['Construto da forja', 'Forge Construct'], at: [470, 1686], hint: ['Depois do túnel escuro, troque Zonaite por cargas e cargas cristalizadas.', 'After the dark tunnel, trade Zonaite for charges and crystallized charges.'], rule: { key: 'HaveTalked.Npc_Zonau_Golem_Servant_FirstIsland_21' } },
  { id: 'dispenser-south', kind: 'place', name: ['Dispensador do trilho sul', 'Southern rail dispenser'], at: [435, 1686], hint: ['Use cargas Zonai ou chifres de construto na máquina para receber cápsulas.', 'Feed Zonai charges or construct horns to the machine for capsules.'], rule: { key: 'RecycleBoxData.15205531352253250869.IsVisit' } },
  { id: 'dispenser-east', kind: 'place', name: ['Dispensador da montanha', 'Mountain dispenser'], at: [769, 1260], hint: ['Fica perto dos trilhos de lançamento das asas, ao norte de Gutanbac.', 'Find it near the Wing launch rails north of Gutanbac.'], rule: { key: 'RecycleBoxData.1239041309371073748.IsVisit' } },
];

export const islandExtras: IslandObjective[] = [
  ...koroks,
  ...caves.map((c): IslandObjective => ({
    id: c.id, kind: 'cave', name: c.name, at: c.at, hint: c.hint,
    rule: { key: 'IsVisitLocation.Cave_CentralHyrule_' + c.number },
  })),
  ...caves.map((c): IslandObjective => ({
    id: 'bubbul-' + c.id, kind: 'bubbul', at: c.frog,
    name: ['Gema Bubbul · ' + c.name[0], 'Bubbul Gem · ' + c.name[1]],
    hint: ['Procure o Bubbulfrog nas paredes e no teto da caverna. Derrube-o e recolha a gema.', 'Look for the Bubbulfrog on the cave walls and ceiling. Shoot it down and pick up the gem.'],
    rule: { key: 'IsGetCaveMasterMedal.Cave_CentralHyrule_' + c.number },
  })),
  { id: 'legwear', kind: 'gear', name: ['Calças arcaicas', 'Archaic Legwear'], at: [364, 1636], hint: ['Abra o baú na Sala do Despertar antes do primeiro salto da ilha.', 'Open the chest in the Room of Awakening before your first dive.'], rule: { key: 'IsGetAnyway.Armor_1043_Lower' } },
  { id: 'tunic', kind: 'gear', name: ['Túnica arcaica', 'Archaic Tunic'], at: [238, 1558], hint: ['O baú fica no interior da Caverna do Lago, perto da saída leste.', 'The chest is inside Pondside Cave, near the east exit.'], rule: { key: 'IsGetAnyway.Armor_1043_Upper' } },
  { id: 'greaves', kind: 'gear', name: ['Grevas arcaicas quentes', 'Archaic Warm Greaves'], at: [767, 1338], hint: ['A nordeste de Gutanbac, use Ascend sob a árvore oca para abrir o baú.', 'Northeast of Gutanbac, Ascend into the hollow tree to open the chest.'], rule: { key: 'IsGetAnyway.Armor_1044_Lower' } },
  ...islandPlaces,
  { id: 'flux', kind: 'secret', name: ['Construto de Fluxo I', 'Flux Construct I'], at: [492, 1516], hint: ['Na arena ao sul do centro, retire o bloco brilhante com Ultrahand e ataque quando ele cair.', 'In the arena south of the center, pull out the glowing block with Ultrahand and strike it when it falls.'], rule: { key: 0x2a2157fc } },
  { id: 'legend', kind: 'secret', name: ['Lenda da Grande Ilha Celeste', 'Legend of the Great Sky Island'], at: [454, 800], hint: ['Volte ao telhado do templo depois de obter a armadura Zora. O construto propõe acender três fogueiras sem tocar o chão. Use as cachoeiras e flechas com frutos de fogo.', 'Return to the temple roof after getting the Zora Armor. The construct asks you to light three fires without touching the ground. Use the waterfalls and Fire Fruit arrows.'], rule: { key: 'Step_FirstskyislandReturns', values: ['Complete'] } },
  { id: 'chest-ukouh', kind: 'secret', name: ['Âmbar em Ukouh', 'Amber in Ukouh'], at: [275, 913], hint: ['Antes do trilho, apoie as duas placas unidas de modo a formar uma rampa até o baú no alto.', 'Before the rail, lean the joined boards against the tall ledge to make a ramp to the chest.'] },
  { id: 'chest-in-isa', kind: 'secret', name: ['Flechas em In-isa', 'Arrows in In-isa'], at: [26, 1504], hint: ['Depois da primeira parede, quebre o pilar da esquerda com uma arma fundida a uma rocha.', 'After the first wall, break the left pillar with a boulder-fused weapon.'] },
  { id: 'chest-gutanbac', kind: 'secret', name: ['Machado de pedra em Gutanbac', 'Stone axe in Gutanbac'], at: [709, 1383], hint: ['Passe por dentro do pilar da esquerda com Ascend antes de seguir pelo pilar da direita.', 'Ascend up through the left pillar before continuing through the one on the right.'] },
  { id: 'chest-nachoyah', kind: 'secret', name: ['Flechas em Nachoyah', 'Arrows in Nachoyah'], at: [389, 1661], hint: ['Depois de subir a cachoeira com a jangada, use Recall na engrenagem e suba pelos dentes para alcançar o baú.', 'After riding the raft up the waterfall, Recall the gear and ride a tooth up to the chest.'] },
  { id: 'portable-pot', kind: 'secret', name: ['Baú da panela portátil', 'Portable pot chest'], at: [571, 1674], hint: ['Procure o baú sob o pavilhão na ilhota isolada a sudoeste da Caverna do Poço.', 'Look for the chest under the gazebo on the isolated islet southwest of Pit Cave.'] },
  { id: 'fan-chest', kind: 'secret', name: ['Baú de ventiladores', 'Fan chest'], at: [542, 1418], hint: ['O baú fica na ponta sudoeste da península a oeste do rio, perto da Caverna Sem Fundo.', 'The chest is at the southwest tip of the peninsula west of the river, near Bottomless Cave.'] },
  { id: 'wing', kind: 'secret', name: ['Voo de asa até o templo', 'Wing flight to the temple'], at: [760, 1236], hint: ['Ponha uma asa no trilho, suba nela e mantenha-se perto do centro. Mude de lado para virar.', 'Set a Wing on the rail, hop on, and stay near the center. Shift your weight to turn.'] },
];

export interface IslandStep {
  id: string;
  title: IslandText;
  steps: IslandText[];
  map: string;
  rule?: IslandRule;
}

export const islandGuide: IslandStep[] = [
  { id: 'opening', title: ['Do despertar até o templo', 'From awakening to the temple'], map: 'temple', rule: islandPlaces[0].rule, steps: [
    ['Siga a saída da Sala do Despertar, abra o baú das calças e mergulhe na lagoa quando o caminho acabar.', 'Leave the Room of Awakening, open the legwear chest, and dive into the pond at the end of the path.'],
    ['Converse com o construto para pegar o Purah Pad. Suba as escadas do templo ao norte e fale com Rauru para iniciar a busca pelos santuários.', 'Speak to the construct for the Purah Pad. Climb the temple stairs to the north and talk to Rauru to begin looking for shrines.'],
  ] },
  { id: 'ukouh', title: ['Ukouh e Ultrahand', 'Ukouh and Ultrahand'], map: 'ukouh', steps: [
    ['Suba pelas ruínas a oeste do templo. Use Ultrahand para apoiar uma placa sobre o primeiro vão. Una duas placas para atravessar o vão maior.', 'Climb the ruins west of the temple. Use Ultrahand to bridge the first gap with a board. Join two boards to cross the wider gap.'],
    ['Fixe um gancho em uma placa, pendure-o no trilho e suba na placa. Atravesse e receba a Luz da Bênção.', 'Attach a hook to a board, hang it on the rail, and stand on the board. Cross and claim the Light of Blessing.'],
  ] },
  { id: 'in-isa', title: ['In-isa e Fuse', 'In-isa and Fuse'], map: 'in-isa', steps: [
    ['Desça pela margem oeste. Una troncos e prenda uma vela para cruzar o lago até o santuário no sudoeste.', 'Head down the west shore. Join logs and attach a sail to cross the lake to the shrine in the southwest.'],
    ['Funda uma rocha à espada para quebrar a parede. Prenda um fruto de fogo à flecha para queimar as folhas sob o baú da chave. Abra a porta e derrote o construto.', 'Fuse a boulder to a sword to break the wall. Attach a Fire Fruit to an arrow and burn the leaves below the key chest. Unlock the door and defeat the construct.'],
  ] },
  { id: 'gutanbac', title: ['Gutanbac e Ascend', 'Gutanbac and Ascend'], map: 'gutanbac', steps: [
    ['Siga a rota sul, passando pela Caverna do Lago e pelos trilhos da mineração. Cozinhe pimentas antes de entrar na neve. Use a passagem da Caverna Sem Fundo e suba por uma parede seca ou por troncos.', 'Take the southern route past Pondside Cave and the mining rails. Cook peppers before entering the snow. Pass through Bottomless Cave and climb dry rock or use logs.'],
    ['Use Ascend sob as plataformas do santuário. Corte as cordas para baixar a ponte e passe pela plataforma móvel quando ela estiver acima de Link.', 'Ascend through the platforms inside the shrine. Cut the ropes to lower the bridge and use the moving platform when it passes over Link.'],
  ] },
  { id: 'recall', title: ['Volte ao templo e aprenda Recall', 'Return to the temple and learn Recall'], map: 'temple', rule: { key: 'IsGet.Obj_ReverseRecorder' }, steps: [
    ['Depois de Gutanbac, encontre as asas nos trilhos ao norte da montanha e voe de volta ao templo.', 'After Gutanbac, find the Wings on the rails north of the mountain and fly back to the temple.'],
    ['Abra a porta, toque o objeto no altar para receber Recall e use a habilidade nas engrenagens. Ao tentar abrir a porta seguinte, Rauru libera a viagem rápida e indica o último santuário.', 'Open the door, touch the object at the altar to learn Recall, and use the ability on the gears. Try the next door so Rauru unlocks fast travel and points you to the last shrine.'],
  ] },
  { id: 'nachoyah', title: ['Nachoyah e a quarta bênção', 'Nachoyah and the fourth blessing'], map: 'nachoyah', steps: [
    ['Viaje para a Sala do Despertar. Use Ascend no canto da sala e Recall na engrenagem para alcançar o túnel do santuário.', 'Warp to the Room of Awakening. Ascend at the corner of the room and use Recall on the gear to reach the shrine tunnel.'],
    ['Dentro do santuário, rebobine as jangadas para subir a correnteza. Use Recall em um dos ponteiros no instante em que se alinharem para manter o portão aberto.', 'Inside the shrine, rewind the rafts to ride upstream. Use Recall on one of the hands as they overlap to keep the gate open.'],
  ] },
  { id: 'descent', title: ['Desça para Hyrule', 'Descend to Hyrule'], map: 'temple', rule: { key: 'Step_GOToTheCastleOfHyrule', values: ['Ready', 'MeetPurah', 'Complete'] }, steps: [
    ['Entregue as quatro Luzes da Bênção à estátua e receba um coração. Abra a porta atrás dela e siga a ponte até a cena final.', 'Trade the four Lights of Blessing at the statue for a Heart Container. Open the door behind it and follow the bridge to the final scene.'],
    ['Salte da ponta da ilha em direção à água da superfície. Ao aterrissar, siga o objetivo da próxima missão até o posto de observação.', 'Dive from the edge of the island toward the water on the surface. Once you land, follow the next quest marker toward Lookout Landing.'],
  ] },
];

export const islandObjectives = [...islandShrines, ...islandExtras];

export const islandBounds = { west: -185, east: 900, north: 720, south: 1870 };

export function islandMapPoint([x, z]: IslandPoint): IslandPoint {
  return [
    (x - islandBounds.west) / (islandBounds.east - islandBounds.west) * 100,
    (z - islandBounds.north) / (islandBounds.south - islandBounds.north) * 100,
  ];
}
