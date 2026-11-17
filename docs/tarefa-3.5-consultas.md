# Tarefa 3.5 — Consultas autorizadas de chamados

Data: 13/11/2026. Branch `codex/etapa-3-chamados`, continuada por solicitação do usuário. Políticas de acesso autorizadas explicitamente nesta tarefa. Implementação registrada em commits locais autorizados, sem push, PR, deploy ou publicação no Linear. A alteração preexistente de `AGENTS.md` foi preservada. Nenhuma issue Linear associada.

## Comportamento e contratos

| Rota GET | Resultado |
| --- | --- |
| `/api/tickets/mine` | Somente chamados criados pela conta autenticada, inclusive destinados a outro setor |
| `/api/tickets/queue` | Somente chamados dos setores aos quais a conta pertence |
| `/api/tickets/{id}` | Detalhe para criador ou integrante do setor destinatário |
| `/api/tickets/{id}/activities` | Histórico paginado; criador externo vê somente SHARED; integrante vê também INTERNAL |

As listas aceitam `page` (1–100000, padrão 1), `pageSize` (1–100, padrão 25), `status`, `departmentId` e `assigneeId`. Histórico aceita somente os dois parâmetros de paginação. Resposta paginada: `{items,total,page,pageSize}`. Ordenação por `createdAt DESC, id DESC`, inclusive no histórico. Sem status explícito, listas excluem CLOSED; `status=CLOSED` consulta fechados. Detalhe continua acessível diretamente para um chamado fechado autorizado. Filtros não ampliam o acesso; fila sem vínculo ou com setor alheio retorna página vazia e total zero.

Parâmetros desconhecidos, repetidos ou inválidos são rejeitados com 400; IDs de detalhe/histórico exigem UUID. Item inexistente ou inacessível retorna o mesmo 404. Ausência de sessão, usuário inativo ou versão de autenticação revogada retornam 401. Respostas têm `Cache-Control: no-store`. O corpo e a query não podem escolher o criador autenticado.

Detalhes e itens seguem `ticketResponse`: criador e responsáveis expõem apenas id, nome e imagem, sem e-mail, credenciais ou versão de autenticação. Datas usam ISO; vencimento preserva a data sem conversão de fuso. Não são incluídos histórico interno, outbox ou chaves S3 no detalhe. Histórico tem contrato separado e filtro de visibilidade antes de contagem/paginação. Metadados/download de anexos conservam o contrato da 3.4; esta tarefa não cria uma listagem nova de anexos.

Administrador sem vínculo e pessoa cujo nome foi digitado não recebem acesso implícito. Remover vínculo ou transferir o chamado retira o acesso do antigo setor, salvo outro fundamento, como autoria. Conta ativa com vínculo preservado pode consultar o histórico de setor desativado, conforme a decisão da 3.1. Esta tarefa não implementa operações da 3.6 nem telas da 3.7.

## Consistência e limites

Cada consulta revalida usuário e `authVersion`, lê vínculos e consulta itens/contagem em uma transação PostgreSQL `RepeatableRead`. A identidade da sessão não carrega a decisão de acesso. A transação mantém uma visão consistente e não usa o lock global das mutações. Revogação efetivada antes do snapshot é observada; uma revogação posterior não cancela uma resposta já em andamento. Os testes verificam revogação entre requisições, sem afirmar cancelamento de leituras concorrentes.

Paginação por OFFSET mantém o contrato já aprovado na 3.2. Páginas profundas e contagens exatas podem custar mais conforme o volume. Ordenação estável resolve empates dentro da consulta, mas páginas requisitadas em instantes diferentes podem se deslocar após novas inserções. Capacidade sob carga e dimensionamento continuam para a 3.8; não foi adicionado índice ou migration por hipótese.

## Verificação executada

- Baseline: 28 testes de contratos, criação e rota POST passaram antes das alterações.
- RED: testes novos de integração e HTTP falharam pela ausência do módulo de consultas e das rotas, respectivamente. GREEN: oito integrações e cinco testes HTTP passaram após implementação.
- `node scripts/test-ticket-queries.mjs`: oito integrações em PostgreSQL sintético, incluindo acesso entre setores, administrador/terceiro, IDs e filtros, histórico interno, empates de ordenação, CLOSED explícito, responsáveis, remoção de vínculo, transferência, desativação, revogação e setor inativo. Banco verificado: `tickets35_test_8d177b418d93fe467df0`. Sem dados de produção ou S3.
- `docker exec cifradesk-etapa34-tools pnpm check`: lint e tipos aprovados; 59 testes passaram, 35 integrações explicitamente puladas nesse comando. Oito delas foram executadas pelo runner acima; 12 integrações de abertura/anexos e 15 de identidade não foram reexecutadas nesta tarefa.
- `docker exec cifradesk-etapa34-tools pnpm build`: web e worker aprovados; as quatro rotas novas constam no build.
- `git diff --check` e `git diff --no-index --check` para arquivos novos: sem erros de whitespace. Arquivos novos também foram lidos na revisão.

Falhas intermediárias corrigidas: infraestrutura tentou importar Zod sem dependência direta; a validação foi movida para os contratos existentes. Teste HTTP precisou resolver aliases via os mesmos mocks de importação usados no projeto. Nenhuma dependência foi adicionada. O Node padrão do host recusou executar por versão; somente a orquestração usou o Node empacotado no Codex, enquanto testes/check/build usaram a imagem local do projeto. A integração emitiu aviso de depreciação de chamadas `pg` concorrentes no mesmo client; não houve falha nem supressão do aviso, e não foi alterada a versão do driver.

