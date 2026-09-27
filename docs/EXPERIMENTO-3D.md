# Experimento de navegação 3D

27/09/2026 · branch `experiment/3d-force-graph` · base `main` em `8e7ec83d5db315169b4361747bbbf8e4dc2d24ef`.

A visualização usa **3d-force-graph 1.80.0**, **Three.js 0.186.1** e **elkjs 0.11.1**. Os centros dos nós e as arestas ficam organizados num plano. As caixas se voltam para a câmera, que pode orbitar pelos dois lados do diagrama. A versão 2D permanece na `main`. O repositório continua local, sem remote; nenhum projeto do analisador foi alterado.

## Experimentar

```bash
npm ci
npm run dev
# http://127.0.0.1:5173/?example=carddemo-coactupc
```

- Arraste para orbitar; botão direito desloca; roda aproxima ou afasta. A órbita é livre pelos dois lados do plano; os cartões acompanham a câmera e mantêm o texto de frente.
- Clique numa caixa para selecionar seu trecho e acompanhar o código. O clique mantém posição, zoom e centro de rotação da câmera. O centro da caixa permanece no plano. Todos os cartões têm a mesma prioridade de desenho; a seleção não passa à frente dos demais.
- **Enquadrar recorte** mostra caixas e conexões do conjunto; **Ler seleção de perto** aproxima para leitura. **Centralizar seleção** conserva o zoom, e **Vista frontal** recupera a orientação de um diagrama 2D.
- **Pausar partículas** interrompe o movimento, mantendo as setas. As partículas percorrem as linhas e seus cantos no sentido source → target. Verde indica `BRANCH_TRUE`, âmbar indica `BRANCH_FALSE`; o tooltip informa o tipo e as pontas.
- Navegação lateral, candidatos, provenance, FILE/possible values, caminhos, histórico e painel de código continuam disponíveis. A barra lateral localiza o trecho conservando o zoom. **Voltar** restaura posição, alvo e orientação da câmera, além do recorte e seleção.
- **Modo de visualização** mantém grafo à esquerda e código à direita, com divisória ajustável e cabeçalho mínimo.
- Com foco no canvas: setas giram, +/− ajustam zoom, Home enquadra, F centraliza e Espaço alterna partículas. Caixas próximas têm controles equivalentes por teclado. Movimento reduzido inicia as partículas pausadas e desativa os voos de câmera.

## Organização e autoridade

ELK calcula um layout em camadas de cima para baixo, com caixas separadas e conexões ortogonais. Os centros dos nós e as conexões ficam em z=0; os cartões giram para acompanhar a câmera. A força física foi desativada; clicar e navegar com a câmera não altera posições. Selecionar outro nó no mesmo recorte também não recalcula o layout.

O modelo e a admissão de artefatos permanecem os mesmos: SP/AIR/CFG/dependencies, sidecar de identidades e fontes. Não há nova correlação por texto/linha.

Cada nó e aresta conserva sua identidade original. Ciclos, alternativas paralelas e componentes desconexos são preservados. Rotas de retorno podem subir ou contornar caixas: a disposição visual não prova ordem de execução ou alcançabilidade. Nenhuma ligação é criada para aproximar componentes.

A cena recebe cópias das estruturas de apresentação. Partículas, setas e linhas usam a mesma rota, identificada pela aresta original; os cantos não introduzem nós ou transições no modelo. As partículas indicam direção estrutural. Sua velocidade e quantidade não representam frequência, tempo ou uma execução real. Caminhos continuam sendo calculados exclusivamente sobre o CFG publicado.

## Escala e limites

- O layout roda no Web Worker oficial de ELK, servido localmente. Cada recorte recebe uma distribuição própria e determinística; os últimos 16 layouts por publicação ficam em cache.
- Todos os nós e arestas permanecem na cena. Até 128 caixas próximas e suficientemente grandes recebem texturas detalhadas; as demais compartilham cartões por categoria. O texto integral continua disponível por hover, seleção e inspetor.
- Acima de 500 nós, as partículas ficam nas arestas incidentes nas caixas detalhadas. As demais transições mantêm linhas e setas. Aproximar ativa o detalhe da região.
- Programas extensos produzem diagramas altos. A visão geral mostra a estrutura; para ler, use zoom, busca, paragraphs, vizinhança ou caminhos. Ângulos rasantes aproximam as posições na tela e podem sobrepor cartões; **Vista frontal** recupera a visão perpendicular ao plano. Este experimento não oferece minimapa.
- O enquadramento inclui rotas de retorno e o alcance da câmera comporta a visão geral do COACTUPC. WebGL2 é necessário. Falhas de inicialização/contexto e de worker são informadas. A cena pausa em abas ocultas; texturas, geometrias e cenas desmontadas liberam recursos.
- Validação funcional em Chromium e no browser integrado. Não foi realizado benchmark de FPS nem qualificação em todos os navegadores/GPUs. O build avisa sobre o chunk principal de aproximadamente 1,72 MB (480 kB gzip); o worker de ELK tem 1,59 MB.
- O pacote COACTUPC existente foi reutilizado: 3.048 nós e 3.887 transições. Seus componentes desconexos e limites publicados continuam presentes; veja a [investigação do rerun com copybooks IBM](COACTUPC-IBM-RERUN.md).

