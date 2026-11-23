import type { WorldRoute } from './totk-guide.js';
import { plateauName } from './botw-world.js';

export const botwStory: WorldRoute[] = [
  { id: 'plateau', title: plateauName, chapters: [
    { quest: 'FirstTower', title: ['Siga a Tábua Sheikah', 'Follow the Sheikah Slate'], place: 'Great Plateau Tower', steps: [
      ['Pegue a Tábua Sheikah no Santuário da Ressurreição, abra a saída e desça até o ponto amarelo do mapa.', 'Take the Sheikah Slate in the Shrine of Resurrection, open the exit, and descend toward the yellow pin.'],
      ['Examine o pedestal sob as ruínas para erguer a torre. Desça pelas plataformas e converse com o velho.', 'Examine the pedestal beneath the ruins to raise the tower. Descend by the ledges and speak with the Old Man.'],
    ], objectives: [['first:FirstTower'], ['quest:FirstTower']] },
    { quest: 'FindDungeon', title: ['O Planalto Isolado', 'The Isolated Plateau'], place: 'Oman Au Shrine', steps: [
      ['Vá ao santuário Oman Au, perto do lago. Use Magnesis para mover placas e cubos de metal e abrir caminho até o monge.', 'Visit Oman Au near the pond. Use Magnesis to move metal slabs and blocks, opening a path to the monk.'],
      ['Nas Ruínas da Abadia Oriental, passe longe dos Guardiões e entre em Ja Baij. Use as bombas redondas e quadradas para destruir as paredes rachadas.', 'At the Eastern Abbey, skirt the Guardians and enter Ja Baij. Use round and square bombs to break the cracked walls.'],
      ['Suba ao Monte Hylia com proteção contra frio. Em Keh Namut, erga pilares de gelo sob o portão e atravesse a água.', 'Climb Mount Hylia with cold protection. In Keh Namut, raise ice pillars beneath the gate and cross the water.'],
      ['Em Owa Daim, paralise a engrenagem com Stasis para atravessar. Depois paralise a pedra e acerte-a com o martelo para abrir a saída.', 'In Owa Daim, freeze the gear with Stasis to cross. Then freeze the boulder and strike it with the hammer to clear the exit.'],
      ['Troque as quatro Esferas Espirituais na estátua do Templo do Tempo. Suba ao telhado e receba o paraglider.', 'Trade your four Spirit Orbs at the Temple of Time statue. Climb to the roof and collect the paraglider.'],
    ], objectives: [['shrine:Dungeon038'], ['shrine:Dungeon041'], ['shrine:Dungeon065'], ['shrine:Dungeon009'], ['quest:FindDungeon']] },
  ] },
  { id: 'sheikah', title: ['Kakariko e Hateno', 'Kakariko and Hateno'], chapters: [
    { quest: 'Find_Impa', title: ['Procure Impa', 'Seek Out Impa'], place: 'Kakariko Village', steps: [
      ['Plane para fora do planalto, siga a estrada por Dueling Peaks e atravesse a ponte na direção de Kakariko.', 'Glide off the plateau, follow the road through Dueling Peaks, and cross the bridge toward Kakariko.'],
      ['Converse com Impa na casa no alto da vila. Ela mostra as quatro regiões e indica o laboratório de Hateno.', 'Speak to Impa in the house above the village. She reveals the four regions and directs you to Hateno’s lab.'],
    ] },
    { quest: 'Camera', title: ['Memórias trancadas', 'Locked Mementos'], place: 'Hateno Ancient Tech Lab', steps: [
      ['Suba ao laboratório de Hateno e fale com Purah. Pegue a chama azul do forno antigo e acenda as lanternas do caminho para ter pontos de retorno.', 'Climb to Hateno’s lab and speak with Purah. Take the blue flame from the ancient furnace and light the lanterns along the route.'],
      ['Acenda o forno do laboratório, tire uma foto de Purah com a nova runa da Câmera e mostre a Tábua a Impa.', 'Light the lab furnace, photograph Purah with the new Camera rune, and show the Slate to Impa.'],
    ] },
  ] },
  { id: 'beasts', title: ['As quatro Bestas Divinas', 'The four Divine Beasts'], chapters: [
    { quest: 'ZoraDomain', title: ['Chegue ao Domínio dos Zora', 'Reach Zora’s Domain'], place: 'Zora’s Domain', steps: [
      ['Encontre Sidon perto da Ponte Inogo e siga o caminho iluminado ao longo do rio. Use comida com resistência à eletricidade contra os Lizalfos.', 'Find Sidon near Inogo Bridge and follow the lit road along the river. Use shock-resistant food against the Lizalfos.'],
      ['Fale com o rei Dorephan e equipe a Armadura Zora para subir cachoeiras.', 'Speak to King Dorephan and equip the Zora Armor to swim up waterfalls.'],
    ] },
    { quest: 'Water_Relic', title: ['Besta Divina Vah Ruta', 'Divine Beast Vah Ruta'], steps: [
      ['Pegue 20 flechas elétricas no Monte Ploymus. Monte em Sidon, destrua o gelo com Cryonis e atire nas quatro esferas ao sair das cachoeiras.', 'Collect 20 shock arrows on Ploymus Mountain. Ride Sidon, break ice with Cryonis, and shoot all four orbs from the waterfalls.'],
      ['Ative o mapa e ajuste a tromba para mover as rodas e apagar as chamas. Use Cryonis e Magnesis para liberar os terminais.', 'Activate the map and adjust the trunk to turn the wheels and extinguish flames. Use Cryonis and Magnesis to reach the terminals.'],
      ['Contra Waterblight Ganon, use flechas no olho quando ele ficar fora do alcance. Quebre o gelo com Cryonis e fale com Dorephan depois da vitória.', 'Against Waterblight Ganon, shoot its eye when out of reach. Break ice with Cryonis, then speak to Dorephan after the fight.'],
    ] },
    { quest: 'Wind_Relic', title: ['Besta Divina Vah Medoh', 'Divine Beast Vah Medoh'], steps: [
      ['Converse com Kaneli na Vila Rito e com Teba no Campo de Treino. Acerte cinco alvos no ar e destrua os quatro canhões usando flechas-bomba.', 'Talk to Kaneli in Rito Village and Teba at the Flight Range. Hit five targets in the air, then destroy the four cannons with bomb arrows.'],
      ['Incline a besta no mapa para mover as plataformas e abrir o acesso às asas. Use as correntes de ar para alcançar os terminais externos.', 'Tilt the beast through the map to move platforms and access its wings. Ride updrafts to reach the outside terminals.'],
      ['Use as correntes de ar e flechas contra Windblight Ganon. Volte a Kaneli para concluir a missão.', 'Ride updrafts and shoot Windblight Ganon with arrows. Return to Kaneli to finish the quest.'],
    ] },
    { quest: 'Fire_Relic', title: ['Besta Divina Vah Rudania', 'Divine Beast Vah Rudania'], steps: [
      ['Leve proteção contra chamas a Goron City. Resgate Yunobo da Mina Norte e escolte-o até os canhões evitando os holofotes das sentinelas.', 'Bring flame protection to Goron City. Rescue Yunobo from the North Mine and escort him to the cannons while avoiding the sentry beams.'],
      ['Leve a chama azul às tochas para abrir o caminho até o mapa. Gire o corpo da besta no mapa para trocar o piso pelas paredes e alcançar os terminais.', 'Carry the blue flame to the torches to reach the map. Rotate the beast through the map to turn its walls into floors and reach the terminals.'],
      ['Quando Fireblight Ganon sugar o ar, jogue uma bomba remota e detone. Volte a Bludo após libertar a besta.', 'When Fireblight Ganon inhales, throw a Remote Bomb and detonate it. Return to Bludo after freeing the beast.'],
    ] },
    { quest: 'GerudoTown', title: ['Entre em Gerudo Town', 'Forbidden City Entry'], place: 'Kara Kara Bazaar', steps: [
      ['Fale com Benja do lado de fora de Gerudo Town. Procure Vilia no terraço da hospedaria de Kara Kara Bazaar e compre o traje.', 'Speak with Benja outside Gerudo Town. Find Vilia on the inn rooftop at Kara Kara Bazaar and buy the outfit.'],
      ['Equipe as três peças do traje e passe pelos guardas. Converse com Riju no palácio.', 'Equip all three pieces and pass the guards. Speak with Riju at the palace.'],
    ] },
    { quest: 'Electric_Relic', title: ['Besta Divina Vah Naboris', 'Divine Beast Vah Naboris'], steps: [
      ['Recupere o Elmo do Trovão no esconderijo Yiga. Fique perto de Riju no deserto e acerte os quatro pés de Naboris com flechas-bomba.', 'Recover the Thunder Helm in the Yiga Hideout. Stay near Riju in the desert and shoot all four feet of Naboris with bomb arrows.'],
      ['Use o mapa para girar os três cilindros. Alinhe os condutores verdes para alimentar os mecanismos, depois leve as esferas aos encaixes.', 'Use the map to rotate the three cylinders. Align the green conductors to power the mechanisms, then carry the orbs to their sockets.'],
      ['Desvie dos avanços de Thunderblight. Na segunda fase, use Magnesis para colocar uma das hastes metálicas perto dele antes do raio.', 'Dodge Thunderblight’s dashes. In phase two, use Magnesis to hold a metal rod near it before the lightning strikes.'],
    ] },
    { quest: 'Find_4Relic', title: ['Libere as Bestas Divinas', 'Free the Divine Beasts'], place: 'Kakariko Village', steps: [
      ['Libere Ruta, Medoh, Rudania e Naboris na ordem que preferir e conclua as quatro missões regionais.', 'Free Ruta, Medoh, Rudania, and Naboris in any order and finish their regional quests.'],
      ['Volte a Impa em Kakariko.', 'Return to Impa in Kakariko.'],
    ] },
  ] },
  { id: 'optional', title: ['Memórias e Espada Mestra', 'Memories and the Master Sword'], chapters: [
    { quest: 'Fairy', title: ['Ache a Fonte da Grande Fada', 'Find the Fairy Fountain'], place: 'Cotera', steps: [
      ['Mostre a Câmera a Pikango em Kakariko e siga-o pela trilha perto de Ta’loh Naeg.', 'Show the Camera to Pikango in Kakariko and follow him along the trail near Ta’loh Naeg.'],
      ['Abra a fonte, fotografe-a e leve a foto a Pikango.', 'Open the fountain, take a photo of it, and show the photo to Pikango.'],
    ] },
    { quest: 'PictureMemory', title: ['Memórias recuperadas', 'Captured Memories'], place: 'Kakariko Village', steps: [
      ['Abra a seção Memórias do diário. Compare a foto da Tábua com o local indicado e examine o brilho no chão para recuperar cada lembrança.', 'Open Memories in the journal. Match each Slate photo to the marked location and examine the glowing spot on the ground.'],
      ['Depois dos doze locais fotografados, volte a Impa. Ela mostra a imagem final, em Ash Swamp, próximo a Fort Hateno.', 'After discovering the twelve photo locations, return to Impa. She shows the final image, in Ash Swamp near Fort Hateno.'],
    ] },
    { quest: 'Get_MasterSword', title: ['A Espada do Herói', 'The Hero’s Sword'], place: 'Korok Forest', steps: [
      ['Entre na Floresta Perdida pela estrada. Siga as tochas e depois a direção em que as brasas voam para chegar à Floresta Korok.', 'Enter the Lost Woods by the road. Follow the torches, then the direction the embers drift, to reach Korok Forest.'],
      ['Com pelo menos 13 recipientes de coração permanentes, fale com a Árvore Deku e retire a Espada Mestra.', 'With at least 13 permanent heart containers, speak to the Deku Tree and draw the Master Sword.'],
    ] },
  ] },
  { id: 'castle', title: ['Castelo de Hyrule', 'Hyrule Castle'], chapters: [
    { quest: 'GanonQuest', title: ['Derrote Ganon', 'Destroy Ganon'], place: 'Hyrule Castle', steps: [
      ['Entre pelo portão, pelo cais ou pelas cachoeiras usando a Armadura Zora. Reponha comida e equipamentos antes de entrar no Santuário.', 'Enter by the gate, docks, or waterfalls using the Zora Armor. Refill food and equipment before entering the Sanctum.'],
      ['Enfrente os Flagelos das Bestas ainda não libertadas. Desvie ou reflita os ataques de Calamity Ganon para abrir a guarda.', 'Fight the Blights from any beasts you haven’t freed. Dodge or reflect Calamity Ganon’s attacks to drop its guard.'],
      ['No campo, atire com o Arco de Luz nas marcas douradas e use a corrente de ar para atingir o ponto final.', 'In the field, shoot the golden marks with the Bow of Light and use the updraft to hit the final weak point.'],
    ] },
  ] },
];

