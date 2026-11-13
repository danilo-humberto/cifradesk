# Tarefa 3.2 — Modelo de dados dos chamados

Status: **schema, migration e contratos implementados e revisados na branch `codex/etapa-3-chamados`; registrados em commits locais autorizados, sem push ou PR**.

Referência funcional: [decisões da tarefa 3.1 e planejamento da etapa 3](etapa-3-planejamento.md). Operações de banco foram autorizadas para o PostgreSQL local no Docker. A migration foi testada em bases sintéticas separadas dentro desse container; a base de uso `cifradesk` não foi modificada. O usuário autorizou os três commits locais, incluindo o planejamento preexistente, e determinou não fazer push nem abrir PR.

## Escopo e relações

Adicionar cinco tabelas, reutilizando `User` e `Department` existentes. Não alterar tabelas de autenticação, criar categorias ou participantes, nem antecipar tarefas independentes da etapa 5.

| Tabela proposta | Relações e finalidade |
| --- | --- |
| `Ticket` | Chamado vinculado ao criador, departamento de origem e setor atual de atendimento |
| `TicketAssignee` | Vários usuários responsáveis por chamado; cada par chamado/usuário é único |
| `TicketActivity` | Vários registros de histórico por chamado, com autor e visibilidade |
| `TicketAttachment` | Vários anexos por chamado, com autor do envio e estado de upload |
| `OutboxEvent` | Eventos duráveis associados ao chamado, para processamento posterior |

Os nomes são a proposta de representação no código. Tipos e nomes físicos finais devem respeitar os padrões do schema existente sem alterar o significado aprovado.

## Chamado — `Ticket`

| Campo | Representação e regra |
| --- | --- |
| `id` | UUID interno |
| `number` | Número sequencial global único; apresentação `CH-000123`, sem reiniciar por ano/setor |
| `title` | Texto obrigatório, 5–150 caracteres |
| `description` | Texto simples obrigatório, 10–10.000 caracteres |
| `createdById` | Referência ao usuário autenticado que criou o chamado, obtida da sessão |
| `requestedFor` | `SELF` ou `OTHER`, conforme opção do formulário |
| `requesterName` | Nome registrado na abertura; para outra pessoa, 3–150 caracteres; para si, obtido da conta no servidor |
| `originDepartmentId` | Referência ao departamento do criador selecionado na abertura |
| `originDepartmentName` | Nome do departamento preservado como estava na abertura |
| `departmentId` | Setor atual de atendimento; alterado na transferência |
| `status` | ABERTA, PENDENTE, EM PROGRESSO, FEITO, REVISÃO, BLOCKED ou FECHADA; padrão ABERTA |
| `priority` | Baixa, Normal, Alta ou Urgente; padrão Normal |
| `dueDate` | Data opcional, sem horário, interpretada em America/Sao_Paulo |
| `version` | Inteiro iniciado em 1; incrementado nas alterações para detectar concorrência |
| `createdAt`, `updatedAt` | Instantes de criação e última alteração em UTC |

Não duplicar imagens no chamado: avatares e nomes atuais dos responsáveis/criador vêm dos usuários. A coluna de nome da pessoa solicitante usa `requesterName`, não o nome atual do criador.

O departamento de origem é registro da abertura, distinto do setor de atendimento. Nome livre não cria conta nem concede acesso. O nome e departamento históricos não são reescritos após alterações no perfil ou renomeação do setor.

## Responsáveis — `TicketAssignee`

Campos: chamado, usuário responsável, usuário que atribuiu e instante da atribuição. A combinação chamado/usuário é única; referências devem existir.

A aplicação valida usuário ativo e vínculo com o setor destinatário na operação de gravação. Mudanças de vínculo, desativação e transferência devem preservar essa consistência também sob concorrência; uma consulta anterior isolada não basta.

Não impor no banco uma regra permanente de quantidade mínima de responsáveis por status: a desativação pode deixar um chamado sem responsável, preservando seu status conforme aprovado. Exigir responsável elegível ao entrar em EM PROGRESSO, REVISÃO ou FEITO e antes de continuar atendimento. Remoções ficam no histórico; não há participante separado.

