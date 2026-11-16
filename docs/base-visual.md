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

### Sidebar animada e menu da conta — 16/11/2026

A navegação principal tem transição de cor de 200 ms no hover. Um único pseudo-elemento desloca o fundo entre as rotas selecionadas, preservando aria-current também nas subrotas. CSS Anchor Positioning acompanha o item onde há suporte; o fallback usa o índice da rota e as alturas fixas existentes (40 px expandida, 32 px recolhida, intervalo de 4 px). Movimento reduzido remove o deslocamento animado sem remover o destaque; cores forçadas usam uma borda de sistema.

O rodapé mostra Avatar shadcn (imagem da conta ou iniciais), nome, e-mail truncado e seta para cima. DropdownMenu shadcn reúne Notificações, Preferências e Sair da conta; o menu mostra o e-mail completo, tem limites de viewport e abre acima do acionador. Espaço/Enter abrem, setas percorrem os itens e Escape fecha. Navegar por uma opção fecha também a sidebar móvel. Sem JavaScript, os links de notificações/preferências permanecem disponíveis em noscript; sair continua exigindo JavaScript.

Somente nome, e-mail e imagem retornados por requireUser são passados à sidebar. O hook useLogout reaproveita a implementação existente de preferências: POST de sign-out, limpeza dos feedbacks/cache e navegação para login. A opção fica indisponível enquanto aguarda; falha mantém o menu, mostra mensagem e permite repetir. Encerrar todas as sessões continua somente em Preferências, com a confirmação existente. Nenhuma API, permissão, contrato de autenticação ou dependência foi alterada. Notificações continua apontando à página existente, ainda em preparação.

Validação: docker exec cifradesk-local-web-1 pnpm check aprovou lint, tipos e 75 testes; 47 integrações ignoradas pelo comando padrão. Conferência no navegador local comprovou menu por teclado, foco inicial em Notificações, navegação para Preferências no desktop e Notificações no móvel, fechamento do painel móvel, menu com sidebar recolhida e viewport de 390 px sem overflow (menu com 256 px). Destaque mudou de top 88 px em Setores para 44 px em Minhas solicitações, com transição computada de 200 ms. Captura: .local/sidebar-account-preview.jpg. O indicador de desenvolvimento do Next.js sobrepõe o avatar no canto inferior esquerdo, especialmente recolhido; o menu foi acessado por teclado nesse caso.

foundation.spec.ts foi atualizado para o novo caminho de navegação e recebeu cenários de identidade, teclado/foco, falha e nova tentativa de logout e movimento reduzido. Esses E2E não foram executados: a fixture exige banco sintético isolado e o ambiente em execução é o de trabalho. Não há evidência RED/GREEN deste incremento. Logout real, fallback sem JavaScript, movimento reduzido em execução, cores forçadas, Firefox/Safari e build de produção permanecem sem validação nesta rodada. Não declarar a implementação integralmente validada por pnpm check.

Roteiro manual restante: em ambiente sintético, testar falha e sucesso de Sair da conta, verificar que apenas a sessão atual é encerrada; repetir navegação com movimento reduzido, cores forçadas e sem JavaScript. Conferir animação durante a troca e não apenas suas posições finais.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE

Um destaque CSS compartilhado acompanha a rota, com hover de 200 ms. Menu shadcn reúne identidade e ações da conta e reutiliza o logout existente, sem chamadas extras para buscar o usuário.

#### ALERTA DO SÊNIOR

Fallback do destaque depende das alturas e espaçamento definidos na sidebar; alterações nesses tokens devem acompanhar o cálculo. DevTools do Next.js sobrepõe o avatar localmente quando recolhido. E2E e logout real pendentes; não há garantia de ausência de falhas.

#### FOCO DE REVISÃO

apps/web/src/components/layout/sidebar.tsx: identidade, menu, navegação e estados. apps/web/src/components/session-controls.tsx: reaproveitamento da saída de sessão e tratamento de falhas. Sem commits, push, PR ou publicação no Linear.

### Cursor dos elementos interativos — 16/11/2026

A regra cursor-pointer do AGENTS.md é aplicada em globals.css aos links com destino, botões, campos, labels associados, seletores e opções, controles com papéis ARIA interativos e botões de rolagem do Select shadcn. O botão nativo de escolha de arquivo também recebe pointer. A declaração global usa @apply cursor-pointer fora das camadas Tailwind para prevalecer sobre cursor-default dos componentes incorporados, sem !important nem duplicação em cada tela.

