import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonalComponent } from './personal.component';
import {
  DaexStore,
  ETAPAS_BASE_CRONOGRAMA,
  type DotacionEtapa,
  type EtapaCronograma,
} from '../../../../state/daex.store';

describe('PersonalComponent', () => {
  /** Levanta el componente con el store real y la sección 2.10. */
  async function montar(): Promise<{
    fixture: ComponentFixture<PersonalComponent>;
    store: DaexStore;
  }> {
    const fixture = TestBed.createComponent(PersonalComponent);
    const store = TestBed.inject(DaexStore);
    fixture.componentRef.setInput('numero', '2.10');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  /** Primer elemento que coincide con el selector, con mensaje si falta. */
  function nodo<T extends HTMLElement>(
    fixture: ComponentFixture<PersonalComponent>,
    selector: string,
  ): T {
    const encontrado = fixture.nativeElement.querySelector(selector) as T | null;
    if (!encontrado) {
      throw new Error(`No se encontró ${selector} en la plantilla de la 2.10`);
    }
    return encontrado;
  }

  /** Igual, pero tolerante: `null` en vez de excepción. */
  function opcional<T extends HTMLElement>(
    fixture: ComponentFixture<PersonalComponent>,
    selector: string,
  ): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  /** Filas del cuadro de personal. */
  function filasDe(fixture: ComponentFixture<PersonalComponent>): HTMLTableRowElement[] {
    return Array.from<HTMLTableRowElement>(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  /** Escribe en un input como lo haría el navegador. */
  function escribir(
    fixture: ComponentFixture<PersonalComponent>,
    input: HTMLInputElement | HTMLTextAreaElement,
    valor: string,
  ): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Elige una opción del selector como lo haría el navegador. */
  function elegir(
    fixture: ComponentFixture<PersonalComponent>,
    select: HTMLSelectElement,
    valor: string,
  ): void {
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  /**
   * Pulsa el primer botón del subárbol cuyo rótulo termine en el fragmento.
   *
   * Los rótulos llevan delante el glifo de la acción, así que la coincidencia es
   * por cola: comparar con `includes` haría que un rótulo junto a otro ganara la
   * carrera y el clic caería en el botón equivocado sin avisar.
   */
  function botonEn(raiz: HTMLElement, texto: string): HTMLButtonElement {
    const encontrado = Array.from<HTMLButtonElement>(raiz.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().endsWith(texto),
    );
    if (!encontrado) {
      throw new Error(`No se encontró el botón «${texto}»`);
    }
    return encontrado;
  }

  /** Pulsa el primer botón del componente cuyo rótulo termine en el fragmento. */
  function boton(fixture: ComponentFixture<PersonalComponent>, texto: string): HTMLButtonElement {
    return botonEn(fixture.nativeElement as HTMLElement, texto);
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

  /** Detecta cambios y deja que los `NgModel` en vuelo se monten. */
  async function asentar(fixture: ComponentFixture<PersonalComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Un input o `textarea` del popup por su `id`. */
  function campoDe(
    fixture: ComponentFixture<PersonalComponent>,
    id: string,
  ): HTMLInputElement | HTMLTextAreaElement {
    const encontrado = fixture.nativeElement.querySelector(`#${id}`);
    if (!encontrado) {
      throw new Error(`El popup no tiene el campo #${id}`);
    }
    return encontrado as HTMLInputElement | HTMLTextAreaElement;
  }

  /**
   * Abre el popup de una etapa y espera a que `ngModel` lo haya pintado.
   *
   * `NgModel` monta su control en un microtask, así que sin este `whenStable`
   * los inputs se leen vacíos aunque el signal del borrador ya tenga el valor.
   */
  async function configurar(
    fixture: ComponentFixture<PersonalComponent>,
    indiceFila: number,
  ): Promise<void> {
    botonEn(filasDe(fixture)[indiceFila]!, 'Editar').click();
    await asentar(fixture);
  }

  /** Configura una etapa completa desde su popup. */
  async function configurarEtapa(
    fixture: ComponentFixture<PersonalComponent>,
    indiceFila: number,
    campos: Partial<{
      cantidad: string;
      origen: string;
      especializacion: string;
    }> = {},
  ): Promise<void> {
    await configurar(fixture, indiceFila);
    const valores = {
      cantidad: '15',
      origen: 'LOCAL',
      especializacion: 'Ingenieros geólogos y técnicos perforistas.',
      ...campos,
    };
    escribir(fixture, campoDe(fixture, 'modal-personal-cantidad'), valores.cantidad);
    elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-personal-origen'), valores.origen);
    escribir(fixture, campoDe(fixture, 'modal-personal-especializacion'), valores.especializacion);
    boton(fixture, 'Configurar Etapa').click();
    await asentar(fixture);
  }

  /** Deja todas las etapas configuradas y lista para validar. */
  async function completarTodas(fixture: ComponentFixture<PersonalComponent>): Promise<void> {
    const total = filasDe(fixture).length;
    for (let indice = 0; indice < total; indice += 1) {
      await configurarEtapa(fixture, indice, {
        especializacion: `Perfil de la etapa ${indice + 1}.`,
      });
    }
  }

  /** Etapa de cronograma para armar los datos de prueba. */
  function etapa(id: string, nombre: string, dependeDe: readonly string[] = []): EtapaCronograma {
    return {
      id,
      nombre,
      hito: `Hito de ${nombre}`,
      meses: 12,
      inversion: 1_000_000,
      dependeDe,
      fechaInicio: '',
    };
  }

  /** Dotación válida para el store. */
  function dotacionValida(etapaId: string, etapaNombre: string, cantidad: number): DotacionEtapa {
    return {
      etapaId,
      etapaNombre,
      cantidad,
      origen: 'LOCAL',
      especializacion: `Perfil de ${etapaNombre}.`,
    };
  }

  describe('precarga de etapas', () => {
    it('arranca con la cabecera estándar de la sección 2.10', async () => {
      const { fixture } = await montar();

      expect(nodo(fixture, '.cabecera .etiqueta').textContent).toContain('2.10');
      expect(nodo(fixture, '.cabecera .titulo').textContent).toContain('Personal Requerido');
      expect(nodo(fixture, '.cabecera .bajada').textContent).toContain('número de trabajadores');
    });

    it('precarga las cuatro etapas base del capítulo II, sin dotación', async () => {
      const { fixture } = await montar();

      expect(filasDe(fixture).length).toBe(4);
      const texto = nodo(fixture, 'tbody').textContent ?? '';
      for (const base of ETAPAS_BASE_CRONOGRAMA) {
        expect(texto).toContain(base.nombre);
      }
      // Ninguna etapa nace dotada: el titular declara personal por etapa.
      expect(texto).toContain('Pendiente');
      expect(texto).toContain('--');
      expect(texto).toContain('...');
    });

    it('no deja ningún input dentro de la grilla', async () => {
      const { fixture } = await montar();

      expect(opcional(fixture, 'table input')).toBeNull();
      expect(opcional(fixture, 'table select')).toBeNull();
      expect(opcional(fixture, 'table textarea')).toBeNull();
    });

    it('toma las etapas del cronograma validado en vez de las base', async () => {
      const { fixture, store } = await montar();
      store.registrarCronograma([
        etapa('ET-9', 'Prospección profunda'),
        etapa('ET-10', 'Cierreáneo', ['ET-9']),
      ]);
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(2);
      const texto = nodo(fixture, 'tbody').textContent ?? '';
      expect(texto).toContain('Prospección profunda');
      expect(texto).toContain('Cierreáneo');
      expect(texto).not.toContain('Explotación');
    });

    it('recorta las etapas del cronograma que no tienen duración', async () => {
      const { fixture, store } = await montar();
      // El store descarta las etapas de cero meses al publicar el cronograma, así
      // que la 2.10 no pueda recibir una etapa que el Gantt tampoco muestra.
      store.registrarCronograma([
        etapa('ET-9', 'Prospección'),
        { ...etapa('ET-10', 'Sin plazo'), meses: 0 },
      ]);
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).toContain('Prospección');
    });

    it('conserva la dotación de una etapa aunque el cronograma cambie de orden', async () => {
      const { fixture, store } = await montar();
      store.registrarDotacionPersonal([
        dotacionValida('ET-3', 'Explotación', 60),
        dotacionValida('ET-1', 'Exploración', 15),
      ]);
      // El titular reordena el Gantt: la dotación debe seguir en su etapa.
      store.registrarCronograma([etapa('ET-3', 'Explotación'), etapa('ET-1', 'Exploración')]);
      await asentar(fixture);

      const texto = nodo(fixture, 'tbody').textContent ?? '';
      // La fila 1 es Explotación y la 2 Exploración, cada una con su dotación.
      expect(digitos(filasDe(fixture)[0]!.textContent ?? '')).toContain('60');
      expect(digitos(filasDe(fixture)[1]!.textContent ?? '')).toContain('15');
      expect(texto).not.toContain('Pendiente');
    });

    it('deja de mostrar una etapa que el cronograma ya no tiene', async () => {
      const { fixture, store } = await montar();
      store.registrarDotacionPersonal([
        dotacionValida('ET-1', 'Exploración', 15),
        dotacionValida('ET-3', 'Explotación', 60),
      ]);
      await asentar(fixture);

      store.registrarCronograma([etapa('ET-3', 'Explotación')]);
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(1);
      expect(nodo(fixture, 'tbody').textContent).not.toContain('Exploración');
    });

    it('precarga sola una etapa nueva que el titular agregue al cronograma', async () => {
      const { fixture, store } = await montar();
      store.registrarDotacionPersonal([dotacionValida('ET-1', 'Exploración', 15)]);
      await asentar(fixture);

      store.registrarCronograma([
        etapa('ET-1', 'Exploración'),
        etapa('ET-7', 'Expansión de planta'),
      ]);
      await asentar(fixture);

      expect(filasDe(fixture).length).toBe(2);
      const texto = nodo(fixture, 'tbody').textContent ?? '';
      expect(texto).toContain('Expansión de planta');
      expect(digitos(filasDe(fixture)[0]!.textContent ?? '')).toContain('15');
      expect(filasDe(fixture)[1]!.textContent).toContain('Pendiente');
    });
  });

  describe('modal de dotación', () => {
    it('abre con la etapa ya cargada y el botón deshabilitado', async () => {
      const { fixture } = await montar();
      await configurar(fixture, 0);

      expect(opcional(fixture, '[role="dialog"]')).not.toBeNull();
      expect(nodo(fixture, '[role="dialog"] h4').textContent).toContain('Exploración');
      // El input refleja el `null` del borrador como cadena vacía: es el DOM el
      // que no puede contener nulos, no la fila.
      expect((campoDe(fixture, 'modal-personal-cantidad') as HTMLInputElement).value).toBe('');
      expect(boton(fixture, 'Configurar Etapa').disabled).toBe(true);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('operarios');
    });

    it('ofrece las dos procedencias y ninguna por defecto', async () => {
      const { fixture } = await montar();
      await configurar(fixture, 0);

      const selector = nodo<HTMLSelectElement>(fixture, '#modal-personal-origen');
      expect(Array.from(selector.options).map((opcion) => opcion.value)).toEqual([
        '',
        'LOCAL',
        'FORANEO',
      ]);
    });

    it('explica cada campo que falta, en el orden en que se relee', async () => {
      const { fixture } = await montar();
      await configurar(fixture, 0);

      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('operarios');

      escribir(fixture, campoDe(fixture, 'modal-personal-cantidad'), '15');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('origen');

      elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-personal-origen'), 'LOCAL');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('perfil');

      escribir(fixture, campoDe(fixture, 'modal-personal-especializacion'), 'Ingenieros geólogos.');
      expect(opcional(fixture, '[role="dialog"] .pendiente')).toBeNull();
    });

    it('trata un campo vacío como «sin llenar» y no como cero', async () => {
      const { fixture } = await montar();
      await configurar(fixture, 0);
      elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-personal-origen'), 'LOCAL');
      escribir(fixture, campoDe(fixture, 'modal-personal-especializacion'), 'Ingenieros geólogos.');

      const cantidad = campoDe(fixture, 'modal-personal-cantidad') as HTMLInputElement;
      escribir(fixture, cantidad, '15');
      escribir(fixture, cantidad, '');

      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('operarios');
      expect(boton(fixture, 'Configurar Etapa').disabled).toBe(true);
    });

    it('deja la etapa pendiente si se cierra a medio rellenar', async () => {
      const { fixture } = await montar();
      await configurar(fixture, 0);
      escribir(fixture, campoDe(fixture, 'modal-personal-cantidad'), '15');
      boton(fixture, 'Cancelar').click();
      await asentar(fixture);

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(filasDe(fixture)[0]!.textContent).toContain('Pendiente');
    });

    it('cierra con Escape sin declarar la dotación', async () => {
      const { fixture } = await montar();
      await configurar(fixture, 0);
      escribir(fixture, campoDe(fixture, 'modal-personal-cantidad'), '15');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await asentar(fixture);

      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(filasDe(fixture)[0]!.textContent).toContain('Pendiente');
    });

    it('configura la etapa y la muestra en la grilla', async () => {
      const { fixture } = await montar();
      await configurarEtapa(fixture, 0, { cantidad: '15', origen: 'LOCAL' });

      const fila = filasDe(fixture)[0]!;
      expect(fila.textContent).toContain('15 operarios');
      expect(fila.textContent).toContain('LOCAL');
      expect(fila.textContent).toContain('Ingenieros geólogos');
      expect(fila.textContent).not.toContain('Pendiente');
      expect(nodo(fixture, '.aviso').textContent).toContain('registrada');
    });

    it('distingue visualmente el origen local del foráneo', async () => {
      const { fixture } = await montar();
      await configurarEtapa(fixture, 0, { origen: 'LOCAL' });
      expect(nodo(fixture, '.origen').classList).toContain('origen-local');

      await configurarEtapa(fixture, 0, { origen: 'FORANEO' });
      const distintivo = nodo(fixture, '.origen');
      expect(distintivo.classList).toContain('origen-foraneo');
      // Un binding de `[class]` con cadena reemplazaría el formato del distintivo.
      expect(distintivo.classList).toContain('rounded-full');
    });

    it('edita la dotación de una etapa sin tocar las demás', async () => {
      const { fixture } = await montar();
      await configurarEtapa(fixture, 0, { cantidad: '15' });
      await configurarEtapa(fixture, 2, {
        cantidad: '60',
        especializacion: 'Operadores de planta.',
      });

      expect(filasDe(fixture)[0]!.textContent).toContain('15 operarios');
      expect(filasDe(fixture)[2]!.textContent).toContain('60 operarios');

      await configurarEtapa(fixture, 0, { cantidad: '22' });
      expect(filasDe(fixture)[0]!.textContent).toContain('22 operarios');
      expect(filasDe(fixture)[2]!.textContent).toContain('60 operarios');
    });
  });

  describe('validación de la sección', () => {
    it('bloquea mientras alguna etapa siga pendiente', async () => {
      const { fixture } = await montar();
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('4 de 4');

      await configurarEtapa(fixture, 0);
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('3 de 4');
    });

    it('habilita la validación cuando las cuatro etapas quedan dotadas', async () => {
      const { fixture } = await montar();
      await completarTodas(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(false);
      expect(nodo(fixture, '.pendiente--lista').textContent).toContain('lista para validar');
    });

    it('publica la dotación y pone la sección en verde', async () => {
      const { fixture, store } = await montar();
      await completarTodas(fixture);
      boton(fixture, 'Guardar y Validar Sección 2.10').click();
      await asentar(fixture);

      expect(store.seccionPorNumero('2.10')?.estado).toBe('Verde');
      expect(nodo(fixture, '.aviso').textContent).toContain('validada');

      const guardada = store.dotacionPersonalRegistrada();
      expect(guardada.length).toBe(4);
      expect(guardada.map((fila) => fila.etapaId)).toEqual(['ET-1', 'ET-2', 'ET-3', 'ET-4']);
      expect(guardada.every((fila) => fila.cantidad !== null && fila.origen !== '')).toBe(true);
    });

    it('no publica nada mientras quede una etapa pendiente', async () => {
      const { fixture, store } = await montar();
      await configurarEtapa(fixture, 0);
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);

      // El botón deshabilitado es la mitad visible del guardia; la otra mitad
      // está en el propio método, así que se invoca directo para comprobar que
      // tampoco publica por la vía que no pasa por el botón.
      const componente = fixture.componentInstance as unknown as {
        guardarYValidarPersonalSeccion(): void;
      };
      componente.guardarYValidarPersonalSeccion();
      await asentar(fixture);

      expect(store.dotacionPersonalRegistrada().length).toBe(0);
      expect(store.seccionPorNumero('2.10')?.estado).not.toBe('Verde');
      expect(nodo(fixture, '.aviso').textContent).toContain('3 de 4');
    });

    it('cuenta los operarios declarados de todas las etapas', async () => {
      const { fixture } = await montar();
      await configurarEtapa(fixture, 0, { cantidad: '15' });
      await configurarEtapa(fixture, 1, { cantidad: '20' });

      // 15 + 20 = 35 operarios en dos etapas de cuatro.
      const contador = nodo(fixture, '.contador-bloque').textContent ?? '';
      expect(contador).toContain('2 de 4');
      expect(digitos(contador)).toContain('35');
    });
  });

  describe('persistencia', () => {
    it('rehidrata la dotación al volver a la sección', async () => {
      const { fixture, store } = await montar();
      store.registrarDotacionPersonal([
        dotacionValida('ET-1', 'Exploración', 15),
        dotacionValida('ET-4', 'Cierre', 8),
      ]);
      await asentar(fixture);

      expect(digitos(filasDe(fixture)[0]!.textContent ?? '')).toContain('15');
      expect(digitos(filasDe(fixture)[3]!.textContent ?? '')).toContain('8');
      // Las etapas sin dotación guardada siguen pendientes.
      expect(filasDe(fixture)[1]!.textContent).toContain('Pendiente');
    });

    it('no pisa lo que el titular está tecleando en otra etapa', async () => {
      const { fixture, store } = await montar();
      store.registrarDotacionPersonal([dotacionValida('ET-1', 'Exploración', 15)]);
      await asentar(fixture);

      // El titular deja el popup de Explotación abierto y ya lo tiene completo,
      // sin pulsar «Configurar Etapa». En ese momento se publica una dotación
      // distinta, como si el Gantt se revalidara en otra pestaña.
      await configurar(fixture, 2);
      escribir(fixture, campoDe(fixture, 'modal-personal-cantidad'), '60');
      elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-personal-origen'), 'FORANEO');
      escribir(
        fixture,
        campoDe(fixture, 'modal-personal-especializacion'),
        'Operadores de planta.',
      );
      store.registrarDotacionPersonal([
        dotacionValida('ET-1', 'Exploración', 99),
        dotacionValida('ET-2', 'Construcción', 40),
      ]);
      await asentar(fixture);

      boton(fixture, 'Configurar Etapa').click();
      await asentar(fixture);

      // La rehidratación traía ET-1 y ET-2, pero no puede haber pisado el
      // borrador que estaba en pantalla: Explotación sigue con sus 60.
      expect(opcional(fixture, '[role="dialog"]')).toBeNull();
      expect(digitos(filasDe(fixture)[0]!.textContent ?? '')).toContain('99');
      expect(digitos(filasDe(fixture)[1]!.textContent ?? '')).toContain('40');
      expect(digitos(filasDe(fixture)[2]!.textContent ?? '')).toContain('60');
    });
  });
});
