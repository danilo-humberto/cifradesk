# CifraDesk — Plano de implementação

Data: 12/11/2026.

Status: etapas 0 e 1 concluídas. A fundação está registrada no commit a27668e; o relatório da etapa 1 preserva seu estado histórico anterior ao commit. Etapa 2 implementada e validada localmente em branch dedicada, com revisão independente e auditoria do histórico; commits, push e um único PR para main autorizados. A entrega segue para revisão humana do PR. Merge e produção permanecem pendentes de autorização própria. Ver [identidade](identity.md) e [evidências da etapa 2](etapa-2-execucao.md).

Este documento é a referência de escopo, arquitetura, etapas e critérios de aceite. Marcar itens somente após conclusão verificável. A aprovação do plano não substitui as autorizações específicas previstas nas instruções do projeto.

## 1. Objetivo e escopo

Construir um sistema interno de chamados e tarefas para aproximadamente 50 colaboradores, inspirado na experiência do ClickUp, com interface moderna e simples.

- Uma pessoa pode ser solicitante e receptora, inclusive no mesmo chamado.
- Solicitantes acompanham suas solicitações e conversam com os responsáveis.
- Setores acessam suas próprias demandas.
- Tarefas podem ser independentes ou vinculadas a chamados.
- Responsáveis definem datas previstas; não haverá SLA nesta versão.
- Interface com lista, Kanban, filtros, notificações e temas claro, escuro e automático.
- Aplicação e serviços executados em Docker Compose.

Fora da primeira versão: Gantt, controle de horas, SLA, automações configuráveis pelo usuário, relatórios avançados e integrações adicionais.

## 2. Decisões confirmadas e propostas

| Item | Definição | Situação |
| --- | --- | --- |
| Aplicação | Next.js com App Router e TypeScript | Aprovado |
| Interface | shadcn/ui e Tailwind CSS | Aprovado |
| Estado remoto no navegador | TanStack Query (React Query) | Confirmado |
| Banco | PostgreSQL | Aprovado |
| ORM | Prisma e migrations versionadas | Aprovado; versão na seção 12 |
| Cache no servidor | Redis dedicado (`redis-cache`) | Confirmado |
| Jobs assíncronos | BullMQ + Redis dedicado (`redis-queue`) | Aprovado; substitui RabbitMQ |
| Arquivos | SeaweedFS comunitário via S3 | Aprovado; imagem/versão na seção 12 |
| Execução | Docker Compose | Confirmado |
| Autenticação | Contas próprias: admin cadastra e-mail e envia convite para definição de senha | Confirmado |
| Arquitetura | Monólito modular com processos separados | Aprovado |
| Tempo real | SSE com atualização de consultas | Aprovado |

### Decisões aprovadas na etapa 0

- [x] Contas próprias, sem cadastro público. Admin cadastra e-mail; pessoa recebe convite e define senha antes de acessar.
- [x] Sessões com expiração absoluta de 7 dias; revogar ao desativar usuário, redefinir senha ou encerrar todas as sessões. Não renovar indefinidamente por atividade.
- [x] Recuperação de senha por link de uso único enviado por e-mail, válido por 1 hora.
- [x] Primeiro admin criado por comando local controlado, que cadastra seu e-mail e gera convite; sem senha padrão.
- [x] Limite acumulado de 200 MB de anexos por chamado ou tarefa, além dos limites por arquivo/envio.
- [x] Fuso dos lembretes: America/Sao_Paulo.
- [x] Adiar configurações exclusivas de produção até antes da publicação, mantendo desenvolvimento e testes locais.
- [x] Convites de uso único, validade de 48 horas e reenvio invalidando o anterior; token armazenado como hash. Mailpit em Docker para testes locais, sem envio real.
- [x] Pessoas de outros setores podem ser responsáveis por uma tarefa, com acesso somente ao item, sem acesso à fila inteira ou ao chamado de origem.
- [x] Solicitante externo ao setor apenas acompanha e conversa; não cancela, encerra nem reabre o chamado. Se também integrar o setor, conserva suas permissões de integrante.
- [x] Todos os integrantes do setor veem seus itens e têm todas as permissões operacionais, sem hierarquia de membro/gestor.
- [x] Admin mantém capacidade de administrar usuários, setores e categorias pelo sistema.
- [x] Tarefas podem ter vários responsáveis.
- [x] Mensagens compartilhadas e notas internas; tarefa entre setores não libera acesso automático ao chamado de origem.
- [x] Anexos: 20 MB por arquivo, até 5 por envio; PDF, PNG, JPEG, TXT, CSV, DOCX e XLSX; sem executáveis ou compactados; acesso privado.
- [x] Prazos por data e dias corridos; lembretes às 9h no dia anterior e no vencimento. Mudança de prazo substitui lembretes; conclusão/resolução/cancelamento interrompe os futuros. Sem avisos diários repetidos de atraso.
- [x] Stack da tabela acima aprovada no planejamento, incluindo Better Auth com Prisma e sessões no PostgreSQL.
- [x] Inicialmente somente testes locais. Destino futuro informado: Linode, Portainer no servidor da empresa e Caddy.
- [x] Backup diário de banco e anexos, cópia fora do servidor, retenção de backups de 30 dias, perda máxima pretendida de 24h e restauração em até 8h; demonstrar por ensaio.
- [x] Sem exclusão automática de chamados até definir retenção de negócio.
- [x] Metas: p95 de consultas e mutations até 1s (sem upload), atualização entre sessões até 3s; carga com 20 usuários ativos e teste adicional com 50; base sintética de 10 mil chamados e 100 mil mensagens.

