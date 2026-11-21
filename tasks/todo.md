# Walkthrough

- [x] Mover o crédito à IGN dos capítulos para Configurações e conferir no desktop e no navegador. O crédito e o link aparecem em Créditos, o aviso saiu dos capítulos e a navegação foi preservada. No navegador a 320 px, o texto coube sem rolagem horizontal. O link usa o endereço registrado no projeto, que retornou HTTP 403 na verificação externa.
- [x] Abrir os detalhes dos objetivos no próprio capítulo, usando o cartão do mapa.
- [x] Traduzir os 1.373 trechos para os nove idiomas restantes e conferir a terminologia com os catálogos do app.
- [x] Validar a troca entre os 12 idiomas no navegador e o popup no Electron e em tela de 390 px.

# Anti-Slop

- [x] Baixar, conferir e instalar as seis skills no repositório.
- [x] Aplicar a auditoria à interface, aos textos e ao código.
- [x] Corrigir os problemas confirmados na auditoria.
- [x] Separar visualmente a faixa “O que fazer?” dos filtros no checklist.
- [x] Validar build, testes e fluxos no Electron e no navegador.

## Auditoria

O Anti-Slop 3.2.30 foi instalado no projeto com os seis módulos e a licença MIT. Os 15 arquivos das skills foram comparados com a cópia de origem. O [AGENTS.md](../AGENTS.md) define quando aplicar as regras, e o [DESIGN.md](../DESIGN.md) registra a direção visual.

| Área | Achado | Ajuste e evidência |
| --- | --- | --- |
| Hierarquia e composição | A faixa “O que fazer?” encostava no painel de filtros e herdava um azul da interface antiga. | O painel de filtros ganhou contorno próprio. A faixa passa a ter 14 px de distância e usa verde escuro. No celular, título e contagem ocupam linhas distintas. |
| Paleta, densidade e ritmo | Bordas de categoria repetiam as cores das barras de progresso. O último indicador da visão geral ocupava meia linha sozinho no celular. | As cores sinalizam o progresso nas barras. O tempo de jogo fecha a grade móvel com uma linha inteira. A navegação inferior tem fundo sólido. |
| Movimento | O mapa e o indicador ao vivo pulsavam enquanto visíveis. O checklist animava a entrada de cada card e as barras animavam a largura. | Alertas de localização pulsam por até 4,8 s. O contorno do marcador continua visível durante o rastreio ao vivo. As barras usam transformação e respeitam a preferência por movimento reduzido. |
| Acessibilidade | O menu “Mais”, os detalhes do checklist e o aviso de atualização deixavam o foco fora do painel em alguns fluxos. Itens numerados eram lidos sem o nome completo. | Diálogos nativos assumem o foco e o devolvem ao fechar. A navegação por teclado foi testada junto com o seletor de idioma e os filtros. Os itens recebem nome e estado acessíveis. |
| Contraste | Os rótulos de corações pendentes tinham 3,73:1, os itens não mapeados tinham 3,63:1 no ponto mais claro do fundo e o botão principal do atualizador tinha 3,41:1. | O verificador do Anti-Slop mediu 8,26:1, 6,10:1 e 11,36:1, respectivamente, nas novas combinações. As cores de categoria permanecem nos ícones, nas bordas e no progresso. |
| Layout e toque | Títulos longos podiam ser cortados. A lista de categorias ultrapassava a janela e o mapa capturava a rolagem mesmo no zoom mínimo. | Os títulos quebram linha, a lista tem rolagem própria e o mapa permite a rolagem vertical no zoom mínimo. O arraste com zoom foi exercitado com toque simulado no Chromium. |
| Estados e texto | A segunda tela podia ficar na abertura após uma falha. “Escolher pasta” no celular não abria o seletor, e a visão geral podia dizer que todas as recompensas das Skulltulas foram alcançadas com a contagem indisponível. | A abertura mostra erro, oferece nova tentativa e recupera a conexão. O checklist avisa sobre quedas. O estado sem partida orienta a escolher a pasta no PC. A mensagem de Skulltulas reflete a falta do dado. |
| Desempenho e código | O JavaScript inicial trazia os nove dicionários adicionais. O código de arraste mantinha listeners temporários sem limpeza ao desmontar. | Cada dicionário adicional carrega por demanda. O JavaScript inicial passou de 595,86 para 203,66 kB com gzip. O gesto agora limpa listeners no cancelamento e ao desmontar. |
| Documentação | O início rápido vinculava o download a um nome de instalador com versão fixa. | O README aponta para Releases e descreve os formatos de cada plataforma. |

## Verificação

- **Design e conteúdo.** A progressão usa a arte do atlas como ponto focal. A tipografia de sistema, as cores de status, os ícones do jogo e a estrutura de navegação do diário orientaram o refinamento. O detector do Impeccable terminou sem ocorrências nos arquivos analisados.
- **Interface e estados.** Foram abertas as 12 telas da segunda tela em 320 px. O mapa foi conferido em 320, 393, 740, 768 e 1024 px. Também foram verificados teclado, retorno do foco, queda e reconexão, falta de save e carregamento por idioma. O Electron para Windows foi aberto com um save sintético. O diálogo de atualização foi exercitado com eventos simulados.
- **Build e testes.** TypeScript, Vite e os bundles do Electron passaram. O Vitest executou 168 testes e ignorou 11 que precisam de arquivos de save de teste ausentes. O Vite ainda informa que o chunk inicial minificado excede 500 kB.
- **Cobertura da verificação.** Os contrastes foram medidos nas combinações alteradas. Linux, dispositivo físico, jogo ao vivo e instalação de uma atualização publicada ficam fora desta verificação.

