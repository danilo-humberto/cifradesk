# Etapa 3 — Chamados completos: tarefas e critérios de aceite

Data: 13/11/2026. **Status: 3.1 concluída no planejamento; 3.2 e 3.4 registradas em commits locais autorizados, sem push/PR. 3.5–3.8 não iniciadas.** [Evidências e limitações da 3.4](tarefa-3.4-abertura.md).

## Por que esta é a próxima etapa

A etapa 2 (identidade e setores) foi integrada à `main` pelo [PR #2](https://github.com/danilo-humberto/cifradesk/pull/2). A base remota conferida para este planejamento é `7ddc3f343332a78a33015240b893dad4b9ae7892`. Nessa base, o schema contém usuários, sessões, setores e vínculos, mas ainda não contém chamados, categorias, histórico ou outbox. A branch de implementação acrescenta a persistência da 3.2. As permissões existentes validam identidade e administração; não substituem autorização por chamado.

Assim, o próximo incremento do [plano principal](plano-implementacao.md#etapa-3--chamados-completos) é permitir abrir, acompanhar e atender chamados. O registro da etapa 2 preserva as condições históricas anteriores ao merge; a situação Git acima foi conferida separadamente. Nenhuma issue Linear foi associada a este documento.

## Resultado e limites

A mesma conta poderá solicitar e atender chamados. O solicitante acompanhará suas demandas, inclusive em outro setor; integrantes trabalharão na fila do próprio setor. Alterações terão histórico e detecção de conflito entre edições.

Inclui abertura, listagem paginada, detalhe, atribuição, transferência, prioridade, prazo, status, histórico e gravação de eventos pendentes na outbox (tabela que preserva eventos para processamento posterior).

Anexos na abertura foram incluídos pelo usuário na tarefa 3.1: antecipar o upload privado, validação e download necessários da etapa 4, preservando os limites já definidos no plano geral. Mensagens continuam na etapa 4. Tarefas independentes e Kanban (5), entrega de notificações, lembretes e SSE (6), cache Redis (7), produção e ensaios de carga/recuperação (8) continuam posteriores. Registrar um evento não significa entregá-lo. Não haverá SLA.

## Decisões consolidadas — tarefa 3.1

Requisitos confirmados pelo usuário. Task significa chamado; não unifica tarefas independentes da etapa 5. Persistência (3.2), abertura e anexos via API (3.4) estão implementados localmente; consultas, operações e interface permanecem pendentes.

### Status

| Status | Significado |
| --- | --- |
| ABERTA | Chamado recém-aberto |
| PENDENTE | Atendimento ainda não iniciado |
| EM PROGRESSO | Atendimento em execução |
| FEITO | Finalizado, sinalizando ao gestor que pode analisar |
| REVISÃO | Precisa voltar ao chamado para examiná-lo antes de finalizar |
| BLOCKED | Impedimento para continuar; motivo obrigatório |
| FECHADA | Oculta na listagem principal; aparece somente por filtro explícito |

APROVADA e RECUSADA foram retiradas. Não há aprovação/recusa pelo solicitante, nem papel novo de gestor com privilégios exclusivos. FEITO sinaliza estado; notificações automáticas continuam na etapa 6. Transferência e reabertura retornam a PENDENTE, com motivo. Fechar preserva histórico e dados.

### Formulário e listagem

- “Informe o que deseja?”: título.
- “Descreva sua requisição”: descrição.
- “Informe seu nome completo”: “é para mim” preenche pela conta; “para outra pessoa” permite digitação livre.
- “Qual seu departamento?”: preencher automaticamente quando houver um vínculo; com vários, escolher entre departamentos válidos do criador; sem vínculo, impedir abertura e orientar procurar o administrador.
- “De qual setor deseja o atendimento?”: dropdown.
- “Anexe algum arquivo para ajudar no entendimento do problema”: anexos privados na abertura.

O criador autenticado é separado do nome da pessoa atendida. Nome livre não cria conta nem concede acesso. Departamento é o do criador mesmo quando abre para outra pessoa. Prioridade e vencimento são definidos pelo setor, fora do formulário de abertura.

Colunas por departamento: título, nome preenchido na abertura, status, responsáveis, criado por, data criada, prioridade e data de vencimento. Responsáveis e criado por usam apenas avatares, com iniciais do nome/sobrenome como fallback e nome completo acessível. A consulta paginada exclui FECHADA por padrão; filtro explícito permite encontrá-la.

### Responsáveis e transferência

Vários responsáveis, todos ativos e integrantes do setor destinatário. Não existe participante. Integrantes possuem as mesmas permissões operacionais; atribuição não concede exclusividade. Uma pessoa pode criar e atender o mesmo chamado.

Transferência exige motivo, retorna a PENDENTE e remove responsáveis incompatíveis. Preserva nome informado, criador, prioridade, prazo e histórico. Integrantes do setor anterior perdem acesso, salvo fundamento válido como serem criadores.

Desativar/remover responsável do setor remove sua atribuição com histórico, preservando os demais elegíveis. Se nenhum restar, sinalizar necessidade de reatribuição. Bloquear desativação do setor com chamados não FECHADOS; transferir ou fechar antes. Setor desativado preserva consulta histórica autorizada, sem receber demandas novas.

### Matriz de acesso

| Contexto | Consulta | Operação do chamado |
| --- | --- | --- |
| Criador externo ao setor | Seus chamados e conteúdo compartilhado | Não |
| Integrante ativo do setor | Chamados do setor | Sim |
| Responsável | Como integrante ativo | Sim, sem exclusividade |
| Administrador sem vínculo | Sem leitura global implícita | Não |
| Usuário inativo | Não | Não |
| Pessoa com nome digitado | Nome não concede acesso | Não por esse motivo |

Exemplos: Financeiro abre e acompanha atendimento de TI sem acessar a fila de TI; integrante de TI pode atender chamado criado por ele; administrador sem vínculo não lê chamado apenas por ser administrador. Papéis acumulados conservam os direitos dos vínculos ativos.

### Histórico e limites

Compartilhado: abertura, status, responsáveis, setor, prioridade, prazo e resumo da solução. Interno: motivos de transferência/reabertura e ajustes por desativação. Mudanças de responsáveis continuam registradas; gestão de participantes não existe. Filtrar conteúdo interno no servidor antes de paginação e contagem. Cancelamento não é um status aprovado.

### Regras finais aprovadas

- Qualquer status pode mudar para qualquer outro, sem restrição pelo par origem/destino. Permanecem autorização, validação dos campos e controle de concorrência. Reabrir retorna a PENDENTE como ação específica, sem impedir mudanças diretas de FECHADA para outros status.
- Exigir motivo para entrar em BLOCKED, transferir, reabrir (sair de FECHADA) e fechar diretamente de ABERTA/PENDENTE. Ao entrar em REVISÃO, exigir orientação do que precisa ser revisto; ao entrar em FEITO, exigir resumo da solução. Fechar de FEITO não exige nova justificativa. Orientação de revisão e motivos operacionais são internos; solução é compartilhada.
- Pode abrir e ficar PENDENTE sem responsável. Exigir pelo menos um responsável elegível ao entrar em EM PROGRESSO, REVISÃO ou FEITO. Se todos perderem elegibilidade, preservar status e sinalizar ausência; reatribuir antes de continuar atendimento.
- Categoria foi removida: sem campo, entidade, cadastro, filtro ou validação de categoria neste escopo.
- Prioridades: Baixa, Normal, Alta e Urgente; padrão Normal, alterada pelo setor, sem SLA ou prazo automático.
- Vencimento opcional, por data em America/Sao_Paulo. Nova definição/alteração aceita hoje ou futuro; prazo já vencido é preservado, não muda status nem impede finalizar.
- Título obrigatório: 5–150 caracteres. Descrição obrigatória: 10–10.000 caracteres, texto simples. Nome de outra pessoa obrigatório: 3–150 caracteres, aceitando acentos/nomes compostos sem impor dois sobrenomes.
- Departamento do criador e setor destinatário obrigatórios e ativos. Em “é para mim”, obter nome da conta no servidor. Guardar nome e departamento da abertura como registro histórico, sem reescrever após mudança de perfil.
- Anexos opcionais; limites e formatos do plano geral permanecem.
- Transferir diretamente somente em ABERTA, PENDENTE, EM PROGRESSO, BLOCKED ou REVISÃO. Em FEITO, mudar antes para REVISÃO; em FECHADA, reabrir antes. Esta condição é da operação de transferência, não bloqueia trocas diretas de status.

## Tarefas menores

Tarefa 3.1 concluída no planejamento; 3.2 e 3.4 implementadas e revisadas localmente; 3.5–3.8 não iniciadas. As tarefas são divisões de execução da mesma entrega, sem PR separado por camada.

### 3.1 — Fechar regras e matriz de acesso

**Dependência:** nenhuma. **Entrega:** regras consolidadas no plano e matriz de permissões neste documento, sem duplicação.

**Critérios de aceite:**

- [x] Cada decisão acima tem resposta aprovada e exemplos de operação permitida/negada.
- [x] Matriz diferencia solicitante externo, integrante, responsáveis, administrador sem vínculo e usuário inativo.
- [x] Administrador não ganha leitura global; criador externo não fecha ou reabre. Solicitante que integra o setor conserva as permissões de integrante.
- [x] Cada par status atual/destino tem resultado definido; etapas posteriores continuam fora do escopo.

### 3.2 — Modelar chamados e sua persistência

**Modelo aprovado:** [documento da tarefa 3.2](tarefa-3.2-modelo-dados.md), com cinco tabelas e as oito recomendações confirmadas. Schema, migration e contratos implementados; resultados e limites da validação estão nesse documento.

**Dependência:** 3.1 e autorização específica para mudanças de banco. **Entrega:** schema, migration e contratos de entrada/saída em `packages/database` e `packages/contracts`.

**Critérios de aceite:**

- [x] Chamado possui número único, solicitante, setor, múltiplos responsáveis, status, prioridade, prazo, versão e datas.
- [x] Vínculos de responsáveis não se repetem. Referências inválidas são rejeitadas sem corromper dados existentes.
- [x] Histórico e outbox têm identificadores e vínculos rastreáveis; eventos possuem tipo e versão. Metadados dos anexos incluídos, sem tarefas independentes.
- [x] Índices previstos para número, solicitante, setor/status, responsável, prazo e histórico por item/data, com desempate por ID. Consultas e planos reais, incluindo a junção de responsável/status, serão validados na 3.5.
- [x] Migration funciona em banco sintético vazio e sobre a migration de identidade, preservando usuários e vínculos. Client gerado e tipos compilados.

### 3.3 — Retirada do escopo

Cadastro de categorias removido por decisão do usuário. Numeração preservada para rastreabilidade; nenhuma implementação necessária.

### 3.4 — Abrir chamados com gravação consistente

**Dependências:** 3.1–3.2. **Entrega:** caso de uso, API e testes de criação.

**Critérios de aceite:**

- [x] Usuário ativo abre chamado para setor elegível; identidade do criador vem da sessão, separada do nome informado, sem permitir falsificação pelo corpo da requisição.
- [x] Campos e setor são validados no servidor conforme 3.1; mesma pessoa pode abrir para o próprio setor. Operações de atendimento continuam na 3.6.
- [x] Anexos respeitam acesso privado, 20 MB por arquivo, cinco por envio, 200 MB acumulados e tipos permitidos do plano geral; autorização, falhas e limpeza testadas. Recuperação operacional com janela de 30 minutos, sem agendamento.
- [x] Número é único mesmo com criações simultâneas.
- [x] Chamado, atividade de criação e `ticket.created.v1` são gravados na mesma transação. Falha em qualquer gravação desfaz todas.
- [x] Testes demonstram criação válida, rejeições e rollback usando dados sintéticos. [Execução da 3.4](tarefa-3.4-abertura.md).

### 3.5 — Consultar Minhas solicitações, fila e detalhe

**Dependências:** 3.4 e autorização específica para políticas de acesso. **Entrega:** consultas autorizadas e contratos de paginação.

**Critérios de aceite:**

- [ ] Minhas solicitações mostra somente chamados do criador autenticado; fila mostra somente setores autorizados; detalhe aplica a matriz da 3.1.
- [ ] Solicitar para outro setor permite acompanhar o próprio chamado, sem abrir a fila desse setor.
- [ ] Trocar IDs, filtros ou página não revela títulos, contagens ou histórico de itens proibidos. Administrador sem vínculo não recebe acesso global.
- [ ] Listas e histórico têm limite de página, ordenação estável e validação dos parâmetros; autorização ocorre antes da paginação/contagem.
- [ ] Revogação, desativação e remoção de vínculo são reavaliadas no servidor, sem depender apenas de ocultar controles na tela.

### 3.6 — Operar chamados e impedir sobrescrita concorrente

**Dependências:** 3.4–3.5. **Entrega:** atribuição, transferência, prioridade, prazo e transições em casos de uso compartilhados.

**Critérios de aceite:**

- [ ] Integrantes operam conforme a matriz aprovada, sem hierarquia de gestor; responsáveis e destinos são revalidados em cada alteração.
- [ ] Status inválido e ação proibida são negados sem mudar dados; não há aprovação pelo solicitante nem status removidos.
- [ ] Toda alteração aceita grava dados, histórico e evento correspondente juntos. Contratos incluem `ticket.assigned.v1` e `ticket.status_changed.v1`; demais eventos necessários são documentados.
- [ ] Atualização compara a versão recebida e a incrementa atomicamente; duas edições da mesma versão permitem somente uma gravação. A outra retorna conflito, sem histórico/evento de sucesso.
- [ ] Transferência e perda de vínculo seguem 3.1, sem manter acesso indevido nem responsáveis incompatíveis.
- [ ] Testes concorrentes verificam intercalações reais, além de testes unitários das transições e permissões.

### 3.7 — Entregar a jornada na interface

**Dependências:** 3.4–3.6. **Entrega:** abertura, Minhas solicitações, fila e detalhe com controles shadcn/ui.

**Critérios de aceite:**

- [ ] Formulário e colunas seguem a seção consolidada; testar nome livre, departamento único/múltiplo/ausente, múltiplos avatares e filtro de FECHADA.
- [ ] Usuário abre chamado, encontra-o na lista, consulta detalhes e executa somente as ações disponíveis para seu contexto.
- [ ] Após sucesso, listas e detalhe refletem a alteração por invalidação das consultas; chaves incluem identidade/contexto e filtros. Sem promessa de tempo real nesta etapa.
- [ ] Conflito informa que o item mudou e permite recarregar; não reenvia silenciosamente a edição sobre a versão nova.
- [ ] Carregamento, vazio, erro, acesso negado e envio em andamento são distinguíveis; formulários têm rótulos, mensagens e navegação por teclado.
- [ ] Fluxo funciona nos temas claro/escuro/automático e em tela pequena, preservando login, tema e limpeza de cache ao sair.

### 3.8 — Validar, revisar e documentar a entrega

**Dependências:** todas as anteriores. **Entrega:** evidências reais e documentação atualizada; proposta de registro em `docs/etapa-3-execucao.md`.

**Critérios de aceite:**

- [ ] Para comportamentos testáveis, registrar RED → GREEN → REFACTOR durante cada tarefa; não deixar a escrita dos testes para esta última tarefa.
- [ ] Executar geração Prisma, `pnpm check`, build, integrações e E2E em ambiente isolado. O script atual `test:integration` seleciona apenas identidade: incluir explicitamente os novos testes antes de declarar a suíte completa aprovada.
- [ ] E2E com contas sintéticas prova: mesma conta solicita/atende; solicitante acompanha outro setor; terceiro não acessa item; integrante opera; usuário desativado perde acesso; duas sessões recebem conflito de edição.
- [ ] Registrar comandos, resultados, falhas preexistentes e correções; revalidar regressões de identidade. Testes não executados permanecem pendentes.
- [ ] Atualizar plano, arquitetura, contratos/permissões e operação conforme o comportamento entregue, ao concluir cada responsabilidade afetada.
- [ ] Revisão independente de autorização, transações e concorrência, sem edição pelo revisor; corrigir e reavaliar bloqueios reais.
- [ ] Conferir diff completo e histórico contra a base remota atual antes do único PR; integração à main e conclusão da etapa são registradas somente quando ocorrerem.

## Execução, risco e aprovações

Sequência: **3.1 → 3.2 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8**. Testes e documentação acompanham cada tarefa.

Risco **alto** na implementação: consultas podem expor chamados entre setores; alterações concorrentes podem perder dados; falha parcial pode separar histórico e estado. As tarefas 3.5, 3.6 e 3.8 concentram as verificações desses riscos. Reutilizar o monólito modular e a identidade existente é a menor solução adequada; não introduzir outro serviço ou biblioteca por antecipação.

A implementação deverá alterar mais de cinco arquivos: schema/migration, contratos, regras, persistência, APIs, telas, testes e documentação são responsabilidades distintas. Antes de editar código, confirmar a lista concreta e justificar qualquer ampliação. Referências existentes: `packages/core/src/identity.ts`, `packages/infrastructure/src/identity.ts`, `packages/database/prisma/schema.prisma`, `apps/web/src/app/(workspace)/requests/page.tsx`, `apps/web/src/app/(workspace)/departments/page.tsx`, `docs/identity.md` e `docs/operations.md`.

Criar branch exclusiva de implementação a partir da main atual; este documento está em branch documental própria. Planejar commits coerentes de dados/contratos, regras/integrações e interface, com testes necessários acompanhando cada responsabilidade, e um único PR completo para main. Não criar hashes fictícios nem PRs por tarefa.

O pedido original autorizava somente planejamento e documento. Em 13/11/2026, o usuário autorizou iniciar a 3.2 e usar o PostgreSQL existente no Docker; as verificações usaram bases sintéticas separadas no mesmo container. Depois, autorizou os três commits locais de persistência, contratos e documentação, incluindo o planejamento preexistente, e determinou não fazer push nem abrir PR. Implementação de autorização, dependências/configurações críticas, novos commits, push, PR, merge e deploy conservam suas aprovações específicas. Nenhum acesso a produção é necessário.

Na continuação, o usuário solicitou implementar a 3.4 na mesma branch, sem push/PR, e autorizou especificamente SDK S3, configuração SeaweedFS local, bucket privado e testes sintéticos. Após a implementação e revisão independente, autorizou os três commits locais propostos, mantendo a proibição de push/PR. Credenciais existentes foram preservadas. A auditoria completa do histórico da etapa 3 permanece obrigatória antes da publicação.

Modelo sugerido para implementar: GPT-6.1 com esforço alto de raciocínio, devido a isolamento de dados e concorrência; sem alteração da configuração atual.

**Validação deste planejamento:** leitura do plano, schema, políticas de identidade, registro da etapa 2 e estado do PR/base remota. Não foram executados testes da aplicação nem migrations para criar este documento.