A varredura de componentes e páginas encontrou as ações atuais expressas por esses elementos/papéis; não foram encontrados manipuladores de clique em contêineres sem semântica. Estados disabled, aria-disabled, data-disabled, inert e descendentes de fieldsets desabilitados são excluídos, assim como labels adjacentes ou envolvendo controles desabilitados. A regra não cria eventos, destinos nem disponibilidade de ações. Componentes futuros devem manter semântica interativa apropriada ou adicionar explicitamente cursor-pointer.

Conferência no navegador em /departments: estilos computados confirmaram pointer nos links, botão da sidebar, menu da conta, atualizar, seletores, labels e todas as oito opções do status; os botões Anterior/Próxima desabilitados continuaram com default. Menus Notificações, Preferências e Sair da conta também receberam pointer. Nenhuma ação de escrita foi enviada. Sem novos testes para este ajuste visual global; não houve TDD. A varredura estática cobre o código atual, mas nem todas as telas/estados foram abertos no navegador.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE

Cursor de mão padronizado nos elementos interativos por uma regra CSS central. A cascata cobre também os padrões do shadcn, sem alterar cada consumidor.

#### ALERTA DO SÊNIOR

A regra depende da semântica dos elementos; novos controles customizados precisam usar elemento/papel apropriado ou cursor-pointer explícito. Verificação visual por amostragem; não houve execução da suíte E2E.

#### FOCO DE REVISÃO

apps/web/src/app/globals.css: seletores cobertos, precedência e exclusões de estados desabilitados. Alterações anteriores preservadas; sem commits, push ou PR neste incremento.
Validação automática deste incremento: docker exec cifradesk-local-web-1 pnpm check aprovado — lint, tipos e 75 testes; 47 integrações ignoradas. git diff --check sem erros. Sem build de produção ou E2E nesta rodada.

### Contorno das opções do menu — 16/11/2026

DropdownMenuContent distingue movimento do ponteiro de entrada pelo teclado. Na interação por mouse, o estilo global de focus-visible deixa de desenhar contorno nos itens; a cor de fundo de destaque permanece. Ao pressionar uma tecla no menu, o contorno de foco volta, inclusive se o ponteiro continuar sobre uma opção. Eventos fornecidos pelos consumidores continuam sendo chamados.

Validação: lint do componente, typecheck do web e git diff --check aprovados. No navegador local, abertura por Espaço apresentou contorno sólido de 3 px; interação por ponteiro mudou data-input-method para pointer e os itens ficaram com outline none; ArrowDown restaurou keyboard e contorno sólido de 3 px. Sem novos testes automatizados, build ou E2E para este ajuste pontual de apresentação. Sem commits ou publicação.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE

Contorno removido das opções durante interação por mouse, preservando destaque de fundo e foco de teclado. Estado local ao menu evita mudar o foco global da aplicação.

#### ALERTA DO SÊNIOR

Validação manual limitada ao navegador local; suíte E2E e dispositivos de toque não executados. Nenhum defeito adicional identificado no incremento.

#### FOCO DE REVISÃO

components/ui/dropdown-menu.tsx: identificação da entrada e composição dos eventos. app/globals.css: remoção do contorno limitada aos itens do menu no modo ponteiro.

### Commits da sidebar e interações — 16/11/2026

Todo o diff pendente foi autorizado para commits locais e organizado em sidebar/menu da conta, cursor dos controles, foco no hover e documentação. As menções anteriores a “sem commits” representam o estado de cada entrega antes desta consolidação. Nenhum push, PR, merge ou publicação no Linear foi realizado.

Na preparação, docker exec cifradesk-local-web-1 pnpm check passou novamente: lint, tipos e 75 testes; 47 integrações ignoradas. As árvores preparadas antes e depois da mudança TypeScript de hover passaram em tsc --noEmit para web e ferramentas, exportadas do índice Git em diretórios isolados, reutilizando dependências e tipos gerados. O commit de cursor altera somente CSS e instruções, sem mudar o estado TypeScript. git diff --cached --check passou nos conjuntos. Build de produção e E2E não foram executados; as limitações funcionais registradas acima permanecem.

