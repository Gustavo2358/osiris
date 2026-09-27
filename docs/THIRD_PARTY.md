# Recursos de terceiros

Os fixtures do frontend incluídos nos pacotes provêm de `proleap-poc` (licença Apache 2.0, cópia em `ANALYZER-FIXTURES-LICENSE.txt`). O caminho original, SHA do repositório e hash do fonte são registrados na evidência dos pacotes. IF-GOTO e GOTO-CYCLE são cópias adaptadas para a entrada de formato fixo, com sete espaços de área inicial; os originais foram preservados.

Os demais fontes de demonstração em `fixtures/` foram criados para esta aplicação. `LARGE-ROUTER.cbl` é um programa COBOL sintético gerado pelo script de exemplos e submetido aos produtores reais.

React, React Flow, Lucide, Vite, TypeScript, ELK e ferramentas de teste são dependências externas. Suas versões e licenças permanecem nos pacotes instalados e em `package-lock.json`. Não há assets remotos ou fontes web externas.

Os quatro pacotes `files-*` usam fixtures existentes em `analysis-cfg/analysis-adapters/src/test/resources/file-dependencies/`: `w8/computed-closed.cbl`, `w8/computed-partial.cbl` e `w2/multi-open.cbl`. Origem, SHA e comandos estão em `evidence/file-navigation-20260927.json`. Nenhum fonte produtor foi modificado.
