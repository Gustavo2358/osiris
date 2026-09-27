# Trama · COBOL Graph Explorer

Aplicação local para navegar pelo controle que o analisador publicou, com statements e paragraphs COBOL, chamadas, candidatos e suas evidências.

## Rodar

Requer Node.js 22.12+ (validado em 24.19). Java só é necessário para gerar novos exemplos.

```bash
cd /home/gustavo/workspace/teste-e2e/cobol-graph-explorer
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173**. Dezessete pacotes reais da pipeline já estão incluídos. Não é necessário executar o analisador para usá-los.

Para servir o build estático:

```bash
npm run build
npm run preview
# http://127.0.0.1:4173
```

Sem backend, conta, upload, telemetria, CDN ou persistência de fontes. Artefatos importados ficam na memória da aba. Recarregar descarta a importação. A aplicação precisa ser servida por HTTP; não abra `index.html` por `file://`.

## Explorar

- **Voltar** (ou **Esc**) restaura o recorte, seleção, busca, destaques e zoom anteriores. No modo de caminhos, a ação também aparece como **Voltar à visão anterior**.
- **Código fonte** abre um painel com o arquivo completo, números de linha e destaque da seleção. É possível trocar entre fonte original, copybooks e texto expandido, ampliar o painel ou desativar **Acompanhar seleção**. Clicar na localização do inspetor abre o trecho nesse painel.
- **Arquivos** lista acessos FILE com busca por statement, nome lógico ou valor possível. Cada acesso oferece valores, suportes, contexto CICS/SYSID, declaração associada e caminhos de controle, como nas chamadas. **Destacar arquivos** realça esses nós.
- Use a lista de **Chamadas** para buscar pelo statement ou por um candidato executável. Cada categoria conserva sua própria busca; a contagem mostra resultados e total, e **Mostrar todos** limpa uma busca sem resultados. As listas exibem localização, contexto e prévia dos valores.
- Selecione uma chamada para ver candidatos, valores brutos, produtores, provenance, premissas, reachability e remainders.
- **Caminhos até aqui** mostra o subgrafo alcançável da entrada selecionada que consegue chegar ao alvo. **Um caminho** destaca um caminho estrutural mínimo. O destino permanece identificado no banner enquanto você inspeciona outros trechos; clique nele para retornar. Saltos para produtores e vizinhos entram no histórico, preservando o recorte quando possível.
- **Paragraphs** abre um recorte da região. **Vizinhança** mostra até dois passos ao redor da seleção. O contador mostra o tamanho do recorte; **Programa inteiro** restaura os nós da unit selecionada.
- Arraste o fundo, use a roda, controles de zoom e minimapa. Selecionar outro trecho preserva o zoom. **Centralizar seleção** reencontra o trecho e **Enquadrar recorte** mostra o conjunto visível. A visão geral pode exigir zoom para ler os textos.
- Nas abas, use as setas, Home e End. Esc fecha a ajuda e devolve o foco ao botão que a abriu; fora da ajuda e de campos de edição, Esc aciona **Voltar**.
- **Fonte** mostra o trecho associado; **Internos** abre os fatos originais, links, catálogos e o documento de dependencies completo.
- O botão de download exporta o recorte com os nós/transições originais, entrada, seleção e cobertura. É uma seleção para inspeção, não um novo artefato do analisador.

O exemplo **CardDemo · COACTUPC** usa o programa real de atualização de contas, com 3.048 nós. Consulte [execução, pins e limites](docs/CARDDEMO-COACTUPC.md).

A interface é otimizada para desktop. Em telas abaixo de 900 px, o inspetor fica abaixo do grafo e pode ser alcançado rolando a página.

## Artefatos aceitos

Use **Abrir artefatos**, arraste os arquivos ou abra um pacote `.json` / `.json.gz`.

| Arquivo | Contrato | Papel |
|---|---|---|
| AIR, obrigatório | `analysis-ir-json` binding 1.0.0 / AIR 2.0.0 | Identidades, operações, provenance e incertezas |
| CFG, obrigatório | `analysis-cfg-json` 1.0.0, 2.0.0 ou 3.0.0 | Única autoridade das arestas de controle |
| SP, opcional | `cobol-semantic-product` 2.0.0–2.47.0; exercitado em 2.47.0 | Statements, nomes e regiões |
| SP de compilação, opcional | `cobol-semantic-compilation` 1.0.0 | Várias units no mesmo pacote |
| Links, com SP | `cobol-explorer-links` 1.0.0 | `StatementLink` / `EntryLink` exportados da API do lower |
| Dependencies, opcional | `analysis-dependency-result` 1.0–1.2 e 2.0–2.6; exercitado em 2.6.0 | Sites, candidatos, suportes, limites e inventário unificado |
| COBOL / copybooks, opcionais | UTF-8; nome lógico exato da provenance | Texto para apresentação |

Versões legadas listadas têm admissão explícita; a qualificação com a pipeline corrente está descrita em [VALIDATION.md](docs/VALIDATION.md). Versões futuras são recusadas. A aplicação não substitui os validators dos produtores.

Abra **uma publicação por vez**. AIR, CFG e dependencies devem ter a mesma PublicationId. Os links verificam SHA-256 dos bytes originais de SP e AIR. Não formate novamente esses arquivos após a exportação dos links. Dois artefatos com a mesma função são recusados.

AIR + CFG funcionam sozinhos. Sem links, SP não é associado por nomes, linhas ou texto: a tela usa a provenance AIR e informa a ausência da correlação. Sem dependencies, nenhum candidato é inventado. A categoria FILE publicada na AIR continua identificando acessos a arquivos; os valores exigem `fileDependencies` no produto de dependencies. Limite operacional: 128 MiB por seleção e por arquivo descomprimido, sem truncamento silencioso.

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
- Escala exercitada: 503 nós / 602 transições / 100 sites. Grafos maiores são aceitos dentro do limite de bytes, mas não foram qualificados nesta entrega.
- Um fixture upstream de captura de dados entre programas aninhados falhou no lower; os detalhes para revisão estão em [VALIDATION.md](docs/VALIDATION.md#limitações-encontradas).

Repositório Git independente, sem remote. Caches, builds e dependências não são versionados.
