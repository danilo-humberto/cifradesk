# Instruções do projeto CifraDesk

## 1. Utilizar os componentes do shadcn

- Utilizar os componentes do **shadcn/ui** na interface do projeto.
- Sidebar, select, botões, menus, diálogos, formulários, tabelas e demais elementos que tenham componente correspondente no shadcn/ui devem utilizar esse componente.
- Não criar versões próprias nem substituir esses componentes por elementos HTML nativos equivalentes quando houver uma opção correspondente no shadcn/ui.
- Personalizar aparência, composição e comportamento a partir dos componentes do shadcn/ui, mantendo acessibilidade e consistência visual.
- Manter os componentes incorporados em `apps/web/src/components/ui`, conforme a configuração de `apps/web/components.json`, e reutilizá-los nas telas.
- Ao criar ou modificar uma interface existente, adequar os componentes envolvidos a esta regra. Para necessidades sem componente correspondente na biblioteca, compor os elementos existentes antes de criar um componente próprio.

## 2. Branch obrigatória por implementação

- Toda implementação deve ser realizada em uma branch nova e exclusiva para a tarefa, criada antes de modificar arquivos. Esta regra também se aplica a alterações de documentação e configuração.
- Antes de criar a branch, verifique a branch atual, o estado do Git e a branch-base adequada ao fluxo do projeto. Preserve alterações preexistentes e não incorpore mudanças de outras tarefas.
- Utilize o prefixo `codex/` e um nome descritivo, incluindo o identificador da issue quando disponível.
- Não implemente diretamente na `main` nem reutilize uma branch de outra tarefa. A continuação da mesma implementação deve permanecer na branch criada para ela.

## 3. Relatório ao finalizar a implementação

- Analise o `git diff` completo gerado pela tarefa assumindo o papel de um Desenvolvedor Sênior rigoroso e pragmático. Seja direto, não elogie o código e fundamente os apontamentos no diff e nas evidências verificadas.
- Gere um comentário curto em Markdown, pronto para o Linear, contendo obrigatoriamente as três seções abaixo. Não publique o comentário sem autorização para escrever no Linear.

### O QUE E POR QUE

Em no máximo 3 linhas, explique a lógica principal e por que a arquitetura foi escolhida em vez de alternativas mais simples. Se a solução já for a mais simples adequada, diga isso sem inventar alternativas ou justificativas.

### ALERTA DO SÊNIOR

Aponte até 3 falhas potenciais, problemas de performance, brechas de segurança ou alterações desnecessárias, como bibliotecas novas ou arquivos modificados fora do escopo. Não invente problemas para preencher a seção; se nenhum for identificado, registre isso e informe limitações relevantes da análise.

### FOCO DE REVISÃO

Liste apenas os 1 ou 2 arquivos mais críticos que um humano precisa ler para validar a regra de negócio, ignorando arquivos triviais. Em tarefas sem regra de negócio, indique os arquivos centrais da alteração.

- Mantenha o comentário curto. Evidências de testes, verificações pendentes e outras informações obrigatórias de entrega devem ser apresentadas separadamente, sem afirmar que verificações não executadas foram aprovadas.

## 4. Confirmação e Pull Request para a main

- Ao concluir a implementação, apresente o relatório e aguarde a confirmação explícita do usuário antes de abrir o Pull Request para a `main`.
- Antes de solicitar confirmação, deixe as alterações e validações prontas para revisão e explique quais operações serão executadas: commit local, push da branch e abertura do PR. Execute somente as operações explicitamente autorizadas.
- O PR deve ter a `main` como destino e ser escrito em português simples, com título curto e descrição fácil de entender: qual problema foi resolvido, o que mudou e como foi verificado. Informe pendências relevantes e evite jargões, histórico da conversa e detalhes triviais.
- A autorização para abrir o PR não autoriza merge ou deploy. Após a abertura, confirme o resultado e forneça o link do PR.

## 5. Documentação atualizada a cada etapa

- Ao finalizar cada etapa da implementação, revise e atualize os documentos afetados antes de apresentar a entrega para aprovação. A documentação faz parte dos critérios de conclusão da etapa e deve acompanhar seu diff e PR, sem ser adiada para o fim da issue.
- Atualize somente os documentos necessários conforme o impacto da mudança: por exemplo, README, arquitetura e decisões técnicas aprovadas, modelos e contratos de dados, regras de negócio, APIs, instruções de configuração, testes e procedimentos operacionais.
- Documente o comportamento efetivamente implementado, os requisitos de uso e as limitações conhecidas. Não descreva funcionalidades planejadas ou verificações não executadas como concluídas.
- Prefira atualizar a documentação existente e sua fonte de referência, corrigindo trechos e exemplos que ficaram desatualizados. Evite documentos duplicados, informações contraditórias e arquivos criados apenas para cumprir esta regra.
- No relatório da etapa, indique quais documentos foram atualizados. Se não houver impacto documental, registre essa conclusão com uma justificativa curta.
- Quando uma atualização depender de uma decisão ainda não aprovada ou de acesso externo não autorizado, registre a pendência e seu impacto; não declare a documentação concluída enquanto houver atualização necessária pendente.

Estas instruções se aplicam a todo o projeto e complementam as demais instruções fornecidas pelo usuário.