### Carregamento de setores dentro do seletor — 16/11/2026

DepartmentChoice informa Carregando setores… dentro do SelectTrigger, acompanhado pelo Spinner shadcn de 16 px. A opção loadingText de Choice desabilita o controle e informa aria-busy; uma região de status visualmente oculta mantém o anúncio sem acrescentar uma linha visível abaixo do campo. O conteúdo é fornecido também como placeholder do SelectValue para cobrir o estado inicial sem seleção. Spinner reutiliza a preferência de movimento reduzido existente. Refetch com dados disponíveis preserva o valor; erro, vazio e paginação mantêm seus comportamentos.

Conferência em /requests durante carregamento: status e setor com altura de 36 px e top de 251,84375 px, confirmando alinhamento. Captura em .local/department-loading-inline.jpg. Lint do componente, typecheck do web e git diff --check passaram. Sem novos testes/TDD para este ajuste visual localizado; build, E2E, leitor de tela e viewport móvel não executados. O componente compartilhado aplica o mesmo carregamento aos formulários que usam DepartmentChoice.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE

Mensagem e spinner ficam dentro do seletor para evitar que o carregamento aumente a linha de filtros. Componentes shadcn existentes, sem dependências novas.

#### ALERTA DO SÊNIOR

Conferência visual limitada ao desktop durante carregamento; E2E e leitores de tela não executados. Sem defeito adicional identificado no incremento.

#### FOCO DE REVISÃO

apps/web/src/components/tickets/shared.tsx: apresentação de loadingText e sua ligação ao estado pendente da consulta de setores. Sem commits, push ou PR.

### Título centralizado dos filtros — 16/11/2026

O painel de filtros usa uma grade com o título e ícone centralizados acima dos campos. A partir de `sm`, status e setor dividem igualmente a largura disponível; abaixo disso, ficam empilhados. Limpar setor ocupa uma linha própria à direita para preservar a largura dos seletores. Continuação do ajuste dos filtros na mesma branch, preservando o carregamento dentro do seletor.

Lint do componente e análise de tipos passaram. Sem novos testes por ser uma alteração apenas de layout; navegador e viewport móvel não conferidos nesta etapa.

#### O QUE E POR QUE
Grade de duas colunas iguais com título abrangendo ambas; é a alteração mais simples para centralizar o título e distribuir os campos.

#### ALERTA DO SÊNIOR
Sem defeito adicional identificado no diff. Validação visual no navegador pendente nesta etapa.

#### FOCO DE REVISÃO
`apps/web/src/components/tickets/list.tsx`: grade do painel e posicionamento da ação de limpar setor.

### Paginação compartilhada e propostas de Administração — 16/11/2026

`PaginationFooter` centraliza o rodapé shadcn alinhado à direita, com total, página atual e botões anterior/próxima. Reutilizado em chamados, opções de setores, responsáveis, anexos, histórico, usuários, setores, integrantes e pessoas disponíveis. Cada consumidor informa um nome acessível contextual; os botões usam `type="button"` para não enviar os formulários que contêm paginação. Mantidos tamanho padrão de 20, limites e callbacks existentes; administração também bloqueia navegação durante busca. Singular corrigido para 1 registro. Não há dependências novas nem mudanças em APIs ou permissões.

Foram apresentadas três propostas ilustrativas, ainda não implementadas, para Administração: A, tabela compacta; B, lista e detalhes; C, cartões de pessoas. Todas usam a identidade escura/azul existente. A recomendação é A pela comparação de situação e acesso. Controles e dados dos mockups são conceituais; a implementação escolhida deverá preservar confirmações e regras de autorização existentes.

Validação: ESLint dos componentes alterados, typecheck do web e 75 testes existentes passaram; 47 testes de integração foram ignorados pela configuração. Conferência visual desktop em /admin: rodapé à direita, 1 registro e ambos os botões desabilitados. Evidência local: `.local/admin-pagination-footer.jpg`. Sem novos testes/TDD para extração de apresentação com callbacks preservados. Build, E2E, navegação com múltiplas páginas e viewport móvel não executados. Revisão React: componente sem estado duplicado ou efeitos novos, imports diretos, controles shadcn e nomes acessíveis.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE
Um único rodapé elimina as duas versões de paginação e uniformiza todas as telas paginadas. Propostas de Administração entregues apenas para escolha visual.

