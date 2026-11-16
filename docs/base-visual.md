# Base visual — 12/11/2026

## Escopo entregue

- Sidebar shadcn: 240 px aberta, 56 px recolhida com ícones rotulados e Tooltip; Notificações e Preferências no rodapé. Sheet móvel preservado.
- Cabeçalho de 56 px com Breadcrumb contextual, Separator e Badge de prévia. Conteúdo à esquerda com margens de 32/16 px e Preferências limitada a 880 px. Títulos de 28 px.
- Tema escuro neutro: fundo `#18181b`, superfície `#202023`, texto `#f4f4f5`; azul preservado nos destaques.
- Select de tema shadcn com revelação radial de 550 ms a partir do centro do acionador, cobrindo a viewport. Foco retorna antes da captura; lista fechada não participa da animação.
- View Transitions + Web Animations, sem dependências adicionais. Sem suporte à API, movimento reduzido ou mudança efetiva de cores, aplica imediatamente. Preferência persistida por next-themes. A última escolha durante uma transição fica enfileirada.

Arquivos principais: `components/layout/sidebar.tsx`, novo `page-header.tsx`, `components/theme-settings.tsx`, `app/layout.tsx`, `app/globals.css`, novo componente oficial `components/ui/breadcrumb.tsx` e `tests/e2e/foundation.spec.ts`, sob `apps/web/src` quando aplicável. Arquitetura atualizada em `docs/architecture.md`.

## Validação

- RED antes da implementação: testes falharam com sidebar antiga de 248 px e fundo escuro anterior `rgb(23, 32, 48)`, conforme esperado.
- `docker compose exec tools pnpm check`: lint, tipos de pacotes/ferramentas e 2 testes unitários aprovados, inclusive após correção da fila de temas.
- `docker compose build web`: build standalone aprovado.
- `docker compose up -d --no-build --wait web`: runtime local saudável.
- `docker compose exec tools pnpm test:e2e`: **20/20 aprovados no runtime**, desktop e celular, em 37 segundos.
- Desenvolvimento restaurado com `docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait web proxy`, web/proxy saudáveis. Smoke de animação e escolha concorrente: `docker compose exec tools pnpm test:e2e --grep 'radialmente|última escolha'`, **4/4 aprovados** em 15,8 segundos. Tipos das ferramentas revalidados após o ajuste final de sincronização do teste.
- Cobertura: navegação, persistência e tema automático, teclado/foco, largura recolhida, fallback sem JavaScript, origem e raio da animação real, movimento reduzido, API ausente e escolha concorrente durante animação.
- Inspeção visual no navegador integrado: fundo escuro neutro, sidebar aberta/recolhida e alinhamento do conteúdo conferidos.

O teste radial inicialmente comparava coordenadas CSS como strings exatas; o navegador arredonda frações de pixel. A comparação passou a usar tolerância de 0,01 px, mantendo origem e cobertura integral verificadas. No teste concorrente, as teclas passaram a aguardar o foco real das opções, evitando selecionar a opção anterior ao processamento assíncrono do Radix.

Revisão independente identificou descarte de uma segunda escolha durante a animação. Correção implementada com fila da última escolha, reavaliada sem bloqueios adicionais e coberta pelo E2E. Não foram alteradas dependências, banco, autenticação ou infraestrutura do projeto. Nenhum commit criado.

## Conferência manual e limites

Abrir `http://localhost:3200/settings`, alternar Claro/Escuro e observar o círculo partindo do seletor. Recarregar para conferir persistência; testar Automático, teclado e movimento reduzido do sistema. Recolher a sidebar e navegar pelos ícones; no celular, abrir/fechar o Sheet e navegar. O ambiente sem JavaScript mantém links e tema do sistema.

Automação executada em Chromium com viewport desktop e celular; Safari, Firefox e leitores de tela reais não foram exercitados. Navegadores sem View Transitions recebem a troca imediata. Alterações automáticas de tema pelo sistema não iniciam animação.

## Atualização da marca e largura da sidebar

Logo PNG fornecida pelo usuário aplicada sem alterações (hash idêntico ao original) em assets/logo-cifra.png e app/icon.png. Removido Equipe Cifra; sidebar aberta de 320 px e recolhida de 56 px, com logo inteira de 32 px de largura. Sheet móvel limitado a 320 px e à viewport.

