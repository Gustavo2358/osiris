# Arquitetura e correlações

## Fronteiras

Aplicação React + TypeScript servida estaticamente por Vite. Nesta branch experimental, `3d-force-graph` e Three.js cuidam da cena WebGL, câmera orbital e seleção. `elkjs` calcula posições em camadas e rotas ortogonais em Web Worker. A geometria não muda o modelo de controle.

```mermaid
flowchart LR
  F[COBOL e COPY] --> P[Frontend real]
  P --> SP[Semantic Product]
  SP --> L[API pública do lower]
  L --> AIR[AIR]
  L --> LINKS[StatementLink e EntryLink]
  AIR --> C[Produtor CFG]
  AIR --> D[Produtor dependencies]
  SP --> V[Osiris no browser]
  AIR --> V
  LINKS --> V
  C --> V
  D --> V
  F -. texto opcional .-> V
```

- `src/artifacts.ts`: reconhecimento por contrato, descompressão, rejeição de versões/publicações incompatíveis e SHA-256 do sidecar.
- `src/model.ts`: índices de identidades, joins explícitos, projeção de apresentação e consultas sobre arestas publicadas.
- `src/Graph.tsx`: cena 3D, câmera, histórico, recortes, seleção e descarte de recursos. Os nós não são editáveis.
- `src/graph3d.ts`: cartões em texturas Canvas, cores e tipos da cena.
- `src/planar-layout.ts`: layout ELK em camadas, com todos os nós em z=0. O worker oficial de ELK é servido localmente. `src/routed-link.ts`: linhas, setas e partículas sobre a mesma rota ortogonal, identificada pela aresta original.
- `src/SourcePane.tsx`: fonte integral, troca explícita de arquivo, destaque por span e acompanhamento opcional da seleção. Não reconstrói relações do grafo a partir de linhas.
- `src/Inspector.tsx`: fatos de COBOL, candidatos/suportes, fonte, limites e detalhes brutos carregados visualmente sob demanda.
- `bridge/ExportLinks.java`: adapter externo ao analisador; usa `FileLowering`, `CobolLowerer`, `AirFileOutput` e o `LoweringResult` retornado pela mesma API de produção.

Documentos brutos permanecem disponíveis. O visualizador não implementa um parser COBOL, lowerer, validator AIR, solver de valores ou novo CFG.

## Join exato

1. `CFG.publication.localId == AIR.publication.id.localId == dependencies.publication.localId`.
2. `CFG.SEQUENCE.label` → `AIR.Unit.sequences[].label`.
3. O terminador do nó deve coincidir, por OperationId completo e kind, com o terminador AIR dessa sequence.
4. `links.statements[].target` → OperationId; `source` → `{unit: UnitKey, handle: StatementId}` no SP. O adapter também fornece label e origin. O viewer verifica a presença da operação nessa sequence.
5. `links.entries[].target` → EntryId completo; a identidade fonte conserva compilationUnitId, structuralPath e canonicalProgramName.
6. `dependencies.sites` → EntryId + OperationId; `sequence` identifica o trecho publicado. Candidatos conservam `supports`, `producer`, `origin`, `premises` e remainders originais.
7. `dependencies.programs[].sourceOccurrence` pode agregar evidência fonte a uma ocorrência já correlacionada. Autoridades diferentes e candidatos condicionais não são misturados com a consulta executável.
8. `fileDependencies.sites` → EntryId + OperationId + sequence; valida owner e categoria FILE da AIR. `bindings[].declaration` → ResourceId → declaração/uses AIR, conferindo operação e role. Sites FILE ficam separados de chamadas, mesmo quando ambos usam `invoke`. Candidatos e SYSID são conservados literalmente; declaração não supre valores de usos inalcançáveis.
9. O DAG de origins é percorrido por OriginId; artefatos por ArtifactId. Spans servem apenas para extrair o texto explicitamente fornecido.

A chave de uma identidade conserva domínio, publicação, unit, localId e owner quando presente. O domínio dos IDs CFG/AIR no wire CFG é definido pelo campo tipado, conforme o contrato. Objetos são comparados por conteúdo canônico, não pela ordem das chaves. Não há decodificação de hashes, interpretação de `sourceKey`, basename heurístico ou reconciliação por linha/texto.

O sidecar possui contrato próprio `cobol-explorer-links/1.0.0`, `spSha256`, `airSha256`, PublicationId, listas `statements` / `entries`, `loweringStatus` e limitações retornadas pelo lower. Os hashes correspondem aos arquivos originais, não a JSON reserializado. Hashes correlacionam documentos; não são assinatura do produtor.

## Apresentação COBOL

Cada nó continua representando um nó CFG. Statements ligados às operações dão texto e tipo ao cartão. Statements sem arquivo fonte usam a variante tipada do SP. Helpers sem link preservam sua identidade e provenance AIR.

Paragraphs/sections vêm de `controlTopology.regions`. A associação sobe a cadeia `occurrence.region → parent` até a região tipada mais próxima. A primeira linha do span da prova da região serve de título visual; ela não determina arestas ou membros. Nós com múltiplos statements preservam todos no inspetor. Um mesmo statement expandido em várias ocorrências CFG conserva os contextos separados.

