# Osiris · COBOL Graph Explorer

Aplicação local para navegar pelo controle que o analisador publicou, com statements e paragraphs COBOL, chamadas, candidatos e suas evidências.

## Visualização 3D

A visualização usa `3d-force-graph` + Three.js/WebGL e está integrada à `main`. Os centros dos nós e as conexões ficam num plano organizado por ELK. As caixas com conteúdo COBOL se voltam para a câmera, com órbita 3D livre pelos dois lados do plano. Partículas percorrem conexões ortogonais no sentido publicado. Veja [decisões, validação e limites do experimento](docs/EXPERIMENTO-3D.md).

## Rodar

Requer Node.js 22.12+ (validado em 24.19). Java só é necessário para gerar novos exemplos.

```bash
git clone https://github.com/Gustavo2358/osiris.git
cd osiris
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173**. Dezenove pacotes reais da pipeline já estão incluídos. Não é necessário executar o analisador para usá-los.

Para servir o build estático:

```bash
npm run build
npm run preview
# http://127.0.0.1:4173
```

Sem backend, conta, upload, telemetria, CDN ou persistência de fontes. Artefatos importados ficam na memória da aba. Recarregar descarta a importação. A aplicação precisa ser servida por HTTP; não abra `index.html` por `file://`.

## Explorar

- **Exemplos reais** fica no cabeçalho, também no modo de visualização. O grafo começa logo abaixo das ferramentas, sem a antiga faixa de apresentação do programa.
- **Voltar** (ou **Esc**) restaura o recorte, seleção, busca, destaques e câmera 3D anterior (posição, orientação e zoom). No modo de caminhos, a ação também aparece como **Voltar à visão anterior**.
- **Código fonte** abre um painel com o arquivo completo, números de linha e destaque da seleção. É possível trocar entre fonte original, copybooks e texto expandido, ampliar o painel ou desativar **Acompanhar seleção**. Clicar na localização do inspetor abre o trecho nesse painel. Chamadas, arquivos, paragraphs e trechos na barra lateral também acompanham a seleção, inclusive ao clicar novamente na mesma referência.
- **Modo de visualização** mostra apenas o grafo e o código, com cabeçalho compacto. **Sair da visualização** ou **Esc** restaura as ferramentas, mantendo seleção, recorte e zoom.
- **Divisória ajustável:** grafo à esquerda e código à direita; arraste a barra vertical para redistribuir o espaço. Duplo clique ou Enter restaura a proporção inicial. Com a barra focada, ←/→ ajustam o tamanho e Home/End levam aos limites. A proporção é mantida durante a sessão. O grafo usa fundo escuro para destacar os nós e as arestas.
- **Arquivos** lista acessos FILE com busca por statement, nome lógico ou valor possível. Cada acesso oferece valores, suportes, contexto CICS/SYSID, declaração associada e caminhos de controle, como nas chamadas. **Destacar arquivos** realça esses nós.
- Use a lista de **Chamadas** para buscar pelo statement ou por um candidato executável. Cada categoria conserva sua própria busca; a contagem mostra resultados e total, e **Mostrar todos** limpa uma busca sem resultados. As listas exibem localização, contexto e prévia dos valores.
- Selecione uma chamada para ver candidatos, valores brutos, produtores, provenance, premissas, reachability e remainders.
- **Iluminar definições dos valores**, no inspetor de uma chamada, destaca os produtores publicados em amarelo, a chamada em roxo e os caminhos entre eles em azul claro. Escolha um valor ou todos, use **Enquadrar valores destacados** para localizar o conjunto e **Ver definições e limites do destaque** para abrir as origens no código. **Limpar destaque** remove o realce; **Voltar/Esc** restaura a visão anterior. Também funciona para valores FILE. Com evidência RD, os ramos terminam nas sobrescritas comprovadas, marcadas em vermelho; **Ver sobrescrita** abre o código e os fatos. Limites de evidência aparecem em laranja. Veja [contrato e limites](docs/CAMINHOS-DOS-VALORES.md).
- **Caminhos até aqui** mostra o subgrafo alcançável da entrada selecionada que consegue chegar ao alvo. **Um caminho** destaca um caminho estrutural mínimo. O destino permanece identificado no banner enquanto você inspeciona outros trechos; clique nele para retornar. Saltos para produtores e vizinhos entram no histórico, preservando o recorte quando possível.
- **Paragraphs** abre um recorte da região. **Vizinhança** mostra até dois passos ao redor da seleção. O contador mostra o tamanho do recorte; **Programa inteiro** restaura os nós da unit selecionada.
- No **grafo 3D**, arraste com o botão esquerdo para deslocar e com o direito para girar livremente pelos dois lados do plano; os textos das caixas acompanham a câmera. Use a roda para aproximar. Clicar numa caixa seleciona o trecho e acompanha o código sem mover a câmera ou o centro de rotação. A navegação pela barra lateral localiza o trecho conservando o zoom. **Centralizar seleção** mantém a distância, **Ler seleção de perto** aproxima e **Enquadrar recorte** mostra o conjunto. **Vista frontal** volta à vista perpendicular ao plano. Textos aparecem conforme você se aproxima.
- **Pausar partículas** interrompe a animação; a câmera continua navegável. Elas mostram somente direção das transições, sem simular execução, frequência ou tempo. Verde indica ramo Sim, âmbar indica Não; passe o mouse numa aresta para inspecionar seu tipo e suas pontas. Preferência do sistema por movimento reduzido inicia as partículas pausadas e elimina os voos de câmera.
- Com foco no canvas, use setas para girar, +/− para zoom, Home para enquadrar, F para centralizar e Espaço para alternar as partículas. As caixas próximas também são selecionáveis por teclado.
- Nas abas, use as setas, Home e End. Esc fecha a ajuda e devolve o foco ao botão que a abriu; fora da ajuda e de campos de edição, Esc aciona **Voltar**.
- **Fonte** mostra o trecho associado; **Internos** abre os fatos originais, links, catálogos e o documento de dependencies completo.
- O botão de download exporta o recorte com os nós/transições originais, entrada, seleção e cobertura. É uma seleção para inspeção, não um novo artefato do analisador.