#### ALERTA DO SÊNIOR
Sem defeito adicional identificado no incremento. A validação no navegador cobriu apenas desktop com uma página; casos com múltiplas páginas e leitores de tela permanecem sem execução.

#### FOCO DE REVISÃO
`apps/web/src/components/pagination-footer.tsx`: limites, acessibilidade e botões seguros dentro de formulários. `apps/web/src/components/admin-panel.tsx`: adoção nas três listas independentes. Sem commits, push ou PR nesta etapa.

### Administração com lista e detalhes (opção B) — 16/11/2026

Usuários e Setores agora compartilham o padrão lista à esquerda e detalhes à direita, com colunas empilhadas abaixo de lg. O primeiro resultado visível é selecionado inicialmente; seleção, página e busca controlam o item exibido. A busca por nome/e-mail (usuários) ou nome (setores) filtra somente a página carregada, explicitamente identificada na interface. Não há busca global nem carregamento de todas as páginas.

Convite e criação de setor foram movidos para Dialog shadcn; abas usam Tabs shadcn. Fontes oficiais incorporadas de https://ui.shadcn.com/r/styles/new-york-v4/dialog.json e https://ui.shadcn.com/r/styles/new-york-v4/tabs.json, com imports adaptados ao projeto e texto Fechar traduzido. Reutilizam radix-ui existente, sem instalar dependências. Dados de acesso continuam somente leitura no resumo; ações sensíveis preservam ConfirmButton e endpoints existentes. Integrantes abre no painel de detalhes do setor. O rodapé compartilhado permanece ao final da área. Alterações ainda não salvas no nome são descartadas ao trocar seleção, aba, página ou filtrar o item para fora da lista.

Validação: ESLint dos componentes e teste E2E editado, typecheck do web e 75 testes existentes passaram; 47 integrações foram ignoradas. Navegador: usuário selecionado, busca sem resultado e limpeza, abas, estado vazio de Setores, diálogos de convite e novo setor, foco inicial e Escape. Layout móvel de 390 px conferido sem overflow horizontal (scrollWidth 375); corrigida quebra de badges que apertava o nome. Capturas .local/admin-users-master-detail.jpg e .local/admin-users-mobile.jpg. Dados locais não têm setores cadastrados: edição de setor e integrantes não foram exercitadas no navegador. Não foram executadas mutações reais, build nem E2E; infraestrutura isolada exigida pelos fixtures não está ativa. Fluxos E2E foram adaptados aos diálogos, tabs e seleção, incluindo busca vazia e foco. Sem evidência RED/GREEN nesta etapa.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE
Opção B aplicada às duas abas, com lista selecionável e formulário de detalhes. Diálogos liberam o espaço antes ocupado por criação, usando shadcn e preservando a API existente.

#### ALERTA DO SÊNIOR
Busca limitada à página atual, com rótulo explícito. Trocar seleção descarta edição não salva do nome. E2E e edição de setores com dados não executados nesta etapa.

#### FOCO DE REVISÃO
`apps/web/src/components/admin-panel.tsx`: seleção, busca, diálogo e preservação das confirmações. `tests/e2e/identity.spec.ts`: adequação dos fluxos de convite e setores à nova interação. Sem commits, push ou PR.

### Cores de estado e abas animadas da Administração — 16/11/2026

Abas com 40 px, iguais à ação principal, e sublinhado único que desliza em 200 ms. CSS Module limita a personalização à Administração. Indicador por borda em pseudo-elemento, com anchor positioning quando disponível e fallback por transform em duas colunas iguais. Transições respeitam prefers-reduced-motion; aria-selected e teclado continuam sob controle do Tabs shadcn.

Badges de usuários e setores: ativo verde, convidado âmbar, desativado cinza; administrador azul. Tons específicos para temas claro e escuro e textos preservados para não depender apenas da cor.

Validação: lint do componente, typecheck web e git diff --check passaram. Navegador desktop confirmou abas e ação com 40 px, duração de 0,2 s e indicador mudando de 0 para 110,797 px ao selecionar Setores. Ativo verde e Administrador azul conferidos visualmente. Evidência: .local/admin-status-tabs.jpg. Sem novos testes por ser ajuste visual; tema claro, estados sem dados locais, movimento reduzido e fallback não exercitados no navegador.

