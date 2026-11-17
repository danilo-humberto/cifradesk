# Arquitetura — ambiente local

O [plano](plano-implementacao.md) é a referência dos requisitos. A fundação e a identidade estão implementadas; veja [identidade e permissões](identity.md) e as evidências de validação da etapa 2.

## Limites dos módulos

- `apps/web`: Next.js App Router, interface e API. Páginas são componentes de servidor; navegação ativa, tema e providers são componentes de cliente.
- `apps/worker`: processos `worker` e `dispatcher`, com a mesma imagem. Nesta etapa só expõem liveness; ainda não consomem jobs nem acessam banco.
- `packages/contracts`: contratos que podem ser importados pelo navegador, sem segredos ou dependência de infraestrutura.
- `packages/core`: políticas de usuário ativo, administração, convites e elegibilidade por setor, sem dependência de infraestrutura.
- `packages/database`: schema, migrations e client Prisma/PostgreSQL para identidade/setores e, desde a 3.2, chamados, responsáveis, atividades, metadados de anexos e outbox.
- `packages/infrastructure`: integração Better Auth/SMTP, operações transacionais de identidade e abertura de chamados, com autorização e proteção concorrente no PostgreSQL. Anexos possuem reservas, validação de conteúdo, armazenamento privado S3 e recuperação operacional; [contratos e limites da 3.4](tarefa-3.4-abertura.md).
- Consultas de chamados usam transações `RepeatableRead`, com usuário/versão de autenticação e vínculos consultados no mesmo snapshot das páginas e contagens. Predicados de acesso e visibilidade interna são aplicados no PostgreSQL antes da paginação; leituras não usam o lock global das escritas. Respostas HTTP usam `no-store`. [Contratos e limites da 3.5](tarefa-3.5-consultas.md).

O lint impede importação direta de database/infrastructure na interface. Entradas Next.js de servidor usam a barreira `server-only`; a exceção do lint é restrita a lib/server.

A [interface de chamados da 3.7](tarefa-3.7-interface.md) usa páginas de servidor para identidade e componentes de cliente com TanStack Query. Chaves incluem identidade, contexto, filtros e página; mutações invalidam consultas. O editor preserva a versão inicial até recarga explícita. Consultas de opções revalidam sessão/vínculos e retornam dados mínimos paginados; anexos reutilizam a autorização do detalhe. Histórico mantém IDs originais e resolve nomes atuais somente das referências presentes na página autorizada.

## Interface

Paleta: azul `#315dc7`, texto `#24334a`, fundo `#f5f7fb`, superfície branca, borda `#dce3ee`; escuro neutro `#18181b`, superfícies `#202023` e texto `#f4f4f5`. Tipografia Segoe UI com fallback local, sem download de fontes no build. Sidebar de 320 px, recolhível para faixa de ícones de 56 px com Tooltip no desktop; em celular, painel Sheet com fechamento por Escape, botão e seleção de destino. Sem JavaScript, a navegação permanece visível, acima do conteúdo no celular.

A composição prioriza a área de trabalho e estados explicitamente indisponíveis. Não há métricas, usuários ou chamados fictícios apresentados como reais.

Tema usa next-themes com padrão do sistema e escolha em Preferências. O CSS também acompanha o sistema sem JavaScript. A escolha é persistida também por conta, com feedback se a gravação falhar. React Query tem instância por árvore, sem cache global compartilhado entre requisições. A área protegida cria seu provider por identidade; logout limpa consultas e renova a navegação.

