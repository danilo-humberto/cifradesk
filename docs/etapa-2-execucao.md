# Etapa 2 — Identidade e setores: execução

Data: 12/11/2026. Branch `codex/etapa-2-identidade-setores`, checkout isolado `../cifradesk-identidade`, base inicial em `a27668e`, atualizada por fast-forward para `main`/`origin/main` em `b6f291b` antes dos commits. A atualização da base contém somente AGENTS.md. Sem issue Linear associada; merge e produção permanecem não autorizados.

O usuário autorizou uma branch e um único PR completo, autenticação/permissões, dependências, configuração e migrations apenas locais. Autorizou separadamente substituir Nodemailer 8.0.11 por 10.1.4 após auditoria. Depois da validação local, o usuário autorizou explicitamente os commits atômicos, push da branch e um único PR completo para main, após auditoria final. A alteração preexistente em AGENTS.md e a branch de manutenção do checkout original foram preservadas.

## Escopo implementado

- Schema, migration inicial, restrições de e-mail normalizado e vínculos únicos, contas/sessões Better Auth, convites, setores e limitação de tentativas.
- Cadastro administrativo, convites, senha inicial, reenvio, recuperação, revogação, tema por conta e proteção concorrente do último administrador.
- Administração de setores e integrantes; categorias ficam na etapa 3. Permissões de conteúdo de chamados/tarefas não foram antecipadas.
- Telas shadcn/ui de acesso e administração; rotas existentes preservadas pelo grupo protegido. AlertDialog incorporado do registro oficial com aliases locais.
- Documentação atualizada: README, arquitetura, operação, plano e identidade/APIs/permissões. Evidências históricas da etapa 1 foram preservadas.

A alteração ultrapassa cinco arquivos porque atravessa persistência, políticas, integração, APIs, telas e validação, com responsabilidades separadas em vez de concentrá-las artificialmente.

## Ambiente e segurança

Testes usam PostgreSQL e Mailpit exclusivos, sem portas de banco publicadas, em rede própria. Banco e usuário conferidos: identity_test/identity_test; papel de testes tem superuser/createdb da imagem local. É ambiente sintético de migrations/testes, não configuração de produção. Não foram acessados bancos reais de outros projetos.

Containers de preparação: cifradesk-identidade-tools, identity-postgres e identity-mailpit. Imagens de web separadas para standalone e desenvolvimento. O caminho reproduzível está em compose.test.yaml e operations.md. Configuração sintética e relatórios ficam ignorados em .local, test-results e playwright-report. Ao finalizar, os containers desta tarefa foram parados, preservando volumes e artefatos; serviços preexistentes não foram interrompidos.

## Evidências

- `pnpm db:generate`: schema válido, client Prisma 7.10.1 gerado.
- `pnpm --filter @cifradesk/database migrate`: migration inicial aplicada ao banco sintético; sem migration no ambiente de desenvolvimento preexistente.
- `pnpm check`: lint, tipos e sete testes unitários aprovados; a suíte de integração é pulada nesse comando sem a configuração explícita de testes.
- `pnpm test:integration`: 15 testes aprovados, incluindo corrida login/reset, consumo concorrente, revogação, isolamento, SMTP e recuperação do bootstrap.
- `pnpm audit --prod`: zero vulnerabilidades conhecidas após atualização autorizada do Nodemailer.
- `pnpm audit`: permanece um advisory moderado de minimatch exclusivamente no tooling, previamente documentado na etapa 1; não foi suprimido.
- `docker compose ... config --quiet`: configuração local e configuração de testes válidas. A execução ocorreu em containers isolados equivalentes, criados para esta tarefa; o fluxo completo de compose.test.yaml não foi executado de ponta a ponta.
- `git diff --check`: sem erros de whitespace. Checkout original continua somente com a alteração preexistente em AGENTS.md.
- Build do worker aprovado; contratos de identidade exportados por subpath separado, preservando o contrato de saúde usado no worker. Build standalone Docker: compilação, tipagem e geração das rotas concluídas; 34 E2E aprovados em 55 segundos (17 Chromium desktop e 17 celular emulado), sem retries. Relatório local ignorado: .local/identity-final-report. Imagem final: sha256:9fd413ed4922adf4310ae1cbc06fbcbb879feb23a783d159f98b999e27703efb.
- E2E em desenvolvimento: sete cenários de identidade e dez da fundação aprovados em Chromium, sem retries. Relatórios locais ignorados em .local/identity-dev-report e .local/identity-dev-foundation-report.

## TDD, falhas e correções

Testes de políticas e integração foram criados antes dos respectivos módulos: RED por módulo ausente, seguido de implementação e GREEN. A regressão de concorrência teve RED comportamental: enquanto reset segurava o lock, login não aguardava (`expected 0 to be greater than 0`). Após serializar login com reset, o teste verifica a espera e a rejeição da senha antiga com 401.

Falhas da preparação foram diferenciadas de defeitos: fixture de reativação inicialmente criava usuário sem credencial; fixture de login tratava Response de erro como sucesso; fixture E2E autenticava APIRequestContext sem transferir cookies ao contexto do navegador; seletor Enviar convite também correspondia a Reenviar convite. Corrigidas as fixtures, sem relaxar as asserções de segurança.

