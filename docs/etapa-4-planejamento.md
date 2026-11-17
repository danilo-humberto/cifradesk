# Etapa 4 — Conversas e anexos

Data: 17/11/2026.

Status: tarefas 4.1 e 4.2 implementadas e validadas localmente em 17/11/2026; tarefas 4.3–4.6 não iniciadas. Somente os itens marcados abaixo possuem execução registrada. A 4.1 tem commit local `8f03dc3`; os commits locais da 4.2 foram autorizados posteriormente; push e PR permanecem não autorizados. Referência de escopo: [plano de implementação](plano-implementacao.md).

## Objetivo e decisões fechadas

Permitir conversas compartilhadas e notas internas nos chamados, reaproveitando o armazenamento privado, as validações e a recuperação de uploads da etapa 3.

Regras confirmadas:

- Mensagens em **Markdown**, com até 10.000 caracteres; permitir envio somente com anexos, mas nunca completamente vazio.
- Chamados **FECHADOS continuam recebendo mensagens**, sem reabertura automática. Setores desativados permanecem somente para leitura.
- Somente o autor pode editar ou excluir, desde que conserve acesso; notas internas exigem vínculo atual com o setor responsável.
- Edição permite alterar texto e anexos. A visibilidade, compartilhada ou interna, fica fixa.
- Mostrar versões anteriores e indicação de edição. Exclusão mantém marcador, mas oculta conteúdo, versões e arquivos das APIs de conversa.
- Arquivos removidos ficam sem download, inclusive nas versões anteriores. Seus nomes permanecem no histórico; os bytes continuam retidos e contando nos 200 MB.
- Mensagem e anexos novos são publicados juntos. Na falha, preservar o rascunho na tela; em edição, preservar a versão publicada anterior.

Tarefas independentes, Kanban, notificações, lembretes e atualização em tempo real continuam nas etapas posteriores.

## Checklist de implementação e cenários

**Regra para todas as tarefas:** escrever os testes primeiro, executar e registrar a falha esperada; implementar; executar novamente; melhorar o código sem regressões. Teste falhando por ambiente quebrado não serve como evidência do comportamento ausente.

### 4.1 — Modelar mensagens, versões e vínculos com anexos

- [x] **Testes antes:** banco vazio e atualização de uma base sintética da etapa 3; anexos antigos continuam acessíveis; rejeitar vínculo entre mensagem e arquivo de chamados diferentes.
- [x] Criar mensagens com autor, chamado, Markdown, visibilidade, versão, datas e exclusão lógica.
- [x] Preservar revisões imutáveis do texto e da composição dos anexos.
- [x] Estender os anexos existentes com vínculo opcional à mensagem e registro de remoção. Anexos da abertura permanecem sem mensagem e compartilhados.
- [x] Criar índices para consultas paginadas por chamado, visibilidade e data, com desempate por identificador.
- [x] **Pronta quando:** testes de persistência e atualização passarem, cliente Prisma for gerado e tipos compilarem, sem perda dos registros existentes.

### 4.2 — Enviar e consultar conversas com isolamento

- [x] **Testes antes:** solicitante conversa com o setor; integrante publica nota interna; solicitante não recebe nota, contagem ou metadados internos; terceiro e administrador sem vínculo não acessam.
- [x] Implementar criação e leitura paginada; padrão de 20 itens, máximo de 100, ordenação estável.
- [x] Aplicar autorização antes da paginação e contagem. Autor vem da sessão, nunca do corpo enviado.
- [x] Aceitar mensagens em FECHADA; negar novos envios em setor desativado e por usuário inativo.
- [x] Gravar mensagem, atividade e evento pendente juntos. Eventos e histórico não devem copiar texto ou nomes de arquivos internos para registros compartilhados.
- [x] Testar transferência de setor e perda de vínculo: acesso segue o setor atual; o autor não mantém acesso especial à nota.
- [x] **Pronta quando:** testes de regras, API e integração passarem, incluindo rollback e ausência de vazamento por identificadores manipulados.

### 4.3 — Publicar anexos junto com a mensagem

