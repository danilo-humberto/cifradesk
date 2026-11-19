# CifraDesk

Sistema interno de chamados e tarefas. Implementados localmente: acesso por convite, administração de usuários/setores e chamados com conversas, notas internas e anexos privados. Tarefas e notificações continuam nas próximas etapas.

- [Plano e critérios de aceite](docs/plano-implementacao.md)
- [Arquitetura](docs/architecture.md)
- [Identidade, APIs e permissões](docs/identity.md)
- [Operação e validação local](docs/operations.md)
- [Evidências da etapa 1](docs/etapa-1-execucao.md)
- [Conversas: escopo e evidências da etapa 4](docs/etapa-4-planejamento.md)

Pré-requisitos: Docker com Linux containers e Docker Compose. Aplicação, compilação e testes usam Node/pnpm no container; os runners de integração/E2E chamados com `node scripts/...` também exigem Node no host para orquestrar Docker. Consulte o roteiro de operação antes de iniciar.
