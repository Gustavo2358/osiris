# COACTUPC: por que os acessos FILE estão inalcançáveis

Investigação de 27/09/2026. **A hipótese dos copybooks ausentes foi confirmada para o corte observado no RECEIVE MAP.** O efeito passa pelas provas de memória publicadas pelo frontend e pela admissão executável do lowering.

## Cadeia causal no programa real

1. `COACTUPC.cbl:615–616` inclui `DFHBMSCA` e `DFHAID`, ausentes nesta execução. O SP os registra como `input:0` e `input:1`, tipo `MISSING_COPY`, `available: false`.
2. O layout `COACTUP.CPY` está disponível e foi expandido na linha 623. Entretanto, a prova `REGION_CONTEXT/storage-base:1127`, que governa a região de `CACTUPAI` e `CACTUPAO`, depende explicitamente dos dois inputs ausentes. Portanto, `LOCAL_ALLOCATION/storage-base:1127` fica indisponível. Essa correlação vem do grafo `factDependencies`, não de proximidade textual.
3. `EXEC CICS RECEIVE MAP`, nas linhas 1040–1045, usa `INTO(CACTUPAI)`. O binding de `storage-node:1127` tem `cells: []`, `regions: []` e depende daquela alocação indisponível. Os nomes do mapa/mapset e os campos RESP/RESP2 têm bindings admitidos; o bloqueio identificado é o buffer `INTO`.
4. `CicsCommandMemory.ready()` exige um binding disponível e não vazio para cada referência do comando. Esse requisito falha. `NonExecutableCapability` classifica o comando como não pronto e `TopologyProgramAssembler` publica `EXECUTABLE_CAPABILITY_NOT_READY`.
5. Na AIR, a operação `34801631f379dccf43d3a2ac64a7f805` termina a sequence como `opaque`, sem destinos conhecidos e com controle aberto. O nó CFG **586** é alcançável, mas não tem saída. O CFG está preservando o que recebeu da AIR.
6. O SP ainda publica o retorno normal de **`statement:888` para `statement:889`**, com a prova `cics-command-receive-map-ordinary-return`. A sequence do destino existe no nó **280**, mas não é alcançável da entrada. Uma busca iniciada nesse nó, percorrendo somente as arestas originais do CFG, chega aos **sete acessos FILE**. Nenhuma aresta foi inserida na investigação ou no visualizador.

Há 966 nós alcançáveis da entrada entre 3.048. A busca diagnóstica a partir do nó 280 visita 2.062 nós; ela não é um caminho certificado desde a entrada nem uma execução concreta do programa.

O ramo de processamento chega a `1000-PROCESS-INPUTS` → `1100-RECEIVE-MAP`; a projeção para no RECEIVE antes de prosseguir com a edição dos dados e a decisão de leitura/atualização. A continuação do SP sobrevive como informação de fonte, mas não é promovida a controle executável na AIR.

## Outros pontos observados

- `SEND MAP` em 3594–3601 usa `FROM(CACTUPAO)`, cujo binding também depende da mesma região indisponível. Dois contextos alcançáveis param nos nós 695 e 2094 pelo mesmo requisito de memória.
- Os outros terminais alcançáveis, nós 1399 e 2544, correspondem a controle aberto de SYNCPOINT e XCTL. Não são necessários para explicar o corte no ramo que leva aos arquivos. A causa completa do alvo indisponível de XCTL não foi investigada aqui.
- O `dependencies` inventaria os sete READ/REWRITE mesmo quando seus nós são inalcançáveis. Publica `candidates: []`, `unknownRemainder: true`, `FILE_VALUES_UNAVAILABLE` e `CICS_NAME_AREA_INTERPRETATION_OPEN`. Inventário da ocorrência e resolução de valores são resultados distintos.

## Reprodução controlada

Foi criada [CICS-COPY-FRONTIER.cbl](../fixtures/investigation/CICS-COPY-FRONTIER.cbl), com RECEIVE MAP seguido de READ FILE, e o copybook sintético [HOSTCTX.cpy](../fixtures/investigation/copybooks/HOSTCTX.cpy). Não são substitutos dos copybooks IBM do CardDemo.

