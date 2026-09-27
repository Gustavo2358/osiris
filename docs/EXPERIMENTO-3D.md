# Experimento de navegação 3D

27/09/2026 · branch `experiment/3d-force-graph` · base `main` em `8e7ec83d5db315169b4361747bbbf8e4dc2d24ef`.

O renderer foi substituído por **3d-force-graph 1.80.0**, **Three.js 0.186.1** e **d3-force-3d 3.0.6**. A versão 2D permanece na `main`. O repositório continua local, sem remote; nenhum projeto do analisador foi alterado.

## Experimentar

```bash
npm ci
npm run dev
# http://127.0.0.1:5173/?example=carddemo-coactupc
```

- Arraste para orbitar; botão direito desloca; roda aproxima ou afasta.
- Clique numa caixa para selecionar seu trecho e aproximar a câmera. Caixas são cartões voltados para a câmera, com statement, categoria, linha e contexto/valores. A caixa selecionada aparece em primeiro plano.
- **Enquadrar recorte** mostra todos os nós do recorte; **Ler seleção de perto** recupera a escala de leitura. **Centralizar seleção** conserva o zoom, e **Vista frontal** recupera a orientação.
- **Pausar partículas** interrompe o movimento, mantendo as setas. As partículas percorrem source → target. Verde indica `BRANCH_TRUE`, âmbar indica `BRANCH_FALSE`; o tooltip da aresta informa o tipo e as pontas.
- Navegação lateral, candidatos, provenance, FILE/possible values, caminhos, histórico e painel de código continuam disponíveis. **Voltar** restaura posição, alvo e orientação da câmera, além do recorte e da seleção.
- **Modo de visualização** mantém o grafo à esquerda e código à direita, com divisória ajustável e cabeçalho mínimo.
- Com foco no canvas: setas giram, +/− ajustam zoom, Home enquadra, F centraliza e Espaço alterna partículas. As caixas próximas têm controles equivalentes acessíveis por teclado. A preferência por movimento reduzido inicia as partículas pausadas e desativa o voo da câmera.

## Autoridade e apresentação

O modelo e a admissão de artefatos não foram alterados. Os mesmos SP/AIR/CFG/dependencies, sidecar de identidades e fontes continuam aceitos. Não há nova correlação por texto/linha.

Cada nó e aresta do recorte conserva sua identidade original. O renderer recebe cópias das estruturas de apresentação, pois a biblioteca substitui endpoints por objetos durante a simulação. Arestas paralelas conservam seus IDs e usam curvas em planos diferentes. Ciclos são permitidos. Nenhuma ligação é criada para aproximar componentes desconexos.

A distribuição é espacial: posição e proximidade não representam ordem de execução, pertencimento a paragraph ou alcançabilidade. Partículas indicam direção estrutural; sua velocidade e quantidade não representam frequência, tempo ou uma execução real. Os recortes de caminhos continuam sendo calculados exclusivamente sobre o CFG publicado.

## Escala e limites

- O layout roda em Web Worker por 180 iterações e depois fica fixo. Cada recorte recebe uma distribuição própria, evitando carregar os espaços de um programa grande para um paragraph pequeno. Os últimos 16 layouts são mantidos em cache; a simulação determinística permite regeneração.
- Todos os nós e arestas do recorte permanecem na cena. Até 128 caixas próximas e suficientemente grandes na tela recebem texturas detalhadas; as demais compartilham cartões por categoria. O texto integral continua disponível por hover, seleção e inspetor.
- Acima de 500 nós, as partículas ficam nas arestas incidentes nas caixas detalhadas. As demais transições mantêm linhas e setas. Aproximar a câmera ativa o detalhe da região.
- Há sobreposição em perspectiva. Zoom, rotação, busca, paragraphs, vizinhança e caminhos ajudam a isolar regiões. Este experimento não oferece o minimapa 2D; o botão de enquadramento recupera a visão geral.
- Requer WebGL2. Falhas de inicialização/contexto e de worker são informadas. A cena pausa quando a aba fica oculta; texturas descartadas e cenas desmontadas liberam seus recursos.
- Validação funcional em Chromium e no browser integrado. Não foi realizado benchmark de FPS nem qualificação em todos os navegadores/GPUs. O build avisa sobre o chunk principal de aproximadamente 1,71 MB (477 kB gzip), incluindo Three.js.
- O pacote COACTUPC existente foi reutilizado: 3.048 nós e 3.887 transições. Seus componentes desconexos e limites publicados continuam presentes. A troca de renderer não altera a análise; veja a [investigação do rerun com copybooks IBM](COACTUPC-IBM-RERUN.md).

## Validação

- `npm test`: **54 testes passaram**, incluindo contratos, identidade, preservação dos produtos e consultas sobre os pacotes reais.
- `npm run build`: **PASS**, TypeScript e build estático. [Log](../evidence/3d-build.log).
- `npm run test:e2e`: **32 testes passaram**. [Log](../evidence/3d-browser.log) e [resultado bruto](../evidence/3d-browser-results.json).
- `npm run format:check` e `git diff --check`: **PASS**.
- Cenários exercitados: CALL literal/dinâmico, CICS, valores FILE, COPY, programas aninhados, ciclo com GO TO, busca, caminhos, witness, fonte e modo de visualização. O caso de 503 nós e o COACTUPC completo continuam navegáveis.
- Verificações 3D: pixels claros do canvas WebGL contra fundo escuro; escala inicial de leitura; clique por raycast; seleção por teclado; rotação, pan e zoom; restauração da câmera após pan; aproximação desde a visão geral; partículas alterando o raster e sua pausa; movimento reduzido; troca de exemplos; erro de worker sem carregamento infinito.
- Inspeção visual adicional do COACTUPC, visão geral, paragraph `9000-READ-ACCT` e código lado a lado no browser integrado.

Evidências visuais: [COACTUPC e inspetor](../evidence/3d-carddemo.png), [COACTUPC e código](../evidence/3d-carddemo-viewing.png), [CICS com caminhos](../evidence/3d-cics-paths.png).

## Referências

[Demo de grafo grande](https://vasturiano.github.io/3d-force-graph/example/large-graph/) e [API oficial](https://github.com/vasturiano/3d-force-graph#api-reference): `nodeThreeObject`, `linkDirectionalParticles`, `linkCurveRotation`, `cameraPosition`, `controls` e eventos de seleção. As três bibliotecas de visualização/distribuição usam licença MIT; versões exatas estão no lockfile.