Esses checks registram decisões, não implementação ou validação técnica concluída.

### Decisões pendentes

- [x] Better Auth aprovado, com Prisma e sessões no PostgreSQL.
- [ ] Definir SMTP/provedor e remetente de produção; Mailpit confirmado apenas para testes locais.
- [x] Escolher SeaweedFS comunitário e BullMQ com Redis separado do cache.
- [ ] Definir retenção definitiva de chamados/anexos antes da produção; sem exclusão automática por enquanto.
- [ ] Esclarecer topologia futura: aplicação/dados na Linode gerenciados pelo Portainer da empresa, ou serviços divididos entre hosts?
- [ ] Definir domínio, recursos e destino externo dos backups antes da publicação; não bloqueiam testes locais.
- [x] Consolidar versões diretas e imagens na seção 12; resolução transitiva será validada na etapa 1.

### Armazenamento escolhido

SeaweedFS comunitário via API S3. A aplicação usará bucket privado e autorização para acesso aos anexos. Imagem e versão constam na seção 12; a validação executável cobrirá upload, download, URLs assinadas, exclusão e restauração de dados e metadados. MinIO e Garage não integram a arquitetura escolhida.

### Encerramento da etapa 0

Better Auth aprovado; não restam decisões funcionais para o desenvolvimento local. Recuperação, sessões, primeiro admin, limite acumulado de anexos e fuso foram aprovados. A retenção definitiva foi adiada para antes da produção, sem exclusão automática por enquanto.

Preparação técnica consolidada na seção 12 por consulta aos registros oficiais e documentação. Compatibilidade declarada não equivale a instalação, build ou integração testada.

Pendências exclusivas de produção: SMTP/remetente, topologia Linode/Portainer, domínio, recursos, destino externo de backup e retenção definitiva. Adiamento aprovado; não impedem implementação e testes locais. A etapa 0 está concluída para planejamento local; as pendências de produção permanecem adiadas.

### Comparação das bibliotecas de autenticação

| Opção | Benefícios neste projeto | Trade-offs |
| --- | --- | --- |
| Better Auth | E-mail/senha, recuperação, sessões revogáveis, adapter Prisma e execução dentro do Next.js | Adaptar schema e fluxos aos contratos da biblioteca; convite administrativo de 48h é fluxo específico, separado do reset de 1h; configurar expiração absoluta e revogação sem cache obsoleto |
| Auth.js | Integração com Next.js e flexibilidade para provedores externos | Credentials não entrega persistência de senhas, recuperação e convites prontos; maior implementação própria para nosso ciclo de contas |
| SuperTokens | Solução dedicada com e-mail/senha, recuperação e sessões | Core adicional para operar em Docker; dados de autenticação gerenciados pelo Core e relacionados aos dados Prisma por identificador; maior custo operacional |

Escolha aprovada: Better Auth, adapter Prisma, PostgreSQL para sessões e interface própria com shadcn/ui. Manter Redis de cache fora da autoridade de autenticação. Cadastro público desabilitado no servidor; somente fluxo administrativo autorizado provisiona contas. Setores e autorização permanecem no domínio do CifraDesk, sem introduzir papéis operacionais da biblioteca.

O convite exige implementação específica e testes: usuário convidado não acessa o sistema antes de definir senha; token de convite de 48h não se confunde com reset de 1h; reenvio invalida o anterior; consumo atômico impede reutilização. Não presumir que plugin de convite para organizações implementa esse fluxo de conta.

Validar na versão escolhida: desabilitar renovação deslizante para respeitar os 7 dias absolutos, revogar sessões na recuperação/desativação e evitar cache de sessão que mantenha acesso após revogação. Usar APIs suportadas para credenciais, sem gravar hashes diretamente em tabelas internas. Ajustar o modelo conceitual à biblioteca antes das migrations.

