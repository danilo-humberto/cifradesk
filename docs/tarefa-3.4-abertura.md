# Tarefa 3.4 — Abertura de chamados e anexos privados

Data: 13/11/2026. Branch: `codex/etapa-3-chamados`. Implementação registrada em commits locais autorizados, sem push, PR ou deploy. A alteração preexistente de `AGENTS.md` foi preservada e não integra esta entrega. Nenhuma issue Linear foi associada.

## Comportamento e contratos

`POST /api/tickets` recebe JSON conforme `createTicketInput`: título, descrição, departamento de origem, setor destinatário e `requestedFor: SELF|OTHER`; somente OTHER recebe `requesterName`. Identidade vem da sessão. Campos extras, incluindo criador, prioridade e nome em SELF, são rejeitados. Nome da conta e nome do departamento são copiados no servidor. Exige usuário ativo, sessão não revogada, vínculo com origem ativa e destino ativo. Permite origem igual ao destino, sem atribuição automática.

Sucesso: HTTP 201 com `id`, `number`, `status`, `priority`, `version` e `createdAt`. Defaults: OPEN, NORMAL, versão 1. Uma transação grava chamado, atividade SHARED `ticket.created` e outbox `ticket.created.v1`; payload mínimo `{ticketId,ticketVersion:1}`, contrato versão 1. Número usa sequência PostgreSQL: único, mas pode ter lacunas após rollback. Não há entrega de notificações.

`POST /api/tickets/{id}/attachments` recebe multipart com um a cinco campos `files`, após criar o chamado. Autoriza criador ou integrante do setor destinatário; usuário ativo e sessão válida são reavaliados antes de reservar e antes de disponibilizar arquivos. Setor inativo preserva download autorizado, mas não recebe uploads. Nome livre de outra pessoa e papel de administrador não concedem acesso. Sucesso: HTTP 201 com `items`, contendo id, nome, tipo, tamanho e estado; nunca chave S3.

`GET /api/tickets/{id}/attachments/{attachmentId}` exige sessão e acesso ao chamado. Só AVAILABLE pode ser baixado. A autorização é reavaliada depois da leitura do S3. Resposta força download como octet-stream, `nosniff`, sandbox e `no-store`; não publica URL nem chave. ID inacessível ou incompleto retorna 404.

POSTs verificam Origin e tipo de conteúdo. JSON é limitado a 64 KiB para comportar os caracteres Unicode permitidos; outros consumidores do helper mantêm 16 KiB. Multipart é limitado pelos bytes efetivamente recebidos a 100 MiB + 64 KiB de envelope. Limites por usuário/minuto: 30 aberturas, 10 envios e 60 downloads, usando o mecanismo existente.

## Anexos, concorrência e recuperação

- Máximo de 20 MiB por arquivo, cinco por envio e 200 MiB por chamado. A convenção binária já usada na 3.2 permanece. Bytes reais, extensão, MIME e assinatura/estrutura básica são validados. Permitidos PDF, PNG, JPEG, TXT, CSV, DOCX e XLSX; texto UTF-8, nomes sem caminhos/controles. ZIP genérico, arquivos Office criptografados, macros identificadas e executáveis incorporados identificados são rejeitados.
- Reservas PENDING_UPLOAD e exclusões PENDING_DELETION contam no acumulado. O mesmo lock transacional usado pela identidade serializa validação/reserva e impede revogação durante a gravação. Operações S3 ficam fora da transação. Não há alteração de schema ou migration nesta tarefa.
- O envio do lote é disponibilizado junto após todos os PUTs. Uma falha preserva o chamado, tenta remover todos os objetos do lote e mantém exclusão pendente. A resposta orienta nova tentativa. Não existe atomicidade distribuída PostgreSQL/S3.
- Timeout de PUT não garante cancelamento remoto. Por isso a primeira exclusão não libera a reserva. A limpeza operacional repete DELETE após 30 minutos e só então marca FAILED. Também recupera reservas abandonadas há 30 minutos. Falhas de DELETE conservam a pendência; próxima execução tenta novamente. Cada execução processa até 100 registros em ordem estável. Não existe endpoint público de limpeza nem agendamento automático nesta etapa.
- A validação identifica formato e estrutura básica; não é antivírus, sanitização de documentos ou validação completa de renderização. Arquivos são sempre baixados, não renderizados inline.

