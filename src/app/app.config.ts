import localePtExtra from '@angular/common/locales/extra/pt';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';

import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { routes } from './app.routes';

registerLocaleData(localePt, 'pt-BR', localePtExtra);

const customProviders = [
  { provide: LOCALE_ID, useValue: 'pt-BR' },
  { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
];

export const appConfig: ApplicationConfig = {
  providers: [
    ...customProviders,
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()),
    provideHttpClient(),
    provideEnvironmentNgxMask(),
  ],
};
