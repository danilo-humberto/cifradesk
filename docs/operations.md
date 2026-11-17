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

`pnpm check` executa lint, tipos e testes unitários; integrações de identidade são puladas sem IDENTITY_TEST_DATABASE=1, abertura de chamados sem TICKETS_TEST_DATABASE=1 e consultas sem TICKET_QUERIES_TEST_DATABASE=1. Use os runners sintéticos correspondentes; não habilite essas flags contra o banco de trabalho. Não chamar os testes de navegador contra o banco de desenvolvimento.

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

### Recargas contínuas no desenvolvimento

O script `dev` do web usa `next dev --webpack`, opção oficial da [CLI do Next.js](https://nextjs.org/docs/app/api-reference/cli/next#next-dev-options). O build de produção continua com `next build`; nenhuma versão de dependência foi alterada por esta correção. `WATCHPACK_POLLING=true` no override local permite ao Webpack detectar edições no bind mount Windows.

Em 16/11/2026, o estado acumulado do Turbopack 16.4.6 enviava `restart` para um chunk de entrada e `reloadPage` com `HMR hash mismatch` a cada reconexão. O ciclo foi reproduzido em `/login`, sem autenticação, pelo proxy e diretamente no web usando uma origem permitida. Não houve eventos de alteração em `src` durante a observação. Um container Turbopack limpo não reproduziu o ciclo; portanto, a evidência aponta para inconsistência do estado/cache de HMR, sem identificar o gatilho interno que a criou. Reiniciar o mesmo container não corrigiu o problema. Webpack é a medida de compatibilidade adotada para não reutilizar esse caminho no desenvolvimento; pode ter compilação inicial mais lenta.

Para aplicar a alteração também à imagem existente, recriar somente o web, preservando serviços de dados e volumes:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d --no-deps --build --wait web
```

O smoke abaixo é uma exceção segura à restrição de E2E no banco de trabalho: usa contexto novo, abre somente `/login`, preenche um e-mail sintético sem enviar o formulário e não utiliza fixtures de identidade nem grava dados. Exige HMR conectado, uma única navegação e preservação do campo por 15 segundos. A flag impede sua execução em testes contra o build de produção.

```powershell
docker compose exec -e E2E_DEV_SERVER=1 tools pnpm exec playwright test tests/e2e/dev-hmr.spec.ts --workers=1
```

Evidência RED: o teste encontrou 132 mensagens `HMR hash mismatch` em 15 segundos, com trace em `.local/hmr-red`. GREEN: dois cenários Chromium (desktop/celular) passaram em 35 s, com HMR conectado, uma requisição de documento e campo preservado, conforme `.local/hmr-green-final`. O contador diferencia recarga de documento da atualização de histórico feita na hidratação do Next.js. Uma edição temporária de CSS foi aplicada via Fast Refresh com uma única requisição de documento e sem perder o campo; o conteúdo original foi restaurado. Após reiniciar o mesmo serviço e reutilizar seu cache, os dois cenários passaram novamente (46 s), conforme `.local/hmr-after-restart`. `docker exec cifradesk-local-web-1 pnpm check` aprovou lint, tipos e 75 unitários; 47 integrações foram ignoradas. A rota `/requests` compilou e retornou o redirecionamento 307 esperado para requisição sem sessão. A imagem de desenvolvimento foi reconstruída e o serviço local está executando Webpack. Build de produção, suíte E2E completa e navegadores além de Chromium não foram repetidos nesta correção de tooling.

Minuta de entrega, não publicada:

- **O QUE E POR QUE:** o comando de desenvolvimento seleciona explicitamente o Webpack já fornecido pelo Next.js, evitando o ciclo de HMR observado sem alterar o build de produção.
- **ALERTA DO SÊNIOR:** a causa interna da inconsistência do Turbopack não foi determinada; trata-se de uma medida de compatibilidade, com possível aumento do tempo de compilação inicial. Smokes em repouso, edição real e reinício passaram; a compilação de produção não foi repetida porque seu comando e código não mudaram neste incremento.
- **FOCO DE REVISÃO:** `apps/web/package.json` define o bundler de desenvolvimento; `tests/e2e/dev-hmr.spec.ts` detecta recargas involuntárias sem mascará-las com HMR desativado.

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
8. Testar Sair e Encerrar todas as sessões. Confirmar redirecionamento ao login e ausência de conteúdo autenticado após sair.

## Limites

SMTP de produção, TLS publicado, backup/restauração e carga continuam pendentes. A 3.4 implementa abertura via API e anexos privados localmente; a 3.5 acrescenta consultas autorizadas. A 3.6 acrescenta operações transacionais localmente; a [interface da 3.7](tarefa-3.7-interface.md) está implementada localmente, validada e revisada localmente, com commits locais autorizados. Categorias foram removidas do escopo. Filas de negócio não foram antecipadas. O lock transacional serializa mutações de identidade, login, reservas/criação e operações de chamados; medir contenção antes de ampliar a carga. A auditoria completa pode manter o advisory de tooling descrito nas evidências, sem equivaler a auditoria de runtime aprovada.

## Anexos privados — tarefa 3.4

Compose fornece ao web/tools `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY`. Não os imprimir. O bucket é criado explicitamente, depois de confirmar ambiente local e autorização:

```powershell
docker compose exec tools pnpm exec tsx scripts/storage-local.ts init
```

O comando exige SeaweedFS interno e bucket `cifradesk-local`, preserva bucket existente e confirma que acesso anônimo é negado. Nenhuma URL pública é entregue ao cliente. Rebuild do web é necessário para disponibilizar os endpoints novos; não foi aplicado nesta tarefa.

Uploads falhos preservam chamados. Reservas e exclusões pendentes contam para o limite de 200 MiB até recuperação. Após 30 minutos, a limpeza repete DELETE, liberando capacidade somente quando confirmado. Cada execução processa até 100 registros; não está agendada:

```powershell
docker compose exec tools pnpm exec tsx scripts/storage-local.ts cleanup
```

Esse comando remove somente objetos de uploads incompletos/exclusões pendentes, não anexos disponíveis. Verificar ambiente e autorização antes de executar em dados de trabalho. A tarefa executou recuperação apenas em dados sintéticos.

Para reproduzir a integração da 3.4, usar `node scripts/test-ticket-opening.mjs` no host com Docker e o container de ferramentas `cifradesk-etapa34-tools` iniciado a partir de `cifradesk-toolchain:local`, montando o workspace e os volumes `cifradesk-identidade-*`, conectado à rede `cifradesk-local_internal`. O runner cria banco/papel próprios e bucket sintético, aplica as migrations somente nesse banco e executa a suíte de chamados. Consome a configuração S3 local autorizada em memória, sem logs de segredos; preserva os recursos de teste para diagnóstico. `pnpm test:integration` continua selecionando somente identidade. [Evidências, contratos HTTP e limitações](tarefa-3.4-abertura.md).

## Consultas de chamados — tarefa 3.5

`node scripts/test-ticket-queries.mjs` usa o mesmo container de ferramentas e PostgreSQL local. Cria banco/papel exclusivos `tickets35_test_*`, aplica migrations somente nesse banco e executa 12 integrações, incluindo EXPLAIN de SQL representativo e volume sintético de 2.000 chamados com remoção de 250 atribuições. Não acessa S3 nem lê credenciais da aplicação; gera senha sintética em memória. Preserva o banco de teste para diagnóstico. [Rotas GET, paginação, acesso e validação manual](tarefa-3.5-consultas.md). Nenhum deploy é necessário para os testes; a aplicação já em execução não é atualizada por esse runner.

## Operações de chamados — tarefa 3.6

`node scripts/test-ticket-operations.mjs` cria banco/papel sintéticos `tickets36_test_*` no PostgreSQL local existente, aplica somente as migrations já existentes nesse banco e executa oito integrações. Usa `cifradesk-etapa34-tools`, sem credenciais da aplicação ou S3, e preserva a base para diagnóstico. Não atualiza a aplicação em execução. [API, eventos, controle de versão, testes e limites](tarefa-3.6-operacoes.md). Remoções administrativas podem atingir o timeout transacional de 15 segundos em volume: nesse caso ocorre rollback integral; medir carga antes de ampliar uso.

## Persistência de conversas — tarefa 4.1

Executar `node scripts/test-message-persistence.mjs` no host com Docker e os containers locais `cifradesk-local-postgres-1` e `cifradesk-etapa34-tools` disponíveis. O container de ferramentas deve conter o código atual e o cliente gerado por `pnpm db:generate`; se o workspace tiver sido copiado em vez de montado, sincronizar os arquivos antes. O Node do host apenas orquestra Docker; compilação e integrações usam Node 24.22.3 do container.

O runner cria bancos e papéis próprios `messages41_test_*`, sem superusuário, criação de bancos ou criação de papéis para a conexão de testes. A conexão administrativa local é usada somente para preparar esses recursos; migrations e verificações executam sob o papel sintético. Não lê `.env`, credenciais de aplicação nem S3. Os bancos ficam preservados para diagnóstico, sem remoção automática. Nenhuma migration é aplicada ao banco da aplicação.

São executados dois cenários: base vazia e atualização com registros sintéticos inseridos antes da migration de mensagens. O runner verifica preservação dos anexos, constraints, snapshots imutáveis, exclusão lógica, índices e equivalência entre schema Prisma e banco migrado. Em cada cenário, seleciona explicitamente as três integrações Prisma, incluindo download legado com armazenamento em memória e rollback. `--upgrade-only` executa somente a atualização. `pnpm check` e `pnpm test:integration` sozinhos não executam esses cenários. [Resultados e limites da 4.1](etapa-4-planejamento.md#execução-da-41--17112026).

Criar novas bases pelas migrations, não por `db push`: checks e trigger de imutabilidade não são representados integralmente no Prisma. A 4.1 não habilita publicação de mensagens; proteção dos caminhos antigos de anexos e regras de edição/exclusão continuam nas próximas tarefas.

## Conversas com isolamento — tarefa 4.2

Executar `node scripts/test-ticket-messages.mjs` no host. Requer PostgreSQL local e `cifradesk-etapa34-tools` com código atualizado e cliente Prisma da 4.1 gerado. O container de ferramentas não monta o workspace nesta execução: sincronizar os arquivos alterados antes dos testes. O runner cria uma base `messages42_test_*` e papel proprietário restrito, aplica as migrations existentes sob esse papel e seleciona explicitamente as nove integrações de conversas. A suíte verifica destino `postgres`, prefixo do banco, usuário correspondente e ausência de privilégios de superusuário/criação de bancos/papéis antes dos dados sintéticos. Credencial aleatória passa por stdin; não lê `.env`. Bancos sintéticos são preservados para diagnóstico; não há migration no banco da aplicação.

Validar também `docker exec cifradesk-etapa34-tools pnpm check` e `docker exec cifradesk-etapa34-tools pnpm build`. O check inclui os seis testes HTTP, mas pula integrações sem a variável habilitadora: o runner específico é obrigatório. Regressões relacionadas: `node scripts/test-ticket-queries.mjs` e `node scripts/test-ticket-operations.mjs`. Executar sequencialmente no container compartilhado. O Node do host somente orquestra Docker; testes e compilação usam o runtime do container.

Conferência manual em ambiente sintético preparado: autenticar solicitante e integrante; enviar multipart com `markdown` e `visibility` à rota `/api/tickets/{id}/messages`; comparar GET e histórico com ambas as contas. Nota interna não pode aparecer nem na contagem do solicitante. Transferir o chamado e confirmar acesso apenas pelo novo setor; desativar setor após fechar seus chamados e conferir leitura sem envio. Terceiro e administrador sem vínculo recebem 404. Essa conferência manual não foi executada nesta tarefa; os cenários correspondentes foram cobertos pelos testes. Ainda não há interface de conversa. [Contrato e limites](architecture.md#conversas-com-isolamento--tarefa-42), [evidências](etapa-4-planejamento.md#execução-da-42--17112026).

## Regressão completa — tarefa 3.8

O runner da etapa 3 abaixo não inclui conversas. Para a persistência da 4.1, usar também o procedimento acima.

Pré-requisitos: Docker iniciado; `cifradesk-etapa34-tools`, PostgreSQL e SeaweedFS locais da 3.4 disponíveis; configuração S3 local autorizada preservada. Identidade exige os serviços exclusivos `identity-postgres`/`identity-mailpit` do `compose.test.yaml`, arquivo sintético `.local/identity-test.env` e migrations aplicadas **somente em `identity_test`**. O runner agregado não prepara identidade sozinho. Gere a configuração ausente com `docker exec cifradesk-etapa34-tools node scripts/setup-identity-tests.mjs`; o script preserva arquivo existente. Confira nome do projeto Compose efetivo: `.env` pode definir `COMPOSE_PROJECT_NAME`, sobrepondo o nome do YAML. Não remova serviços órfãos nem volumes.

O container de ferramentas precisa alcançar os serviços de identidade pela rede de testes, além da rede local dos runners de chamados. Nesta execução, os serviços de identidade ficaram em `cifradesk-local_default`; ferramentas foram conectadas a essa rede. Não copie credenciais nem configure URLs de produção. Antes de migrar identidade, confirme destino `identity-postgres`/`identity_test` e use `docker exec cifradesk-etapa34-tools node --env-file=.local/identity-test.env scripts/run-local.mjs pnpm db:migrate`.

Depois do preparo autorizado, execute sequencialmente, da raiz:

```powershell
docker exec cifradesk-etapa34-tools pnpm db:generate
docker exec cifradesk-etapa34-tools pnpm check
node scripts/test-stage-three.mjs
docker exec cifradesk-etapa34-tools pnpm build
node scripts/test-ticket-interface.mjs --all
```

`node` no host apenas orquestra Docker; use um binário instalado por caminho explícito caso o gerenciador do host recuse a versão. Testes/compilação usam Node do container. `pnpm test:integration` isoladamente continua sendo apenas identidade; `test-stage-three.mjs` acrescenta explicitamente persistência SQL e todas as integrações de chamados, cada qual no seu banco sintético. Não executar testes pesados ou build simultaneamente nesse container.

O E2E `--all` inclui fundação visual, identidade e chamados, em Chromium desktop/celular, sem retries. Inicia o standalone recém-compilado em `127.0.0.1:3317` dentro do container, banco exclusivo `tickets37_test_*`, segredo de sessão aleatório e SMTP `identity-mailpit:1025`. Não publica porta e encerra o servidor ao finalizar. Sem `--all`, seleciona somente chamados. Logs/traces/relatórios ficam em `.local`, ignorados pelo Git; contêm somente dados/sessões sintéticas. O upload de recuperação no navegador é simulado; o runner de abertura testa S3 real separadamente. [Resultados e limites da 3.8](etapa-3-execucao.md).