O exemplo **CardDemo · COACTUPC** usa o programa real de atualização de contas, com 5.037 nós. Consulte [execução, pins e limites](docs/CARDDEMO-COACTUPC.md).

A interface é otimizada para desktop. Em telas abaixo de 900 px, o inspetor fica abaixo do grafo e pode ser alcançado rolando a página.

### Navegação em grafos grandes

A roda aproxima o trecho sob o cursor; o zoom continua referenciado ao plano do
programa após deslocamentos longos. Dê **duplo clique numa caixa** para lê-la de
perto. Clique simples seleciona; botão esquerdo arrasta e direito gira.
[Problemas identificados, correções e validação](docs/UX-ZOOM-GRAFOS-GRANDES.md).

## Artefatos aceitos

Use **Abrir artefatos**, arraste os arquivos ou abra um pacote `.json` / `.json.gz`.

| Arquivo | Contrato | Papel |
|---|---|---|
| AIR, obrigatório | `analysis-ir-json` binding 1.0.0 / AIR 2.0.0 | Identidades, operações, provenance e incertezas |
| CFG, obrigatório | `analysis-cfg-json` 1.0.0, 2.0.0, 3.0.0 ou 4.0.0 | Única autoridade das arestas de controle |
| SP, opcional | `cobol-semantic-product` 2.0.0–2.50.0; exercitado em 2.50.0 | Statements, nomes e regiões |
| SP de compilação, opcional | `cobol-semantic-compilation` 1.0.0 | Várias units no mesmo pacote |
| Links, com SP | `cobol-explorer-links` 1.0.0 | `StatementLink` / `EntryLink` exportados da API do lower |
| Dependencies, opcional | `analysis-dependency-result` 1.0–1.2 e 2.0–2.6; exercitado em 2.6.0 | Sites, candidatos, suportes, limites e inventário unificado |
| Value flow, opcional | `cobol-explorer-value-flow` 1.0.0, fatos nativos `regional-analysis-result` 1.0–1.4 | Definições antes/depois das operações, com hash da AIR; exercitado em 1.0 e 1.2 |
| COBOL / copybooks, opcionais | UTF-8; nome lógico exato da provenance | Texto para apresentação |

