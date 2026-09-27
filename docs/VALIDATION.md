# Validação — 26/09/2026 (America/Sao_Paulo)

## Resultado

Aplicação estática executável; fixtures gerados pelos produtores reais, sem alterações em seus repositórios. Cobertura `PARTIAL`, remainders e candidatos condicionais continuam explícitos. Esta validação qualifica o consumidor visual; não afirma completude semântica do analisador.

## Produtores

| Repositório | SHA usado |
|---|---|
| proleap-poc | `f33fae3b13edc8e2ba044e948836875fe55cb7de` |
| cobol-lower | `6486b36e701b7e280a5ca4e05df67f0882874ee5` |
| air-java | `59df1f7d6f3523b21b172a3ea4b5a0dc95128faa` |
| analysis-cfg | `10eae0c3d51ac9b3d01cad5261f0fc439c1bc30b` |
| analysis-ir | `2c7f31f19efbe3211a2aea5bbda90173a9666fe2` |

Checkouts limpos antes da execução e na conferência final. Sem troca de branch, commits, repins, instalação Maven, alterações de código ou roadmap nos produtores. O novo repositório é `cobol-graph-explorer`, sem remote.

Compilação auxiliar: 461 fontes Java dos produtores e do adapter, `javac --release 21`, Java Temurin 25.0.4. JARs externos existentes no cache Maven. Node 24.19.0. Os detalhes, hashes dos inputs e comandos estão nos arquivos `evidence/generation-*.json` e dentro de cada pacote. A compilação conjunta destina-se à geração dos exemplos; não é um gate de arquitetura dos produtores.

## Casos novos executados

Todos atravessaram frontend → lower público + links → CFG → dependencies. Os JSONs foram empacotados sem alterar os fatos; todos mantêm a cobertura publicada.

| Pacote | Nós / transições / sites | Exercitado |
|---|---:|---|
| order-router | 16 / 17 / 3 | IF/ELSE, PERFORM, GO TO, CALLs literais e dinâmico |
| goto | 10 / 10 / 1 | Desvios de branch e GO TO; candidatos executáveis PROGA e OTHER |
| perform | 10 / 9 / 2 | Mesmo paragraph chamado duas vezes; contextos separados; PROGA nas duas consultas |
| cics | 9 / 8 / 3 | LINK computed com DETAIL/SUMMARY; LINK literal AUDIT; XCTL MENU e controle aberto |
| large | 503 / 602 / 100 | 100 rotas numeradas, branches, busca de candidatos e navegação de grafos grandes |
| multi-call | 8 / 7 / 3 | CALLs PROGA, PROGB e PROGC com suportes reais |
| nested | 8 / 6 / 2 | Units aninhadas, MAIN homônimo, IDs de statements locais e entradas distintas |
| copy | 6 / 5 / 2 | Statements em CALLPART.cpy; nomes/spans originais e expandidos; linhas numeradas |
| cycle | 5 / 4 / 1 | GO TO para trás, CALL em ciclo, sem retorno fabricado |
| until | 8 / 8 / 1 | PERFORM WITH TEST AFTER UNTIL; branches e chamada após o laço |
| minimal | 3 / 2 / 0 | GOBACK; contrato CFG 1.0.0 |
| partial | 6 / 5 / 1 | DISPLAY observado/OPAQUE, aresta OPAQUE_JUMP; contrato CFG 3.0.0 |

Os dez primeiros usam CFG 2.0.0. SP corrente: 2.47.0; envelope de compilação: 1.0.0; AIR binding: 1.0.0 / semântica 2.0.0; dependencies: 2.6.0. Admissão de versões anteriores de SP/dependencies é conservadora por campos consumidos, mas não houve campanha completa de compatibilidade histórica.

O programa de escala é sintético, submetido aos produtores reais. Não foi usado como oráculo de completude COBOL. Os demais casos misturam fixtures existentes e fontes novos pequenos. A adaptação IF-GOTO/GOTO-CYCLE acrescenta sete espaços por linha em cópias próprias; os originais de teste do parser permaneceram intactos.

## Testes da aplicação

`npm run validate` executa:

1. **39 testes de modelo/contrato**: preservação de todos os nós, transições, StatementLinks e candidatos nos 12 pacotes; chamadas dinâmicas/literais; proveniência COPY; scopes de units/entradas; contextos PERFORM; ciclos; caminho mínimo; não fabricação de fallthrough; branchs de mesmo destino; rejeição de publicações, hashes, versões, links, destinos e JSON inválidos; modo AIR+CFG sem enriquecimento; Unicode escalar e carga de 503 nós.
2. **Build TypeScript + Vite**.
3. **7 testes E2E em Chromium** contra o build: candidates/provenance/fonte/internos, recorte de caminhos e witness, busca e paragraphs, escala com virtualização do DOM, troca de entrada aninhada, importação/erros preservando sessão, ausência de requests externos, teclado e largura de 800 px. Desktop: 1440 × 900.

A consulta de todos os 100 sites no grafo de 503 nós terminou em cerca de 0,3 s neste ambiente. O teste completo de navegação desse grafo no Chromium terminou em cerca de 4 s, incluindo carga, layout e recortes. São observações locais, não um SLA.

Verificação manual adicional no browser: leitura dos cartões, seleção de CALL, renderização do grafo, candidatos, provenance e layout de três painéis. O screenshot em `evidence/cics-paths.png` registra um recorte real.

O comando genérico `scripts/analyze.py` também foi executado para CICS-ROUTER, em `.local/cics-reproduction/`, passando pelas quatro etapas e produzindo um pacote importável.

## Limitações encontradas

### Fonte em formato livre

`ExplorerMain` configura `SourceNormalizer.SourceFormat.FIXED`. A tentativa de enviar diretamente `src/test/resources/cobol/goto/if-jump.cbl` sem área inicial foi recusada por indicador inválido na coluna 7. Formato livre não foi reivindicado como funcional pela CLI. A aplicação usa os spans dos artefatos e não interpreta formatos de fonte.

### Captura de dados em programas aninhados

O fixture upstream `proleap-poc/src/test/resources/cobol/resolution/nested-data-visibility.cbl`, enviado pelo envelope de compilação, falhou no lower com:

```
IllegalStateException: admitted source declaration lacks nominal object
  CompilationContext.captures → PartialProgramLowerer.fragment → CompilationLowerer.lower
```

A execução e o erro foram preservados em `evidence/generation-first-attempt.json`; o log bruto e SP estão em `.cache/runs/20260927T013335Z/nested/` (o caminho exato está no campo `run` da evidência caso varie no ambiente). Não há correção de produtor nesta entrega. O caso NESTED próprio, com duas units independentes e chamadas distintas, passou e comprova a separação de identidades no viewer; não resolve a limitação de capturas.

### Perfil e incerteza de valores

As execuções iniciais sem perfil de storage explícito e com logical-text desabilitado produziram CALLs computed com conjunto vazio e target aberto. A qualificação principal declara `ibm-enterprise-6.4-fixed-display-1047@1`, logical-text desabilitado, estado inicial e novo nível lógico CICS. Os resultados anteriores não foram editados ou convertidos em PASS; os diretórios das execuções são distintos.

Em ORDER-ROUTER, o produto executável publica BRANCH com remainder aberto; a evidência condicional de fonte publica também WEBORDER sob premissas. Ambos são apresentados com suas autoridades. O visualizador não adiciona candidatos à análise executável com base no código visível, nem fecha um conjunto parcial.

### Exportação e escopo do controle

A CLI do lower não exporta os links de apresentação; o adapter local é necessário para o join SP↔AIR exato. Não foi necessário modificar os produtores. O transporte legado do CFG não cobre todos os resultados `PARTIAL_ANALYSIS`; o viewer não supre um CFG ausente por inferência. Grafos acima de 503 nós não foram qualificados.

## Evidência reutilizada e gates não executados

- Reutilizados: fontes, fixtures, recursos ANTLR gerados e bibliotecas já disponíveis; o novo runtime e os produtos dos casos foram executados nesta sessão.
- Não reivindicados como novos: testes históricos dos produtores, qualification-local/full, corpus CardDemo completo, gates remotos.
- Motivo: o delta de produção está apenas no novo consumidor visual e em seu adapter de exportação. Nenhuma semântica do analisador foi alterada; a fronteira afetada foi validada por produtos reais, joins, rejeições e consultas.
- Testes/redes/builds da aplicação que falharam durante desenvolvimento foram corrigidos antes do gate final; não houve alteração de produtos brutos para obter PASS.