O mesmo fonte, com SHA-256 `49590df8a458c199c7db30559123943cd1ea5cba88c4e506e6affd102fb2d536`, foi executado duas vezes. Somente a disponibilidade do diretório de COPY mudou:

| Resultado | HOSTCTX ausente | HOSTCTX presente |
| --- | --- | --- |
| Frontend, lower, CFG e dependencies | Todos exit 0 | Todos exit 0 |
| Binding do buffer de RECEIVE | Indisponível | Disponível |
| Continuação do RECEIVE no CFG | Ausente | Presente |
| Nós / transições | 5 / 3 | 5 / 4 |
| Acesso FILE | `UNREACHABLE_IN_MODEL` | `REACHABLE` |
| Candidatos | Vazio | `ACCOUNTS` |

O caso com COPY presente ainda publica `FILE_SOURCE_VALUE_REMAINDER`. A reprodução confirma o mecanismo de interrupção, não completude dos valores.

Para repetir a partir da raiz do visualizador, com a runtime já preparada, escolha diretórios de saída novos:

```bash
mkdir -p .local/copy-frontier-repro/empty
python3 scripts/analyze.py fixtures/investigation/CICS-COPY-FRONTIER.cbl \
  --out .local/copy-frontier-repro/missing \
  --copybooks .local/copy-frontier-repro/empty \
  --storage-profile ibm-enterprise-6.4-fixed-display-1047@1 \
  --logical-text disabled --entry-storage-state initial \
  --cics-entry-mode new-logical-level --experimental-physical
python3 scripts/analyze.py fixtures/investigation/CICS-COPY-FRONTIER.cbl \
  --out .local/copy-frontier-repro/present \
  --copybooks fixtures/investigation/copybooks \
  --storage-profile ibm-enterprise-6.4-fixed-display-1047@1 \
  --logical-text disabled --entry-storage-state initial \
  --cics-entry-mode new-logical-level --experimental-physical
python3 scripts/investigate_coactupc.py \
  .local/carddemo-coactupc-20260927T112652Z/pipeline \
  .local/copy-frontier-repro/missing .local/copy-frontier-repro/present \
  --out .local/copy-frontier-repro/diagnosis.json
```

O verificador é específico deste baseline. Usa identidades completas dos produtos, valida os hashes SP/AIR do exporter, percorre as provas de disponibilidade e verifica os dois resultados opostos. Não reanalisa texto COBOL para criar ligações.

## Evidência e limite da conclusão

[evidence/coactupc-copy-frontier.json](../evidence/coactupc-copy-frontier.json) registra os trechos causais, IDs, hashes dos artefatos, comandos, exit codes e os cinco pins. São os mesmos pins da [execução original](CARDDEMO-COACTUPC.md). Os resultados reais do COACTUPC foram reutilizados sem alteração; as duas reproduções foram executadas nesta investigação. Outputs e logs completos novos estão em `.local/coactupc-investigation/copy-missing/` e `copy-present/`.

Nenhum produtor, artefato original ou código da aplicação foi modificado. A checagem diagnóstica passou; não foram repetidos os gates completos dos produtores nem os testes de UI, porque a mudança se limita a fixtures, inspeção e documentação.

**Ainda não foi executado o COACTUPC com os copybooks IBM reais disponíveis.** Fornecê-los e reexecutar é o próximo passo para medir o quanto do grafo e dos valores fica resolvido. Não há garantia de que isso elimine todas as demais lacunas.

## Referências locais da implementação

- `proleap-poc/docs/domain/fact-dependency-locality.md`: disponibilidade por provas, contexto após inclusão desconhecida e limites conservadores.
- `cobol-lower/core/src/main/java/io/github/gustavo2358/lower/application/CicsCommandMemory.java:17`: admissão do binding de cada operando.
- `cobol-lower/core/src/main/java/io/github/gustavo2358/lower/application/TopologyProgramAssembler.java:138`: seleção da fronteira não executável; método `frontier` a partir da linha 231.
- `analysis-cfg/analysis-dependencies/src/main/java/io/github/gustavo2358/analysis/dependencies/FileDependencyConsumer.java:41`: reachability e condições para publicar candidatos.
