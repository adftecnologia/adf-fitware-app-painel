import { ERoutes } from '../enums/routes.enum';

export const getRoutePath = (route: ERoutes): string => {
  return route.replace('/', '');
};
