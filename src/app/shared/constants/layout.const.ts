import { EAlertType } from '../enums/alert.enum';
import { ERoutes } from '../enums/routes.enum';
import { IRoutesSistema } from '../models/sistema.model';

export type IValidRoutes = Exclude<
  ERoutes,
  ERoutes.DEFAULT | ERoutes.LOGIN | ERoutes.CORINGA
>;

export const TITULO_LAYOUT: { [key in IValidRoutes]: string } = {
  [ERoutes.DASHBOARD]: 'Dashboard',
  [ERoutes.PERFIL_USUARIO]: 'Meu Perfil',
  [ERoutes.USUARIOS]: 'Usuários do Painel',
  [ERoutes.TENANTS]: 'Configuração de Tenants',
  [ERoutes.ENVIRONMENTS]: 'Configuração de Environments',
} as const;

export const ICONES_LAYOUT: { [key in IValidRoutes]: string } = {
  [ERoutes.DASHBOARD]: 'fa-tachometer-alt',
  [ERoutes.PERFIL_USUARIO]: 'fa-user-tie',
  [ERoutes.USUARIOS]: 'fa-users',
  [ERoutes.TENANTS]: 'fa-hdd',
  [ERoutes.ENVIRONMENTS]: 'fa-sliders-h',
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
