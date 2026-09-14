import { Routes } from '@angular/router';
import { ColaboradoresComponent } from './components/colaboradores/colaboradores.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { EscolasComponent } from './components/escolas/escolas.component';
import { FornecedoresComponent } from './components/fornecedores/fornecedores.component';
import { NotasFiscaisComponent } from './components/notas-fiscais/notas-fiscais.component';
import { OrdemCompraComponent } from './components/ordem-compra/ordem-compra.component';
import { PerfilUsuarioComponent } from './components/perfil-usuario/perfil-usuario.component';
import { ProdutosComponent } from './components/produtos/produtos.component';
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
    redirectTo: getRoutePath(ERoutes.DASHBOARD),
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
      { path: getRoutePath(ERoutes.DASHBOARD), component: DashboardComponent },
      {
        path: getRoutePath(ERoutes.FORNECEDORES),
        component: FornecedoresComponent,
      },
      {
        path: getRoutePath(ERoutes.ESCOLAS),
        component: EscolasComponent,
      },
      {
        path: getRoutePath(ERoutes.PRODUTOS),
        component: ProdutosComponent,
      },
      {
        path: getRoutePath(ERoutes.COLABORADORES),
        component: ColaboradoresComponent,
      },
      {
        path: getRoutePath(ERoutes.ORDEM_COMPA),
        component: OrdemCompraComponent,
      },
      {
        path: getRoutePath(ERoutes.NOTAS_FISCAIS),
        component: NotasFiscaisComponent,
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
    ],
  },
  {
    path: ERoutes.CORINGA,
    redirectTo: ERoutes.LOGIN,
  },
];