Validações: pnpm check aprovado (lint, tipos e 2 unitários); tipos dos testes revalidados após inclusão das asserções; docker compose build web aprovado com rota /icon.png; pnpm test:e2e com 20/20 aprovados em 58,5 s. Conferência visual da logo aberta/recolhida realizada. Autorrevisão proporcional ao baixo risco; sem commit.

Durante a validação, corrigido max-width que reduzia a imagem recolhida a 31 px. Uma execução de navegação coincidiu com reinício do servidor e falhou esperando a rota; a suíte final rodou com servidor estável, sem alterar essa asserção. Para conferir manualmente, recarregar a página, verificar o ícone da aba e abrir/recolher a sidebar.

## Tipografia da marca

CifraDesk passou a usar Manrope semibold, 1,75 rem (28 px na configuração padrão) e espaçamento de 0,06 em entre letras. Fonte variável hospedada localmente em assets/fonts/manrope.ttf, obtida do repositório oficial google/fonts, com licença OFL preservada. O link usa altura mínima para permitir crescimento do texto; a marca continua oculta na faixa recolhida, onde permanece a logo.

Validação desta alteração pontual: pnpm check aprovado (lint, tipos, 2 unitários); E2E existentes da sidebar aprovados em desktop/celular (2/2); conferência visual realizada. Sem novos testes para a alteração tipográfica e sem commit.

## Telas de acesso e feedback — 16/11/2026

As quatro telas de acesso compartilham card de até 480 px, logo junto ao título, fonte Manrope local e campos de 48 px. Ativação, redefinição de senha e recuperação de acesso mantêm uma confirmação na tela após o envio, com link para entrar; a recuperação também permite tentar outro e-mail. Regras de autenticação e contratos de API foram preservados.

Sonner 2.0.8 foi adicionado com autorização explícita. O adaptador shadcn/ui usa a paleta do projeto, ícones de sucesso/erro, borda semântica e botão “Fechar notificação”. Feedbacks de ações de acesso, administração, tema, sessão, chamados e anexos usam a mesma região. Sucessos duram seis segundos; erros precisam ser dispensados e continuam disponíveis junto à ação. Mensagens iguais são substituídas, evitando acúmulo. Fora de um diálogo modal, Alt+T alcança a região de notificações; Tab e Enter permitem fechar. Enquanto um diálogo está aberto, o foco permanece dentro dele até confirmar ou cancelar. O componente não desloca o foco automaticamente para o toast. Sem suporte a popover, usa posicionamento fixo; com movimento reduzido, remove a transição do toast.

Arquivos centrais: `apps/web/src/components/auth-form.tsx`, `apps/web/src/components/ui/sonner.tsx` e `apps/web/src/lib/feedback.ts`. O layout registra uma única instância. Os demais consumidores recebem somente a integração de feedback; estados duráveis de consulta e recuperação de conflitos continuam nas telas.

### Validação manual

1. Abrir `/accept-invitation` e conferir logo, título e espaçamento em desktop/celular, claro/escuro. Para ativar, usar um convite novo; um convite consumido não volta a funcionar.
2. Enviar um link inválido com senha válida: conferir toast de erro, fechá-lo e verificar que o erro e os campos permanecem no formulário.
3. Ativar um convite novo: conferir toast e “Conta ativada”. Fechar o toast por teclado; a confirmação e “Entrar no CifraDesk” permanecem.
4. Salvar um setor e alterar o tema: conferir os toasts de sucesso e os dados persistidos. Abrir/editar um chamado e enviar anexo: conferir feedback e resultado no detalhe.
5. Repetir uma operação com versão antiga: conferir erro e a ação de recarregar, sem reenvio automático. Repetir com movimento reduzido ativado.

Testes de interface usam dados sintéticos. A inspeção automatizada cobre Chromium em desktop e viewport móvel; Safari, Firefox e leitores de tela reais não foram exercitados. Nenhuma publicação é autorizada nesta tarefa.

### Evidências e revisão

