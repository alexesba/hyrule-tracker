import type { IslandText } from './totk-island.js';
import { worldById, worldItems } from './totk-world.js';

export interface WorldChapter {
  quest: string;
  title: IslandText;
  place?: string;
  steps: IslandText[];
  objectives?: string[][];
}

export interface WorldRoute {
  id: string;
  title: IslandText;
  chapters: WorldChapter[];
}

export const worldGuide: WorldRoute[] = [
  { id: 'opening', title: ['Da ilha até Hyrule', 'From the island to Hyrule'], chapters: [
    { quest: 'LookingForLightSpot', title: ['A porta fechada', 'The Closed Door'], place: 'Temple of Time', steps: [
      ['Passe pelos quatro santuários da Grande Ilha Celeste. Volte ao Templo do Tempo com a quarta Luz da Bênção e troque as luzes por um coração para abrir a porta final.', 'Clear the four Great Sky Island shrines. Return to the Temple of Time with the fourth Light of Blessing and trade the lights for a Heart Container to open the final door.'],
      ['Use a rota detalhada da ilha para encontrar cada santuário, as cavernas e os baús opcionais.', 'Use the dedicated island route to find each shrine, the caves, and optional chests.'],
    ] },
    { quest: 'GOToTheCastleOfHyrule', title: ['Rumo ao Reino de Hyrule', 'To the Kingdom of Hyrule'], place: 'Lookout Landing', steps: [
      ['Mergulhe na água na superfície, siga o marcador para o posto de observação e fale com Purah.', 'Dive into the water on the Surface, follow the marker to Lookout Landing, and speak to Purah.'],
    ] },
    { quest: 'HyruleCastleIncident', title: ['Crise no Castelo de Hyrule', 'Crisis at Hyrule Castle'], place: 'Lookout Landing', steps: [
      ['Procure Hoz no portão do castelo, relate o que viu a Purah e ative a torre do posto. Pegue o parapente antes de explorar longe.', 'Find Hoz at the castle gate, report what you saw to Purah, and activate the tower. Collect the paraglider before heading far out.'],
      ['Depois dos quatro fenômenos regionais, volte a Purah e use a torre para alcançar o castelo. Siga as aparições de Zelda até o salão e vença os inimigos que surgirem.', 'After the four regional phenomena, report to Purah and use the tower to reach the castle. Follow Zelda’s appearances to the sanctum and defeat the enemies that appear.'],
    ] },
  ] },
  { id: 'regions', title: ['Fenômenos regionais', 'Regional Phenomena'], chapters: [
    { quest: 'SurveyOfFourVillages', title: ['Os quatro povos', 'The four peoples'], place: 'Lookout Landing', steps: [
      ['Fale com Purah para abrir os quatro objetivos. Você pode resolver as regiões em qualquer ordem. O caminho por Rito é uma boa primeira viagem com proteção contra o frio.', 'Speak to Purah to open the four objectives. Clear the regions in any order. Rito is a useful first trip if you bring cold protection.'],
    ] },
    { quest: 'SageOfWind', title: ['Rito e o Templo do Vento', 'Rito Village and the Wind Temple'], place: 'Rito Village', steps: [
      ['Fale com Teba e Tulin em Rito. Suba para o abrigo das montanhas de Hebra, localize Tulin e ajude-o a recuperar o arco.', 'Speak to Teba and Tulin in Rito Village. Head to the Hebra mountain lodge, find Tulin, and help him recover his bow.'],
      ['Suba pelas ilhas, use as rajadas de Tulin para atravessar os vãos e salte nas velas dos navios até o centro da tempestade.', 'Climb the islands, use Tulin’s gusts to cross gaps and bounce on ship sails to reach the center of the storm.'],
      ['Acione o terminal do navio para ver as cinco travas. Nas engrenagens, use Recall para atravessar a roda e acople uma estalactite de gelo ao mecanismo quebrado.', 'Use the ship’s terminal to reveal the five locks. At the gears, use Recall to ride the wheel and attach an icicle to repair the broken mechanism.'],
      ['Use a corrente de ar central para alcançar as entradas superiores. Acione as cinco turbinas com Tulin e volte ao terminal.', 'Use the central updraft to reach the upper entrances. Activate all five turbines with Tulin and return to the terminal.'],
      ['No combate aéreo, espere Colgera expor as placas de gelo e atravesse-as mergulhando ou dispare contra elas. Use as rajadas para escapar dos tornados na segunda fase.', 'In the aerial fight, dive or shoot through Colgera’s exposed ice plates. Use gusts to escape the tornadoes in the second phase.'],
    ] },
    { quest: 'SageOfFire', title: ['Goron e o Templo do Fogo', 'Goron City and the Fire Temple'], place: 'Goron City', steps: [
      ['Fale com Bludo e siga Yunobo até a sede da empresa. Use proteção contra fogo para a subida da Montanha da Morte e depois mergulhe pelo abismo.', 'Speak to Bludo and follow Yunobo to the company headquarters. Bring flame protection for Death Mountain and dive down its chasm afterward.'],
      ['Ative o terminal do templo e consulte o andar de cada trava. Alterne os trilhos com os interruptores e use Yunobo para quebrar as rochas que travam as rotas.', 'Activate the temple terminal and check which floor each lock is on. Use the switches to change tracks and have Yunobo break rocks blocking the routes.'],
      ['Use água dos hidrantes para criar placas sobre a lava. Junte placas ou aproveite rampas para alinhar o ataque de Yunobo aos cinco gongos.', 'Use water from hydrants to make slabs on the lava. Join the slabs or use ramps to line up Yunobo’s attack with the five gongs.'],
      ['Volte ao terminal. Na luta contra Marbled Gohma, quebre as pernas com Yunobo para expor o olho. Quando o chefe subir, lance Yunobo pela parede curva.', 'Return to the terminal. Break Marbled Gohma’s legs with Yunobo to expose its eye. When it climbs, launch Yunobo up the curved wall.'],
    ] },
    { quest: 'CleanStatue', title: ['A estátua coberta de lodo', 'The Sludge-Covered Statue'], place: 'Zora’s Domain', steps: [
      ['Jogue um fruto d’água na estátua da praça. Fale com Yona para saber onde encontrar Sidon.', 'Throw a Splash Fruit at the statue in the plaza. Speak with Yona to find out where Sidon went.'],
    ] },
    { quest: 'DividedSlate', title: ['A inscrição quebrada', 'The Broken Slate'], place: 'Toto Lake', steps: [
      ['Encontre Jiahto no Lago Toto. Limpe o lodo da peça que falta e encaixe-a na parede com Ultrahand.', 'Find Jiahto at Toto Lake. Wash the sludge off the missing slab and fit it into the wall with Ultrahand.'],
    ] },
    { quest: 'RepairArmor', title: ['Restaure a armadura Zora', 'Restoring the Zora Armor'], place: 'Zora’s Domain', steps: [
      ['Pegue um aruanã antigo no reservatório perto de Mipha Court e leve-o a Yona. A armadura permite subir as cachoeiras do caminho para o céu.', 'Collect an Ancient Arowana from the pool near Mipha Court and give it to Yona. The armor lets you swim up the waterfalls on the way to the sky.'],
    ] },
    { quest: 'WaterBridgePlace', title: ['Pistas para o céu', 'Clues to the Sky'], place: 'Floating Scales Island', steps: [
      ['Encontre o rei Dorephan no santuário atrás da cachoeira para receber suas escamas. Da ilha em forma de peixe, encontre a perspectiva que alinha as pedras em forma de gota e atire uma escama através dela.', 'Find King Dorephan in the sanctuary behind the waterfall for his scales. On the fish-shaped island, line up the floating stones into a droplet and shoot a scale through it.'],
    ] },
    { quest: 'SageOfZora', title: ['O povo Zora e o Templo da Água', 'Zora’s Domain and the Water Temple'], place: 'Zora’s Domain', steps: [
      ['Volte a Sidon e investigue a passagem que se abre no reservatório. Depois, use a armadura para subir a cachoeira até as ilhas da Fonte.', 'Return to Sidon and investigate the passage that opens in the reservoir. Then use the armor to swim up to the Wellspring Islands.'],
      ['No templo, use a gravidade baixa para saltar entre as plataformas. Limpe as máquinas de bolhas cobertas de lodo com água e use as bolhas para transportar Link ou as esferas.', 'At the temple, use low gravity to jump between platforms. Wash the sludge off the bubble machines and use the bubbles to move Link or the spheres.'],
      ['Nas salas de quebra-cabeça, mantenha comportas abertas com plataformas flutuantes e use água para fechar circuitos quando necessário. Acerte as quatro rodas das torneiras com a onda de Sidon.', 'In puzzle rooms, use floating platforms to hold sluices open and water to bridge circuits where needed. Hit all four faucet wheels with Sidon’s wave.'],
      ['Use água para limpar a arena e tirar Mucktorok da forma de tubarão. Quando ele fugir pelos charcos, limpe um caminho para alcançá-lo.', 'Use water to clear the arena and knock Mucktorok out of shark form. When it flees through pools, clear yourself a path to reach it.'],
    ] },
    { quest: 'SageOfGerudo', title: ['Gerudo e o Templo do Raio', 'Gerudo Town and the Lightning Temple'], place: 'Gerudo Town', steps: [
      ['Fale com Buliara no abrigo e encontre Riju nas Ruínas do Norte para treinar. Proteja o bazar e a cidade dos Gibdos, mirando nos ninhos quando se abrirem.', 'Speak with Buliara in the shelter and find Riju at the North Gerudo Ruins to practice. Defend the bazaar and town from Gibdos, targeting the nests when they open.'],
      ['Alinhe os feixes nos três pilares do deserto e leve Riju ao templo. Abra a entrada com o raio e prossiga até o terminal central.', 'Align the beams at the three desert pillars and take Riju to the temple. Open the entrance with lightning and proceed to the central terminal.'],
      ['Direcione a luz com espelhos para os sensores. Use as correntes de ar do salão para acessar outros andares e deixe Riju perto de cada bateria antes de disparar a flecha.', 'Use mirrors to direct light at the sensors. Ride the main hall’s updrafts to reach other floors and bring Riju close to each battery before firing the arrow.'],
      ['Ative as quatro baterias e volte ao elevador. Na luta, use dano elemental para enfraquecer a Rainha Gibdo; quando os ninhos surgirem, derrube-os para abrir áreas de luz.', 'Activate all four batteries and return to the lift. Use elemental damage to weaken Queen Gibdo. When the nests appear, destroy them to open areas of light.'],
    ] },
  ] },
  { id: 'exploration', title: ['Profundezas e memórias', 'Depths and memories'], chapters: [
    { quest: 'GetCamera', title: ['Trabalho de câmera nas profundezas', 'Camera Work in the Depths'], place: 'Hyrule Field Chasm', steps: [
      ['Fale com Josha e Robbie no posto. Desça pelo abismo do Campo de Hyrule, acenda as raízes no caminho e encontre Robbie junto à segunda raiz.', 'Speak with Josha and Robbie at Lookout Landing. Descend the Hyrule Field Chasm, light the roots on the route, and find Robbie by the second Lightroot.'],
      ['Fotografe a estátua e leve a imagem a Josha. A câmera permite começar o Compêndio de Hyrule.', 'Photograph the statue and take the image back to Josha. The Camera lets you begin the Hyrule Compendium.'],
    ] },
    { quest: 'DeepHoleSurvey2', title: ['Um mistério nas profundezas', 'A Mystery in the Depths'], place: 'Great Abandoned Central Mine', steps: [
      ['Depois de resolver um fenômeno regional, retome a investigação de Josha. Siga a direção das estátuas até a mina central abandonada para aprender Autobuild.', 'After solving a regional phenomenon, resume Josha’s investigation. Follow the direction of the statues to the Great Abandoned Central Mine to learn Autobuild.'],
      ['Derrote Kohga, volte a Josha e use Autobuild para consertar o balão de Robbie. A missão de Kohga segue pelas outras minas.', 'Defeat Kohga, report to Josha, and use Autobuild to repair Robbie’s balloon. Kohga’s side adventure continues at other mines.'],
    ] },
    { quest: 'GroundPaintingAir01', title: ['Impa e os geoglifos', 'Impa and the Geoglyphs'], place: 'New Serenne Stable', steps: [
      ['Encontre Impa perto de New Serenne Stable e ajude a montar seu balão. Do alto, procure a gota preenchida no geoglifo e examine a poça no chão.', 'Find Impa near New Serenne Stable and help rebuild her balloon. From above, look for the filled teardrop in the geoglyph and examine the pool on the ground.'],
    ] },
    { quest: 'MemoryOfTheDragon', title: ['As Lágrimas do Dragão', 'The Dragon’s Tears'], place: 'Forgotten Temple', steps: [
      ['Visite Impa no Templo Esquecido para ver o mapa dos geoglifos. Use a categoria Lágrimas no mapa da superfície para localizar os desenhos e examine a gota preenchida de cada um.', 'Visit Impa at the Forgotten Temple to see the geoglyph map. Use the Tears category on the Surface map to locate the designs and examine the filled tear in each.'],
      ['Depois das onze memórias, procure a última lágrima na península em espiral de Akkala.', 'After the first eleven memories, look for the final tear on Akkala’s spiral peninsula.'],
    ] },
  ] },
  { id: 'fifth-sage', title: ['O quinto sábio e a Espada Mestra', 'The Fifth Sage and the Master Sword'], chapters: [
    { quest: 'ClueTotheSixthSage', title: ['Encontre o quinto sábio', 'Find the Fifth Sage'], place: 'Kakariko Village', steps: [
      ['Depois do retorno ao castelo, fale com Purah. Investigue as ruínas que antes estavam interditadas em Kakariko. A rota por Faron leva à ilha da cabeça de dragão e ao construto do quinto sábio.', 'After returning from the castle, speak to Purah. Investigate the previously restricted ruins in Kakariko. The Faron route leads to Dragonhead Island and the Fifth Sage’s construct.'],
    ] },
    { quest: 'GotoFironeZonauRemains', title: ['Segredo das Ruínas do Anel', 'Secret of the Ring Ruins'], place: 'Kakariko Village', steps: [
      ['Use Ascend para entrar nas ruínas de Kakariko, fotografe a inscrição e mostre a Tauro e Paya. Encontre Tauro no Lago Dracozu, em Faron.', 'Ascend into the Kakariko ruins, photograph the inscription, and show it to Tauro and Paya. Meet Tauro at Dracozu Lake in Faron.'],
      ['Encontre as três peças da roupa carregada nos templos ao longo do rio. Vista-as e ofereça uma carga Zonai no altar ao fim da rota para dissipar a tempestade.', 'Find the three pieces of the Charged set in the shrines along the river. Wear them and offer a Zonai charge at the final altar to clear the storm.'],
    ] },
    { quest: 'SageOfSoul', title: ['Mineru e o Templo do Espírito', 'Mineru and the Spirit Temple'], place: 'Construct Factory', steps: [
      ['Atravesse as ilhas da tempestade até Dragonhead Island. A porta exige dez corações. Leve a máscara pelo feixe até o elevador e desça para a fábrica.', 'Cross the storm islands to Dragonhead Island. The door requires ten hearts. Follow the mask’s beam to the elevator and descend to the factory.'],
      ['Nos quatro depósitos, mova as caixas das partes pelo quebra-cabeça de cada sala. Leve-as à estrutura central e encaixe os braços e pernas nos espaços correspondentes.', 'In each of the four depots, get the part’s crate through its room puzzle. Carry it to the central frame and fit the arms and legs into their slots.'],
      ['Monte em Mineru, equipe aparelhos nos braços e siga pelas Profundezas até o Templo do Espírito.', 'Ride Mineru, equip devices on its arms and follow the Depths route to the Spirit Temple.'],
      ['Na arena, bloqueie e contra-ataque para empurrar o construto inimigo contra a barreira. Use o canhão para interromper ataques e abrir espaço.', 'In the arena, block and counter to knock the enemy construct into the barrier. Use the cannon to interrupt attacks and open gaps.'],
    ] },
    { quest: 'MasterSwordClues', title: ['O rastro da Espada Mestra', 'Trail of the Master Sword'], place: 'Korok Forest', steps: [
      ['Siga a pista de Mineru para a Floresta Korok. Entre por baixo pela raiz nas profundezas e use Ascend sob a floresta. Desça pelo interior da Grande Árvore Deku e remova o miasma para poder falar com ela.', 'Follow Mineru’s lead to Korok Forest. Approach underneath in the Depths and Ascend under the forest. Descend inside the Great Deku Tree and remove the gloom so you can speak to it.'],
    ] },
    { quest: 'GetMasterSword', title: ['Recupere a Espada Mestra', 'Recovering the Hero’s Sword'], place: 'Korok Forest', steps: [
      ['Use o marcador que segue o Dragão da Luz ou conclua as Lágrimas do Dragão para localizá-lo. Chegue à cabeça pelo céu. São necessárias duas rodas completas de vigor permanente para tirar a espada.', 'Use the moving Light Dragon marker or finish the Dragon’s Tears to find it. Reach its head from the sky. You need two full permanent stamina wheels to pull the sword.'],
    ] },
  ] },
  { id: 'ending', title: ['O fim da jornada', 'The end of the journey'], chapters: [
    { quest: 'DefeatGanondorf', title: ['Destrua Ganondorf', 'Destroy Ganondorf'], place: 'Hyrule Castle Chasm', steps: [
      ['Com os sábios reunidos, leve comida que recupere os corações afetados pelo miasma e desça pelo abismo do castelo. Siga pela passagem mais profunda até o exército.', 'With the sages assembled, bring food that restores gloom-damaged hearts and descend the castle chasm. Follow the passage to the depths of the castle and face the army.'],
      ['Contra Ganondorf, espere o fim das esquivas antes de atacar e preserve os itens de recuperação para as fases seguintes. Na última parte, use o dragão aliado para voltar à posição de mergulho e atingir os pontos vulneráveis.', 'Against Ganondorf, wait out his dodges and keep recovery food for the later phases. In the final sequence, use your dragon ally to return to diving height and strike the weak points.'],
    ] },
    { quest: 'MainChallenge', title: ['Encontre a princesa Zelda', 'Find Princess Zelda'], place: 'Hyrule Castle Chasm', steps: [
      ['Essa missão acompanha a história inteira e termina na sequência final. Depois dos créditos, reabra o save com estrela para consultar o progresso de mapa no jogo e retomar as atividades pendentes.', 'This quest follows the entire story and ends in the final sequence. After the credits, reopen the starred save to see the game’s map percentage and resume optional activities.'],
    ] },
  ] },
];