shadcn/ui foi configurado manualmente (`components.json`). Button, Sidebar, Select, Sheet, Tooltip, Separator, Input, Skeleton, Label, Badge, Card, Avatar e Breadcrumb foram incorporados do [registro oficial new-york-v4](https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json), variante Radix, em 12/11/2026. Código está em `apps/web/src/components/ui`, sem CLI ou download remoto em execução e sem novas dependências nesta adaptação. A composição usa Sidebar/Menu, Select/Label, Card, Badge e Avatar; os demais componentes são dependências do Sidebar. Licença MIT: [shadcn/ui](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

Adaptações locais: aliases de importação, textos acessíveis em português, botão de fechamento visível no Sheet, restauração de foco ao acionador, `aria-expanded`; a variante offcanvas usa `inert` quando oculta, enquanto a faixa de ícones permanece interativa. O hook de breakpoint usa `useSyncExternalStore`; Skeleton tem largura determinística para preservar pureza de renderização. Tokens Card/Popover/Sidebar acompanham a paleta existente. O select mantém a persistência do next-themes e a opção automática. Os testes E2E cobrem teclado, Escape, foco, navegação móvel e fallback sem JavaScript.

Feedback de ações usa Sonner 2.0.8, com adaptador shadcn/ui em `components/ui/sonner.tsx` e API compartilhada em `lib/feedback.ts`. Uma região global anuncia as mensagens; erros permanecem até fechamento e também no contexto da ação. Sucessos duram seis segundos, com resultado consultável na tela. O toast acompanha o tema, oferece fechamento por teclado e respeita movimento reduzido. Usa a camada nativa de popover quando disponível e posicionamento fixo nos demais navegadores. Estados de carregamento, falha de consulta e recuperação de conflitos continuam junto ao conteúdo. As telas de acesso reutilizam logo, fonte local e componentes existentes. Veja a atualização em [base visual](base-visual.md#telas-de-acesso-e-feedback--16112026).

## Execução e isolamento

Compose é exclusivamente local. Rede `entry` conecta proxy/web e a interface local Mailpit no override de desenvolvimento; rede `internal`, com saída externa bloqueada, conecta serviços de dados. Somente proxy e interface Mailpit publicam portas, em loopback, pelo override de desenvolvimento. Os processos não recebem segredos de integrações que ainda não usam.

Cache e filas usam Redis separados: cache descartável com `allkeys-lru`; filas com `noeviction`, AOF e volume. SeaweedFS reúne master/volume/filer/S3 no ambiente local, com volume próprio e configuração S3 autenticada. Bucket privado e upload/download autorizados foram antecipados para a 3.4; mensagens continuam na etapa 4. Downloads passam pelo servidor sem URL pública ou presign. IO S3 ocorre fora das transações; falhas preservam chamado e reservas até limpeza confirmada após janela de graça.

Migrations são explícitas e locais; não há acesso a produção ou envio SMTP externo. O healthcheck web/worker é liveness, não teste de prontidão de fluxos de negócio.

Referências: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [shadcn/ui](https://ui.shadcn.com/docs/installation/manual), [next-themes](https://github.com/pacocoursey/next-themes), [SeaweedFS S3](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API).

### Base visual e troca de tema

Cabeçalho de 56 px com Breadcrumb contextual e indicação única de prévia. Conteúdo alinhado à esquerda com 32 px no desktop e 16 px no celular; preferências limitadas a 880 px. Notificações e Preferências ficam no rodapé da sidebar. Elementos interativos continuam usando shadcn/ui.

A troca manual usa View Transitions e Web Animations para revelar o novo tema com clip-path circular, partindo do centro do SelectTrigger até o canto mais distante da viewport, em 550 ms. A lista fecha e o foco retorna ao acionador antes da captura. O estado next-themes é sincronizado com flushSync; a preferência continua persistida. Escolhas feitas durante a animação são consolidadas na última escolha e processadas ao concluir. Sem API, com movimento reduzido ou sem mudança efetiva de cores, a preferência muda imediatamente. Mudanças automáticas do sistema não iniciam animação.
Logo oficial fornecida pelo usuário em PNG transparente, preservada sem recorte em apps/web/src/assets/logo-cifra.png. Favicon servido pela convenção Next app/icon.png. A marca permanece visível na faixa de ícones, sem o texto Equipe Cifra. No celular, painel de até 320 px, limitado pela viewport.

## Operações de chamados — tarefa 3.6

Operações reutilizam a transação e o advisory lock da identidade, revalidam setor/integrantes e comparam a versão antes de gravar. Estado, atribuições, histórico e outbox são atômicos; motivos internos ficam separados do histórico compartilhado. Remoção de vínculo/desativação atualiza atribuições na transação administrativa. Consultas derivam `needsReassignment` para IN_PROGRESS/REVIEW/DONE sem responsáveis. [Contrato e limites](tarefa-3.6-operacoes.md), incluindo contenção global e timeout de remoções em volume; sem migration ou serviço novo.

## Persistência de conversas — tarefa 4.1

`TicketMessage` mantém autor, chamado, Markdown, visibilidade `SHARED`/`INTERNAL`, versão positiva, datas e exclusão lógica. Reutiliza o enum de visibilidade existente. Os índices por chamado/data/id e chamado/visibilidade/data/id sustentam paginação estável; as revisões têm unicidade por mensagem/versão. O banco limita o texto a 10.000 caracteres. Texto vazio é permitido no modelo para envio somente com arquivos; a 4.3 impede publicação totalmente vazia. Controle de edição/versão permanece na 4.4.

`TicketAttachment.messageId` e `removedAt` são opcionais. A chave estrangeira composta `(messageId, ticketId)` impede associar arquivo e mensagem de chamados diferentes, inclusive em atualizações. Anexos da abertura conservam ambos os campos nulos e seguem compartilhados. Remoção lógica não altera tamanho, chave ou estado de armazenamento: os bytes permanecem retidos e entram na quota existente enquanto o estado não for `FAILED`.

`TicketMessageRevision` guarda texto e um snapshot JSON completo `[{ id, originalName }]`, sem chave de armazenamento. Uma linha imutável evita que inclusões/remoções em tabelas filhas alterem a composição histórica. O trigger da migration rejeita `UPDATE`/`DELETE`, snapshots malformados, duplicatas, mais de cinco arquivos, nomes divergentes e arquivos indisponíveis, removidos ou de outra mensagem. Na inserção, bloqueia os arquivos consultados com `FOR SHARE` até encerrar a transação. O snapshot preserva os nomes após remoção e não concede download; a API futura deverá consultar o estado e a autorização atuais. Essas garantias SQL não são expressas integralmente pelo schema Prisma: preservar o trigger e os checks nas migrations futuras.

A migration é aditiva e foi aplicada somente em bancos sintéticos. A 4.1 não adicionou endpoints nem alterou permissões; a 4.2 habilitou texto autorizado e a 4.3 abaixo acrescenta arquivos com isolamento nos caminhos legados. Edição, exclusão e consulta de versões dependem da 4.4. [Evidências e limites da persistência](etapa-4-planejamento.md#execução-da-41--17112026).

## Conversas com isolamento — tarefa 4.2

`GET /api/tickets/{id}/messages` retorna `items`, `total`, `page`, `pageSize`, `canSend` e `canSendInternal`. Padrão de 20 itens, máximo de 100, ordem decrescente por `createdAt` e `id`. Identidade, vínculo com o setor atual, itens e contagem usam o mesmo snapshot `RepeatableRead`. O solicitante vê mensagens compartilhadas; integrantes atuais também veem notas internas. Administradores sem vínculo e terceiros recebem 404. A autoria não preserva acesso após transferência ou remoção do vínculo. Paginação por offset pode deslocar itens entre requisições se houver novas mensagens; não representa um snapshot contínuo entre páginas.

`POST` aceita multipart com `markdown`, `visibility` (`SHARED`/`INTERNAL`) e, desde a 4.3, `submissionId` obrigatório e `files` opcionais. Limite de 10.000 unidades UTF-16 no texto, preservando a indentação Markdown. Autor vem da sessão. Origem é validada e o limite de tentativas existente usa chave por usuário. Retorna 201; consultas e erros usam `Cache-Control: no-store`. Os limites do corpo e a publicação de arquivos estão descritos abaixo.

Criação revalida conta, versão da sessão e vínculo dentro da transação com o mesmo advisory lock das alterações de identidade/chamados. Grava mensagem, revisão inicial com a composição dos anexos, atividade com a mesma visibilidade e outbox juntos. Não altera status nem versão operacional do chamado: FECHADO aceita conversa, enquanto setor desativado permite somente leitura. Usuários inativos não leem nem enviam. Mensagens removidas retornam marcador com `markdown: null`; não há consulta de revisões nesta tarefa.

Atividades guardam somente o ID da mensagem e respeitam o filtro de visibilidade existente. O evento `ticket.message_created.v1` contém somente `ticketId`, `messageId` e `visibility`, sem texto ou nomes de arquivos. Futuros consumidores devem revalidar os destinatários pelo setor atual; o evento interno não é uma autorização de transmissão a todos os participantes. Não há entrega de notificações nesta etapa. O lock global preserva o padrão existente, mas serializa escritas e pode gerar contenção.

O contrato inicial somente texto foi ampliado pela 4.3 abaixo; edição/exclusão e consulta de versões continuam na 4.4 e interface na 4.5. [Execução e validação da 4.2](etapa-4-planejamento.md#execução-da-42--17112026).

## Publicação conjunta e idempotência — tarefa 4.3

O cliente fornece `submissionId` UUID e preserva esse identificador ao repetir o mesmo envio. `markdown` e `visibility` continuam obrigatórios; texto vazio/somente espaços exige pelo menos um arquivo. São aceitos até cinco campos `files`, de até 20 MiB cada, com validação real do conteúdo existente. O corpo multipart é limitado pelos bytes recebidos a 100 MiB + 64 KiB, independentemente de `Content-Length`. Campos desconhecidos, metadados repetidos, autor forjado e arquivos enviados como texto são rejeitados.

`MessageSubmission` guarda chave única `(ticketId, authorId, clientId)`, SHA-256 de texto/visibilidade e metadados/bytes/ordem dos arquivos, identificador da tentativa e referência à mensagem publicada. A migration `202611170002_message_submissions` é aditiva; os vínculos compostos impedem reservar anexos ou associar uma mensagem de outro chamado. `TicketAttachment.submissionId` diferencia reservas de conversa dos anexos antigos da abertura, sem publicar mensagem provisória.

Fluxo: autorizar → reservar quota e tentativa em transação → enviar bytes sem transação aberta → reautorizar e publicar mensagem, anexos, revisão inicial, atividade, evento e referência do envio em uma única transação. A quota de 200 MiB inclui reservas e arquivos retidos; somente `FAILED` deixa de contar. Usa o mesmo lock de identidade/chamados e uploads legados. Assim, falha parcial ou falha no evento não publica parte da conversa. A criação não altera o estado do chamado.

Repetição de envio publicado devolve sua mensagem atual, sem nova revisão/evento/upload, após autorização atual. Conteúdo diferente com a mesma chave retorna 409. Tentativa em andamento retorna 409; após falha tratada pode haver nova tentativa com a mesma chave, conservando quota dos objetos pendentes de limpeza. Tentativas interrompidas expiram após 30 minutos. Um novo identificador de tentativa impede que a execução antiga publique ou apague os arquivos do reenvio. A chave não é apagada pela limpeza e continua vinculada ao conteúdo original. Não trocar a chave apenas porque a resposta se perdeu.

Listagem geral e download filtram mensagens internas pelo setor atual, mensagens excluídas e anexos removidos. Reservas sem mensagem publicada não aparecem nem na contagem. Download revalida acesso depois de buscar os bytes. Respostas de conversa incluem até cinco anexos ativos, sem chaves privadas; marcador de exclusão retorna `markdown: null` e `attachments: []`, inclusive em reenvio. Anexos antigos sem mensagem/envio mantêm o comportamento compartilhado.

A limpeza existente processa até 100 reservas por chamada, após 30 minutos, e só libera quota depois de exclusão confirmada. Limites: depende de execução operacional; uma escrita remota concluída depois da última exclusão, seguida de queda do processo, ainda pode deixar objeto órfão (limitação herdada, não cancelamento remoto garantido pelo timeout). O multipart permanece em memória e o lock global pode limitar concorrência. Não houve ensaio de carga nem de cancelamento tardio real do S3 nesta tarefa. [Evidências da 4.3](etapa-4-planejamento.md#execução-da-43--17112026).