- RED: os três novos cenários falharam antes da implementação por ausência da logo/região de notificações. GREEN inicial: seis casos aprovados em desktop/celular (`.local/feedback-red.log` e `.local/feedback-green.log`).
- `docker exec cifradesk-etapa34-tools pnpm check`: lint, tipos e **75 testes unitários aprovados**; **47 integrações ignoradas** pelo comando padrão, não repetidas nesta mudança de interface (`.local/ui-check-final.log`).
- `node scripts/test-ticket-interface.mjs --all`: **56/56 aprovados**, sem retries, em 1,9 minuto, com banco sintético e SMTP de testes (`.local/ui-e2e-final.log`). A primeira rodada teve 55/56: o teste antigo de tema enviava Enter 7 ms depois de End, antes do foco assíncrono do Radix (`setTimeout`). Foram adicionadas verificações de foco na opção inicial e em Escuro antes de Enter, mantendo a escolha e o resultado exigidos.
- Verificação adicional de teclado substituiu o foco programático por Alt+T, Tab até o item e outro Tab até fechar. A primeira tentativa assumia uma única parada de Tab; a sequência foi corrigida conforme a lista e seu botão, sem alterar o comportamento do componente. O erro também é verificado após avanço de sete segundos no relógio de teste.
- Inspeção visual identificou estilos padrão do Sonner sobrepondo a personalização; seletores foram ajustados. Revisão independente apontou que a sombra personalizada retirava o indicador de foco do item. Foi adicionado contorno explícito, verificado por estilo computado e captura com foco. A primeira execução contra desenvolvimento ainda recebeu CSS anterior; reiniciar o web recarregou os arquivos montados, sem alterar as asserções.
- CSS final no runtime: `docker exec -e E2E_BASE_URL=http://proxy cifradesk-etapa34-tools pnpm exec playwright test tests/e2e/feedback.spec.ts --workers=1 --output=/tmp/feedback-final-refreshed`: **6/6 aprovados**, em 10,3 segundos (`.local/feedback-final-refreshed.log`). Capturas em `.local/auth-toast-*.png` e `.local/auth-toast-focus-*.png` conferem layout e contorno de foco. Apenas as submissões interceptadas usam a aplicação local; nenhum convite real é consumido nesses cenários.
- Após os últimos ajustes: `pnpm exec eslint tests/e2e --max-warnings 0`, `pnpm exec tsc --noEmit -p tsconfig.tools.json` e `pnpm build` aprovados dentro do container de ferramentas (`.local/ui-final-validation.log`). `git diff --check` sem erros.

Autorrevisão e revisão independente do working tree, ainda sem commits: correção de foco reavaliada; não há outro defeito bloqueante identificado. A revisão final do histórico fica para depois de commits autorizados. O foco continua limitado ao diálogo enquanto um modal estiver aberto; os resultados das confirmações atuais são emitidos após fechar o diálogo. Não houve alteração de regras de autenticação, permissões, banco da aplicação ou infraestrutura versionada.

### Minuta para o Linear — não publicada

#### O QUE E POR QUE

Telas de acesso receberam logo, card responsivo e confirmação persistente. Um adaptador shadcn/Sonner centraliza feedbacks com a paleta existente; é a menor extensão adequada para padronizar as ações atuais.

#### ALERTA DO SÊNIOR

Foco do toast corrigido e validado após a revisão. A cobertura é Chromium desktop/móvel; leitores de tela, Firefox e Safari permanecem fora desta validação. Dentro de um modal, é necessário fechá-lo para navegar ao toast por teclado.

#### FOCO DE REVISÃO

`apps/web/src/components/auth-form.tsx`: apresentação e estado persistente após envio. `apps/web/src/components/ui/sonner.tsx`: região global, tema, acessibilidade e integração com a camada nativa.

### Ajustes solicitados na revisão visual — 16/11/2026

Removido o texto de ajuda abaixo da senha e sua referência `aria-describedby`, mantendo as restrições de 8 a 128 caracteres. O campo compartilhado por convite, login e redefinição recebeu botão shadcn com olho para mostrar/ocultar, alvo de 48 px, nome acessível estável “Mostrar senha” e estado `aria-pressed`. A senha começa oculta; alternar preserva o valor e não envia o formulário. Correção automática, capitalização e verificação ortográfica ficam desativadas também quando o campo está visível. Links abaixo do formulário, incluindo “Voltar para entrar”, foram centralizados.

TDD: o cenário de teclado falhou inicialmente pela ausência do botão; após implementar, os seis testes de feedback passaram em desktop/celular (13,9 s). O cenário verifica alternância por clique e Espaço, preservação do valor, ausência de submissão e sequência de Tab. `docker exec cifradesk-ui-tools pnpm check` aprovou lint, tipos e 75 unitários; 47 integrações foram ignoradas pelo comando padrão. Evidências: `.local/password-red.log`, `.local/password-green.log`, `.local/password-check.log` e captura `.local/auth-opening-chromium.png`. Build e suíte completa de 56 E2E não foram repetidos para estes ajustes localizados.