export const botwDlcRoutes: WorldRoute[] = [
  { id: 'optional', title: ['Expansão', 'Expansion Pass'], chapters: [
    { quest: 'TrialSword', title: ['Provação da Espada', 'Trial of the Sword'], place: 'Korok Forest', steps: [
      ['Com a Espada Mestra e o DLC, volte ao pedestal na Floresta Korok. Na prova, recolha as armas e a comida de cada sala antes de seguir.', 'With the Master Sword and the DLC, return to its pedestal in Korok Forest. During the trial, collect the weapons and food in each room before proceeding.'],
      ['Conclua as três etapas para fortalecer permanentemente a Espada Mestra.', 'Complete all three sets of trials to permanently strengthen the Master Sword.'],
    ] },
    { quest: 'BalladOfHeroes', title: ['A Balada dos Campeões', 'The Champions’ Ballad'], place: 'Shrine of Resurrection', steps: [
      ['Depois das quatro Bestas Divinas, volte ao Santuário da Ressurreição. Complete os quatro desafios do planalto com o Obliterator.', 'After the four Divine Beasts, return to the Shrine of Resurrection. Complete the four plateau challenges with the Obliterator.'],
      ['Use os monumentos de cada campeão para localizar as três provas da região. Complete os santuários e vença as revanches correspondentes.', 'Use each champion’s monument to locate three trials in the region. Clear the shrines and win the corresponding rematches.'],
      ['Volte ao Santuário da Ressurreição, termine a masmorra e vença Monk Maz Koshia para obter a Master Cycle Zero.', 'Return to the Shrine of Resurrection, finish the dungeon, and defeat Monk Maz Koshia to earn the Master Cycle Zero.'],
    ] },
  ] },
];
