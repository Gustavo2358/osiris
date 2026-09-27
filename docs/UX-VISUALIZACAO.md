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

- Arraste a barra entre os painéis para aumentar o grafo ou o código.
- Duplo clique ou Enter na barra restaura 58% para o grafo e 42% para o código.
- Setas ↑/↓ ajustam a divisão; Shift amplia o passo; Home/End levam aos limites.
- O botão de ampliar código usa a mesma divisória e restaura a proporção anterior ao reduzir.
- A proporção é mantida em memória durante a sessão, inclusive ao fechar e reabrir o fonte.
- Desativar **Acompanhar seleção** continua permitindo ler outro arquivo sem saltos. **Ir para a seleção no código** reativa o acompanhamento.

## Verificação

`npm run validate`: **54 testes de modelo**, TypeScript/build e **25 testes Playwright** passaram. `npm run format:check` e `git diff --check` passaram.

Os quatro testes novos em `e2e/viewing.spec.ts` verificam contraste das cores renderizadas, navegação repetida para o mesmo site, início do paragraph, preservação do acompanhamento desativado, modo compacto, Esc, zoom e recorte preservados, arraste real do mouse, limites, teclado e restauração da proporção. Foram verificadas janelas de 800, 1280 e 1440 pixels de largura. O teste anterior de janela 1280 × 720 com caminhos e fonte também passou.

O cenário real em `e2e/carddemo.spec.ts` verifica agora o salto da lista para XCTL e FILE, o início de `9000-READ-ACCT`, entrada/saída do modo compacto e redimensionamento. Houve também inspeção visual e arraste pelo navegador local, com o COACTUPC aberto ao final.

Evidências:

- `evidence/viewing-validation.log`
- `evidence/viewing-browser-results.json`
- `evidence/viewing-mode.png`
- `evidence/carddemo-viewing.png`

A paleta foi verificada nos elementos renderizados pelos testes; isso não constitui uma auditoria completa de acessibilidade. Os produtos do analisador e os contratos de correlação não foram alterados.
