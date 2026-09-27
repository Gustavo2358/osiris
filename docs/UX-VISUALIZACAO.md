# Visualização e navegação — 27/09/2026

Quatro ajustes solicitados durante a exploração do COACTUPC:

| Problema | Comportamento entregue |
| --- | --- |
| Pouca separação entre fundo e nós | Área do grafo escura, nós claros, seleção com contorno destacado, arestas e legendas adaptadas ao fundo. |
| Referências laterais não reencontram o código | Chamadas, arquivos e trechos enviam uma solicitação de navegação mesmo quando já estão selecionados. Paragraphs usam sua própria provenance para mostrar o início da região. O histórico restaura também o destino no fonte. |
| Excesso de informação durante a leitura | **Modo de visualização** mantém somente grafo, código e cabeçalho de 48 px. **Sair da visualização** ou Esc restaura as ferramentas. Seleção, recorte, zoom, abas e buscas permanecem disponíveis ao voltar. |
| Tamanhos fixos dos painéis | Divisória arrastável com captura do ponteiro, limites mínimos e ajuste por teclado. O código continua mostrando a seleção durante o redimensionamento quando **Acompanhar seleção** está ativo. |

A informação permanece acessível no modo completo. O modo compacto mantém o nome do programa e o tipo/tamanho do recorte para orientar a leitura. O botão Voltar continua disponível. Abrir o modo não consome o histórico nem altera o grafo.

## Operação

- Grafo à esquerda e código à direita, com divisória vertical. Arraste a barra para os lados para ajustar a largura de cada painel.
- Duplo clique ou Enter na barra restaura 58% para o grafo e 42% para o código.
- Setas ←/→ ajustam a divisão; Shift amplia o passo; Home/End levam aos limites.
- O botão de ampliar código usa a mesma divisória e restaura a proporção anterior ao reduzir.
- A proporção é mantida em memória durante a sessão, inclusive ao fechar e reabrir o fonte.
- Desativar **Acompanhar seleção** continua permitindo ler outro arquivo sem saltos. **Ir para a seleção no código** reativa o acompanhamento.

## Verificação inicial

`npm run validate`: **54 testes de modelo**, TypeScript/build e **25 testes Playwright** passaram. `npm run format:check` e `git diff --check` passaram.

Os quatro testes novos em `e2e/viewing.spec.ts` verificam contraste das cores renderizadas, navegação repetida para o mesmo site, início do paragraph, preservação do acompanhamento desativado, modo compacto, Esc, zoom e recorte preservados, arraste real do mouse, limites, teclado e restauração da proporção. Foram verificadas janelas de 800, 1280 e 1440 pixels de largura. O teste anterior de janela 1280 × 720 com caminhos e fonte também passou.

O cenário real em `e2e/carddemo.spec.ts` verifica agora o salto da lista para XCTL e FILE, o início de `9000-READ-ACCT`, entrada/saída do modo compacto e redimensionamento. Houve também inspeção visual e arraste pelo navegador local, com o COACTUPC aberto ao final.

Evidências:

- `evidence/viewing-validation.log`
- `evidence/viewing-browser-results.json`
- `evidence/viewing-mode.png`
- `evidence/carddemo-viewing.png`

A paleta foi verificada nos elementos renderizados pelos testes; isso não constitui uma auditoria completa de acessibilidade. Os produtos do analisador e os contratos de correlação não foram alterados.

## Ajuste posterior: divisão vertical e minimapa

A divisão agora usa a largura disponível, tanto na exploração completa quanto no modo de visualização. O ponteiro e as setas ←/→ acompanham a orientação vertical da divisória. Cada painel mantém ao menos 240 px quando há espaço; em áreas menores, a divisão se adapta sem ampliar a página. Os controles do fonte se ajustam à largura do próprio painel.

O minimapa mantém o fundo escuro com nós claros: cinza para fluxo, lilás para chamadas e verde para arquivos. A máscara fora da área visível passou de 70% para 16% de opacidade; o enquadramento tem contorno âmbar. No COACTUPC completo, os nós chegam a ocupar menos de um pixel. Um contorno de 1 px que não encolhe com a escala preserva sua visibilidade nesse caso.

Os testes de contraste incluem os nós dentro e fora da máscara. O cenário COACTUPC verifica também pixels da imagem efetivamente renderizada do minimapa, para detectar o desaparecimento de nós muito pequenos. Os testes de redimensionamento verificam alinhamento lado a lado, arraste lateral, teclado, limites e proporção nas larguras de 800, 1280 e 1440 px.

A primeira rodada registrou um timeout de 5 s na organização do exemplo de 503 nós. A espera inicial desse teste foi alinhada ao limite de 30 s já usado para aguardar o layout no mesmo cenário. O log e os resultados originais permanecem em `evidence/vertical-view-preliminary.log` e `evidence/vertical-view-preliminary-results.json`; a captura e o trace ficam em `.local/vertical-view-preliminary-timeout/`.

Verificação deste ajuste: **26 testes Playwright**, TypeScript/build, formatação e `git diff --check` passaram. Os **54 testes de modelo** passaram na rodada preliminar; o modelo não mudou entre as rodadas. Inspeção visual no navegador confirmou os painéis lado a lado, arraste lateral e o minimapa do COACTUPC completo.

Evidências desta revisão:

- `evidence/vertical-view-validation.log`
- `evidence/vertical-view-browser-results.json`
- `evidence/vertical-view.png`
- `evidence/carddemo-vertical-view.png`
