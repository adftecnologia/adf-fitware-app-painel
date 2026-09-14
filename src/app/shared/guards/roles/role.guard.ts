import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ERoutes } from '../../enums/routes.enum';
import { FeatureToggleService } from '../../services/featuretoggle-service/featuretoggle.service';

export const RoleGuard: CanActivateFn = (route, state) => {
  const featureToggle = inject(FeatureToggleService);
  const router = inject(Router);

  const rota = route.routeConfig?.path ?? '';

  if (!featureToggle.hasPermissaoRotas(`/${rota}`)) {
    router.navigate([ERoutes.DASHBOARD]);
    return false;
  }
  return true;
};
