import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObservacionesEvaluadorComponent } from './observaciones-evaluador.component';
import { DaexStore } from '../../../../state/daex.store';

describe('ObservacionesEvaluadorComponent', () => {
  /**
   * Levanta el motor con la sección que se le pase.
   *
   * El store es real y el componente se monta suelto, sin el orquestador: este
   * archivo prueba la bandeja y nada más. Que el orquestador lo invoque donde
   * corresponde es otra prueba, y vivir en otra suite es lo que deja claro
   * cuál de las dos cosas se rompió cuando algo falla.
   */
  async function montar(numero = '2.7'): Promise<{
    fixture: ComponentFixture<ObservacionesEvaluadorComponent>;
    store: DaexStore;
  }> {
    const fixture = TestBed.createComponent(ObservacionesEvaluadorComponent);
    const store = TestBed.inject(DaexStore);
    fixture.componentRef.setInput('numero', numero);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  /** Suscribe un descargo y pulsa guardar en la primera fila pendiente. */
  async function subsanar(
    fixture: ComponentFixture<ObservacionesEvaluadorComponent>,
    descargo: string,
  ): Promise<void> {
    const bandeja = nodo<HTMLElement>(fixture, '.bloque-observaciones');
    botonEn(bandeja, 'Responder').click();
    fixture.detectChanges();
    nodo<HTMLTextAreaElement>(fixture, '.bloque-observaciones textarea').value = descargo;
    botonEn(bandeja, 'Guardar Subsanación').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Primer elemento que coincide con el selector, con mensaje si falta. */
  function nodo<T extends HTMLElement>(
    fixture: ComponentFixture<ObservacionesEvaluadorComponent>,
    selector: string,
  ): T {
    const encontrado = fixture.nativeElement.querySelector(selector) as T | null;
    if (!encontrado) {
      throw new Error(`No se encontró ${selector} en la plantilla del motor`);
    }
    return encontrado;
  }

  /** Igual, pero tolerante: `null` en vez de excepción. */
  function opcional<T extends HTMLElement>(
    fixture: ComponentFixture<ObservacionesEvaluadorComponent>,
    selector: string,
  ): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  /** Primer botón del subárbol cuyo texto contenga el fragmento. */
  function botonEn(raiz: HTMLElement, texto: string): HTMLButtonElement {
    const encontrado = Array.from<HTMLButtonElement>(raiz.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(texto),
    );
    if (!encontrado) {
      throw new Error(`No se encontró el botón «${texto}»`);
    }
    return encontrado;
  }

  /* ------------------------------------------------------------------
     BANDEJA DE OBSERVACIONES DEL EVALUADOR
     ------------------------------------------------------------------ */
  describe('bandeja de observaciones del evaluador', () => {
    it('abre el guardián con las dos glosas del acta', async () => {
      const { fixture } = await montar();
      const tarjeta = nodo<HTMLElement>(fixture, '.bloque-observaciones');
      expect(tarjeta.textContent).toContain('Guardián de Congruencia Normativa');
      expect(tarjeta.textContent).toContain('OBS-001');
      expect(tarjeta.textContent).toContain('OBS-002');
    });

    it('no dibuja nada en una sección sin observaciones', async () => {
      const { fixture, store } = await montar('2.5');
      expect(opcional(fixture, '.bloque-observaciones')).toBeNull();
      expect(store.observacionesDeSeccion('2.5')).toEqual([]);
    });

    /**
     * El caso que justifica toda la parametrización del store.
     *
     * Con el punterior global de «sección activa», dos motores montados a la vez
     * —el 2.7 y otra sección observada— mostrarían la misma bandeja, y el
     * titular subsanaría la observación equivocada creyendo que era la suya.
     */
    it('mantiene separadas las bandejas de dos secciones observadas a la vez', async () => {
      const { fixture, store } = await montar();
      const otra = await montar('2.8');
      store.registrarActaEvaluador('2.8', 'Debe adjuntar el balance hídrico firmado.');
      fixture.detectChanges();
      otra.fixture.detectChanges();

      expect(nodo<HTMLElement>(fixture, '.bloque-observaciones').textContent).toContain('OBS-001');
      const bloque = nodo<HTMLElement>(fixture, '.bloque-observaciones');
      expect(bloque.textContent).not.toContain('OBS-003');
      const bloqueOtra = nodo<HTMLElement>(otra.fixture, '.bloque-observaciones');
      expect(bloqueOtra.textContent).toContain('OBS-003');
      expect(bloqueOtra.textContent).not.toContain('OBS-001');
    });

    it('respeta el índice recibido y no la última bandeja solicitada', async () => {
      const { fixture, store } = await montar('2.5');
      store.registrarActaEvaluador('2.8', 'Debe adjuntar el balance hídrico firmado.');
      fixture.detectChanges();

      expect(opcional(fixture, '.bloque-observaciones')).toBeNull();
      expect(store.observacionesDeSeccion('2.5')).toEqual([]);
      expect(store.microComponenteEvaluadoDe('2.8')).not.toBeNull();
    });

    it('ninguna caja de descargo está abierta al entrar', async () => {
      const { fixture } = await montar();
      expect(opcional(fixture, '.bloque-observaciones textarea')).toBeNull();
    });

    it('abre el descargo de la fila que se responde y no el de otra', async () => {
      const { fixture } = await montar();
      const bandeja = nodo<HTMLElement>(fixture, '.bloque-observaciones');
      const botones = Array.from<HTMLButtonElement>(bandeja.querySelectorAll('button'));
      botones.find((b) => b.textContent?.includes('Responder'))?.click();
      fixture.detectChanges();
      expect(nodo<HTMLTextAreaElement>(fixture, '.bloque-observaciones textarea')).toBeTruthy();
      expect(nodo<HTMLElement>(fixture, '.bloque-observaciones').textContent).toContain('OBS-001');
    });

    it('explica en la tarjeta que hace falta el sustento, sin alert', async () => {
      const { fixture, store } = await montar();
      /**
       * `window.alert` se sustituye a mano en vez de con un espía: el runner es
       * Vitest y este archivo no importa sus API, así que un espía exigiría
       * meter `vi` en una suite que no lo usa en ningún otro punto.
       */
      const original = window.alert;
      let huboAlerta = false;
      window.alert = () => {
        huboAlerta = true;
      };
      try {
        const bandeja = nodo<HTMLElement>(fixture, '.bloque-observaciones');
        botonEn(bandeja, 'Responder').click();
        fixture.detectChanges();
        botonEn(bandeja, 'Guardar Subsanación').click();
        fixture.detectChanges();
      } finally {
        window.alert = original;
      }
      expect(huboAlerta).toBe(false);
      expect(nodo<HTMLElement>(fixture, '.aviso-evaluacion').textContent).toContain(
        'no puede quedar vacío',
      );
      expect(store.observacionesDeSeccion('2.7')[0].estado).toBe('PENDIENTE');
    });

    it('guarda el descargo, marca la fila y cierra la caja', async () => {
      const { fixture, store } = await montar();
      await subsanar(fixture, 'Se adjunta el plano del visor 2.5 con el conteo corregido.');
      const fila = store.observacionesDeSeccion('2.7')[0];
      expect(fila.estado).toBe('SUBSANADO');
      expect(fila.descargoSustento).toContain('plano del visor 2.5');
      expect(opcional(fixture, '.bloque-observaciones textarea')).toBeNull();
    });

    it('descarta el descargo si se cancela la caja', async () => {
      const { fixture, store } = await montar();
      const bandeja = nodo<HTMLElement>(fixture, '.bloque-observaciones');
      botonEn(bandeja, 'Responder').click();
      fixture.detectChanges();
      nodo<HTMLTextAreaElement>(fixture, '.bloque-observaciones textarea').value = 'texto tirado';
      botonEn(bandeja, 'Cancelar').click();
      fixture.detectChanges();
      expect(opcional(fixture, '.bloque-observaciones textarea')).toBeNull();
      expect(store.observacionesDeSeccion('2.7')[0].estado).toBe('PENDIENTE');
    });

    it('no vuelve a abrir el descargo de una fila ya subsanada', async () => {
      const { fixture } = await montar();
      await subsanar(fixture, 'Se corrige el conteo de sondajes.');
      const bandeja = nodo<HTMLElement>(fixture, '.bloque-observaciones');
      const respondidas = Array.from<HTMLButtonElement>(bandeja.querySelectorAll('button')).filter(
        (b) => b.textContent?.includes('Subsanado'),
      );
      expect(respondidas.length).toBe(1);
      expect(respondidas[0].disabled).toBe(true);
    });

    it('mantiene la sección en rojo mientras quede una observación colgada', async () => {
      const { store } = await montar();
      await subsanarPorStore(store, '2.7', 'Se adjunta el plano corregido.');
      expect(store.seccionPorNumero('2.7')?.estado).toBe('Rojo');
      expect(store.seccionPorNumero('2.7')?.observado).toBe(true);
    });

    it('pone la sección en azul cuando ya no queda ninguna colgada', async () => {
      const { store } = await montar();
      store.abrirCajaTextoSubsanarFila('2.7', 'OBS-001');
      store.procesarGuardarSubsanacionFila('2.7', 'OBS-001', 'Plano corregido.');
      store.abrirCajaTextoSubsanarFila('2.7', 'OBS-002');
      store.procesarGuardarSubsanacionFila('2.7', 'OBS-002', 'Justificación de PLA-02.');
      expect(store.observacionesDeSeccion('2.7').every((obs) => obs.estado === 'SUBSANADO')).toBe(
        true,
      );
      expect(store.seccionPorNumero('2.7')?.estado).toBe('Azul');
      expect(store.seccionPorNumero('2.7')?.observado).toBe(true);
    });

    it('enciende el semáforo del capítulo en rojo con la observación viva', async () => {
      const { fixture, store } = await montar();
      expect(store.estadoCapitulo('2')).toBe('Rojo');
      expect(store.capituloEnAlerta('2')).toBe(true);
      await subsanar(fixture, 'Se adjunta el plano corregido.');
      await subsanar(fixture, 'Se adjunta la justificación técnica.');
      expect(store.capituloEnAlerta('2')).toBe(false);
      expect(nodo<HTMLElement>(fixture, '.bloque-observaciones').textContent).toContain(
        '2 de 2 subsanadas',
      );
    });

    /* ----------------------------------------------------------------
       EL ENVÍO NO VIVE EN LA BANDEJA
       ---------------------------------------------------------------- */

    /**
     * La bandeja ya no despacha nada.
     *
     * Remitir es una decisión del expediente completo, no de una sección: por eso
     * el botón se mudó a la cabecera y este motor se quedó solo con responder.
     * Un botón aquí permitiría mandar un descargo suelto y creerse que se
     * envió la subsanación entera.
     */
    it('no ofrece ningún botón de remisión', async () => {
      const { fixture } = await montar();
      const bandeja = nodo<HTMLElement>(fixture, '.bloque-observaciones');
      const textos = Array.from(bandeja.querySelectorAll('button')).map((b) =>
        (b.textContent ?? '').trim(),
      );
      expect(textos.some((t) => t.includes('Enviar'))).toBe(false);
      expect(textos.some((t) => t.includes('Subsanaciones'))).toBe(false);
    });

    it('deja intacta la bandeja cuando el descargo es solo espacios', () => {
      const store = TestBed.inject(DaexStore);
      expect(store.procesarGuardarSubsanacionFila('2.7', 'OBS-001', '   ')).toBe(false);
      expect(store.observacionesDeSeccion('2.7')[0].estado).toBe('PENDIENTE');
    });

    it('no toca la bandeja de otra sección al guardar', () => {
      const store = TestBed.inject(DaexStore);
      store.registrarActaEvaluador('2.8', 'Debe adjuntar el balance hídrico firmado.');

      expect(store.procesarGuardarSubsanacionFila('2.8', 'OBS-003', 'Texto')).toBe(true);
      expect(store.observacionesDeSeccion('2.8')[0].estado).toBe('SUBSANADO');
      expect(store.observacionesDeSeccion('2.7')[0].estado).toBe('PENDIENTE');
    });
  });

  /** Guarda un descargo sin pasar por la interfaz. */
  function subsanarPorStore(store: DaexStore, seccion: string, descargo: string): void {
    store.abrirCajaTextoSubsanarFila(seccion, 'OBS-001');
    store.procesarGuardarSubsanacionFila(seccion, 'OBS-001', descargo);
  }
});