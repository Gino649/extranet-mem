import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { FormularioIgaComponent } from './formulario-iga.component';
import { DaexStore } from '../../state/daex.store';
import { routes } from '../../app.routes';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

describe('FormularioIgaComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioIgaComponent],
      providers: [provideRouter(routes, withComponentInputBinding())],
    }).compileComponents();
  });

  async function montar() {
    const fixture = TestBed.createComponent(FormularioIgaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const store = TestBed.inject(DaexStore);
    store.inyectarSesion('20501234567', 'token', 'Titular Minero 20501234567');
    fixture.detectChanges();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  /** Encoge el fixture a lo único que necesita este archivo. */
  interface FixtureLike {
    detectChanges(): void;
  }

  /** Enlaces del índice lateral; desde la depuración solo hay capítulos. */
  function capitulosDelIndice(raiz: HTMLElement): HTMLAnchorElement[] {
    return Array.from(raiz.querySelectorAll('a.capitulo-boton')) as HTMLAnchorElement[];
  }

  /** Las 28 secciones del árbol, incluidas las dos sub-capas del capítulo 5. */
  function todasLasSecciones(store: DaexStore) {
    return store
      .capitulos()
      .flatMap((capitulo) => capitulo.secciones.flatMap((seccion) => [seccion, ...seccion.hijos]));
  }

  /** Deja el semáforo entero en verde, para partir de un DAEX limpio. */
  function ponerTodoEnVerde(store: DaexStore): void {
    for (const seccion of todasLasSecciones(store)) {
      store.fijarEstadoSeccion(seccion.id, 'Verde');
    }
  }

  /** Cierra todas las actas abiertas: el expediente vuelve a ser un DAEX nuevo. */
  function cerrarActas(store: DaexStore): void {
    store.cerrarSolicitudInformacionComplementaria();
    for (const seccion of todasLasSecciones(store)) {
      store.marcarObservada(seccion.id, false);
    }
  }

  describe('Cabecera inmutable del trámite', () => {
    it('muestra nombre del proyecto, unidad y tipo de instrumento', async () => {
      const { fixture, store, raiz } = await montar();
      store.editarExpediente(store.expedientes()[0]!);
      fixture.detectChanges();

      const texto = elemento<HTMLElement>(raiz, 'header').textContent ?? '';
      expect(texto).toContain('Expansión San Andrés');
      expect(texto).toContain('Unidad Minera San Andrés');
      expect(texto).toContain('DAEX');
    });

    it('avisa que el expediente aún no tiene número asignado', async () => {
      const { fixture, store, raiz } = await montar();
      store.iniciarFormularioNuevo('DAEX');
      fixture.detectChanges();

      expect(elemento<HTMLElement>(raiz, 'header').textContent).toContain('aún sin número');
    });

    it('muestra el número del expediente cuando ya fue asignado', async () => {
      const { fixture, store, raiz } = await montar();
      const expediente = store.expedientes()[0]!;
      store.editarExpediente(expediente);
      fixture.detectChanges();

      const texto = elemento<HTMLElement>(raiz, 'header').textContent ?? '';
      expect(texto).toContain(expediente.numeroExpediente);
      expect(texto).not.toContain('aún sin número');
    });
  });

  describe('Guardián de semáforos', () => {
    it('bloquea el envío mientras exista una sección sin terminar', async () => {
      const { fixture, store, raiz } = await montar();
      cerrarActas(store);
      fixture.detectChanges();

      const boton = elemento<HTMLButtonElement>(raiz, '.boton-envio');
      expect(store.estadoRemision()).toBe('NUEVO');
      expect(boton.disabled).toBe(true);
      expect(boton.classList.contains('boton-envio--bloqueado')).toBe(true);
      expect(boton.getAttribute('title')).toContain('siguen pendientes');
    });

    it('habilita el envío solo con las 28 secciones en verde', async () => {
      const { fixture, store, raiz } = await montar();

      cerrarActas(store);
      ponerTodoEnVerde(store);
      fixture.detectChanges();

      expect(store.puedeRemitir()).toBe(true);
      expect(store.seccionesPendientes()).toHaveLength(0);
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').disabled).toBe(false);
    });

    it('vuelve a bloquear si una sola sección vuelve a gris', async () => {
      const { fixture, store } = await montar();
      cerrarActas(store);
      ponerTodoEnVerde(store);
      fixture.detectChanges();
      expect(store.puedeRemitir()).toBe(true);

      store.fijarEstadoSeccion('SEC-7.1', 'Gris');
      fixture.detectChanges();
      expect(store.puedeRemitir()).toBe(false);
    });

    it('calcula el avance sobre las 28 secciones', async () => {
      const { store } = await montar();
      expect(store.totalSecciones()).toBe(28);
      // La semilla trae 5 secciones en verde.
      expect(store.avanceExpediente()).toBe(Math.round((5 / 28) * 100));
    });
  });

  /* ------------------------------------------------------------------
     ETAPA DE LA REMISIÓN
     ------------------------------------------------------------------
     El botón de la cabecera no es un envío con nombre fijo: manda el DAEX
     nuevo, las subsanaciones o la respuesta a un pedido del MINEM, y el
     rótulo lo dice para que el titular no tenga que deducirlo del semáforo.
     ------------------------------------------------------------------ */
  describe('Rótulo y guardián por etapa de remisión', () => {
    it('anuncia el envío del DAEX mientras no haya actas abiertas', async () => {
      const { fixture, store, raiz } = await montar();
      cerrarActas(store);
      ponerTodoEnVerde(store);
      fixture.detectChanges();

      expect(store.estadoRemision()).toBe('NUEVO');
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').textContent).toContain(
        'Enviar al MINEM',
      );
    });

    it('cambia a subsanación en cuanto hay una sección observada', async () => {
      const { fixture, store, raiz } = await montar();
      store.marcarObservada('2.7', true);
      fixture.detectChanges();

      expect(store.estadoRemision()).toBe('OBSERVADO');
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').textContent).toContain(
        'Enviar subsanación',
      );
    });

    it('anuncia la información complementaria cuando el MINEM la pide', async () => {
      const { fixture, store, raiz } = await montar();
      store.solicitarInformacionComplementaria();
      fixture.detectChanges();

      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').textContent).toContain(
        'Enviar información complementaria',
      );
    });

    it('exige el expediente completo verde en un DAEX nuevo', async () => {
      const { fixture, store, raiz } = await montar();
      cerrarActas(store);
      fixture.detectChanges();

      expect(store.estadoRemision()).toBe('NUEVO');
      expect(store.puedeRemitir()).toBe(false);
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').disabled).toBe(true);
    });

    /**
     * El caso que distingue esta regla de la anterior.
     *
     * Observado, lo que se manda son subsanaciones: exigir las 28 secciones en
     * verde bloquearía al titular que solo tiene que responder al acta.
     */
    it('basta con responder el acta, sin dejar el resto del expediente completo', async () => {
      const { fixture, store, raiz } = await montar();
      store.marcarObservada('2.7', true);
      fixture.detectChanges();
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').disabled).toBe(true);

      for (const obs of store.observacionesDeSeccion('2.7')) {
        store.abrirCajaTextoSubsanarFila('2.7', obs.id);
        store.procesarGuardarSubsanacionFila('2.7', obs.id, 'Evidencia adjunta.');
      }
      fixture.detectChanges();

      expect(store.puedeRemitir()).toBe(true);
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').disabled).toBe(false);
    });

    it('deja el botón habilitado con información complementaria', async () => {
      const { fixture, store, raiz } = await montar();
      store.solicitarInformacionComplementaria();
      fixture.detectChanges();

      expect(store.puedeRemitir()).toBe(true);
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').disabled).toBe(false);
    });

    it('vuelve a la etapa real al cerrar el pedido del MINEM', async () => {
      const { fixture, store, raiz } = await montar();
      store.solicitarInformacionComplementaria();
      fixture.detectChanges();
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').textContent).toContain(
        'información complementaria',
      );

      store.cerrarSolicitudInformacionComplementaria();
      fixture.detectChanges();
      expect(elemento<HTMLButtonElement>(raiz, '.boton-envio').textContent).not.toContain(
        'información complementaria',
      );
    });

    it('registra la remisión de la etapa vigente sin adelantarla', async () => {
      const { store } = await montar();
      store.solicitarInformacionComplementaria();

      expect(store.registrarRemision()).toBe(true);
      expect(store.ultimaRemision('INFORMACION_COMPLEMENTARIA')).toBeTruthy();
      expect(store.ultimaRemision('OBSERVADO')).toBeNull();
      // La siguiente etapa la declara el MINEM al revisar lo recibido.
      expect(store.estadoRemision()).toBe('INFORMACION_COMPLEMENTARIA');
    });

    it('no registra una remisión cuando el guardián de la etapa no se cumple', () => {
      const store = TestBed.inject(DaexStore);
      cerrarActas(store);
      expect(store.registrarRemision()).toBe(false);
      expect(store.ultimaRemision('NUEVO')).toBeNull();
    });
  });

  /* ------------------------------------------------------------------
     LEYENDA DEL SEMÁFORO
     ------------------------------------------------------------------ */

  describe('Leyenda del semáforo', () => {
    it('explica el significado de cada color', async () => {
      const { raiz } = await montar();
      const leyenda = elemento<HTMLElement>(raiz, '.leyenda-semaforo');
      const texto = leyenda.textContent ?? '';

      expect(leyenda.querySelectorAll('.circulo-semaforo-leyenda')).toHaveLength(4);
      expect(texto).toContain('Sin completar');
      expect(texto).toContain('Subsanado');
      expect(texto).toContain('Validado');
      expect(texto).toContain('Observado por el Evaluador Institucional');
    });

    /**
     * El ámbar no entra en la leyenda.
     *
     * No es un estado del expediente sino la marca de que el capítulo abierto
     * está en gris; anotarlo haría creer que existe una quinta situación de
     * validación que el sistema nunca alcanza.
     */
    it('no inventa un estado para el ámbar de capítulo en edición', async () => {
      const { raiz } = await montar();
      const leyenda = elemento<HTMLElement>(raiz, '.leyenda-semaforo');

      expect(leyenda.querySelector('.semaforo-ambar')).toBeNull();
    });

    it('marca en ámbar solo el capítulo abierto que sigue en gris', async () => {
      const { fixture, store, raiz } = await montar();
      store.seleccionarCapitulo('2');
      fixture.detectChanges();

      // El 2 es rojo por el acta de la 2.7, así que no lleva ámbar aunque esté
      // abierto: el ámbar es para el capítulo en gris, no un sustituto del rojo.
      expect(capitulosDelIndice(raiz)[1]?.querySelector('.semaforo-ambar')).toBeNull();

      store.seleccionarCapitulo('5');
      fixture.detectChanges();
      expect(capitulosDelIndice(raiz)[4]?.querySelector('.semaforo-ambar')).toBeTruthy();
      expect(capitulosDelIndice(raiz)[0]?.querySelector('.semaforo-ambar')).toBeNull();
    });
  });

  describe('Índice de capítulos', () => {
    it('expone los siete capítulos oficiales con su orden intacto', async () => {
      const { store } = await montar();

      expect(store.capitulos().map((capitulo) => capitulo.numero)).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
      ]);
    });

    it('conserva el número exacto de submenús de cada capítulo', async () => {
      const { store } = await montar();

      expect(
        store.capitulos().map((capitulo) => [capitulo.numero, capitulo.secciones.length]),
      ).toEqual([
        ['1', 3],
        ['2', 11],
        ['3', 4],
        ['4', 2],
        ['5', 3],
        ['6', 2],
        ['7', 1],
      ]);
      expect(store.totalSecciones()).toBe(28);
    });

    it('anida las dos sub-capas de influencia dentro de 5.2', async () => {
      const { store } = await montar();
      const seccion = store.capitulos()[4]?.secciones[1];

      expect(seccion?.numero).toBe('5.2');
      expect(seccion?.hijos.map((hijo) => hijo.numero)).toEqual(['5.2.1', '5.2.2']);
    });

    it('renderiza los títulos del estado, no los de la plantilla', async () => {
      const { raiz } = await montar();

      for (const capitulo of TestBed.inject(DaexStore).capitulos()) {
        expect(raiz.textContent).toContain(capitulo.titulo);
      }
    });
  });

  describe('Índice depurado de capítulos', () => {
    it('lista exactamente los siete capítulos principales', async () => {
      const { raiz } = await montar();
      const enlaces = capitulosDelIndice(raiz);

      expect(enlaces).toHaveLength(7);
      expect(enlaces.map((enlace) => enlace.textContent?.trim())).toEqual(
        TestBed.inject(DaexStore)
          .capitulos()
          .map((capitulo) => `${capitulo.numero}${capitulo.titulo}`),
      );
    });

    it('no renderiza ningún subenlace numérico de sección', async () => {
      const { raiz } = await montar();
      const aside = elemento<HTMLElement>(raiz, 'aside');

      // Sin cascada: ni anclas de sección ni números con punto decimal.
      expect(aside.querySelectorAll('a.seccion-enlace')).toHaveLength(0);
      expect(aside.querySelectorAll('.capitulo-secciones')).toHaveLength(0);
      expect(aside.querySelectorAll('.capitulo-caret')).toHaveLength(0);
      expect(aside.textContent).not.toMatch(/\d+\.\d+/);
    });

    it('conserva los 28 submenús en el store aunque no se pinten', async () => {
      const { store } = await montar();

      // La granularidad fina no se pierde: solo deja de duplicarse en el índice.
      expect(store.totalSecciones()).toBe(28);
      expect(store.seccionPorNumero('2.11')?.titulo).toBeTruthy();
    });

    it('navega a la ruta del capítulo desde cada fila del índice', async () => {
      const { raiz } = await montar();

      expect(capitulosDelIndice(raiz).map((enlace) => enlace.getAttribute('href'))).toEqual([
        '/formulario-iga/1',
        '/formulario-iga/2',
        '/formulario-iga/3',
        '/formulario-iga/4',
        '/formulario-iga/5',
        '/formulario-iga/6',
        '/formulario-iga/7',
      ]);
    });

    it('resalta el capítulo que el orquestador está apilando', async () => {
      const { fixture, store, raiz } = await montar();

      // El store arranca en el capítulo 1: solo esa fila debe estar resaltada.
      expect(capitulosDelIndice(raiz)[0]?.className).toContain('capitulo-boton--activo');

      store.seleccionarCapitulo('5');
      fixture.detectChanges();

      expect(capitulosDelIndice(raiz)[4]?.className).toContain('capitulo-boton--activo');
      expect(capitulosDelIndice(raiz)[0]?.className).not.toContain('capitulo-boton--activo');
      expect(capitulosDelIndice(raiz)[4]?.getAttribute('aria-current')).toBe('true');
    });

    it('rechaza un índice de sección inexistente sin romper el semáforo', async () => {
      const { store } = await montar();
      const estadoPrevio = store.seccionPorNumero('1.1')?.estado;

      expect(store.actualizarEstadoSeccion('9.9', 'VERDE')).toBe(false);
      expect(store.seccionPorNumero('1.1')?.estado).toBe(estadoPrevio);
    });

    it('ignora un capítulo inexistente sin desplazar el capítulo activo', async () => {
      const { store } = await montar();
      store.seleccionarCapitulo('3');

      store.seleccionarCapitulo('9');
      expect(store.capituloSeleccionadoId()).toBe('3');
    });

    it('colapsa el índice con el botón del menú', async () => {
      const { fixture, raiz } = await montar();
      const menu = elemento<HTMLElement>(raiz, 'aside');
      expect(menu.classList.contains('menu-lateral--abierto')).toBe(true);

      elemento<HTMLButtonElement>(raiz, 'aside button').click();
      fixture.detectChanges();
      expect(menu.classList.contains('menu-lateral--cerrado')).toBe(true);
    });
  });

  describe('Vía de escape al workspace', () => {
    it('ofrece el botón de retorno antes del rótulo del proyecto', async () => {
      const { raiz, store } = await montar();
      const cabecera = elemento<HTMLElement>(raiz, 'header');
      const boton = elemento<HTMLButtonElement>(
        cabecera,
        'button[aria-label="Volver al listado de solicitudes"]',
      );

      // El botón precede al bloque del proyecto: es navegación, no un metadato.
      expect(cabecera.firstElementChild?.contains(boton)).toBe(true);
      expect(boton.textContent).toContain('←');
      expect(cabecera.textContent).toContain(store.formulario().nombreProyecto);
    });

    it('navega a la bandeja principal', async () => {
      const { fixture, raiz } = await montar();
      const router = TestBed.inject(Router);

      elemento<HTMLButtonElement>(
        raiz,
        'button[aria-label="Volver al listado de solicitudes"]',
      ).click();
      await fixture.whenStable();

      // Navegación real contra las rutas de la app, sin espiar el router: se
      // comprueba el destino en lugar de la llamada.
      expect(router.url).toBe('/workspace');
    });

    it('conserva el borrador al abandonar la edición', async () => {
      const { fixture, raiz, store } = await montar();
      store.actualizarEstadoSeccion('1.2', 'VERDE');

      elemento<HTMLButtonElement>(
        raiz,
        'button[aria-label="Volver al listado de solicitudes"]',
      ).click();
      await fixture.whenStable();

      // Volver no descarta el trabajo ya hecho: el abandono del borrador es una
      // acción distinta y deliberada, no un efecto secundario de navegar.
      expect(store.seccionPorNumero('1.2')?.estado).toBe('Verde');
    });
  });

  describe('Continuidad vertical del layout', () => {
    it('fija la raíz a pantalla completa y delega el scroll al panel derecho', async () => {
      const { raiz } = await montar();
      const raizContenedor = elemento<HTMLElement>(raiz, 'div');
      const aside = elemento<HTMLElement>(raiz, 'aside');
      const panel = elemento<HTMLElement>(raiz, 'main');

      expect(raizContenedor.className).toContain('h-screen');
      expect(raizContenedor.className).toContain('overflow-hidden');
      expect(aside.className).toContain('justify-between');
      expect(aside.className).toContain('overflow-y-auto');
      expect(aside.className).toContain('border-r');
      expect(panel.className).toContain('overflow-y-auto');
    });

    it('deja el alto en manos del flexbox y no en un cálculo de vh', async () => {
      const { raiz } = await montar();
      const aside = elemento<HTMLElement>(raiz, 'aside');
      const panel = elemento<HTMLElement>(raiz, 'main');

      /*
       * `h-[calc(100vh-8rem)]` duplicaba la medida que el flexbox ya resuelve y
       * era la fuente del recorte en laptop: `100vh` no descuenta la barra del
       * navegador ni las herramientas de desarrollo, así que la caja podía
       * medir más que su hueco y la raíz `overflow-hidden` cortaba el final del
       * panel sin dejar scroll. `min-h-0` es lo que permite encolhejar.
       */
      for (const caja of [aside, panel]) {
        expect(caja.className).not.toContain('100vh');
        expect(caja.className).not.toContain('h-[');
        expect(caja.className).toContain('min-h-0');
      }
      expect(elemento<HTMLElement>(raiz, 'main').className).toContain('flex-1');
    });

    it('escala el relleno del panel en vez de fijarlo', async () => {
      const { raiz } = await montar();
      const relleno = elemento<HTMLElement>(raiz, 'main').className;

      // `p-8` fijo dejaba el panel de edición demasiado estrecho en una laptop
      // de 1366 px, donde el índice lateral ya se come 288 px.
      expect(relleno).toContain('p-4');
      expect(relleno).toContain('sm:p-6');
      expect(relleno).toContain('xl:p-8');
    });

    it('encaja cabecera y cuerpo en la raíz de pantalla completa', async () => {
      const { raiz } = await montar();
      const raizContenedor = elemento<HTMLElement>(raiz, 'div');
      const cabecera = elemento<HTMLElement>(raiz, 'header');
      const cuerpo = cabecera.nextElementSibling as HTMLElement;

      // El reparto de altura lo resuelve el flexbox, no alturas fijas por bloque.
      expect(cabecera.className).toContain('cabecera');
      expect(raizContenedor.contains(cabecera)).toBe(true);
      expect(cuerpo.className).toContain('flex-1');
      expect(cuerpo.className).toContain('min-h-0');
    });
  });

  describe('Contenedor dinámico', () => {
    it('expone un router-outlet para montar el orquestador de capítulo', async () => {
      const { raiz } = await montar();
      expect(raiz.querySelector('router-outlet')).toBeTruthy();
    });

    it('el aside monta el índice del expediente y no la grilla de la bandeja', async () => {
      const { raiz } = await montar();
      const menu = elemento<HTMLElement>(raiz, 'aside');

      expect(menu.querySelector('table')).toBeNull();
      expect(menu.textContent).toContain('Expediente DAEX');
      expect(menu.textContent).toContain('Información General');
      expect(menu.textContent).not.toContain('Listado Solicitudes');
    });
  });

  /* ------------------------------------------------------------------
     CIERRE DEL EXPEDIENTE · Cortina de transmisión y acuse de recibo
     ------------------------------------------------------------------
     El envío levanta una cortina de espera, estampa un acuse con ficha
     técnica institucional y regresa a la bandeja. La remisión se registra
     solo cuando la transmisión concluye: un abandono a mitad de envío deja
     el store diciendo que nada se ha mandado.
     ------------------------------------------------------------------ */
  describe('Cierre del expediente: cortina de espera y acuse', () => {
    it('no pinta la cortina ni el acuse cuando el guardián sigue bloqueando', async () => {
      const { fixture, store, raiz } = await montar();
      cerrarActas(store);
      fixture.detectChanges();

      const boton = elemento<HTMLButtonElement>(raiz, '.boton-envio');
      expect(boton.disabled).toBe(true);

      boton.click();
      fixture.detectChanges();

      expect(raiz.querySelector('.cortina-transmision')).toBeNull();
      expect(raiz.querySelector('.modal-acuse')).toBeNull();
      expect(store.ultimaRemision('NUEVO')).toBeNull();
    });

    /*
     * Es la única prueba con reloj real de toda la suite: el retardo de 3,5 s
     * es una decisión de presentación del módulo, y la cortina existe para que
     * no se confunda con la espera real de red. Comprobar que la remisión no
     * se registra hasta que la transmisión concluye exige dejarla correr.
     */
    it('levanta la cortina, remite al concluir y estampa el acuse al volver a la bandeja', async () => {
      const { fixture, store, raiz } = await montar();
      cerrarActas(store);
      ponerTodoEnVerde(store);
      fixture.detectChanges();

      const boton = elemento<HTMLButtonElement>(raiz, '.boton-envio');
      expect(boton.disabled).toBe(false);

      boton.click();
      fixture.detectChanges();

      // La cortina tapa la pantalla y, todavía, ni acuse ni remisión.
      expect(elemento<HTMLElement>(raiz, '.cortina-transmision')).toBeTruthy();
      expect(raiz.querySelector('.modal-acuse')).toBeNull();
      expect(store.ultimaRemision('NUEVO')).toBeNull();

      // Dejar terminar la transmisión simulada de 3,5 segundos.
      await new Promise((resolver) => setTimeout(resolver, 3600));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(raiz.querySelector('.cortina-transmision')).toBeNull();
      expect(store.ultimaRemision('NUEVO')).toBeTruthy();

      // El acuse trae la ficha técnica con las marcas del servidor.
      const acuse = elemento<HTMLElement>(raiz, '.modal-acuse');
      const texto = acuse.textContent ?? '';
      expect(texto).toContain('Solicitud Enviada con Éxito');
      expect(texto).toMatch(/EXP-\d{6}-20\d{2}-DGAAM/);
      expect(texto).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(texto).toContain('EN EVALUACIÓN TÉCNICA');

      // Confirmar el acuse cierra el modal y regresa a la bandeja.
      elemento<HTMLButtonElement>(acuse, 'button').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(raiz.querySelector('.modal-acuse')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/workspace');
    });
  });
});