## Histórico — `TicketActivity`

Campos: identificador, chamado, autor, ação, versão do chamado, alterações, justificativa quando aplicável, visibilidade e instante.

Uma ação pode produzir registros separados para conteúdo compartilhado e interno. Exemplo de transferência:

- Compartilhado: setor alterado de Financeiro para TI.
- Interno: justificativa da transferência.

Não misturar justificativa interna no conteúdo compartilhado. O servidor filtra a visibilidade antes da paginação e contagem. Resumo de solução é compartilhado; motivos operacionais e orientação de revisão são internos. Não oferecer edição ou exclusão do histórico pela interface.

Registrar mudanças de responsáveis, status e demais campos conforme a tarefa 3.1. Chamado, histórico e eventos correspondentes são gravados na mesma transação PostgreSQL; falha desfaz o conjunto.

## Anexos — `TicketAttachment`

Campos: identificador, chamado, autor do envio, nome original, chave privada do objeto, tipo, tamanho, estado do upload e datas. O arquivo fica no armazenamento privado; a tabela guarda seus metadados, não seu conteúdo nem URL pública permanente.

Estados aprovados: **aguardando envio, disponível, falhou e exclusão pendente**. Somente arquivos disponíveis e validados podem ser baixados, mediante autorização sobre o chamado.

Fluxo aprovado: criar primeiro o chamado e depois enviar anexos, na mesma jornada visual. Se um upload falhar, preservar o chamado, informar a falha e permitir nova tentativa. Não prometer uma transação única entre PostgreSQL e armazenamento de objetos.

Reservas de upload contam para o limite acumulado; reservar/verificar capacidade com controle concorrente evita ultrapassar o limite por envios simultâneos. Prever recuperação e limpeza de uploads incompletos, liberação de reservas e exclusão pendente na implementação do fluxo.

Limites existentes: 20 MB por arquivo, cinco por envio e 200 MB acumulados por chamado. Formatos: PDF, PNG, JPEG, TXT, CSV, DOCX e XLSX; não aceitar executáveis ou compactados. Anexos são opcionais. Não executar limpeza de dados reais por este planejamento.

## Eventos pendentes — `OutboxEvent`

Campos: identificador único, chamado, tipo de evento, versão do contrato, dados necessários e instante de criação. Exemplos previstos: `ticket.created.v1`, `ticket.assigned.v1` e `ticket.status_changed.v1`.

Persistir junto com chamado/histórico. A versão do contrato do evento é distinta da versão concorrente do chamado. Payload deve conter somente dados necessários ao processamento; não tratá-lo como resposta pública nem expor conteúdo interno pela interface.

Nesta tarefa preparar persistência, não entrega. Envio, tentativas, recuperação e controle de efeitos pertencem à etapa 6. Não adicionar um marcador de “entregue” ao apenas gravar ou enfileirar; evento persistido não significa notificação entregue.

## Oito decisões aprovadas

1. **Numeração:** sequência global com apresentação `CH-000123`; aceitar lacunas decorrentes de operações abortadas, sem tentar garantir continuidade absoluta.
2. **Exclusão:** sem exclusão definitiva de chamados nesta etapa. FECHADA preserva dados. Impedir exclusão em cascata de usuários/setores que apagaria esses registros; manter desativação.
3. **Dados da abertura:** preservar nome informado e nome do departamento, além das referências. Permissões dependem de vínculos atuais, não desses valores históricos.
4. **Histórico:** separar registros por visibilidade; sem edição/exclusão pela interface.
5. **Uploads:** criar chamado antes dos anexos; falhas não apagam chamado. Usar os quatro estados e contabilizar reservas no limite acumulado.
6. **Datas:** vencimento como data; demais instantes em UTC. Validar hoje/futuro ao definir ou alterar vencimento, sem restrição permanente que invalidaria uma data pelo passar do tempo.
7. **Responsáveis:** unicidade/referências no banco, elegibilidade validada na operação da aplicação. Não exigir quantidade mínima permanente por status.
8. **Outbox:** evento identificado e versionado na mesma transação; processamento e entrega posteriores.

## Índices e contratos

