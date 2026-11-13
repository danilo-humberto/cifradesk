# Tarefa 3.6 — Operações e concorrência de chamados

13/11/2026. Implementação local na mesma branch `codex/etapa-3-chamados`, solicitada pelo usuário. Políticas de autorização desta tarefa aprovadas explicitamente. Registrada em commits locais autorizados, sem push, PR, deploy ou publicação no Linear. Alteração preexistente de `AGENTS.md` preservada. Nenhuma issue Linear associada.

## Contrato implementado

`POST /api/tickets/{id}/operations/{operation}`, com sessão, origem válida, JSON de até 64 KiB e limite de 60 operações/minuto por conta. Todas as ações exigem `expectedVersion` e retornam `{id,version}` da gravação confirmada; recarregar o detalhe após sucesso. Conflito retorna 409 sem sobrescrever dados ou gravar histórico/evento de sucesso. Respostas usam `no-store`.

| operation | Campos além da versão | Comportamento |
| --- | --- | --- |
| `assign` | `userIds` | Substitui responsáveis por integrantes ativos do setor; preserva metadados das atribuições mantidas |
| `transfer` | `departmentId`, `reason` | Exige outro setor ativo; retorna a PENDING e conserva somente responsáveis compatíveis |
| `update` | `priority`, `dueDate`, `title`, `description`, opcionais, ao menos um | Aplica contratos existentes; prazo aceita null ou hoje/futuro em America/Sao_Paulo |
| `status` | `status`, `reason`, `reviewGuidance`, `solution` conforme regra | Permite todos os pares distintos, com as condições da 3.1 |
| `reopen` | `reason` | Exige CLOSED e retorna a PENDING |

Entrar em BLOCKED, sair de CLOSED ou fechar diretamente de OPEN/PENDING exige motivo. REVIEW exige orientação; DONE exige solução. IN_PROGRESS/REVIEW/DONE exigem responsável elegível. Não se pode retirar manualmente o último responsável nesses estados. Transferência em DONE/CLOSED é negada. Prazo vencido já armazenado não impede finalizar nem é alterado implicitamente. Repetir o mesmo status é rejeitado; outras alterações válidas, mesmo com valor repetido, incrementam versão e são auditadas.

Somente conta ativa, com versão de autenticação vigente e vínculo no setor ativo destinatário, opera. Ser criador externo, administrador ou pessoa com nome digitado não concede operação. Integrantes têm os mesmos direitos, sem exclusividade de responsável. Item inexistente/inacessível retorna 404. Responsáveis, destino e permissões são consultados novamente dentro da transação.

## Transação, histórico e identidade

Reutiliza `ticketWrite` e o advisory lock `724013`, compartilhado com mutações de identidade. `updateMany` compara `id/version` e incrementa a versão atomicamente. Dados, atribuições, histórico e outbox pertencem à mesma transação; falha em qualquer gravação desfaz tudo. Não há dependência ou migration nova.

Eventos versão 1: `ticket.assigned.v1`, `ticket.status_changed.v1` (inclusive reabertura), `ticket.transferred.v1`, `ticket.updated.v1` e `ticket.assignees_removed.v1` (ajuste administrativo). Payload mínimo `{ticketId,ticketVersion}`, `contractVersion: 1`; o ID da outbox identifica o evento. Motivos não são copiados para a outbox. O evento de transferência inclui todas as mudanças dessa ação no histórico, sem criar eventos adicionais de status/atribuição. Entrega dos eventos continua na etapa 6.

Alterações operacionais e solução ficam em histórico SHARED. Motivos/orientação ficam em registro separado INTERNAL, na mesma versão. Remoção de vínculo/desativação retira atribuições na transação administrativa, preserva demais responsáveis/status, incrementa versão e registra ajuste INTERNAL com `needsReassignment` quando nenhum resta. Não concede acesso ao administrador que realizou o ajuste.

