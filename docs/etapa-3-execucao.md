# Etapa 3.8 — Validação da entrega de chamados

Data: 16/11/2026. Branch: `codex/etapa-3-chamados`. Base local e remota conferidas por `git fetch origin main`: `7ddc3f343332a78a33015240b893dad4b9ae7892`. HEAD inicial: `ee98150`. **READY_FOR_HUMAN_REVIEW para a validação local da 3.8.** Dois commits locais autorizados pelo usuário, incluindo a alteração preexistente de `AGENTS.md` no commit documental. Sem push, PR, merge, deploy ou publicação no Linear. O conteúdo preexistente de `AGENTS.md` foi preservado integralmente.

## Escopo e critérios

Regressão conjunta das tarefas 3.2–3.7, cobertura adicional de duas sessões reais, revogação administrativa e volume sintético. A implementação de negócio permanece a mesma. O runner `scripts/test-stage-three.mjs` executa sequencialmente identidade, persistência, abertura/anexos, consultas e operações, interrompendo na primeira falha. O runner de interface aceita `--all` para incluir identidade e fundação visual.

O teste de volume acrescenta 2.000 chamados, páginas 1 e 100, filtro de responsável/status, negativa para terceiro e remoção de 250 atribuições em três lotes, conferindo versão, histórico, outbox e perda de acesso. É uma medição funcional local; não mede capacidade sustentada, concorrência de muitos usuários, percentis, recuperação ou produção. As referências anteriores a carga na 3.8 são atendidas somente por essa amostra delimitada; ensaios de capacidade/recuperação permanecem na etapa 8 do plano principal.

## Evidências executadas

| Comando | Resultado |
| --- | --- |
| `docker exec cifradesk-etapa34-tools pnpm db:generate` | Schema válido e Prisma Client gerado |
| `docker exec cifradesk-etapa34-tools pnpm check` | Lint sem avisos, tipos e 75 unitários aprovados; 47 integrações puladas, executadas separadamente |
| `node scripts/test-stage-three.mjs` | Identidade 15/15; persistência fresh/upgrade com 12 inserções concorrentes por base; abertura/anexos 12/12; consultas 11/11; operações 8/8 |
| `node scripts/test-ticket-queries.mjs` após acrescentar volume | 12/12; três consultas em 57 ms; remoção de 250 atribuições em 1.207 ms |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker aprovados |
| `node scripts/test-ticket-interface.mjs --all` | 50/50 E2E aprovados em 2,3 min; Chromium desktop/celular, zero retries |
| `git diff --check` e `git diff main..HEAD --check` | Sem erros de whitespace; avisos locais de conversão LF/CRLF |

O runner agregado foi executado antes da inclusão do teste de volume; a reexecução específica completa as **47 integrações** (15 + 12 + 12 + 8). Não somar as duas rodadas de consultas como testes distintos. Persistência SQL é verificação adicional fora da contagem Vitest.

Bases sintéticas da rodada agregada: `tickets_test_2503c11d184942fda41f304b9e36e667` (fresh), `tickets_test_bbc9f1beef9344548747f96460378ef5` (upgrade), `tickets34_test_bc1f20dc0d688fcd7734`, `tickets35_test_3ebe995da873d784bc96`, `tickets36_test_3bcc157f975ef19f709e`. Identidade usa `identity_test` no serviço exclusivo `identity-postgres`. Dados e buckets sintéticos permanecem para diagnóstico.

Volume: `tickets35_test_359e68f9ea10ddf17299`. E2E: `tickets37_test_2af3e87f5b51b540ebc1`; log `.local/etapa38-e2e.log` e relatório `.local/ticket-ui-report-1361/index.html`. Servidor E2E encerrado e conferido após a execução. Os 50 casos são 20 de fundação visual, 14 de identidade e 16 de chamados. Incluem mesma conta solicitando/atendendo, criador acompanhando outro setor, terceiro negado, integrante operando, usuário desativado com sessão revogada e dois contextos autenticados recebendo sucesso/conflito sem segundo evento ou sobrescrita. Os testes novos passaram na primeira execução, sem correção de código de produção. Build registrado em `.local/etapa38-build.log`.

### TDD e preparação do ambiente

