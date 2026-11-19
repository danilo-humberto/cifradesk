# Etapa 4 — Conversas e anexos

Data: 17/11/2026. Acompanhamento da 4.6: 19/11/2026.

Status atualizado em 19/11/2026: tarefas 4.1–4.6 implementadas e validadas localmente, com revisão independente aprovada. A 4.5 foi registrada no commit `fb16e62` e incorporada à base local `feat/etapa-4`, commit `b26ac2c`. A 4.6 parte dessa base na branch `codex/etapa-4-6-validacao`. A 4.1 tem commit `8f03dc3`; a 4.2 tem `cfb9ec6` e `d413e8a`; a 4.3 tem `5a946ec`; a 4.4 tem `4212b3c`. Commit local e push da branch autorizados nesta entrega; PR e integração à `main` permanecem pendentes de autorização. Referência de escopo: [plano de implementação](plano-implementacao.md).

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

- [x] **Testes antes:** mensagem com arquivos, somente arquivos, tipo inválido, sexto arquivo, arquivo acima de 20 MB e ultrapassagem concorrente de 200 MB.
- [x] Reutilizar validação real do conteúdo, armazenamento privado e estados de upload existentes. Limite de cinco arquivos ativos por mensagem e cinco novos por envio.
- [x] Reservar capacidade antes do upload; publicar mensagem e arquivos somente após todos os uploads e a autorização final.
- [x] Não manter transação de banco aberta durante transferência ao armazenamento.
- [x] Usar identificador de envio para impedir duplicação em repetição após perda de resposta; rejeitar reaproveitamento com conteúdo diferente.
- [x] Proteger também a listagem geral de anexos e a rota antiga de download. Um arquivo interno não pode escapar por esses caminhos.
- [x] Testar falha parcial, queda após upload, revogação durante envio/download e recuperação pela limpeza existente, em lotes de até 100 e janela de 30 minutos.
- [x] **Pronta quando:** nenhuma publicação parcial aparecer, reenvios não duplicarem mensagens e as regressões de anexos da etapa 3 passarem.

### 4.4 — Editar, consultar versões e excluir

- [x] **Testes antes:** autor corrige texto, acrescenta/remove arquivo e consulta versões; outro integrante tenta alterar; autor perde acesso; duas sessões editam a mesma versão.
- [x] Exigir versão esperada para editar/excluir; retornar conflito sem sobrescrever silenciosamente.
- [x] Publicar edição e novos arquivos juntos. Se upload ou gravação falhar, conservar texto e anexos anteriores.
- [x] Rejeitar edição que deixe a mensagem sem texto e sem arquivos. Não permitir trocar sua visibilidade.
- [x] Registrar nova revisão apenas quando houver alteração efetiva; manter arquivos removidos indisponíveis e contabilizados.
- [x] Excluir logicamente, bloquear versões e downloads e manter marcador. Conteúdo retido não terá endpoint de consulta administrativa nesta etapa.
- [x] Testar disputa entre exclusão, edição e download, inclusive perda de permissão durante operações.
- [x] **Pronta quando:** testes de autoria, versões, concorrência e bloqueio de conteúdo passarem.

### 4.5 — Entregar a conversa na interface

