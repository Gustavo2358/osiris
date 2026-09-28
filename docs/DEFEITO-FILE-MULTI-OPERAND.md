# Defeito: segundo arquivo de OPEN/CLOSE fica sem entrada no fluxo

Investigação de 27/09/2026. Workspace: `/home/gustavo/workspace/teste-e2e`.

## Revalidação com a pipeline atual — 27/09/2026

**O defeito continua reproduzível após as mudanças que conectaram o COACTUPC.** Uma nova execução de `multi-open.cbl`, em `.local/multi-open-current-20260927T215959Z/`, concluiu SP → AIR → CFG → dependencies com quatro códigos zero. Publicou novamente 27 nós, 30 transições e apenas 15 nós alcançáveis da entrada.

| Site | Alcançável | Arestas de entrada | Candidatos |
| --- | --- | ---: | --- |
| OPEN F | Sim | 1 | CLIENTDD |
| OPEN G | Não | 0 | nenhum |
| CLOSE F | Sim | 4 | CLIENTDD |
| CLOSE G | Não | 0 | nenhum |

Os inventários de nós e transições são iguais aos do exemplo `files-native` da UI, comparados campo a campo após remover somente o namespace da publicação (a publicação também permaneceu igual). A atualização de COACTUPC não corrigiu o encadeamento de vários arquivos numa única instrução OPEN/CLOSE.

Foram reutilizadas as classes recém-compiladas para COACTUPC após verificar os cinco pins, o estado limpo dos produtores e o hash de todos os 463 fontes Java do build. Os pins executados incluem `proleap-poc@313236603815cd8c4d7299ae366310a4292bc5ee`, `cobol-lower@da3325caa059a4beb7bd01f1fee262f9844725f2` e `analysis-cfg@50453b80f2cdac3239b7b77944c3546cdb8fc621`.

A travessia independente do CFG concordou com a alcançabilidade de dependencies; os hashes de SP/AIR dos links foram conferidos. Não houve alteração de produtores nem do pacote mostrado na UI. Não foram repetidos testes de UI ou gates gerais: esta rodada valida diretamente a propriedade no produto regenerado, cuja topologia coincide com a já exibida.

[Execução, pins, hashes e resultado por site](../evidence/multi-open-current-verification-20260927.json). As seções seguintes preservam a investigação original e suas evidências históricas.

## Resumo para o agente

Na fixture real `multi-open.cbl`, o programa executa `OPEN INPUT F OUTPUT G`, depois `CLOSE F G`, depois `GOBACK`. A pipeline emite quatro operações de arquivo na AIR, mas somente as operações de `F` são alcançáveis pela entrada do programa. As operações de `G` existem, com seus alvos literais resolvidos, porém não recebem nenhuma aresta de entrada no CFG publicado.

O defeito observado é de fluxo de controle. Ele também compromete resultados downstream: `dependencies.json` classifica `OPEN G` e `CLOSE G` como `UNREACHABLE_IN_MODEL` e publica listas de candidatos vazias, embora `G` esteja associado a `OTHERDD` na declaração e no alvo da operação AIR.

A investigação encontrou uma incompatibilidade entre a topologia de continuação publicada pelo frontend e a expansão de uma instrução em operações por arquivo no lowering. O frontend publica a continuação da instrução inteira para cada uso. O lowering emite os usos separadamente, mas consome aquela continuação diretamente, deixando de encadear o primeiro uso ao segundo.

O visualizador tornou o problema aparente; a desconexão já está nos artefatos recebidos. A fixture não usa copybooks, PERFORM, GO TO nem branches explícitos no fonte.

## Estado da evidência e limites

- Confirmado por inspeção dos SP/AIR/CFG/links/dependencies do exemplo servido pelo visualizador e por uma travessia independente das arestas do CFG.
- Confirmado no código: a continuação interna calculada para o próximo arquivo não é usada no ramo que consome a topologia publicada.
- Os trechos de `FileResourceLowering.java`, `FileControlLowering.java` e `ControlTopologySemantics.java` examinados não mudaram entre os pins da geração e os checkouts consultados.
- Esta investigação não regenerou a pipeline nos HEADs atuais e não implementou correção. Reexecutar o caso com builds atuais é um próximo passo necessário.
- A responsabilidade exata da correção de contrato deve ser decidida após ler os contratos vigentes de topologia e FILE. Não assumir que basta trocar um destino no lowering: há testes que exigem que a topologia publicada seja a autoridade executável.
- Não foi demonstrado que todos os programas com múltiplos arquivos, outros comandos FILE ou outros perfis sofram o mesmo problema. Esse alcance precisa ser investigado.