Fontes: [Better Auth e-mail/senha](https://better-auth.com/docs/authentication/email-password), [sessões](https://better-auth.com/docs/concepts/session-management), [Prisma](https://better-auth.com/docs/adapters/prisma), [Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials), [SuperTokens](https://supertokens.com/docs).

## 3. Estrutura proposta do projeto

```text
cifradesk/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── (workspace)/
│   │   │   │   │   ├── my-work/
│   │   │   │   │   ├── requests/
│   │   │   │   │   ├── departments/
│   │   │   │   │   ├── notifications/
│   │   │   │   │   └── settings/
│   │   │   │   └── api/
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   └── layout/
│   │   │   ├── features/
│   │   │   │   ├── tickets/
│   │   │   │   ├── tasks/
│   │   │   │   ├── conversations/
│   │   │   │   └── notifications/
│   │   │   └── lib/
│   │   │       ├── auth/
│   │   │       └── query/
│   │   └── Dockerfile
│   └── worker/
│       ├── src/
│       │   ├── consumers/
│       │   ├── outbox/
│       │   ├── scheduler/
│       │   └── main.ts
│       └── Dockerfile
├── packages/
│   ├── core/
│   ├── contracts/
│   ├── database/
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts
│   └── infrastructure/
│       └── src/
│           ├── cache/
│           ├── messaging/
│           └── storage/
├── docker/
│   ├── proxy/
│   ├── redis-cache/
│   ├── redis-queue/
│   └── seaweedfs/
├── tests/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── plano-implementacao.md
│   ├── architecture.md
│   ├── permissions.md
│   └── operations.md
├── compose.yaml
├── compose.dev.yaml
├── .env.example
└── package.json
```

A estrutura acima é o destino proposto. A fundação implementa workspace, interface-base, processos-base e Docker. A etapa 2 acrescenta autenticação, setores e migrations; chamados e demais integrações permanecem nas etapas futuras. Consulte [arquitetura atual](architecture.md).

- `core`: casos de uso, autorização e regras de negócio compartilhadas.
- `contracts`: validação de entradas, DTOs e contratos versionados de eventos.
- `database`: modelo, migrations e dados sintéticos de desenvolvimento/teste.
- `infrastructure`: adaptadores de cache, mensageria e armazenamento.
- Endpoints validam entrada e sessão e chamam casos de uso; não duplicam regras.
- Código de banco, segredos e infraestrutura não pode ser importado pelo navegador.

## 4. Serviços Docker

| Serviço | Responsabilidade | Persistência |
| --- | --- | --- |
| `proxy` | Caddy: HTTPS e encaminhamento para Next.js | Certificados, quando aplicável |
| `web` | Interface, API e conexões SSE | Sem dados de negócio locais |
| `worker` | Executar jobs BullMQ idempotentes | Estado no PostgreSQL/redis-queue |
| `dispatcher` | Enfileirar outbox e reconciliar lembretes agendados | Estado no PostgreSQL |
| `postgres` | Dados transacionais | Volume próprio |
| `redis-cache` | Cache descartável, TTL e política de eviction própria | Sem dependência de persistência |
| `redis-queue` | Jobs BullMQ, sem eviction e com AOF | Volume próprio |
| `seaweedfs` | Anexos privados via S3 | Dados e metadados persistentes |
| `migrate` | Migrations controladas | Execução pontual |
| `storage-init` | Bucket privado e configuração inicial | Execução pontual |
| `mailpit` | Captura SMTP e interface de consulta dos e-mails de teste, somente local | Sem dependência de persistência |

`worker` e `dispatcher` usam a mesma imagem com comandos diferentes. A topologia inicial terá um servidor; não oferece alta disponibilidade.

- [ ] Criar rede de entrada e rede interna dos serviços.
- [ ] Expor apenas HTTPS no ambiente publicado.
- [ ] Liberar portas administrativas somente localmente no Compose de desenvolvimento.
- [ ] Configurar healthchecks, reconexão, reinício e encerramento gracioso.
- [ ] Fixar versões das imagens e dependências.
- [ ] Configurar credenciais específicas por serviço, fora do repositório.
- [ ] Configurar proxy para streaming SSE, incluindo buffering e timeouts.
- [ ] Isolar ambientes de desenvolvimento, testes e produção.
- [ ] Definir backup externo ao servidor e demonstrar restauração.

Volumes não substituem backup. Não executar migrations automaticamente em cada réplica da aplicação.

## 5. Modelo de dados

Chamados e tarefas serão tabelas separadas, com suas regras explícitas.

| Entidade | Campos principais |
| --- | --- |
| `users` | id, nome, e-mail único, estado (convidado/ativo/desativado), is_admin, tema, created_at, updated_at |
| `credentials` | usuário, hash da senha; formato depende da biblioteca selecionada |
| `invitations` | usuário, hash do token, expiração, utilização, revogação |
| `sessions` | usuário, sessão, expiração, revogação |
| `departments` | id, nome, ativo |
| `department_memberships` | usuário, setor; sem hierarquia de papéis |
| `categories` | setor, nome, ativo |
| `tickets` | id, número, título, descrição, solicitante, setor destinatário, responsável, categoria, status, prioridade, prazo, versão, datas |
| `ticket_participants` | chamado, usuário, papel de participação |
| `tasks` | id, título, descrição, criador, setor, chamado opcional, status, prioridade, prazo, versão, datas |
| `task_assignees` | tarefa, usuário, atribuído por, data; par tarefa/usuário único |
| `task_participants` | tarefa, usuário, papel de participação |
| `messages` | id, autor, chamado ou tarefa, conteúdo, visibilidade, datas |
| `attachments` | id, chamado ou tarefa, mensagem opcional, autor, chave S3, nome, tipo, tamanho, estado do upload |
| `activity_logs` | id, chamado ou tarefa, ator, ação, alterações, visibilidade, data |
| `notifications` | id, destinatário, tipo, referência ao item, evento de origem, data de leitura |
| `outbox_events` | id, tipo, versão, entidade, payload, tentativas, próxima tentativa, publicação |
| `processed_events` | consumidor, evento, data de processamento |
| `reminders` | id, chamado ou tarefa, destinatário, horário programado, estado |

O formato final das tabelas de autenticação depende da biblioteca selecionada. Não haverá integração corporativa nem cadastro público.

### Relacionamentos e integridade

- Usuários e setores possuem relação muitos-para-muitos por `department_memberships`.
- Um chamado tem um solicitante, um setor destinatário e até um responsável principal.
- Um chamado pode ter várias tarefas; uma tarefa pode existir sem chamado.
- Chamados e tarefas podem ter vários participantes.
- Solicitante e responsável podem ser a mesma pessoa.
- Responsáveis precisam estar ativos; tarefas permitem responsáveis externos com acesso explícito apenas ao item.
- Mensagens, anexos, atividades e lembretes devem apontar para exatamente um chamado ou uma tarefa, com restrições no banco.
- Anexo associado a mensagem precisa pertencer ao mesmo item.
- E-mail normalizado é único por usuário.
- Tarefas têm múltiplos responsáveis via `task_assignees`; status é compartilhado, sem conclusão individual por responsável nesta proposta.
- Vínculo entre usuário e setor é único.
- Evento processado é único por consumidor e identificador de evento.
- Datas usam UTC; apresentação respeita o fuso definido.
- `version` detecta alterações concorrentes e evita sobrescrita silenciosa.

Índices iniciais: número do chamado; solicitante; setor/status; responsável/status; prazo; item/data para mensagens e histórico; destinatário/leitura para notificações; eventos pendentes e lembretes vencidos. Listagens serão paginadas desde o início.

## 6. Permissões e fluxo funcional

| Perfil/contexto | Acesso proposto |
| --- | --- |
| Solicitante | Seus chamados e conteúdo compartilhado, inclusive destinados a outro setor |
| Membro do setor destinatário | Todos os itens do setor e todas as permissões operacionais |
| Responsável ou participante | Itens autorizados, sem acesso implícito à fila inteira |
| Administrador | Cadastro de usuários, setores e categorias; leitura global de conteúdo não é implícita |

Uma tarefa atribuída a outro setor não libera automaticamente o chamado de origem. O solicitante do chamado não ganha automaticamente acesso à conversa interna da tarefa. Notas internas devem ser filtradas também em anexos, históricos, notificações e SSE.

Fluxo proposto de chamado:

```text
Aberto → Em triagem → Em andamento → Aguardando solicitante
                                      → Resolvido → Encerrado
```

Cancelamento e reabertura terão transições e permissões explícitas. O desenho acima não obriga todos os chamados a passar por espera do solicitante.

Fluxo de tarefa: pendente, em andamento, concluída ou cancelada.

Todos os integrantes do setor podem atribuir, transferir, definir prazo, alterar status, resolver, encerrar, cancelar e reabrir seus itens. Não há perfil de gestor. Solicitante externo ao setor apenas acompanha e conversa, sem cancelar, encerrar ou reabrir. Se também integrar o setor, conserva suas permissões de integrante. Responsáveis externos acessam somente a tarefa atribuída, sem liberação da fila inteira ou do chamado de origem. Concluir tarefas não encerra o chamado automaticamente.

## 7. Cache, eventos e tempo real

### React Query

- Consultas e mutations para listas, detalhes e ações.
- Chaves incluem contexto de usuário e filtros aplicáveis.
- Limpar cache ao sair da conta ou mudar de contexto.
- Atualização otimista apenas quando reversível, com rollback.
- Pré-carregamento SSR com `QueryClient` isolado por requisição e hidratação no navegador.
- Invalidar consultas afetadas por mutations e eventos SSE.

### Redis de cache

- Começar com dados de referência e contagens de painel.
- Usar TTL e invalidação após alterações, com chaves delimitadas pelo escopo autorizado.
- Consultar permissões, conversas e detalhes sensíveis diretamente no PostgreSQL inicialmente.
- Degradar para leitura no banco quando Redis estiver indisponível, protegendo contra excesso de consultas.
- Não adicionar cache persistente do Next.js sobre os mesmos dados privados sem necessidade demonstrada.

### BullMQ, Redis de filas e outbox

Decisão vigente: BullMQ substitui RabbitMQ. `redis-cache` e `redis-queue` são processos/containers distintos, com conexões, memória, políticas e credenciais próprias; bancos lógicos ou prefixos não substituem esse isolamento.

- `redis-queue`: `noeviction`, AOF, volume persistente e monitoramento de memória/disco.
- `redis-cache`: dados descartáveis, TTL e política de eviction própria; indisponibilidade permite fallback ao PostgreSQL.
- Filas por finalidade, inicialmente e-mails e notificações/lembretes; não criar exchanges ou confirmações AMQP.
- Processadores BullMQ concluem ou falham jobs; retries limitados com backoff e jobs falhos retidos para diagnóstico/reprocessamento.
- Identificadores estáveis por evento, efeito e destinatário ajudam a deduplicar enqueue, mas não substituem idempotência no PostgreSQL.
- Registro de efeitos e `processed_events` é transacional quando possível. E-mail externo não tem garantia de envio exatamente uma vez.
- AOF não elimina toda janela de perda. Manter efeitos pendentes rastreáveis no PostgreSQL e reconciliar ausência de execução; não tratar enqueue como conclusão do trabalho.
- Reter outbox/histórico pelo período necessário à recuperação; política exata será definida na implementação.

```text
Operação de negócio
  → transação PostgreSQL: dados + histórico + evento na outbox
  → dispatcher enfileira job(s) BullMQ no redis-queue
  → registra enqueue, mantendo rastreabilidade dos efeitos pendentes
  → worker processa de forma idempotente e registra resultado
  → BullMQ registra conclusão ou aplica retry/falha
```

Eventos iniciais: `ticket.created.v1`, `ticket.assigned.v1`, `ticket.status_changed.v1`, `message.created.v1`, `task.assigned.v1` e `reminder.due.v1`. São contratos de negócio, não dependem de RabbitMQ.

Lembretes ficam no PostgreSQL como fonte oficial. Dispatcher agenda jobs atrasados BullMQ e reconcilia pendências. Ao mudar prazo, cancelar ou concluir um item, invalidar o lembrete anterior; o worker revalida estado/versão antes de agir, inclusive quando um job antigo já começou. Evitar dois agendadores independentes emitindo o mesmo lembrete.

### SSE

BullMQ é fila de trabalho, não broadcast de eventos de negócio. Para o MVP local, cada instância web consultará periodicamente alterações/notificações autorizadas no PostgreSQL e enviará sinais por SSE. Usar cursor e intervalo controlado; validar custo com a carga prevista. Não usar JobEvents como substituto da autorização ou do histórico de negócio.

React Query consulta dados após o sinal. Reconexão e retorno à aba provocam nova consulta; SSE não é fonte durável. Publicação dedicada para múltiplas instâncias poderá ser avaliada se as medições justificarem, sem adicionar outro broker nesta versão.

## 8. Etapas de implementação

### Etapa 0 — Consolidar decisões

- [x] Definir contas próprias com convite enviado após cadastro pelo admin.
- [x] Definir permissões iguais por setor e múltiplos responsáveis por tarefa.
- [x] Definir anexos, lembretes e cadastro de setores/categorias pelo admin.
- [x] Fechar validade/reenvio de convites, Mailpit e acesso externo ao setor.
- [x] Fechar sessões, recuperação de senha, primeiro admin, limite de anexos e fuso.
- [x] Aprovar Better Auth e conferir compatibilidade declarada da baseline.
- [x] Escolher SeaweedFS e BullMQ, com instâncias Redis separadas.
- [x] Fixar imagens/versões e conferir compatibilidade documental; execução será validada na etapa 1.
- [x] Registrar decisões e baseline técnica; instalações e operações protegidas continuam sujeitas às autorizações aplicáveis.

**Aceite:** decisões que afetam a implementação estão resolvidas e registradas; pendências restantes têm impacto explícito.

### Etapa 1 — Fundação

- [x] Criar workspace e estrutura modular.
- [x] Configurar Next.js, TypeScript, shadcn/ui, Tailwind e React Query.
- [x] Criar estrutura visual e temas claro, escuro e automático.
- [x] Configurar lint, análise de tipos e ferramentas de teste aprovadas.
- [x] Criar Dockerfiles e Compose de desenvolvimento.
- [x] Configurar serviços, healthchecks e arquivo de exemplo de variáveis sem segredos.

**Aceite:** ambiente local sobe de forma reproduzível; serviços saudáveis; verificações básicas passam.

**Evidência em 12/11/2026:** lint, tipos, Prisma generate, build, dois testes unitários e oito E2E em cada modo (dev e standalone) aprovados; nove serviços saudáveis. Auditoria runtime sem alertas; advisory moderado exclusivamente de tooling avaliado como não acionável na configuração atual, sem suprimir o alerta. Ver [relatório](etapa-1-execucao.md) e [operação local](operations.md). Não equivale a implementação de autenticação ou fluxos de negócio.

### Etapa 2 — Identidade e setores

Fluxo atualizado por autorização: uma branch e um PR completo, com responsabilidades de dados, regras, interface e testes. Sem PRs ou aprovações obrigatórias por camada. Categorias ficam na etapa 3; proteger último administrador ativo.

- [x] Implementar migrations e autenticação própria autorizadas.
- [x] Implementar cadastro pelo admin, convite, senha inicial, reenvio e recuperação de acesso.
- [x] Preparar Mailpit em Docker para captura local de e-mails sem envio real.
- [x] Implementar usuários, vínculos com setores e sessões.
- [x] Centralizar autorização e elegibilidade de responsáveis.
- [x] Implementar testes de isolamento e desativação de usuários.

**Aceite:** login funciona; usuário inativo e acessos não autorizados são bloqueados no servidor.

### Etapa 3 — Chamados completos

- [ ] Implementar abertura, listagem paginada e detalhe.
- [ ] Implementar atribuição, prioridade, prazo e transições de status.
- [ ] Implementar Minhas solicitações e fila do setor.
- [ ] Registrar histórico e eventos na outbox na mesma transação dos dados.
- [ ] Implementar controle de concorrência.
- [ ] Testar regras com RED → GREEN → REFACTOR.

**Aceite:** mesma conta solicita e atende; solicitante acompanha demanda em outro setor; conflitos não sobrescrevem alterações silenciosamente.

### Etapa 4 — Conversas e anexos

- [ ] Implementar mensagens persistentes e notas internas conforme matriz aprovada.
- [ ] Implementar upload, finalização e download autorizados.
- [ ] Validar limites e tipos de arquivos, estado do upload e acesso ao objeto.
- [ ] Tratar uploads incompletos e objetos órfãos.
- [ ] Testar isolamento de conteúdo, histórico e arquivos.

**Aceite:** conversa persiste após recarregar; notas internas e anexos não ficam acessíveis a pessoas sem permissão.

### Etapa 5 — Tarefas e organização

- [ ] Implementar tarefas independentes e vinculadas.
- [ ] Implementar múltiplos responsáveis via `task_assignees`, participantes, prazos e status.
- [ ] Implementar Meu trabalho, filtros, lista e Kanban.
- [ ] Garantir operação do quadro por teclado ou alternativa equivalente.
- [ ] Testar atribuições entre setores sem acesso implícito ao chamado de origem.

**Aceite:** atribuição aparece para o responsável; lista e quadro refletem os mesmos dados; concluir tarefa não encerra chamado automaticamente.

### Etapa 6 — Eventos e notificações

- [ ] Implementar enqueue da outbox no BullMQ com rastreabilidade por evento e efeito.
- [ ] Implementar workers idempotentes e tratamento de jobs interrompidos.
- [ ] Configurar retries com backoff, retenção de jobs falhos e procedimento de reprocessamento.
- [ ] Implementar notificações internas e lembretes.
- [ ] Implementar SSE e invalidação das consultas React Query.
- [ ] Testar indisponibilidade, reconexão, reentrega e mudanças de prazo.

**Aceite:** eventos recuperáveis não se perdem; reentregas não duplicam efeitos; interface recupera mudanças após reconectar.

### Etapa 7 — Cache e experiência

- [ ] Implementar cache Redis seletivo com TTL e invalidação.
- [ ] Testar fallback quando Redis estiver indisponível.
- [ ] Validar isolamento dos caches por usuário e contexto.
- [ ] Refinar estados de carregamento, erro e ausência de dados.
- [ ] Validar temas persistidos, responsividade, contraste e teclado.

**Aceite:** cache não mistura dados; fluxo principal funciona sem Redis de cache; interface é utilizável nos temas e tamanhos previstos.

### Etapa 8 — Homologação e operação

- [ ] Executar lint, análise de tipos e testes pertinentes.
- [ ] Executar E2E e carga representativa com dados sintéticos.
- [ ] Configurar logs sem segredos e acompanhamento de erros/filas.
- [ ] Demonstrar backup e restauração em ambiente separado.
- [ ] Documentar configuração, operação, publicação e recuperação.
- [ ] Obter revisão independente quando o risco justificar.
- [ ] Corrigir apontamentos obrigatórios e revalidar.
- [ ] Apresentar relatório de entrega e solicitar aprovações de commit e publicação separadamente.

**Aceite:** jornadas aprovadas, recuperação demonstrada e nenhuma verificação obrigatória pendente sem tratamento explícito.

## 9. Validação final

- [ ] Uma pessoa abre uma solicitação e recebe outra na mesma conta.
- [ ] Solicitante acompanha chamado destinado a outro setor.
- [ ] Terceiro não autorizado não acessa item, arquivo, histórico ou conteúdo por eventos.
- [ ] Vários responsáveis recebem a mesma tarefa em Meu trabalho, conversam e acompanham o status compartilhado.
- [ ] Redis de filas indisponível mantém eventos pendentes na outbox para enqueue posterior.
- [ ] Perda de jobs após falha é detectada e reconciliada com efeitos pendentes no PostgreSQL.
- [ ] Reentrega de evento não duplica notificações.
- [ ] Alteração de prazo substitui ou cancela lembrete anterior.
- [ ] Reinício dos containers preserva banco e anexos.
- [ ] Backup é restaurado em ambiente separado.
- [ ] Temas, teclado e fluxo em tela pequena funcionam.

TDD será priorizado para autorização, elegibilidade, transições, concorrência e idempotência. Integrações usam serviços Docker isolados e dados sintéticos; nunca produção.

### Registro de evidências

Preencher durante a execução, sem marcar testes não executados como aprovados.

| Etapa | Comando/cenário | Resultado | Evidência ou referência | Pendências |
| --- | --- | --- | --- | --- |
| 1 | Lint, tipos, build, Prisma, unitários, E2E e saúde Docker | Aprovados localmente | [Comandos, falhas e resultados](etapa-1-execucao.md) | Advisory moderado de tooling documentado; etapas 2–8 futuras |

## 10. Aprovações e continuidade

- Alterações de dependências, infraestrutura, autenticação, autorização e estrutura de banco exigem aprovação específica conforme as instruções do projeto.
- Aprovar o plano não autoriza automaticamente operações sensíveis posteriores.
- Commit local, push, PR, merge e deploy exigem suas autorizações específicas.
- Preservar alterações preexistentes e conferir estado do Git antes de implementar.
- Na criação deste documento, a pasta ainda não era um repositório Git; nenhuma branch ou commit foi criado.
- Na etapa 1, Git foi inicializado em `main`, sem commit/remoto. O usuário autorizou dependências e containers exclusivamente locais e determinou concluir as validações sem criar commit.
- Atualizar este plano conforme decisões forem aprovadas, sem transformar propostas em decisões confirmadas implicitamente.

## 11. Referências técnicas

- Next.js, hospedagem própria: <https://nextjs.org/docs/app/guides/self-hosting>
- Next.js, autenticação: <https://nextjs.org/docs/app/guides/authentication>
- TanStack Query, SSR e hidratação: <https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr>
- BullMQ, produção: <https://docs.bullmq.io/guide/going-to-production>
- BullMQ, agendamento: <https://docs.bullmq.io/guide/job-schedulers/>
- SeaweedFS: <https://github.com/seaweedfs/seaweedfs>

## 12. Baseline técnica — 12/11/2026

Versões existentes consultadas diretamente no registro npm, incluindo engines e peer dependencies das dependências principais. Tags e digests de imagens consultados na API Docker Hub. Esta seção preserva a baseline de planejamento; resultados posteriores de instalação, resolução transitiva, auditoria e build da etapa 1 estão no [registro de execução](etapa-1-execucao.md).

Usar versões exatas nos manifests, sem `latest`, `^` ou `~`; pnpm workspace e um lockfile. Adicionar dependências na etapa em que forem usadas, sem instalar tudo antecipadamente. Node será executado em containers Linux Debian.

### Aplicação e serviços

| Pacote/ferramenta | Versão fixada | Finalidade |
| --- | --- | --- |
| Node.js | 24.22.3 | Runtime web/worker/dispatcher |
| pnpm | 10.34.9 | Workspace e lockfile |
| next / eslint-config-next | 16.4.6 | Framework e configuração lint alinhados |
| react / react-dom | 19.3.1 | Runtime da interface |
| typescript | 5.9.3 | Tipagem; evitar migração prematura para TS 7 |
| better-auth / @better-auth/prisma-adapter | 1.7.22 | Autenticação e adapter alinhados |
| prisma / @prisma/client / @prisma/adapter-pg | 7.10.1 | CLI, client e driver adapter alinhados |
| pg | 8.23.1 | Driver PostgreSQL |
| @tanstack/react-query | 5.107.1 | Estado remoto |
| bullmq | 6.7.5 | Backend Redis para jobs |
| ioredis | 5.11.1 | Conexões separadas de cache e fila |
| zod | 4.6.7 | Validação de entrada |
| nodemailer | 10.1.4 | Transporte SMTP; atualização de segurança autorizada na etapa 2 |
| @aws-sdk/client-s3 / @aws-sdk/s3-request-presigner | 3.1167.0 | S3 e URLs assinadas |

### Interface

| Pacote/ferramenta | Versão fixada |
| --- | --- |
| shadcn (CLI) | 4.23.0 |
| tailwindcss / @tailwindcss/postcss | 4.3.5 |
| postcss | 8.5.32 |
| radix-ui | 1.8.1 |
| lucide-react | 1.72.0 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| tailwind-merge | 3.7.0 |
| next-themes | 0.4.6 |
| tw-animate-css | 1.4.0 |

shadcn é gerador de código; seus componentes ficam no projeto. O registro remoto pode mudar independentemente da versão do CLI: revisar código/dependências gerados, registrar os componentes adicionados e fixar o resultado no lockfile. Não assumir reprodução idêntica somente pelo CLI. Dependências de editor/Kanban serão selecionadas quando necessárias.

### Qualidade e tipos

| Pacote | Versão fixada |
| --- | --- |
| eslint | 9.39.5 |
| vitest | 5.1.0 |
| vite | 8.3.8 |
| @playwright/test | 1.65.0 |
| tsx | 4.23.15 |
| @types/node | 24.19.2 |
| @types/react / @types/react-dom | 19.3.0 |
| @types/pg | 8.23.1 |
| @types/nodemailer | 8.0.2 |

Executar ESLint explicitamente, sem presumir lint no build. Vitest começa com testes de regras no ambiente Node; dependências DOM só se necessárias. Playwright deve usar o navegador correspondente à sua versão na etapa de testes.

### Imagens Docker

| Uso | Tag fixada | Digest consultado |
| --- | --- | --- |
| Base web/worker/dispatcher | node:24.22.3-bookworm | sha256:9d266751ca3d7fdbe651c878ffd5ad0a42fed49a18c283509267c97f025b7496 |
| PostgreSQL | postgres:17.11-bookworm | sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994 |
| Ambos os Redis | redis:7.2.17-alpine3.22 | sha256:2f66de68111e64c3927859f158f8e666066dae2b97d9f82770a6f37a5aa1c335 |
| SeaweedFS | chrislusf/seaweedfs:4.53 | sha256:ccad23e18639c8b98cee17e7100b95830a06077b56d8e5b006d6dcf8ec5e94a0 |
| Caddy | caddy:2.11.9-alpine | sha256:0bbb055bda6793c999bde78b1b5ce3e89f829fb031af2cf50056ea1246559fee |
| Mailpit | axllent/mailpit:v1.33.1 | sha256:aef2aacc11f075ec0fb6874275ee4a421e688e11a96ebb296134d1735c7761ce |

As seis tags responderam HTTP 200 e listaram amd64/Linux. Usar tag + digest nos manifests; revisar atualizações antes da produção. Os Redis usam a mesma imagem, mas containers, conexões, volumes e políticas distintos. SeaweedFS local pode reunir seus componentes, mantendo dados e metadados persistentes; produção terá topologia própria a definir.

Docker Engine e Compose são pré-requisitos do host: usar Linux containers e Compose v2. Conferir versão instalada e recursos do Compose na etapa 1. Portainer pertence ao ambiente futuro; não instalar por este planejamento local.

### Compatibilidade declarada verificada

- Next 16.4.6 declara Node >=20.9 e React 19; Node 24.22.3 e React 19.3.1 satisfazem.
- Better Auth 1.7.22 declara Next 14/15/16, React 18/19 e Prisma 5/6/7. Adapter alinhado; Prisma 8 excluído por incompatibilidade documentada do adapter.
- Prisma 7.10.1 declara Node ^20.19, ^22.12 ou >=24 e TypeScript >=5.4; Node 24 e TS 5.9 atendem. Usar ESM, geração explícita do client e driver adapter PostgreSQL.
- React Query, Radix, ícones e tema declaram suporte a React 19 nos peers consultados.
- BullMQ 6.7.5 declara ioredis >=5; ioredis 5.11.1 atende. Implementar conforme API v6, sem copiar exemplos antigos indiscriminadamente. Usar backend Redis, não a alternativa PostgreSQL do BullMQ.
- Vitest 5.1.0 aceita Node 24 e Vite 8; Vite 8.3.8 aceita Node >=22.12. ESLint 9 satisfaz o requisito de eslint-config-next >=9.
- Baseline inicial usava Nodemailer 8.0.11. Na etapa 2, auditoria identificou 15 advisories nesse pacote (3 altos e 12 moderados). Atualização para 10.1.4 autorizada explicitamente; esta versão inclui tipos próprios. Demais versões diretas foram preservadas.
- A compatibilidade de dependências diretas não prova resolução transitiva, segurança ou execução integrada. A consulta de baseline da etapa 0 não incluía auditoria; as auditorias executadas posteriormente constam nos relatórios das etapas 1 e 2.
- Node local observado: 24.22.0; npm.cmd não estava no PATH consultado. A baseline em Docker evita depender de instalação adicional no host por padrão.

### Verificações transferidas para a implementação

- [x] Preparar manifests e observar autorizações operacionais aplicáveis antes da instalação.
- [x] Resolver lockfile, inspecionar peers/engines e avisos de segurança reais; não ignorar conflitos para prosseguir. Ressalva de tooling documentada no relatório.
- [x] Conferir Docker/Compose, arquitetura e digests antes de baixar/executar imagens.
- [x] Executar typecheck, lint, build e geração Prisma na fundação.
- [x] Validar Better Auth/PostgreSQL: convite, reset, expiração absoluta e revogação na etapa 2. Evidências no relatório; SMTP Mailpit também validado.
- [ ] Validar BullMQ/Redis: job, retry, reinício e idempotência nas etapas de processamento.
- [ ] Validar S3 privado, assinatura e restauração com SeaweedFS nas etapas pertinentes.

Os itens ainda desmarcados são verificações de execução futura, não decisões pendentes da etapa 0.

Fontes: [registro npm](https://registry.npmjs.org/), [adapter Better Auth](https://better-auth.com/docs/adapters/prisma), [Prisma requisitos](https://docs.prisma.io/docs/orm/reference/system-requirements), [BullMQ conexões](https://docs.bullmq.io/guide/connections), [Docker Hub](https://hub.docker.com/). Consulta npm por pacote/versão e Docker Hub por `/v2/repositories/{repo}/tags/{tag}`. Não houve download de imagens nem instalação de pacotes.
