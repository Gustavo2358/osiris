# COACTUPC: grafo conectado na pipeline atual

Reexecução de 27/09/2026, com atualização do exemplo e verificação no browser.

**Resultado: o grafo publicado tem um único componente e todos os 5.037 nós são alcançáveis pela entrada.** O Osiris carrega os novos produtos, preserva as 6.293 transições e permite consultar caminhos até os acessos a arquivos.

## Comparação

| Medida | Execução anterior com modelos IBM | Execução atual |
| --- | ---: | ---: |
| Nós | 3.048 | 5.037 |
| Transições | 3.887 | 6.293 |
| Componentes, ignorando direção | 5 | 1 |
| Nós alcançáveis da entrada, respeitando direção | 966 | 5.037 |
| Nós inalcançáveis da entrada | 2.082 | 0 |
| Sites CALL/XCTL alcançáveis | 0 de 4 | 8 de 8 |
| Sites FILE alcançáveis | 0 de 7 | 14 de 14 |
| SP | 2.49.0 | 2.50.0 |
| CFG JSON | 3.0.0 | 4.0.0 |

As contagens são de ocorrências/contextos publicados na AIR. Não representam oito chamadas distintas no fonte ou quatorze arquivos distintos. Os candidatos de programa incluem `CSUTLDTC` e `COMEN01C`; os de arquivo incluem `ACCTDAT`, `CUSTDAT` e `CXACAIX`.

A comparação usa somente as arestas originais e as identidades dos produtos. O teste de modelo também verifica igualdade das transições consumidas com o CFG e encontra caminhos para todos os sites publicados.

## Mudança observada na antiga fronteira

O binding de `INTO(CACTUPAI)` no RECEIVE MAP passou a estar disponível. Sua operação AIR agora publica uma continuação conhecida, com `CICS_RUNTIME_VALUES_AND_ENVIRONMENT_PARTIAL`, em vez de interromper a projeção por falta de capacidade executável. O binding de `FROM(CACTUPAO)` no SEND MAP também passou a estar disponível.

O SP registra 109 inputs `MODEL_STORAGE` e um `PHYSICAL_PROFILE`. As premissas dos modelos continuam explícitas. As mudanças atuais também publicam transferências excepcionais e saídas específicas no CFG v4.

## Alterações no visualizador

- Exemplo `CardDemo · COACTUPC` atualizado com SP, AIR, CFG, links e dependencies da mesma execução; 18 documentos de fonte incluídos.
- Admissão de SP até 2.50 e CFG v4, após leitura dos contratos reais.
- Preservação dos nós `OUTCOME_EXIT` e das transições `EXCEPTION` e `CONTROL_EXIT`. As saídas exibem a tag publicada e não duplicam o site da operação de origem.
- Verificação de identidade da operação associada às saídas e manutenção de `openControlRemainder` obrigatório em v3/v4.
- Limite de importação aumentado de 128 para 192 MiB: o novo pacote contém 140.817.979 bytes descomprimidos, sem remoção ou reescrita dos artefatos.

Nenhum produtor foi modificado. O trabalho permanece no repositório local do visualizador, branch `experiment/3d-force-graph`.

## Execução

Runtime compilada em cache nova com 463 fontes Java. Fonte `proleap-poc/corpus/carddemo/cbl/COACTUPC.cbl`, SHA-256 `b5bb7d6ccad022e0fc91b4dd1e971f49d184adf89b56abdce14eccff35b39396`.

| Repositório | SHA executado |
| --- | --- |
| proleap-poc | `313236603815cd8c4d7299ae366310a4292bc5ee` |
| cobol-lower | `da3325caa059a4beb7bd01f1fee262f9844725f2` |
| air-java | `59df1f7d6f3523b21b172a3ea4b5a0dc95128faa` |
| analysis-cfg | `50453b80f2cdac3239b7b77944c3546cdb8fc621` |
| analysis-ir | `2c7f31f19efbe3211a2aea5bbda90173a9666fe2` |

Os cinco checkouts estavam limpos. Foram usados os parâmetros anteriores: storage `ibm-enterprise-6.4-fixed-display-1047@1`, `initial`, CICS `new-logical-level`, logical-text `disabled` e dependencies `--experimental-physical`. SP → AIR/links → CFG → dependencies terminou com quatro códigos zero. Lower: `SUCCESS`, 5.203 StatementLinks e um EntryLink.

Outputs, comandos, logs, pacote anterior da UI e resultados de browser preservados em `.local/coactupc-current-20260927T214439Z/`. Os artefatos históricos originais continuam nos seus diretórios anteriores.

## Validação nova

- Recompilação e execução das quatro etapas reais para COACTUPC.
- Hashes SP/AIR dos links, conectividade direta do CFG e concordância com a alcançabilidade publicada em dependencies.
- `npm test`: 60 testes passaram, incluindo os 17 pacotes, caminhos dos 22 sites, preservação de saídas excepcionais e rejeição de identidades/versões incompatíveis.
- `npm run build`: TypeScript e build de produção passaram.
- `npx playwright test e2e/carddemo.spec.ts`: passou. Verifica renderização WebGL, visão geral, candidates, CALL em copybook, XCTL, fonte, caminhos, Voltar, paragraphs e redimensionamento de grafo/código.
- Chrome do usuário: exemplo atualizado com 5.037 nós / 6.293 transições; READ de `ACCTDAT` em `COACTUPC.cbl:3894` com candidato publicado; consulta “Caminhos até aqui” exibiu 1.457 nós e 1.796 transições. A opção “Um caminho” destacou 60 arestas.

A primeira tentativa do teste novo de browser verificou o destaque de um caminho antes de marcar “Um caminho”. O teste foi corrigido para executar essa interação; a execução anterior foi preservada em `browser-first-attempt/`. Não houve alteração dos artefatos para obter o resultado.

Não foram repetidos FAST/full/corpus dos produtores: este trabalho executa seus checkouts sem modificar código produtor. A evidência nova é a reprodução selecionada, a comparação semântica dos produtos e a validação do consumidor. Os resultados históricos são usados somente como baseline comparativo.

## Limites que permanecem

Conectividade significa alcançabilidade estrutural pelas transições publicadas; não prova que todas as combinações de condições sejam executáveis. O inventário do CFG e de dependencies permanece `PARTIAL`, o SP registra `INPUT_MISSING`, há dez terminadores com controle aberto e os quatorze sites FILE conservam restante desconhecido de valores. `analysisStatus = COMPLETE` indica término da análise, não completude do programa modelado. Ainda existem fronteiras alcançáveis com `TOPOLOGY_CONTROL_UNAVAILABLE`.

A evidência desta rodada é específica do COACTUPC. Ela não verifica a correção do defeito de OPEN/CLOSE múltiplo descrito em `DEFEITO-FILE-MULTI-OPERAND.md`.

## Evidências

- [Comparação e pins completos](../evidence/coactupc-connected-comparison.json)
- [Resultado do teste de browser](../evidence/coactupc-connected-browser-results.json)
- [Visão geral](../evidence/coactupc-connected-overview.png)
- [Grafo e código](../evidence/coactupc-connected-source.png)
- [Abrir COACTUPC](http://127.0.0.1:5173/?example=carddemo-coactupc)
