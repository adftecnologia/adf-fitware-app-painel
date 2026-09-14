import { EAlertType } from '../enums/alert.enum';
import { ERoutes } from '../enums/routes.enum';
import { IRoutesSistema } from '../models/sistema.model';

export type IValidRoutes = Exclude<
  ERoutes,
  ERoutes.DEFAULT | ERoutes.LOGIN | ERoutes.CORINGA | ERoutes.COLABORADORES
>;

export const TITULO_LAYOUT: { [key in IValidRoutes]: string } = {
  [ERoutes.DASHBOARD]: 'Dashboard',
  [ERoutes.FORNECEDORES]: 'Fornecedores',
  [ERoutes.ESCOLAS]: 'Escolas',
  [ERoutes.PRODUTOS]: 'Produtos/Insumos',
  // [ERoutes.COLABORADORES]: 'Colaboradores',
  [ERoutes.ORDEM_COMPA]: 'Ordem de Compra',
  [ERoutes.NOTAS_FISCAIS]: 'Notas Fiscais',
  [ERoutes.USUARIOS]: 'Usuários',
  [ERoutes.PERFIL_USUARIO]: 'Perfil do Usuário',
} as const;

export const ICONES_LAYOUT: { [key in IValidRoutes]: string } = {
  [ERoutes.DASHBOARD]: 'fa-tachometer-alt',
  [ERoutes.FORNECEDORES]: 'fa-industry',
  [ERoutes.ESCOLAS]: 'fa-school',
  [ERoutes.PRODUTOS]: 'fa-box',
  // [ERoutes.COLABORADORES]: 'fa-id-badge',
  [ERoutes.ORDEM_COMPA]: 'fa-shopping-cart',
  [ERoutes.NOTAS_FISCAIS]: 'fa-file-invoice-dollar',
  [ERoutes.PERFIL_USUARIO]: 'fa-user-tie',
  [ERoutes.USUARIOS]: 'fa-users',
};

export const ROTAS_LAYOUT: IRoutesSistema[] = Object.entries(TITULO_LAYOUT).map(
  ([path, title]) => ({
    path,
    title,
    icon: ICONES_LAYOUT[path as IValidRoutes],
  })
);

export const ALERT_ICONS: { [key in EAlertType]: string } = {
  success: 'fas fa-check-circle',
  info: 'fas fa-info-circle',
  warning: 'fas fa-exclamation-triangle',
  danger: 'fas fa-exclamation-circle',
};
