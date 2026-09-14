# Z-Index Layers

Este documento documenta os valores de z-index usados no projeto para garantir a correta sobreposição de elementos.

## Valores de Z-Index Utilizados

### Bootstrap (padrão)

- **Dropdown**: 1000
- **Sticky**: 1020
- **Fixed**: 1030
- **Offcanvas backdrop**: 1040
- **Offcanvas**: 1045
- **Modal backdrop**: 1050
- **Modal**: 1055
- **Popover**: 1070
- **Tooltip**: 1080
- **Toast**: 1090

### Customizações do Projeto

- **Alertas**: 1060 (acima dos modais)
- **Sidebar mobile**: 1050 (mesmo nível do modal backdrop)

## Regras de Sobreposição

1. **Alertas** devem sempre aparecer acima de todos os modais
2. **Tooltips** aparecem acima de todos os outros elementos
3. **Modais** ficam acima do conteúdo principal mas abaixo dos alertas
4. **Sidebar mobile** fica no mesmo nível do backdrop dos modais

## Como Testar

Para verificar se os alertas aparecem corretamente acima dos modais:

1. Abra qualquer modal no sistema
2. Triggere um alerta (ex: ação de salvar, erro, etc.)
3. O alerta deve aparecer acima do modal, não sendo bloqueado por ele

## Manutenção

Ao adicionar novos componentes que usam posicionamento absoluto ou fixed:

- Consulte esta tabela para definir o z-index apropriado
- Mantenha os alertas sempre com o maior z-index não-tooltip
- Documente qualquer novo valor z-index adicionado