## Arquivos centrais e decisões

`packages/infrastructure/src/tickets.ts` contém criação e validação transacional. `ticket-attachments.ts` contém acesso, reservas e recuperação. `attachment-content.ts` e `storage.ts` separam inspeção de bytes e S3. As rotas só cuidam de HTTP/sessão e chamam os serviços, seguindo o módulo de identidade existente.

A integração usa apenas `@aws-sdk/client-s3@3.1167.0`, previsto no plano e autorizado pelo usuário, sem biblioteca de presign: downloads passam pelo servidor para reavaliar acesso. Configuração local em Compose e `.env.example`; inicialização explícita por `scripts/storage-local.ts init`. O bucket `cifradesk-local` foi inicializado e confirmou HTTP 403 para acesso anônimo. Não foram alteradas credenciais existentes nem aplicado deploy à aplicação em execução.

Foi necessário acrescentar o subpath `@cifradesk/contracts/tickets`: a reexportação `.js` da 3.2, necessária ao worker NodeNext, não era resolvida pelo Turbopack quando usada em runtime. O subpath segue o padrão de identidade e preserva o worker.

Mais de cinco arquivos são necessários por separar serviço, armazenamento/validação, rotas, testes, configuração e documentação. Não houve alteração de telas, schema ou regras das tarefas 3.5–3.7.

## Evidências de testes

Os comandos pnpm usam Node 24.22.3 da imagem `cifradesk-toolchain:local`, container temporário `cifradesk-etapa34-tools`, volumes de dependências já existentes `cifradesk-identidade-*`. O Compose habitual continua bloqueado por `BETTER_AUTH_SECRET` ausente; não foi corrigido por regeneração de credenciais. O script que orquestra Docker usa o Node empacotado no app; os testes rodam na imagem do projeto.

- RED: as suítes de criação, inspeção de arquivos e integração falharam inicialmente pela ausência dos respectivos módulos, antes da implementação. GREEN: 12 testes de criação e inicialmente nove de conteúdo passaram; conteúdo foi ampliado para 15 casos, incluindo os sete formatos aceitos e rejeições.
- `node scripts/test-ticket-opening.mjs`: 12 integrações aprovadas na execução final registrada, em banco `tickets34_test_a16ffc178522a071a725`, com papel exclusivo e dados sintéticos. Cobre 12 criações simultâneas; falhas forçadas nos INSERTs de histórico e outbox com rollback real; acesso externo/admin/membro; revogação; limite concorrente; falha/limpeza/reenvio; PUT tardio e intercalação com limpeza. Inclui PUT/GET/DELETE reais no SeaweedFS, acesso anônimo negado e objeto parcial ausente após compensação.
- Seis testes HTTP aprovados: sessão recebida pelo caso de uso, ausência de sessão, Origin/tipo, limites reais do corpo/Unicode e multipart inválido/válido. São testes de handlers/helpers, não E2E do navegador.
- `pnpm db:generate`: schema validado e client gerado. Nenhuma migration nova.
- Primeiro `pnpm build` falhou no subpath `.js` descrito acima. Após correção, build agregado web e worker passou. A execução final, repetida após a correção de cleanup, também passou integralmente.
- `pnpm check` final: lint e tipos aprovados; 54 testes aprovados, 27 integrações explicitamente puladas nesse comando (12 de chamados executadas separadamente; 15 de identidade não reexecutadas).
- `docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml config --quiet`: aprovado usando somente valores sintéticos de ambiente para validar interpolação, sem modificar `.env` nem imprimir configuração expandida.
- `git diff --check`: sem erros. Revisão independente reavaliou a correção de cleanup e não identificou bloqueio técnico remanescente; não substitui a auditoria dos commits futuros.

O runner cria bancos/papéis e buckets sintéticos novos, sem tocar o banco de trabalho. São preservados para diagnóstico, sem DROP ou remoção global. A execução usa a credencial local S3 autorizada somente em memória, sem exibi-la. As integrações de identidade e E2E de navegador não foram reexecutadas nesta tarefa; permanecem no roteiro da 3.8. `pnpm test:integration` continua específico de identidade; os testes desta tarefa têm runner explícito e não são contabilizados como executados pelo comando antigo.

