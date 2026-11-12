# Identidade e setores

Etapa 2, exclusivamente local. Categorias, chamados e permissões sobre conteúdo desses itens continuam nas etapas seguintes.

## Contas e acesso

Contas começam como `INVITED`, sem senha. Somente administrador ativo cadastra pessoas; cadastro público não existe. E-mail é normalizado (trim/lowercase), único e imutável nesta etapa. O banco também rejeita e-mails fora dessa normalização. Nome pode ser editado; não há exclusão de contas.

Convites têm 48 horas, token aleatório armazenado como SHA-256, uso único e revogação no reenvio. Os links usam fragmento `#token=`, retirado da barra pelo formulário, para não enviar o token no URL HTTP. Ativação consome o convite e grava a senha pela API do Better Auth na mesma transação PostgreSQL. Não há gravação manual de hash de senha.

Desativação revoga sessões, convites e verificações de recuperação. Conta já ativada pode ser reativada, sem restaurar sessões antigas. Uma conta desativada antes de definir senha recebe novo convite por Reenviar convite e retorna a INVITED; nunca é ativada sem definição de senha.

Primeiro administrador: comando local `pnpm admin:bootstrap email nome`. A falha SMTP desfaz a criação, permitindo repetir o comando. Se o primeiro convite expirar, `pnpm admin:bootstrap --resend email nome` reenvia somente para o único administrador ainda INVITED e com o mesmo e-mail. Após ativação, usar administração normal ou recuperação de senha. Nunca há senha padrão.

## Sessões e recuperação

Better Auth 1.7.22, adapter Prisma e sessões em PostgreSQL. Sessões duram sete dias absolutos, sem renovação por atividade e sem cookie cache. Cada sessão captura `authVersion`; desativação, redefinição de senha e encerramento de todas as sessões incrementam a versão, além da revogação física.

Login, aceite, reset e mutações de identidade usam o mesmo advisory lock transacional PostgreSQL (724013). Isso protege a criação de sessões contra reset concorrente e a contagem do último administrador. O lock funciona entre processos; serializa esse conjunto de operações e deve ser reavaliado se a carga aumentar. Não cobre chamadas arbitrárias de código externo: a aplicação expõe somente o caminho protegido de login.

Recuperação tem link de uma hora, de uso único; reset revoga as demais verificações da conta. Resposta pública não informa existência/estado do e-mail. Falhas SMTP na recuperação geram evento fixo `identity.reset_delivery_failed`, sem destinatário ou token. Cadastro administrativo preserva a conta se SMTP falhar e orienta o reenvio. Primeiro bootstrap tem rollback, pois ainda não existe administrador para reenviar pela tela.

Senha: 8–128 caracteres, sem bloquear colagem. Não há MFA nesta entrega. SMTP fica restrito ao Mailpit local; remetente e entrega de produção permanecem pendentes.

## Matriz de permissões

| Operação | Anônimo/convidado/desativado | Ativo comum | Administrador ativo |
| --- | --- | --- | --- |
| Entrar com credencial válida | Somente ativo pode criar sessão | Sim | Sim |
| Aceitar convite válido | Sim, apenas para conta INVITED | Não | Não |
| Preferência de tema / sair / encerrar sessões | Não | Própria conta | Própria conta |
| Gerenciar usuários, setores e vínculos | Não | Não | Sim |
| Remover/desativar último admin ativo | Não | Não | Não |
| Acesso ao setor por vínculo | Não | Somente setor ativo vinculado | Mesma regra; admin não concede leitura global |

Setores têm nome e estado ativo. Desativar setor preserva vínculos, mas retira sua autorização. Adicionar integrante exige conta e setor ativos; par usuário/setor é único. Remover vínculo retira acesso imediatamente no servidor. Elegibilidade de responsáveis exige usuário ativo; atribuição de chamados/tarefas não é implementada aqui.

## Interfaces

| Rota | Operação |
| --- | --- |
| POST /api/auth/sign-in/email | Login com e-mail e senha |
| POST /api/auth/sign-out | Encerrar sessão atual |
| POST /api/auth/accept-invitation | Token e senha inicial |
| POST /api/auth/request-password-reset | Solicitar recuperação por e-mail |
| POST /api/auth/reset-password | Token e nova senha |
| GET/PATCH /api/me | Dados mínimos da conta / salvar tema |
| DELETE /api/me | Encerrar todas as sessões |
| GET/POST /api/admin/users | Listar / convidar |
| PATCH /api/admin/users/:id | Nome, estado ou administração |
| POST /api/admin/users/:id/resend | Reenviar convite |
| GET/POST /api/admin/departments | Listar / criar setores |
| PATCH /api/admin/departments/:id | Nome e estado do setor |
| GET/POST /api/admin/departments/:id/members | Listar / adicionar integrante |
| DELETE /api/admin/departments/:id/members/:userId | Remover vínculo |

Listas retornam `items, total, page`, 20 registros por página com ordenação estável. Mutações exigem JSON e Origin igual a BETTER_AUTH_URL; corpo limitado a 16 KiB por leitura efetiva. Não aceitar cabeçalhos de origem como substitutos de autenticação.

Respostas privadas usam no-store. Erros de validação são 400, sessão inválida 401, acesso negado 403, conflito 409, excesso de tentativas 429 e falha de envio administrativo 503. O servidor nunca devolve erros Prisma, credenciais ou tokens de convite ao administrador.

Limites persistidos no banco: 120 requisições públicas de autenticação/minuto no conjunto, 10 logins/e-mail, 5 pedidos de recuperação/e-mail, 10 tentativas/token e 60 mutações administrativas/usuário. Chaves são hashes; registros antigos são removidos. O limitador do Better Auth também permanece ativo. Os limites não dependem de IP fornecido pelo cliente.

## Interface e fronteiras

Rotas de acesso ficam fora do layout protegido; URLs existentes da área de trabalho foram preservadas pelo grupo `(workspace)`. A administração é protegida no servidor e nas APIs. O navegador verifica sessão ao retomar foco e a cada 30 segundos; a revogação no servidor é imediata.

React Query tem instância por identidade; logout limpa cache e renova a navegação. Tema é salvo por conta, mantendo seleção local e animação existentes. Sem JavaScript, a navegação autenticada continua visível, mas formulários de identidade precisam de JavaScript e informam essa limitação.

Componentes usam shadcn/ui; AlertDialog foi incorporado do registro new-york-v4 e teve somente aliases adaptados. Modern Web Guidance: labels visíveis, autocomplete correto, colagem de senha permitida, feedback anunciado e foco no resultado. Código de banco fica atrás de `server-only` na entrada Next.js.
