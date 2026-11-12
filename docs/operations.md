# Operação local

Todos os comandos partem da raiz do projeto. Não usar estes arquivos para produção.

## Primeiro início

```powershell
docker build -f docker/toolchain.Dockerfile -t cifradesk-toolchain:local .
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" cifradesk-toolchain:local node scripts/setup-local.mjs
docker compose --profile tools up -d tools
docker compose exec tools pnpm install --frozen-lockfile
docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait
```

O setup gera credenciais locais aleatórias em `.env` e `.local/s3.json`, ambos ignorados pelo Git e pelo contexto Docker. Não sobrescreve arquivos existentes. Não imprimir `docker compose config` sem `--quiet`, pois a expansão contém segredos. Não compartilhar `.env`, `.local` ou inspeções completas dos containers.

Se o setup falhar entre as duas gravações, ele preserva os arquivos parciais e recusa uma nova execução. Guarde esses arquivos sem expor seu conteúdo e conclua a recuperação manual antes de subir os serviços; não misture chaves de execuções diferentes. No caminho normal, a configuração S3 recebe UID/GID 1000, correspondente ao usuário da imagem fixada.

A instalação ocorre no container Linux, com dependências e store pnpm em volumes próprios. Isso evita o custo de milhares de arquivos no compartilhamento Windows/Docker. Não executar os binários dessas dependências com Node Windows. A versão pnpm está fixada e não altera a instalação do host. A imagem de ferramentas já inclui Chromium e suas bibliotecas.

Endereços padrão:

- Aplicação: http://localhost:3200
- Mailpit: http://localhost:58025

Banco, Redis e S3 não publicam portas no host. Outros projetos Docker não são alterados.

## Validação

```powershell
docker compose -f compose.yaml -f compose.dev.yaml config --quiet
docker compose exec tools pnpm db:generate
docker compose exec tools pnpm check
docker compose exec tools pnpm build
docker compose exec tools pnpm audit
docker compose exec tools pnpm exec playwright install --with-deps chromium
docker compose exec tools pnpm test:e2e
docker compose -f compose.yaml -f compose.dev.yaml ps
```

Playwright usa Chromium correspondente à versão fixada e emula desktop/celular. Não equivale a validar Safari ou Firefox. Os testes acessam o proxy do projeto local, que encaminha ao serviço `web`. Banco de negócio ainda não existe; não há testes em dados de produção.

Para testar a imagem standalone sem publicar em produção:

```powershell
docker compose build web
docker compose up -d --no-build --wait web
docker compose exec tools pnpm test:e2e
```

Com o ambiente local já iniciado, o primeiro comando usa o target runtime do arquivo base. O segundo substitui somente web pela imagem standalone, sem mounts de código ou override de NODE_ENV; proxy e portas locais existentes permanecem. Para voltar ao desenvolvimento, use `up -d --build --wait` com ambos os arquivos.

## Desenvolvimento e encerramento

O override monta `apps/web/src` para atualização da interface. Mudanças em manifests, configurações, pacotes ou worker exigem rebuild. Não executar migrations até a autorização da etapa correspondente.

```powershell
docker compose -f compose.yaml -f compose.dev.yaml stop
docker compose --profile tools stop tools
```

Parar preserva volumes. Não usar `down -v`, limpeza global ou remoção de volumes sem autorização. Volumes não são backup.

## Validação manual

1. Abrir a aplicação e percorrer Meu trabalho, Minhas solicitações, Setores, Notificações e Preferências.
2. Escolher claro, escuro e automático; recarregar e conferir persistência. Em automático, mudar o tema do sistema.
3. Navegar com Tab e usar Pular para o conteúdo; verificar foco visível.
4. Em 390px, confirmar navegação acessível sem rolagem horizontal da página.
5. Conferir estados de preparação: nenhuma ação promete criar chamados nesta etapa.

## Limites

Identidade, permissões, migrations, S3 funcional, filas de negócio e notificações ainda não estão implementados. Healthchecks demonstram vida dos processos e dos serviços, não esses fluxos. Mailpit captura apenas e-mails locais; envio de e-mail será testado com a identidade.
