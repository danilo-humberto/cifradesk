# Etapa 1 — Fundação: execução e evidências

Data: 12/11/2026. Implementação e validações locais concluídas, com ressalva documentada de tooling. Sem commit.

Referência: [plano](plano-implementacao.md), etapas 1 e baseline da seção 12. O usuário autorizou explicitamente configurar/instalar dependências e baixar/executar containers locais até concluir as verificações, sem commit. Não houve acesso a produção ou migrations.

## Entrega

- Workspace pnpm com web, worker e quatro pacotes compartilhados, versões diretas exatas e lockfile único. Instalação com validação estrita de engines/peers, sem conflitos reportados.
- Next.js App Router, TypeScript, Tailwind, Button shadcn/ui incorporado manualmente, provider React Query e navegação responsiva.
- Temas claro, escuro e automático, persistidos no navegador. Páginas futuras identificadas como indisponíveis; sem dados de negócio fictícios.
- Dockerfiles de desenvolvimento e standalone; worker/dispatcher compartilham imagem e encerram por SIGTERM/SIGINT.
- Compose local: Caddy, web, worker, dispatcher, PostgreSQL, Redis de cache, Redis de filas, SeaweedFS e Mailpit. Ferramentas e dependências em volumes Linux próprios.
- `.env.example` sem segredos e gerador de credenciais locais. `.env` e `.local` excluídos de Git/build/lint.
- Documentação: README, arquitetura, operação, plano e este registro.

Git foi inicializado em `main`, sem commit ou remoto. Não havia código preexistente; o plano anterior foi preservado e atualizado. Nenhum arquivo foi preparado para commit.

## Evidências executadas

Comandos abaixo executados em Linux/amd64, Node 24.22.3 e pnpm 10.34.9. Durante a preparação, `docker exec cifradesk-validation` foi usado para as mesmas ferramentas que agora estão em `docker compose exec tools`.

| Verificação | Comando/cenário real | Resultado |
| --- | --- | --- |
| Host | `docker version`, `docker compose version` | Engine 29.9.2, Desktop 4.98.0, Compose 5.6.1; Linux/amd64 |
| Imagens | Consulta de tags/digests na API Docker Hub e pull | Seis digests coincidiram com o plano; imagens baixadas |
| Dependências | `pnpm install`; depois `pnpm install --frozen-lockfile` | Instalação concluída e segunda resolução sem alteração |
| Prisma | `pnpm db:generate` | Schema válido e client 7.10.1 gerado; nenhuma conexão/migration |
| Lint | `pnpm lint` | Exit 0, zero warnings após correção do export PostCSS |
| Tipos | `pnpm typecheck` | Exit 0 nos seis pacotes/apps e ferramentas/testes |
| Unitários | `pnpm test` | 2 testes aprovados |
| Build web | `pnpm --filter @cifradesk/web build` | Compilação, TypeScript e geração das sete rotas concluídas |
| Imagens de aplicação | `docker compose -f compose.yaml -f compose.dev.yaml build web worker`; `docker compose build web` | Imagens dev, worker e standalone construídas |
| Compose | `docker compose -f compose.yaml -f compose.dev.yaml config --quiet` | Exit 0 |
| Inicialização | `docker compose -f compose.yaml -f compose.dev.yaml up -d --no-build --wait` | Nove serviços saudáveis |
| E2E desenvolvimento | Playwright 1.65.0, Chromium 158; mesmos config/testes copiados ao container de navegador durante preparação | 8 aprovados, desktop e celular emulado; sem retries |
| E2E standalone | `docker compose exec tools pnpm test:e2e` | 8 aprovados em 8,0s, sem retries |
| Encerramento | `docker compose stop worker dispatcher`; inspeção de ExitCode e nova subida | Ambos exit 0; voltaram saudáveis |
| Redis | `redis-cli CONFIG GET maxmemory-policy appendonly` em cada serviço | Cache: allkeys-lru/no; fila: noeviction/yes |
| Banco | `SELECT current_database(), current_user`; contagem de tabelas public | cifradesk/cifradesk; zero tabelas de negócio |
| S3 | GET anônimo em `http://seaweedfs:8333/` | HTTP 403; master e filer HTTP 200; metadados em `/data/filerldb2` e `/data/m9333` |
| Acesso do host | GET `localhost:3200/api/health` e `localhost:58025/readyz` | HTTP 200 |
| Auditoria runtime | `pnpm audit --prod` | Zero vulnerabilidades conhecidas |
| Auditoria completa | `pnpm audit` | Um advisory moderado de tooling; exceção fundamentada abaixo |