As evidências históricas de teste antes da implementação estão nos relatórios [3.2](tarefa-3.2-modelo-dados.md), [3.4](tarefa-3.4-abertura.md), [3.5](tarefa-3.5-consultas.md), [3.6](tarefa-3.6-operacoes.md) e [3.7](tarefa-3.7-interface.md). Não foram reconstruídas nem repetidas artificialmente as falhas RED. A 3.8 acrescenta testes de regressão para comportamento já implementado e orquestração; não altera comportamento de produção, portanto não exige uma falha funcional inventada antes dos novos testes.

Docker inicialmente desligado; aplicativo local iniciado. A configuração sintética `.local/identity-test.env` estava ausente: criada pelo script existente, sem exibir credenciais. Os serviços exclusivos de identidade foram iniciados, e somente `identity_test` recebeu as duas migrations existentes. O container de ferramentas foi conectado à rede desses serviços. Nenhuma migration no banco de trabalho.

O comando `node` do host apontava para uma versão exigida não instalada. Os runners que apenas orquestram Docker foram executados com o binário já instalado `C:\Users\DaniloHumberto\AppData\Local\Author Software\nvm\installs\v24.22.0\node.exe`; compilação, dependências e testes da aplicação continuam no container. Nenhuma dependência instalada ou atualizada.

Permanece o aviso preexistente de depreciação do driver `pg` sobre consultas concorrentes no mesmo client. Não houve falha de consulta nas integrações. Log local da rodada ampliada: `.local/etapa38-queries.log` (ignorado pelo Git).

## Revisão e limites

Revisão independente preliminar somente leitura examinou autorização, transações, concorrência, anexos, identidade e os novos testes/runners. Reavaliação final confirmou READY_FOR_HUMAN_REVIEW após conferir código, diff, documentação e logs locais de E2E, volume e build. Nenhum defeito bloqueante confirmado; não houve correção de produção necessária. Revisão não possui sandbox técnico somente leitura: a restrição é instrucional, e o revisor não editou arquivos.

Riscos residuais: lock global pode produzir contenção/timeout em volume maior; OFFSET e contagem exata têm custo crescente; recuperação de upload no navegador usa simulação, enquanto integração S3 real é verificada separadamente. Chromium desktop/celular não equivale a Safari/Firefox, leitor de tela ou ensaio de produção.

A revisão independente examinou o working tree antes dos commits. O commit de testes corresponde ao código validado; o commit documental não altera código executável. A auditoria completa do histórico `main..HEAD` e do diff real do único PR continua obrigatória antes da publicação. Etapa 3 não integrada à main nem encerrada.

## Documentação e validação manual

Planejamento da etapa, plano principal e operação acompanham este relatório. Arquitetura, contratos e permissões foram consultados e conservam o comportamento implementado: não houve alteração desses contratos na 3.8. Os relatórios anteriores preservam evidências históricas; este documento registra a regressão atual.

Roteiro humano: abrir para si/outro setor; acompanhar como solicitante; operar como integrante; tentar acessar como terceiro; editar em duas sessões e recarregar após 409; desativar integrante e conferir perda de acesso; reenviar anexo após falha e conferir download privado. Usar somente contas sintéticas e o ambiente isolado descrito em [operação](operations.md).

## Minuta para Linear — não publicada

### O QUE E POR QUE

Consolidada a regressão de chamados com runners existentes, sessões independentes e volume sintético. A menor solução adequada acrescenta cobertura sem mudar regras de negócio.

### ALERTA DO SÊNIOR

A medição local não elimina contenção do lock nem custo de páginas profundas. Upload no navegador é simulado, com S3 real testado separadamente. Publicação e auditoria após novos commits permanecem posteriores.

### FOCO DE REVISÃO

`tests/e2e/tickets.spec.ts` e `packages/infrastructure/src/ticket-queries.integration.test.ts`: conflito/revogação reais e consistência da remoção em lotes.

## Commits locais autorizados

1. `3ef6f97 test: consolida regressão de chamados (etapa 3.8)`: testes de volume/E2E e runners; testes de acesso e concorrência são críticos, não boilerplate.
2. `docs: registra validação de chamados (etapa 3.8)`: evidências, limites, reprodução e alteração preexistente de `AGENTS.md`, cuja inclusão foi autorizada explicitamente. O hash deste commit deve ser consultado no histórico, pois não pode constar no próprio conteúdo.

A conferência de registro confirmou main e origin/main na base indicada acima, sem troca de branch. As validações anteriores foram reaproveitadas porque o código executável permaneceu idêntico ao conjunto testado; não houve nova execução das suítes somente para criar os commits.