- [x] **E2E antes:** escrever os roteiros de envio, recarga, nota interna, edição, versões, exclusão, conflito e falha com preservação do rascunho.
- [x] Acrescentar conversa paginada ao detalhe, mantendo histórico operacional separado.
- [x] Usar componentes shadcn/ui existentes, com editor de Markdown e prévia; distinguir claramente “Mensagem compartilhada” e “Nota interna”.
- [x] Mostrar autor, data, “editada”, anexos ativos e marcador de exclusão; ações limitadas às capacidades retornadas pelo servidor.
- [x] Atualizar consultas após operações e pelo botão de atualização existente; sem prometer tempo real.
- [x] Renderizar Markdown com `react-markdown`, sem HTML embutido, imagens externas, MDX ou execução de código. Suportar títulos, listas, citações, links e blocos de código; manter a proteção de URLs da biblioteca. [Referência oficial](https://github.com/remarkjs/react-markdown).
- [x] Testar Markdown malicioso na prévia, conversa e versões; teclado, foco, temas, tela pequena, estados de erro e `cursor-pointer` nos controles.
- [x] **Pronta quando:** E2E dos cenários passarem e a conferência visual/manual não encontrar impedimentos de uso.

### 4.6 — Validar a etapa completa e documentar

- [x] Executar `pnpm check`, `pnpm build`, integrações de identidade/chamados/conversas e E2E pertinentes.
- [x] Selecionar explicitamente as integrações novas: o comando atual `test:integration` executa somente identidade.
- [x] Demonstrar a jornada com contas sintéticas de solicitante, integrante, terceiro e administrador sem vínculo.
- [x] Revisar independentemente permissões, arquivos internos, concorrência e publicação conjunta; corrigir e reavaliar bloqueios.
- [x] Atualizar planejamento, arquitetura e operação, incluindo retenção, consumo de quota, limpeza e evidências RED/GREEN de cada tarefa.
- [x] **Pronta quando:** todas as tarefas anteriores e verificações obrigatórias passarem, sem falhas ou testes obrigatórios pulados tratados como aprovação.

## Contratos e reaproveitamento técnico

Adicionar, sob `/api/tickets/{id}/messages`:

| Operação | Contrato |
| --- | --- |
| `GET` | Mensagens autorizadas e paginadas, com capacidades do usuário |
| `POST` | Markdown, visibilidade, identificador de envio e arquivos opcionais |
| `PATCH /{messageId}` | Versão esperada, Markdown, anexos mantidos e novos arquivos |
| `DELETE /{messageId}` | Exclusão lógica com versão esperada |
| `GET /{messageId}/revisions` | Versões paginadas, sob a mesma autorização da mensagem |

Criação e edição usam multipart com limites reais do corpo, reaproveitando o processamento existente. Respostas nunca expõem chaves do armazenamento. Repetições continuam exigindo autorização atual. **Contrato implementado até a 4.4:** GET e POST com `markdown`, `visibility`, `submissionId` UUID obrigatório e até cinco `files` opcionais. Repetir a criação exige preservar identificador, texto, visibilidade, metadados, bytes e ordem dos arquivos. PATCH exige `expectedVersion`, `markdown`, `retainedAttachmentIds` em array JSON e arquivos opcionais; DELETE exige JSON com `expectedVersion`. Revisões usam paginação autorizada. Edição não tem chave de envio: se a resposta se perder, consultar antes de reaplicar. [Contratos completos](architecture.md#edição-revisões-e-exclusão--tarefa-44).

Referências centrais:

- [Modelo de dados](../packages/database/prisma/schema.prisma).
- [Serviço de anexos existente](../packages/infrastructure/src/ticket-attachments.ts).
- [Detalhe do chamado](../apps/web/src/components/tickets/detail.tsx).

## Execução, riscos e conclusão

A sequência será **4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6**, com testes e documentação acompanhando cada tarefa. As tarefas menores integram uma única entrega e um único PR.

Criar branch exclusiva `codex/etapa-4-conversas` a partir da `main` conferida. Preservar os três documentos modificados no encerramento da etapa 3. A mudança exige mais de cinco arquivos porque envolve persistência, contratos, regras, APIs, interface e testes distintos.

**Risco alto:** vazamento de notas/anexos internos e inconsistência entre banco e armazenamento. A retenção escolhida também pode esgotar a quota mesmo após remoções; isso deve ficar claro na interface. Não haverá exclusão física automática desses arquivos nesta etapa.

As autorizações específicas das mudanças de banco, autorização e dependência Markdown estão registradas nas execuções 4.1–4.5. A 4.6 reaplica somente migrations existentes em bancos sintéticos, sem novo schema ou alteração da base de trabalho. Commits, push, PR, escrita no Linear, merge e deploy conservam suas autorizações próprias. Organizar commits por responsabilidade, mantendo testes necessários junto ao comportamento e sem adiar TDD.

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

### Execução da 4.3 — 17/11/2026

Autorização específica: alterações de autorização dos anexos e schema/migration para idempotência exclusivamente em bancos locais sintéticos; sem commit, push ou PR. Continuação da etapa 4 na branch `codex/etapa-4-conversas`, sobre `d413e8a`. Os três documentos preexistentes da etapa 3/plano geral foram preservados. Nenhuma escrita no Linear, alteração de dependência, UI, merge ou deploy.

Implementados: identificador obrigatório de envio, hash do conteúdo e tentativa persistida; reserva de quota antes do armazenamento; publicação conjunta com reautorização final e snapshot inicial dos arquivos; repetição sem duplicação; isolamento de reservas/anexos internos/removidos nos caminhos legados; recuperação pela limpeza existente. Schema, migration, contratos, serviços, adaptador/rota HTTP, testes/runners e três documentos foram necessários (16 arquivos), mantendo cada responsabilidade em sua fonte existente. [Contrato e limites](architecture.md#publicação-conjunta-e-idempotência--tarefa-43).

Evidências de desenvolvimento: antes da implementação, as nove integrações da 4.2 passaram. Os testes novos revelaram a rejeição de `submissionId` e a ausência do fluxo de anexos; o HTTP teve cinco falhas esperadas ao exigir identificador/arquivos. Duas falhas iniciais eram dados sintéticos inválidos (descrição curta e um arquivo de quase 200 MB), corrigidos para respeitar as constraints existentes; não contam como RED de comportamento. A tipagem apontou retorno possivelmente indefinido na união de reserva/publicação, corrigido com discriminador explícito. O container usa uma cópia do código: a primeira seleção encontrou somente o arquivo antigo; após sincronizar, as duas suítes executaram. O runner agora verifica a presença de ambos os arquivos para impedir omissão silenciosa.

| Verificação executada | Resultado |
| --- | --- |
| `docker exec cifradesk-etapa34-tools pnpm db:generate` | Schema válido e cliente Prisma gerado |
| `docker exec cifradesk-etapa34-tools pnpm check` | Lint, tipagem e 94 testes aprovados; 70 integrações puladas nesse comando geral, sem contá-las como aprovadas |
| `node scripts/test-ticket-messages.mjs` | 20 integrações aprovadas: nove regressões de conversas e onze cenários de anexos/idempotência |
| `node scripts/test-message-persistence.mjs` | Base vazia e atualização aprovadas; preservação dos anexos antigos, constraints, snapshots e schema sem diferença; três integrações Prisma em cada cenário |
| `node scripts/test-ticket-opening.mjs` | 12 integrações aprovadas, incluindo upload/download/remoção no SeaweedFS privado local com bucket sintético |
| `node scripts/test-ticket-queries.mjs` | 12 integrações aprovadas, incluindo paginação de 2.000 chamados sintéticos |
| `node scripts/test-ticket-operations.mjs` | Oito integrações aprovadas, incluindo disputa com revogação |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker compilados; depois houve somente reforço de teste/runner e documentação, com check e integrações reexecutados |
| `git diff --check` | Sem erros de whitespace |

Banco final de conversas: `messages42_test_7fe1651fdf3929f5994f`; persistência: `messages41_test_7a428613049523f78768` e `messages41_test_af17b447b022034157f3`. Migrations aplicadas sob papéis sintéticos sem superusuário/criação de bancos/papéis; recursos preparados no PostgreSQL Docker local. Nenhuma migration aplicada ao banco da aplicação. O Node disponível no aplicativo orquestrou Docker; testes/build usaram Node 24.22.3 do container. As integrações emitiram o aviso já conhecido de consultas concorrentes do cliente `pg`, sem falha.

Critérios verificados: mensagem com arquivos e somente arquivos; limites de cinco/20 MiB e quota de 200 MiB disputada com outro envio/rota legada; conteúdo falso; repetição igual/diferente; chave por autor; ausência de publicação parcial e rollback do evento; revisão inicial com anexos; ocultação de IDs/contagem; remoção e exclusão lógica; transferência, perda de vínculo e sessão revogada durante IO; limpeza após janela e lotes de 100; exclusão falhando sem liberar quota; execução antiga expirada não publica nem apaga o reenvio. O teste de queda representa o ponto após PUT e antes da publicação por estados persistidos e expiração controlada, sem matar processo real. Resposta perdida é representada por repetir a operação já concluída; não houve corte de conexão HTTP real.

Autoauditoria do diff de trabalho e revisão independente somente leitura por `review-agent`, em contexto limpo: nenhum bloqueador confirmado. O revisor examinou código, migration e testes, sem reexecutar suítes. A reavaliação final incluiu documentação e o teste de limites/constraints; o único ajuste editorial apontado foi corrigido. Os 13 arquivos de código, migration e testes foram comparados por SHA-256 com a cópia validada no container, sem divergências. Limites: escrita remota concluída após a última exclusão, seguida de queda, ainda pode deixar objeto órfão (limitação herdada); limpeza depende de execução operacional; corpo multipart em memória e lock global não foram ensaiados sob carga. A suíte nova usa armazenamento em memória; S3 local real foi exercitado pela regressão da etapa 3. E2E/UI e suíte integral de identidade não foram executados nesta tarefa; interface permanece na 4.5. A revisão é preliminar e não substitui a auditoria futura do histórico/PR completo.

Documentação atualizada: arquitetura (contrato, persistência e limites), operação (execução, reenvio e roteiro manual) e este acompanhamento de execução. Roteiro manual disponível em operação, não executado nesta entrega. Nenhum novo plano temporário foi criado em `docs/`.

Minuta curta para entrega, não publicada:

**O QUE E POR QUE**

Mensagem e arquivos são publicados juntos após validar acesso e reservar capacidade. O registro persistido de envio evita duplicação e diferencia arquivos provisórios dos anexos da abertura, reutilizando armazenamento e limpeza existentes.

**ALERTA DO SÊNIOR**

Nenhum bloqueador confirmado na revisão preliminar. Limpeza depende da janela/execução operacional e mantém a limitação herdada de escrita remota tardia; multipart em memória e lock global exigem avaliação futura de carga.

**FOCO DE REVISÃO**

- `packages/infrastructure/src/ticket-messages.ts`: reserva, tentativa, reenvio e publicação atômica.
- `packages/infrastructure/src/ticket-attachments.ts`: filtro compartilhado com a listagem e revalidação de download.

Mensagem sugerida, sem execução: `feat: publish message attachments atomically with idempotent retries`.

### Registro do commit local da 4.3 — 17/11/2026

Após a entrega, o usuário autorizou um commit local da 4.3, preservando as alterações preexistentes e vedando push e PR. Os 16 arquivos da tarefa formam uma unidade coerente de persistência, publicação, API, testes e documentação. O código foi comparado por SHA-256 com os 13 arquivos correspondentes no container validado, sem divergências; não houve nova alteração de comportamento. O artefato local de build está ignorado e não integra o commit. Os três documentos preexistentes da etapa 3/plano geral ficam fora do índice. Mensagem: `feat: publish message attachments atomically with idempotent retries`. O hash deve ser consultado no histórico Git, sem autorreferência neste documento.

### Execução da 4.4 — 17/11/2026

Pedido direto do usuário para iniciar a 4.4. Continuação na branch exclusiva `codex/etapa-4-conversas`, sobre `5a946ec`, conforme a entrega única da etapa 4. As três alterações preexistentes da etapa 3/plano geral permanecem preservadas, fora desta tarefa. Uso de `implement-issue` e revisão independente `review-delivery` após checks aprovados. Não houve nova migration, dependência ou alteração no banco da aplicação.

Fluxo implementado: versão esperada + texto/composição final → conferir autoria/acesso e reservar quota → upload fora da transação → conferir novamente e publicar edição, revisão, anexos/remoções, atividade e evento atomicamente. Exclusão incrementa versão e mantém marcador; versões/arquivos retidos ficam sem consulta após exclusão. Revisões preservam nomes, calculando disponibilidade pelo estado atual. Reserva provisória usa `messageId` existente e estados de anexo já disponíveis. [Detalhes e contratos](architecture.md#edição-revisões-e-exclusão--tarefa-44).

Evidências executadas:

| Verificação | Resultado |
| --- | --- |
| `node scripts/test-ticket-messages.mjs`, antes da implementação | RED em base sintética preparada: 14 testes novos falharam por operações ausentes (`editTicketMessage is not a function` e equivalentes); 20 regressões passaram |
| Teste HTTP novo, antes da implementação | RED: módulo das rotas ainda inexistente; nenhum caso HTTP executado nesta primeira tentativa |
| `node scripts/test-ticket-messages.mjs`, após implementação | GREEN: 34 integrações, sendo 14 novas, 9 de isolamento e 11 de anexos/idempotência; sem testes pulados |
| Testes HTTP de criação/mutações e corpo | 19 aprovados, incluindo 7 novos; versão, campos forjados/repetidos, limites reais do corpo, sessão, origem, conflitos e `no-store` |
| `docker exec cifradesk-etapa34-tools pnpm check` | Lint sem avisos, tipos aprovados, 101 testes aprovados e 84 integrações puladas por variável habilitadora ausente; as 34 de conversas foram executadas pelo runner específico acima |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker compilados; rotas de mensagem e revisões presentes no build |
| `node scripts/test-ticket-opening.mjs` | 12 integrações aprovadas, incluindo armazenamento SeaweedFS privado real local, em banco/bucket sintéticos |
| `node scripts/test-ticket-queries.mjs` | 12 integrações aprovadas, incluindo isolamento, paginação e volume sintético |
| `node scripts/test-ticket-operations.mjs` | 8 integrações aprovadas, incluindo conflitos e operações transacionais |
| Integridade e diff | 9 arquivos de código/testes/runner idênticos por SHA-256 à cópia validada no container; `git diff --check` sem erros |

O atalho Node do Windows não encontrou a versão exigida e não executou o primeiro runner; essa falha não conta como RED. O runner foi então acionado pelo Node do aplicativo, apenas para orquestrar Docker. Testes/compilação usaram Node 24.22.3 do container, PostgreSQL `postgres` em bases `messages42_test_*` e papéis restritos exclusivos; nenhuma credencial foi impressa. Aviso preexistente de consultas concorrentes do cliente `pg`, sem falha.

Cenários cobertos: edição com adição/remoção, mensagem só com arquivos, ausência de mudança, visibilidade fixa, IDs de outra mensagem/chamado e arquivo já removido, limites de arquivos/quota incluindo bytes retidos, conflito entre duas edições, exclusão durante upload, remoção/exclusão durante download, transferência e perda de vínculo/sessão durante upload, setor inativo, chamado FECHADO, expiração/limpeza, falha parcial de upload e rollback por falha de evento em edição/exclusão. Histórico/eventos internos não copiam texto/nomes; o solicitante não recebe IDs/contagens internos.

Autoauditoria do diff completo da tarefa e revisão independente somente leitura pelo `review-agent`, em contexto limpo: **APROVADO PARA ENTREGA**, sem achados concretos de correção. A revisão foi estática, sem reexecutar os testes/build; o executor verificou os resultados acima. Nenhuma revisão autoriza commit/push/PR/merge/deploy. Os três documentos preexistentes mantêm o diff anterior de 29 inserções e 12 remoções, fora da tarefa.

Documentação atualizada nesta tarefa: este planejamento, `architecture.md` e `operations.md`, com contratos efetivos, retenção/quota, recuperação e procedimento de reprodução. Interface/E2E são da 4.5; a validação integral da etapa é da 4.6. As integrações de identidade e persistência da 4.1 não foram reexecutadas nesta tarefa. Armazenamento dos testes novos é em memória; S3 real foi exercitado somente pela regressão da 3.4. Sem ensaio de carga ou corte real de conexão HTTP/S3. Limitações herdadas de multipart em memória, lock global, limpeza operacional e PUT remoto tardio permanecem.

#### Comentário curto pronto para o Linear — não publicado

**O QUE E POR QUE**

Edição/exclusão exigem autoria, acesso atual e versão esperada; revisões preservam o conteúdo histórico autorizado. Reserva e publicação reaproveitam o modelo/limpeza existentes e conservam a versão anterior em falhas, sem nova migration.

**ALERTA DO SÊNIOR**

Sem achados concretos de correção na revisão independente. Arquivos removidos/excluídos continuam na quota; uploads usam memória e o lock global não foi ensaiado sob carga. Testes novos usam armazenamento em memória; UI permanece na 4.5.

**FOCO DE REVISÃO**

- `packages/infrastructure/src/ticket-messages.ts`: autoria, acesso atual, conflitos, publicação/remoção e revisões.
- `apps/web/src/lib/server/tickets.ts`: limites e contrato multipart da edição.

Pedágio didático: versão esperada impede sobrescrita silenciosa; publicação transacional confirma todos os registros juntos; snapshot histórico não concede download. Caça aos erros silenciosos: exclusão/remoção durante download ou edição deve bloquear conteúdo/publicação; os testes alteram o estado durante o IO e verificam 404/409 e preservação da versão vencedora.

Mensagem sugerida, sem execução: `feat: add versioned message edits revisions and soft deletion`.

### Registro do commit local da 4.4 — 17/11/2026

Após a entrega, o usuário autorizou o commit local da 4.4, preservando alterações preexistentes e vedando push e PR. Os 12 arquivos da tarefa compõem uma unidade de contratos, serviços, rotas, testes, runner e documentação. Antes do commit, os nove arquivos de código/testes/runner foram comparados por SHA-256 com a cópia validada no container, sem divergências; não houve nova mudança de comportamento nem reexecução das suítes. Apenas este planejamento recebeu o registro da autorização. Artefatos de build estão ignorados e não integram o commit. Os três documentos preexistentes da etapa 3/plano geral ficam fora do índice, com integridade conferida por SHA-256. Mensagem autorizada: `feat: add versioned message edits revisions and soft deletion`. O hash deve ser consultado no histórico Git, sem autorreferência neste documento.

### Execução da 4.5 — 17/11/2026

Pedido direto para iniciar a 4.5, continuando a entrega única da etapa 4 na branch `codex/etapa-4-conversas`, sobre `4212b3c`. As três alterações preexistentes da etapa 3/plano geral foram preservadas. Sem migration, alteração de API/regra de servidor ou banco da aplicação; única dependência direta nova: `react-markdown@10.1.0`, prevista no plano, com lock atualizado. Skills aplicadas: `implement-issue`, `modern-web-guidance` (guias `security` e `forms`), checklist `react-best-practices` e revisão independente `review-delivery`.

Fluxo: texto/visibilidade/arquivos → editor com rascunho em memória → APIs autorizadas existentes, com identificador de criação ou versão de edição → mensagem e anexos publicados juntos → invalidação das consultas de conversa, anexos e histórico. Conversa e histórico operacional ficam separados. Ações usam capacidades do servidor; prévia/mensagens/revisões compartilham a renderização Markdown sem HTML/imagens/MDX/execução de código. [Comportamento e limites](architecture.md#interface-da-conversa--tarefa-45), [reprodução](operations.md#interface-de-conversa--tarefa-45).

Evidências executadas:

| Verificação | Resultado |
| --- | --- |
| `node scripts/test-ticket-interface.mjs --messages --grep "envia Markdown"`, antes da interface | RED: desktop e celular falharam em `Conversa do chamado` ausente; base sintética/servidor/autenticação funcionaram |
| Primeira execução de `--messages` | 18/20 passaram; resposta perdida na edição revelou lista desatualizada ao cancelar, corrigida com invalidação da conversa |
| Segunda execução de `--messages` | 20/20 passaram, desktop e celular Chromium, um worker, sem retries; inclui S3 real privado local |
| Regressão `--messages --grep "perda parcial"`, antes da correção da revisão | RED: desktop e celular atingiram timeout procurando “Encerrar edição” ausente após perder vínculo mantendo acesso ao chamado |
| Execução de `--messages`, após corrigir os dois achados médios | GREEN: 22/22 passaram, desktop/celular, sem retries; inclui perda parcial de vínculo, rascunho interno e desativação durante edição |
| Regressão de foco após cancelar, antes da correção baixa | RED: desktop/celular falharam na asserção de foco em “Editar” após cancelar a edição |
| Primeira tentativa de foco adiado por frame | Cancelamento passou; 20/22 revelaram a corrida equivalente no foco de nova mensagem após envio. Asserções mantidas |
| Execução final de `--messages`, após sincronizar foco com a atualização dos elementos | GREEN: 22/22 passaram, incluindo foco após envio/cancelamento; desktop e celular, um worker, zero retries |
| `docker exec cifradesk-etapa34-tools pnpm check` | Lint sem avisos, tipos aprovados, 101 testes aprovados; 84 integrações puladas sem habilitador, não tratadas como aprovação |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker compilados |
| `node scripts/test-ticket-messages.mjs` | 34/34 integrações aprovadas, selecionadas explicitamente em banco sintético |
| `node scripts/test-ticket-interface.mjs` | 16/16 regressões da interface de chamados aprovadas, desktop e celular, sem retries |
| Integridade/diff | Nove arquivos de código/testes/runner/package/lock idênticos por SHA-256 ao container; `git diff --check` sem erros |

Os roteiros cobrem envio/recarga, Markdown malicioso nos três contextos, isolamento de nota/arquivo e negação a administrador sem vínculo, upload/download real e só arquivos, edição com adição/remoção, versões, marcador de exclusão e bloqueio de revisões/download, conflito entre sessões, perda de resposta sem duplicação/reaplicação, falha de validação/consulta preservando rascunho, capacidades de autoria, paginação, FECHADO, setor inativo, teclado/foco, temas e ausência de rolagem horizontal. O corte de resposta usa injeção do Playwright, sem interrupção real de rede.

Revisão independente inicial, somente leitura em contexto limpo: dois achados médios na perda parcial de capacidade, mantendo acesso como solicitante. A edição oculta deixava `editing` bloqueando ações/paginação; o compositor interno escondia o seletor ao perder vínculo, sem saída para mudar explicitamente de visibilidade. Ambos corrigidos: saída externa para encerrar edição indisponível, seletor preservado para rascunho interno com opção interna/envio bloqueados e escolha explícita de compartilhamento. Novo E2E reproduziu a ausência da saída antes da correção e passou depois em desktop/celular. A reavaliação apontou foco após cancelar como observação baixa, também reproduzida e corrigida. A restauração de foco no envio/cancelamento agora ocorre em efeitos após atualizar os elementos, sem corrida com controles desabilitados. Reavaliação independente final: **APROVADO PARA ENTREGA**, sem achados concretos restantes; revisão estática, sem executar suítes. O executor repetiu check/build e os 22 E2E no estado final; as 34 integrações e 16 regressões de chamados antecederam essas correções pontuais de interface, sem alteração de backend.

Inspeção visual pelo executor das capturas do editor/conversa em desktop/celular e claro/escuro, incluindo captura da área visível para distinguir artefatos do recorte longo, sem impedimento visual identificado nessas imagens. Teclado/foco foram verificados pelos testes. Não houve teste com leitor de tela humano, usuários, Firefox/Safari ou ensaio de carga. A validação integral da etapa, incluindo todas as suítes de identidade/persistência e auditoria do histórico completo, permanece na 4.6. Rascunho não sobrevive a recarga/navegação; bytes removidos continuam na quota; limites de multipart em memória, lock global, limpeza operacional e escrita S3 tardia são herdados.

Documentos atualizados: este planejamento, `architecture.md` e `operations.md`. Sem commit, push, PR, Linear, merge ou deploy. O PR único da etapa 4 depende da 4.6 e de autorização própria.

#### Comentário curto pronto para o Linear — não publicado

**O QUE E POR QUE**

Conversa paginada no detalhe, com Markdown seguro, anexos, notas internas, edição, versões e exclusão. Reaproveita as APIs e os componentes shadcn existentes; identificador de criação e versão esperada evitam duplicação/sobrescrita silenciosa.

**ALERTA DO SÊNIOR**

Sem achados concretos pendentes após corrigir perda parcial de capacidade e foco. Rascunho vive apenas em memória e arquivos removidos continuam na quota. Sem validação em Firefox/Safari, leitor de tela humano ou carga.

**FOCO DE REVISÃO**

- `apps/web/src/components/tickets/message-editor.tsx`: rascunho, reenvio, versão esperada e visibilidade após perda de vínculo.
- `apps/web/src/components/tickets/conversation.tsx`: capacidades, paginação, edição indisponível e exclusão.

Pedágio didático: repetir o mesmo identificador torna a criação idempotente (não duplica o envio); versão esperada detecta alterações entre sessões; capacidade orienta a tela, mas a autorização continua no servidor. Caça aos erros silenciosos: perder vínculo durante edição pode bloquear a tela mesmo sem vazar dados; o novo E2E remove o vínculo mantendo o solicitante, verifica ocultação da nota, saída da edição, navegação e compartilhamento somente por escolha explícita.

Mensagem sugerida, sem execução: `feat: add ticket conversation interface with safe markdown`.

### Execução da 4.6 — 19/11/2026

Pedido direto do usuário: iniciar a 4.6 a partir de `feat/etapa-4`. Criada a branch exclusiva `codex/etapa-4-6-validacao` sobre `b26ac2c`. A base contém a interface da 4.5 em `fb16e62`; a integração com `main` permanece pendente. As alterações preexistentes em `AGENTS.md` e nos documentos da etapa 3 foram preservadas integralmente. O plano geral já tinha mudanças locais; esta tarefa atualiza somente o estado atual e a seção da etapa 4, conservando o encerramento da etapa 3.

Não houve mudança de regra de negócio, schema, dependência ou interface nesta tarefa. O E2E de isolamento foi reforçado porque o auxiliar anterior criava todos os participantes como administradores. Agora solicitante, integrante e terceiro são contas comuns, com um quarto administrador sem vínculo; os papéis são conferidos pela API. O roteiro verifica troca compartilhada, nota com arquivo, contagem filtrada, negação de leitura/envio/download/revisões e perda de vínculo. O auxiliar também cria integrante comum no teste de autoria. O runner completo seleciona todos os `.spec.ts` de produção e exclui explicitamente o smoke de HMR, que exige `next dev` e continua com comando próprio.

A primeira execução completa revelou uma suposição incorreta nos testes antigos de visualizações/abertura: buscavam o setor somente na primeira página do seletor. Os dados sintéticos de conversa fazem o total ultrapassar 20; o registro da falha mostra apenas setores “Conversa”/“Origem” na página inicial e a espera pela opção de outra página. Acrescentado auxiliar E2E compartilhado que fecha o seletor, avança sua paginação visível, aguarda o carregamento e procura a opção exata. O teste de visualizações agora distingue a paginação do seletor da paginação dos chamados. As asserções de conteúdo, filtros, página, foco e navegação foram mantidas; sem retries ou aumento de timeout.

Na segunda execução, esses três casos passaram, mas a posição alfabética aleatória revelou a mesma suposição no teste administrativo de setores. O roteiro também passou a percorrer a paginação visível da administração, aguardando a resposta da consulta e o fim do carregamento. Nenhum teste foi retirado ou teve timeout ampliado.

Preparação: fontes versionadas sincronizadas por arquivo tar, instalação com lock congelado e cliente Prisma gerado. Identidade usa projeto Compose explícito `cifradesk-identity-tests`, banco `identity_test`, Mailpit próprio e rede separada conectada às ferramentas. Destino conferido antes de aplicar as quatro migrations existentes somente no banco sintético. Chamados/conversas usam bases exclusivas criadas pelos runners; nenhuma migration foi aplicada à base de trabalho. O Node 24.22.0 instalado no host apenas orquestrou Docker; testes e compilação usaram Node 24.22.3/pnpm 10.34.9 do container. O atalho Node recusou a faixa de versão antes de executar o runner; isso não conta como falha do produto nem como RED.

| Verificação em 19/11/2026 | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` e `pnpm db:generate` no container | Lock preservado, schema válido, Prisma Client 7.10.1 gerado |
| `docker exec cifradesk-etapa34-tools pnpm check`, após reforçar teste/runner | Lint sem avisos e tipos aprovados; 101 testes aprovados. As 84 integrações puladas foram executadas pelos comandos específicos abaixo |
| `node scripts/test-stage-three.mjs` | 15 integrações de identidade, 12 de abertura/anexos, 12 de consultas e 8 de operações aprovadas; persistência SQL de chamados em base vazia/atualização também aprovada |
| `node scripts/test-message-persistence.mjs` | SQL, preservação dos registros, snapshots, constraints, índices e schema sem diferenças nos dois cenários; 3 integrações Prisma aprovadas em cada cenário |
| `node scripts/test-ticket-messages.mjs` | 34/34 integrações aprovadas: 9 de isolamento, 11 de anexos/idempotência e 14 de edição/exclusão/revisões; nenhuma pulada |
| `docker exec cifradesk-etapa34-tools pnpm build` | Web e worker compilados; rotas de conversa/revisões incluídas |
| Primeira execução de `node scripts/test-ticket-interface.mjs --all` | 83/86 aprovados; três falhas no celular por buscar setor fora da primeira página do seletor. Os 22 cenários de conversa passaram |
| Segunda execução completa após corrigir os seletores | 85/86 aprovados; os três casos anteriores passaram. Uma falha no teste administrativo de setores pela mesma suposição de primeira página |
| Execução completa após corrigir também o roteiro administrativo | **86/86 aprovados**, em 5,0 minutos; Chromium desktop/celular, um worker, zero retries, nenhuma falha ou teste pulado |
| Igualdade entre fontes e execução | SHA-256 de 203 arquivos versionados não Markdown idênticos entre host e container |

Total de integração: **84 testes distintos / 87 execuções**, pois os três de persistência Prisma rodam em base vazia e atualização. SQL de persistência é verificado adicionalmente por asserções dos runners. Bases desta execução: `identity_test`, `tickets_test_d6e439d1f6a347318371682f51ca4651`, `tickets_test_f3ed5d2e49c84cdcb3c921eea5559fb4`, `tickets34_test_b017e3f09b0f1ac995ee`, `tickets35_test_af08af10f31ab1c191b6`, `tickets36_test_79563297f61c11a32777`, `messages41_test_f8bf4354dd71733b8907`, `messages41_test_fd059d347724e88a6613` e `messages42_test_84e1070e2d5093f096fb`. E2E inicial: `tickets37_test_25f30ef7846191c2f723`; segunda execução: `tickets37_test_4a493d0d86d1516406d5`; execução final aprovada: `tickets37_test_09f23868ea89c90db60b`. Recursos sintéticos ficam preservados para diagnóstico. Aviso preexistente do cliente `pg` sobre consultas concorrentes nas integrações, sem falha; não houve alteração de driver.

Evidências RED/GREEN das tarefas anteriores, preservadas neste documento:

| Tarefa | RED de comportamento registrado | GREEN registrado e regressão na 4.6 |
| --- | --- | --- |
| [4.1](#execução-da-41--17112026) | `TicketMessage migration is missing`, com bases sintéticas preparadas | Base vazia/atualização, SQL e três integrações por cenário aprovados novamente |
| [4.2](#execução-da-42--17112026) | Serviço ausente e handlers HTTP provisórios 501 | Nove integrações de isolamento e oito testes HTTP atuais aprovados novamente |
| [4.3](#execução-da-43--17112026) | Rejeição de `submissionId`, ausência do fluxo de anexos e cinco falhas HTTP esperadas | Onze integrações de anexos/idempotência e contratos HTTP atuais aprovados novamente |
| [4.4](#execução-da-44--17112026) | Quatorze integrações por operações ausentes; primeiro HTTP não executou por módulo ausente | Quatorze integrações e sete testes HTTP atuais aprovados novamente |
| [4.5](#execução-da-45--17112026) | Região da conversa ausente; depois saída de edição/foco ausentes nos casos da revisão | Os 22 E2E de conversa passaram novamente dentro dos 86 cenários da 4.6 |

Esta etapa consolida validação e reforça cobertura, sem implementar comportamento novo do produto; não foi fabricado um RED removendo código já entregue. Falhas de ambiente e dados sintéticos inválidos descritas nos registros anteriores continuam sem contar como RED de comportamento.

Capturas de conversa/editor em desktop e celular, nos temas claro/escuro, inspecionadas pelo executor, incluindo a área visível no celular para distinguir artefatos de recorte longo: sem impedimento visual identificado. Foram capturadas na execução inicial; o código de interface não mudou depois. Teclado, foco e ausência de rolagem horizontal são verificados pelos E2E. Logs locais: `.local/etapa46-check-final.log`, `.local/etapa46-build.log`, `.local/etapa46-e2e-initial.log`, `.local/etapa46-e2e-second.log` e `.local/etapa46-e2e-final.log`. Relatórios/traces ficam no container em `.local/ticket-ui-{report|results}-*`; imagens copiadas para `.local/etapa46-conversation-*.png` no host. Todos permanecem ignorados pelo Git.

Revisão independente via `review-agent`/`review-delivery`, em contexto limpo e somente leitura, após todos os checks e E2E passarem: **APROVADO PARA ENTREGA**, sem achados concretos de correção, incluindo níveis médio/baixo. Escopo: diff completo da etapa 4 desde `7cc970e`, incluindo migrations, caminhos antigos de anexos e os ajustes da 4.6. Conferidos autoria e autorização atuais, isolamento de notas/revisões/arquivos, concorrência, quota, publicação conjunta, reenvio e Markdown. O revisor confirmou que os reforços E2E preservam as asserções e usam a paginação da interface. Revisão estática: o revisor não alterou arquivos nem repetiu testes/build; as execuções acima foram realizadas pelo executor.

Limites mantidos: rascunho somente em memória; sem tempo real ou notificações; conteúdo removido/excluído fica retido e consumindo os 200 MiB; limpeza manual de reservas após 30 minutos, em lotes de 100; multipart em memória; lock global sem ensaio de contenção; escrita S3 tardia após queda pode deixar objeto órfão. Upload/download E2E usa SeaweedFS real local, mas falhas de rede são injetadas e disputas no armazenamento usam simulador em memória. Sem Firefox/Safari, leitor de tela humano, homologação com usuários, carga ou teste de produção.

Documentos atualizados: README, plano geral, este planejamento, arquitetura e operação. A 4.6 está **validada localmente**, com todos os critérios obrigatórios atendidos e sem falhas pendentes. Durante a validação, não houve commit, push, PR, escrita no Linear, merge ou deploy.

Entrega Git autorizada em 19/11/2026: o usuário solicitou um commit local com todas as alterações, incluindo as preexistentes em `AGENTS.md` e nos documentos da etapa 3/plano geral, seguido do push de `codex/etapa-4-6-validacao`. Conferência anterior ao commit: 203 arquivos versionados não Markdown idênticos ao container validado, sem novos arquivos ou artefatos de build versionados e `git diff --check` aprovado. Os resultados dos testes e da revisão acima permanecem válidos; somente este registro de autorização foi atualizado depois. PR, merge, deploy e escrita no Linear conservam suas autorizações próprias.
