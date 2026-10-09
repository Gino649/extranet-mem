import { provideRouter, Router } from '@angular/router';
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
      providers: [
        provideRouter([
          { path: 'formulario-iga', children: [] },
          { path: 'login', children: [] },
        ]),
      ],
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

    it('acompaña el aside al crecimiento del cuerpo con self-stretch', async () => {
      const { raiz } = await montar();
      const menu = elemento<HTMLElement>(raiz, 'aside');
      const cuerpo = menu.parentElement;

      // El contenedor mantiene `items-start` para que el botón de despliegue
      // conserve su alto natural; el aside lo anula para llegar hasta la base
      // del contenido y no dejar un tramo de fondo desnudo al hacer scroll.
      expect(cuerpo?.classList.contains('items-start')).toBe(true);
      expect(menu.classList.contains('self-stretch')).toBe(true);
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

  describe('Consulta en modo solo lectura', () => {
    /** Pulsa el botón Consultar de la fila del expediente aprobado de referencia. */
    function abrirConsulta(raiz: HTMLElement): HTMLButtonElement {
      const filas = Array.from(
        elemento<HTMLTableElement>(raiz, 'table').querySelectorAll('tbody tr'),
      );
      const aprobado = filas.find((fila) =>
        fila.textContent?.includes('Recuperación Pampa Blanca'),
      );
      expect(aprobado).toBeDefined();

      const boton = Array.from(aprobado!.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidato) => candidato.textContent?.includes('Consultar'),
      );
      expect(boton).toBeDefined();
      return boton!;
    }

    it('arranca con el candado apagado en el estado global', async () => {
      const { store } = await montar();

      expect(store.modoSoloConsulta()).toBe(false);
    });

    it('enciende el candado de solo lectura y navega al formulario con ref y modo', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      abrirConsulta(raiz).click();
      await fixture.whenStable();

      expect(store.modoSoloConsulta()).toBe(true);
      const router = TestBed.inject(Router);
      expect(router.url).toContain('/formulario-iga');
      expect(router.url).toContain('ref=EXP-005');
      expect(router.url).toContain('modo=CONSULTA');
      // La cabecera del formulario carga el expediente de referencia y no un
      // borrador ajeno.
      expect(store.formulario().numeroExpediente).toBe('MINEM-2025-08811');
    });

    it('el switch reactivo del store apaga y enciende el candado', async () => {
      const { store } = await montar();

      store.activarModoSoloConsulta(true);
      expect(store.modoSoloConsulta()).toBe(true);
      store.activarModoSoloConsulta(false);
      expect(store.modoSoloConsulta()).toBe(false);
    });

    it('Editar apaga el candado y navega con ref y modo=EDICION', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2026-03745' });
      fixture.detectChanges();

      const filas = Array.from(
        elemento<HTMLTableElement>(raiz, 'table').querySelectorAll('tbody tr'),
      );
      const borrador = filas.find((fila) => fila.textContent?.includes('Exploración Pampa Blanca'));
      expect(borrador).toBeDefined();
      const editar = Array.from(borrador!.querySelectorAll<HTMLButtonElement>('button')).find(
        (boton) => boton.textContent?.includes('Editar'),
      );
      editar?.click();
      await fixture.whenStable();

      expect(store.modoSoloConsulta()).toBe(false);
      const router = TestBed.inject(Router);
      expect(router.url).toContain('/formulario-iga');
      expect(router.url).toContain('ref=EXP-007');
      expect(router.url).toContain('modo=EDICION');
      expect(store.formulario().numeroExpediente).toBe('MINEM-2026-03745');
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

  /* ------------------------------------------------------------------
     ESTRATEGIA DE MODIFICACIÓN · Bifurcación IGA / ITS
     ------------------------------------------------------------------
     El botón «Modificación» de una solicitud ya enviada abre un popup que
     discrimina entre la re-evaluación significativa (reabre el formulario
     IGA) y el trámite derivado ITS (nuevo expediente Borrador en la bandeja).
     ------------------------------------------------------------------ */
  describe('Estrategia de modificación: bifurcación IGA / ITS', () => {
    /** Abre el popup desde la fila del expediente aprobado de referencia. */
    function abrirModificacion(raiz: HTMLElement): HTMLButtonElement {
      const filas = Array.from(
        elemento<HTMLTableElement>(raiz, 'table').querySelectorAll('tbody tr'),
      );
      const aprobado = filas.find((fila) =>
        fila.textContent?.includes('Recuperación Pampa Blanca'),
      );
      expect(aprobado).toBeDefined();

      const boton = Array.from(aprobado!.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidato) => candidato.textContent?.includes('Modificación'),
      );
      expect(boton).toBeDefined();
      return boton!;
    }

    /** Encuentra un botón del popup por su texto. */
    function opcionDelPopup(dialogo: HTMLElement, texto: string): HTMLButtonElement {
      const encontrado = Array.from(dialogo.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidato) => candidato.textContent?.includes(texto),
      );
      expect(encontrado).toBeDefined();
      return encontrado!;
    }

    it('levanta el popup al pulsar Modificación en una solicitud ya enviada', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      abrirModificacion(raiz).click();
      fixture.detectChanges();

      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      expect(dialogo.getAttribute('aria-modal')).toBe('true');
      expect(dialogo.textContent).toContain('Estrategia de Modificación del IGA');
      expect(dialogo.textContent).toContain('Expediente de Referencia: MINEM-2025-08811');
      expect(dialogo.textContent).toContain('Modificación Significativa');
      expect(dialogo.textContent).toContain('Modificación No Significativa');
    });

    it('la modificación significativa reabre el formulario IGA sobre el expediente', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      abrirModificacion(raiz).click();
      fixture.detectChanges();
      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      opcionDelPopup(dialogo, 'Modificación Significativa').click();
      await fixture.whenStable();

      const router = TestBed.inject(Router);
      expect(router.url).toContain('/formulario-iga');
      expect(router.url).toContain('ref=MINEM-2025-08811');
      expect(router.url).toContain('tipo=SIGNIFICATIVA');
      expect(router.url).toContain('modo=EDICION');
      // La cabecera del formulario no debe heredar un borrador ajeno.
      expect(store.formulario().numeroExpediente).toBe('MINEM-2025-08811');
      // Reabrir para modificar es edición plena: candado apagado.
      expect(store.modoSoloConsulta()).toBe(false);
    });

    it('la opción ITS revela la alerta técnica y confirma la apertura del derivado', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      abrirModificacion(raiz).click();
      fixture.detectChanges();
      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      const totalPrevio = store.expedientes().length;

      opcionDelPopup(dialogo, 'No Significativa').click();
      fixture.detectChanges();
      expect(dialogo.textContent).toContain('creará y aperturará un nuevo expediente tipo ITS');

      opcionDelPopup(dialogo, 'Confirmar Creación de ITS').click();
      fixture.detectChanges();

      expect(raiz.querySelector('[role="dialog"]')).toBeNull();
      expect(store.expedientes().length).toBe(totalPrevio + 1);
      const derivado = store.expedientes().at(-1);
      expect(derivado?.tipoIga).toBe('ITS');
      expect(derivado?.estado).toBe('Borrador');
      expect(derivado?.numeroExpediente).toMatch(/^ITS-\d{4}-\d{3}$/);

      // El aviso da visibilidad al hito recién creado dentro de la vista.
      const aviso = elemento<HTMLElement>(raiz, '.aviso-its');
      expect(aviso.textContent).toContain(derivado?.numeroExpediente);
      expect(aviso.textContent).toContain('MINEM-2025-08811');
    });

    it('reabre el popup con la alerta de ITS colapsada y cierra sin rastro', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      abrirModificacion(raiz).click();
      fixture.detectChanges();
      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      opcionDelPopup(dialogo, 'No Significativa').click();
      fixture.detectChanges();
      expect(dialogo.textContent).toContain('creará y aperturará un nuevo expediente tipo ITS');

      opcionDelPopup(dialogo, 'Cerrar').click();
      fixture.detectChanges();
      expect(raiz.querySelector('[role="dialog"]')).toBeNull();

      // Reabrir vuelve a arrancar con la alerta colapsada.
      abrirModificacion(raiz).click();
      fixture.detectChanges();
      const reabierto = elemento<HTMLElement>(raiz, '[role="dialog"]');
      expect(reabierto.textContent).toContain('Expediente de Referencia: MINEM-2025-08811');
      expect(reabierto.textContent).not.toContain('creará y aperturará');
    });
  });

  /* ------------------------------------------------------------------
     CATÁLOGO DE COMUNICACIONES Y OBLIGACIONES POSTERIORES
     ------------------------------------------------------------------
     El botón «Comunicaciones» de una solicitud ya enviada abre el catálogo
     maestro filtrado por el estado aprobado. La matriz ID_NOTA / Descripción
     / Artículo es de solo lectura; el único control es su buscador interno.
     ------------------------------------------------------------------ */
  describe('Catálogo de comunicaciones posteriores', () => {
    /** Abre el catálogo desde la fila del expediente aprobado de referencia. */
    function abrirComunicaciones(raiz: HTMLElement): HTMLButtonElement {
      const filas = Array.from(
        elemento<HTMLTableElement>(raiz, 'table').querySelectorAll('tbody tr'),
      );
      const aprobado = filas.find((fila) =>
        fila.textContent?.includes('Recuperación Pampa Blanca'),
      );
      expect(aprobado).toBeDefined();

      const boton = Array.from(aprobado!.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidato) => candidato.textContent?.includes('Comunicaciones'),
      );
      expect(boton).toBeDefined();
      return boton!;
    }

    it('abre el catálogo con la maestra completa y sin campos editables', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      abrirComunicaciones(raiz).click();
      fixture.detectChanges();

      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      expect(dialogo.getAttribute('aria-modal')).toBe('true');
      expect(dialogo.textContent).toContain('Comunicaciones y Obligaciones Posteriores');
      expect(dialogo.textContent).toContain('Expediente Origen: MINEM-2025-08811');
      // Alerta obligatoria del filtrado por estado de la solicitud de referencia.
      expect(dialogo.textContent).toContain('filtrado automáticamente');
      expect(dialogo.textContent).toContain('"APROBADO"');
      // Fila representativa de la maestra legal.
      expect(dialogo.textContent).toContain('Comunicación de Cierre Final de Actividades');
      expect(dialogo.textContent).toContain('41°');

      // Las 21 notas de la maestra; la matriz no admite edición en línea.
      const filas = Array.from(dialogo.querySelectorAll('tbody tr'));
      expect(filas.length).toBe(21);
      expect(dialogo.querySelector('table input')).toBeNull();
    });

    it('filtra el catálogo por descripción y por articulado en tiempo real', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();
      abrirComunicaciones(raiz).click();
      fixture.detectChanges();

      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      const campo = elemento<HTMLInputElement>(dialogo, 'input');
      campo.value = 'cierre';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      const porDescripcion = Array.from(dialogo.querySelectorAll('tbody tr'));
      expect(porDescripcion.length).toBe(2);
      expect(dialogo.textContent).toContain('Comunicación de Cierre Final de Actividades');
      expect(dialogo.textContent).toContain('Excepción del Cierre Final');

      campo.value = '136°';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      const porArticulo = Array.from(dialogo.querySelectorAll('tbody tr'));
      expect(porArticulo.length).toBe(1);
      expect(dialogo.textContent).toContain('Ampliación de Plazo de Observaciones');
    });

    it('inicia un trámite derivado y lo reafirma con un aviso dentro de la vista', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();
      abrirComunicaciones(raiz).click();
      fixture.detectChanges();

      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      elemento<HTMLButtonElement>(dialogo, 'tbody tr button').click();
      fixture.detectChanges();

      expect(raiz.querySelector('[role="dialog"]')).toBeNull();
      const aviso = elemento<HTMLElement>(raiz, '.aviso-comunicacion');
      expect(aviso.textContent).toContain('Obligación Posterior N° 1.00');
      expect(aviso.textContent).toContain('Comunicación de Responsabilidad del Titular');
      expect(aviso.textContent).toContain('MINEM-2025-08811');
    });

    it('cierra el catálogo con el botón de pie sin abrir ningún trámite', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();
      abrirComunicaciones(raiz).click();
      fixture.detectChanges();

      const dialogo = elemento<HTMLElement>(raiz, '[role="dialog"]');
      const cerrar = Array.from(dialogo.querySelectorAll<HTMLButtonElement>('button')).find(
        (boton) => boton.textContent?.includes('Cerrar Catálogo'),
      );
      expect(cerrar).toBeDefined();
      cerrar?.click();
      fixture.detectChanges();

      expect(raiz.querySelector('[role="dialog"]')).toBeNull();
      expect(raiz.querySelector('.aviso-comunicacion')).toBeNull();
    });
  });

  describe('Descarga del expediente consolidado en PDF', () => {
    /** Pulsa el botón Imprimir de la fila del expediente aprobado de referencia. */
    function botonImprimir(raiz: HTMLElement): HTMLButtonElement {
      const filas = Array.from(
        elemento<HTMLTableElement>(raiz, 'table').querySelectorAll('tbody tr'),
      );
      const aprobado = filas.find((fila) =>
        fila.textContent?.includes('Recuperación Pampa Blanca'),
      );
      expect(aprobado).toBeDefined();

      const boton = Array.from(aprobado!.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidato) => candidato.textContent?.includes('Imprimir'),
      );
      expect(boton).toBeDefined();
      return boton!;
    }

    /**
     * Pulsa Imprimir y espera la tarea que `imprimir()` programa antes del
     * diálogo: el informe queda montado una macrotarea después del clic.
     */
    async function pulsarImpresion(raiz: HTMLElement): Promise<void> {
      botonImprimir(raiz).click();
      await new Promise((resolver) => setTimeout(resolver, 0));
    }

    it('monta el informe consolidado con las 26 fichas visibles de los siete capítulos', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      const original = window.print;
      window.print = () => void 0;
      try {
        await pulsarImpresion(raiz);
        fixture.detectChanges();
      } finally {
        window.print = original;
      }

      const informe = elemento<HTMLElement>(raiz, 'app-reporte-impresion');
      expect(informe.textContent).toContain('Expediente Consolidado del IGA');
      expect(informe.textContent).toContain('MINEM-2025-08811');
      expect(informe.textContent).toContain('Recuperación Pampa Blanca');
      expect(informe.textContent).toContain('AISD');
      expect(informe.querySelectorAll('.reporte-capitulo').length).toBe(7);
      expect(informe.querySelectorAll('.reporte-seccion').length).toBe(26);
      // Las sub-capas 5.2.1 y 5.2.2 quedan absorbidas por la 5.2.
      expect(informe.ownerDocument?.getElementById('reporte-seccion-5.2.1')).toBeNull();
      expect(informe.ownerDocument?.getElementById('reporte-seccion-5.2.2')).toBeNull();
    });

    it('apila cada sección con su encabezado oficial y su ficha proyectada', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      const original = window.print;
      window.print = () => void 0;
      try {
        await pulsarImpresion(raiz);
        fixture.detectChanges();
      } finally {
        window.print = original;
      }

      const informe = elemento<HTMLElement>(raiz, 'app-reporte-impresion');
      const secciones = Array.from(informe.querySelectorAll<HTMLElement>('.reporte-seccion'));

      expect(secciones.length).toBeGreaterThan(0);
      for (const seccion of secciones) {
        expect(seccion.querySelector('h3')?.textContent?.trim().length).toBeGreaterThan(0);
        expect(seccion.textContent?.trim().length).toBeGreaterThan(0);
      }
      expect(informe.textContent).toContain('Sección 1.1 ·');
      expect(informe.textContent).toContain('Sección 2.5 ·');
      expect(informe.textContent).toContain('Sección 7.1 ·');
    });

    it('dispara el diálogo nativo y desmonta el informe cuando termina la impresión', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      const imprimir = vi.fn();
      const original = window.print;
      window.print = imprimir;
      try {
        await pulsarImpresion(raiz);
        fixture.detectChanges();

        expect(imprimir).toHaveBeenCalledTimes(1);
        expect(raiz.querySelector('app-reporte-impresion')).not.toBeNull();

        // Al imprimir o cancelar, el navegador emite `afterprint` y el informe
        // se desmonta para no dejar 26 fichas vivas en el fondo de la consola.
        window.dispatchEvent(new Event('afterprint'));
        fixture.detectChanges();
        expect(raiz.querySelector('app-reporte-impresion')).toBeNull();
      } finally {
        window.print = original;
      }
    });

    it('enciende el candado de solo lectura mientras se imprime', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      const original = window.print;
      window.print = () => void 0;
      try {
        await pulsarImpresion(raiz);
        fixture.detectChanges();

        expect(store.modoSoloConsulta()).toBe(true);
      } finally {
        window.print = original;
      }
    });

    it('deja el informe y sus fichas en candado de solo lectura', async () => {
      const { fixture, store, raiz } = await montar();
      store.filtrar({ numeroExpediente: 'MINEM-2025-08811' });
      fixture.detectChanges();

      const original = window.print;
      window.print = () => void 0;
      try {
        await pulsarImpresion(raiz);
        fixture.detectChanges();

        const informe = elemento<HTMLElement>(raiz, 'app-reporte-impresion');
        const seccionReporte = elemento<HTMLElement>(informe, '.reporte-impresion');
        expect(seccionReporte.classList.contains('modo-lectura')).toBe(true);

        const botones = Array.from(seccionReporte.querySelectorAll<HTMLButtonElement>('button'));
        expect(botones.length).toBeGreaterThan(0);
        for (const boton of botones) {
          expect(boton.hidden).toBe(true);
        }

        for (const control of Array.from(
          seccionReporte.querySelectorAll<HTMLInputElement>('input, select, textarea'),
        )) {
          expect(control.disabled).toBe(true);
        }
      } finally {
        window.print = original;
      }
    });
  });
});
