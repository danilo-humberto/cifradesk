# Tarefa 3.7 — Jornada de chamados

Implementação local na branch `codex/etapa-3-chamados`, em 13/11/2026. **READY_FOR_HUMAN_REVIEW para a 3.7**: build, lint, tipos, testes pertinentes e revisão independente concluídos. Commits locais autorizados pelo usuário; sem push, PR ou publicação no Linear. A alteração preexistente em `AGENTS.md` foi preservada.

## Escopo implementado

- `/requests`: Minhas solicitações; `/departments`: fila dos setores vinculados. Paginação de 20 itens, filtro explícito de FECHADA e por setor, colunas aprovadas e avatares com nome acessível/iniciais.
- `/requests/new`: abertura para si ou outra pessoa, departamento único automático, escolha entre múltiplos vínculos e orientação quando não houver vínculo ativo. Anexos opcionais são enviados após confirmar a criação. Falha de upload preserva o chamado e direciona ao detalhe, que permite reenvio explícito sem repetir a abertura.
- `/requests/[id]`: dados, responsáveis, necessidade de reatribuição, anexos paginados e histórico paginado. Atendimento disponível a integrantes de setor ativo: status, responsáveis, edição, prioridade, prazo, transferência e reabertura. Regras e permissões continuam verificadas nas APIs da 3.6.
- O editor congela a versão inicial. Atualização em segundo plano ou resposta 409 exige recarga explícita; a edição não é reaplicada automaticamente. Alterações bem-sucedidas invalidam consultas com prefixo `tickets/identidade`; listas incluem contexto/filtros/página. Sessão, tema e limpeza de cache continuam na composição existente.

Componentes Table, Textarea e Checkbox foram incorporados em `components/ui` seguindo shadcn/ui e as dependências existentes. Não houve alteração de dependências, schema ou configuração de produção. Mais de cinco arquivos são necessários para separar páginas, componentes, contratos, consultas/rotas, testes e documentação.

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
