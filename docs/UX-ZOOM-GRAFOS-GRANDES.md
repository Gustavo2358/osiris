# Navegação e zoom em grafos grandes — 28/09/2026

## Problemas encontrados e correções

1. **Zoom perdia a referência do programa depois de um deslocamento longo.**
   O arrasto do OrbitControls ocorre no plano da tela. Com a câmera inclinada,
   seu ponto de rotação também saía do plano do grafo. Na reprodução com as
   100 rotas (503 caixas), esse ponto chegou a `z=-8038.30`, embora os nós
   permanecessem em `z=0`. Aproximar a câmera desse ponto não significava
   aproximá-la do programa. Agora, ao terminar o arrasto, o ponto é recolocado
   no plano do grafo ao longo da direção atual da câmera. Isso preserva a
   imagem, a orientação e a seleção.

2. **A roda aproximava devagar e não acompanhava o trecho apontado.**
   Um evento de roda de 120 pixels ampliava cerca de 6%; agora amplia cerca de
   27%, em torno da posição do cursor. Botões e teclado aproximam em torno do
   centro visível. Deltas pequenos de trackpad continuam graduais, e eventos
   consecutivos são agrupados por frame. A câmera não atravessa o plano.
   O comportamento funciona dos dois lados. Em vista quase paralela, usa-se
   o plano de foco atual para evitar uma interseção numericamente instável;
   **Vista frontal** continua disponível.

3. **Chegar à escala de leitura exigia muitos movimentos.**
   Duplo clique numa caixa agora aproxima para leitura. Clique simples continua
   apenas selecionando. O botão **Ler seleção de perto** permanece disponível.
   A dica abaixo do grafo foi atualizada.

4. **Uma animação podia disputar a câmera com o usuário.**
   O movimento de aproximação para leitura podia continuar durante um arrasto
   iniciado logo depois. O início da interação interrompe a animação na pose
   atual. As caixas acessíveis por teclado também atualizam suas posições ao
   terminar o arrasto, sem aguardar o próximo intervalo de atualização.

5. **Havia trabalho repetido desnecessário durante a navegação.**
   A biblioteca procurava interseções com nós e arestas até 20 vezes por segundo,
   mesmo com a câmera se movendo. A aplicação já fazia sua própria seleção
   precisa no clique. Agora a informação de hover é calculada quando o ponteiro
   para; cliques continuam usando a câmera atual. Texturas de texto são
   reaproveitadas num cache limitado a 128, em vez de destruídas imediatamente
   ao sair da tela. O conteúdo dos nós e das arestas continua acessível.

## Validação

- A reprodução anterior falha com o pivô a 8.038 unidades do plano:
  [resultado anterior](../evidence/large-navigation-before-20260928.json).
- O mesmo teste passa após a correção. Verificações específicas cobrem
  deslocamento superior a 10.000 unidades, zoom no último serviço (`SRV099`),
  permanência do ponto sob o cursor, retorno da câmera pelo histórico e duplo
  clique sem alterar as posições dos nós:
  [resultado corrigido](../evidence/large-navigation-after-20260928.json).
- Testes matemáticos verificam comportamento no início/fim da árvore, dos dois
  lados do plano, com pivô antigo fora do plano, em vista paralela e nos limites
  de aproximação e de deltas do trackpad.
- Testes existentes verificam órbita, pan, seleção, partículas, leitura, volta,
  billboards dos dois lados, destaques de valores e o COACTUPC.

A melhoria de controle foi medida por posição e escala da câmera, não por uma
promessa de FPS: desempenho gráfico também depende do hardware e do navegador.
Não há alteração em SP, AIR, CFG, dependencies ou nos repositórios do analisador.

Resultado final: 14 testes de câmera/layout, 3 testes específicos das 100 rotas
e 19 testes de regressão no navegador passaram. Build TypeScript/Vite aprovado.
Na aba aberta, a roda sobre SRV099 reduziu a distância ao plano de 420,11 para
330,47 unidades em um evento de 120 pixels, mantendo o pivô em z=0 e os 503 nós.
