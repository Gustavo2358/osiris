# CardDemo · COACTUPC — 27/09/2026

**Atualização:** a [reexecução com modelos IBM sintéticos](COACTUPC-IBM-RERUN.md) confirmou cinco componentes desconectados e a mesma estrutura de nós/transições. Os resultados abaixo documentam o baseline embutido no visualizador.

## Abrir

Com `npm run dev`, abra [COACTUPC no Trama](http://127.0.0.1:5173/?example=carddemo-coactupc) ou escolha **CardDemo · COACTUPC** na lista de exemplos. O pacote `public/examples/carddemo-coactupc.json.gz` também pode ser importado em outra instância.

## Sincronização e origem

Foi executado `git fetch origin main` nos cinco checkouts principais do analisador. Todos já estavam em `main`, limpos e com HEAD igual a origin/main; nenhum merge ou descarte foi necessário. Worktrees de campanhas não foram movimentados. O visualizador permanece na main local, sem remote. `artefatos-e2e` permanece na branch `docs/cp6-w2-discovery`, sem remote, com suas alterações preexistentes preservadas (roadmap modificado, arquivos não rastreados e 37 commits além de sua main local). Ele não foi usado como produtor desta execução.

| Produtor | SHA sincronizado |
|---|---|
| proleap-poc | `7775c0407f6e5b60d73517b687f9768c878e59eb` |
| cobol-lower | `449ae4466ee2c7317a4df2148c6d4254762667cd` |
| air-java | `59df1f7d6f3523b21b172a3ea4b5a0dc95128faa` |
| analysis-cfg | `10eae0c3d51ac9b3d01cad5261f0fc439c1bc30b` |
| analysis-ir | `2c7f31f19efbe3211a2aea5bbda90173a9666fe2` |

Fonte: `proleap-poc/corpus/carddemo/cbl/COACTUPC.cbl`, 4.236 linhas físicas, SHA-256 `b5bb7d6ccad022e0fc91b4dd1e971f49d184adf89b56abdce14eccff35b39396`. A provenance do corpus identifica o projeto AWS CardDemo no commit `59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e`. Fonte e copybooks mantêm seus bytes; nenhum stub foi criado. Apache 2.0 e NOTICE preservados em [carddemo-licenses](carddemo-licenses/).

## Execução real

Runtime recompilado em cache exclusiva do visualizador a partir dos SHAs acima: 461 fontes Java. SP → AIR/links → CFG → dependencies concluídos com exit code 0. Parser sem erros. O lower publicou `BOUNDED_PUBLICATION`, 3.096 StatementLinks e um EntryLink.

Parâmetros: formato fixo; storage `ibm-enterprise-6.4-fixed-display-1047@1`; logical-text `disabled`; estado inicial `initial`; CICS `new-logical-level`; dependencies com `--experimental-physical`. São premissas desta execução, não descrição de um ambiente de produção do CardDemo.

```bash
python3 scripts/prepare_runtime.py
JAVA_TOOL_OPTIONS=-Xmx3g python3 scripts/analyze.py \
  ../proleap-poc/corpus/carddemo/cbl/COACTUPC.cbl \
  --out .local/coactupc-nova-execucao \
  --copybooks ../proleap-poc/corpus/carddemo/cpy \
  --copybooks ../proleap-poc/corpus/carddemo/cpy-bms \
  --storage-profile ibm-enterprise-6.4-fixed-display-1047@1 \
  --logical-text disabled --entry-storage-state initial \
  --cics-entry-mode new-logical-level --experimental-physical
```

O pacote de demonstração acrescenta os 16 copybooks disponíveis referenciados no catálogo de artifacts da AIR ao pacote do runner. Há também o original e o expandido, totalizando 18 documentos de fonte. Todos os nomes são os nomes lógicos publicados. O JSON descomprimido tem 105.583.292 bytes, dentro do limite de admissão de 128 MiB.

## Resultado e limites

- **3.048 nós e 3.887 transições**, todos conservados. O navegador renderiza apenas os nós na viewport.
- **95 regiões** de paragraphs/sections correlacionadas por identidade. `9000-READ-ACCT` permite explorar 14 trechos e 10 transições internas.
- **4 sites de CALL no controle**, quatro contextos da chamada literal `CSUTLDTC` em `CSUTLDPY.cpy`; uma ocorrência adicional de **CICS XCTL somente na fonte**, sem caminho fabricado no CFG.
- **7 sites FILE**, operações READ/REWRITE; é possível selecionar e inspecionar cada contexto.
- **PARTIAL** no CFG e em dependencies. Faltam `DFHAID` e `DFHBMSCA` no corpus fornecido. O frontend registra 629 gaps de resolução; o inventário SP inclui outros tipos de gaps e não equivale a essa contagem.
- Todos os 4 sites de controle e os 7 sites FILE são publicados como `UNREACHABLE_IN_MODEL` nesta execução, com candidatos de controle vazios. O visualizador conserva esse resultado. A evidência fonte da chamada ainda informa `CSUTLDTC`, sem promovê-lo a valor alcançável. Uma busca direta nas arestas encontra 966 nós alcançáveis da entrada entre os 3.048 publicados; na validação inicial não foi atribuída uma causa única aos trechos inalcançáveis. A [investigação posterior](COACTUPC-COPY-FRONTIER.md) confirmou a cadeia COPY ausente → binding de memória indisponível → corte no RECEIVE MAP, antes dos sete acessos FILE.

Esta execução valida o consumo e a navegação do produto parcial; não certifica completude da análise do CardDemo. Nenhum produtor foi modificado para viabilizar o resultado.

## Verificação e evidências

- **54 testes de modelo/contrato**, incluindo admissão do pacote completo, preservação de todas as arestas/links/sites e separação entre fonte e controle inalcançável.
- TypeScript e build de produção.
- **21 testes de navegador**. O cenário COACTUPC valida grafo grande, copybook original, evidência de fonte, XCTL sem controle, sete FILE sites, ausência de caminhos, Voltar, filtro por paragraph e fonte principal. Concluiu em 13,8 s no ambiente de teste; não é um SLA.
- `evidence/carddemo-coactupc-execution.json`: SHAs, sincronização remota, comandos, exit codes, hashes e inventário do pacote.
- `evidence/carddemo-validation-final.log`, `carddemo-browser-results.json` e `carddemo-coactupc.png`: verificação final. A primeira execução de um novo teste presumiu um campo de comando na evidência fonte; a correção do teste verifica o título publicado e a ausência de nós, sem alterar artefatos. O log inicial foi preservado.
- Produtos/logs individuais: `.local/carddemo-coactupc-20260927T112652Z/pipeline/`.

Os gates completos dos produtores não foram repetidos: nenhum código produtor foi alterado. A evidência nova é a compilação dos pins sincronizados, a execução de todas as fronteiras para COACTUPC e a regressão do consumidor sobre os 17 pacotes reais.
