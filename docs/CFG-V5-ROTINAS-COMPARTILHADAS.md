# CFG v5 — prévia dos corpos compartilhados

## Abrir

Na branch `feat/cfg-v5-shared-routines`, execute `npm ci` e `npm run dev`.
Abra <http://127.0.0.1:5173/?example=carddemo-coactupc-shared>.
O seletor contém seis exemplos com “PR compartilhado”. Os pacotes completos estão
em `public/examples/`; navegar neles não exige Java, checkouts produtores ou pipeline.
Os 19 exemplos anteriores permanecem disponíveis, com seus bytes preservados.

## Produtores usados em 30/09/2026

| Projeto | Revisão | SHA |
|---|---|---|
| air-java | [PR #23](https://github.com/Gustavo2358/air-java/pull/23) | `e0aef0e1928d88a74fe66b7a4d0af84556b84b19` |
| cobol-lower | [PR #52](https://github.com/Gustavo2358/cobol-lower/pull/52) | `85abf8e0e3f601e9c56b322bc1dcf8a055e7c75a` |
| analysis-cfg | [PR #57](https://github.com/Gustavo2358/analysis-cfg/pull/57) | `c1900f744e1309ffb2f6fde958374f4ede535a56` |
| proleap-poc | pin usado na qualificação dos PRs | `4c00dea2a6bad1ba21076e55681f6038b80f8a47` |
| analysis-ir | contrato preservado | `2c7f31f19efbe3211a2aea5bbda90173a9666fe2` |

Os três PRs estavam abertos e draft na conferência. Os checkouts usados estavam limpos.
O trabalho modifica apenas o Osiris. As branches dos produtores e as mudanças anteriores
de blocos por zoom foram preservadas. Não houve merge dos PRs.

## Contratos e representação

- Admissão de SP até 2.62, dependencies 2.7, CFG 5.0.0; AIR 2.0.0 / binding 1.0.0.
- `transitions` do CFG v5 contém apenas relações ordinárias. `localControl` contém
  invocações, fronteiras, retornos e remoções da pilha de PERFORM.
- Cada regra é conferida contra o terminador AIR, os labels de destino, OperationId
  e CompletionPortId completos. Uma regra por terminador local; nenhuma transição
  ordinária pode sair dele. Contagens decimais são comparadas como BigInt.
- A consulta acompanha `(entrada, nó, pilha)`. Invocar entra no corpo; não salta ao resume.
  A fronteira consulta apenas o topo. Retornar usa o chamador ativo. Unwind excessivo
  segue a saída inválida publicada. Saídas da ativação descartam a pilha.
- A cena mostra um nó por ID CFG e reúne apenas as transições locais produzidas pela
  travessia. O inspetor identifica corpos usados em vários contextos. O layout continua
  plano, com câmera 3D, fonte, recortes, partículas e blocos por zoom.
- `Caminhos até aqui` e `Um caminho` são calculados sobre estados, antes da projeção
  visual. Não percorrem a união irrestrita dos retornos. A vizinhança é visual e reúne
  contextos, como a visão geral; não constitui uma testemunha de execução.
- No export de seleção v2, `localControl` conserva as regras; `displayTransitions`
  contém as relações de apresentação com `derivedFrom: CFG_LOCAL_RULE`, origem/destino
  e regra responsável. Não é um CFG novo nem deve ser interpretado como retornos livres.
- Hipóteses `sourceContinuations` do SP e candidatos condicionais de dependencies
  permanecem evidência de fonte. Não concedem arestas executáveis.

Contratos consultados nos pins acima: `cfg-local-wire.md`, `local-control.md`,
`ContextView.java`, `LocalControlRules.java`, `CfgJsonWriter.java`,
`cobol-semantic-product.md` (SP 2.51–2.62) e `qualified-source-dependencies-v1.md`.

## Resultados novos

| Exemplo | Nós CFG | Transições ordinárias | Regras locais | CALL/CICS programa | FILE |
|---|---:|---:|---:|---:|---:|
| COACTUPC | 3.132 | 3.625 | 169 | 6 | 14 |
| PERFORM repetido | 13 | 8 | 3 | 2 | 0 |
| Valores por chamador | 14 | 9 | 3 | 3 | 0 |
| CICS e PERFORM | 12 | 7 | 3 | 1 | 0 |
| Arquivos por chamador | 12 | 7 | 3 | 0 | 1 |
| PERFORM TIMES THRU | 13 | 10 | 2 | 1 | 0 |

O COACTUPC anterior tem 5.037 nós; a nova geração tem 3.132 (**37,8% menos**).
A UI desenha 3.827 relações: 3.625 ordinárias e 202 relações locais contextualmente
realizadas. A consulta usa 5.082 estados. Há 3.065 nós físicos alcançáveis; os 67 restantes
são exatamente saídas `invalid_local_return` sem execução conhecida, uma por retorno
local. A visão principal mostra 3.065 nós e oculta essas 67 saídas por padrão.
**Cobertura publicada → Mostrar saídas defensivas** as inclui no grafo e na busca da
aba **Trechos**. O inspetor explica a proteção e permite examinar seu nó CFG original.
Somente saídas `invalidExit` de regras locais admitidas e sem caminho conhecido na
entrada selecionada são ocultadas. Saídas defensivas alcançáveis e outros nós
inalcançáveis permanecem visíveis. Nenhuma conexão é criada; modelo, regras e consulta
de caminhos continuam completos. **Voltar** restaura também essa opção de visibilidade.
Todos os sites executáveis CALL/CICS e FILE têm caminho conhecido.

A troca bem-sucedida de exemplo atualiza `?example=` na URL, conservando os outros
parâmetros e o fragmento. Refresh reabre esse exemplo. Falhas e respostas de seleções
anteriores não mudam a publicação nem a URL. Uma importação local bem-sucedida remove
`example`; o conteúdo importado permanece só na memória e precisa ser reaberto após
refresh. O histórico de navegação do grafo continua no botão **Voltar**.

Compartilhamento depende da prova de elegibilidade do lower. Ainda existem ocorrências
separadas quando o produtor precisa mantê-las. O Osiris não funde nós por texto/linha.
Em programas pequenos, helpers e saídas defensivas podem elevar a contagem física.

No caso `shared-caller-values`, o CALL dentro da rotina é único e conserva PROGA001 e
PROGB001. Os CALLs após cada PERFORM mantêm seu candidato correspondente. Um caminho
até o primeiro CALL não passa pelo segundo PERFORM nem pela atribuição de PROGB001.
O exemplo FILE tem um único ENDBR, com ACCOUNT e CUSTOMER e seus supports.

## Validação

Classificação: mudança de consumer/wire (C3) e travessia contextual (C4) no visualizador.

**NEW_RUN:** compilação de 481 fontes sem mudar os produtores; seis execuções completas
SP → AIR/links → CFG → dependencies → consultas regionais → pacote. Cada estágio
terminou com exit code 0. Os arquivos brutos e logs estão em `.cache/shared-pr/`.
Pins, comandos, hashes de artefatos/fontes e resultados estão em
[`shared-routines-generation-20260930.json`](../evidence/shared-routines-generation-20260930.json)
e dentro de cada bundle. A cache não é versionada; os bundles são autocontidos.

**Oráculo independente:** `scripts/check_local_oracle.py` executou o
`cfg_local_paths.py` do produtor sobre os seis pacotes. O inventário congelado
[`shared-routines-oracle.json`](../tests/fixtures/shared-routines-oracle.json)
registra hash do oráculo, estados, nós alcançáveis e pares locais por EntryId.
Os testes TypeScript comparam todos esses resultados, além de asserts semânticos
independentes para topo da pilha, callers distintos, boundaries, fallback, resume
vazio, unwind 0/1/excessivo/maior que 64 bits, ciclos, recursão e isolamento de entradas.
Mutantes de IDs, destinos, ports, saídas inválidas, regras duplicadas/ausentes e versões
incompatíveis são recusados. Não há reconciliação por texto ou localização.

**Regressão do Osiris:** **145 testes unitários e 52 testes de browser passaram**.
`npm test`, `npm run build` e `npm run test:e2e` concluíram com exit code 0.
Os testes exercitam contratos legados, o COACTUPC novo, seleção/source/COPY, retornos,
export contextual, FILE, candidatos, aviso de percurso estrutural e limpeza de destaque.
Os relatórios ficam em `evidence/shared-routines-*.json`.

**Correção de apresentação e URL (30/09/2026):** 151 testes unitários passaram,
assim como os 18 testes de browser dos arquivos `shared-routines`, `example-selection`
e `explorer`. Build, formatação e `git diff --check` passaram. O COACTUPC alterna entre
3.065 e 3.132 nós, mantendo 3.827 transições; a busca de trechos encontra as 67 proteções
somente com a opção ativa. Foram conferidos inspeção bruta, retorno ao estado anterior,
refresh, importação, falha de carregamento e respostas fora de ordem. Os testes unitários
mantêm visíveis erros alcançáveis, verificam isolamento por entrada e preservam nós
ordinários inalcançáveis. Relatórios:
[`unitários`](../evidence/defensive-visibility-unit-final-20260930.json) e
[`browser`](../evidence/defensive-visibility-browser-20260930.json).
A primeira execução unitária, preservada em `defensive-visibility-unit-20260930.json`,
recusou um cenário de teste que associava saída excepcional a RETURN. O cenário foi
corrigido para OPAQUE, conforme o contrato; não houve mudança no analisador ou nos pacotes.

**Referência reutilizada, não executada aqui:** a campanha Stage 5 dos produtores
qualificou 560 casos e conservação de candidatos/provenance. Esse relatório orientou
os pins e os casos focais; não substitui os testes novos do Osiris. Como não houve
mudança em fonte de produtor, não repetimos FAST nem os 560 casos. Isso não constitui
aprovação ou merge dos PRs.

## Limites

1. A análise continua **PARTIAL**. Predicados de branches não são resolvidos; controle
   aberto, candidatos condicionais, premissas e `modelAssumed` conservam sua autoridade.
2. O regional v1 agrega observações RD dos chamadores, depois de avaliar cada contexto.
   Não publica uma observação por pilha. No CFG v5, **Iluminar valores** mostra o corredor
   estrutural com retornos correspondentes, mas não certifica onde um valor morre em
   cada chamador. O aviso é explícito; a UI não atribui kills a partir dessa união.
   As versões 1–4 mantêm o destaque de kills já validado.
3. Recursão de uma invocação simultaneamente ativa é recusada, como no perfil finito
   atual do analisador. Acima de 250.000 estados por entrada, o Osiris também recusa a
   publicação inteira com mensagem; não mostra uma exploração truncada como completa.
4. O arquivo experimental `shared-files` foi primeiro explorado com READ sem prova de
   conclusão/valores e depois ENDBR sem perfil físico. Esses runs são conservados como
   `shared-files-01`/`02` e não qualificam o cenário de valores. O pacote final usa ENDBR,
   perfil físico explícito e estado inicial; não houve correção manual de outputs.

## Gerar novamente

Os caminhos abaixo são os deste workspace. Em outra máquina, use checkouts nos SHAs
acima e ajuste os caminhos. O frontend precisa dos fontes ANTLR já gerados, Java 21+
e dependências Maven locais. Sempre escolha diretórios de saída novos.

```bash
python3 scripts/prepare_runtime.py --out .cache/runtime-shared-replay \
  --repo air-java=../.shared-routine-bodies/worktrees/air-java \
  --repo cobol-lower=../.shared-routine-bodies/worktrees/cobol-lower \
  --repo analysis-cfg=../.shared-routine-bodies/worktrees/analysis-cfg \
  --repo proleap-poc=../.carddemo-values-control/worktrees/proleap-poc

python3 scripts/analyze.py fixtures/shared-routines/shared-caller-values.cbl \
  --runtime .cache/runtime-shared-replay --out .local/shared-values-replay

python3 scripts/analyze.py fixtures/shared-routines/shared-files.cbl \
  --runtime .cache/runtime-shared-replay --out .local/shared-files-replay \
  --experimental-physical --storage-profile ibm-enterprise-6.4-fixed-display-1047@1 \
  --entry-storage-state initial --cics-entry-mode new-logical-level --logical-text disabled
```

Para COACTUPC, use o fonte CardDemo e os dez diretórios COPY explícitos registrados no
comando `frontend` do relatório de geração. `--copybooks` aceita repetição. `analyze.py`
empacota o fonte principal e `<preprocessed>`; inclua os COPYs desejados com os nomes
lógicos explícitos via `scripts/pack.py`. O pacote COACTUPC desta prévia já inclui os
16 COPYs reais necessários à navegação, além do fonte e expandido. Modelos sintéticos
IBM permanecem identificados como modelos na provenance.
