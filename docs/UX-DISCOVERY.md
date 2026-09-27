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
