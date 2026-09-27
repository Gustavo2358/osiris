# Discovery de usabilidade — 27/09/2026

## Método e escopo

Inspeção heurística do produto no commit `4caf7ed`, seguida de reprodução no navegador local e leitura dos componentes. Esta é uma avaliação técnica; não houve entrevistas nem testes com desenvolvedores externos. A lista abaixo foi registrada **antes das correções**. Prioridade alta significa perda de contexto ou bloqueio de navegação; média significa esforço de leitura ou orientação desnecessário.

Percursos: escolher arquivo CICS → consultar valores → caminhos → produtor → voltar; busca → troca de categoria; seleção após zoom; ajuda e abas pelo teclado. Dados: pacotes reais `files-values`, `order-router`, `nested`, `copy`, `large` (503 nós) e `perform`. Validação posterior inclui esses casos e os demais pacotes existentes.

## Falhas enumeradas e critérios de aceite

| ID | Prioridade | Evidência inicial / impacto | Correção e aceite |
|---|---|---|---|
| UX-01 | Alta | `files-values`: Caminhos até aqui → produtor ACCOUNTS volta a 8 trechos; Voltar retorna ao programa inteiro, pulando o recorte de 6. Navegação no fluxo também não guarda seleção. | Guardar seleção, recorte e viewport em cada salto; manter recorte quando destino pertence a ele; Voltar deve restaurar a investigação. |
| UX-02 | Alta | Zoom Out deixa escala 0,708333; selecionar produtor muda para 0,85. Falta ação explícita para reencontrar seleção após arrastar. | Preservar zoom entre seleções, disponibilizar Centralizar seleção e enquadramento do recorte com rótulos em português. |
| UX-03 | Média | Buscar ACCOUNTS em Arquivos e trocar para Paragraphs mantém o termo em outro contexto. Com outros termos, uma lista existente parece vazia. | Busca independente por categoria, contagem filtrada/total e recuperação explícita quando não há resultados. |
| UX-04 | Média | Em 1280×720, o acesso aparece como `EXEC CICS ENDBR FILE(FN...`; valores só no inspetor. ACCOUNTS oferece três links com o mesmo rótulo `computed-closed.cbl:17`, embora sejam spans diferentes. | Código legível em múltiplas linhas, localização/contexto e prévia de candidatos na lista; spans diferenciados por coluna nas evidências, sem deduplicação por texto ou perda de provenance. |
| UX-05 | Alta | Foco em Paragraphs + seta direita não muda de aba. Todos os botões de abas entram na sequência Tab e não apontam para seus painéis. | Abas do navegador e inspetor com setas, Home/End, um ponto de entrada por Tab e relações ARIA. |
| UX-06 | Alta | Abrir Ajuda + Esc mantém modal aberto. Overlay é uma section com aria-modal, sem isolamento nativo de foco. | Dialog modal, Esc fecha, Tab fica no diálogo e fechamento devolve foco a Ajuda sem acionar Voltar. |
| UX-07 | Média | Metadados de 9–10 px; legenda/lista/localização em cinzas claros (`#97a0af`, `#8d98a9`). Botão Limpar busca tem apenas o ícone de 13 px. | Aumentar texto de leitura, medir contraste de amostras reais (≥4,5:1), controles de ação ≥24×24 px, foco visível e revisão em 800/1280/1440 px. |
| UX-08 | Média | Em `nested`, entrada de 4 nós diz “4 de 8”, sem explicitar o denominador. Banner diz “até a seleção”, mas o destino da consulta permanece o anterior ao selecionar outro nó. | Contar trechos dentro da entrada, identificar entrada e destino fixo dos caminhos, permitir voltar ao destino; estados das ferramentas acessíveis. |

## Referências e aplicação

