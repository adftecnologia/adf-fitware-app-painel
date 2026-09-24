import { EAlertType } from '../enums/alert.enum';
import { ERoutes } from '../enums/routes.enum';
import { IRoutesSistema } from '../models/sistema.model';

export type IValidRoutes = Exclude<
  ERoutes,
  ERoutes.DEFAULT | ERoutes.LOGIN | ERoutes.CORINGA
>;

/**
 * A ordem das chaves aqui é a ordem do menu lateral — ROTAS_LAYOUT deriva
 * deste objeto com Object.entries. Agrupa primeiro o ciclo de vida de um
 * tenant (criar, configurar) e depois a administração do próprio painel.
 */
export const TITULO_LAYOUT: { [key in IValidRoutes]: string } = {
  [ERoutes.DASHBOARD]: 'Dashboard',
  [ERoutes.CRIAR_PROJETO]: 'Criar Projeto',
  [ERoutes.TENANTS]: 'Configuração de Tenants',
  [ERoutes.ENVIRONMENTS]: 'Configuração de Environments',
  [ERoutes.GATEWAY_CONFIG]: 'Configuração de Gateway',
  [ERoutes.PERFIL_USUARIO]: 'Meu Perfil',
  [ERoutes.USUARIOS]: 'Usuários do Painel',
} as const;

export const ICONES_LAYOUT: { [key in IValidRoutes]: string } = {
  [ERoutes.DASHBOARD]: 'fa-tachometer-alt',
  [ERoutes.CRIAR_PROJETO]: 'fa-rocket',
  [ERoutes.TENANTS]: 'fa-hdd',
  [ERoutes.ENVIRONMENTS]: 'fa-sliders-h',
  [ERoutes.GATEWAY_CONFIG]: 'fa-credit-card',
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