#### O QUE E POR QUE
Cores distinguem situação e acesso; abas acompanham a altura da ação e um único sublinhado mantém continuidade na troca.

#### ALERTA DO SÊNIOR
Fallback assume as duas abas de mesma largura. Validação visual limitada ao tema escuro e aos estados disponíveis localmente; sem defeito adicional identificado no incremento.

#### FOCO DE REVISÃO
apps/web/src/components/admin-panel.module.css e apps/web/src/components/admin-panel.tsx: estilos locais, animação e mapeamento das cores. Sem commits, push ou PR.

### Consolidação dos commits locais — filtros, paginação e Administração

Todo o diff foi autorizado para commits locais e dividido entre filtros/paginação de chamados, Administração com testes E2E adaptados e documentação. Registros anteriores de sem commits indicam o estado das entregas antes desta consolidação. Nenhum push, PR, merge ou publicação no Linear foi realizado.

Na preparação, `docker exec cifradesk-local-web-1 pnpm check` passou: lint global, tipos e 75 testes, com 47 integrações ignoradas. As duas árvores de código preparadas no índice passaram em `tsc --noEmit` para web e ferramentas, exportadas para diretórios isolados com dependências existentes. A primeira tentativa do verificador falhou por arquivo auxiliar ausente no container; após copiá-lo, as verificações passaram. Removidas linhas vazias excedentes no fim dos componentes Dialog e Tabs; `git diff --cached --check` passou. Build e E2E não executados; as limitações registradas nas entregas permanecem.

### Sidebar redimensionável — 16/11/2026

Sidebar expandida ajustável de 280 a 420 px, com largura inicial de 320 px. Arrastar a borda direita ou focar o separador e usar setas (10 px), Home (280 px) e End (420 px). O estado permanece no provider durante a navegação e ao recolher/expandir; recarregar restaura 320 px. Menu móvel e largura recolhida seguem o comportamento anterior. Sidebar e Separator shadcn existentes, sem dependências novas. Captura de ponteiro mantém o arraste fora da borda; cancelamento/perda de captura encerra o gesto. Sem transição de largura enquanto expandida para acompanhar o ponteiro imediatamente.

Validação: `docker exec cifradesk-local-web-1 pnpm check` aprovado (lint global, tipos e 75 testes; 47 integrações ignoradas). Primeira execução falhou no acesso possivelmente undefined ao mapa de teclas; corrigido antes da execução final. `git diff --check` aprovado. Navegador local: Home + seta para esquerda manteve 280; End + seta para direita manteve 420; arrastes além dos dois limites respeitaram os limites; recolher/expandir preservou 420; setas retornaram a 320. Captura em `.local/sidebar-resize.png`. Houve erro transitório de JSON do Next durante recompilação; reload posterior recuperou a página. Sem TDD RED/GREEN ou novo teste automatizado: validação direta de interação no navegador para este incremento pequeno, sem infraestrutura de teste DOM instalada. Mobile, leitor de tela, build e E2E completo não executados.

Minuta para o Linear — não publicada:

#### O QUE E POR QUE
A borda permite ajustar a navegação entre 280 e 420 px, com teclado e arraste. Extensão dos componentes shadcn existentes é a solução mais simples adequada, sem dependências novas.

#### ALERTA DO SÊNIOR
Sem defeito bloqueante identificado na revisão do diff local. A largura não persiste após recarregar. Validação de interação limitada ao navegador desktop; mobile e leitores de tela não exercitados.

#### FOCO DE REVISÃO
`apps/web/src/components/ui/sidebar.tsx`: limites, captura de ponteiro e teclado. `apps/web/src/components/layout/sidebar.tsx`: ativação na navegação. Branch `codex/sidebar-redimensionavel`, baseada no estado local anterior; commits de outras tarefas já existentes na base não foram alterados. Sem commit, push ou PR.

Ajuste solicitado em 16/11/2026: área de arraste transparente, sem realce no hover/foco nem tooltip; cursor `ew-resize` indica o redimensionamento horizontal. Exceção explícita à regra geral de cursor-pointer, conforme pedido do usuário. Limites e teclado preservados. A remoção do indicador visual de foco também reduz a identificação do controle para quem navega por teclado.
