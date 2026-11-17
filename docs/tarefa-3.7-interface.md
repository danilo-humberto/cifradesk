# Tarefa 3.7 — Jornada de chamados

Implementação local na branch `codex/etapa-3-chamados`, em 13/11/2026. **READY_FOR_HUMAN_REVIEW para a 3.7**: build, lint, tipos, testes pertinentes e revisão independente concluídos. Commits locais autorizados pelo usuário; sem push, PR ou publicação no Linear. A alteração preexistente em `AGENTS.md` foi preservada.

## Escopo implementado

- `/requests`: Minhas solicitações; `/departments`: fila dos setores vinculados. Paginação de 20 itens, filtro explícito de FECHADA e por setor, colunas aprovadas e avatares com nome acessível/iniciais.
- `/requests/new`: abertura para si ou outra pessoa, departamento único automático, escolha entre múltiplos vínculos e orientação quando não houver vínculo ativo. Anexos opcionais são enviados após confirmar a criação. Falha de upload preserva o chamado e direciona ao detalhe, que permite reenvio explícito sem repetir a abertura.
- `/requests/[id]`: dados, responsáveis, necessidade de reatribuição, anexos paginados e histórico paginado. Atendimento disponível a integrantes de setor ativo: status, responsáveis, edição, prioridade, prazo, transferência e reabertura. Regras e permissões continuam verificadas nas APIs da 3.6.
- O editor congela a versão inicial. Atualização em segundo plano ou resposta 409 exige recarga explícita; a edição não é reaplicada automaticamente. Alterações bem-sucedidas invalidam consultas com prefixo `tickets/identidade`; listas incluem contexto/filtros/página. Sessão, tema e limpeza de cache continuam na composição existente.

Componentes Table, Textarea e Checkbox foram incorporados em `components/ui` seguindo shadcn/ui e as dependências existentes. Não houve alteração de dependências, schema ou configuração de produção. Mais de cinco arquivos são necessários para separar páginas, componentes, contratos, consultas/rotas, testes e documentação.

## Ajustes da abertura e breadcrumbs — 16/11/2026

Branch `codex/abertura-chamado-breadcrumbs`, criada sobre `b14dbd1` (estado local da interface revisada). A `main` local está anterior a essas implementações; antes de publicar, será necessário reconciliar a base e conferir o diff real do PR. Commits locais autorizados explicitamente pelo usuário após os ajustes. Push, PR e comentário no Linear não foram executados.

- Breadcrumb shadcn com ancestrais clicáveis e página atual não clicável, também no celular. Abertura: `Espaço de trabalho > Minhas solicitações > Abrir chamado`; detalhe: `Espaço de trabalho > Minhas solicitações > Detalhe do chamado`. As demais rotas do workspace exibem a raiz e o título da tela. A trilha representa a hierarquia das rotas, sem acumular histórico de visitas.
- Formulário centralizado, retorno redundante removido, inputs e seletores com 48 px, textarea com altura mínima maior, campos obrigatórios marcados por asterisco vermelho claro e contadores internos. Limites e validação nativa permanecem; instruções mínimas estão associadas aos campos para leitores de tela. Atendimento usa dois Buttons shadcn lado a lado com estado `aria-pressed`. Envio: “Abrir Chamado”.
- Anexos em área tracejada com resumo dos limites, seleção por botão/teclado e arrastar arquivos, lista e remoção antes do envio. `Attachment` e `Progress` incorporados do registro oficial shadcn new-york-v4 (MIT), adaptando imports e tamanho do Button existente; sem dependências novas. Arquivos selecionados são validados pelo contrato existente e seleções repetidas são deduplicadas por nome, tamanho e última modificação.
- Upload permanece em um único multipart após criar o chamado. `XMLHttpRequest.upload` informa percentual real do lote, sem estimar progresso individual. 100% significa transferência concluída; só a resposta HTTP bem-sucedida confirma o envio. Falhas HTTP/rede/timeout/aborto não causam repetição automática; o chamado criado é preservado e o usuário deve conferir o detalhe antes de reenviar. Tempo de espera do upload: 120 segundos.

### Verificações desta alteração

Por solicitação explícita, título, descrição e nome de outra pessoa usam cursor de texto (`cursor-text!`), como exceção local à regra global de cursor-pointer. A prioridade é necessária porque a regra global está fora das camadas Tailwind. Nome próprio e departamento único mantêm cursor de bloqueado; seletores, anexos e botões mantêm seus cursores existentes.

