# Instruções do projeto CifraDesk

## 1. Utilizar os componentes do shadcn

- Utilizar os componentes do **shadcn/ui** na interface do projeto.
- Sidebar, select, botões, menus, diálogos, formulários, tabelas e demais elementos que tenham componente correspondente no shadcn/ui devem utilizar esse componente.
- Não criar versões próprias nem substituir esses componentes por elementos HTML nativos equivalentes quando houver uma opção correspondente no shadcn/ui.
- Personalizar aparência, composição e comportamento a partir dos componentes do shadcn/ui, mantendo acessibilidade e consistência visual.
- Manter os componentes incorporados em `apps/web/src/components/ui`, conforme a configuração de `apps/web/components.json`, e reutilizá-los nas telas.
- Ao criar ou modificar uma interface existente, adequar os componentes envolvidos a esta regra. Para necessidades sem componente correspondente na biblioteca, compor os elementos existentes antes de criar um componente próprio.

Estas instruções se aplicam a todo o projeto e complementam as demais instruções fornecidas pelo usuário.
