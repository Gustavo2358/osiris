# Definições dos valores possíveis

Selecione uma chamada e clique em **Iluminar definições dos valores** no inspetor.
O botão de cada candidato permite começar por um único valor. O seletor acima
do grafo alterna entre um valor e todos. O desenho e a posição das caixas são
preservados; definições ficam amarelas, o destino roxo e as transições destacadas
azul claro. As demais caixas continuam disponíveis com menos contraste.

**Enquadrar valores destacados** localiza o conjunto. Abra **Ver definições e
limites do destaque** para saltar ao fonte de cada definição. O destaque permanece
ao inspecionar um produtor. **Limpar destaque** remove o realce, e **Voltar/Esc**
restaura a investigação e a câmera anterior. No modo de visualização, o seletor
e a ação de limpar continuam disponíveis em uma faixa compacta.

## Autoridade e correlações

- Cada candidato usa exclusivamente seus próprios `supports` de dependencies.
  `VALUE_PRODUCER.producer` resolve OperationId completo para os nós do CFG,
  preservando publicação, unit e contextos distintos de PERFORM.
- Valores iniciais, como `COMEN01C` no COACTUPC, usam OperandId completo e
  correspondência com `Entry.state.conditions` da AIR. O owner compacto do binding
  AIR é expandido para a mesma identidade tipada de dependencies. O nó de entrada
  é a âncora do fluxo; a declaração `VALUE` é aberta pela provenance do suporte.
  Não se cria uma operação MOVE nem uma aresta entre declaração e entrada.
- `CALL_LITERAL`, `CICS_LITERAL` e `FILE_LITERAL` identificam o próprio uso.
  A interface explica que não existe atribuição anterior para esse suporte.
- A consulta considera apenas transições da entrada selecionada. Intersecta
  alcance a partir dos produtores alcançáveis com alcance reverso da chamada.
  O percurso termina no uso selecionado, sem seguir sua continuação em um ciclo.
  Não há enumeração de caminhos: são buscas em largura sobre o grafo publicado.
- As identidades e origens são usadas diretamente. Nenhuma associação usa texto,
  número de linha, ordem dos statements ou igualdade de nomes.

## Limite da interpretação

Com `value-flow.json`, o percurso consulta as definições que chegam antes e depois
de cada operação. No exemplo **Desvio de controle**, PROGA segue pelo braço que
preserva sua definição até CALL; o braço oposto fica vermelho até `MOVE 'PROGB'`
e termina nessa sobrescrita. O trecho seguinte não é destacado para esse produtor.
**Ver sobrescrita** abre o statement no código e permite inspecionar os fatos
BEFORE/AFTER que justificam o corte. O mesmo comportamento atende nomes FILE.

A comprovação exige um fato RD alcançável, com `unknownRemainder=false` e
`resolutionRemainder=false`, e a mesma definição com todas as suas regiões
contribuintes. Um kill é mostrado quando uma atribuição literal remove essa
definição integralmente num fato fechado. O vermelho marca a perda dessa definição
naquele ramo; não afirma que o mesmo texto nunca possa ser atribuído novamente.
Trechos compartilhados com um percurso que chega ao uso conservam a cor azul.

Fatos ausentes, abertos, indisponíveis e perdas parciais interrompem a confirmação
com uma marca laranja. Cópias e expressões que transferem um valor para outra
definição não são tratadas como kills. Quando não há uma definição inicial
correlacionável ao objeto consultado, permanece o percurso estrutural com aviso
explícito. Esse fallback também atende pacotes antigos sem o novo artefato.

Os nomes consultados nesta versão são leituras de objetos nomeados na AIR. Alvos
compostos, captura através de cópias entre objetos e outcomes excepcionais de
chamadas intermediárias ainda não têm percurso confirmado. Não se aplica o fato
NORMAL a uma saída excepcional. Essas limitações pertencem ao consumo do
visualizador; não significam ausência de APIs correspondentes no analisador.

A API declara `pathWitness=NOT_PROVIDED`. Os caminhos preservam a definição no
modelo de dados, mas **não comprovam a viabilidade das condições dos branches**.
A cobertura parcial da fonte e suas premissas continuam explícitas no inspetor.
Nenhuma nova aresta é inferida.

Produtores sem nó, definições desconexas, evidência condicional de fonte e controle
aberto têm mensagens próprias. Fonte condicional não cria arestas. Candidatos
publicados não tornam completos os conjuntos que conservam remainders abertos;
esses limites continuam no inspetor.

## Validação

Testes usam os pacotes reais `cics` (DETAIL/SUMMARY), `perform` (mesmo fonte em dois
contextos), `order-router` (CALL literal) e `carddemo-coactupc` (VALUE inicial).
Casos controlados verificam publicação incompatível, produtor ausente, suporte
condicional, desconexão e isolamento entre entradas. Testes de browser verificam
a seleção no grafo, alternância de valor, abertura do código, preservação do
layout/câmera, retorno por Esc e limpeza/restauração do destaque.

Os testes que carregam o pacote COACTUPC de 140 MiB têm timeout de 15 s, pois a
leitura e validação completas excedem 5 s quando executadas junto às demais suites.
As verificações e contagens dos artefatos permanecem integrais.


