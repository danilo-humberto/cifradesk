# Operação local

Todos os comandos partem da raiz do projeto. Não usar estes arquivos para produção. Pré-requisitos: Docker Linux e Compose; Node/pnpm do host não são necessários.

## Primeiro início

```powershell
docker build -f docker/toolchain.Dockerfile -t cifradesk-toolchain:local .
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" cifradesk-toolchain:local node scripts/setup-local.mjs
docker compose --profile tools up -d tools postgres mailpit
docker compose exec tools pnpm install --frozen-lockfile
docker compose exec tools pnpm db:generate
docker compose exec postgres psql -U cifradesk -d cifradesk -c "SELECT current_database(), current_user;"
docker compose exec tools pnpm db:migrate
docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait
docker compose exec tools pnpm admin:bootstrap admin@example.test "Administrador local"
```

Migrations exigem autorização e conferência do ambiente. Não são executadas automaticamente pelo web. O comando de exemplo usa um destinatário sintético: o convite aparece somente no Mailpit. Defina a senha pelo link recebido; não há senha padrão.

O setup gera credenciais aleatórias em `.env` e `.local/s3.json`, ignorados por Git/build. Não sobrescreve arquivos existentes. Não imprimir `docker compose config` sem `--quiet`, pois a expansão contém segredos. Não compartilhar esses arquivos nem inspeções completas de containers.

Se o setup falhar entre gravações, preserva arquivos parciais e recusa repetição. Conclua recuperação manual sem misturar chaves de execuções diferentes. S3 recebe UID/GID 1000, correspondente ao usuário da imagem fixada.

Aplicação: http://localhost:3200. Mailpit: http://localhost:58025. Banco, Redis e S3 não publicam portas; portas públicas locais ficam em loopback.

## Atualizar uma fundação local existente

Preservar volumes e configuração. O comando abaixo acrescenta somente as variáveis de autenticação ausentes, sem exibir ou substituir valores:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" cifradesk-toolchain:local node scripts/add-local-auth-config.mjs
docker compose --profile tools up -d tools postgres mailpit
docker compose exec tools pnpm install --frozen-lockfile
docker compose exec tools pnpm db:generate
docker compose exec postgres psql -U cifradesk -d cifradesk -c "SELECT current_database(), current_user;"
docker compose exec tools pnpm db:migrate
docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait
```

BETTER_AUTH_URL deve ser a origem usada no navegador, incluindo a porta. SMTP é Mailpit:1025. Produção continua fora do escopo.

## Primeiro administrador e reenvio

`pnpm admin:bootstrap email nome` recusa criar outro administrador se já existir um. Se SMTP falhar, a criação é desfeita. Se o primeiro convite expirar antes da ativação:

```powershell
docker compose exec tools pnpm admin:bootstrap --resend admin@example.test "Administrador local"
```

Reenvio local aceita somente o único administrador ainda convidado e o mesmo e-mail. Após ativação, o administrador usa a tela ou a recuperação de senha. Conta comum convidada pode receber reenvio pela administração, inclusive após desativação; permanece sem acesso até definir senha.

## Verificações sem banco de testes

```powershell
docker compose -f compose.yaml -f compose.dev.yaml config --quiet
docker compose exec tools pnpm db:generate
docker compose exec tools pnpm check
docker compose exec tools pnpm build
docker compose exec tools pnpm audit --prod
docker compose exec tools pnpm audit
```

`pnpm check` executa lint, tipos e testes unitários; testes de integração são explicitamente pulados sem IDENTITY_TEST_DATABASE=1. Não chamar os testes de navegador contra o banco de desenvolvimento.

## Testes isolados de identidade

Containers, rede e volumes separados em `compose.test.yaml`; somente dados sintéticos. O comando de preparação não substitui configuração de testes existente. Não executar integração e E2E simultaneamente: os testes administrativos alteram papéis sintéticos.

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" cifradesk-toolchain:local node scripts/setup-identity-tests.mjs
docker compose -f compose.test.yaml config --quiet
docker compose -f compose.test.yaml up -d --build --wait
docker compose -f compose.test.yaml exec tests pnpm install --frozen-lockfile
docker compose -f compose.test.yaml exec tests pnpm db:generate
docker compose -f compose.test.yaml exec identity-postgres psql -U identity_test -d identity_test -c "SELECT current_database(), current_user;"
docker compose -f compose.test.yaml exec tests pnpm db:migrate
docker compose -f compose.test.yaml exec tests pnpm test:integration
docker compose -f compose.test.yaml exec tests pnpm test:e2e
```

O banco exigido é identity_test no serviço identity-postgres. Testes recusam outro destino. A aplicação de testes é a imagem standalone, compilada no filesystem Linux; isso evita misturar compilação dev sobre bind mount Windows com os tempos dos testes. O host não recebe portas desses serviços.

Playwright cobre Chromium desktop e celular emulado, não Safari/Firefox. Relatório em `playwright-report`; falhas preservam traces em `test-results`. Esses arquivos contêm dados e sessões sintéticas e permanecem ignorados pelo Git. Testes deixam dados sintéticos para diagnóstico; não os reutilizar como ambiente de trabalho.

## Desenvolvimento, diagnóstico e encerramento

Dependências ficam em volumes Linux, evitando milhares de arquivos no compartilhamento Windows. Não executar binários dessas dependências com Node Windows. Mudanças em manifests, pacotes ou worker exigem rebuild; o override de desenvolvimento monta somente o código web.

Falha de envio administrativo preserva conta e orienta Reenviar convite. Recuperação pública sempre apresenta resposta genérica; `identity.reset_delivery_failed` no log indica falha SMTP sem expor destinatário/token. Verifique saúde do Mailpit. Não há fila de reenvio automático.

```powershell
docker compose -f compose.yaml -f compose.dev.yaml stop
docker compose --profile tools stop tools
docker compose -f compose.test.yaml stop
```

Parar preserva volumes. Não usar `down -v`, limpeza global ou remoção de volumes sem autorização. Volumes não substituem backup.

## Conferência manual

1. Criar primeiro convite e definir senha pelo Mailpit. Conferir convite expirado e reenvio.
2. Entrar como administrador, convidar outra pessoa e criar setor; adicionar/remover integrante ativo.
3. Entrar como pessoa comum: administração não deve aparecer; acesso direto à API deve retornar 403.
4. Desativar uma conta com sessão aberta; próxima chamada protegida retorna 401. Reativar exige novo login.
5. Recuperar senha: link só funciona uma vez e sessões antigas deixam de funcionar.
6. Tentar remover o último administrador ativo: operação rejeitada.
7. Escolher claro/escuro/automático e conferir persistência da conta. Usar teclado e viewport de 390px.
8. Testar Sair e Encerrar todas as sessões. Confirmar que chamados/tarefas ainda aparecem como indisponíveis.

## Limites

SMTP de produção, TLS publicado, backup/restauração e carga continuam pendentes. Chamados, categorias, anexos funcionais e filas de negócio não foram antecipados. O lock transacional serializa mutações de identidade e login; medir contenção antes de ampliar a carga. A auditoria completa pode manter o advisory de tooling descrito nas evidências, sem equivaler a auditoria de runtime aprovada.
