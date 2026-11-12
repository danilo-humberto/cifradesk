# Adaptação da interface para shadcn/ui — 12/11/2026

## Entrega

Sidebar e select de tema migrados para o registro oficial shadcn/ui new-york-v4 (Radix), usando as dependências já instaladas. Sem alteração de manifests ou lockfile, sem commit, push ou deploy.

- `apps/web/src/components/ui`: Sidebar, Select, Sheet e suas dependências; Label, Card, Badge e Avatar.
- `apps/web/src/components/layout/sidebar.tsx`: composição da navegação, indicação da página ativa e fechamento ao navegar no celular.
- `apps/web/src/components/theme-settings.tsx`: Select/Label com claro, escuro e automático; preferência persistida pelo next-themes.
- `apps/web/src/hooks/use-mobile.ts`: breakpoint observado com `useSyncExternalStore`.
- `apps/web/src/app/layout.tsx` e `globals.css`: provider, acionador, tokens de cor e navegação sem JavaScript.
- Home, Preferências e estados de preparação usam Card; cabeçalho usa Badge e espaço de trabalho usa Avatar.
- `tests/e2e/foundation.spec.ts`: cobertura de teclado, foco, sidebar responsiva, tema, persistência, navegação e fallback sem JavaScript.

Preservados a paleta, os textos e as rotas. No celular, a navegação agora abre em Sheet. O foco retorna ao acionador ao fechar; links do menu desktop recolhido ficam `inert`. Não há implementação de autenticação ou regras de negócio nesta alteração.

## Evidências

1. RED: `docker compose exec tools pnpm test:e2e --grep "select de tema usa"` falhou nos dois projetos porque o select nativo não expunha a listbox esperada.
2. `docker compose exec tools pnpm check`: lint sem avisos, tipos de todos os pacotes e ferramentas aprovados; 2 testes unitários aprovados.
3. `docker compose build web`: build standalone concluído, com geração das rotas e validação TypeScript.
4. `docker compose up -d --no-build --wait web`: runtime local saudável.
5. `docker compose exec tools pnpm test:e2e`: 12/12 aprovados no runtime local (desktop e celular), em 19,5 segundos.
6. Inspeção visual no Chrome: sidebar, página ativa, card e select no tema escuro; abertura/fechamento da lista e retorno de foco confirmados.
7. `docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait web proxy`: desenvolvimento restaurado e saudável. Nova execução de `docker compose exec tools pnpm test:e2e`: 12/12 aprovados em 32,8 segundos. Serviços locais permaneceram saudáveis.

As primeiras execuções no servidor de desenvolvimento ainda receberam bundles antigos após edição dos arquivos no bind mount Windows. Houve falhas de localização dos novos controles e do fallback móvel sem JavaScript. Reiniciar/recriar o web fez os arquivos atuais serem servidos; a validação do runtime foi feita sobre o build atualizado. Não foram enfraquecidas as asserções para resolver essas falhas.

Revisão independente somente leitura não identificou defeitos bloqueantes; apontou descrição antiga em `architecture.md`, atualizada e reavaliada nesta entrega. Decisão: `READY_FOR_HUMAN_REVIEW`. A revisão não substitui as execuções de validação acima.

## Validação manual

1. Abrir `http://localhost:3200/settings` e alternar claro, escuro e automático; recarregar e conferir persistência.
2. Operar o select por teclado: Espaço, setas/End, Enter e Escape; conferir retorno do foco.
3. Recolher/abrir a sidebar no desktop. Em largura menor que 768 px, abrir o menu, navegar e fechar por botão ou Escape.
4. Desabilitar JavaScript e recarregar: os links continuam disponíveis e o tema acompanha o sistema.

## Limites

E2E executados com Chromium em viewport desktop e celular; não representam testes em Safari, Firefox ou leitores de tela reais. A auditoria de dependências desta etapa não foi repetida, pois nenhuma dependência mudou; a ressalva preexistente de desenvolvimento está registrada em `etapa-1-execucao.md`. Nenhum commit foi criado.