## Arquivos

Na aba **Arquivos**, selecione um acesso e use **Iluminar definições dos valores**
ou **Iluminar este valor**. As ações, o seletor de valores, o código fonte e a
limpeza do destaque são os mesmos das chamadas. A legenda identifica o destino
como **acesso ao arquivo**. Um nome literal não cria um caminho de atribuição;
valores iniciais usam a entrada como âncora e abrem a declaração pela provenance.

Validação específica: `files-values` (ACCOUNTS/CUSTOMER), `files-native`
(CLIENTDD literal), `files-unknown` (ausência de valores) e os 14 acessos FILE do
COACTUPC (valores iniciais). Testes de browser cobrem destaque conjunto e por
valor, abertura da atribuição no código, limpeza, retorno e nomes literais.


## Exportação dos fatos

`bridge/ExportValueFlow.java` chama a API pública `RegionalAnalysis.preparePartial`
em lote, com uma execução de RD e valores por publicação. Não modifica os
produtores. A consulta usa EntryId, OperationId e ObjectId completos. Os fatos
originais são escritos em `regional.json`, acompanhados do plano de consultas,
logs, hashes e pins do runtime em uma pasta nova.

O transporte `cobol-explorer-value-flow@1.0.0` contém metadados do resultado
regional, seu SHA-256, hash da AIR, cobertura por entrada e observações que
referenciam fatos RD compartilhados por índice. O conteúdo de cada fato RD é
copiado integralmente do resultado nativo; o adaptador não implementa regras de
transferência. A deduplicação reduz o tamanho do pacote COACTUPC: 21.588
observações compartilham oito fatos. O resultado regional completo fica na
pasta de evidência. O browser valida versão, hash, escopo dos pontos e índices.

`analyze.py` e `generate_examples.py` incluem o artefato automaticamente. Para
enriquecer um pacote existente sem regenerar SP/AIR/CFG/dependencies:

```bash
python3 scripts/value_flow.py public/examples/goto.json.gz \
  --out .local/definicoes-goto
```

Abra `.local/definicoes-goto/bundle.json.gz`. O comando preserva o pacote de
entrada como `input-bundle`; o destino precisa ser novo. Para empacotamento
manual, use `scripts/pack.py --value-flow run/value-flow.json` junto aos demais
argumentos. Nunca reformate a AIR após exportar seu hash.

### Qualificação de 28/09/2026

- `goto`: PROGA tem três transições no percurso preservado e uma no ramo que
  termina em PROGB. OTHER mantém suas duas transições até o CALL.
- `file-value-kill`: ACCOUNTS termina na atribuição de CUSTOMER no braço do IF;
  CUSTOMER continua até ENDBR. Fixture própria passou em SP → AIR → CFG →
  dependencies, com perfil IBM físico e `--experimental-physical` explícito.
- `value-copy-boundary`: SOURCE-NAME é copiado para TARGET-NAME; sobrescrever
  SOURCE-NAME não remove PROGA de TARGET-NAME. A interface usa fallback
  estrutural, sem atribuir um kill falso à origem.
- CICS, PERFORM repetido, GO TO cíclico e PERFORM UNTIL usam observações reais.
  Testes negativos cobrem fatos ausentes/abertos, contribuição parcial, hash
  incompatível, subject de outra publicação e índice de fato inválido.
- Todos os 17 pacotes anteriores foram enriquecidos preservando integralmente
  os artefatos existentes. As duas fixtures acima foram acrescentadas ao seletor.
- COACTUPC conserva 5.037 nós e 6.293 transições. Os valores de entrada têm fatos
  RD abertos nesse runtime: continua disponível o destaque estrutural, identificado
  como tal, sem inventar comprovação de kills.

O runtime utilizado é o snapshot já compilado em 27/09, registrado em cada pacote;
não se confunde com alterações posteriores dos checkouts. Pins e hashes estão em
[`evidence/value-flow-20260928.json`](../evidence/value-flow-20260928.json).
As tentativas iniciais das fixtures e seus logs permanecem em `.local`: v1
combinou opções incompatíveis de perfil; v2 tem fatos lógicos abertos; v3 executou
o perfil físico sem habilitar propagação, portanto sem candidatos; v4 habilitou
a opção oficial e gerou os pacotes de demonstração. Nenhum output foi corrigido à mão.

Resultado: 84 testes de modelo/contrato passaram, build TypeScript/Vite aprovado
e 19 testes de browser passaram (6 do destaque, 12 de navegação 3D e 1 do COACTUPC).
O build conserva o aviso já existente sobre o tamanho do chunk JavaScript.

## CFG v5: corpos compartilhados

As consultas regionais v1 não publicam a pilha do chamador em cada observação RD.
O analisador executa os transfers por contexto e depois reúne as observações. Essa união
não comprova a preservação de uma definição num chamador específico. Por isso, no v5,
o Osiris conserva candidatos/supports e calcula os percursos estruturais no grafo de
estados com retornos correspondentes, mas não atribui kills com essas observações agregadas.
O banner explica esse limite. A evidência RD bruta continua no pacote. As versões 1–4
mantêm o comportamento de sobrescritas já validado. [Detalhes](CFG-V5-ROTINAS-COMPARTILHADAS.md).