Autorrevisão do incremento: sem novo defeito identificado; mantidos os limites de navegadores e leitores de tela descritos acima. Para conferir manualmente, digitar uma senha, clicar no olho duas vezes e verificar o valor, o mascaramento e o link centralizado. A minuta acima permanece aplicável, com `auth-form.tsx` como foco deste incremento. Sem dependências adicionais, commits, push ou PR.

### Expansão e espaçamento da sidebar — 16/11/2026

A marca permanece em uma linha com `white-space: nowrap`, `min-width: 0` e recorte visual por `overflow: hidden`. Removidos a quebra de palavra e o ocultamento instantâneo do texto: a transição de largura existente revela as letras progressivamente. O nome acessível do link permanece completo. Administração integra a mesma lista shadcn dos três primeiros itens, herdando o intervalo uniforme de 4 px; sua condição de exibição por perfil foi preservada.

Validação: lint do componente (`docker exec cifradesk-local-web-1 pnpm exec eslint apps/web/src/components/layout/sidebar.tsx --max-warnings 0`) e tipos do web (`pnpm --filter @cifradesk/web typecheck`) aprovados. Conferência no navegador local em `/admin`: intervalos medidos de 4/4/4 px; texto com largura 0 px recolhido, 11,34 px durante abertura e 145,42 px expandido, mantendo altura de 35 px. Captura em `.local/sidebar-review.jpg`. Sem novos testes automatizados para este ajuste visual de duas linhas; build, suíte completa e viewport móvel não foram repetidos. Para conferir manualmente, recolher/expandir e observar o texto em uma linha e os quatro itens com intervalo igual.

Minuta complementar para o Linear, não publicada:

#### O QUE E POR QUE

Texto da marca é revelado pelo espaço disponível, sem quebrar letras. Uma única lista usa o espaçamento nativo do shadcn, sem animação JavaScript nem ajustes individuais de margem.

#### ALERTA DO SÊNIOR

Sem defeito adicional identificado na revisão deste incremento. Verificação visual limitada ao navegador desktop; os limites acima permanecem. Nenhum commit, push ou PR.

#### FOCO DE REVISÃO

`apps/web/src/components/layout/sidebar.tsx`: recorte do texto e composição da lista com Administração condicional.

### Propostas para Minhas solicitações e ação atualizar — 16/11/2026

Foram entregues três prévias visuais com dados explicitamente ilustrativos: A, tabela organizada para comparar chamados; B, lista com mais respiro e destaque aos títulos; C, cards por chamado. As propostas foram aprovadas como três visualizações selecionáveis no incremento descrito abaixo; as imagens usam somente dados ilustrativos.

O ajuste comum já implementado coloca Atualizar lista no cabeçalho, imediatamente à esquerda de Abrir chamado, com botão shadcn somente com ícone RefreshCw, nome acessível e Tooltip “Atualizar lista”. A ação continua usando `query.refetch()` e fica desabilitada durante a consulta, com movimento reduzido respeitado. Como a lista é compartilhada, o mesmo posicionamento se aplica à fila dos setores. Não foram modificados filtros, paginação, dados ou autorização.

Lint do arquivo (`pnpm exec eslint apps/web/src/components/tickets/list.tsx --max-warnings 0`) e tipos do web (`pnpm --filter @cifradesk/web typecheck`) aprovados no container local. Web reiniciado e saudável. Inspeção visual confirmou a posição e a ausência do botão antigo no rodapé; a validação de interação não foi concluída: o navegador integrado permaneceu apresentando o estado inicial de carregamento e rejeitou ações por referências de elementos obsoletas, inclusive em aba temporária. Os logs do web mostraram respostas 200 para as consultas de chamados/setores, sem confirmar a causa do problema no navegador. Não declarar hover, foco, Escape ou refetch verificados nesta rodada. Build e E2E não repetidos.

Conferência manual pendente: com a lista carregada, passar o mouse sobre o ícone, conferir o tooltip, alcançá-lo por Tab, dispensar com Escape e clicar para atualizar preservando os filtros. A implementação posterior das opções A/B/C está registrada abaixo. Sem commits, push ou PR.

Minuta complementar para o Linear, não publicada:

#### O QUE E POR QUE

A ação atualizar foi agrupada com abrir chamado, usando Button e Tooltip existentes. Três propostas ilustram alternativas de organização; nenhuma foi aplicada como layout definitivo.