O primeiro E2E dev sofreu timeout durante compilação sobre bind mount Windows. Compilação e artefatos de navegador passaram para filesystem Linux; não foi aumentado timeout nem habilitado retry. Um cenário longo foi dividido em convite/login/desativação e recuperação/revogação, preservando todas as verificações.

Defeitos reais encontrados:
1. Login fora do lock poderia criar sessão após reset usando senha já verificada. Corrigido e coberto por intercalação determinística.
2. Falha SMTP ou expiração do primeiro convite deixava bootstrap sem recuperação. Corrigido com rollback e reenvio local restrito.
3. Convite desativado ficava sem reativação segura. Corrigido com retorno a INVITED e novo convite.
4. StrictMode dev repetia efeito e apagava token capturado. Corrigido preservando ref quando não existe novo fragmento.
5. Inicialização de tema reagia à mudança da função setTheme e restaurava o tema antigo. Corrigida para ocorrer uma vez por identidade.
6. Limite padrão sensível do Better Auth bloqueava logins distintos atrás do mesmo proxy. Alinhado a 120/minuto, mantendo limite próprio de dez/e-mail.

Testes visuais/formulários foram acrescentados como E2E; não houve testes unitários que apenas espelham JSX. A compatibilidade no modo dev foi verificada separadamente por causa do StrictMode. Formulários usam POST e aguardam hidratação antes de permitir envio; isso impede fallback GET com credenciais. Após atualizar arquivos/configuração do container dev em execução, foi necessário reiniciá-lo para eliminar divergência de hashes HMR. O build final também detectou conflito entre extensão .js para NodeNext e resolução TypeScript no Turbopack; corrigido com subpath de contratos de identidade, sem alterar o contrato de saúde do worker.

## Revisão e limites

Revisor independente examinou código e pacote Better Auth instalado, sem modificar arquivos ou acessar credenciais. Reavaliação confirmou os três primeiros achados corrigidos; apontou depois o caso StrictMode. Reavaliação final: READY_FOR_HUMAN_REVIEW, preliminar sobre o working tree. Revisor confirmou a correção do StrictMode e os relatórios reais: 17 E2E dev e 34 standalone, zero falhas, flaky ou skips; não encontrou novos bloqueios concretos. O próprio revisor não executou testes.

O lock global simplifica consistência, mas serializa login e mutações; carga não foi medida. SMTP externo, HTTPS publicado, MFA, backup/restauração e Safari/Firefox não foram validados. O browser consulta revogação em foco/30 segundos; o servidor bloqueia imediatamente.

## Auditoria e histórico da entrega

A revisão preliminar acima foi seguida por auditoria do histórico real `git diff main..HEAD` e do diff previsto `origin/main...HEAD`. A base remota foi conferida sem checkout na main. Não existem workflows GitHub Actions no repositório; a branch main foi reportada como não protegida. Não foi configurado deploy nem alterada infraestrutura externa.

Os testes acompanham as responsabilidades correspondentes: políticas/integração no commit de regras e E2E no commit da interface. Manifests e lockfile entram juntos no primeiro commit para preservar instalação congelada e resolver dependências dos seguintes. A auditoria do índice revelou linhas vazias excedentes em quatro arquivos novos; corrigidas em commit próprio, sem reescrever histórico.

- `9912f9f feat: estrutura dados e contratos de identidade`: schema, migration, client, contratos e dependências.
- `b40fcf2 feat: implementa regras de identidade e setores`: regras, SMTP, bootstrap, configuração local e testes de domínio/integração. **Crítico:** identity.ts e auth.ts em packages/infrastructure/src.
- `e0eee5a feat: integra acesso e administracao na interface`: APIs, controles de sessão, telas shadcn/ui e testes E2E. Autorização e testes devem ser revisados; composição visual repetitiva pode ser lida depois.
- `9b85a00 style: remove linhas excedentes nos arquivos de identidade`: somente whitespace, sem alteração funcional.
- A documentação e este registro compõem o commit documental de entrega; o roteiro completo com hashes reais consta na descrição do único PR.

A validação por commit usa `git archive` como contexto Docker, sem arquivos não commitados nem configuração local. Os três estados de código passaram em geração Prisma, build web, lint, tipos e build worker. O primeiro executou os dois testes unitários existentes; os seguintes executaram sete unitários. Integração ficou explicitamente pulada nessas imagens sem configuração de banco, preservando as 15 integrações aprovadas no ambiente sintético anteriormente. A correção de whitespace tem equivalência comprovada por git diff -w --ignore-blank-lines; o commit documental não muda código compilável. Relatórios E2E anteriores continuam válidos para o código funcional idêntico, sem mudança de comportamento durante a organização do histórico.

A auto-auditoria final não identificou novos bloqueios: listas paginadas, entradas validadas, rotas administrativas protegidas e credenciais fora do diff. Revisão independente do histórico confirma as correções anteriores; ressalvas permanecem no lock global e tooling. A descrição do PR registra o HEAD exato revisado e o roteiro dos commits. Nenhuma operação de produção ou merge foi executada.