Versões legadas listadas têm admissão explícita; a qualificação com a pipeline corrente está descrita em [VALIDATION.md](docs/VALIDATION.md). Versões futuras são recusadas. A aplicação não substitui os validators dos produtores.

Abra **uma publicação por vez**. AIR, CFG e dependencies devem ter a mesma PublicationId. Os links verificam SHA-256 dos bytes originais de SP e AIR. Não formate novamente esses arquivos após a exportação dos links. Dois artefatos com a mesma função são recusados.

AIR + CFG funcionam sozinhos. Sem links, SP não é associado por nomes, linhas ou texto: a tela usa a provenance AIR e informa a ausência da correlação. Sem dependencies, nenhum candidato é inventado. A categoria FILE publicada na AIR continua identificando acessos a arquivos; os valores exigem `fileDependencies` no produto de dependencies. Limite operacional: 192 MiB por seleção e por arquivo descomprimido, sem truncamento silencioso.

Fontes individuais usam o nome do arquivo como nome lógico. Para nomes com diretórios ou `<preprocessed>`, use o empacotador com o nome explícito. Caminhos de provenance nunca são abertos automaticamente.

## Gerar AIR, CFG, dependencies e links

A CLI atual do lower não serializa `LoweringResult.statements()` / `entries()`. O adapter [ExportLinks.java](bridge/ExportLinks.java) deste projeto chama a API pública real e publica esses IDs sem reconstruí-los. Não há alteração nos projetos do analisador.