export const worldSideRoutes: WorldRoute[] = [
  { id: 'optional', title: ['Rotas opcionais', 'Optional routes'], chapters: [
    { quest: 'MinusYiga', title: ['Kohga e as minas abandonadas', 'Kohga and the abandoned mines'], place: 'Great Abandoned Central Mine', steps: [
      ['Siga Kohga pelas minas Central, Gerudo, Lanayru e Hebra. Acenda uma raiz perto de cada mina para conservar um ponto de retorno.', 'Follow Kohga through the Central, Gerudo, Lanayru and Hebra mines. Activate a nearby Lightroot at each mine so you can return.'],
      ['Para chegar à mina de Hebra, procure o abismo escondido na encosta sob Rito Village. Use as pedras de esquema e os projetos Yiga para ampliar as opções de Autobuild.', 'To reach the Hebra mine, find the hidden chasm in the cliff below Rito Village. Collect Schema Stones and Yiga Schematics to expand your Autobuild options.'],
    ] },
    { quest: 'NewsPaper_Mitsuba', title: ['Avistamentos da princesa', 'Potential Princess Sightings'], place: 'Rito Village', steps: [
      ['Converse com Traysi na gazeta no caminho para Rito. Procure Penn nos estábulos e resolva as notícias locais. A série rende as peças da armadura de sapo.', 'Talk to Traysi at the gazette on the way to Rito. Meet Penn at the stables and investigate the local stories. This series rewards the pieces of the Froggy set.'],
    ] },
    { quest: 'Tribune16', title: ['A primeira Grande Fada', 'The first Great Fairy'], place: 'Woodland Stable', steps: [
      ['Depois de entrar na gazeta, encontre a banda no Estábulo Woodland. Conserte o carro, prenda-o ao arreio de um cavalo e leve os músicos até Tera.', 'After joining the gazette, find the band at Woodland Stable. Repair the wagon, attach it to a horse harness, and take the musicians to Tera.'],
      ['As outras fadas pedem músicos diferentes. Procure Pyper para Kaysa, Beetz para Cotera e Eustus para Mija. Os quatro pontos estão na categoria Grandes Fadas do mapa.', 'The other fairies ask for different musicians. Find Pyper for Kaysa, Beetz for Cotera, and Eustus for Mija. All four locations are under Great Fairies on the map.'],
    ] },
    { quest: 'FindWithSensors', title: ['Laboratório de Hateno e sensor', 'Hateno Lab and the sensor'], place: 'Hateno Ancient Tech Lab', steps: [
      ['Conclua a investigação de Autobuild de Josha. Encontre Robbie no Laboratório de Hateno, calibre o sensor e siga a leitura até o santuário próximo.', 'Finish Josha’s Autobuild investigation. Find Robbie at Hateno Ancient Tech Lab, calibrate the sensor, and follow it to the nearby shrine.'],
    ] },
    { quest: 'HatenoPurchasePicture', title: ['Preencha o Compêndio', 'Fill out the Compendium'], place: 'Hateno Ancient Tech Lab', steps: [
      ['Depois de liberar a câmera, fotografe criaturas, monstros, materiais, equipamentos e tesouros. Fale com Robbie no laboratório para comprar registros faltantes.', 'After unlocking the Camera, photograph creatures, monsters, materials, equipment, and treasure. Speak to Robbie at the lab to buy missing entries.'],
      ['Use a categoria Compêndio no checklist para ver as 509 entradas. Algumas fotos de chefes ficam disponíveis depois da história.', 'Use the Compendium category in the checklist to see all 509 entries. Some boss photos become available after the story.'],
    ] },
    { quest: 'ZonauReliefSearch', title: ['Mensagens de uma era antiga', 'Messages from an Ancient Era'], place: 'Kakariko Village', steps: [
      ['Examine o tablete que caiu no posto e fale com Wortsworth em Kakariko para iniciar a busca.', 'Inspect the tablet that fell at Lookout Landing and speak to Wortsworth in Kakariko to start the search.'],
      ['Use o mapa do céu para encontrar os doze tabletes nas ilhas em forma de flor. Fotografe as inscrições e apresente as fotos a Wortsworth. Se uma plataforma desabar, siga a pedra e faça a foto onde ela cair.', 'Use the Sky map to find the twelve tablets on flower-shaped islands. Photograph the inscriptions and show the photos to Wortsworth. If a platform collapses, follow the stone and take the photo where it lands.'],
    ] },
    { quest: 'Uotori_RevivePlan', title: ['Reconstrua Lurelin', 'Rebuild Lurelin Village'], place: 'Lurelin Village', steps: [
      ['Após expulsar os piratas, fale com Bolson. Reúna troncos e arroz de Hylia e siga os pedidos de reparo para reconstruir os serviços da vila.', 'After driving off the pirates, talk to Bolson. Gather logs and Hylian Rice, then follow the repair requests to restore the village services.'],
    ] },
  ] },
];

export function chapterLocation(chapter: WorldChapter) {
  if (!chapter.place) return;
  return worldById.get(chapter.place) ?? worldItems.find(item => item.at && item.name.replace(/’/g, "'") === chapter.place!.replace(/’/g, "'"));
}