O nome segue o mesmo comportamento: em “É para mim”, mostra o nome da conta em Input desabilitado, com cursor `not-allowed` no contêiner e rótulo. Em “Para outra pessoa”, permanece editável e obrigatório. A criação para si continua obtendo o nome no servidor; não depende de enviar o campo desabilitado. Asserções E2E de bloqueio e edição adicionadas, ainda sem execução integrada.

Complemento solicitado: com um único departamento, o Input de origem fica `disabled`, com aparência de bloqueado e fora da navegação por Tab. O contêiner e o rótulo usam cursor de bloqueado (not-allowed); o cursor fica no contêiner porque o Input desabilitado ignora eventos de ponteiro. O ID continua obtido da consulta para criar o chamado. Com vários departamentos, permanece o dropdown shadcn existente. Asserções E2E atualizadas para os estados desabilitado/habilitado; execução integrada continua pendente conforme descrito abaixo.

- TDD: `docker exec cifradesk-local-web-1 pnpm exec vitest run apps/web/src/lib/tickets.test.ts` inicialmente registrou **6 falhas esperadas**, pela ausência de `uploadTicketFiles`, e 5 testes existentes aprovados. Após implementação: 11 aprovados no mesmo arquivo.
- `docker exec cifradesk-local-web-1 pnpm check`: lint e tipos aprovados; **86 testes aprovados, 47 integrações puladas**. Lint dos nove arquivos TypeScript/TSX alterados repetido após os últimos ajustes: aprovado. `git diff --check`: aprovado após remover linhas extras no fim dos arquivos.
- Navegador local: conferidos desktop e viewport de 390 × 844, sem overflow horizontal; inputs medidos em 48 px. Verificados contadores (20/150 e 45/10.000), alternância de destinatário, retorno via breadcrumb e reabertura, seleção e remoção de TXT sintético e Tab até “Abrir Chamado”. Arquivo de prova local: `.local/abertura-chamado-final.jpg`. Nenhum chamado foi criado nem arquivo transmitido nessa verificação.
- A prévia teve erro de acesso/timeout inicial, mas carregou na mesma aba e permitiu os ensaios acima. Não foi necessário mudar infraestrutura.
- E2E existente atualizado para botões, breadcrumb, contadores, remoção e falha de upload, **não executado nesta rodada**: o container `cifradesk-etapa34-tools` exigido pelo runner não está disponível. Build, upload real ao armazenamento, Safari/Firefox e leitor de tela também não foram executados. Não declarar a jornada de criação/upload integralmente validada com base apenas nos testes de transporte simulados.
- Revisão do diff da tarefa e checklist React: sem defeito impeditivo identificado na análise realizada. Os riscos abaixo permanecem; essa revisão não substitui a auditoria do histórico contra `main` antes de um PR.

### Validação manual

1. Abrir `/requests/new`, verificar a trilha e retornar por “Minhas solicitações”; reabrir o formulário e repetir em largura de celular.
2. Preencher título/descrição, conferir os contadores e alternar o destinatário; conferir limites e obrigatoriedade.
3. Selecionar/arrastar TXT sintéticos, remover e selecionar novamente; verificar a mensagem ao exceder cinco arquivos ou usar formato não permitido.
4. Em ambiente sintético isolado, criar com anexo sob rede lenta, observar percentual do lote e confirmação. Simular falha do upload e conferir que existe somente um chamado antes de reenviar no detalhe. Esta etapa ainda está pendente de execução integrada.

### Minuta para Linear — não publicada (ajustes de abertura)

#### O QUE E POR QUE

Formulário centralizado com controles shadcn, contadores internos, dois botões de destinatário e breadcrumbs navegáveis. Anexos usam Attachment e progresso real do lote, preservando as APIs e a recuperação sem duplicar chamados. A composição usa as dependências existentes.

#### ALERTA DO SÊNIOR

- Progresso mede transferência do lote; 100% não confirma persistência. Em timeout (120 s), conferir o detalhe antes de reenviar.
- E2E de criação/recuperação e upload real permanecem pendentes; navegação e interações locais foram conferidas.
- A base local contém trabalhos anteriores à tarefa; reconciliar com a `main` remota antes de publicar o PR.

#### FOCO DE REVISÃO

`apps/web/src/components/tickets/opening.tsx` (criação e preservação do chamado) e `apps/web/src/lib/tickets.ts` (transporte e confirmação do upload).

### Commits locais autorizados — ajustes da abertura

