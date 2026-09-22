import { Routes } from '@angular/router';
import { ConfiguracaoEnvironmentsComponent } from './components/configuracao-environments/configuracao-environments.component';
import { ConfiguracaoTenantComponent } from './components/configuracao-tenant/configuracao-tenant.component';
import { CriarProjetoComponent } from './components/criar-projeto/criar-projeto.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { PerfilUsuarioComponent } from './components/perfil-usuario/perfil-usuario.component';
import { UsuariosComponent } from './components/usuarios/usuarios.component';
import { LayoutComponent } from './pages/layout/layout.component';
import { LoginComponent } from './pages/login/login.component';
import { ERoutes } from './shared/enums/routes.enum';
import { getRoutePath } from './shared/functions/routes.function';
import { AuthGuard, AuthLoginGuard } from './shared/guards/auth/auth.guard';
import { RoleGuard } from './shared/guards/roles/role.guard';

export const routes: Routes = [
  {
    path: getRoutePath(ERoutes.DEFAULT),
    redirectTo: getRoutePath(ERoutes.PERFIL_USUARIO),
    pathMatch: 'full',
  },
  {
    path: getRoutePath(ERoutes.LOGIN),
    canActivate: [AuthLoginGuard],
    component: LoginComponent,
  },
  {
    path: getRoutePath(ERoutes.DEFAULT),
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: getRoutePath(ERoutes.DASHBOARD),
        component: DashboardComponent,
        canActivate: [RoleGuard],
      },
      {
        path: getRoutePath(ERoutes.PERFIL_USUARIO),
        component: PerfilUsuarioComponent,
      },
      {
        path: getRoutePath(ERoutes.USUARIOS),
        component: UsuariosComponent,
        canActivate: [RoleGuard],
      },
      {
        path: getRoutePath(ERoutes.TENANTS),
        component: ConfiguracaoTenantComponent,
        canActivate: [RoleGuard],
      },
      {
        path: getRoutePath(ERoutes.ENVIRONMENTS),
        component: ConfiguracaoEnvironmentsComponent,
        canActivate: [RoleGuard],
      },
      {
        path: getRoutePath(ERoutes.CRIAR_PROJETO),
        component: CriarProjetoComponent,
        canActivate: [RoleGuard],
      },
    ],
  },
  {
    path: ERoutes.CORINGA,
    redirectTo: ERoutes.LOGIN,
  },
];