- [ ] **Testes antes:** mensagem com arquivos, somente arquivos, tipo inválido, sexto arquivo, arquivo acima de 20 MB e ultrapassagem concorrente de 200 MB.
- [ ] Reutilizar validação real do conteúdo, armazenamento privado e estados de upload existentes. Limite de cinco arquivos ativos por mensagem e cinco novos por envio.
- [ ] Reservar capacidade antes do upload; publicar mensagem e arquivos somente após todos os uploads e a autorização final.
- [ ] Não manter transação de banco aberta durante transferência ao armazenamento.
- [ ] Usar identificador de envio para impedir duplicação em repetição após perda de resposta; rejeitar reaproveitamento com conteúdo diferente.
- [ ] Proteger também a listagem geral de anexos e a rota antiga de download. Um arquivo interno não pode escapar por esses caminhos.
- [ ] Testar falha parcial, queda após upload, revogação durante envio/download e recuperação pela limpeza existente, em lotes de até 100 e janela de 30 minutos.
- [ ] **Pronta quando:** nenhuma publicação parcial aparecer, reenvios não duplicarem mensagens e as regressões de anexos da etapa 3 passarem.

### 4.4 — Editar, consultar versões e excluir

- [ ] **Testes antes:** autor corrige texto, acrescenta/remove arquivo e consulta versões; outro integrante tenta alterar; autor perde acesso; duas sessões editam a mesma versão.
- [ ] Exigir versão esperada para editar/excluir; retornar conflito sem sobrescrever silenciosamente.
- [ ] Publicar edição e novos arquivos juntos. Se upload ou gravação falhar, conservar texto e anexos anteriores.
- [ ] Rejeitar edição que deixe a mensagem sem texto e sem arquivos. Não permitir trocar sua visibilidade.
- [ ] Registrar nova revisão apenas quando houver alteração efetiva; manter arquivos removidos indisponíveis e contabilizados.
- [ ] Excluir logicamente, bloquear versões e downloads e manter marcador. Conteúdo retido não terá endpoint de consulta administrativa nesta etapa.
- [ ] Testar disputa entre exclusão, edição e download, inclusive perda de permissão durante operações.
- [ ] **Pronta quando:** testes de autoria, versões, concorrência e bloqueio de conteúdo passarem.

### 4.5 — Entregar a conversa na interface