1. `e59ac3e feat(ui): ajusta abertura de chamados e navegação`: componentes, helper e testes correspondentes. Arquivos críticos: `opening.tsx` e `lib/tickets.ts`. Componentes visuais do registro shadcn podem ficar para uma segunda leitura; os testes permanecem junto da implementação para manter o commit coerente.
2. `docs(ui): registra ajustes e validações da abertura`: comportamento, evidências, riscos e validação pendente; remove também linhas vazias excedentes no fim dos componentes Attachment e Progress. O hash deste commit documental deve ser consultado no histórico, pois não pode constar no próprio conteúdo.

Antes dos commits locais, o typecheck web foi executado novamente com sucesso. A checagem dos arquivos preparados identificou apenas linhas vazias excedentes no fim dos dois componentes novos, removidas no commit documental. E2E e build permanecem pendentes como registrado acima.

## Complementos de API

O usuário autorizou especificamente as consultas restritas de apoio à interface nesta conversa.

`GET /api/tickets/options?scope=...&page=1` retorna páginas fixas de 20 registros, ordenadas por nome e ID:

| Escopo | Acesso e dados |
| --- | --- |
| `destinations` | Usuário ativo; IDs, nomes e estado dos setores ativos |
| `origins` | Somente setores ativos com vínculo próprio |
| `memberships` | Vínculos próprios, inclusive setores desativados para consulta histórica |
| `members&departmentId=...` | Exige vínculo próprio no setor ativo; somente IDs/nomes de integrantes ativos |

Sessão/versão e vínculos são reavaliados em `RepeatableRead` antes da paginação/contagem. Administrador sem vínculo não lista integrantes. Não são expostos e-mails, papéis ou dados administrativos.

`GET /api/tickets/:id/attachments?page=1&pageSize=20` reutiliza exatamente o acesso do detalhe, retorna metadados mínimos e `canUpload` segundo o estado do setor, sem chaves privadas. Download/upload mantêm suas verificações próprias. Estados pendentes/falhos são diferenciados de arquivos disponíveis.

O histórico resolve somente IDs já presentes na página autorizada para nomes atuais, em lotes de até 100, preservando IDs originais. Os nomes não representam snapshots históricos de perfis; renomeações posteriores aparecem na apresentação. Motivos internos continuam filtrados antes da paginação.

## Evidências e limitações

- RED inicial dos helpers/opções: importações ausentes; depois GREEN, 10 testes. A primeira implementação tentou importar Zod diretamente da infraestrutura, sem dependência ali; corrigido movendo o schema para contratos, sem instalar pacote.
- RED da consulta de anexos em PostgreSQL: `listTicketAttachments is not a function`, com os outros oito testes passando.
- `docker exec cifradesk-etapa34-tools pnpm check`: **aprovado na rodada final**, lint sem avisos, tipos de todos os pacotes e **75 testes unitários**. As **46 integrações** são puladas nesse comando; 11 de consultas foram executadas separadamente pelo runner abaixo.
- Uma execução paralela de integrações excedeu os 10 segundos do preparo. Na rodada isolada, faltava `visibility` no novo dado sintético do histórico; a fixture foi corrigida. A execução final `node scripts/test-ticket-queries.mjs` passou em **11 testes**, em 3,22 s, na base exclusiva `tickets35_test_d1e317bee3e489e76bdf`. Nenhuma asserção foi enfraquecida. O aviso de depreciação `pg`/Prisma sobre consultas concorrentes permanece; não houve erro de consulta.
- Primeira execução E2E: três timeouts durante compilação inicial em bind mount Windows, um teste interrompido e seis não executados. A rota de login consumiu 26,8 s em compilação/execução inicial. O aquecimento parcial ainda deixou rotas de mutação compilarem durante a segunda rodada; ela também foi interrompida. O runner passou inicialmente a usar o build com `next start`, sem HMR; a configuração final standalone está descrita abaixo. As jornadas novas receberam orçamento total de 90 s para múltiplas operações autenticadas, preservando asserções de 5 s e zero retries. Também foram corrigidos seletores ambíguos entre alertas da aplicação e o anunciador do Next.
- A primeira rodada sobre o build teve **11 aprovados e 1 falha** esperando departamentos. O trace mostrou resposta 200 com cerca de 7 s de recebimento. O runner foi corrigido para iniciar o artefato **standalone** recomendado pelo Next e gravar traces/relatórios em `/tmp`, copiando-os somente após os testes, evitando gravação por evento no bind mount Windows.
- Execução final `node scripts/test-ticket-interface.mjs`: **12/12 aprovados**, Chromium desktop/celular, zero retries, **47,7 s**; base exclusiva `tickets37_test_911af0c7f80566bd8099`. A abertura inicial no desktop passou em 6,6 s. Relatório local ignorado pelo Git: `.local/ticket-ui-report-8079/index.html`. As falhas anteriores permanecem registradas; este resultado valida os cenários executados, não garante ausência de instabilidade em outras máquinas.
- `docker exec cifradesk-etapa34-tools pnpm build`: **aprovado**, web e worker. As páginas novas e a rota de opções constam no build. A alteração automática de `next-env.d.ts` causada pelo modo dev desapareceu no build; o arquivo não integra o diff final.
- Capturas de abertura/lista em desktop/celular conferidas; teste verifica ausência de overflow horizontal da página. A tabela mantém rolagem horizontal própria para preservar as oito colunas. Testes abrangem nome livre, vínculos ausentes/único/múltiplos, múltiplos avatares, FECHADA, conflito, acesso negado, recuperação de upload, teclado no seletor, temas e logout.

