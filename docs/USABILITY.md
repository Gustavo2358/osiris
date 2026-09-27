# Navegação, fonte completo e FILE — 27/09/2026

## Comportamento entregue

- **Voltar**, **Voltar à visão anterior** e **Esc** restauram o recorte, entrada, seleção, busca, aba, destaque e viewport anteriores à consulta de caminhos. O histórico é local à publicação e inclui os recortes de paragraph e vizinhança.
- **Código fonte** abre o arquivo completo com linhas numeradas e o span selecionado destacado. Copybooks e texto expandido podem ser escolhidos explicitamente. O painel acompanha a seleção por padrão; a preferência pode ser desativada. Ampliar/fechar não altera o controle ou a seleção. O grafo mantém seu centro ao mudar de tamanho.
- **Arquivos** permite buscar acessos por código, nome lógico ou valor possível, selecionar o site, destacar seus nós e consultar os caminhos que chegam até ele. O inspetor mostra candidatos originais, valores brutos, produtores, provenance, declaração/roles, ponto de consulta, SYSID e limites publicados.

## Contrato preservado

O consumidor lê `fileDependencies` de `analysis-dependency-result`, exercitado em 2.6.0 / `file-values-context@1`. As referências usam EntryId, OperationId, LabelId, UnitId e ResourceId completos. Bindings devem fechar nos usos tipados da AIR. A aplicação rejeita referência ausente ou inconsistente. Não há reconciliação por texto/linha, interpretação de nome como DSNAME, preenchimento de candidatos pelo SELECT nem novas arestas.

O modo AIR+CFG identifica `invoke.target.category=file`; sem dependencies, informa a indisponibilidade dos valores. Declaração, candidato no ponto do comando e contexto SYSID permanecem informações distintas. O recurso LOCAL, quando publicado, não recebe nome externo inventado.

## Novas execuções reais

Todos os quatro pacotes atravessaram frontend → lower/links → CFG → dependencies nesta atualização. Fontes existentes de `analysis-cfg`, sem alterações. Os cinco SHAs dos produtores são os mesmos registrados em [VALIDATION.md](VALIDATION.md#produtores), conferidos com os checkouts limpos. O runtime isolado já compilado nesses pins foi reutilizado; os produtos FILE abaixo são novos.

| Pacote | Fixture | Resultado observado |
|---|---|---|
| files-values | w8/computed-closed.cbl | ACCOUNTS e CUSTOMER; SYSID R001; ponto BEFORE |
| files-partial | w8/computed-partial.cbl | ACCOUNTS e `unknownRemainder=true`; SYSID R001 |
| files-native | w2/multi-open.cbl | Duas declarações F/G, quatro usos; CLIENTDD nos usos alcançáveis; G permanece inalcançável no modelo, com candidatos vazios |
| files-unknown | w8/computed-closed.cbl | Modo lógico: candidatos vazios e remainder aberto |

`files-values` e `files-partial` usam o flag oficial `--experimental-physical`, perfil `ibm-enterprise-6.4-fixed-display-1047@1` e logical-text desabilitado. O estado inicial é declarado no primeiro; no caso parcial, permanece desconhecido. Os comandos exatos, hashes, pins e saídas estão em `evidence/file-navigation-20260927.json` e nos pacotes. Os logs e produtos individuais estão em `.local/files-*-20260927/` e permanecem intactos.

Observação do produto atual: `files-values` publica `unknownRemainder=false` e também a razão `FILE_SOURCE_VALUE_REMAINDER`. O visualizador conserva ambos os fatos; não deduz completude da fonte a partir do booleano. Controle/efeitos abertos e cobertura PARTIAL permanecem visíveis. Essa observação não foi corrigida no produtor nesta tarefa.

## Verificação

- 52 testes de modelo/contrato: regressão dos 12 pacotes iniciais e preservação dos quatro pacotes FILE, referências inválidas, valores parciais/desconhecidos, seleção por entrada, declarações e fallback sem dependencies.
- 11 testes de navegador contra o build: inclui retorno com restauração exata de viewport, Esc, painel completo, copybook, fonte ausente, largura de 800 px, busca por valor FILE, provenance/produtor, SYSID e caminhos.
- TypeScript, build de produção e formatação.

Evidências desta atualização: `evidence/usability-validation.log`, `evidence/usability-browser-results.json` e `evidence/files-source.png`. A evidência inicial não foi sobrescrita.

Os gates dos produtores não foram repetidos: nenhuma implementação, contrato ou pin do analisador mudou. O delta foi validado no consumidor, na fronteira de identidades e nas execuções reais selecionadas. A campanha de origem não foi reaberta; ASSIGN DYNAMIC e captura de conexão continuam fora do escopo implementado pelo analisador.