## Falhas, correções e TDD

- Primeira instalação em bind mount Windows foi interrompida por lentidão de I/O. Dependências e store passaram para volumes Linux; a instalação terminou em 2m22s. O Node do host não atende à versão mínima; toda validação foi executada em containers.
- RED inicial: módulo de healthcheck ausente. Após criar sua assinatura mínima, os dois testes falharam com `expected 404 to be 200`. GREEN: implementação de GET `/healthz`, identificação do processo, `no-store`, 404 e 405; os dois testes passaram.
- O lint identificou export default anônimo no PostCSS; corrigido sem desativar a regra.
- SeaweedFS recusou o arquivo S3 por permissão. O setup agora atribui UID/GID 1000 ao arquivo de modo 0600, conforme o usuário da imagem fixada. Serviço saudável e acesso anônimo negado após correção.
- Mailpit saudável internamente, mas porta publicada inacessível por estar somente em rede internal. O override local agora conecta também à rede entry; a porta continua restrita a 127.0.0.1.
- Primeiro E2E: seis passaram e dois falharam porque os recursos dev do Next estavam bloqueados ao usar o hostname `proxy`, impedindo hidratação do seletor. Configurado `allowedDevOrigins: ['proxy']`, sem wildcard. Os oito cenários passaram após rebuild; não houve aumento de timeout nem relaxamento das asserções.
- Configurações declarativas e composição visual foram verificadas por ferramentas/build e E2E, sem testes unitários que apenas reproduzem os arquivos.

Artefatos locais ignorados pelo Git: `.local/e2e-first-failure` (traces), `.local/e2e-development-report`, `.local/preview-light.png` e `.local/preview-mobile-dark.png`. O relatório do E2E standalone fica em `playwright-report`.

## Risco residual de tooling e revisão

`pnpm audit` detectou [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) em `minimatch@10.2.6`, trazido apenas por `@typescript-eslint/typescript-estree@8.72.2`. A versão mais recente desse consumidor ainda declara `^10.2.2`; a correção exige minimatch >=11.0.1. Não foi forçada uma major incompatível.

A revisão independente confirmou na cópia instalada: o único consumidor usa `{ dot: true }`, sem `optimizationLevel`; minimatch usa nível 1 por padrão e o caminho vulnerável exige >=2. O projeto também não habilita `projectService`. Classificação estática: não acionável na configuração atual, confiança alta. Isto NÃO significa pacote corrigido. A auditoria completa continua com exit 1; a de runtime passou. Exceção explícita, não bloqueante para esta fundação exclusivamente local; reavaliar ao alterar ferramentas, padrões glob ou lockfile.

ESLint 9.39.5 também informa fim de suporte. Mantida a baseline aprovada; atualização compatível do conjunto de lint é dívida técnica recomendada para etapa posterior, sem issue criada automaticamente.

Revisor independente examinou código/configuração sem alterações, conferiu diretamente os nove serviços saudáveis e o registro Playwright aprovado, e concluiu `READY_FOR_HUMAN_REVIEW`, com a ressalva de tooling acima. Não encontrou bloqueios adicionais. Observação baixa: falha parcial no setup exige recuperação manual; documentada em operations. Não há issue Linear associada ou publicação externa desta revisão.

## Limites e conferência

Autenticação, autorização, modelo definitivo, migrations, jobs, bucket/anexos e envio de e-mail não foram antecipados. Worker/dispatcher são processos-base; liveness não declara esses fluxos prontos. Chromium com celular emulado não equivale a Safari/Firefox. Backup/restauração e testes de carga pertencem às etapas posteriores.

Conferência manual e comandos de reprodução estão em [operations](operations.md). Capturas desktop claro e celular escuro foram inspecionadas: navegação, hierarquia, legibilidade e ausência de corte horizontal da página.

Modern Web Guidance aplicado: `dark-mode` — CSS em `:root` e fallback sem JavaScript ("Apply color-scheme to :root or html for viewport-wide theming"); `dark-mode-toggle` — escolha de três estados em Preferências, persistência e retorno ao sistema ("the UI MUST support reverting or setting the color scheme to system"). next-themes fornece o script inicial e sincronização da escolha; não há dependência exclusiva de classe JS para seguir o sistema.