EXPLAIN ANALYZE/BUFFERS em quatro chamados sintéticos confirmou índices por criador e histórico compartilhado; responsável/status usou o índice de responsável e a chave de vínculo, com Seq Scan na pequena tabela de chamados. São consultas representativas, não ensaio de carga nem prova de que o SQL completo do ORM terá esses mesmos planos. O runner preserva o banco/papel sintéticos para diagnóstico.

Como complemento, um diagnóstico local capturou 16 SELECTs distintos emitidos pelo Prisma durante `mine`, fila com responsável/status e histórico compartilhado (incluindo contagens e carregamento das relações), e executou EXPLAIN ANALYZE/BUFFERS com seus parâmetros sintéticos no banco `tickets35_test_6b85cfc37ffb97a87894`. Listagem/contagem do criador usaram `Ticket_createdById_createdAt_id_idx`; fila com responsável/status usou `Department_pkey`, `DepartmentMembership_pkey` e `TicketAssignee_userId_ticketId_idx`; o histórico real escolheu `TicketActivity_ticketId_createdAt_id_idx` com filtro de visibilidade. A diferença para o SQL representativo confirma que a escolha depende da consulta e da amostra. Evidência local ignorada pelo Git: `.local/query-plans35.log`; scripts de diagnóstico `.local/query-plans35.ts` e `.local/test-query-plans35.mjs`. Não alteram a configuração da aplicação e não leem segredos. Os planos reais foram inspecionados, mas quatro chamados não validam desempenho em volume; não foi forçado o uso de índices nem criada migration sem medição.

## Revisão e documentação

Revisão independente somente leitura examinou consultas, contratos, rotas, testes e runner e não identificou defeito bloqueante. A conferência final incluiu documentação e diagnóstico dos SELECTs reais, com decisão `READY_FOR_HUMAN_REVIEW` para a 3.5. Registrou os limites de snapshot, OFFSET/contagem e EXPLAIN com amostra pequena descritos acima. A revisão de implementação foi realizada sobre o working tree e não substitui a futura auditoria `main..HEAD` e do PR completo da etapa 3.

Documentos atualizados: este contrato/relatório, planejamento da etapa 3, plano principal, arquitetura e operação. Mais de cinco arquivos foram necessários para separar contratos, consultas, quatro rotas, testes, runner e documentos de referência. Não houve alteração de dependências, schema, infraestrutura de produção ou interface.

Roteiro manual, a executar em ambiente sintético com a API atualizada: autenticar criador de outro setor e conferir `mine`, `queue` vazia e detalhe; autenticar integrante e conferir fila/histórico interno; repetir com administrador sem vínculo (lista vazia/404); comparar páginas com `pageSize=1`, buscar CLOSED explicitamente e remover o vínculo antes de repetir a consulta. Esse roteiro não foi executado via navegador; a cobertura desta tarefa é integração de serviço e handlers HTTP.

## Minuta para Linear — não publicada

### O QUE E POR QUE

Minhas solicitações, fila, detalhe e histórico aplicam a matriz no servidor antes de contar/paginar. Reutilizam contratos e PostgreSQL, com snapshot por consulta para manter dados e acesso consistentes.

### ALERTA DO SÊNIOR

Revogação não cancela leitura já iniciada. OFFSET/contagens exigem medição sob carga; EXPLAIN sintético não demonstra capacidade. Revisão preliminar, sem auditoria de commits novos.

### FOCO DE REVISÃO

`packages/infrastructure/src/ticket-queries.ts` e `packages/infrastructure/src/ticket-queries.integration.test.ts`.

## Registro local autorizado

O usuário autorizou os três commits locais da 3.5 na mesma branch, mantendo a proibição de push/PR.

1. `09b9505 feat: consulta chamados com isolamento de acesso (etapa 3.5)`: contratos, serviço, exportação, integração e runner. Arquivos críticos: `ticket-queries.ts` e `ticket-queries.integration.test.ts`; testes acompanham a regra para manter o conjunto verificável.
2. `8d377f2 feat: expõe consultas paginadas de chamados (etapa 3.5)`: quatro rotas, helper e testes HTTP. Autorização e validações devem ser revisadas; não há boilerplate visual nesta tarefa.
3. `docs: registra consultas da etapa 3.5`: contratos, resultados e limites. Seu hash deve ser consultado no histórico, pois não pode constar no próprio conteúdo do commit.

Antes do primeiro commit, o índice foi exportado para `.local/commit-35-core`, sem os arquivos futuros de API. Um container temporário da imagem `cifradesk-toolchain:local` montou essa cópia em `/workspace`, com os volumes de dependências existentes. `pnpm db:generate` e `pnpm check` passaram: lint, tipos e 54 testes; 35 integrações explicitamente puladas. Não foi instalado pacote nem aplicado schema em banco de trabalho.

O segundo commit contém o código completo já validado com 59 testes, oito integrações executadas separadamente e build web/worker. O diff de código não sofreu alteração ao organizar os commits; as evidências anteriores foram preservadas. O terceiro commit altera somente documentação.

`git fetch origin main` confirmou `main` e `origin/main` em `7ddc3f343332a78a33015240b893dad4b9ae7892`, sem trocar de branch ou modificar a main. Diffs preparados conferidos sem erros de whitespace. A auditoria completa do histórico da etapa 3 e do futuro PR continua obrigatória antes da publicação. A alteração preexistente em `AGENTS.md` e os diagnósticos locais ignorados pelo Git não integram os commits.

Nenhum status foi alterado no Linear. Próximas tarefas: 3.6–3.8; a etapa 3 inteira não foi concluída. Sem push, PR ou deploy.