# Issue #5 — Lentidão do mouse no Windows

- [x] Diagnosticar a relação entre o overlay bloqueado e o atraso do cursor.
- [x] Remover o encaminhamento de movimentos do mouse e validar o overlay no Windows.
- [x] Registrar a correção na seção Fixed do changelog da versão 1.4.0.

# Easter Eggs and Secrets

- [x] Consultar 10 fontes sobre o remake de Switch 2, cruzar os achados com o catálogo do Tracker e recomendar se vale abrir uma seção manual. [Pesquisa e lista inicial de 18 descobertas](../docs/easter-eggs-research.md)
- [x] Ampliar o catálogo para 45 descobertas documentadas em 15 regiões, com pistas, soluções e fontes por entrada.
- [x] Implementar a aba no desktop e na segunda tela, com proteção de spoilers e progresso manual independente.
- [x] Colocar a aba abaixo do Salão dos Inimigos no primeiro grupo e abrir os segredos a partir dos cartões de região com fotos e progresso.
- [x] Remover a barra de busca e status e usar uma única lista geral de marcações.
- [x] Exibir barras de progresso em Fios do Tempo+, Minijogos e Salão dos Inimigos com os totais de cada tela.
- [x] Validar o catálogo, a navegação, a persistência da lista geral e a sincronização na rede local.

O build, o TypeScript e 172 testes passaram. Onze testes dependem de arquivos de save ausentes. No Electron e no Chromium, com um save sintético e largura móvel de 320 px, foram conferidos os totais das três barras, a atualização de Minijogos ao marcar um objetivo, as imagens das 15 regiões, o retorno de foco e a ocultação das soluções. A marcação de descobertas foi confirmada entre dois navegadores, na troca de slot, sem save e após recarregar o Electron.

# Missões de rumores

- [x] Remover a caça fotográfica do desktop e da segunda tela, com seus textos e captura manual.
- [x] Validar os menus e o quiz no Electron e no navegador a 320 px. TypeScript e build passaram, com 168 testes executados e 11 ignorados por falta de saves de teste.

# Checklist 100%

- [x] Exibir a barra de porcentagem geral acima dos filtros. No Electron e no navegador a 320 px, a barra mostrou o progresso da partida. A busca manteve o mesmo total, e marcar e desmarcar objetivos atualizou a porcentagem.

## Nomes próprios nas traduções

- [x] Exibir os nomes dos recomps e emuladores conforme detectados na pasta do save e evitar que pastas vizinhas sejam confundidas com executáveis.
- [x] Revisar os nomes dos personagens nos 12 idiomas. No Electron e na segunda tela a 320 px, os saves sintéticos mostraram os nomes originais. Build, TypeScript e 174 testes passaram, com 11 ignorados por falta de arquivos de save.

# Mapa de Hyrule

- [x] Remover a legenda genérica de localização embaixo do mapa.
- [x] Confirmar no Electron e na segunda tela a 320 px que a legenda saiu e que “Seguir Link” abre a região do save. O marcador apareceu no mapa geral e no mapa da Fonte Zora com um save sintético.

# Capturas automáticas

- [x] Desligar por padrão a captura da janela do jogo, inclusive para instalações que tinham o padrão antigo. O Electron confirmou o controle em Configurações, e a segunda tela manteve as miniaturas anteriores. Build, TypeScript e 175 testes passaram.
- [x] Remover a captura da janela e a opção em Configurações. O diário registrou marcos ao vivo, manteve entradas anteriores e exibiu as miniaturas lidas do save no Electron e na segunda tela.

# Seleção de partidas

- [x] Abrir a lista de perfis detectados ao clicar em Buscar saves, agrupada por programa, e trocar de partida apenas após a escolha.
- [x] Verificar a busca, o cancelamento por Escape e a seleção no Electron. A busca encontrou Hookshot, Longshot, Triforce, Fritchii, Lichii e ReLink. A segunda tela a 320 px acompanhou a seleção. Build, TypeScript e 176 testes passaram, com 11 ignorados por falta de saves de teste.
- [x] Mostrar uma linha por programa com o nome e a data do último save. O seletor de slots permaneceu disponível depois da escolha no Electron e na segunda tela.
- [x] Exibir o atalho configurado entre parênteses no botão do overlay em Configurações. Conferido com o atalho padrão e com uma configuração personalizada no Electron.
- [x] Exibir os ícones em Buscar saves. O Electron carregou 12 ícones em uma janela de 320 px, incluindo o ícone local de um executável de teste no caminho do NX2navi. Build, TypeScript e 176 testes passaram.

# Carregamento das telas

- [x] Usar um skeleton com o layout de cada tela durante o carregamento, incluindo o carregamento da galeria de descobertas.
- [x] Suavizar a troca de tela e o feedback dos botões, respeitando a preferência por movimento reduzido.
- [x] Conferir a 320, 768 e 1280 px as 13 telas do Electron e as 12 da segunda tela. A abertura, a galeria, a tentativa após falha e a reconexão voltaram ao conteúdo. Build, TypeScript e 176 testes passaram.
- [x] Tornar a animação de troca de página perceptível. O Electron e a segunda tela mostraram quadros intermediários na entrada de 260 ms. A segunda tela também respeitou movimento reduzido.

# Release 1.4.1

- [x] Revisar os issues e atualizar o changelog. Todos os issues existentes já estavam fechados.
- [x] Gerar os pacotes para Windows e Linux e validar a versão e os hashes nos metadados do atualizador. TypeScript passou e 176 testes foram aprovados.
