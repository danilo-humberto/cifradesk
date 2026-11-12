# Arquitetura — fundação local

O [plano](plano-implementacao.md) é a referência dos requisitos. Esta etapa prepara a estrutura, sem implementar identidade ou regras de negócio.

## Limites dos módulos

- `apps/web`: Next.js App Router, interface e API. Páginas são componentes de servidor; navegação ativa, tema e providers são componentes de cliente.
- `apps/worker`: processos `worker` e `dispatcher`, com a mesma imagem. Nesta etapa só expõem liveness; ainda não consomem jobs nem acessam banco.
- `packages/contracts`: contratos que podem ser importados pelo navegador, sem segredos ou dependência de infraestrutura.
- `packages/core`: reservado para casos de uso e regras, ainda sem implementação.
- `packages/database`: validação e geração Prisma; `FoundationProbe` é ignorado pelo client e não tem migration/tabela. Modelo definitivo pertence à etapa 2.
- `packages/infrastructure`: reservado para adaptadores de servidor. Nenhum driver adicionado antecipadamente.

O lint impede importação direta de database/infrastructure na interface. Quando houver acesso a dados, os módulos de servidor deverão usar a barreira `server-only` e testes de fronteira; a regra de lint não substitui essa barreira.

## Interface

Paleta: azul `#315dc7`, texto `#24334a`, fundo `#f5f7fb`, superfície branca, borda `#dce3ee`; escuro neutro `#18181b`, superfícies `#202023` e texto `#f4f4f5`. Tipografia Segoe UI com fallback local, sem download de fontes no build. Sidebar de 320 px, recolhível para faixa de ícones de 56 px com Tooltip no desktop; em celular, painel Sheet com fechamento por Escape, botão e seleção de destino. Sem JavaScript, a navegação permanece visível, acima do conteúdo no celular.

A composição prioriza a área de trabalho e estados explicitamente indisponíveis. Não há métricas, usuários ou chamados fictícios apresentados como reais.

Tema usa next-themes com padrão do sistema e escolha em Preferências. O CSS também acompanha o sistema sem JavaScript. A escolha é local ao navegador; persistência por conta pertence à implementação de identidade. React Query tem instância por árvore, sem cache global compartilhado entre requisições. Hidratação de consultas e invalidação por identidade serão implementadas quando houver dados autenticados.

shadcn/ui foi configurado manualmente (`components.json`). Button, Sidebar, Select, Sheet, Tooltip, Separator, Input, Skeleton, Label, Badge, Card, Avatar e Breadcrumb foram incorporados do [registro oficial new-york-v4](https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json), variante Radix, em 12/11/2026. Código está em `apps/web/src/components/ui`, sem CLI ou download remoto em execução e sem novas dependências nesta adaptação. A composição usa Sidebar/Menu, Select/Label, Card, Badge e Avatar; os demais componentes são dependências do Sidebar. Licença MIT: [shadcn/ui](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

Adaptações locais: aliases de importação, textos acessíveis em português, botão de fechamento visível no Sheet, restauração de foco ao acionador, `aria-expanded`; a variante offcanvas usa `inert` quando oculta, enquanto a faixa de ícones permanece interativa. O hook de breakpoint usa `useSyncExternalStore`; Skeleton tem largura determinística para preservar pureza de renderização. Tokens Card/Popover/Sidebar acompanham a paleta existente. O select mantém a persistência do next-themes e a opção automática. Os testes E2E cobrem teclado, Escape, foco, navegação móvel e fallback sem JavaScript.

## Execução e isolamento

Compose é exclusivamente local. Rede `entry` conecta proxy/web e a interface local Mailpit no override de desenvolvimento; rede `internal`, com saída externa bloqueada, conecta serviços de dados. Somente proxy e interface Mailpit publicam portas, em loopback, pelo override de desenvolvimento. Os processos não recebem segredos de integrações que ainda não usam.

Cache e filas usam Redis separados: cache descartável com `allkeys-lru`; filas com `noeviction`, AOF e volume. SeaweedFS reúne master/volume/filer/S3 no ambiente local, com volume próprio e configuração S3 autenticada. A criação do bucket e validação funcional de anexos pertencem à etapa 4.

Não há migrations automáticas, acesso a produção ou envio SMTP externo. O healthcheck web/worker é liveness, não teste de prontidão de fluxos de negócio.

Referências: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [shadcn/ui](https://ui.shadcn.com/docs/installation/manual), [next-themes](https://github.com/pacocoursey/next-themes), [SeaweedFS S3](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API).

### Base visual e troca de tema

Cabeçalho de 56 px com Breadcrumb contextual e indicação única de prévia. Conteúdo alinhado à esquerda com 32 px no desktop e 16 px no celular; preferências limitadas a 880 px. Notificações e Preferências ficam no rodapé da sidebar. Elementos interativos continuam usando shadcn/ui.

A troca manual usa View Transitions e Web Animations para revelar o novo tema com clip-path circular, partindo do centro do SelectTrigger até o canto mais distante da viewport, em 550 ms. A lista fecha e o foco retorna ao acionador antes da captura. O estado next-themes é sincronizado com flushSync; a preferência continua persistida. Escolhas feitas durante a animação são consolidadas na última escolha e processadas ao concluir. Sem API, com movimento reduzido ou sem mudança efetiva de cores, a preferência muda imediatamente. Mudanças automáticas do sistema não iniciam animação.
Logo oficial fornecida pelo usuário em PNG transparente, preservada sem recorte em apps/web/src/assets/logo-cifra.png. Favicon servido pela convenção Next app/icon.png. A marca permanece visível na faixa de ícones, sem o texto Equipe Cifra. No celular, painel de até 320 px, limitado pela viewport.
