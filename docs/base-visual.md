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