#### ALERTA DO SÊNIOR

Verificação interativa pendente pelas falhas descritas no navegador integrado. O componente compartilhado também altera a posição da ação na fila dos setores. Prévias não representam dados reais nem funcionalidades adicionais aprovadas.

#### FOCO DE REVISÃO

`apps/web/src/components/tickets/list.tsx`: ação de atualização no cabeçalho, nome acessível, tooltip e estado de consulta.

### Visualizações selecionáveis dos chamados — 16/11/2026

Implementadas Tabela (padrão), Lista e Cards em Minhas solicitações e Fila dos meus setores. O Select shadcn fica entre Atualizar lista e Abrir chamado. A seleção dura enquanto o componente permanece montado; não há persistência entre sessões. A troca altera somente a apresentação dos mesmos 20 registros por página, sem incluir a visualização na chave da consulta nem reiniciar filtros/paginação.

`list.tsx` mantém consulta, filtros e estados de carregamento, erro e vazio. `views.tsx` concentra apresentação, usando Table, Card e Badge existentes. Todas as opções preservam número, título/link, setor, nome informado, status, responsáveis, aviso de reatribuição, autor, data criada, prioridade e vencimento. A tabela mantém colunas sem compactação excessiva, com região de rolagem horizontal acessível por teclado. A grade dos filtros usa coluna com largura mínima zero e limita o valor selecionado, evitando que nomes longos de setores alarguem o viewport móvel. Lista e cards usam títulos e metadados sem truncar conteúdo; cards passam de uma a duas ou três colunas conforme a largura. Temas e fonte vêm dos tokens existentes.

Escopo desta tarefa: `apps/web/src/components/tickets/list.tsx`, `apps/web/src/components/tickets/views.tsx`, `tests/e2e/ticket-views.spec.ts` e este documento. Branch `codex/chamados-visualizacoes`, criada preservando alterações anteriores não commitadas. Nenhuma dependência, regra de autorização ou API alterada. Nenhum commit, push, PR ou publicação no Linear.

Validação concluída: `docker exec cifradesk-etapa34-tools pnpm check` aprovou lint, tipos e 75 testes unitários; 47 integrações ignoradas pelo comando padrão. RED no build anterior: dois cenários (Chromium desktop/celular) falharam pela ausência do seletor, conforme `.local/ticket-ui-results-38`. O runner local `.local/test-ticket-views.mjs` adapta o runner existente para selecionar somente o novo arquivo, com banco sintético e usuário exclusivos. Build inicial aprovado. A primeira rodada identificou um seletor de teste ambíguo (alerta da tela e anunciador Next.js) e overflow móvel com nome longo de setor: viewport de 390 px alargado para 449 px, afetando o toque na paginação. O teste foi delimitado ao conteúdo principal; a grade dos filtros recebeu largura mínima zero. Após a correção, `docker exec cifradesk-etapa34-tools pnpm --filter @cifradesk/web build` passou novamente e os quatro E2E passaram (1,6 min), incluindo toque na paginação móvel e limite real de 390 px. Evidências finais: `.local/ticket-ui-results-1774`, `.local/ticket-ui-report-1774` e capturas `.local/ticket-view-*.png`. Foram conferidos desktop/celular, ambos os escopos, preservação de filtros/página/link, ausência de novas consultas na alternância, atualização, vazio, erro, recuperação, ordem de foco e temas claro/escuro. Lint dos arquivos envolvidos e `git diff --check` passaram. A suíte E2E completa, Firefox, Safari e leitores de tela não foram executados neste incremento.

Roteiro manual: abrir `/requests` e `/departments`; usar Tab para percorrer Atualizar → Visualização → Abrir chamado; alternar Tabela/Lista/Cards; aplicar filtros, avançar a página e alternar novamente; atualizar e abrir um chamado pelo título. Conferir temas claro/escuro e largura móvel; na tabela, focar a região e rolar horizontalmente. Recarregar a página deve restaurar Tabela.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE

Seletor shadcn alterna tabela, lista e cards mantendo uma única consulta e os mesmos dados. Estado local é a solução mais simples para uma preferência sem persistência exigida.

#### ALERTA DO SÊNIOR

A tabela exige rolagem horizontal em telas estreitas; lista e cards oferecem leitura vertical. A seleção reinicia ao remontar a tela. Overflow dos filtros com nomes longos foi corrigido e revalidado; nenhum outro defeito identificado no diff deste incremento. Cobertura limitada a Chromium desktop/móvel, sem leitores de tela.