- [ ] **E2E antes:** escrever os roteiros de envio, recarga, nota interna, edição, versões, exclusão, conflito e falha com preservação do rascunho.
- [ ] Acrescentar conversa paginada ao detalhe, mantendo histórico operacional separado.
- [ ] Usar componentes shadcn/ui existentes, com editor de Markdown e prévia; distinguir claramente “Mensagem compartilhada” e “Nota interna”.
- [ ] Mostrar autor, data, “editada”, anexos ativos e marcador de exclusão; ações limitadas às capacidades retornadas pelo servidor.
- [ ] Atualizar consultas após operações e pelo botão de atualização existente; sem prometer tempo real.
- [ ] Renderizar Markdown com `react-markdown`, sem HTML embutido, imagens externas, MDX ou execução de código. Suportar títulos, listas, citações, links e blocos de código; manter a proteção de URLs da biblioteca. [Referência oficial](https://github.com/remarkjs/react-markdown).
- [ ] Testar Markdown malicioso na prévia, conversa e versões; teclado, foco, temas, tela pequena, estados de erro e `cursor-pointer` nos controles.
- [ ] **Pronta quando:** E2E dos cenários passarem e a conferência visual/manual não encontrar impedimentos de uso.

### 4.6 — Validar a etapa completa e documentar

- [ ] Executar `pnpm check`, `pnpm build`, integrações de identidade/chamados/conversas e E2E pertinentes.
- [ ] Selecionar explicitamente as integrações novas: o comando atual `test:integration` executa somente identidade.
- [ ] Demonstrar a jornada com contas sintéticas de solicitante, integrante, terceiro e administrador sem vínculo.
- [ ] Revisar independentemente permissões, arquivos internos, concorrência e publicação conjunta; corrigir e reavaliar bloqueios.
- [ ] Atualizar planejamento, arquitetura e operação, incluindo retenção, consumo de quota, limpeza e evidências RED/GREEN de cada tarefa.
- [ ] **Pronta quando:** todas as tarefas anteriores e verificações obrigatórias passarem, sem falhas ou testes obrigatórios pulados tratados como aprovação.

## Contratos e reaproveitamento técnico

Adicionar, sob `/api/tickets/{id}/messages`:

| Operação | Contrato |
| --- | --- |
| `GET` | Mensagens autorizadas e paginadas, com capacidades do usuário |
| `POST` | Markdown, visibilidade, identificador de envio e arquivos opcionais |
| `PATCH /{messageId}` | Versão esperada, Markdown, anexos mantidos e novos arquivos |
| `DELETE /{messageId}` | Exclusão lógica com versão esperada |
| `GET /{messageId}/revisions` | Versões paginadas, sob a mesma autorização da mensagem |

Criação e edição usam multipart com limites reais do corpo, reaproveitando o processamento existente. Respostas nunca expõem chaves do armazenamento. Repetições de operações continuam exigindo autorização atual. **Contrato parcial implementado na 4.2:** GET e POST somente texto (`markdown` e `visibility`); arquivos e identificador de envio serão acrescentados na 4.3. PATCH, DELETE e revisões ainda não existem. Não repetir automaticamente o POST antes da idempotência da 4.3.

Referências centrais:

- [Modelo de dados](../packages/database/prisma/schema.prisma).
- [Serviço de anexos existente](../packages/infrastructure/src/ticket-attachments.ts).
- [Detalhe do chamado](../apps/web/src/components/tickets/detail.tsx).

## Execução, riscos e conclusão

A sequência será **4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6**, com testes e documentação acompanhando cada tarefa. As tarefas menores integram uma única entrega e um único PR.

Criar branch exclusiva `codex/etapa-4-conversas` a partir da `main` conferida. Preservar os três documentos modificados no encerramento da etapa 3. A mudança exige mais de cinco arquivos porque envolve persistência, contratos, regras, APIs, interface e testes distintos.

**Risco alto:** vazamento de notas/anexos internos e inconsistência entre banco e armazenamento. A retenção escolhida também pode esgotar a quota mesmo após remoções; isso deve ficar claro na interface. Não haverá exclusão física automática desses arquivos nesta etapa.

Mudanças de banco, autorização e inclusão da dependência Markdown exigem autorização específica antes da execução, conforme o AGENTS.md. Commits, push, PR, escrita no Linear, merge e deploy conservam suas autorizações próprias. Organizar commits por responsabilidade, mantendo testes necessários junto ao comportamento e sem adiar TDD.

Cada tarefa só fica **validada localmente quando seus testes passarem**. A etapa só fica concluída após validação integral, revisão e integração autorizada à `main`.

No registro inicial do planejamento, nenhum teste novo havia sido escrito ou executado; a execução da 4.1 está descrita abaixo. Modelo sugerido no planejamento: GPT-6.1 com esforço alto de raciocínio, pela combinação de permissões, versões e falhas de upload.

### Registro documental

Plano salvo na branch documental `codex/docs-planejamento-etapa-4`, criada sobre `7cc970efcaf4d6fb5b2e66e302b05b25e274eb70`, mesma referência da `main` local na conferência. Alterações preexistentes em `docs/etapa-3-execucao.md`, `docs/etapa-3-planejamento.md` e `docs/plano-implementacao.md` foram preservadas sem edição por esta tarefa. O registro do plano não autoriza implementação nem operações protegidas.

### Execução da 4.1 — 17/11/2026

O usuário autorizou explicitamente alterações de schema/migration e aplicação exclusivamente em bancos locais sintéticos. Branch `codex/etapa-4-conversas`, criada sobre a `main` conferida com o remoto em `7cc970e`. Os três documentos preexistentes da etapa 3/plano geral permanecem sem novas alterações. Esta execução usa `implement-issue` e revisão independente via `review-delivery`.

Foram alterados sete arquivos da tarefa: schema, migration `202611170001_messages`, runner `test-message-persistence.mjs`, integração `message-persistence.integration.test.ts`, este plano, arquitetura e operação. A composição de anexos fica em um snapshot JSON imutável com ID e nome, evitando linhas filhas que possam mudar o histórico. A migration valida o snapshot e protege o vínculo entre chamados. [Modelo, contratos e limites](architecture.md#persistência-de-conversas--tarefa-41).

Evidências executadas:

| Verificação | Resultado |
| --- | --- |
| `node scripts/test-message-persistence.mjs` e `--upgrade-only`, antes da implementação | RED: ambos falharam em `TicketMessage migration is missing`, após preparar corretamente as bases da etapa 3 |
| `docker exec cifradesk-etapa34-tools pnpm db:generate` | Schema válido; Prisma Client 7.10.1 gerado |
| `node scripts/test-message-persistence.mjs`, após implementação | GREEN em banco vazio e atualização; constraints, preservação de registros, snapshots, remoção lógica, quota retida e índices verificados |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, pelo runner | Sem diferenças estruturais nos dois cenários; checks/triggers são verificados pelos testes SQL |
| Integração Prisma selecionada pelo runner | 3 testes aprovados em cada cenário: download legado, publicação transacional do modelo e rollback de vínculo inválido |
| `docker exec cifradesk-etapa34-tools pnpm check` | Lint e tipagem aprovados; 86 testes aprovados, 50 integrações puladas pelo comando geral. As 3 de mensagens foram executadas explicitamente em cada cenário acima |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker compilados |
| `node scripts/test-ticket-persistence.mjs` | Regressão SQL da etapa 3 aprovada antes e depois da alteração, em base vazia e atualização |
| `node scripts/test-ticket-queries.mjs` | 12 integrações aprovadas, incluindo paginação com 2.000 chamados sintéticos |
| `node scripts/test-ticket-operations.mjs` | 8 integrações aprovadas |
| `docker exec cifradesk-etapa34-tools pnpm exec eslint scripts/test-message-persistence.mjs --max-warnings 0` | Runner final aprovado após acrescentar comparação de schema |

As bases finais de mensagens foram `messages41_test_ff6f540b4dd1550da496` e `messages41_test_79c0fcd7a7d4f238a422`, com papéis próprios sem privilégios administrativos. Nenhum dado de aplicação ou produção foi migrado. O gerenciador de Node no host não encontrou a versão exigida; o Node 24.22.1 disponível no aplicativo apenas orquestrou Docker, enquanto geração, build e integrações usaram Node 24.22.3 no container. Uma expectativa inicial sobre aspas na descrição de índice foi corrigida após inspecionar `pg_indexes`; não foi falha de schema.

Revisão independente preliminar do código e reavaliação da documentação/runner final: nenhum bloqueador identificado para a 4.1. Pontos de atenção: listagem/download antigos ainda não isolam anexos de mensagens internas; publicação, autoria, incremento de versão e bloqueio de mensagem vazia serão implementados nas próximas tarefas; imutabilidade depende do trigger SQL. Não habilitar publicadores antes das proteções previstas. Não foram executados E2E, S3 real ou a regressão integral da identidade nesta tarefa sem UI ou mudança de autorização. As regressões de consultas/operações emitiram aviso de depreciação de consultas concorrentes no mesmo cliente `pg`, sem falha; esses caminhos não foram alterados nesta tarefa.

Roteiro de conferência: gerar o cliente, executar o runner de persistência, conferir os dois cenários e a ausência de diferenças de schema; executar `pnpm check` e `pnpm build` no container atualizado. Não há nova tela para validação manual. [Preparo do ambiente](operations.md#persistência-de-conversas--tarefa-41).

Commit local autorizado: `feat: modela mensagens e revisões da etapa 4.1`, incluindo os sete arquivos da tarefa, com migration, testes necessários à sua consistência e documentação. Arquivos críticos: schema e migration; os testes de integridade não são boilerplate. As evidências acima antecedem o commit; seu hash pertence ao histórico Git. Push e abertura de PR foram expressamente vedados pelo usuário nesta entrega. Nenhum comentário no Linear, merge ou deploy foi executado. O único PR da etapa 4 depende do escopo completo e de autorização própria.

### Execução da 4.2 — 17/11/2026

O usuário autorizou especificamente as regras de autorização e testes locais sintéticos, vedando commit, push e PR. Continuação na branch `codex/etapa-4-conversas`, sobre `8f03dc3`. Os três documentos preexistentes (`etapa-3-execucao.md`, `etapa-3-planejamento.md`, `plano-implementacao.md`) foram preservados sem edição. Não houve nova migration, dependência, interface ou acesso a produção.

Foram alterados onze arquivos da tarefa: contratos, serviço e exportação de infraestrutura, adaptador HTTP, rota, testes HTTP, integração, runner e três documentos (este plano, arquitetura e operação). A divisão mantém autorização/transação no serviço e parsing na fronteira HTTP. [Contrato vigente e limites](architecture.md#conversas-com-isolamento--tarefa-42).

Critérios atendidos: publicação compartilhada/interna, autor da sessão, limite de texto e rejeição de campos forjados, paginação 20/100 com desempate, isolamento de texto/IDs/contagem/histórico, recusa de terceiros/administrador sem vínculo, conta inativa e sessão revogada, FECHADO sem reabertura, setor desativado somente leitura, transferência e perda de vínculo sem privilégio por autoria, revisão inicial e rollback integral quando o outbox falha. Mensagens marcadas como removidas não retornam texto retido. Anexos e reenvio idempotente continuam na 4.3.

| Verificação | Evidência real |
| --- | --- |
| `node scripts/test-ticket-messages.mjs`, RED | Base `messages42_test_d35e5e5fcf5c20ff04e7` preparada com papel restrito; oito cenários falharam por serviço ainda não implementado. O teste inicial de rollback passou por aceitar qualquer erro; foi fortalecido para exigir a falha SQL sintética, sem contar esse resultado inicial como evidência de rollback. |
| Mesmo runner, GREEN | Nove integrações aprovadas em `messages42_test_f59380d67e3b4c4e2f9b`, incluindo rollback com falha injetada no outbox e paginação de 105 mensagens com data empatada. |
| `docker exec cifradesk-etapa34-tools pnpm exec vitest run apps/web/src/app/api/tickets/messages.test.ts` | RED: seis falhas esperadas com handlers provisórios 501. GREEN: seis aprovados após implementação; sessão, origem, multipart, duplicatas, campos forjados, limite real de bytes e erros. |
| `docker exec cifradesk-etapa34-tools pnpm check` | Lint e tipagem aprovados; 92 testes aprovados, 59 integrações puladas pelo comando geral. Nove de conversas foram executadas pelo runner específico. |
| `node scripts/test-ticket-queries.mjs` | 12 integrações aprovadas em `tickets35_test_54b658738a2ef6778734`, incluindo o cenário existente de 2.000 chamados sintéticos. |
| `node scripts/test-ticket-operations.mjs` | Oito integrações aprovadas em `tickets36_test_8f8070b20adb19734241`. |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker compilados, incluindo a nova rota de mensagens. |

O Node 24.22.0 instalado no host apenas orquestrou Docker; testes e compilação usaram o runtime da imagem existente. As integrações emitiram o aviso de depreciação de consultas concorrentes no mesmo cliente `pg` já observado na 4.1; não houve falha. Não foram executados E2E, conferência manual de navegador, S3 ou a suíte integral de identidade nesta tarefa sem interface, arquivos ou alteração nos serviços administrativos. As regras de conversa usam contas/vínculos sintéticos e serviços reais de transferência/remoção de vínculo nos testes.

Autoauditoria do working tree e revisão independente via `review-delivery`: nenhum bloqueador confirmado. A revisão é preliminar, não a auditoria de `main..HEAD` para publicação; o revisor examinou código/testes e as evidências, sem reexecutar as suítes. Limites: offset pode deslocar itens entre requisições; lock global pode limitar vazão; falta idempotência até a 4.3. A corrida simultânea envio × revogação não teve teste determinístico novo nesta tarefa; a análise conferiu o lock compartilhado e os testes cobriram acesso após revogação/transferência. Os caminhos legados de arquivos continuam impróprios para anexos internos; o POST da 4.2 rejeita arquivos e vínculos de anexos.

Documentação atualizada: contrato e limites em arquitetura, execução e conferência manual em operação, checklist e evidências neste planejamento. Nenhum comentário no Linear, commit, push, PR, merge ou deploy foi executado. A etapa 4 completa segue pendente das tarefas 4.3–4.6 e da integração autorizada.

Divisão autorizada posteriormente pelo usuário para os commits locais: `feat: implementa conversas isoladas da etapa 4.2` (contrato, serviço, exports e integração/runner); `feat: expõe API de conversas da etapa 4.2` (adaptador, rota, testes HTTP e documentação do endpoint). Cada agrupamento deverá ser validado no estado real antes de criar commits; não separar os testes necessários à consistência do comportamento.

### Commits locais da 4.2 — 17/11/2026

Após a entrega acima, o usuário autorizou somente os commits locais, preservando as alterações preexistentes. Primeiro commit: `cfb9ec6 feat: implementa conversas isoladas da etapa 4.2`. Seu estado intermediário passou em `pnpm typecheck` numa cópia isolada do índice Git, sem os arquivos HTTP ainda não commitados. O segundo agrupamento contém adaptador, rota, testes HTTP e os três documentos atualizados. A documentação consolidada acompanha esse agrupamento para registrar o contrato completo da 4.2. O estado final de código corresponde ao que passou em check, build e integrações na entrega; houve apenas remoção de linha vazia excedente no runner. Push, PR, merge e escrita no Linear continuam fora da autorização. A auditoria de publicação da etapa 4 completa permanece para depois das tarefas 4.3–4.6.
