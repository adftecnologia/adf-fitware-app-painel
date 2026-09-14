import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AlertContainerComponent } from '../../shared/components/alert/alert-container/alert-container.component';
import {
  IValidRoutes,
  TITULO_LAYOUT,
} from '../../shared/constants/layout.const';
import { ERoutes } from '../../shared/enums/routes.enum';
import { ICurrentUserFirebase } from '../../shared/models/firebase.model';
import { IRoutesSistema } from '../../shared/models/sistema.model';
import { AlertService } from '../../shared/services/alert-service/alert.service';
import { AuthService } from '../../shared/services/auth-service/auth.service';
import { FeatureToggleService } from '../../shared/services/featuretoggle-service/featuretoggle.service';
import { MobileDeviceService } from '../../shared/services/mobile-device/mobile-device.service';
// import { FooterComponent } from './../../shared/components/footer/footer.component';
import { getUsernameAcronym } from './../../shared/functions/sistema.function';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AlertContainerComponent,
    // FooterComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];

  public routes: IRoutesSistema[] = [];
  public sidebarCollapsed = false;
  public pageTitle = TITULO_LAYOUT[ERoutes.DASHBOARD];
  public currentUser: ICurrentUserFirebase = null;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly alertService: AlertService,
    public readonly mobileService: MobileDeviceService,
    public readonly featureToggleService: FeatureToggleService
  ) {}

  public ngOnInit(): void {
    this.getUserData();
    this.setupRouterSubscription();
    this.getRotasPermitidas();
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private getUserData(): void {
    this.currentUser = this.authService.getCurrentUser;
  }

  private setupRouterSubscription(): void {
    // Define o título correto já na carga inicial (F5 / URL direta)
    this.pageTitle =
      TITULO_LAYOUT[this.router.url as IValidRoutes] ??
      TITULO_LAYOUT[ERoutes.DASHBOARD];

    const routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(({ url }: NavigationEnd) => {
        this.pageTitle = TITULO_LAYOUT[url as IValidRoutes];
      });

    this.subscriptions.push(routerSub);
  }

  public toggleSidebar(): void {
    if (this.mobileService.isMobile) {
      this.mobileService.toggleSidebar();
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }

  public getUserInitials(): string {
    const { displayName, email } = this.currentUser || {};

    if (displayName) {
      return getUsernameAcronym(displayName);
    }

    if (email) {
      return email.charAt(0).toUpperCase();
    }

    return 'U';
  }

  public showFormattedEmail(email: string): string {
    if (!email) return '';

    const [localPart] = email.split('@');
    return localPart.toUpperCase();
  }

  public async logout(event: Event): Promise<void> {
    event.preventDefault();
    this.authService
      .logout()
      .then(() => setTimeout(() => this.router.navigate([ERoutes.LOGIN]), 500))
      .catch(() => this.alertService.error('Ocorreu um erro ao fazer logout.'));
  }

  public getRotasPermitidas() {
    this.routes = this.featureToggleService.getRotasPermitidasPorUsuario();
  }
}