## Revisão: órbita livre e textos voltados para a câmera

A apresentação inicial usa uma inclinação leve. Os cartões são sprites com dimensões no espaço 3D, e seus controles acessíveis usam a mesma projeção da câmera. O clique por raycast funciona dos dois lados, acompanha o código e preserva câmera e centro de rotação. Todas as caixas usam a mesma camada de anotação sobre as conexões, com ordem por distância entre cartões; a seleção não recebe prioridade especial.

Validação: **60 testes de modelo/layout e 36 de navegador passaram**, além do build, formatação e `git diff --check`. Os dois novos cenários giram cerca de 83° e 172°, verificam o raster WebGL, dimensões do cartão, clique real, fonte, posições estáveis, histórico e retorno à vista frontal. A suíte inclui COACTUPC e o grafo de 503 nós. Após alinhar a camada das conexões à dos cartões, foram repetidos os **13 testes de cena 3D e COACTUPC**: [log final](../evidence/billboard-scene-final.log) e [resultado bruto](../evidence/billboard-scene-final-results.json).

Evidências: [modelo](../evidence/billboard-model.log), [build](../evidence/billboard-build.log), [navegador](../evidence/billboard-browser.log), [resultado bruto](../evidence/billboard-browser-results.json), [CICS pelo outro lado](../evidence/billboard-cics-back-final.png) e [roteador pelo outro lado](../evidence/billboard-order-router-back-final.png).

## Validação anterior da revisão plana

- `npm test`: **60 testes passaram**. Os seis novos verificam identidades, cartões sem sobreposição, rotas ortogonais, endpoints direcionados, ciclos, arestas paralelas, determinismo e partículas percorrendo os cantos. Usam pacotes reais de branches, PERFORM, CICS e GO TO. [Log](../evidence/planar-model.log).
- `npm run build`: **PASS**, TypeScript e build estático. [Log](../evidence/planar-build.log).
- `npm run test:e2e`: **34 testes passaram**. [Log](../evidence/planar-browser.log) e [resultado bruto](../evidence/planar-browser-results.json).
- `npm run format:check` e `git diff --check`: **PASS**.
- Os testes de navegador cobrem fonte, valores FILE, provenance, busca, recortes, witness, histórico, modo de visualização, divisória e teclado. A seleção por clique real mantém câmera, centro de rotação e posições tanto no programa inteiro quanto no recorte de caminhos.
- COACTUPC completo e o exemplo de 503 nós foram exercitados. A visão geral do COACTUPC tem verificação do raster WebGL para detectar desaparecimento por limite de distância da câmera. A medição exclui controles HTML sobrepostos e distingue caixas legíveis de perto das conexões visíveis na visão geral; a [revisão do detector](../evidence/planar-overview-regression/README.md) registra o ajuste. Partículas, pausa, raycast, pan, rotação, zoom, retorno de câmera, movimento reduzido e falha de worker também são verificados.
- As falhas preliminares de clique rápido e retorno durante layout foram corrigidas; o [log preliminar](../evidence/planar-browser-preliminary.log) permanece preservado.

Evidências: [CICS plano](../evidence/planar-all.png), [recorte de caminhos](../evidence/planar-paths.png), [COACTUPC inteiro](../evidence/planar-carddemo-overview.png), [COACTUPC com fonte](../evidence/planar-carddemo-viewing.png).

A validação inicial com distribuição espacial está preservada em [3d-browser.log](../evidence/3d-browser.log), [resultado bruto](../evidence/3d-browser-results.json) e nas imagens `3d-*` em `evidence/` (54 testes de modelo e 32 de navegador naquela revisão).

## Referências

- [API oficial de 3d-force-graph](https://github.com/vasturiano/3d-force-graph#api-reference): objetos Three.js próprios, atualização de posições de arestas e câmera.
- [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) e [elkjs](https://github.com/kieler/elkjs): layout em camadas, rotas ortogonais e integração com Web Worker.
- 3d-force-graph e Three.js usam MIT; elkjs usa EPL-2.0. Versões exatas estão no lockfile.