Rótulos “Sim” / “Não” representam `BRANCH_TRUE` / `BRANCH_FALSE`. Alternativas com o mesmo destino continuam como arestas diferentes. Candidatos de chamada nunca viram arestas de controle para callees.

## Consulta de caminhos

Para uma EntryId escolhida:

1. Selecione exclusivamente transições com `activationEntry` igual a essa identidade.
2. Calcule `F`, os nós alcançáveis a partir do nó ENTRY, por BFS.
3. Calcule `R`, os nós que alcançam o(s) alvo(s), por BFS nas arestas invertidas.
4. O recorte é `F ∩ R`, com as arestas originais cujas pontas pertencem à interseção.
5. Uma segunda BFS registra predecessores para um caminho mínimo, sem enumerar caminhos exponencialmente numerosos.

Custo O(V+E) e memória O(V+E). Ciclos terminam por conjuntos de visitados. Os caminhos incluem as possibilidades estruturais publicadas, inclusive voltas em ciclos. Um caminho mínimo não resolve predicados. Não ter caminho conhecido é diferente de provar impossibilidade no COBOL completo.

A seleção usada como alvo permanece fixa enquanto o usuário inspeciona outros nós do recorte. As ações de navegação podem voltar à visão completa quando o destino está fora do recorte.

## Estado de navegação e fonte

Entrar em caminhos, vizinhança ou paragraph guarda um snapshot do recorte anterior, entrada, seleção, busca, aba, destaques e viewport. A pilha fica na memória, limitada a 30 snapshots por publicação. Voltar/Esc aplica o snapshot; o viewport é restaurado após o layout correspondente estar pronto. Inspecionar um nó dentro do recorte não muda o alvo fixo da consulta. Trocar a publicação limpa o histórico.

O painel de fonte usa somente `documents.sources[nomeLógico]`. Original, copybook e expandido são escolhas explícitas. Se o original não foi fornecido, o painel informa a ausência; não o substitui pelo expandido. Os spans publicados destacam as linhas/colunas usando caracteres Unicode e a convenção de fim publicada. Redimensionar o painel mantém o centro e zoom do grafo.

## Escala e segurança local

- Layout fora da thread principal e workers encerrados quando o recorte muda.
- A cena contém todos os nós e arestas do recorte. Até 128 caixas próximas recebem textura detalhada e equivalente acessível no DOM; as restantes compartilham texturas por categoria. Busca e consultas não dependem da presença no DOM. Partículas em grafos com mais de 500 nós ficam restritas às arestas incidentes nas caixas detalhadas.
- Cada recorte recebe um layout plano fixo e determinístico, com cache dos últimos 16 layouts por publicação. Selecionar outro nó no mesmo recorte reutiliza a cena, sem recalcular posições. Arrays da biblioteca são cópias de apresentação: a substituição de source/target por objetos não altera o modelo. Ciclos e arestas paralelas conservam IDs, sentido e rotas próprias.
- Os centros das caixas ficam no plano do layout; cada cartão é um Sprite Three.js que acompanha a câmera. A órbita percorre os dois lados do plano. Todos os cartões usam a mesma camada de anotação, ordenada por distância, sobre as conexões para não riscar o texto em ângulos oblíquos. A seleção não altera posição, orientação ou prioridade de desenho. O clique usa raycast da câmera no momento do evento e só seleciona; órbita e pan não selecionam por acidente. As ações explícitas de câmera e a navegação lateral localizam a seleção. Texturas descartadas saem da GPU e a cena é destruída ao desmontar. A animação é suspensa enquanto a aba fica oculta.
- JSON interno é formatado somente quando seu painel é aberto.
- Importação é atômica para a sessão: erro preserva o programa anterior. Resultados assíncronos de uma importação anterior não substituem uma seleção mais recente.
- Fontes e textos importados são renderizados como texto React, Canvas ou `textContent` nos tooltips, nunca HTML executável.
- Nenhum path/URL de provenance é aberto. Nomes lógicos não dão acesso ao filesystem nem à rede.
- Limites de bytes são operacionais, com rejeição explícita e sem descarte de fatos.

## Referências consultadas

Contratos e implementações locais fixados nos SHAs de `VALIDATION.md`:

- `proleap-poc/docs/domain/cobol-semantic-product.md`
- `cobol-lower/.../application/LoweringResult.java`, `SourceOrigins.java`, `CompilationLowerer.java`
- `analysis-ir/bindings/json-v1.md`
- `analysis-cfg/docs/architecture/cfg-json-v1.md`, `cfg-json-v2.md`, `cfg-json-v3.md`
- `analysis-cfg/docs/architecture/analysis-dependency-result-v1.md`
- `analysis-cfg/.../CfgJsonWriter.java`

Integração visual conforme a [API oficial de 3d-force-graph](https://github.com/vasturiano/3d-force-graph#api-reference), especialmente `nodeThreeObject`, `linkThreeObject`, `linkPositionUpdate` e câmera. O [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) fornece a geometria; partículas são interpoladas nos segmentos dessas rotas. Ver [experimento 3D](EXPERIMENTO-3D.md). A versão 2D está preservada na branch `main`.
