# COACTUPC com modelos IBM sintéticos — 27/09/2026

**Resultado mais recente:** a [nova execução e verificação na UI](COACTUPC-CONTROLE-ATUALIZADO.md) publicou um único componente, com todos os 5.037 nós alcançáveis. O conteúdo abaixo preserva o resultado histórico.

**Resultado: o CFG continua desconexo.** A pipeline atual foi recompilada e executada de novo, com os modelos sintéticos ativos. Os nós e as transições são iguais aos do baseline quando se remove somente o namespace `publication` das identidades. A igualdade foi conferida nos produtos completos, além da comparação das contagens.

## Antes e depois

| Medida | Baseline anterior | Modelos IBM sintéticos |
| --- | ---: | ---: |
| Nós | 3.048 | 3.048 |
| Transições | 3.887 | 3.887 |
| Componentes sem ligação entre si | 5 | 5 |
| Nós alcançáveis da entrada | 966 | 966 |
| Nós inalcançáveis da entrada | 2.082 | 2.082 |
| Sites FILE alcançáveis | 0 de 7 | 0 de 7 |
| Sites CALL de controle alcançáveis | 0 de 4 | 0 de 4 |
| Símbolos com `modelAssumed: true` | 0 | 105 |
| Gaps de resolução reportados pelo frontend | 629 | 546 |
| Versão do SP | 2.47.0 | 2.49.0 |

Os componentes têm **2.062, 966, 17, 2 e 1 nós**. O de 966 contém a entrada; todos os seus nós são alcançáveis. O componente de um nó é `NORMAL_EXIT`. A contagem de componentes ignora a direção das arestas; a alcançabilidade respeita sua direção. Ambos os cálculos usam somente as transições originais do CFG.

## Por que o corte permaneceu

A atualização foi consumida: DFHBMSCA e DFHAID aparecem com provenance `model:ibm-cics/structural-v2/...`, e o SP publica 105 símbolos assumidos pelo modelo. O frontend registra `NOMINAL_COPYBOOK` e zero erros de parser.

Os modelos fornecem nomes, grupos, tipos e tamanhos declarados, mas não concedem prova de layout físico ou memória executável. As provas de memória ainda representam as regiões desses modelos por inputs indisponíveis do tipo `MISSING_COPY`. São **109 fatos de input**, e não 109 arquivos faltantes: 72 apontam para o modelo DFHBMSCA e 37 para DFHAID.

A cadeia por identidades permanece:

1. A região `storage-base:1343` de CACTUPAI/CACTUPAO depende desses inputs.
2. O binding de `INTO(CACTUPAI)` em RECEIVE_MAP, `statement:888`, permanece sem células e sem regiões admitidas. Sua prova `LOCAL_ALLOCATION/storage-base:1343` continua indisponível.
3. `CicsCommandMemory.ready()` exige binding disponível e não vazio para os operandos. O lowering conserva o comando como fronteira `EXECUTABLE_CAPABILITY_NOT_READY`.
4. O nó CFG 586 é alcançável, mas continua sem saída. Os nós 695 e 2094, contextos alcançáveis de SEND_MAP com `FROM(CACTUPAO)`, também continuam sem saída.

O catálogo resolveu parte dos nomes, mas não liberou a admissão de memória que condiciona a continuação desses comandos no lowering. Isso é compatível com o contrato atual dos modelos, que explicitamente não acrescenta successors de CFG. Mudar essa condição requer revisão semântica do produtor.

Autoridades locais: [modelos DFH](../../proleap-poc/docs/domain/preprocessing.md), [SP 2.49](../../proleap-poc/docs/domain/cobol-semantic-product.md), [admissão de memória CICS](../../cobol-lower/core/src/main/java/io/github/gustavo2358/lower/application/CicsCommandMemory.java), [provas de disponibilidade](../../proleap-poc/src/main/java/io/github/gustavo2358/cobolexplorer/FactLocalitySemantics.java).

## Execução e pins

Fonte e parâmetros iguais aos do baseline. SHA-256 do COACTUPC: `b5bb7d6ccad022e0fc91b4dd1e971f49d184adf89b56abdce14eccff35b39396`. Runtime reconstruída em cache limpa com 462 fontes; nenhum produtor foi modificado.

| Repositório | SHA executado |
| --- | --- |
| proleap-poc | `22d37233373b9db691ba170d898b7523bfea5746` |
| cobol-lower | `83f11f13dd5e521382e4903c2d8bf9e92832f11a` |
| air-java | `59df1f7d6f3523b21b172a3ea4b5a0dc95128faa` |
| analysis-cfg | `095f711d78750f27fcc60b6eb1437e23e8c1b970` |
| analysis-ir | `2c7f31f19efbe3211a2aea5bbda90173a9666fe2` |

SP → AIR/links → CFG → dependencies: **quatro exit codes 0**. Lower: `BOUNDED_PUBLICATION`, 3.096 StatementLinks e um EntryLink. Cobertura e dependências permanecem parciais; sucesso da execução não significa análise completa.

Outputs e logs novos: `.local/coactupc-ibm-20260927T161359Z/`. Baseline preservado em `.local/carddemo-coactupc-20260927T112652Z/`. Comando, ambiente, pins e hashes constam na [comparação estruturada](../evidence/coactupc-ibm-graph-comparison.json); a invocação do runner está em `.local/coactupc-ibm-20260927T161359Z/invocation.json`.

Para repetir a comparação em um arquivo novo:

```bash
python3 scripts/compare_coactupc_cfg.py \
  .local/carddemo-coactupc-20260927T112652Z/pipeline \
  .local/coactupc-ibm-20260927T161359Z/pipeline \
  --out .local/coactupc-ibm-comparison-nova.json
```

## Verificação e limites

**Novos checks:** compilação dos produtores atuais, execução das quatro etapas, integridade dos hashes SP/AIR dos links, travessia direta do CFG, correspondência entre reachability e dependencies e comparação integral de nós/transições após renomear o namespace da publicação. O script correlaciona statements, labels e nós pelas identidades publicadas, sem reconciliar texto ou linhas.

**Reutilizado:** os produtos do baseline anterior, como referência histórica. FAST/CI das mains atuais já constam do [fechamento da integração IBM](../../artefatos-e2e/ibm-copybooks-integration-20260927/REPORT.md); não foram reexecutados nesta investigação.

**Não executados:** full/corpus e testes de UI, pois esta rodada verifica um programa com produtores inalterados e não modifica a aplicação. O exemplo embutido continua no baseline anterior. O novo SP 2.49 está fora da faixa até 2.47 atualmente admitida pelo importador; esta verificação foi realizada diretamente sobre os produtos novos.