## 1. Fixture mínima existente

Arquivo no workspace:

```text
analysis-cfg/analysis-adapters/src/test/resources/file-dependencies/w2/multi-open.cbl
```

Conteúdo integral:

```cobol
       IDENTIFICATION DIVISION.
       PROGRAM-ID. FILETEST.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT F ASSIGN TO CLIENTDD.
           SELECT G ASSIGN TO OTHERDD.
       DATA DIVISION.
       FILE SECTION.
       FD F.
       01 R PIC X(8).
       FD G.
       01 S PIC X(8).
       PROCEDURE DIVISION.
           OPEN INPUT F OUTPUT G.
           CLOSE F G.
           GOBACK.
```

SHA-256 do fonte: `019161d383a3066b53415ca72f090d152f797151e1c0777e601e7ba442707316`.

No caminho normal, sem falhas de I/O, a sequência esperada é, omitindo blocos auxiliares:

```text
Entrada → OPEN F → OPEN G → CLOSE F → CLOSE G → GOBACK
```

O fluxo conhecido publicado permite:

```text
Entrada → OPEN F → CLOSE F → GOBACK
```

As operações de `G` têm seus próprios sucessores e blocos auxiliares, mas nenhuma aresta entra nessas operações. O problema não é apenas uma posição estranha no layout: elas não são alcançáveis a partir da entrada.

## 2. Onde encontrar os artefatos

Todos os caminhos abaixo são relativos ao workspace, salvo indicação contrária.

| Evidência | Caminho |
| --- | --- |
| Bundle autocontido servido pelo visualizador | `cobol-graph-explorer/public/examples/files-native.json.gz` |
| Execução original, comandos completos, pins e códigos de saída | `cobol-graph-explorer/.local/files-native-20260927/execution.json` |
| SP original | `cobol-graph-explorer/.local/files-native-20260927/sp/cobol-semantic-product.json` |
| AIR/CFG/dependencies/links | `cobol-graph-explorer/.local/files-native-20260927/{air,cfg,dependencies,links}.json` |
| Logs e source evidence | mesmo diretório `.local/files-native-20260927/` |
| Registro versionado da geração | `cobol-graph-explorer/evidence/file-navigation-20260927.json`, item com `example.id = files-native` |

O diretório `.local` é evidência local e pode não existir em outro checkout. O bundle versionado contém os cinco artefatos e o fonte. Seus campos `artifacts["sp.json"]`, `artifacts["air.json"]` etc. são **strings JSON**: é necessário decodificá-las depois de descomprimir e ler o envelope.

SHA-256 do bundle inspecionado: `812860a53759b1c276762c16ed6d1b9496b1671a8dc0ec569a9f7d41d963bd39`.

Pins registrados na geração, todos com working tree limpa naquele momento:

| Repositório | SHA |
| --- | --- |
| proleap-poc | `f33fae3b13edc8e2ba044e948836875fe55cb7de` |
| cobol-lower | `6486b36e701b7e280a5ca4e05df67f0882874ee5` |
| air-java | `59df1f7d6f3523b21b172a3ea4b5a0dc95128faa` |
| analysis-cfg | `10eae0c3d51ac9b3d01cad5261f0fc439c1bc30b` |
| analysis-ir | `2c7f31f19efbe3211a2aea5bbda90173a9666fe2` |

Os checkouts de implementação consultados estavam em `proleap-poc@22d37233373b9db691ba170d898b7523bfea5746` e `cobol-lower@83f11f13dd5e521382e4903c2d8bf9e92832f11a`. Esses SHAs não são os pins da execução original.

Metadados do caso: SP `2.41.0`, fileInventory `1.6.0`, AIR `2.0.0`, binding AIR JSON `1.0.0`, CFG `3.0.0`, `buildStatus = CFG_BUILT`, `projectionPolicy = KNOWN_SUBSET`, inventário `PARTIAL`, 27 nós e 30 transições. As quatro fases registradas terminaram com código zero. Isso comprova geração bem-sucedida de artefatos, não correção semântica do fluxo.

## 3. Identidades para rastrear sem heurísticas

Publicação: `c956b7b1bf42c4e128e97e944585b0d8`; unidade AIR: `unit`.

As identidades abaixo são `localId` dentro dessa publicação/unidade. Ao implementar joins, use a identidade completa, incluindo domínio e escopo aplicáveis. Não correlacione por título do nó, texto ou número de linha.

