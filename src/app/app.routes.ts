import { Routes } from '@angular/router';

/**
 * Rutas de la extranet.
 *
 * El login es el acceso por defecto. La consola (bandeja general) y el
 * formulario de edición de la DAEX son destinos separados: la bandeja solo
 * lista y notifica, el formulario edita el expediente con carga diferida.
 *
 * El formulario declara una única ruta hija `:capituloId` para los 7 capítulos
 * del expediente, resuelta en tiempo de ejecución contra el catálogo de
 * `ContenedorCapituloComponent`. Cada capítulo apila sus microcomponentes en un
 * scroll continuo, así que la granularidad de la URL es el capítulo y no la
 * sección: una sola entrada de `loadComponent` sustituye a las 27 anteriores.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar Sesión · Extranet de Registro de IGAs',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'workspace',
    title: 'Consola de Trámite · Extranet de Registro de IGAs',
    loadComponent: () =>
      import('./features/workspace/workspace.component').then((m) => m.WorkspaceComponent),
  },
  {
    path: 'formulario-iga',
    title: 'Expediente DAEX · Extranet de Registro de IGAs',
    loadComponent: () =>
      import('./features/formulario-iga/formulario-iga.component').then(
        (m) => m.FormularioIgaComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: '1' },
      {
        path: ':capituloId',
        loadComponent: () =>
          import('./features/formulario-iga/contenedor-capitulo/contenedor-capitulo.component').then(
            (m) => m.ContenedorCapituloComponent,
          ),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