Os scripts opcionais pressupõem os repositórios irmãos, Java 21+, bibliotecas Maven já disponíveis e os fontes ANTLR gerados pelo build do frontend. Consulte os [pins exatos](docs/VALIDATION.md#produtores).

```bash
# Compila os fontes existentes numa cache exclusiva deste projeto.
# Nenhuma escrita nos repositórios produtores ou instalação Maven.
python3 scripts/prepare_runtime.py

# Nova pasta obrigatória; falhas preservam outputs e logs por etapa.
python3 scripts/analyze.py fixtures/CICS-ROUTER.cbl \
  --out .local/minha-execucao \
  --storage-profile ibm-enterprise-6.4-fixed-display-1047@1 \
  --logical-text disabled \
  --entry-storage-state initial \
  --cics-entry-mode new-logical-level
```

Abra `.local/minha-execucao/bundle.json.gz` na aplicação. Esses parâmetros são os usados nos exemplos; selecione os perfis e estados adequados ao programa real. `--compilation` usa o SP de compilação para múltiplas units. `--copybooks DIRETORIO` pode ser repetido. O frontend corrente aceita formato fixo.

O script usa apenas JARs já existentes em `~/.m2/repository`, sem baixar dependências durante a preparação. `MAVEN_REPO` permite outro diretório. A cache registra versões, SHAs Git, estado dos checkouts e hashes dos fontes e JARs. Os gates dos produtores não são substituídos por essa compilação para consumo.

Para exercitar valores FILE calculados sobre storage físico, o script aceita a opção oficial `--experimental-physical`, repassada ao produtor de dependencies. Os novos exemplos `files-values` e `files-partial` usam essa opção, perfil IBM acima e logical-text desabilitado. Esse modo conserva os limites e razões publicados; a aplicação não executa uma análise adicional. O exemplo `files-unknown` conserva a execução do mesmo fonte em modo lógico, sem candidatos publicados.

Para empacotar uma execução já existente:

```bash
python3 scripts/pack.py --air run/air.json --cfg run/cfg.json \
  --sp run/sp.json --links run/links.json --dependencies run/dependencies.json \
  --source 'MEU-PROGRAMA.cbl=inputs/MEU-PROGRAMA.cbl' \
  --source 'COPY.cpy=inputs/COPY.cpy' \
  --title 'Meu programa' --out meu-programa.json.gz
```

`analyze.py` também exporta as definições pela API pública existente do analisador.
Para enriquecer um pacote antigo sem alterar seus produtos, execute:

```bash
python3 scripts/value_flow.py meu-programa.json.gz --out .local/com-definicoes
```

Abra `.local/com-definicoes/bundle.json.gz`. O empacotador manual aceita
`--value-flow run/value-flow.json`. Sem essa evidência, o destaque informa que
é estrutural. [Contrato, validação e limites](docs/CAMINHOS-DOS-VALORES.md).

O empacotador conserva o texto UTF-8 dos JSONs e não fabrica correlações. Para obter somente AIR + links a partir de SP, após preparar o runtime:

```bash
java -cp "$(cat .cache/runtime/classpath.txt)" ExportLinks \
  run/sp.json run/air.json run/links.json run/source-evidence.json
```

Os destinos AIR/links precisam ser novos. `source-evidence.json` é a entrada opcional do produtor de dependencies; não é o sidecar de links do visualizador.

## Verificar

```bash
npm test                 # modelo, contratos, identidades e consultas
npm run build            # TypeScript + bundle estático
npx playwright install chromium   # somente se o browser de teste estiver ausente
npm run test:e2e          # browser real contra o build em :4173
# ou npm run validate
```

[`docs/VALIDATION.md`](docs/VALIDATION.md) registra a validação inicial. [`docs/USABILITY.md`](docs/USABILITY.md) registra a ampliação de navegação, fonte e FILE. [`docs/UX-DISCOVERY.md`](docs/UX-DISCOVERY.md) enumera a revisão posterior de UX, suas nove correções e evidências: 52 testes de contrato e 20 de navegador. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explica as correlações e a consulta de caminhos.

## Limites reais

- Caminhos são **estruturais no CFG conhecido**, não prova de execução ou satisfatibilidade dos predicados. Controle aberto permanece aberto; nenhuma aresta desconhecida é criada.
- Contextos produzidos pelo lower para `PERFORM` permanecem como nós distintos. Nenhum merge de statements reconecta retornos de contextos diferentes.
- Chamadas externas mostram candidatos; não há expansão interprocedural do callee nem resolução adicional de nomes.
- Evidência de fonte e candidatos condicionais são exibidos com suas autoridades e premissas, separados dos candidatos da consulta executável.
- Os nomes de paragraphs usam regiões tipadas do SP e seus spans. Sem essa informação, a navegação por paragraphs fica indisponível.
- Os artefatos AIR podem não conter digest do fonte. O texto fornecido é uma anotação visual; os links SP/AIR são verificados, mas isso não autentica uma cópia de fonte escolhida pelo usuário.
- O CFG JSON legado não representa todos os resultados `PARTIAL_ANALYSIS`. Falhas do produtor ou ausência de CFG não são substituídas por fluxo reconstruído do SP.
- Escala exercitada: COACTUPC com 5.037 nós / 6.293 transições, além do exemplo de 503 nós / 602 transições / 100 sites. WebGL2 é necessário. Os centros das caixas ficam separados no plano; em ângulos rasantes, as caixas podem se sobrepor em perspectiva. Use Vista frontal, zoom e os recortes para leitura. Detalhes e partículas têm limites visuais para reduzir o uso de GPU, descritos no documento do experimento.
- Um fixture upstream de captura de dados entre programas aninhados falhou no lower; os detalhes para revisão estão em [VALIDATION.md](docs/VALIDATION.md#limitações-encontradas).

Repositório independente: [Gustavo2358/osiris](https://github.com/Gustavo2358/osiris). Caches, builds e dependências não são versionados.