- [Nielsen Norman Group — 10 heurísticas](https://www.nngroup.com/articles/ten-usability-heuristics/): controle e liberdade, visibilidade do estado e reconhecimento orientam UX-01 a UX-04 e UX-08. Aplicação: retorno reversível, contexto explícito e informação necessária junto à escolha.
- [W3C APG — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): UX-05, ativação automática com setas e painel associado.
- [W3C APG — Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): UX-06, foco contido, Esc e retorno ao acionador.
- [WCAG 2.2 — contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) e [tamanho de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): UX-07. A amostragem não constitui auditoria completa de conformidade WCAG.

## Execução

Estado inicial: oito falhas identificadas; implementação e verificação pendentes. Resultados serão acrescentados aqui, preservando as observações anteriores.

Nenhum produtor, contrato, pin ou artefato bruto será alterado para esta revisão de UX. Identidades, candidatos e fluxo continuam sendo os publicados pelo analisador.

### Achado adicional na revisão visual: UX-09

**Prioridade alta — painel de fonte cortado em janela baixa.** Ao validar `files-values` em 1280×720, com caminhos e código abertos, o mínimo de 180 px do grafo somado ao mínimo de 190 px do código ultrapassa a altura disponível. O contêiner usa `overflow: hidden`, tornando a parte inferior do painel inacessível. Registrado após as oito implementações, antes desta correção.

Aceite: as caixas do grafo e do código devem caber na área de trabalho em 1280×720, inclusive com o painel ampliado; deve ser possível alcançar GOBACK e a última linha. Em janelas ainda menores, a área composta deve permitir rolagem em vez de cortar conteúdo.


## Resultado da implementação

| ID | Estado | Verificação final |
|---|---|---|
| UX-01 | Corrigido | Produtor dentro do recorte o conserva; GOBACK fora dele abre o programa; Voltar recupera alvo, recorte e viewport exatos. |
| UX-02 | Corrigido | Seleção mantém a escala escolhida. Centralizar seleção e Enquadrar recorte disponíveis, com controles em português. |
| UX-03 | Corrigido | Busca independente para cada aba, contagem filtrada/total e Mostrar todos no estado vazio. |
| UX-04 | Corrigido | Lista com código em múltiplas linhas, arquivo/linha, valores e contexto quando publicado. Seis spans do exemplo FILE continuam distintos e identificados por colunas contadas a partir de 1, com o fim exclusivo/inclusivo normalizado apenas na apresentação. |
| UX-05 | Corrigido | Navegador e inspetor verificados com setas, Home/End, foco, tabIndex e painel associado. |
| UX-06 | Corrigido | Tab permanece no modal, Esc fecha sem desfazer o recorte e foco volta para Ajuda. O primeiro teste revelou que o diálogo nativo sozinho ainda permitia foco na UI do browser; a contenção explícita corrigiu isso. |
| UX-07 | Corrigido | Amostras de lista, localização e texto auxiliar com contraste ≥4,5:1. Limpar busca com 32×32 px. Sem rolagem horizontal da página em 800/1280/1440 px. |
| UX-08 | Corrigido | Entrada aninhada informa 4 de 4; banner conserva ENDBR enquanto o produtor é inspecionado e permite retornar ao destino. |
| UX-09 | Corrigido | Fonte antes ultrapassava o limite inferior por 48 px. Agora os dois painéis e os quatro controles cabem; Ctrl+End alcança GOBACK em 1280×720. |

### Evidências

- Discovery inicial separado da implementação no commit `2c6797d`.
- `evidence/ux-discovery-before.log` e `.json`: primeira reprodução automatizada. Cinco falhas de produto reproduzidas; UX-08 nessa rodada falhou por seletor ambíguo do próprio teste, corrigido antes da validação. A observação do denominador foi confirmada no código e no cenário final. UX-02 e UX-04 também foram observados manualmente no browser.
- `evidence/ux-revision-browser.log`: primeira integração, 18/19 cenários; registrou o foco escapando da ajuda.
- `evidence/ux-revision-validation.log`: 52 testes de modelo/contrato, TypeScript, build e 19 testes de navegador passando após correção do modal.
- `evidence/ux-09-before.log` e `ux-09-after.log`: reprodução e correção do corte de fonte.
- `evidence/ux-final-browser.log` e `ux-final-browser.json`: regressão final, **20 testes de navegador passando**, incluindo UX-09 e todos os fluxos anteriores.
- `evidence/ux-final-confirmation.log` e `.json`: 20/20 novamente após conferir a conversão de colunas com o intervalo real 22–42.
- `evidence/ux-list-final.png` e `ux-paths-source-final.png`: apresentação final; revisão interativa também feita no browser local. As imagens anteriores em `ux-list-1280.png` e `ux-paths-source-1280.png` foram preservadas.

### Limites e decisões

A avaliação foi heurística, com automação em Chromium e revisão visual. Não substitui observação de desenvolvedores COBOL usando o produto nem auditoria completa de acessibilidade. O grafo grande continua com renderização limitada à viewport; enquadrar 503 nós exige ampliar para ler. O histórico guarda até 30 passos na publicação aberta. Os limites do analisador descritos nos relatórios anteriores permanecem.

Os produtores e os pacotes reais não foram alterados. Os gates do analisador não foram repetidos: o delta está na apresentação e na navegação; os 52 testes preservam as fronteiras de identidades, controle e candidatos sobre os 16 pacotes reais.