Detalhe e listas agora retornam `needsReassignment`: verdadeiro quando IN_PROGRESS/REVIEW/DONE está sem responsável. É derivado do estado atual e volta a falso após reatribuição. OPEN/PENDING podem não ter responsáveis normalmente; o histórico interno registra a perda de atribuição em qualquer estado. A apresentação visual deste indicador pertence à 3.7.

Desativação de setor com chamados não CLOSED retorna 409; renomear não depende dessa restrição. Setor inativo conserva leitura histórica autorizada, mas não recebe operações. Transferência conserva autoria, nome informado, prioridade e prazo; vínculos antigos perdem acesso salvo outro fundamento válido.

## Evidências e limites

- TDD: testes de regras, integração e HTTP falharam inicialmente por ausência dos módulos/rota. Teste do indicador falhou pela ausência de `needsReassignment`, depois passou com o campo calculado. Baseline de 12 testes existentes de abertura passou.
- `node scripts/test-ticket-operations.mjs`: oito integrações passaram no PostgreSQL sintético `tickets36_test_b9100d09210ecc125d23`. Verificam autorização, validação, privacidade, atribuição, transferência, rollback por falha injetada na outbox, edição simultânea, revogação concorrente, desativação e reatribuição. Cria banco/papel próprios, usa migrations existentes e preserva o banco para diagnóstico; não lê credenciais da aplicação nem acessa S3.
- `node scripts/test-ticket-queries.mjs`: oito integrações de consultas passaram antes da adição do indicador; a reexecução após o indicador também passou (oito testes), no banco `tickets35_test_20f8740eaa636797f0eb`.
- O Node padrão do host recusou execução por versão. A orquestração usou o executável instalado v24.22.0 por caminho explícito; aplicação e verificações usam o runtime do container `cifradesk-etapa34-tools`. Nenhuma versão/dependência foi instalada ou alterada.
- Falhas intermediárias corrigidas: tipo Prisma da atualização precisava aceitar a chave estrangeira de setor; teste HTTP precisava configurar o ator autenticado no mock. O aviso já observado do driver `pg` sobre consultas concorrentes no mesmo client permanece, sem supressão.
- Duas operações reais disparadas simultaneamente com a mesma versão produzem uma confirmação e um 409, com apenas um histórico/evento. O teste de revogação inverte ordem de disparo e valida resultado consistente; não força nem comprova todas as ordens possíveis de aquisição do lock.
- Remoção administrativa lê lotes de 100, mas toda a alteração permanece atômica sob timeout de 15 segundos e lock global. Muitas atribuições podem causar timeout/rollback e contenção; carga e dimensionamento pertencem à 3.8. Não há garantia de desempenho em volume.
- A suíte completa de identidade (15 integrações), abertura/anexos (12 integrações) e E2E de navegador não foi reexecutada nesta tarefa. As mudanças de identidade têm cobertura específica nas novas integrações. Interface e jornada E2E continuam em 3.7–3.8.

## Revisão e documentação

Revisão independente somente leitura examinou regras, serviço, identidade e API sem encontrar bloqueio no código inicial. Ressaltou os limites de volume e evidência concorrente acima. A revisão é preliminar do working tree; não substitui auditoria do histórico após commits e do futuro PR completo. A reavaliação independente do indicador, integração e documentação não encontrou novos bloqueios; pediu somente completar os resultados finais.

Documentos atualizados: este relatório, planejamento da etapa 3, plano principal, arquitetura, identidade e operação. A tarefa excede cinco arquivos porque separa regras, serviço, integração com identidade, API, contratos, testes, runner e fontes documentais existentes.

Roteiro manual ainda não executado: em ambiente sintético, atribuir um integrante, iniciar atendimento e enviar duas alterações com a mesma versão (esperar um 409); transferir e verificar perda de acesso do setor anterior; remover o último vínculo e conferir status preservado/indicador; reatribuir e conferir indicador falso; comparar histórico de criador externo e integrante. As verificações automatizadas cobrem serviços e handlers, não o navegador.

