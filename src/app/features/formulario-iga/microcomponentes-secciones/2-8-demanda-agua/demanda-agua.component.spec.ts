import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DemandaAguaComponent } from './demanda-agua.component';
import { DaexStore, type FuenteAbastecimientoAgua } from '../../../../state/daex.store';

describe('DemandaAguaComponent', () => {
  /** Levanta el componente con el store real y la sección 2.8. */
  async function montar(): Promise<{
    fixture: ComponentFixture<DemandaAguaComponent>;
    store: DaexStore;
  }> {
    const fixture = TestBed.createComponent(DemandaAguaComponent);
    const store = TestBed.inject(DaexStore);
    fixture.componentRef.setInput('numero', '2.8');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  /** Primer elemento que coincide con el selector, con mensaje si falta. */
  function nodo<T extends HTMLElement>(
    fixture: ComponentFixture<DemandaAguaComponent>,
    selector: string,
  ): T {
    const encontrado = fixture.nativeElement.querySelector(selector) as T | null;
    if (!encontrado) {
      throw new Error(`No se encontró ${selector} en la plantilla de la 2.8`);
    }
    return encontrado;
  }

  /** Igual, pero tolerante: `null` en vez de excepción. */
  function opcional<T extends HTMLElement>(
    fixture: ComponentFixture<DemandaAguaComponent>,
    selector: string,
  ): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  /** Escribe en un input como lo haría el navegador. */
  function escribir(
    fixture: ComponentFixture<DemandaAguaComponent>,
    input: HTMLInputElement,
    valor: string,
  ): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Elige una opción del selector como lo haría el navegador. */
  function elegir(
    fixture: ComponentFixture<DemandaAguaComponent>,
    select: HTMLSelectElement,
    valor: string,
  ): void {
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  /** Pulsa el primer botón del componente cuyo rótulo termine en el fragmento. */
  function boton(
    fixture: ComponentFixture<DemandaAguaComponent>,
    texto: string,
  ): HTMLButtonElement {
    return buscarBoton(fixture.nativeElement as HTMLElement, texto);
  }

  /** Pulsa el primer botón del subárbol cuyo rótulo termine en el fragmento. */
  function botonEn(raiz: HTMLElement, texto: string): HTMLButtonElement {
    return buscarBoton(raiz, texto);
  }

  /**
   * Busca un botón por el final de su rótulo, no por el contenido entero.
   *
   * Los rótulos llevan delante el glifo de la acción ("✏️ Editar", "✕
   * Eliminar"), así que la coincidencia es por cola. Comparar con `includes`
   * haría que un rótulodjunto a otro ganara la carrera, y el clic caería en el
   * botón equivocado sin avisar.
   */
  function buscarBoton(raiz: HTMLElement, texto: string): HTMLButtonElement {
    const encontrado = Array.from<HTMLButtonElement>(raiz.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().endsWith(texto),
    );
    if (!encontrado) {
      throw new Error(`No se encontró el botón «${texto}»`);
    }
    return encontrado;
  }

  /**
   * Solo los dígitos de un texto.
   *
   * Las cifras pasan por el `DecimalPipe`, así que los separadores de miles y
   * el punto decimal dependen del locale del navegador de pruebas. Comparar los
   * dígitos deja la prueba igual de estricta en el valor y estable en cualquier
   * máquina.
   */
  function digitos(texto: string): string {
    return texto.replace(/\D/g, '');
  }

  /** Detecta cambios y deja que los `NgModel` en vuelo se monten. */
  async function asentar(fixture: ComponentFixture<DemandaAguaComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Un input del popup por su `id`. */
  function campoDe(fixture: ComponentFixture<DemandaAguaComponent>, id: string): HTMLInputElement {
    const encontrado = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement | null;
    if (!encontrado) {
      throw new Error(`El popup no tiene el campo #${id}`);
    }
    return encontrado;
  }

  /** El selector de zona del popup. */
  function selectorDeZona(fixture: ComponentFixture<DemandaAguaComponent>): HTMLSelectElement {
    return nodo<HTMLSelectElement>(fixture, '#modal-agua-zona');
  }

  /** Filas del balance hídrico. */
  function filasDe(fixture: ComponentFixture<DemandaAguaComponent>): HTMLTableRowElement[] {
    return Array.from<HTMLTableRowElement>(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  /**
   * Abre el popup de alta y espera a que `ngModel` lo haya pintado.
   *
   * `NgModel` monta su control en un microtask, así que sin este `whenStable`
   * los inputs se leen vacíos aunque el signal del borrador ya tenga el valor.
   */
  async function abrirPopup(fixture: ComponentFixture<DemandaAguaComponent>): Promise<void> {
    boton(fixture, 'Agregar Punto').click();
    await asentar(fixture);
  }

  /**
   * Registra un punto completo desde el popup: caudal, días, fuente y
   * coordenada, que es lo mínimo que el botón de grabar exige.
   */
  async function registrarPunto(
    fixture: ComponentFixture<DemandaAguaComponent>,
    campos: Partial<{
      fase: string;
      etapa: string;
      cantidadDia: string;
      numDias: string;
      fuente: string;
      este: string;
      norte: string;
    }> = {},
  ): Promise<void> {
    await abrirPopup(fixture);
    const valores = {
      fase: 'Perforación',
      etapa: 'Exploración',
      cantidadDia: '12.5',
      numDias: '30',
      fuente: 'Cisternas autorizado',
      este: '431250',
      norte: '8674320',
      ...campos,
    };
    escribir(fixture, campoDe(fixture, 'modal-agua-fase'), valores.fase);
    escribir(fixture, campoDe(fixture, 'modal-agua-etapa'), valores.etapa);
    escribir(fixture, campoDe(fixture, 'modal-agua-cantidad'), valores.cantidadDia);
    escribir(fixture, campoDe(fixture, 'modal-agua-dias'), valores.numDias);
    escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), valores.fuente);
    escribir(fixture, campoDe(fixture, 'modal-agua-este'), valores.este);
    escribir(fixture, campoDe(fixture, 'modal-agua-norte'), valores.norte);
    boton(fixture, 'Grabar Punto').click();
    await asentar(fixture);
  }

  /**
   * Punto válido para el store.
   *
   * Sirve para los casos que solo llegan por importación o por rehidratación de
   * un expediente ya guardado: el popup no deja declarar una fila incompleta.
   */
  function puntoValido(id = 'agua-1'): FuenteAbastecimientoAgua {
    return {
      id,
      fase: 'Perforación',
      etapa: 'Exploración',
      cantidadDia: 12.5,
      numDias: 30,
      fuente: 'Cisternas autorizado',
      este: 431250,
      norte: 8674320,
      zona: '18S',
    };
  }

  describe('encabezado y grilla', () => {
    it('arranca con la cabecera estándar de la sección 2.8', async () => {
      const { fixture } = await montar();

      expect(nodo(fixture, '.cabecera .etiqueta').textContent).toContain('2.8');
      expect(nodo(fixture, '.cabecera .titulo').textContent).toContain('Demanda de Agua');
      expect(nodo(fixture, '.cabecera .bajada').textContent).toContain('puntos de abastecimiento');
    });

    it('arranca vacía, con el mensaje que invita a declarar el primer punto', async () => {
      const { fixture } = await montar();

      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).toContain('No hay puntos de demanda');
    });

    it('no deja ningún input dentro de la grilla', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture);

      expect(opcional(fixture, 'table input')).toBeNull();
      expect(filasDe(fixture).length).toBe(1);
    });

    it('numera las filas y muestra el total derivado de cada punto', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture, { cantidadDia: '12.5', numDias: '30' });

      const fila = filasDe(fixture)[0]!;
      // «12.5 m³/día» y «375 m³»: 12,5 × 30.
      expect(digitos(fila.textContent ?? '')).toContain('125');
      expect(digitos(fila.textContent ?? '')).toContain('375');
      expect(fila.textContent).toContain('30 d');
      expect(fila.textContent).toContain('Cisternas autorizado');
      expect(fila.textContent).toContain('18S');
    });

    it('acumula la demanda de toda la tabla en el encabezado', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture, { cantidadDia: '12.5', numDias: '30' });
      await registrarPunto(fixture, {
        fase: 'Movimiento de tierras',
        etapa: 'Desbroce',
        cantidadDia: '4',
        numDias: '10',
      });

      // 375 + 40 = 415 m³ declarados en dos puntos.
      expect(nodo(fixture, '.contador-bloque').textContent).toContain('2 punto(s)');
      expect(digitos(nodo(fixture, '.contador-bloque').textContent ?? '')).toContain('415');
    });
  });

  describe('modal de punto', () => {
    it('abre en blanco, con el botón de grabar deshabilitado y su motivo', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);

      expect(opcional(fixture, '[role="dialog"]')).not.toBeNull();
      expect(campoDe(fixture, 'modal-agua-fase').value).toBe('');
      expect(nodo<HTMLButtonElement>(fixture, '[role="dialog"] button[disabled]')).toBeTruthy();
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('fase');
    });

    it('ofrece las tres zonas UTM con la 18S por defecto', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);

      const selector = selectorDeZona(fixture);
      expect(Array.from(selector.options).map((opcion) => opcion.value)).toEqual([
        '17S',
        '18S',
        '19S',
      ]);
      expect(selector.value).toBe('18S');
    });

    it('explica cada campo que falta, en el orden en que se relee', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);

      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('etapa');

      escribir(fixture, campoDe(fixture, 'modal-agua-etapa'), 'Exploración');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('caudal');

      escribir(fixture, campoDe(fixture, 'modal-agua-cantidad'), '12.5');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('días');

      escribir(fixture, campoDe(fixture, 'modal-agua-dias'), '30');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('fuente');

      escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), 'Cisternas');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('coordenada');

      escribir(fixture, campoDe(fixture, 'modal-agua-este'), '431250');
      escribir(fixture, campoDe(fixture, 'modal-agua-norte'), '8674320');
      expect(opcional(fixture, '[role="dialog"] .pendiente')).toBeNull();
    });

    it('calcula el total del popup mientras se teclea', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);
      escribir(fixture, campoDe(fixture, 'modal-agua-cantidad'), '12.5');
      escribir(fixture, campoDe(fixture, 'modal-agua-dias'), '30');

      expect(digitos(nodo(fixture, '.total-modal').textContent ?? '')).toContain('375');
    });

    it('trata un campo vacío como «sin llenar» y no como cero', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);
      // Con el resto de campos listos, el único pendiente es el caudal.
      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      escribir(fixture, campoDe(fixture, 'modal-agua-etapa'), 'Exploración');
      escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), 'Cisternas');
      escribir(fixture, campoDe(fixture, 'modal-agua-este'), '431250');
      escribir(fixture, campoDe(fixture, 'modal-agua-norte'), '8674320');

      const caudal = campoDe(fixture, 'modal-agua-cantidad');
      escribir(fixture, caudal, '12.5');
      escribir(fixture, caudal, '');

      // Con 0 el botón se habilitaría y el punto se grabaría sin caudal.
      const popup = nodo<HTMLElement>(fixture, '[role="dialog"]');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('caudal');
      expect(botonEn(popup, 'Grabar Punto').disabled).toBe(true);
    });

    it('no graba un punto sin coordenada', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);
      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      escribir(fixture, campoDe(fixture, 'modal-agua-etapa'), 'Exploración');
      escribir(fixture, campoDe(fixture, 'modal-agua-cantidad'), '12.5');
      escribir(fixture, campoDe(fixture, 'modal-agua-dias'), '30');
      escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), 'Cisternas');
      boton(fixture, 'Grabar Punto').click();
      await asentar(fixture);

      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('coordenada');
      expect(opcional(fixture, '[role="dialog"]')).not.toBeNull();
    });

    it('registra el punto y lo muestra en la grilla', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture);

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).toContain('Perforación');
      expect(nodo(fixture, 'tbody').textContent).toContain('Exploración');
      expect(nodo(fixture, '.aviso').textContent).toContain('registrado');
    });

    it('elige otra zona UTM desde el selector', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);
      elegir(fixture, selectorDeZona(fixture), '17S');
      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      escribir(fixture, campoDe(fixture, 'modal-agua-etapa'), 'Exploración');
      escribir(fixture, campoDe(fixture, 'modal-agua-cantidad'), '12.5');
      escribir(fixture, campoDe(fixture, 'modal-agua-dias'), '30');
      escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), 'Cisternas');
      escribir(fixture, campoDe(fixture, 'modal-agua-este'), '431250');
      escribir(fixture, campoDe(fixture, 'modal-agua-norte'), '8674320');
      boton(fixture, 'Grabar Punto').click();
      await asentar(fixture);

      expect(nodo(fixture, 'tbody').textContent).toContain('17S');
    });

    it('cancela sin grabar nada', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);
      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      boton(fixture, 'Cancelar').click();
      await asentar(fixture);

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(nodo(fixture, 'tbody').textContent).toContain('No hay puntos de demanda');
    });

    it('cierra con Escape sin grabar nada', async () => {
      const { fixture } = await montar();
      await abrirPopup(fixture);
      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await asentar(fixture);

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(nodo(fixture, 'tbody').textContent).toContain('No hay puntos de demanda');
    });
  });

  describe('edición y eliminación', () => {
    it('edita la fila en su sitio, sin duplicarla', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture);
      botonEn(filasDe(fixture)[0]!, 'Editar').click();
      await asentar(fixture);

      // El popup abre con lo que ya tenía la fila.
      expect(campoDe(fixture, 'modal-agua-fase').value).toBe('Perforación');
      expect(campoDe(fixture, 'modal-agua-fuente').value).toBe('Cisternas autorizado');

      escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), 'Quebrada San José');
      escribir(fixture, campoDe(fixture, 'modal-agua-dias'), '60');
      boton(fixture, 'Grabar Punto').click();
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).toContain('Quebrada San José');
      expect(nodo(fixture, 'tbody').textContent).toContain('60 d');
      expect(nodo(fixture, '.aviso').textContent).toContain('actualizado');
    });

    it('elimina el punto y avisa de su baja', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture);
      boton(fixture, 'Eliminar').click();
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).toContain('No hay puntos de demanda');
      expect(nodo(fixture, '.aviso').textContent).toContain('eliminado');
    });

    it('elimina solo la fila apuntada, no todas', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture);
      await registrarPunto(fixture, {
        fase: 'Movimiento de tierras',
        etapa: 'Desbroce',
        cantidadDia: '4',
        numDias: '10',
      });

      botonEn(filasDe(fixture)[0]!, 'Eliminar').click();
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).not.toContain('Perforación');
      expect(nodo(fixture, 'tbody').textContent).toContain('Movimiento de tierras');
    });
  });

  describe('validación de la sección', () => {
    it('bloquea mientras no haya ningún punto declarado', async () => {
      const { fixture } = await montar();

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('al menos un (1) punto');
    });

    it('habilita la validación con un solo punto bien declarado', async () => {
      const { fixture } = await montar();
      await registrarPunto(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(false);
      expect(nodo(fixture, '.pendiente--lista').textContent).toContain('lista para validar');
    });

    it('guarda el balance, lo publica en el store y pone la sección en verde', async () => {
      const { fixture, store } = await montar();
      await registrarPunto(fixture);
      boton(fixture, 'Guardar y Validar Sección 2.8').click();
      await asentar(fixture);

      expect(store.seccionPorNumero('2.8')?.estado).toBe('Verde');
      expect(nodo(fixture, '.aviso').textContent).toContain('validada');

      const guardados = store.demandaAguaRegistrada();
      expect(guardados.length).toBe(1);
      expect(guardados[0]?.fase).toBe('Perforación');
      expect(guardados[0]?.etapa).toBe('Exploración');
      expect(guardados[0]?.cantidadDia).toBe(12.5);
      expect(guardados[0]?.numDias).toBe(30);
      expect(guardados[0]?.fuente).toBe('Cisternas autorizado');
      expect(guardados[0]?.este).toBe(431250);
      expect(guardados[0]?.norte).toBe(8674320);
      expect(guardados[0]?.zona).toBe('18S');
    });

    it('no publica nada mientras la grilla esté bloqueada', async () => {
      const { fixture, store } = await montar();
      await abrirPopup(fixture);
      escribir(fixture, campoDe(fixture, 'modal-agua-fase'), 'Perforación');
      boton(fixture, 'Cancelar').click();
      await asentar(fixture);

      expect(boton(fixture, 'Guardar y Validar Sección 2.8').disabled).toBe(true);

      // El botón deshabilitado es la mitad visible del guardia; la otra mitad
      // está en el propio método, así que se invoca directo para comprobar que
      // tampoco publica por la vía que no pasa por el botón.
      const componente = fixture.componentInstance as unknown as {
        guardarYValidarDemandaSeccion(): void;
      };
      componente.guardarYValidarDemandaSeccion();
      await asentar(fixture);

      expect(store.demandaAguaRegistrada().length).toBe(0);
      expect(store.seccionPorNumero('2.8')?.estado).not.toBe('Verde');
      expect(nodo(fixture, '.aviso').textContent).toContain('al menos un (1) punto');
    });

    it('bloquea si el store trae un punto con caudal cero', async () => {
      const { fixture, store } = await montar();
      store.registrarDemandaAgua([{ ...puntoValido(), cantidadDia: 0 }]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('caudal diario');
    });

    it('bloquea si el store trae un punto sin coordenada', async () => {
      const { fixture, store } = await montar();
      store.registrarDemandaAgua([{ ...puntoValido(), este: 0, norte: 0 }]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('coordenada UTM');
    });

    it('bloquea si el store trae el mismo punto declarado dos veces', async () => {
      const { fixture, store } = await montar();
      store.registrarDemandaAgua([puntoValido('agua-1'), puntoValido('agua-2')]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('está repetido');
    });
  });

  describe('persistencia', () => {
    it('rehidrata los puntos ya validados al volver a la sección', async () => {
      const { fixture, store } = await montar();
      store.registrarDemandaAgua([puntoValido('agua-1'), puntoValido('agua-7')]);
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(2);
      expect(nodo(fixture, 'tbody').textContent).toContain('Perforación');
      expect(nodo(fixture, '.contador-bloque').textContent).toContain('2 punto(s)');
    });

    it('conserva los identificadores para que editar no alcance otra fila', async () => {
      const { fixture, store } = await montar();
      store.registrarDemandaAgua([puntoValido('agua-1'), puntoValido('agua-7')]);
      await asentar(fixture);

      // Editar la segunda fila y guardar no debe tocar la primera.
      botonEn(filasDe(fixture)[1]!, 'Editar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-agua-fuente'), 'Quebrada San José');
      boton(fixture, 'Grabar Punto').click();
      await asentar(fixture);
      boton(fixture, 'Guardar y Validar Sección 2.8').click();
      await asentar(fixture);

      const guardados = store.demandaAguaRegistrada();
      expect(guardados[0]?.id).toBe('agua-1');
      expect(guardados[0]?.fuente).toBe('Cisternas autorizado');
      expect(guardados[1]?.id).toBe('agua-7');
      expect(guardados[1]?.fuente).toBe('Quebrada San José');
    });
  });
});