Runner de navegador: executar `docker exec cifradesk-etapa34-tools pnpm build` e depois `node scripts/test-ticket-interface.mjs`, usando Node do host somente para orquestrar Docker. Cria base/usuário sintéticos exclusivos `tickets37_test_*`, aplica migrations existentes e inicia o standalone em `127.0.0.1:3317` no container de ferramentas. Nenhuma porta é publicada. Dados sintéticos permanecem para diagnóstico; o servidor é encerrado ao terminar. Não executar simultaneamente com build ou outros testes pesados no mesmo container. Upload no E2E é simulado para testar recuperação da interface; não equivale a revalidação S3 de ponta a ponta. Safari/Firefox, carga, leitores de tela e a regressão completa de identidade/abertura/operações da 3.8 não foram executados nesta tarefa.

## Revisão preliminar

A revisão independente identificou ausência de recuperação de upload e omissão das referências de responsáveis/setores no histórico. Ambos foram corrigidos; testes de recuperação e resolução de nomes foram acrescentados. A reavaliação incluiu remoção automática de responsáveis e preservação de textos livres iguais a nomes de enums; os ajustes foram confirmados no código, sem novo defeito bloqueante identificado. Após examinar o código e receber as evidências finais, o revisor concluiu **READY_FOR_HUMAN_REVIEW**, limitado à 3.7. Esta revisão do working tree não substitui a auditoria de `main..HEAD` após commits autorizados. A 3.8 e a integração da etapa inteira permanecem pendentes.

Documentos atualizados: este relatório, planejamento da etapa 3, plano principal, arquitetura e operação. `git diff --check` não apontou erros de whitespace.

## Validação manual

1. Com conta sem vínculo, abrir “Abrir chamado” e verificar orientação; com um vínculo, verificar departamento automático; com vários, escolher.
2. Abrir para outra pessoa com anexo, conferir nome, lista, detalhe e download privado.
3. Como integrante, atribuir duas pessoas, alterar status/prioridade/prazo, transferir com motivo e verificar histórico. Como criador externo, somente acompanhar.
4. Editar em duas sessões: salvar na primeira, tentar na segunda e recarregar explicitamente após o conflito.
5. Fechar e procurar por FECHADA; verificar claro/escuro/automático, teclado, celular e encerramento da sessão.

## Minuta para Linear — não publicada

### O QUE E POR QUE

Jornada de chamados conectada às APIs existentes, com shadcn/ui e consultas paginadas. A versão de edição é preservada até recarga explícita. É a menor extensão adequada da arquitetura atual.

### ALERTA DO SÊNIOR

Criação e upload são operações separadas; a interface distingue falha parcial e permite recuperação. Nomes do histórico refletem os cadastros atuais; IDs originais são preservados. Upload E2E é simulado; regressão completa e ensaios de carga continuam na 3.8.

### FOCO DE REVISÃO

`apps/web/src/components/tickets/operations.tsx` (versão/ações) e `packages/infrastructure/src/ticket-options.ts` (acesso aos dados auxiliares).

## Commits locais autorizados

1. `32f71c4 feat: complementa consultas para jornada de chamados (etapa 3.7)`: contrato de opções, consultas/rotas, histórico/anexos e testes de acesso.
2. `062e2c0 feat: entrega interface de chamados (etapa 3.7)`: páginas, componentes, helpers e testes da jornada.
3. `docs: registra jornada de chamados (etapa 3.7)`: documentação vigente e evidências finais.

Os três commits locais foram autorizados explicitamente pelo usuário. O hash do commit documental deve ser consultado no histórico, pois não pode constar no próprio conteúdo. Contratos e infraestrutura passaram novamente em typecheck; o código da interface corresponde ao conjunto já aprovado em build, check, integração e E2E. Push e PR permanecem expressamente fora desta tarefa. A auditoria completa contra a main remota atual continua obrigatória antes da publicação.
