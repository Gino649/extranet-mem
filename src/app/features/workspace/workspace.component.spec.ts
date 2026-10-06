import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { WorkspaceComponent } from './workspace.component';
import { DaexStore } from '../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

describe('WorkspaceComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspaceComponent],
      providers: [provideRouter([{ path: 'login', children: [] }])],
    }).compileComponents();
  });

  async function montar() {
    const fixture = TestBed.createComponent(WorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const store = TestBed.inject(DaexStore);
    store.inyectarSesion('20501234567', 'token', 'Titular Minero 20501234567');
    fixture.detectChanges();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  /** Recuento de celdas de acuse aún sin descargar. */
  function pendientes(raiz: HTMLElement): number {
    return Array.from(raiz.querySelectorAll('tbody tr')).filter((fila) =>
      fila.textContent?.includes('Pendiente'),
    ).length;
  }

  describe('Vistas del panel central', () => {
    it('arranca en la vista de Solicitudes con su título de cabecera', async () => {
      const { raiz } = await montar();

      expect(raiz.textContent).toContain('Listado de Solicitudes de IGAs');
      expect(raiz.querySelector('table')).toBeTruthy();
    });

    it('alterna a Notificaciones y actualiza el título de la cabecera', async () => {
      const { fixture, raiz } = await montar();
      elemento<HTMLButtonElement>(raiz, 'aside button:nth-of-type(2)').click();
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Notificaciones y Cargos de la DGAAM');
      expect(raiz.textContent).toContain('Actos administrativos DGAAM');
    });
  });

  describe('Colapso del menú lateral', () => {
    it('alterna entre el ancho desplegado y el replegado', async () => {
      const { fixture, raiz } = await montar();
      const menu = elemento<HTMLElement>(raiz, 'aside');

      expect(menu.classList.contains('menu-lateral--abierto')).toBe(true);

      elemento<HTMLButtonElement>(raiz, 'aside button').click();
      fixture.detectChanges();
      expect(menu.classList.contains('menu-lateral--cerrado')).toBe(true);
      expect(menu.classList.contains('menu-lateral--abierto')).toBe(false);

      elemento<HTMLButtonElement>(raiz, 'aside button').click();
      fixture.detectChanges();
      expect(menu.classList.contains('menu-lateral--abierto')).toBe(true);
    });
  });

  describe('Estructura semántica del layout', () => {
    it('delega la navegación a un aside y no a un div genérico', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelector('aside')).toBeTruthy();
      expect(raiz.querySelector('nav')).toBeNull();
      expect(elemento<HTMLElement>(raiz, 'aside').getAttribute('aria-label')).toBe(
        'Navegación principal de la extranet',
      );
    });

    it('mantiene el aside subscribed a menuColapsado()', async () => {
      const { fixture, raiz } = await montar();
      const menu = elemento<HTMLElement>(raiz, 'aside');
      // La clase reactiva del ancho es la que prueba la suscripción al signal.
      expect(menu.classList.contains('menu-lateral--abierto')).toBe(true);
      expect(menu.classList.contains('menu-lateral--cerrado')).toBe(false);

      elemento<HTMLButtonElement>(raiz, 'aside button').click();
      fixture.detectChanges();
      expect(menu.classList.contains('menu-lateral--cerrado')).toBe(true);
    });

    it('cierra el layout con un footer de créditos institucionales', async () => {
      const { raiz } = await montar();
      const pie = elemento<HTMLElement>(raiz, 'footer');

      expect(pie.textContent).toContain(
        'Ministerio de Energía y Minas - Dirección General de Asuntos Ambientales Mineros (DGAAM)',
      );
      expect(pie.textContent).toContain(
        'Sede Central: Av. Las Artes Sur 260, San Borja, Lima, Perú. v1.0.0 (Ecosistema SEAL)',
      );
    });

    it('ordena cabecera, cuerpo y pie, con el footer al cierre', async () => {
      const { raiz } = await montar();
      // `raiz` es el host del componente; la raíz del layout es su primer hijo.
      const disposicion = elemento<HTMLElement>(raiz, 'div');
      const orden = Array.from(disposicion.children).map((nodo) => nodo.tagName.toLowerCase());

      expect(orden).toEqual(['header', 'div', 'footer']);
    });

    it('mantiene el footer fuera del panel central para que no desplace el scroll', async () => {
      const { raiz } = await montar();
      const pie = elemento<HTMLElement>(raiz, 'footer');
      const cuerpo = elemento<HTMLElement>(raiz, 'main');

      expect(cuerpo.contains(pie)).toBe(false);
      expect(pie.classList.contains('consola-pie')).toBe(true);
    });
  });

  describe('Columna de acciones condicional', () => {
    it('ofrece Editar solo en los expedientes en Borrador', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2026-03745' });
      fixture.detectChanges();

      const tabla = elemento<HTMLTableElement>(raiz, 'table');
      expect(tabla.textContent).toContain('Exploración Pampa Blanca');

      const filas = Array.from(tabla.querySelectorAll('tbody tr'));
      const borrador = filas.find((fila) => fila.textContent?.includes('Exploración Pampa Blanca'));
      expect(borrador?.textContent).toContain('✏️ Editar');
      expect(borrador?.textContent).not.toContain('👁️ Consultar');
    });

    it('ofrece el juego de consulta en los expedientes ya enviados', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      const tabla = elemento<HTMLTableElement>(raiz, 'table');
      const filas = Array.from(tabla.querySelectorAll('tbody tr'));
      const aprobado = filas.find((fila) =>
        fila.textContent?.includes('Recuperación Pampa Blanca'),
      );

      expect(aprobado?.textContent).toContain('👁️ Consultar');
      expect(aprobado?.textContent).toContain('🖨️ Imprimir');
      expect(aprobado?.textContent).toContain('💬 Comunicaciones');
      expect(aprobado?.textContent).toContain('🔄 Modificación');
      expect(aprobado?.textContent).not.toContain('✏️ Editar');
    });
  });

  describe('Filtrado en cliente', () => {
    it('acota por estado del trámite', async () => {
      const { store } = await montar();

      store.filtrar({ estado: 'Borrador' });
      const borradores = store.expedientesFiltrados();
      expect(borradores.length).toBeGreaterThan(0);
      expect(borradores.every((expediente) => expediente.estado === 'Borrador')).toBe(true);
    });

    it('acota por tipo de IGA y busca sin distinguir mayúsculas', async () => {
      const { store } = await montar();

      store.filtrar({ tipoIga: 'DAEX' });
      expect(store.expedientesFiltrados().every((e) => e.tipoIga === 'DAEX')).toBe(true);

      store.filtrar({ tipoIga: 'TODOS', nombreProyecto: 'pampA' });
      const filtrados = store.expedientesFiltrados();
      expect(filtrados.length).toBeGreaterThan(0);
      expect(
        filtrados.every((expediente) => expediente.nombreProyecto.toLowerCase().includes('pampa')),
      ).toBe(true);
    });

    it('Limpiar restituye el listado completo', async () => {
      const { store } = await montar();
      const total = store.expedientesFiltrados().length;

      store.filtrar({ estado: 'Aprobado' });
      expect(store.expedientesFiltrados().length).toBeLessThan(total);

      store.limpiarFiltros();
      expect(store.expedientesFiltrados().length).toBe(total);
    });
  });

  describe('Paginación', () => {
    it('reparte las filas en páginas y acota los extremos', async () => {
      const { store } = await montar();
      const total = store.expedientesFiltrados().length;

      expect(store.totalPaginas()).toBe(Math.ceil(total / store.tamanoPagina));
      expect(store.expedientesPaginados().length).toBe(store.tamanoPagina);

      store.irAPagina(999);
      expect(store.pagina()).toBe(store.totalPaginas());

      store.irAPagina(-5);
      expect(store.pagina()).toBe(1);
    });

    it('vuelve a la primera página al aplicar un filtro', async () => {
      const { store } = await montar();
      store.irAPagina(2);
      expect(store.pagina()).toBe(2);

      store.filtrar({ estado: 'Borrador' });
      expect(store.pagina()).toBe(1);
    });
  });

  describe('Modal esmerilado de selección de IGA', () => {
    it('se abre desde el botón Nuevo y muestra la ayuda normativa del DAEX', async () => {
      const { fixture, raiz } = await montar();
      expect(raiz.querySelector('[role="dialog"]')).toBeNull();

      elemento<HTMLButtonElement>(raiz, 'button.boton-oro').click();
      fixture.detectChanges();

      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      expect(dialogo.getAttribute('aria-modal')).toBe('true');
      expect(dialogo.textContent).toContain(
        'Soporta un máximo estricto de hasta 10 plataformas físicas de perforación.',
      );
    });

    it('bloquea el CTA hasta elegir instrumento y se cierra al confirmar', async () => {
      const { fixture, raiz } = await montar();
      elemento<HTMLButtonElement>(raiz, 'button.boton-oro').click();
      fixture.detectChanges();

      const confirmar = elemento<HTMLButtonElement>(
        raiz,
        '[role="dialog"] button.boton-oro, [role="dialog"] button.boton-tenue.cursor-not-allowed',
      );
      expect(confirmar.disabled).toBe(true);

      elemento<HTMLButtonElement>(raiz, '.iga-tarjeta').click();
      fixture.detectChanges();

      const habilitado = elemento<HTMLButtonElement>(raiz, '[role="dialog"] button.boton-oro');
      expect(habilitado.disabled).toBe(false);

      habilitado.click();
      fixture.detectChanges();
      expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    });

    it('se cierra con el botón Cancelar', async () => {
      const { fixture, raiz } = await montar();
      elemento<HTMLButtonElement>(raiz, 'button.boton-oro').click();
      fixture.detectChanges();

      const botones = Array.from(
        raiz.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
      );
      const cancelar = botones.find((boton) => boton.textContent?.includes('Cancelar'));
      cancelar?.click();
      fixture.detectChanges();

      expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    });

    it('acota su alto y desplaza solo la lista de instrumentos', async () => {
      const { fixture, raiz } = await montar();
      elemento<HTMLButtonElement>(raiz, 'button.boton-oro').click();
      fixture.detectChanges();
      const panel = elemento<HTMLElement>(raiz, '[role="dialog"]');

      /*
       * El fondo centra con `place-items-center`, así que un panel más alto que
       * la ventana se empalma por arriba y por abajo: en una laptop desaparecían
       * el encabezado con el cierre y el pie de acciones. El techo de alto vive
       * en `.modal-panel`; lo que se comprueba aquí es el reparto del scroll,
       * que es lo que el marcado resuelve: `flex-1 overflow-y-auto` en el
       * cuerpo, y cabecera y acciones fuera de esa área.
       */
      expect(panel.className).toContain('modal-panel');

      const cuerpo = elemento<HTMLElement>(raiz, '[role="dialog"] .overflow-y-auto');
      expect(cuerpo.className).toContain('flex-1');
      expect(cuerpo.querySelector('.iga-tarjeta')).toBeTruthy();

      const botones = Array.from(
        raiz.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
      );
      const confirmar = botones.find((boton) => boton.textContent?.includes('Iniciar Registro'));
      const cerrar = botones.find((boton) => boton.getAttribute('aria-label') === 'Cerrar');
      expect(cuerpo.contains(confirmar as HTMLButtonElement)).toBe(false);
      expect(cuerpo.contains(cerrar as HTMLButtonElement)).toBe(false);
    });
  });

  describe('Sesión y acuse de recibo', () => {
    it('el dropdown de sesión expone Cerrar Sesión en rojo', async () => {
      const { fixture, raiz } = await montar();
      const disparador = elemento<HTMLButtonElement>(raiz, 'button[aria-haspopup="menu"]');
      expect(disparador.getAttribute('aria-expanded')).toBe('false');

      disparador.click();
      fixture.detectChanges();
      expect(disparador.getAttribute('aria-expanded')).toBe('true');

      const cerrar = elemento<HTMLButtonElement>(raiz, '[role="menuitem"].text-red-600');
      expect(cerrar.textContent).toContain('🚪 Cerrar Sesión');
    });

    it('Cerrar Sesión limpia el store', async () => {
      const { fixture, store, raiz } = await montar();
      elemento<HTMLButtonElement>(raiz, 'button[aria-haspopup="menu"]').click();
      fixture.detectChanges();
      elemento<HTMLButtonElement>(raiz, '[role="menuitem"].text-red-600').click();
      await fixture.whenStable();

      expect(store.autenticado()).toBe(false);
      expect(store.ruc()).toBe('');
    });

    it('muestra Pendiente hasta descargar el cargo y sella la marca de tiempo', async () => {
      const { fixture, store, raiz } = await montar();
      const crearObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:acuse');
      const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

      // Vista de notificaciones
      elemento<HTMLButtonElement>(raiz, 'aside button:nth-of-type(2)').click();
      fixture.detectChanges();

      const totalNotificaciones = store.notificaciones().length;
      expect(pendientes(raiz)).toBe(totalNotificaciones);

      const notificacion = store.notificaciones()[0];
      expect(notificacion).toBeDefined();
      if (!notificacion) {
        return;
      }
      elemento<HTMLButtonElement>(raiz, 'tbody tr button.boton-fila').click();
      fixture.detectChanges();

      // Dos descargas en la misma tarea: el acto administrativo y el acuse PDF.
      expect(crearObjectURL).toHaveBeenCalledTimes(2);
      expect(store.acuseDe(notificacion.id)).toBeDefined();
      expect(pendientes(raiz)).toBe(totalNotificaciones - 1);
      expect(Array.from(raiz.querySelectorAll('tbody tr'))[0]?.textContent).toContain('✔');

      crearObjectURL.mockRestore();
      revocar.mockRestore();
    });
  });
});