| Operação | Statement SP | OperationId.localId | Nó CFG | Reachability | Candidates |
| --- | --- | --- | --- | --- | --- |
| OPEN F | `statement:0`, ordinal 0 | `ba7912d0697b242def922fd934c46f85` | 11 | REACHABLE | CLIENTDD |
| OPEN G | `statement:0`, ordinal 1 | `ab1796d8d095fd63557ce69501f2ba53` | 4 | UNREACHABLE_IN_MODEL | vazio |
| CLOSE F | `statement:1`, ordinal 0 | `b041f278f2e2d6b35219a3a7c70004e9` | 13 | REACHABLE | CLIENTDD |
| CLOSE G | `statement:1`, ordinal 1 | `f409b58c3ba4a9385a61f8fd451393c3` | 19 | UNREACHABLE_IN_MODEL | vazio |

Labels AIR correspondentes:

| Operação | LabelId.localId |
| --- | --- |
| OPEN F | `80fc541061654c791f9de3ed24cb6251` |
| OPEN G | `34230b59880f515e539b699204d26cb7` |
| CLOSE F | `922aef9ead0e4063c3835fed371fce40` |
| CLOSE G | `c8e1fd52d2b7c944964a8b09da819062` |

Declarações: recurso `4d225131b54c34b24b20af8864e74e55` corresponde a `F/CLIENTDD`; recurso `88cce8e79900952ecabea58b6b22471e` corresponde a `G/OTHERDD`. Os vínculos em `fileDependencies.sites[].bindings` e as declarações comprovam a associação. `links.json` liga as operações aos statements SP; o CFG liga cada nó ao label e ao terminador AIR.

No CFG observado, a entrada é o nó 25; `GOBACK` é o nó 10; a saída normal é 26. Um caminho pelas alternativas de sucesso é:

```text
25 → 11 → 22 → 18 → 21 → 13 → 20 → 16 → 17 → 10 → 26
     OPEN F             CLOSE F                       saída
```

Os nós 4 e 19 têm grau de entrada zero. Os ordinais são evidência deste bundle e não devem ser fixados em testes para futuras publicações.

## 4. Causa localizada na composição SP → AIR

### 4.1 O frontend publica saída da instrução para cada uso

Em `proleap-poc/src/main/java/io/github/gustavo2358/cobolexplorer/ControlTopologySemantics.java`, método `fileRoutes()` (aproximadamente linhas 357–375), os destinos que não são HANDLER nem USE recebem:

```java
target = outcomes.get("outcome:" + id + "/normal").target();
```

O destino é publicado em um outcome cujo papel inclui o ordinal do uso: `file/<ordinal>/<event>/<destination-index>`.

No SP da fixture:

- `statement:0` é o OPEN; `statement:1` é o CLOSE; `statement:2` é o GOBACK.
- Para OPEN, tanto `file/0/SUCCESS/0` quanto `file/1/SUCCESS/0` apontam para `COMPLETE region:statement:0/file`; o `ordinaryDefault` dessa região aponta para `statement:1`.
- Para CLOSE, os papéis equivalentes apontam para `COMPLETE region:statement:1/file`; seu `ordinaryDefault` aponta para `statement:2`.
- Os destinos de `OTHER_ERROR` também apontam para a conclusão dessas regiões. Esse evento carrega `criticalExit = true`; não presumir que ele tenha a mesma semântica fechada do caminho de sucesso.

Portanto, a topologia não distingue uma continuação intermediária entre os arquivos da mesma instrução nesses outcomes.

### 4.2 O lowering calcula o próximo uso, mas esse destino é ignorado nesse ramo

Em `cobol-lower/core/src/main/java/io/github/gustavo2358/lower/application/FileResourceLowering.java`, método `sequences(...)` (aproximadamente linhas 44–51):

- Os usos de cada statement são ordenados por ordinal.
- Uma operação é emitida para cada uso.
- `next` é calculado como o label do próximo uso da mesma instrução; somente o último uso recebe o destino externo da instrução.
- Assim, existe cálculo explícito para encadear F → G.

Porém, os efeitos/rotas de controle são materializados por `FileControlLowering.after(...)`. Em `cobol-lower/core/src/main/java/io/github/gustavo2358/lower/application/FileControlLowering.java`, aproximadamente linhas 66–83:

```java
if (topology != null) {
    var target = topology.apply("file/" + use.ordinal() + "/" + route.event() + "/" + i);
    term = continuing(..., target, route.criticalExit());
}
// ...
if (topology == null) {
    // Emite a continuação que usa next.
}
```

Com topologia presente, o despacho usa o destino publicado e não a continuação interna `next`.

### 4.3 O binding resolve COMPLETE para o próximo statement

Ainda no pacote `io.github.gustavo2358.lower.application`:

- `TopologyProgramAssembler.append(...)`, aproximadamente linhas 169–174, chama `files.sequences(fact, normal, ids, role -> outcome(role, context, fact))`.
- `outcome(...)` busca o outcome do statement/papel e passa seu target para `destination(...)`.
- `TopologyBinding.resolve(...)`, aproximadamente linhas 49–56, resolve `COMPLETE` pela fronteira da região e por seu `ordinaryDefault`.

Nesse caso, o sucesso de OPEN F passa a CLOSE F, e o sucesso de CLOSE F passa a GOBACK. Os usos de G foram emitidos pelo loop, mas ficaram sem predecessores.

Esse encadeamento explica os artefatos observados. A correção precisa decidir como o contrato representa a progressão entre usos e a conclusão da instrução, preservando a autoridade da topologia e a semântica dos resultados de I/O.

## 5. Consequência em dependencies e confusão na interface

Em `analysis-cfg/analysis-dependencies/src/main/java/io/github/gustavo2358/analysis/dependencies/FileDependencyConsumer.java`, método `site(...)`, aproximadamente linhas 41–53, a criação de candidato literal exige que a alcançabilidade não seja `UNREACHABLE_IN_MODEL`.

Por isso os sites de G têm `candidates: []`. O alvo literal `OTHERDD` continua presente na AIR e na declaração. Corrigir apenas a exibição de candidatos ou forçar `REACHABLE` esconderia a causa.

Há também um problema independente de apresentação em `cobol-graph-explorer/src/model.ts`:

- Aproximadamente linhas 357–364: o título do nó vem do statement SP vinculado. Ambos os usos recebem `CLOSE F G`.
- Aproximadamente linhas 417–427: `contexts` conta todos os nós associados ao primeiro statement do nó. Os 12 nós do CLOSE incluem as duas operações de arquivo e dez blocos auxiliares, como decisões de resultado e efeitos/continuações.
- Assim, “Contexto 5/12” e “Contexto 10/12” não provam contextos diferentes de execução COBOL. Nos sites de dependencies deste caso, `context` é `null`.

A investigação do produtor deve partir das identidades. Uma melhoria posterior de UX pode distinguir `CLOSE · F` e `CLOSE · G`, preservando a instrução original como referência, e nomear os auxiliares pela sua função. Isso não corrige as arestas ausentes.

## 6. Confirmar o defeito sem executar novamente os produtores

Execute o comando abaixo em `cobol-graph-explorer`. Ele lê o bundle, cruza identidades de operação/recurso, percorre as arestas publicadas e mostra os quatro sites. Não altera arquivos.

```bash
python3 - <<'PY'
import collections
import gzip
import json

with gzip.open('public/examples/files-native.json.gz', 'rt') as f:
    bundle = json.load(f)
a = {name: json.loads(raw) for name, raw in bundle['artifacts'].items()}
cfg = a['cfg.json']
files = a['dependencies.json']['fileDependencies']

def entity(ref):
    return (ref['publication'], ref.get('unit'), ref['localId'])

def vertex(ref):
    return (ref['publication'], str(ref['ordinal']))

by_operation = {
    entity(n['terminator']['operation']): vertex(n['id'])
    for n in cfg['nodes'] if 'terminator' in n
}
declarations = {entity(d['id']): d for d in files['declarations']}
adj = collections.defaultdict(list)
incoming = collections.Counter()
for edge in cfg['transitions']:
    src, dst = vertex(edge['from']), vertex(edge['to'])
    adj[src].append(dst)
    incoming[dst] += 1
entries = [vertex(n['id']) for n in cfg['nodes'] if n['kind'] == 'ENTRY']
assert len(entries) == 1, 'Esta verificação pressupõe a entrada única da fixture'
seen = set(entries)
todo = collections.deque(entries)
while todo:
    for dst in adj[todo.popleft()]:
        if dst not in seen:
            seen.add(dst)
            todo.append(dst)

rows = []
for site in files['sites']:
    node = by_operation[entity(site['operation'])]
    assert len(site['bindings']) == 1
    declaration = declarations[entity(site['bindings'][0]['declaration'])]
    rows.append((site['action'], declaration['logicalFile'], node[1],
                 node in seen, incoming[node], site['reachability'],
                 [c['referenceName'] for c in site['candidates']]))
for row in sorted(rows):
    print(row)
assert len(rows) == 4
assert all(reached == (file == 'F') for _, file, _, reached, *_ in rows)
assert all(count == 0 for _, file, _, _, count, *_ in rows if file == 'G')
PY
```

Saída confirmada no bundle investigado:

```text
('close', 'F', '13', True, 4, 'REACHABLE', ['CLIENTDD'])
('close', 'G', '19', False, 0, 'UNREACHABLE_IN_MODEL', [])
('open', 'F', '11', True, 1, 'REACHABLE', ['CLIENTDD'])
('open', 'G', '4', False, 0, 'UNREACHABLE_IN_MODEL', [])
```

Os quatro predecessores de CLOSE F incluem caminhos originados dos dois usos de OPEN. Isso não torna OPEN G alcançável: uma aresta de um nó inalcançável para um nó alcançável não cria um caminho no sentido inverso.

## 7. Regenerar com os checkouts atuais

Antes de atuar, ler os `AGENTS.md` de cada repositório envolvido e os contratos vigentes. Preservar os artefatos acima e registrar os novos SHAs. O comando abaixo é um procedimento de reprodução proposto; não foi executado nesta investigação.

O visualizador possui um utilitário que compila os fontes dos produtores em seu próprio cache e invoca seus entrypoints reais. Ele depende de JDK compatível, jars Maven locais e fontes ANTLR já gerados no frontend; ver `scripts/prepare_runtime.py`. A preparação substitui o runtime em `.cache/runtime`, mas não os artefatos históricos em `.local`.

Em `cobol-graph-explorer`, com esses pré-requisitos atendidos:

```bash
python3 scripts/prepare_runtime.py
python3 scripts/analyze.py \
  ../analysis-cfg/analysis-adapters/src/test/resources/file-dependencies/w2/multi-open.cbl \
  --out .local/multi-open-topology-investigation-01 \
  --storage-profile ibm-enterprise-6.4-fixed-display-1047@1 \
  --entry-storage-state initial \
  --cics-entry-mode new-logical-level \
  --logical-text disabled
```

Escolher outro diretório de saída caso ele já exista. O script recusa substituir evidência existente. Não é necessário adicionar copybooks à fixture.

Inspecionar os novos `execution.json`, logs, SP, AIR, CFG, dependencies e links. Adaptar a leitura do passo anterior para o novo `bundle.json.gz`. Os asserts finais daquele comando descrevem o defeito original; para verificar uma correção, substituir por expectativas semânticas corretas.

## 8. Perguntas e critérios para a investigação/correção

1. Confirmar a semântica dos comandos com vários operandos no dialeto configurado e como o contrato pretende representar a ordem dos usos. O caminho normal deve incluir ambos os arquivos antes de passar ao próximo statement.
2. Determinar se o SP precisa publicar destinos entre usos, se o lowering deve tratar a topologia como conclusão do statement após a cadeia interna, ou se existe outra composição prevista no contrato. Não introduzir reconstrução por texto/linha.
3. Distinguir continuação interna, término da instrução, handlers/declaratives e saídas críticas. Não trocar todos os destinos por `next` indiscriminadamente.
4. Adicionar um teste que falhe pela alcançabilidade e ordem dos usos, não apenas pela quantidade de operações emitidas. Verificar quatro sites com identidades distintas, vínculos F/G corretos e progressão no caminho normal.
5. Cobrir pelo menos dois e três arquivos, OPEN com modos diferentes, CLOSE múltiplo e controle com um arquivo. Investigar erro de I/O, FILE STATUS/handlers quando aplicáveis e instruções em contexto de PERFORM sem fabricar retornos.
6. Após a correção, confirmar que CFG preserva as transições AIR e que dependencies publica os candidatos `CLIENTDD` e `OTHERDD` nos respectivos sites alcançáveis. Manter gaps/remainders reais; não transformar PARTIAL em completo sem evidência.
7. Preservar os testes de autoridade da topologia. Pontos de partida: `proleap-poc/src/test/java/io/github/gustavo2358/cobolexplorer/FileTopologyAuthorityTest.java` e `cobol-lower/adapters/src/test/java/io/github/gustavo2358/lower/adapters/testing/FileTopologyAuthoritySuite.java`. Para operações FILE, consultar também `FileNativeOperationSuite.java` no mesmo diretório do lowering.
8. Verificar se outros comandos com vários usos compartilham o ramo afetado. Relatar o alcance demonstrado pelos testes, sem generalizar a partir desta única fixture.

Critério central de conclusão: no cenário normal dessa fixture, ambos os arquivos devem participar do fluxo na ordem prevista pela semântica, sem saltos que pulem o segundo operando. Os fatos de controle, as identidades e a provenance precisam permanecer coerentes nas fronteiras SP → AIR → CFG → dependencies. Ajustar somente o layout, renomear os nós ou preencher candidatos artificialmente não resolve o defeito.