## Revisão e limitações

Revisão independente identificou a confirmação tardia de PUT após DELETE. Corrigido com exclusão pendente, janela de graça e teste da intercalação. Reavaliação confirmou a correção e não identificou outro bloqueio técnico no código. Fixtures comprovam assinatura/estrutura, sem afirmar interoperabilidade completa dos documentos.

Multipart mantém arquivos e cópias em memória, com até 100 MiB de conteúdo por envio. Carga, limite de concorrência e dimensionamento de produção continuam não validados. O lock compartilhado com identidade é simples e consistente, mas pode gerar contenção; nenhum IO S3 é feito sob esse lock. A recuperação depende de executar a limpeza operacional; reservas pendentes podem temporariamente impedir novos envios. A janela pressupõe operações remotas encerradas em menos de 30 minutos, muito acima do timeout de 60 segundos por operação.

## Validação manual e documentação

1. Em ambiente sintético, autenticar uma conta ativa com vínculo, criar chamado via JSON e conferir resposta 201/defaults.
2. Enviar multipart para o id retornado, baixar o anexo com a mesma sessão e com integrante do destino; conta externa/admin sem vínculo recebe 404.
3. Tentar criador forjado, origem alheia, destino inativo, arquivo incompatível, sexto arquivo e excesso acumulado; conferir rejeição sem efeitos indevidos.
4. Simular indisponibilidade do S3: o chamado permanece. Após recuperar o S3 e transcorrer a janela, executar limpeza e reenviar.

Documentos atualizados: este relatório/contrato, planejamento da etapa 3, plano principal, arquitetura e operação. A interface continua para a 3.7; não há jornada visual entregue pela 3.4.

## Minuta para Linear — não publicada

### O QUE E POR QUE

Criação grava chamado, histórico e outbox juntos. Anexos usam reserva transacional e armazenamento privado, preservando o chamado se o upload falhar. Reutiliza identidade e PostgreSQL existentes.

### ALERTA DO SÊNIOR

Upload em memória exige validação de carga; limpeza de pendências é operacional, sem agendamento. O lock compartilhado pode causar contenção. Revisão do working tree é preliminar, sem auditoria de commits novos.

### FOCO DE REVISÃO

`packages/infrastructure/src/tickets.ts` e `packages/infrastructure/src/ticket-attachments.ts`.

## Registro local autorizado

O usuário autorizou explicitamente os três commits locais na mesma branch, mantendo a proibição de push/PR.

1. `020dedc feat: implementa abertura e anexos privados (etapa 3.4)`: contratos/subpath, SDK/configuração, serviços e testes necessários à coerência do comportamento; arquivos críticos são `tickets.ts` e `ticket-attachments.ts`.
2. `0147413 feat: expõe API de abertura e anexos (etapa 3.4)`: rotas, barreira de servidor, limites HTTP e testes de sessão/payload. Segurança e validação devem ser lidas.
3. `docs: registra execução da etapa 3.4`: commit documental que contém este registro, contratos, operação, evidências e limites. Seu hash deve ser consultado no histórico, pois não pode ser incluído no próprio conteúdo. Não há boilerplate visual nesta tarefa.

Antes do primeiro commit, seu conteúdo foi exportado do índice para uma cópia isolada (`.local/commit-34-core`), sem os arquivos futuros de API. Nessa cópia, `pnpm db:generate` e `pnpm check` passaram: lint, tipos e 48 testes; 27 integrações explicitamente puladas. O segundo commit contém exatamente o código completo anteriormente validado com 54 testes, 12 integrações separadas e build web/worker; não houve alteração de implementação ao organizar o histórico. O terceiro muda somente documentação.

`git fetch origin main` confirmou `main` e `origin/main` em `7ddc3f343332a78a33015240b893dad4b9ae7892`, sem trocar de branch ou modificar a main. Diffs preparados foram conferidos sem erros de whitespace. A auditoria completa do histórico da etapa 3 e do futuro PR permanece obrigatória antes da publicação; as tarefas 3.5–3.8 não foram concluídas. Nenhum PR parcial será aberto.