Prever unicidade do número; índices para consultas por criador, setor/status, vencimento, responsáveis por usuário e histórico por chamado/data. Ordenação paginada deve incluir desempate estável por identificador. Definir composição física de índices a partir das consultas, evitando índices redundantes e listas ilimitadas.

Contratos de entrada não permitem falsificar criador, versão persistida ou campos históricos obtidos da conta. Atualizações recebem a versão esperada; comparação e incremento são atômicos. Respostas distinguem nome informado, criador e responsáveis, e expõem somente o conteúdo autorizado. Contratos de datas não devem converter vencimento em outro dia por fuso.

## Critérios de aceite da implementação

- [x] Migration funciona em banco sintético vazio e sobre a migration atual de identidade, preservando usuários e vínculos.
- [x] Número único inclusive sob concorrência; responsáveis não se repetem; referências inválidas são rejeitadas.
- [x] Campos, defaults e limites correspondem à tarefa 3.1 e a este modelo; não existem categoria ou participante.
- [x] Dados históricos de abertura permanecem separados do perfil atual.
- [x] Histórico, metadados de anexos e eventos possuem os vínculos e estados previstos.
- [x] Índices previstos para consultas paginadas do escopo; geração Prisma e análise de tipos passam. Planos das consultas reais serão verificados na 3.5.
- [x] Testes de integridade registram falha esperada antes da implementação e resultado final real; cenários completos de serviços/uploads permanecem nas tarefas correspondentes.
- [x] Schema, migration e contratos revisados de forma independente, sem alterações em autenticação ou dados de produção.

## Implementação e verificação local — 13/11/2026

Arquivos centrais: `packages/database/prisma/schema.prisma`, migration `202611130001_tickets/migration.sql` e `packages/contracts/src/tickets.ts`. Os contratos são exportados pela raiz de `@cifradesk/contracts`, sem nova dependência.

Valores persistidos: `OPEN`, `PENDING`, `IN_PROGRESS`, `DONE`, `REVIEW`, `BLOCKED`, `CLOSED`, correspondendo à ordem dos status aprovados. Prioridades: `LOW`, `NORMAL`, `HIGH`, `URGENT`. A apresentação `CH-000123` é feita por `formatTicketNumber`; o banco usa uma sequência inteira global, com lacunas permitidas.

As cinco tabelas usam referências com exclusão restrita. IDs novos são UUIDs gerados pelo Prisma; SQL direto precisa fornecê-los. Referências a usuários/setores preservam o tipo `TEXT` existente. Datas de eventos usam `TIMESTAMPTZ(3)`; vencimento usa `DATE`, com contrato `YYYY-MM-DD`, sem conversão de fuso. Checks SQL protegem tamanhos, versões positivas, metadados e objetos JSON; devem ser preservados em migrations futuras, pois não são expressos pelo schema Prisma.

Índices incluem desempate por ID nas consultas de criador, setor/status, vencimento, histórico e anexos. Responsável/status depende de junção entre `TicketAssignee(userId,ticketId)` e chamado; os planos reais de consulta serão avaliados na 3.5. Dois índices de histórico atendem respectivamente leitura integral do setor e leitura filtrada por visibilidade.

Contratos estritos rejeitam identidade, snapshots e defaults forjados na abertura. Atualizações exigem `expectedVersion`; apenas os serviços futuros implementarão comparação/incremento atômicos, autorização, motivos condicionais, elegibilidade, vencimento hoje/futuro e filtros antes de paginação. Listagens limitam a página a 100 itens; ausência de filtro de status deve excluir `CLOSED` no serviço da 3.5. Respostas de anexos não contêm chave privada. Validação real do arquivo e reservas de 200 MB continuam na 3.4; esta etapa valida apenas metadados de arquivos de até 20 MiB e até cinco por envio. Histórico e outbox têm persistência, sem endpoint público ou entrega de notificações.

### Evidências e reprodução

