# Verificação preliminar do enquadramento

Este resultado registra uma tentativa intermediária: 2 testes passaram e o teste do COACTUPC falhou porque exigia pixels de caixas quase brancos na visão geral. Com 3.048 nós, cada caixa tem tamanho inferior a um pixel nessa escala; a estrutura já aparecia pelas conexões, como mostra a imagem.

O teste final verifica caixas legíveis de perto e pixels das conexões na visão geral. A medição exclui a barra de ferramentas, o rodapé e a borda, pois capturas do canvas também incluem controles HTML sobrepostos. A inspeção visual revelou essa interferência no detector anterior.

A câmera também foi corrigida para manter seu alcance após a configuração assíncrona da biblioteca. Resultados finais: `../planar-browser-results.json` e `../planar-browser.log`. Nenhum fixture ou artefato do analisador foi alterado.
