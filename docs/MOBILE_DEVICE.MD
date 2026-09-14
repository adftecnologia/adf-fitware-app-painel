# MobileDeviceService

## Visão Geral

O `MobileDeviceService` é um serviço centralizado para gerenciar detecção de dispositivos móveis, responsividade e estado da sidebar em toda a aplicação Angular.

## Funcionalidades

### Detecção de Dispositivos

- **Mobile**: ≤ 768px
- **Tablet**: 769px - 992px
- **Desktop**: ≥ 993px

### Observables Disponíveis

- `isMobile$: Observable<boolean>` - Detecta se é dispositivo móvel
- `isTablet$: Observable<boolean>` - Detecta se é tablet
- `isDesktop$: Observable<boolean>` - Detecta se é desktop
- `screenWidth$: Observable<number>` - Largura atual da tela
- `sidebarVisible$: Observable<boolean>` - Estado da sidebar em mobile

### Getters Síncronos

- `isMobile: boolean` - Valor atual do estado mobile
- `isTablet: boolean` - Valor atual do estado tablet
- `isDesktop: boolean` - Valor atual do estado desktop
- `screenWidth: number` - Largura atual da tela
- `sidebarVisible: boolean` - Estado atual da sidebar

## Como Usar

### 1. Injetar o Serviço

```typescript
import { Component, OnInit } from '@angular/core';
import { MobileDeviceService } from '../shared/services/mobile-device/mobile-device.service';

@Component({
  selector: 'app-exemplo',
  template: `
    <div *ngIf="mobileService.isMobile$ | async; else desktopTemplate">
      <!-- Conteúdo para mobile -->
      <p>Visualização Mobile</p>
    </div>

    <ng-template #desktopTemplate>
      <!-- Conteúdo para desktop -->
      <p>Visualização Desktop</p>
    </ng-template>
  `,
})
export class ExemploComponent implements OnInit {
  constructor(public mobileService: MobileDeviceService) {}

  ngOnInit() {
    // Escutar mudanças de dispositivo
    this.mobileService.isMobile$.subscribe(isMobile => {
      console.log('Is Mobile:', isMobile);
    });
  }
}
```

### 2. Controlar Sidebar (apenas em mobile)

```typescript
// Mostrar sidebar
this.mobileService.showSidebar();

// Esconder sidebar
this.mobileService.hideSidebar();

// Toggle sidebar
this.mobileService.toggleSidebar();

// Verificar se sidebar está visível
const isVisible = this.mobileService.sidebarVisible;
```

### 3. Usar no Template com Observables

```html
<!-- Usando observables com async pipe -->
<div *ngIf="mobileService.isMobile$ | async as isMobile">
  <button *ngIf="isMobile" (click)="mobileService.toggleSidebar()">Menu</button>
</div>

<!-- Classe condicional baseada no dispositivo -->
<div
  [class.mobile-layout]="mobileService.isMobile$ | async"
  [class.desktop-layout]="mobileService.isDesktop$ | async"
>
  Conteúdo responsivo
</div>
```

### 4. Exemplo Avançado - Layout Responsivo

```typescript
@Component({
  selector: 'app-responsive',
  template: `
    <ng-container
      *ngIf="{
        isMobile: mobileService.isMobile$ | async,
        isTablet: mobileService.isTablet$ | async,
        sidebarVisible: mobileService.sidebarVisible$ | async,
      } as ui"
    >
      <aside
        class="sidebar"
        [class.mobile-show]="ui.sidebarVisible && ui.isMobile"
      >
        <!-- Conteúdo da sidebar -->
      </aside>

      <main
        [class.mobile-full]="ui.isMobile"
        [class.tablet-adjusted]="ui.isTablet"
      >
        <!-- Conteúdo principal -->
      </main>
    </ng-container>
  `,
})
export class ResponsiveComponent {
  constructor(public mobileService: MobileDeviceService) {}
}
```

## Recursos do Serviço

### Performance

- **Debounce**: Events de resize são debounced por 150ms
- **DistinctUntilChanged**: Só emite quando valores mudam realmente
- **BehaviorSubject**: Mantém o último valor conhecido

### Gestão Automática

- **Resize Listener**: Automaticamente detecta mudanças de tamanho
- **Sidebar Auto-hide**: Esconde sidebar quando muda de mobile para desktop
- **Memory Management**: Não há vazamentos de memória

### Breakpoints

- Mobile: ≤ 768px
- Tablet: 769px - 992px
- Desktop: ≥ 993px

## Benefícios

1. **Centralização**: Lógica de responsividade em um só lugar
2. **Reatividade**: Observables para mudanças em tempo real
3. **Performance**: Debouncing e distinct para otimização
4. **Facilidade**: Interface simples e intuitiva
5. **Consistência**: Mesmos breakpoints em toda aplicação
6. **Testabilidade**: Fácil de mockar e testar

## Integração com CSS

O serviço funciona perfeitamente com as classes CSS existentes:

```css
@media (max-width: 768px) {
  .sidebar.mobile-show {
    transform: translateX(0);
  }

  .main-content.mobile-full {
    margin-left: 0;
  }
}
```
