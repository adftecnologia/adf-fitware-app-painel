import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, finalize, switchMap, take, tap } from 'rxjs/operators';
import { ERoutes } from '../../enums/routes.enum';
import { AuthService } from '../../services/auth-service/auth.service';
import { LoadingService } from '../../services/loading-service/loading.service';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const loadingService = inject(LoadingService);
  const router = inject(Router);

  const redirectToLogin = (): boolean => {
    setTimeout(() => {
      router.navigate([ERoutes.LOGIN]);
    }, 500);
    return false;
  };

  loadingService.show('Verificando autenticação...');

  return authService.isAuthenticated().pipe(
    filter(user => user !== undefined), // Aguarda o Firebase Auth resolver o estado
    take(1),
    tap(user =>
      loadingService.setMessage(
        user ? 'Autenticação confirmada!' : 'Redirecionando para login...'
      )
    ),
    switchMap(async user => {
      if (!user) {
        return redirectToLogin();
      }

      loadingService.setMessage('Buscando dados do usuário...');

      const profile = await authService.getCurrentUserProfile(user.uid);

      if (!profile) {
        loadingService.setMessage(
          'Dados de usuário não encontrados, Redirecionando para login...'
        );
        return redirectToLogin();
      }
      return true;
    }),
    finalize(() => {
      setTimeout(() => {
        loadingService.hide();
      }, 1000);
    })
  );
};

export const AuthLoginGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const loadingService = inject(LoadingService);
  const router = inject(Router);

  const redirectToLogin = (): boolean => {
    setTimeout(() => {
      router.navigate([ERoutes.LOGIN]);
    }, 500);
    return false;
  };

  const isDislogging = loadingService.messageValue === 'Deslogando...';

  loadingService.show(
    isDislogging ? loadingService.messageValue : 'Verificando autenticação...'
  );

  return authService.isAuthenticated().pipe(
    filter(user => user !== undefined), // Aguarda o Firebase Auth resolver o estado
    take(1),
    tap(user => {
      if (!isDislogging) {
        loadingService.setMessage(
          user
            ? 'Autenticação confirmada!'
            : 'Carregando configurações de login...'
        );
      }
    }),
    switchMap(async user => {
      if (user) {
        loadingService.setMessage('Buscando dados do usuário...');

        const profile = await authService.getCurrentUserProfile(user.uid);

        if (!profile) {
          loadingService.setMessage(
            'Dados de usuário não encontrados, Redirecionando para login...'
          );
          return redirectToLogin();
        }

        setTimeout(() => {
          router.navigate(['/']);
        }, 800);
        return false;
      }
      return true;
    }),
    finalize(() => {
      setTimeout(() => {
        loadingService.hide();
      }, 1000);
    })
  );
};