Divisão de commits autorizada pelo usuário: `feat: implementa operações transacionais de chamados (etapa 3.6)` para regras, contratos, serviço, identidade, consultas e testes correspondentes; `feat: expõe operações de chamados na API (etapa 3.6)` para rota/helper/teste HTTP; `docs: registra operações da etapa 3.6` para documentação. Registro e validação dos estados de commit abaixo.

## Minuta curta para Linear — não publicada

### O QUE E POR QUE

Operações validam integrantes e versão dentro da transação existente, gravando histórico e outbox juntos. Perda de vínculo remove atribuições e sinaliza atendimento sem responsável. Reutilizar os contratos e a persistência existentes é a solução mais simples adequada.

### ALERTA DO SÊNIOR

Lock global e remoção de muitas atribuições exigem medição de carga. Concorrência testada não cobre todas as intercalações. Revisão local preliminar; E2E e auditoria do histórico completo continuam pendentes.

### FOCO DE REVISÃO

`packages/infrastructure/src/ticket-operations.ts` e `packages/infrastructure/src/identity.ts`.


## Verificação final

`docker exec cifradesk-etapa34-tools pnpm check` passou: lint, tipos e 65 testes. As 43 integrações ficam explicitamente puladas nesse comando; 16 foram executadas pelos runners de operações e consultas nesta tarefa. A revisão do diff completo da tarefa incluiu arquivos novos, sem incluir a alteração preexistente de AGENTS.md. Os ajustes de whitespace detectados nos documentos/runner foram corrigidos.

`docker exec cifradesk-etapa34-tools pnpm build` passou para web e worker. A rota `/api/tickets/[id]/operations/[operation]` aparece no resultado. O build demorou na compactação do cache do filesystem (4,3 minutos), mas terminou com código zero. `git diff --check` e verificação equivalente dos arquivos novos não apontaram erros de whitespace após os ajustes. Estado de revisão local: READY_FOR_HUMAN_REVIEW para a tarefa 3.6, com os limites registrados acima. Etapa 3 completa, publicação e auditoria do histórico permanecem posteriores.

## Registro local autorizado

O usuário autorizou os três commits locais da 3.6 na mesma branch, mantendo a proibição de push e PR.

1. `2e602d7 feat: implementa operações transacionais de chamados (etapa 3.6)`: contratos, regras, serviço, efeitos de identidade, indicador nas consultas, testes e runner. Arquivos críticos para revisão: `packages/infrastructure/src/ticket-operations.ts` e `packages/infrastructure/src/identity.ts`.
2. `cf40708 feat: expõe operações de chamados na API (etapa 3.6)`: rota, exportação e testes HTTP. Autorização, origem, limites de entrada e conflito precisam de revisão; não são boilerplate trivial.
3. `docs: registra operações da etapa 3.6`: contratos, evidências e estado documental. O hash deste commit deve ser consultado no histórico, pois não pode constar no próprio conteúdo. Não há boilerplate visual nesta tarefa.

O índice do primeiro commit foi exportado para `.local/commit-36-core`, sem os arquivos futuros de API, e validado em container temporário da imagem local existente, sem rede. `pnpm db:generate` e `pnpm check` passaram: geração Prisma, lint, tipos e 62 testes; 43 integrações foram explicitamente puladas nesse comando. Não houve instalação de dependências nem acesso a banco nessa validação. A cópia ignorada pelo Git permanece para diagnóstico.

O segundo commit contém exatamente o código completo já validado com 65 testes, 16 integrações executadas separadamente e build web/worker. Nenhum código foi alterado ao organizar os commits. O terceiro modifica somente documentação. Diffs preparados conferidos, incluindo arquivos novos, sem erros de whitespace; a alteração preexistente de `AGENTS.md` não integra os commits.

`git fetch origin main` confirmou `main` e `origin/main` em `7ddc3f343332a78a33015240b893dad4b9ae7892`, sem troca de branch nem alteração da main. A auditoria completa `main..HEAD` de toda a etapa 3 e do futuro PR permanece obrigatória antes da publicação; a conferência destes commits não substitui essa auditoria. Etapas 3.7–3.8 continuam pendentes. Nenhum status ou comentário foi publicado no Linear.