- Baseline: `pnpm exec vitest run packages/core/src/identity.test.ts`: 5 testes aprovados.
- RED: testes de contratos falharam por módulo ausente; `node scripts/test-ticket-persistence.mjs --red` falhou com PostgreSQL `42P01`, tabela `Ticket` ausente.
- `pnpm db:generate`: validação Prisma e geração do client aprovadas, sem conexão ao banco.
- Primeira execução de `pnpm check`: lint e tipos aprovados, 19 testes aprovados e 15 integrações de identidade explicitamente puladas.
- Execução final de `pnpm check`: lint e tipos aprovados, 21 testes aprovados e as mesmas 15 integrações de identidade puladas. `git diff --check` sem erros.
- `pnpm build`: web compilou, mas worker falhou com TS2835 na exportação nova sem extensão ESM. Corrigido para `export * from './tickets.js'`; `pnpm --filter @cifradesk/worker build` passou em seguida. O build agregado não foi repetido; seus componentes foram verificados separadamente, e `pnpm check` foi reexecutado após a correção.
- `node scripts/test-ticket-persistence.mjs`: aprovado em banco vazio e atualização sobre identidade com usuários/vínculos sintéticos. Verificou defaults, checks, referências, unicidade, snapshots, data sem fuso, estados de anexos, rollback e 12 inserções concorrentes por cenário.
- Revisão independente concluída sem bloqueadores concretos. A hipótese de divergência Unicode foi descartada por execução independente no Zod instalado; testes de fronteira foram adicionados, sem alterar o contrato. São 14 testes de contratos aprovados na execução específica final.
- A segunda execução de persistência também passou nos dois cenários, incluindo rejeição de referências inválidas nas quatro tabelas filhas e rollback de chamado e histórico quando a outbox falha.

O script de persistência usa exclusivamente `cifradesk-local-postgres-1`, usuário `cifradesk`, e cria bases com prefixo `tickets_test_`. Não lê `.env`, não usa `DATABASE_URL`, não apaga bases nem acessa dados da aplicação. A conexão local do container foi conferida: papel com `CREATEDB`/superusuário. O teste usa privilégios administrativos apenas para criar suas bases; não comprova a política de permissões de produção. As bases permanecem para diagnóstico; limpeza exige autorização específica. O script aplica o SQL versionado com `psql`, não testa o registro `_prisma_migrations` do deploy Prisma.

Os comandos pnpm são executados na imagem `cifradesk-toolchain:local`, com Node 24.22.3 conferido, sem rede e reutilizando os volumes de dependências `cifradesk-identidade-*`. O Compose habitual não iniciou porque `BETTER_AUTH_SECRET` estava ausente; nenhuma configuração ou credencial foi alterada. O script que controla Docker foi executado com o Node local 24.22.0, sem dependências; é inferior ao mínimo 24.22.3 do projeto. Compilação, tipos e testes Vitest usam o runtime da imagem do projeto.

Verificação manual desta etapa: executar o script autorizado de persistência, conferir os dois resultados (`fresh` e `upgrade`) e revisar os três arquivos centrais. Não há tela nova para validar. Integração completa de identidade, E2E e fluxos de serviço/upload não foram executados nesta etapa.

### Commits locais autorizados

1. `d9667d6 feat: modela persistência de chamados (etapa 3.2)`: schema, migration e testes de integridade SQL. Migration é o arquivo crítico para invariantes persistidas. Uma cópia isolada do conteúdo deste commit passou em `pnpm db:generate` e `pnpm typecheck`, sem os contratos do commit seguinte.
2. `1321ae3 feat: define contratos de chamados (etapa 3.2)`: contratos, exportação e testes de validação. `tickets.ts` é crítico para os limites de entrada/saída; seus testes não são boilerplate. O código corresponde à execução final de `pnpm check` e ao build corrigido do worker registrados acima.
3. `docs: registra modelo e validação da etapa 3.2`: este registro, planejamento aprovado e evidências atualizadas nos três documentos. Incorporação do planejamento preexistente autorizada pelo usuário. Alteração preexistente em `AGENTS.md` fica fora.

A revisão independente foi realizada sobre os arquivos antes dos commits. O histórico local é conferido após registrar o conjunto; antes de futura publicação, atualizar a base e repetir a auditoria de `main..HEAD` e do diff previsto do PR. Não abrir PR parcial por tarefa; a entrega completa da etapa 3 permanece na mesma branch.