#### FOCO DE REVISÃO

`apps/web/src/components/tickets/list.tsx`: isolamento entre visualização e consulta. `apps/web/src/components/tickets/views.tsx`: equivalência de campos, links e acessibilidade das três apresentações.

### Filtros, carregamento e paginação dos chamados — 16/11/2026

A faixa de filtros usa os tokens existentes, contorno discreto e disposição vertical no celular. O seletor de setores apresenta “Nenhum setor disponível.” no campo e como item desabilitado no dropdown, inclusive quando a exclusão do setor atual deixa a página sem opções. O carregamento inicial usa Spinner shadcn de 32 px centralizado, com texto anunciado por uma região de status e rotação mais lenta para movimento reduzido. Após a consulta vazia, Empty apresenta ícone acima da mensagem centralizada. A paginação da lista usa Pagination e botões shadcn com setas, contagem e alinhamento à direita; as outras paginações preservam a apresentação anterior.

Escopo: list.tsx, shared.tsx e componentes oficiais ui/spinner.tsx, ui/empty.tsx e ui/pagination.tsx, além deste documento. Sem dependências novas. A lista compartilhada aplica a apresentação também à fila de setores; DepartmentChoice compartilha o texto interno nos formulários. Branch codex/modernizar-filtros-chamados; alterações anteriores preservadas e fora deste incremento.

Verificação: lint dos cinco componentes, typecheck do web e git diff --check aprovados. Navegador desktop confirmou faixa, estado vazio centralizado, paginação à direita, mensagem desabilitada no dropdown e fechamento com Escape com foco visível. Não houve TDD para este incremento de apresentação, sem mudança das consultas ou regras de paginação. Carregamento transitório, viewport móvel, build e E2E não foram executados nesta rodada.

Roteiro manual complementar: abrir /requests e /departments, conferir carregamento durante consulta, alternar filtros e páginas com registros, testar largura móvel e movimento reduzido. Revisão do incremento feita contra cópias anteriores dos arquivos, além dos novos componentes oficiais; não substitui auditoria final do histórico após commits autorizados.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE

Filtros agrupados, setor vazio dentro do seletor, carregamento e resultado vazio centralizados e paginação à direita. Composição de componentes shadcn existentes e oficiais, sem novas dependências.

#### ALERTA DO SÊNIOR

Sem defeito bloqueante identificado na revisão do incremento. Componentes compartilhados também afetam a fila de setores e o texto vazio nos formulários; validação visual limitada ao desktop e sem observação do carregamento transitório.

#### FOCO DE REVISÃO

list.tsx: estados da consulta e composição visual. shared.tsx: seletor vazio e paginação opcional da lista. Nenhum commit, push, PR ou comentário publicado.

Validação final adicional: docker exec cifradesk-local-web-1 pnpm check aprovado (lint, tipos de todos os pacotes e 75 testes; 47 integrações ignoradas pelo comando padrão).

### Consolidação em commits locais — 16/11/2026

A pedido do usuário, todo o diff acumulado foi organizado por responsabilidade na branch codex/modernizar-filtros-chamados: HMR local, feedbacks/telas de acesso, sidebar, visualizações/filtros e esta documentação. As menções anteriores a “sem commits” descrevem o estado de cada entrega antes desta consolidação. Não houve push, PR, merge ou publicação no Linear.

Na preparação, o teste ticket-views.spec.ts foi adequado à paginação aprovada: verifica a região “Paginação dos chamados”, preservando as expectativas de 21 registros e páginas 1/2, agora exibidas separadamente. Removidas linhas vazias excedentes no fim dos três novos componentes shadcn.

Validação desta rodada: docker exec cifradesk-local-web-1 pnpm check aprovado (lint, tipos de todos os pacotes e 75 testes; 47 integrações ignoradas). Cada conjunto de código preparado para commit passou por tsc --noEmit em arquivo exportado da árvore do índice Git para diretório isolado no container, reutilizando dependências e tipos gerados existentes. A primeira checagem isolada precisou incluir o cliente Prisma gerado, ausente do arquivo Git; após incluí-lo, os conjuntos passaram. git diff --cached --check aprovado após remover as linhas excedentes. Não foram repetidos build de produção nem E2E, inclusive o cenário de paginação atualizado.
