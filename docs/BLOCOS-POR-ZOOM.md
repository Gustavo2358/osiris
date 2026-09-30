# Blocos sequenciais por zoom

**Blocos** compacta o grafo à distância e mostra os trechos individuais ao
aproximar. Clicar no resumo também abre a sequência; o botão funciona por
teclado. Desativar **Blocos** mantém a visão detalhada.

## Partição pelo fluxo

O agrupamento usa as identidades e as transições do CFG, sem comparar texto ou
linhas do fonte. Uma sequência cresce enquanto o nó atual tem exatamente uma
saída e o próximo tem exatamente uma entrada. A verificação usa as arestas
completas das entradas envolvidas, mesmo quando a tela mostra um recorte.

- MOVE, CALL, acessos a arquivos, PERFORM, entradas, retornos e limites de
  paragraph podem pertencer ao mesmo bloco quando o CFG os conecta em sequência.
- Uma decisão pode ser o último trecho do bloco: sua condição aparece no resumo,
  e todas as saídas conservam identidades, cores, setas e sentido publicados.
- Uma junção inicia outra sequência. Não se atravessa uma bifurcação nem uma
  junção para fundir caminhos diferentes.
- Saídas excepcionais e arestas paralelas também são alternativas de controle.
  Uma chamada com vários resultados pode, portanto, continuar sendo uma divisão.
- Um nó com controle aberto termina a sequência: o analisador admite
  continuações ainda não enumeradas. O resumo identifica esse limite.
- Units diferentes permanecem separadas. Um ciclo puramente sequencial conserva
  a transição que o fecha, desenhada como retorno ao próprio bloco.
- Contextos distintos do mesmo statement mantêm suas identidades. Nós internos
  podem conter várias operações AIR; a contagem do resumo é de trechos CFG.

A partição é maximal dentro desses limites e custa O(nós + arestas). Os grupos
são somente apresentação: consultas, exportação, seleção, provenance e análise
de valores continuam usando o modelo original.

## Compactação e navegação

O visualizador preserva o layout ELK de base e comprime as faixas vazias deixadas
pelas caixas ocultas, nos dois eixos. Caixas visíveis mantêm suas dimensões; a
transformação monotônica preserva a ordem, os segmentos ortogonais e as pontas
das rotas. Não é necessário executar novamente o ELK a cada movimento do mouse.
A distribuição resultante ainda depende do layout de base: faixas ocupadas por
outro caminho não são removidas.

O bloco aberto fecha abaixo de 140 px de largura projetada; fechado, abre acima
de 180 px. A faixa intermediária evita alternância repetida perto do limite.
Ao mudar a compactação, a câmera acompanha uma referência visível próxima ao
centro, preservando distância e orientação. Os textos continuam voltados para
a câmera. O histórico guarda também os blocos fechados para restaurar a vista.

Na visão geral, o bloco que contém a seleção recebe seu destaque; clicar no
resumo aproxima sem trocar silenciosamente o statement no inspetor. Navegar
para um membro pela barra lateral ou usar **Ler seleção de perto** expõe o
trecho. Definições, kills, destinos, limites da evidência e caminhos destacados
permanecem abertos para inspeção. Zoom ou arraste interrompem a abertura manual.

Resumos e trechos compartilham o limite de 128 texturas detalhadas. A geometria
só muda quando muda o conjunto de blocos abertos; o zoom não recalcula rotas em
cada quadro. Partículas acompanham as mesmas rotas visíveis.

## Exemplos reais

| Exemplo | Nós publicados | Blocos sequenciais | Caixas na visão geral |
|---|---:|---:|---:|
| COACTUPC | 5.037 | 889 | 2.324 |
| Desvio de controle | 10 | 3 | 4 |
| PERFORM repetido | 10 | 1 | 1 |
| 100 rotas de serviço | 503 | 200 | 300 |
| Roteamento de pedidos | 16 | 5 | 7 |

Os totais se referem ao programa inteiro, sem destaques. COACTUPC conserva seus
5.037 nós e 6.293 transições no modelo. Nenhum produtor da pipeline nem artefato
de exemplo precisou ser alterado.

## Validação

Testes unitários cobrem sequências maximais, decisões, junções, exceções,
controle aberto, arestas paralelas, recortes, units, paragraphs e ciclos. A
compactação é verificada quanto a ordem, dimensões das caixas, extremidades e
ortogonalidade das rotas. Os testes de navegador cobrem clique WebGL, zoom,
histórico, seleção, evidências e programas grandes.

A primeira implementação, que mantinha chamadas e paragraphs separados, tem
resultados preservados em `evidence/linear-blocks-*-20260928.json`. Na revisão,
o teste antigo de duplo clique exigia a posição desenhada imutável; passou a
verificar a posição no layout de base, já que a compactação agora muda a posição
desenhada. Também foi corrigida a interrupção da abertura por zoom manual e
restaurado o prazo de carregamento de 60 segundos para COACTUPC no novo helper
de testes. Os resultados iniciais estão em `evidence/compact-blocks-*-20260928.json`.

Na regressão completa apareceu também uma seleção isolada no COACTUPC que se
perdia durante a expansão automática. A aproximação agora restaura a geometria
antes de calcular o destino, inclusive quando a seleção não pertence a um
bloco. A evidência anterior à correção está em
`evidence/compact-blocks-before-reading-fix-20260928.json`.

A expansão também fica estável até o fim da aproximação animada, para evitar
que o fechamento de blocos distantes interrompa o duplo clique. A evidência
anterior está em `evidence/compact-blocks-before-animation-fix-20260928.json`.

Resultados finais:

- **111 testes unitários passaram.**
- **49 testes de navegador passaram na suíte completa**:
  [resultado bruto](../evidence/compact-blocks-browser-final-20260928.json).
- A limpeza da cena passou a limpar também sua lista de nós antes de reconstruir
  as posições, corrigindo uma tela branca no hot reload do Vite. Recarga do
  componente conferida na aba aberta, sem novo erro; troca repetida de programas
  revalidada após esse ajuste:
  [resultado](../evidence/compact-blocks-scene-lifecycle-20260928.json).
- Build de produção, formatação e `git diff --check` passaram. Permanece o aviso
  existente do Vite sobre o tamanho do bundle.
- Na conferência visual do desvio, a altura entre centros caiu de 1.216 para
  456 unidades do diagrama, com quatro caixas; o zoom revela os dez trechos.
