import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Enlaza los parámetros de ruta con los `input()` de los componentes, para
    // que `ContenedorCapituloComponent` reciba `:capituloId` sin leer el router.
    provideRouter(routes, withComponentInputBinding()),
  ],
};
