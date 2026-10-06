import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentesComponent, Plataforma } from './componentes.component';
import { DaexStore } from '../../../../state/daex.store';

describe('ComponentesComponent', () => {
  /**
   * Levanta el componente con el store real y la sección 2.7.
   *
   * El índice es un parámetro para poder abrir otra sección: el store resuelve
   * el semáforo de cada una, y una prueba clavada en el 2.7 no distinguiría
   * "no hay observaciones" de "no se leyó la sección correcta".
   */
  async function montar(numero = '2.7'): Promise<{
    fixture: ComponentFixture<ComponentesComponent>;
    store: DaexStore;
  }> {
    const fixture = TestBed.createComponent(ComponentesComponent);
    const store = TestBed.inject(DaexStore);
    fixture.componentRef.setInput('numero', numero);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  /**
   * Responde la primera observación que siga pendiente.
   *
   * Toca el store y no la interfaz a propósito: lo que se comprueba aquí es que
   * el semáforo de la sección lo mueva la regla del expediente. La bandeja y su
   * caja de descargo tienen su propia suite.
   */
  function subsanar(store: DaexStore, descargo: string): void {
    const pendiente = store.observacionesDeSeccion('2.7').find((obs) => obs.estado === 'PENDIENTE');
    if (!pendiente) {
      throw new Error('No queda ninguna observación pendiente en el 2.7');
    }
    store.abrirCajaTextoSubsanarFila('2.7', pendiente.id);
    store.procesarGuardarSubsanacionFila('2.7', pendiente.id, descargo);
  }

  /** Primer elemento que coincide con el selector, con mensaje si falta. */
  function nodo<T extends HTMLElement>(
    fixture: ComponentFixture<ComponentesComponent>,
    selector: string,
  ): T {
    const encontrado = fixture.nativeElement.querySelector(selector) as T | null;
    if (!encontrado) {
      throw new Error(`No se encontró ${selector} en la plantilla de la 2.7`);
    }
    return encontrado;
  }

  /** Igual, pero tolerante: `null` en vez de excepción. */
  function opcional<T extends HTMLElement>(
    fixture: ComponentFixture<ComponentesComponent>,
    selector: string,
  ): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  /** Escribe en un input como lo haría el navegador. */
  function escribir(
    fixture: ComponentFixture<ComponentesComponent>,
    input: HTMLInputElement,
    valor: string,
  ): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Pulsa el primer botón del componente cuyo texto contenga el fragmento. */
  function boton(
    fixture: ComponentFixture<ComponentesComponent>,
    texto: string,
  ): HTMLButtonElement {
    return buscarBoton(fixture.nativeElement as HTMLElement, texto);
  }

  /** Pulsa el primer botón del subárbol cuyo texto contenga el fragmento. */
  function botonEn(raiz: HTMLElement, texto: string): HTMLButtonElement {
    return buscarBoton(raiz, texto);
  }

  function buscarBoton(raiz: HTMLElement, texto: string): HTMLButtonElement {
    const encontrado = Array.from<HTMLButtonElement>(raiz.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    );
    if (!encontrado) {
      throw new Error(`No se encontró el botón «${texto}»`);
    }
    return encontrado;
  }

  /**
   * Solo los dígitos de un texto.
   *
   * Las cifras pasan por el `DecimalPipe`, así que los separadores de miles
   * dependen del locale del navegador de pruebas. Comparar los dígitos deja la
   * prueba igual de estricta en el valor y estable en cualquier máquina.
   */
  function digitos(texto: string): string {
    return texto.replace(/\D/g, '');
  }

  /* ------------------------------------------------------------------
     HELPERS DEL POPUP UNIFICADO
     ------------------------------------------------------------------
     Las tablas se localizan por su clase de gancho (`.tabla-plataformas`,
     `.tabla-sondajes`, `.tabla-auxiliares`, `.tabla-dimensiones`) y no por
     posición: la de sondajes vive dentro del popup, así que un índice fijo
     se movería según esté abierto o no.
     ------------------------------------------------------------------ */

  /** Filas del inventario de plataformas. */
  function filasDeInventario(
    fixture: ComponentFixture<ComponentesComponent>,
  ): HTMLTableRowElement[] {
    return Array.from<HTMLTableRowElement>(
      fixture.nativeElement.querySelectorAll('.tabla-plataformas tbody tr'),
    );
  }

  /** Inputs de una fila de sondaje: código, profundidad, inclinación, azimut. */
  function camposDeSondaje(fila: HTMLTableRowElement): HTMLInputElement[] {
    return Array.from<HTMLInputElement>(fila.querySelectorAll('input'));
  }

  /** Inputs de la ficha de plataforma del popup, en el orden de la plantilla. */
  function camposDeFicha(fixture: ComponentFixture<ComponentesComponent>): HTMLInputElement[] {
    const modal = opcional<HTMLElement>(fixture, '[role="dialog"]');
    if (!modal) {
      throw new Error('El popup de plataforma no está abierto.');
    }
    return Array.from<HTMLInputElement>(modal.querySelectorAll('.grid input'));
  }

  /** Filas de la mini-tabla de sondajes del popup. */
  function filasDeSondajes(fixture: ComponentFixture<ComponentesComponent>): HTMLTableRowElement[] {
    return Array.from<HTMLTableRowElement>(
      fixture.nativeElement.querySelectorAll('.tabla-sondajes tbody tr'),
    );
  }

  /** Filas de una grilla de solo lectura por su clase de gancho. */
  function filasDe(
    fixture: ComponentFixture<ComponentesComponent>,
    gancho: string,
  ): HTMLTableRowElement[] {
    return Array.from<HTMLTableRowElement>(
      fixture.nativeElement.querySelectorAll(`.${gancho} tbody tr`),
    );
  }

  /** Inputs de una grilla de solo lectura; deben salir vacíos. */
  function inputsDeTabla(
    fixture: ComponentFixture<ComponentesComponent>,
    gancho: string,
  ): HTMLInputElement[] {
    return Array.from<HTMLInputElement>(fixture.nativeElement.querySelectorAll(`.${gancho} input`));
  }

  /**
   * Un input del popup por su `id`.
   *
   * Los formularios de auxiliares y dimensiones se localizan por identificador
   * y no por posición: sus `grid` cambian de columnas y el índice de un campo
   * se movería con el tamaño de pantalla.
   */
  function campoDe(fixture: ComponentFixture<ComponentesComponent>, id: string): HTMLInputElement {
    const encontrado = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement | null;
    if (!encontrado) {
      throw new Error(`El popup no tiene el campo #${id}`);
    }
    return encontrado;
  }

  /**
   * Abre un popup y espera a que `ngModel` lo haya pintado.
   *
   * `NgModel` monta su control en un microtask, así que sin este `whenStable`
   * los inputs se leen vacíos aunque el signal del borrador ya tenga el valor.
   */
  async function abrirPopup(fixture: ComponentFixture<ComponentesComponent>): Promise<void> {
    boton(fixture, 'Añadir Plataforma').click();
    await asentar(fixture);
  }

  /** Detecta cambios y deja que los `NgModel` en vuelo se monten. */
  async function asentar(fixture: ComponentFixture<ComponentesComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Rellena Este y Norte de la ficha del popup. */
  async function rellenarCoordenadas(
    fixture: ComponentFixture<ComponentesComponent>,
    este = '431250',
    norte = '8674320',
  ): Promise<void> {
    const campos = camposDeFicha(fixture);
    escribir(fixture, campos[1]!, este);
    escribir(fixture, campos[2]!, norte);
  }

  /**
   * Registra una plataforma completa desde el popup: ficha más un sondaje con
   * código y profundidad, que es lo mínimo que el botón de grabar exige.
   */
  async function registrarPlataforma(
    fixture: ComponentFixture<ComponentesComponent>,
    nombre = 'PL-01',
    codigo = 'DDH-01',
  ): Promise<void> {
    await abrirPopup(fixture);
    const campos = camposDeFicha(fixture);
    escribir(fixture, campos[0]!, nombre);
    await rellenarCoordenadas(fixture);
    boton(fixture, 'Añadir Sondaje').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const sondaje = camposDeSondaje(filasDeSondajes(fixture)[0]!);
    escribir(fixture, sondaje[0]!, codigo);
    escribir(fixture, sondaje[1]!, '100');
    boton(fixture, 'Grabar Componente').click();
    await asentar(fixture);
  }

  /** Registra un auxiliar completo desde su popup. */
  async function registrarAuxiliar(
    fixture: ComponentFixture<ComponentesComponent>,
    nombre = 'Almacén de Testigos',
    este = '431250',
    norte = '8674320',
    altitud = '4820',
    cuerpoAgua = 'Laguna Esmeralda',
    distanciaAgua = '210',
  ): Promise<void> {
    boton(fixture, 'Añadir Auxiliar').click();
    await asentar(fixture);
    escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), nombre);
    escribir(fixture, campoDe(fixture, 'modal-aux-este'), este);
    escribir(fixture, campoDe(fixture, 'modal-aux-norte'), norte);
    escribir(fixture, campoDe(fixture, 'modal-aux-altitud'), altitud);
    escribir(fixture, campoDe(fixture, 'modal-aux-agua'), cuerpoAgua);
    escribir(fixture, campoDe(fixture, 'modal-aux-distancia'), distanciaAgua);
    boton(fixture, 'Grabar Auxiliar').click();
    await asentar(fixture);
  }

  /** Registra un dimensionamiento completo desde su popup. */
  async function registrarDimension(
    fixture: ComponentFixture<ComponentesComponent>,
    nombre = 'Pozas de sedimentación',
    ancho = '4',
    largo = '6',
    profundidad = '3',
    cantidad = '2',
  ): Promise<void> {
    boton(fixture, 'Añadir Dimensión').click();
    await asentar(fixture);
    escribir(fixture, campoDe(fixture, 'modal-dim-nombre'), nombre);
    escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), ancho);
    escribir(fixture, campoDe(fixture, 'modal-dim-largo'), largo);
    escribir(fixture, campoDe(fixture, 'modal-dim-profundidad'), profundidad);
    escribir(fixture, campoDe(fixture, 'modal-dim-cantidad'), cantidad);
    boton(fixture, 'Grabar Dimensión').click();
    await asentar(fixture);
  }

  /** El párrafo de totales del bloque de dimensiones. */
  function resumenDeTotales(fixture: ComponentFixture<ComponentesComponent>): string {
    const encontrado = Array.from<Element>(
      fixture.nativeElement.querySelectorAll('p.text-\\[10px\\]'),
    )
      .map((p) => p.textContent ?? '')
      .find((texto) => texto.includes('Totales:'));
    if (encontrado === undefined) {
      throw new Error('El bloque de dimensiones no muestra el resumen de totales.');
    }
    return encontrado;
  }

  /**
   * Una plataforma correcta, para el store.
   *
   * El bloqueo informa lo primero que falta, así que una regla de auxiliares o
   * dimensiones solo es alcanzable si la sección ya tiene su plataforma: sin
   * ella el motivo siempre sería «registre al menos una plataforma».
   */
  function plataformaValida(id = 'pl-1'): Plataforma {
    return {
      id,
      nombre: 'PL-01',
      este: 431250,
      norte: 8674320,
      altitud: 4820,
      cuerpoAgua: '',
      distanciaAgua: 0,
      sondajes: [{ id: `${id}-s`, codigo: 'DDH-01', profundidad: 100, inclinacion: 0, azimut: 0 }],
    };
  }

  describe('inventario de plataformas', () => {
    it('arranca vacío y lo dice', async () => {
      const { fixture } = await montar();

      expect(filasDeInventario(fixture).length).toBe(1); // solo la fila de vacío
      expect(nodo(fixture, '.tabla-plataformas td[colspan]').textContent).toContain(
        'No hay plataformas registradas en el expediente',
      );
    });

    it('no hay mini-tabla de sondajes hasta que se abre el popup', async () => {
      const { fixture } = await montar();
      expect(opcional(fixture, '.tabla-sondajes')).toBeNull();

      await abrirPopup(fixture);

      expect(opcional(fixture, '.tabla-sondajes')).not.toBeNull();
    });

    it('numera las plataformas del inventario en orden', async () => {
      const { fixture } = await montar();

      await registrarPlataforma(fixture, 'PL-01');
      await registrarPlataforma(fixture, 'PL-02');

      const numeros = filasDeInventario(fixture).map((f) => f.cells[0]!.textContent!.trim());
      expect(numeros).toEqual(['1', '2']);
    });

    it('muestra las coordenadas, la altitud y el agua en la fila', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      const campos = camposDeFicha(fixture);
      escribir(fixture, campos[0]!, 'PL-07');
      await rellenarCoordenadas(fixture);
      escribir(fixture, campos[3]!, '4820');
      escribir(fixture, campos[4]!, 'Quebrada Verde');
      escribir(fixture, campos[5]!, '150');
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const sondaje = camposDeSondaje(filasDeSondajes(fixture)[0]!);
      escribir(fixture, sondaje[0]!, 'DDH-07');
      escribir(fixture, sondaje[1]!, '90');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      const fila = filasDeInventario(fixture)[0]!;
      expect(fila.cells[1]!.textContent).toContain('PL-07');
      expect(digitos(fila.cells[2]!.textContent!)).toBe('4312508674320');
      expect(fila.cells[2]!.textContent).toContain('E /');
      expect(digitos(fila.cells[3]!.textContent!)).toBe('4820');
      expect(fila.cells[4]!.textContent).toContain('Quebrada Verde (150m)');
    });

    it('cuenta los sondajes que se declararon en el popup', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      expect(filasDeInventario(fixture)[0]!.cells[5]!.textContent).toContain('1 ddh');
    });

    it('queda en rojo la fila sin perforaciones declaradas', async () => {
      const { fixture } = await montar();
      const store = TestBed.inject(DaexStore);
      // Una plataforma importada sin sondajes es el caso que el badge señala.
      store.registrarMatrizComponentes({
        plataformas: [
          {
            id: 'pl-1',
            nombre: 'PL-01',
            este: 431250,
            norte: 8674320,
            altitud: 4820,
            cuerpoAgua: '',
            distanciaAgua: 0,
            sondajes: [],
          },
        ],
        auxiliares: [],
        dimensiones: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(filasDeInventario(fixture)[0]!.cells[5]!.textContent).toContain('0 ddh');
    });

    it('quita la plataforma con todos sus sondajes', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      botonEn(filasDeInventario(fixture)[0]!, 'Eliminar').click();
      fixture.detectChanges();

      expect(filasDeInventario(fixture).length).toBe(1); // vuelve a la fila de vacío
    });

    it('no borra la plataforma al pulsar Editar', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();

      // El popup se superpone al inventario: la fila sigue ahí detrás.
      expect(filasDeInventario(fixture).length).toBe(1);
      expect(opcional(fixture, '[role="dialog"]')).not.toBeNull();
    });
  });

  describe('popup de alta y edición', () => {
    it('abre en blanco, con el nombre correlativo puesto', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);

      const campos = camposDeFicha(fixture);
      expect(campos[0]!.value).toBe('PLA-01');
      // Este y Norte arrancan vacíos, no en cero: es un formulario en blanco.
      expect(campos[1]!.value).toBe('');
      expect(campos[2]!.value).toBe('');
    });

    it('empieza sin sondajes y avisa de que hace falta al menos uno', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);

      expect(filasDeSondajes(fixture).length).toBe(1); // fila de aviso
      expect(nodo(fixture, '.tabla-sondajes .text-red-500').textContent).toContain(
        'mínimo un (1) sondaje',
      );
    });

    it('deshabilita grabar hasta que hay nombre, coordenada y sondaje', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      expect(boton(fixture, 'Grabar Componente').disabled).toBe(true);

      const campos = camposDeFicha(fixture);
      escribir(fixture, campos[0]!, 'PL-01');
      await rellenarCoordenadas(fixture);
      // Coordenada lista, pero sigue sin perforación.
      expect(boton(fixture, 'Grabar Componente').disabled).toBe(true);

      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      // Sondaje recién creado con profundidad 0: todavía no habilita.
      expect(boton(fixture, 'Grabar Componente').disabled).toBe(true);

      const sondaje = camposDeSondaje(filasDeSondajes(fixture)[0]!);
      escribir(fixture, sondaje[0]!, 'DDH-01');
      escribir(fixture, sondaje[1]!, '100');
      expect(boton(fixture, 'Grabar Componente').disabled).toBe(false);
    });

    it('explica junto al botón qué falta', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain(
        'Indique la coordenada UTM',
      );

      const campos = camposDeFicha(fixture);
      escribir(fixture, campos[0]!, '   ');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain(
        'nombre de la plataforma',
      );

      escribir(fixture, campos[0]!, 'PL-01');
      await rellenarCoordenadas(fixture);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain(
        'al menos un (1) sondaje',
      );

      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain(
        'profundidad programada',
      );
    });

    it('no graba con una coordenada en cero', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      const campos = camposDeFicha(fixture);
      escribir(fixture, campos[0]!, 'PL-01');
      escribir(fixture, campos[1]!, '0');
      escribir(fixture, campos[2]!, '8674320');
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const sondaje = camposDeSondaje(filasDeSondajes(fixture)[0]!);
      escribir(fixture, sondaje[0]!, 'DDH-01');
      escribir(fixture, sondaje[1]!, '100');

      expect(boton(fixture, 'Grabar Componente').disabled).toBe(true);
    });

    it('descarta la plataforma y sus sondajes al cancelar', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      const campos = camposDeFicha(fixture);
      escribir(fixture, campos[0]!, 'PL-TIRADA');
      await rellenarCoordenadas(fixture);
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      boton(fixture, 'Cancelar').click();
      fixture.detectChanges();

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(filasDeInventario(fixture).length).toBe(1);
    });

    it('cierra con Escape sin grabar', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      escribir(fixture, camposDeFicha(fixture)[0]!, 'PL-TIRADA');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(filasDeInventario(fixture).length).toBe(1);
    });

    it('precarga los datos al editar y actualiza la fila sin duplicarla', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture, 'PL-01');

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El popup abre en modo edición, con los valores de la fila.
      expect(nodo(fixture, '#titulo-modal-plataforma').textContent).toContain('Editar Plataforma');
      const campos = camposDeFicha(fixture);
      expect(campos[0]!.value).toBe('PL-01');
      expect(campos[1]!.value).toBe('431250');
      // Y con sus sondajes ya cargados en la mini-tabla.
      expect(filasDeSondajes(fixture).length).toBe(1);

      escribir(fixture, campos[0]!, 'PL-01-RENOMBRADA');
      escribir(fixture, campos[5]!, '220');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      expect(filasDeInventario(fixture).length).toBe(1);
      expect(filasDeInventario(fixture)[0]!.cells[1]!.textContent).toContain('PL-01-RENOMBRADA');
      expect(filasDeInventario(fixture)[0]!.cells[4]!.textContent).toContain('220');
    });

    it('conserva los sondajes al editar la plataforma', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture, 'PL-01', 'DDH-01A');

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      escribir(fixture, camposDeFicha(fixture)[0]!, 'PL-01-B');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      expect(filasDeInventario(fixture)[0]!.cells[5]!.textContent).toContain('1 ddh');
    });

    it('rechaza un nombre repetido sin tocar la plataforma existente', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture, 'PL-01');

      await abrirPopup(fixture);
      const campos = camposDeFicha(fixture);
      escribir(fixture, campos[0]!, 'pl-01');
      await rellenarCoordenadas(fixture);
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const sondaje = camposDeSondaje(filasDeSondajes(fixture)[0]!);
      escribir(fixture, sondaje[0]!, 'DDH-02');
      escribir(fixture, sondaje[1]!, '80');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      expect(filasDeInventario(fixture).length).toBe(1);
      expect(nodo(fixture, '.aviso').textContent).toContain('Ya existe una plataforma');
    });
  });

  describe('sondajes dentro del popup', () => {
    it('admite varios sondajes en la misma plataforma', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      await rellenarCoordenadas(fixture);
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(filasDeSondajes(fixture).length).toBe(3);
    });

    it('guarda los datos de cada sondaje en su propia fila', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      await rellenarCoordenadas(fixture);
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const campos = filasDeSondajes(fixture).map((f) => camposDeSondaje(f));
      escribir(fixture, campos[0]![0]!, 'DDH-01A');
      escribir(fixture, campos[0]![1]!, '80');
      escribir(fixture, campos[1]![0]!, 'DDH-01B');
      escribir(fixture, campos[1]![1]!, '120');
      escribir(fixture, campos[1]![2]!, '-15');
      escribir(fixture, campos[1]![3]!, '45');

      const valores = filasDeSondajes(fixture).map((fila) =>
        camposDeSondaje(fila).map((i) => i.value),
      );
      expect(valores[0]![0]).toBe('DDH-01A');
      expect(valores[1]).toEqual(['DDH-01B', '120', '-15', '45']);
    });

    it('quita un sondaje sin tocar los demás', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      await rellenarCoordenadas(fixture);
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      escribir(fixture, camposDeSondaje(filasDeSondajes(fixture)[0]!)[0]!, 'DDH-01A');

      botonEn(filasDeSondajes(fixture)[1]!, '✕').click();
      fixture.detectChanges();

      expect(filasDeSondajes(fixture).length).toBe(1);
      expect(camposDeSondaje(filasDeSondajes(fixture)[0]!)[0]!.value).toBe('DDH-01A');
    });

    it('deja el campo en cero cuando se borra, en vez de NaN', async () => {
      const { fixture } = await montar();

      await abrirPopup(fixture);
      boton(fixture, 'Añadir Sondaje').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const profundidad = camposDeSondaje(filasDeSondajes(fixture)[0]!)[1]!;
      escribir(fixture, profundidad, '80');
      escribir(fixture, profundidad, '');

      expect(Number(profundidad.value)).toBe(0);
    });

    it('conserva el negativo en pantalla y lo rechaza al validar', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const inclinacion = camposDeSondaje(filasDeSondajes(fixture)[0]!)[2]!;
      escribir(fixture, inclinacion, '-15');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      // El input está atado al modelo con `[ngModel]`: lo tecleado se conserva
      // y el rechazo llega por la validación, no truncando en silencio.
      expect(Number(inclinacion.value)).toBe(-15);
      expect(nodo(fixture, '.pendiente').textContent).toContain('inclinación en negativo');
    });
  });

  describe('guardián de diez plataformas', () => {
    /** Crea `cuantas` plataformas por el popup, con un sondaje cada una. */
    async function crearVarias(
      fixture: ComponentFixture<ComponentesComponent>,
      cuantas: number,
    ): Promise<void> {
      for (let i = 1; i <= cuantas; i++) {
        await registrarPlataforma(fixture, `PL-${i}`, `D-${i}`);
      }
    }

    it('deshabilita el botón al llegar al tope', async () => {
      const { fixture } = await montar();

      await crearVarias(fixture, 10);

      expect(filasDeInventario(fixture).length).toBe(10);
      expect(boton(fixture, 'Añadir Plataforma').disabled).toBe(true);
    });

    it('no crea la undécima aunque se pulse el botón muchas veces', async () => {
      const { fixture } = await montar();

      await crearVarias(fixture, 10);
      for (let i = 0; i < 5; i++) {
        boton(fixture, 'Añadir Plataforma').click();
      }
      fixture.detectChanges();

      expect(filasDeInventario(fixture).length).toBe(10);
      // Y el popup ni siquiera llega a abrirse: no hay cupo.
      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
    });

    it('rechaza el alta y avisa cuando se salta el botón deshabilitado', async () => {
      const { fixture } = await montar();
      await crearVarias(fixture, 10);

      // Se llama al manejador directamente: un `disabled` en el DOM es una
      // ayuda visual, no la garantía de que el tope se respete.
      const directo = fixture.componentInstance as unknown as {
        abrirModalNuevaPlataforma(): void;
      };
      directo.abrirModalNuevaPlataforma();
      fixture.detectChanges();

      expect(filasDeInventario(fixture).length).toBe(10);
      expect(nodo(fixture, '.aviso').textContent).toContain('DAEX de Menor Complejidad');
    });

    it('expone el tope en el contador de la cabecera', async () => {
      const { fixture } = await montar();

      await registrarPlataforma(fixture, 'PL-01');

      expect(nodo(fixture, '.contador-bloque').textContent).toContain('1 de 10');
    });

    it('bloquea la validación si el store trae más de diez', async () => {
      const { fixture, store } = await montar();
      store.registrarMatrizComponentes({
        plataformas: Array.from({ length: 12 }, (_, indice) => ({
          id: `pl-${indice}`,
          nombre: `PL-${indice}`,
          este: 1,
          norte: 1,
          altitud: 1,
          cuerpoAgua: '',
          distanciaAgua: 0,
          sondajes: [
            { id: `s-${indice}`, codigo: `D-${indice}`, profundidad: 1, inclinacion: 0, azimut: 0 },
          ],
        })),
        auxiliares: [],
        dimensiones: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(nodo(fixture, '.contador-bloque').textContent).toContain('12 de 10');
      expect(nodo(fixture, '.pendiente').textContent).toContain('hasta 10 plataformas');
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
    });
  });

  describe('dimensiones, áreas y volúmenes', () => {
    it('deriva el área del ancho por el largo', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '2');

      // 4 × 6 = 24 m²
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[2]!.textContent!)).toBe(
        '2400',
      );
    });

    it('deriva el área total multiplicando por la cantidad', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '5');

      // 24 × 5 = 120 m²
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[4]!.textContent!)).toBe(
        '12000',
      );
    });

    it('deriva el volumen del área total por la profundidad', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '5');

      // 120 × 3 = 360 m³
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[5]!.textContent!)).toBe(
        '36000',
      );
    });

    it('recalcula al cambiar el ancho, sin dejar el área vieja', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '2');
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[2]!.textContent!)).toBe(
        '2400',
      );

      // El ancho ya no se teclea en la fila: se regraba desde el popup, que es
      // de donde sale ahora el dato.
      botonEn(filasDe(fixture, 'tabla-dimensiones')[0]!, 'Editar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), '10');
      boton(fixture, 'Grabar Dimensión').click();
      await asentar(fixture);

      // 10 × 6 = 60 m², y el volumen pasa de 144 a 360 m³.
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[2]!.textContent!)).toBe(
        '6000',
      );
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[5]!.textContent!)).toBe(
        '36000',
      );
    });

    it('muestra las dimensiones y la cantidad en su propia columna', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '5');

      const fila = filasDe(fixture, 'tabla-dimensiones')[0]!;
      expect(fila.cells[0]!.textContent).toContain('Pozas');
      expect(digitos(fila.cells[1]!.textContent!)).toBe('463');
      expect(digitos(fila.cells[3]!.textContent!)).toBe('5');
    });

    it('no tiene ni un input en la grilla: es de solo lectura', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture);

      expect(inputsDeTabla(fixture, 'tabla-dimensiones').length).toBe(0);
    });

    it('arranca vacío y lo dice', async () => {
      const { fixture } = await montar();

      expect(filasDe(fixture, 'tabla-dimensiones').length).toBe(1); // solo la de vacío
      expect(nodo(fixture, '.tabla-dimensiones td[colspan]').textContent).toContain(
        'No hay registros de dimensionamiento declarados',
      );
    });

    it('muestra el área calculada mientras se teclea en el popup', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Dimensión').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), '4');
      escribir(fixture, campoDe(fixture, 'modal-dim-largo'), '6');

      const previo = campoDe(fixture, 'modal-dim-cantidad')
        .closest('.grid')!
        .querySelector('span.text-sm')!;
      expect(digitos(previo.textContent!)).toBe('2400');
    });

    it('deshabilita grabar hasta que hay nombre, ancho y largo', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Dimensión').click();
      await asentar(fixture);
      // La cantidad llega en 1, así que no es lo que falta.
      expect(campoDe(fixture, 'modal-dim-cantidad').value).toBe('1');
      expect(boton(fixture, 'Grabar Dimensión').disabled).toBe(true);

      escribir(fixture, campoDe(fixture, 'modal-dim-nombre'), 'Pozas');
      escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), '4');
      expect(boton(fixture, 'Grabar Dimensión').disabled).toBe(true);

      escribir(fixture, campoDe(fixture, 'modal-dim-largo'), '6');
      expect(boton(fixture, 'Grabar Dimensión').disabled).toBe(false);
    });

    it('exige una cantidad de al menos 1', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Dimensión').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-dim-nombre'), 'Pozas');
      escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), '4');
      escribir(fixture, campoDe(fixture, 'modal-dim-largo'), '6');
      escribir(fixture, campoDe(fixture, 'modal-dim-cantidad'), '0');

      expect(boton(fixture, 'Grabar Dimensión').disabled).toBe(true);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('al menos 1');
    });

    it('precarga al editar y recalcula sin duplicar la fila', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '2');

      botonEn(filasDe(fixture, 'tabla-dimensiones')[0]!, 'Editar').click();
      await asentar(fixture);
      expect(campoDe(fixture, 'modal-dim-nombre').value).toBe('Pozas');
      expect(campoDe(fixture, 'modal-dim-cantidad').value).toBe('2');

      escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), '10');
      boton(fixture, 'Grabar Dimensión').click();
      await asentar(fixture);

      expect(filasDe(fixture, 'tabla-dimensiones').length).toBe(1);
      // 10 × 6 = 60 m², × 2 ejemplares = 120 m², × 3 de profundidad = 360 m³.
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[2]!.textContent!)).toBe(
        '6000',
      );
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[4]!.textContent!)).toBe(
        '12000',
      );
      expect(digitos(filasDe(fixture, 'tabla-dimensiones')[0]!.cells[5]!.textContent!)).toBe(
        '36000',
      );
    });

    it('rechaza un componente repetido sin tocar la fila existente', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas');

      boton(fixture, 'Añadir Dimensión').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-dim-nombre'), 'pozas');
      escribir(fixture, campoDe(fixture, 'modal-dim-ancho'), '2');
      escribir(fixture, campoDe(fixture, 'modal-dim-largo'), '2');
      boton(fixture, 'Grabar Dimensión').click();
      await asentar(fixture);

      expect(filasDe(fixture, 'tabla-dimensiones').length).toBe(1);
      expect(nodo(fixture, '.aviso').textContent).toContain('Ya existe un componente');
    });

    it('quita la fila al eliminar', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture);

      botonEn(filasDe(fixture, 'tabla-dimensiones')[0]!, 'Eliminar').click();
      fixture.detectChanges();

      expect(filasDe(fixture, 'tabla-dimensiones').length).toBe(1); // vuelve al vacío
    });

    it('suma las áreas y los volúmenes de todas las filas en el bloque', async () => {
      const { fixture } = await montar();
      await registrarDimension(fixture, 'Pozas', '4', '6', '3', '2'); // 48 m², 144 m³
      await registrarDimension(fixture, 'Zanjas', '10', '10', '2', '1'); // 100 m², 200 m³

      expect(digitos(resumenDeTotales(fixture))).toBe('1480034400');
    });

    it('arranca con los totales en cero', async () => {
      const { fixture } = await montar();

      // «Totales: 0.00 m² · 0.00 m³», es decir seis dígitos en cero.
      expect(digitos(resumenDeTotales(fixture))).toBe('000000');
    });

    it('bloquea la validación si el store trae un componente repetido', async () => {
      const { fixture, store } = await montar();
      store.registrarMatrizComponentes({
        plataformas: [plataformaValida()],
        auxiliares: [],
        dimensiones: [
          {
            id: 'd-1',
            nombreComponente: 'Pozas',
            ancho: 1,
            largo: 1,
            profundidad: 1,
            cantidad: 1,
          },
          {
            id: 'd-2',
            nombreComponente: 'pozas',
            ancho: 1,
            largo: 1,
            profundidad: 1,
            cantidad: 1,
          },
        ],
      });
      await asentar(fixture);

      expect(nodo(fixture, '.pendiente').textContent).toContain('Pozas está repetido');
    });
  });

  describe('componentes auxiliares', () => {
    it('arranca vacío y lo dice', async () => {
      const { fixture } = await montar();

      expect(filasDe(fixture, 'tabla-auxiliares').length).toBe(1); // solo la de vacío
      expect(nodo(fixture, '.tabla-auxiliares td[colspan]').textContent).toContain(
        'No hay componentes auxiliares declarados',
      );
    });

    it('no tiene ni un input en la grilla: es de solo lectura', async () => {
      const { fixture } = await montar();

      await registrarAuxiliar(fixture);

      expect(inputsDeTabla(fixture, 'tabla-auxiliares').length).toBe(0);
    });

    it('agrega la fila desde el popup, con todos sus datos', async () => {
      const { fixture } = await montar();

      await registrarAuxiliar(fixture, 'Almacén de Testigos', '431250', '8674320');

      const fila = filasDe(fixture, 'tabla-auxiliares')[0]!;
      expect(fila.cells[1]!.textContent).toContain('Almacén de Testigos');
      expect(digitos(fila.cells[2]!.textContent!)).toBe('4312508674320');
      expect(digitos(fila.cells[3]!.textContent!)).toBe('4820');
      expect(fila.cells[4]!.textContent).toContain('Laguna Esmeralda (210m)');
    });

    it('abre el popup en blanco, sin coordenadas inventadas', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);

      expect(campoDe(fixture, 'modal-aux-nombre').value).toBe('');
      // Este y Norte en blanco, no en cero: es un formulario sin llenar.
      expect(campoDe(fixture, 'modal-aux-este').value).toBe('');
      expect(campoDe(fixture, 'modal-aux-norte').value).toBe('');
    });

    it('deshabilita grabar hasta que hay nombre y coordenada', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);
      expect(boton(fixture, 'Grabar Auxiliar').disabled).toBe(true);

      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'Almacén');
      expect(boton(fixture, 'Grabar Auxiliar').disabled).toBe(true);

      escribir(fixture, campoDe(fixture, 'modal-aux-este'), '431250');
      escribir(fixture, campoDe(fixture, 'modal-aux-norte'), '8674320');
      expect(boton(fixture, 'Grabar Auxiliar').disabled).toBe(false);
    });

    it('explica junto al botón qué falta', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain(
        'nombre del componente auxiliar',
      );

      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'Almacén');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('coordenada UTM');

      escribir(fixture, campoDe(fixture, 'modal-aux-este'), '431250');
      escribir(fixture, campoDe(fixture, 'modal-aux-norte'), '8674320');
      expect(opcional(fixture, '[role="dialog"] .pendiente')).toBeNull();
    });

    it('no graba con la coordenada en cero', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'Almacén');
      escribir(fixture, campoDe(fixture, 'modal-aux-este'), '0');
      escribir(fixture, campoDe(fixture, 'modal-aux-norte'), '8674320');

      expect(boton(fixture, 'Grabar Auxiliar').disabled).toBe(true);
    });

    it('precarga al editar y actualiza la fila sin duplicarla', async () => {
      const { fixture } = await montar();
      await registrarAuxiliar(fixture);

      botonEn(filasDe(fixture, 'tabla-auxiliares')[0]!, 'Editar').click();
      await asentar(fixture);
      expect(campoDe(fixture, 'modal-aux-nombre').value).toBe('Almacén de Testigos');
      expect(campoDe(fixture, 'modal-aux-este').value).toBe('431250');

      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'Almacén Norte');
      escribir(fixture, campoDe(fixture, 'modal-aux-distancia'), '350');
      boton(fixture, 'Grabar Auxiliar').click();
      await asentar(fixture);

      expect(filasDe(fixture, 'tabla-auxiliares').length).toBe(1);
      expect(filasDe(fixture, 'tabla-auxiliares')[0]!.cells[1]!.textContent).toContain(
        'Almacén Norte',
      );
      expect(filasDe(fixture, 'tabla-auxiliares')[0]!.cells[4]!.textContent).toContain('350m');
    });

    it('rechaza un nombre repetido sin tocar la fila existente', async () => {
      const { fixture } = await montar();
      await registrarAuxiliar(fixture);

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'almacén de testigos');
      escribir(fixture, campoDe(fixture, 'modal-aux-este'), '431300');
      escribir(fixture, campoDe(fixture, 'modal-aux-norte'), '8674400');
      boton(fixture, 'Grabar Auxiliar').click();
      await asentar(fixture);

      expect(filasDe(fixture, 'tabla-auxiliares').length).toBe(1);
      expect(nodo(fixture, '.aviso').textContent).toContain('Ya existe un componente auxiliar');
    });

    it('quita la fila al eliminar', async () => {
      const { fixture } = await montar();
      await registrarAuxiliar(fixture);

      botonEn(filasDe(fixture, 'tabla-auxiliares')[0]!, 'Eliminar').click();
      fixture.detectChanges();

      expect(filasDe(fixture, 'tabla-auxiliares').length).toBe(1); // vuelve al vacío
    });

    it('descarta el borrador al cancelar', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'Almacén TIRADO');
      boton(fixture, 'Cancelar').click();
      fixture.detectChanges();

      expect(opcional(fixture, '#modal-aux-nombre')).toBeNull();
      expect(filasDe(fixture, 'tabla-auxiliares').length).toBe(1);
    });

    it('cierra con Escape sin grabar', async () => {
      const { fixture } = await montar();

      boton(fixture, 'Añadir Auxiliar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-aux-nombre'), 'Almacén TIRADO');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(opcional(fixture, '#modal-aux-nombre')).toBeNull();
      expect(filasDe(fixture, 'tabla-auxiliares').length).toBe(1);
    });

    it('bloquea la validación si el store trae un auxiliar sin nombre', async () => {
      const { fixture, store } = await montar();
      // Ya no se puede dejar una fila en blanco desde el popup: este caso solo
      // llega por importación o por rehidratación de una matriz guardada antes.
      store.registrarMatrizComponentes({
        plataformas: [plataformaValida()],
        auxiliares: [
          {
            id: 'aux-1',
            nombre: '',
            este: 431250,
            norte: 8674320,
            altitud: 4820,
            cuerpoAgua: '',
            distanciaAgua: 0,
          },
        ],
        dimensiones: [],
      });
      await asentar(fixture);

      expect(nodo(fixture, '.pendiente').textContent).toContain('auxiliares necesitan nombre');
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
    });

    it('bloquea la validación si el store trae un auxiliar sin coordenada', async () => {
      const { fixture, store } = await montar();
      store.registrarMatrizComponentes({
        plataformas: [plataformaValida()],
        auxiliares: [
          {
            id: 'aux-1',
            nombre: 'Almacén',
            este: 0,
            norte: 0,
            altitud: 0,
            cuerpoAgua: '',
            distanciaAgua: 0,
          },
        ],
        dimensiones: [],
      });
      await asentar(fixture);

      expect(nodo(fixture, '.pendiente').textContent).toContain(
        'auxiliares necesitan su coordenada UTM',
      );
    });

    it('bloquea la validación si hay dos auxiliares con el mismo nombre', async () => {
      const { fixture, store } = await montar();
      store.registrarMatrizComponentes({
        plataformas: [plataformaValida()],
        auxiliares: [
          {
            id: 'aux-1',
            nombre: 'Almacén',
            este: 1,
            norte: 1,
            altitud: 1,
            cuerpoAgua: '',
            distanciaAgua: 0,
          },
          {
            id: 'aux-2',
            nombre: 'ALMACÉN',
            este: 2,
            norte: 2,
            altitud: 1,
            cuerpoAgua: '',
            distanciaAgua: 0,
          },
        ],
        dimensiones: [],
      });
      await asentar(fixture);

      expect(nodo(fixture, '.pendiente').textContent).toContain('Almacén está repetido');
    });
  });

  /* ------------------------------------------------------------------
     OBSERVACIONES DEL EVALUADOR
     ------------------------------------------------------------------
     La bandeja ya no vive en la 2.7: la trae `ObservacionesEvaluadorComponent`,
     que el orquestador monta sobre cualquier sección observada. Aquí solo se
     comprueba que la sección conserva su semáforo mientras el store la marque
     como tal, y que en una sección sin acta no queda rastro del motor.
     ------------------------------------------------------------------ */
  describe('observaciones del evaluador', () => {
    it('deja la 2.7 limpia: aquí no hay bandeja que dibujar', async () => {
      const { fixture } = await montar();
      expect(opcional(fixture, '.bloque-observaciones')).toBeNull();
    });

    it('mantiene la 2.7 en rojo mientras el acta siga viva en el store', async () => {
      const { store } = await montar();
      expect(store.seccionPorNumero('2.7')?.estado).toBe('Rojo');
      expect(store.seccionPorNumero('2.7')?.observado).toBe(true);
      expect(store.estadoCapitulo('2')).toBe('Rojo');
      expect(store.capituloEnAlerta('2')).toBe(true);
    });

    it('no toca las observaciones de una sección que el componente no muestra', () => {
      const store = TestBed.inject(DaexStore);
      expect(store.observacionesDeSeccion('2.5')).toEqual([]);
      expect(store.microComponenteEvaluadoDe('2.5')).toBeNull();
    });

    /**
     * El semáforo de la sección lo mueve el store, no la bandeja.
     *
     * Alguien tiene que subsanar, y ese alguien ve la tarjeta del orquestador
     * encima de la 2.7; pero el color lo decide la regla única del expediente,
     * para que el aside, el capítulo y la sección no puedan discrepar.
     */
    it('pasa a azul cuando el store registra todos los descargos', async () => {
      const { store } = await montar();
      subsanar(store, 'Se adjunta el plano corregido.');
      expect(store.seccionPorNumero('2.7')?.estado).toBe('Rojo');

      subsanar(store, 'Se adjunta la justificación técnica de PLA-02.');
      expect(store.seccionPorNumero('2.7')?.estado).toBe('Azul');
      expect(store.seccionPorNumero('2.7')?.observado).toBe(true);
    });
  });

  describe('validación', () => {
    it('bloquea el guardado mientras no haya plataformas', async () => {
      const { fixture } = await montar();

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('al menos una plataforma');
    });

    it('bloquea el guardado si la plataforma no tiene perforación', async () => {
      const { fixture, store } = await montar();
      // Entrada por el store: el popup ya no permite grabar sin sondaje, así
      // que esta plataforma solo puede llegar por importación o por rehidratación.
      store.registrarMatrizComponentes({
        plataformas: [
          {
            id: 'pl-1',
            nombre: 'PL-01',
            este: 431250,
            norte: 8674320,
            altitud: 4820,
            cuerpoAgua: '',
            distanciaAgua: 0,
            sondajes: [],
          },
        ],
        auxiliares: [],
        dimensiones: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(nodo(fixture, '.pendiente').textContent).toContain('al menos una perforación');
    });

    it('rechaza una inclinación mayor de 90°', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      escribir(fixture, camposDeSondaje(filasDeSondajes(fixture)[0]!)[2]!, '120');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      expect(nodo(fixture, '.pendiente').textContent).toContain('inclinación mayor de 90');
    });

    it('rechaza un azimut mayor de 360°', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      escribir(fixture, camposDeSondaje(filasDeSondajes(fixture)[0]!)[3]!, '400');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      expect(nodo(fixture, '.pendiente').textContent).toContain('azimut mayor de 360');
    });

    it('anuncia que la matriz está lista cuando todo cuadra', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);

      expect(nodo(fixture, '.pendiente--lista').textContent).toContain('lista para validar');
    });
  });

  describe('importación de CSV', () => {
    /** Lanza la importación de un CSV en el input de archivos de la 2.7. */
    async function importar(
      fixture: ComponentFixture<ComponentesComponent>,
      contenido: string,
    ): Promise<void> {
      const entrada = nodo<HTMLInputElement>(fixture, 'input[type="file"]');
      // El entorno de pruebas no trae `DataTransfer`, así que se define la
      // propiedad directamente con una lista. El componente solo lee `files[0]`.
      Object.defineProperty(entrada, 'files', {
        configurable: true,
        value: archivoFalso(contenido),
      });
      entrada.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('crea una plataforma por nombre y agrupa sus sondajes', async () => {
      const { fixture } = await montar();

      await importar(
        fixture,
        [
          'Plataforma;Este;Norte;Altitud;Cuerpo de Agua;Distancia;Código del Sondaje;Profundidad;Inclinación;Azimut',
          'PL-01;431250;8674320;4820;Quebrada Las Dunas;150;DDH-01A;80;-15;45',
          'PL-01;431250;8674320;4820;Quebrada Las Dunas;150;DDH-01B;120;-20;60',
          'PL-02;431300;8674400;4800;Laguna Azul;80;DDH-02A;60;0;90',
        ].join('\n'),
      );

      expect(filasDeInventario(fixture).length).toBe(2);
      expect(filasDeInventario(fixture)[0]!.cells[1]!.textContent).toContain('PL-01');
      expect(filasDeInventario(fixture)[0]!.cells[5]!.textContent).toContain('2 ddh');
      expect(filasDeInventario(fixture)[1]!.cells[5]!.textContent).toContain('1 ddh');
      expect(filasDeInventario(fixture)[0]!.cells[4]!.textContent).toContain('Quebrada Las Dunas');
    });

    it('abre el popup con los sondajes importados ya cargados', async () => {
      const { fixture } = await montar();

      await importar(
        fixture,
        'Plataforma,Este,Norte,Código del Sondaje,Profundidad\nPL-01,431250,8674320,DDH-01,80',
      );

      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const campos = camposDeFicha(fixture);
      expect(campos[0]!.value).toBe('PL-01');
      expect(campos[1]!.value).toBe('431250');
      const sondaje = camposDeSondaje(filasDeSondajes(fixture)[0]!);
      expect(sondaje[0]!.value).toBe('DDH-01');
      expect(sondaje[1]!.value).toBe('80');
    });

    it('acepta tabuladores como separador', async () => {
      const { fixture } = await montar();

      await importar(fixture, 'Plataforma\tSondaje\nPL-01\tDDH-01');

      expect(filasDeInventario(fixture).length).toBe(1);
      expect(filasDeInventario(fixture)[0]!.cells[5]!.textContent).toContain('1 ddh');
    });

    it('descarta las filas sin nombre de plataforma y lo dice', async () => {
      const { fixture } = await montar();

      await importar(fixture, 'Plataforma;Sondaje\n;DDH-01\n;DDH-02');

      expect(filasDeInventario(fixture).length).toBe(1); // solo la de vacío
      expect(nodo(fixture, '.aviso').textContent).toContain('2 fila(s) descartada(s)');
    });

    it('fusiona con una plataforma ya escrita en vez de duplicarla', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture, 'PL-01', 'DDH-01');

      await importar(fixture, 'Plataforma;Sondaje;Profundidad\npl-01;DDH-09;99');

      expect(filasDeInventario(fixture).length).toBe(1);
      expect(filasDeInventario(fixture)[0]!.cells[5]!.textContent).toContain('2 ddh');
      expect(nodo(fixture, '.aviso').textContent).toContain('fusionada');
    });

    it('respeta el tope de diez plataformas al importar', async () => {
      const { fixture } = await montar();
      const filas = ['Plataforma;Sondaje'];
      for (let indice = 1; indice <= 14; indice++) {
        filas.push(`PL-${indice};DDH-${indice};60`);
      }

      await importar(fixture, filas.join('\n'));

      expect(filasDeInventario(fixture).length).toBe(10);
      expect(nodo(fixture, '.aviso').textContent).toContain('4 plataforma(s) omitida(s)');
    });

    it('avisa cuando el archivo no trae columna de plataforma', async () => {
      const { fixture } = await montar();

      await importar(fixture, 'Este;Norte\n431250;8674320');

      expect(filasDeInventario(fixture).length).toBe(1);
      expect(nodo(fixture, '.aviso').textContent).toContain('columna de plataforma reconocible');
    });

    it('no rompe la matriz cuando el archivo viene vacío', async () => {
      const { fixture } = await montar();

      await importar(fixture, '');

      expect(filasDeInventario(fixture).length).toBe(1);
    });
  });

  describe('persistencia', () => {
    it('publica la matriz en el store y pone la sección en verde', async () => {
      const { fixture, store } = await montar();
      await registrarPlataforma(fixture, 'PL-01', 'DDH-01');

      nodo(fixture, '.boton-validar').click();
      fixture.detectChanges();

      expect(nodo(fixture, '.aviso').textContent).toContain('validados');
      expect(store.seccionPorNumero('2.7')?.estado).toBe('Verde');

      const guardada = store.matrizComponentesRegistrada();
      expect(guardada?.plataformas.length).toBe(1);
      expect(guardada?.plataformas[0]?.nombre).toBe('PL-01');
      expect(guardada?.plataformas[0]?.este).toBe(431250);
      expect(guardada?.plataformas[0]?.sondajes[0]?.codigo).toBe('DDH-01');
      expect(guardada?.plataformas[0]?.sondajes[0]?.profundidad).toBe(100);
    });

    it('guarda las tres matrices a la vez', async () => {
      const { fixture, store } = await montar();
      await registrarPlataforma(fixture);
      await registrarAuxiliar(fixture, 'Almacén');
      await registrarDimension(fixture, 'Pozas');

      nodo(fixture, '.boton-validar').click();
      fixture.detectChanges();

      const guardada = store.matrizComponentesRegistrada();
      expect(guardada?.plataformas.length).toBe(1);
      expect(guardada?.auxiliares.length).toBe(1);
      expect(guardada?.auxiliares[0]?.nombre).toBe('Almacén');
      expect(guardada?.auxiliares[0]?.este).toBe(431250);
      expect(guardada?.dimensiones.length).toBe(1);
      expect(guardada?.dimensiones[0]?.nombreComponente).toBe('Pozas');
      expect(guardada?.dimensiones[0]?.ancho).toBe(4);
      expect(guardada?.dimensiones[0]?.cantidad).toBe(2);
    });

    it('rehidrata las tres matrices cuando el componente se vuelve a crear', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture, 'PL-01', 'DDH-01');
      nodo(fixture, '.boton-validar').click();
      fixture.detectChanges();

      // Un componente nuevo debe encontrar la matriz, no las filas vacías.
      const { fixture: otro } = await montar();
      expect(filasDeInventario(otro).length).toBe(1);
      expect(filasDeInventario(otro)[0]!.cells[1]!.textContent).toContain('PL-01');
      expect(filasDeInventario(otro)[0]!.cells[5]!.textContent).toContain('1 ddh');
    });

    it('no duplica filas al rehidratar dos veces seguidas', async () => {
      const { fixture } = await montar();
      await registrarPlataforma(fixture);
      nodo(fixture, '.boton-validar').click();
      fixture.detectChanges();

      // El `effect` vuelve a correr en cada detección; no debe acumular filas.
      fixture.detectChanges();
      fixture.detectChanges();

      expect(filasDeInventario(fixture).length).toBe(1);
    });

    it('copia los sondajes al store, no los deja por referencia', async () => {
      const { fixture, store } = await montar();
      await registrarPlataforma(fixture, 'PL-01', 'DDH-01');
      nodo(fixture, '.boton-validar').click();
      fixture.detectChanges();

      const guardadoAntes =
        store.matrizComponentesRegistrada()?.plataformas[0]?.sondajes[0]?.codigo;
      botonEn(filasDeInventario(fixture)[0]!, 'Editar').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      escribir(fixture, camposDeSondaje(filasDeSondajes(fixture)[0]!)[0]!, 'DDH-REESCRITO');
      boton(fixture, 'Grabar Componente').click();
      fixture.detectChanges();

      // Editar la plataforma sí actualiza el inventario, pero no lo que ya
      // está publicado en el store: eso solo cambia al volver a validar.
      expect(store.matrizComponentesRegistrada()?.plataformas[0]?.sondajes[0]?.codigo).toBe(
        guardadoAntes,
      );
    });
  });
});

/**
 * Archivo simulado para alimentar el `input[type=file]`.
 *
 * Se devuelve como lista y no como `FileList`: el componente solo indexa
 * `files[0]`, y el entorno de pruebas no implementa `DataTransfer`.
 */
function archivoFalso(contenido: string): File[] {
  return [new File([contenido], 'plataformas.csv', { type: 'text/csv' })];
}
