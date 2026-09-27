# Recursos de terceiros

Os fixtures do frontend incluídos nos pacotes provêm de `proleap-poc` (licença Apache 2.0, cópia em `ANALYZER-FIXTURES-LICENSE.txt`). O caminho original, SHA do repositório e hash do fonte são registrados na evidência dos pacotes. IF-GOTO e GOTO-CYCLE são cópias adaptadas para a entrada de formato fixo, com sete espaços de área inicial; os originais foram preservados.

Os demais fontes de demonstração em `fixtures/` foram criados para esta aplicação. `LARGE-ROUTER.cbl` é um programa COBOL sintético gerado pelo script de exemplos e submetido aos produtores reais.

React, 3d-force-graph (MIT), Three.js (MIT), d3-force-3d (MIT), Lucide, Vite, TypeScript e ferramentas de teste são dependências externas. Suas versões e licenças permanecem nos pacotes instalados e em `package-lock.json`. Não há assets remotos ou fontes web externas.

Os quatro pacotes `files-*` usam fixtures existentes em `analysis-cfg/analysis-adapters/src/test/resources/file-dependencies/`: `w8/computed-closed.cbl`, `w8/computed-partial.cbl` e `w2/multi-open.cbl`. Origem, SHA e comandos estão em `evidence/file-navigation-20260927.json`. Nenhum fonte produtor foi modificado.


O pacote `carddemo-coactupc` inclui COACTUPC e 16 copybooks do AWS CardDemo, preservados no corpus de `proleap-poc`. Origem: `aws-samples/aws-mainframe-modernization-carddemo`, commit `59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e`. Cópias da licença Apache 2.0 e do NOTICE da Amazon estão em `carddemo-licenses/`. Os fontes originais mantêm seus avisos de copyright. O fonte expandido é gerado pelo pré-processador. Hashes e proveniência em `evidence/carddemo-coactupc-execution.json`.
