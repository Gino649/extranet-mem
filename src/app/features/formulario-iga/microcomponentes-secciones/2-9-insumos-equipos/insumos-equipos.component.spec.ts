import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InsumosEquiposComponent } from './insumos-equipos.component';
import {
  DaexStore,
  type EquipoCatalogo,
  type InsumoCatalogo,
  type UnidadInsumo,
} from '../../../../state/daex.store';

describe('InsumosEquiposComponent', () => {
  /** Levanta el componente con el store real y la sección 2.9. */
  async function montar(): Promise<{
    fixture: ComponentFixture<InsumosEquiposComponent>;
    store: DaexStore;
  }> {
    const fixture = TestBed.createComponent(InsumosEquiposComponent);
    const store = TestBed.inject(DaexStore);
    fixture.componentRef.setInput('numero', '2.9');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  /** Primer elemento que coincide con el selector, con mensaje si falta. */
  function nodo<T extends HTMLElement>(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    selector: string,
  ): T {
    const encontrado = fixture.nativeElement.querySelector(selector) as T | null;
    if (!encontrado) {
      throw new Error(`No se encontró ${selector} en la plantilla de la 2.9`);
    }
    return encontrado;
  }

  /** Igual, pero tolerante: `null` en vez de excepción. */
  function opcional<T extends HTMLElement>(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    selector: string,
  ): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  /**
   * Primer elemento que coincide con el selector dentro de un subárbol.
   *
   * Las dos tablas se consultan por su posición entre las `<table>` del
   * componente: es lo que permite afirmar "la fila de insumos" sin depender de
   * las clases de cada `<tr>`.
   */
  function enTabla<T extends HTMLElement>(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    indice: number,
    selector: string,
  ): T | null {
    const tabla = fixture.nativeElement.querySelectorAll('table')[indice] as HTMLElement;
    return tabla.querySelector(selector) as T | null;
  }

  /** Filas de la tabla indicada (0 = insumos, 1 = equipos). */
  function filasDe(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    indice: number,
  ): HTMLTableRowElement[] {
    const tabla = fixture.nativeElement.querySelectorAll('table')[indice] as HTMLElement;
    return Array.from<HTMLTableRowElement>(tabla.querySelectorAll('tbody tr'));
  }

  /** Texto de las filas de datos de la tabla indicada. */
  function cuerpoDe(fixture: ComponentFixture<InsumosEquiposComponent>, indice: number): string {
    return enTabla(fixture, indice, 'tbody')?.textContent ?? '';
  }

  /** Escribe en un input como lo haría el navegador. */
  function escribir(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    input: HTMLInputElement,
    valor: string,
  ): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Elige una opción del selector como lo haría el navegador. */
  function elegir(
    fixture: ComponentFixture<InsumosEquiposComponent>,
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
   * Los rótulos llevan delante el glifo de la acción ("✏️ Editar", "✕
   * Eliminar"), así que la coincidencia es por cola. Comparar con `includes`
   * haría que un rótulo junto a otro ganara la carrera, y el clic caería en el
   * botón equivocado sin avisar.
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
  function boton(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    texto: string,
  ): HTMLButtonElement {
    return botonEn(fixture.nativeElement as HTMLElement, texto);
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

  /**
   * Subtotales del encabezado de insumos, uno por unidad declarada.
   *
   * Se leen los `<span>` y no el `<p>` entero porque los subtotales van separados
   * por unidades distintas: sobre el texto completo los dígitos de un subtotal se
   * pegarían a los del anterior y la comprobación dejaría de ser exacta.
   */
  function subtotalesDeInsumos(fixture: ComponentFixture<InsumosEquiposComponent>): string[] {
    return Array.from<HTMLElement>(
      nodo(fixture, '.contador-bloque').querySelectorAll('.subtotal-unidad'),
    ).map((subtotal) => subtotal.textContent ?? '');
  }

  /** Subtotales del encabezado de equipos; debe haber exactamente uno. */
  function subtotalesDeEquipos(fixture: ComponentFixture<InsumosEquiposComponent>): string[] {
    const contadores = fixture.nativeElement.querySelectorAll(
      '.contador-bloque',
    ) as NodeListOf<HTMLElement>;
    const equipos = contadores[1];
    if (!equipos) {
      throw new Error('No se encontró el contador de la matriz de equipos');
    }
    return Array.from<HTMLElement>(equipos.querySelectorAll('.subtotal-unidad')).map(
      (subtotal) => subtotal.textContent ?? '',
    );
  }

  /** Detecta cambios y deja que los `NgModel` en vuelo se monten. */
  async function asentar(fixture: ComponentFixture<InsumosEquiposComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** El popup abierto, o `null` si no hay ninguno. */
  function popup(fixture: ComponentFixture<InsumosEquiposComponent>): HTMLElement | null {
    return opcional<HTMLElement>(fixture, '[role="dialog"]');
  }

  /** Un input del popup por su `id`. */
  function campoDe(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    id: string,
  ): HTMLInputElement {
    const encontrado = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement | null;
    if (!encontrado) {
      throw new Error(`El popup no tiene el campo #${id}`);
    }
    return encontrado;
  }

  /** El `textarea` del popup de equipos. */
  function areaDe(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    id: string,
  ): HTMLTextAreaElement {
    const encontrado = fixture.nativeElement.querySelector(`#${id}`) as HTMLTextAreaElement | null;
    if (!encontrado) {
      throw new Error(`El popup no tiene el área #${id}`);
    }
    return encontrado;
  }

  /**
   * Abre un popup y espera a que `ngModel` lo haya pintado.
   *
   * `NgModel` monta su control en un microtask, así que sin este `whenStable`
   * los inputs se leen vacíos aunque el signal del borrador ya tenga el valor.
   */
  async function abrirPopup(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    textoBoton: string,
  ): Promise<void> {
    boton(fixture, textoBoton).click();
    await asentar(fixture);
  }

  /** Abre el popup de insumos con solo la descripción y la cantidad puestas. */
  async function abrirInsumo(fixture: ComponentFixture<InsumosEquiposComponent>): Promise<void> {
    await abrirPopup(fixture, 'Nuevo Insumo');
  }

  /** Abre el popup de equipos con solo el nombre y la cantidad puestos. */
  async function abrirEquipo(fixture: ComponentFixture<InsumosEquiposComponent>): Promise<void> {
    await abrirPopup(fixture, 'Nuevo Equipo');
  }

  /** Registra un insumo completo desde su popup. */
  async function registrarInsumo(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    campos: Partial<{
      nombre: string;
      cantidad: string;
      unidad: UnidadInsumo;
    }> = {},
  ): Promise<void> {
    await abrirInsumo(fixture);
    const valores = {
      nombre: 'Bentonita en polvo',
      cantidad: '1250',
      unidad: 'KG' as UnidadInsumo,
      ...campos,
    };
    escribir(fixture, campoDe(fixture, 'modal-ins-nombre'), valores.nombre);
    escribir(fixture, campoDe(fixture, 'modal-ins-cantidad'), valores.cantidad);
    elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-ins-unidad'), valores.unidad);
    boton(fixture, 'Grabar Insumo').click();
    await asentar(fixture);
  }

  /** Registra un equipo completo desde su popup. */
  async function registrarEquipo(
    fixture: ComponentFixture<InsumosEquiposComponent>,
    campos: Partial<{
      nombre: string;
      especificaciones: string;
      cantidad: string;
    }> = {},
  ): Promise<void> {
    await abrirEquipo(fixture);
    const valores = {
      nombre: 'Perforadora diamantina sobre orugas',
      especificaciones: 'Motor Diesel 150 HP, perforación HQ hasta 600 m.',
      cantidad: '2',
      ...campos,
    };
    escribir(fixture, campoDe(fixture, 'modal-eq-nombre'), valores.nombre);
    areaDe(fixture, 'modal-eq-especificaciones').value = valores.especificaciones;
    areaDe(fixture, 'modal-eq-especificaciones').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    escribir(fixture, campoDe(fixture, 'modal-eq-cantidad'), valores.cantidad);
    boton(fixture, 'Grabar Equipo').click();
    await asentar(fixture);
  }

  /** Deja las dos matrices con una fila cada una, como tras validar. */
  async function declararInventario(
    fixture: ComponentFixture<InsumosEquiposComponent>,
  ): Promise<void> {
    await registrarInsumo(fixture);
    await registrarEquipo(fixture);
  }

  /** Insumo válido para el store. */
  function insumoValido(id = 'ins-1'): InsumoCatalogo {
    return {
      id,
      nombre: 'Bentonita en polvo',
      cantidad: 1250,
      unidadMedida: 'KG',
    };
  }

  /** Equipo válido para el store. */
  function equipoValido(id = 'eq-1'): EquipoCatalogo {
    return {
      id,
      nombre: 'Perforadora diamantina sobre orugas',
      especificaciones: 'Motor Diesel 150 HP, perforación HQ hasta 600 m.',
      cantidad: 2,
    };
  }

  describe('encabezado y grillas', () => {
    it('arranca con la cabecera estándar de la sección 2.9', async () => {
      const { fixture } = await montar();

      expect(nodo(fixture, '.cabecera .etiqueta').textContent).toContain('2.9');
      expect(nodo(fixture, '.cabecera .titulo').textContent).toContain(
        'Insumos, Maquinarias y Equipos',
      );
      expect(nodo(fixture, '.cabecera .bajada').textContent).toContain('inventario técnico');
    });

    it('arranca con las dos matrices vacías y su mensaje', async () => {
      const { fixture } = await montar();

      expect(cuerpoDe(fixture, 0)).toContain('No hay insumos declarados');
      expect(cuerpoDe(fixture, 1)).toContain('No hay equipos o maquinarias declaradas');
    });

    it('no deja ningún input dentro de las grillas', async () => {
      const { fixture } = await montar();
      await declararInventario(fixture);

      expect(opcional(fixture, 'table input')).toBeNull();
      expect(opcional(fixture, 'table select')).toBeNull();
      expect(opcional(fixture, 'table textarea')).toBeNull();
    });

    it('numera las filas y muestra cantidad y unidad de cada insumo', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture, { cantidad: '1250', unidad: 'KG' });

      const fila = filasDe(fixture, 0)[0]!;
      expect(digitos(nodo(fixture, '.cantidad-insumo').textContent ?? '')).toBe('1250');
      expect(fila.textContent).toContain('KG');
      expect(fila.textContent).toContain('Bentonita en polvo');
    });

    it('agrupa los subtotales de insumos por unidad, sin sumarlos entre sí', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture, { cantidad: '1250', unidad: 'KG' });
      await registrarInsumo(fixture, {
        nombre: 'Grasas de perforación',
        cantidad: '40',
        unidad: 'GL',
      });

      // 40 galones y 1.250 kilogramos no son comparables: el encabezado anuncia
      // un subtotal por unidad en lugar de una cifra única.
      expect(nodo(fixture, '.contador-bloque').textContent).toContain('2 insumo(s)');
      const subtotales = subtotalesDeInsumos(fixture);
      expect(subtotales).toHaveLength(2);
      expect(digitos(subtotales[0]!)).toBe('1250');
      expect(subtotales[0]).toContain('KG');
      expect(digitos(subtotales[1]!)).toBe('40');
      expect(subtotales[1]).toContain('GL');
    });

    it('totaliza las unidades de maquinaria, que sí son homogéneas', async () => {
      const { fixture } = await montar();
      await registrarEquipo(fixture, { cantidad: '2' });
      await registrarEquipo(fixture, {
        nombre: 'Cargador frontal sobre ruedas',
        especificaciones: 'Balde 3 m³, motor Diesel 110 HP.',
        cantidad: '3',
      });

      const subtotales = subtotalesDeEquipos(fixture);
      expect(subtotales).toHaveLength(1);
      // 2 + 3 = 5 unidades.
      expect(digitos(subtotales[0]!)).toBe('5');
    });

    it('totaliza las unidades de maquinaria, que sí son homogéneas', async () => {
      const { fixture } = await montar();
      await registrarEquipo(fixture, { cantidad: '2' });
      await registrarEquipo(fixture, {
        nombre: 'Cargador frontal sobre或个人 ruedas',
        especificaciones: 'Balde 3 m³, motor Diesel 110 HP.',
        cantidad: '3',
      });

      const subtotales = subtotalesDeEquipos(fixture);
      expect(subtotales).toHaveLength(1);
      // 2 + 3 = 5 unidades.
      expect(digitos(subtotales[0]!)).toBe('5');
    });
  });

  describe('modal de insumo', () => {
    it('abre en blanco, con el botón de grabar deshabilitado y su motivo', async () => {
      const { fixture } = await montar();
      await abrirInsumo(fixture);

      expect(popup(fixture)).not.toBeNull();
      expect(campoDe(fixture, 'modal-ins-nombre').value).toBe('');
      expect(botonEn(popup(fixture)!, 'Grabar Insumo').disabled).toBe(true);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('Describa');
    });

    it('ofrece las cuatro unidades de la norma', async () => {
      const { fixture } = await montar();
      await abrirInsumo(fixture);

      const selector = nodo<HTMLSelectElement>(fixture, '#modal-ins-unidad');
      expect(Array.from(selector.options).map((opcion) => opcion.value)).toEqual([
        '',
        'KG',
        'GL',
        'TN',
        'UND',
      ]);
    });

    it('explica cada campo que falta, en el orden en que se relee', async () => {
      const { fixture } = await montar();
      await abrirInsumo(fixture);

      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('Describa');

      escribir(fixture, campoDe(fixture, 'modal-ins-nombre'), 'Bentonita');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('cantidad');

      escribir(fixture, campoDe(fixture, 'modal-ins-cantidad'), '1250');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('unidad');

      elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-ins-unidad'), 'KG');
      expect(opcional(fixture, '[role="dialog"] .pendiente')).toBeNull();
    });

    it('trata un campo vacío como «sin llenar» y no como cero', async () => {
      const { fixture } = await montar();
      await abrirInsumo(fixture);
      escribir(fixture, campoDe(fixture, 'modal-ins-nombre'), 'Bentonita');
      elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-ins-unidad'), 'KG');

      const cantidad = campoDe(fixture, 'modal-ins-cantidad');
      escribir(fixture, cantidad, '1250');
      escribir(fixture, cantidad, '');

      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('cantidad');
      expect(botonEn(popup(fixture)!, 'Grabar Insumo').disabled).toBe(true);
    });

    it('registra el insumo y lo muestra en su grilla', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture, { unidad: 'GL' });

      expect(popup(fixture)).toBeNull();
      expect(filasDe(fixture, 0).length).toBe(1);
      expect(cuerpoDe(fixture, 0)).toContain('Bentonita en polvo');
      expect(cuerpoDe(fixture, 0)).toContain('GL');
      expect(nodo(fixture, '.aviso').textContent).toContain('registrado');
    });

    it('cancela sin grabar nada', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture);
      await abrirInsumo(fixture);
      escribir(fixture, campoDe(fixture, 'modal-ins-nombre'), 'Algo descartable');
      boton(fixture, 'Cancelar').click();
      await asentar(fixture);

      expect(popup(fixture)).toBeNull();
      expect(filasDe(fixture, 0).length).toBe(1);
      expect(cuerpoDe(fixture, 0)).not.toContain('Algo descartable');
    });
  });

  describe('modal de equipo', () => {
    it('abre en blanco, con el botón de grabar deshabilitado y su motivo', async () => {
      const { fixture } = await montar();
      await abrirEquipo(fixture);

      expect(popup(fixture)).not.toBeNull();
      expect(areaDe(fixture, 'modal-eq-especificaciones').value).toBe('');
      expect(botonEn(popup(fixture)!, 'Grabar Equipo').disabled).toBe(true);
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain(
        'equipo o maquinaria',
      );
    });

    it('exige las especificaciones además del nombre y la cantidad', async () => {
      const { fixture } = await montar();
      await abrirEquipo(fixture);

      escribir(fixture, campoDe(fixture, 'modal-eq-nombre'), 'Perforadora');
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('especificaciones');

      areaDe(fixture, 'modal-eq-especificaciones').value = 'Motor Diesel 150 HP.';
      areaDe(fixture, 'modal-eq-especificaciones').dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(nodo(fixture, '[role="dialog"] .pendiente').textContent).toContain('cantidad');

      escribir(fixture, campoDe(fixture, 'modal-eq-cantidad'), '2');
      expect(opcional(fixture, '[role="dialog"] .pendiente')).toBeNull();
    });

    it('registra el equipo y lo muestra en su grilla', async () => {
      const { fixture } = await montar();
      await registrarEquipo(fixture);

      expect(popup(fixture)).toBeNull();
      expect(filasDe(fixture, 1).length).toBe(1);
      expect(cuerpoDe(fixture, 1)).toContain('Perforadora diamantina sobre orugas');
      expect(cuerpoDe(fixture, 1)).toContain('150 HP');
      expect(nodo(fixture, '.aviso').textContent).toContain('registrado');
    });

    it('cierra con Escape sin grabar nada', async () => {
      const { fixture } = await montar();
      await registrarEquipo(fixture);
      await abrirEquipo(fixture);
      escribir(fixture, campoDe(fixture, 'modal-eq-nombre'), 'Algo descartable');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await asentar(fixture);

      expect(popup(fixture)).toBeNull();
      expect(filasDe(fixture, 1).length).toBe(1);
      expect(cuerpoDe(fixture, 1)).not.toContain('Algo descartable');
    });
  });

  describe('edición y eliminación', () => {
    it('edita el insumo en su sitio, sin duplicarlo', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture, { unidad: 'KG' });
      botonEn(filasDe(fixture, 0)[0]!, 'Editar').click();
      await asentar(fixture);

      // El popup abre con lo que ya tenía la fila.
      expect(campoDe(fixture, 'modal-ins-nombre').value).toBe('Bentonita en polvo');
      expect(nodo<HTMLSelectElement>(fixture, '#modal-ins-unidad').value).toBe('KG');

      escribir(fixture, campoDe(fixture, 'modal-ins-cantidad'), '2500');
      elegir(fixture, nodo<HTMLSelectElement>(fixture, '#modal-ins-unidad'), 'TN');
      boton(fixture, 'Grabar Insumo').click();
      await asentar(fixture);

      expect(filasDe(fixture, 0).length).toBe(1);
      expect(digitos(nodo(fixture, '.cantidad-insumo').textContent ?? '')).toBe('2500');
      expect(cuerpoDe(fixture, 0)).toContain('TN');
      expect(nodo(fixture, '.aviso').textContent).toContain('actualizado');
    });

    it('edita el equipo sin duplicarlo', async () => {
      const { fixture } = await montar();
      await registrarEquipo(fixture);
      botonEn(filasDe(fixture, 1)[0]!, 'Editar').click();
      await asentar(fixture);

      escribir(fixture, campoDe(fixture, 'modal-eq-cantidad'), '5');
      boton(fixture, 'Grabar Equipo').click();
      await asentar(fixture);

      expect(filasDe(fixture, 1).length).toBe(1);
      expect(digitos(nodo(fixture, '.cantidad-equipo').textContent ?? '')).toBe('5');
      expect(nodo(fixture, '.aviso').textContent).toContain('actualizado');
    });

    it('elimina el insumo y avisa de su baja', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture);
      botonEn(filasDe(fixture, 0)[0]!, 'Eliminar').click();
      await asentar(fixture);

      expect(cuerpoDe(fixture, 0)).toContain('No hay insumos declarados');
      expect(nodo(fixture, '.aviso').textContent).toContain('eliminado');
    });

    it('elimina solo la fila apuntada de insumos, no todas', async () => {
      const { fixture } = await montar();
      await registrarInsumo(fixture);
      await registrarInsumo(fixture, { nombre: 'Grasas de perforación', unidad: 'GL' });

      botonEn(filasDe(fixture, 0)[0]!, 'Eliminar').click();
      await asentar(fixture);

      expect(filasDe(fixture, 0).length).toBe(1);
      expect(cuerpoDe(fixture, 0)).not.toContain('Bentonita en polvo');
      expect(cuerpoDe(fixture, 0)).toContain('Grasas de perforación');
    });

    it('elimina el equipo y avisa de su baja', async () => {
      const { fixture } = await montar();
      await registrarEquipo(fixture);
      botonEn(filasDe(fixture, 1)[0]!, 'Eliminar').click();
      await asentar(fixture);

      expect(cuerpoDe(fixture, 1)).toContain('No hay equipos o maquinarias declaradas');
      expect(nodo(fixture, '.aviso').textContent).toContain('eliminado');
    });

    it('deja la otra matriz intacta al borrar en una', async () => {
      const { fixture } = await montar();
      await declararInventario(fixture);
      botonEn(filasDe(fixture, 0)[0]!, 'Eliminar').click();
      await asentar(fixture);

      expect(filasDe(fixture, 0).length).toBe(1);
      expect(filasDe(fixture, 1).length).toBe(1);
    });
  });

  describe('validación de la sección', () => {
    it('bloquea mientras falte cualquiera de las dos matrices', async () => {
      const { fixture } = await montar();
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('al menos un (1) insumo');

      await registrarInsumo(fixture);
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('al menos un (1) equipo');
    });

    it('habilita la validación con una fila en cada matriz', async () => {
      const { fixture } = await montar();
      await declararInventario(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(false);
      expect(nodo(fixture, '.pendiente--lista').textContent).toContain('listo para validar');
    });

    it('publica las dos matrices y pone la sección en verde', async () => {
      const { fixture, store } = await montar();
      await declararInventario(fixture);
      boton(fixture, 'Guardar y Validar Sección 2.9').click();
      await asentar(fixture);

      expect(store.seccionPorNumero('2.9')?.estado).toBe('Verde');
      expect(nodo(fixture, '.aviso').textContent).toContain('validado');

      const insumos = store.catalogoInsumosRegistrado();
      expect(insumos.length).toBe(1);
      expect(insumos[0]?.nombre).toBe('Bentonita en polvo');
      expect(insumos[0]?.cantidad).toBe(1250);
      expect(insumos[0]?.unidadMedida).toBe('KG');

      const equipos = store.catalogoEquiposRegistrado();
      expect(equipos.length).toBe(1);
      expect(equipos[0]?.nombre).toBe('Perforadora diamantina sobre orugas');
      expect(equipos[0]?.especificaciones).toContain('150 HP');
      expect(equipos[0]?.cantidad).toBe(2);
    });

    it('no publica nada mientras la grilla esté bloqueada', async () => {
      const { fixture, store } = await montar();
      await registrarInsumo(fixture);
      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);

      // El botón deshabilitado es la mitad visible del guardia; la otra mitad
      // está en el propio método, así que se invoca directo para comprobar que
      // tampoco publica por la vía que no pasa por el botón.
      const componente = fixture.componentInstance as unknown as {
        guardarYValidarInsumosSeccion(): void;
      };
      componente.guardarYValidarInsumosSeccion();
      await asentar(fixture);

      expect(store.catalogoInsumosRegistrado().length).toBe(0);
      expect(store.catalogoEquiposRegistrado().length).toBe(0);
      expect(store.seccionPorNumero('2.9')?.estado).not.toBe('Verde');
      expect(nodo(fixture, '.aviso').textContent).toContain('al menos un (1) equipo');
    });

    it('bloquea si el store trae un insumo repetido', async () => {
      const { fixture, store } = await montar();
      store.registrarCatalogoInsumos([insumoValido('ins-1'), insumoValido('ins-2')]);
      store.registrarCatalogoEquipos([equipoValido()]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('está repetido');
    });

    it('bloquea si el store trae un equipo repetido', async () => {
      const { fixture, store } = await montar();
      store.registrarCatalogoInsumos([insumoValido()]);
      store.registrarCatalogoEquipos([equipoValido('eq-1'), equipoValido('eq-2')]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('está repetido');
    });

    it('bloquea si el store trae un insumo sin cantidad', async () => {
      const { fixture, store } = await montar();
      store.registrarCatalogoInsumos([{ ...insumoValido(), cantidad: 0 }]);
      store.registrarCatalogoEquipos([equipoValido()]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('mayor que cero');
    });

    it('trata como repetidos dos descripciones tecleadas con distinto ritmo', async () => {
      const { fixture, store } = await montar();
      store.registrarCatalogoInsumos([
        insumoValido('ins-1'),
        { ...insumoValido('ins-2'), nombre: '  bentonita   EN  polvo ' },
      ]);
      store.registrarCatalogoEquipos([equipoValido()]);
      await asentar(fixture);

      expect(nodo<HTMLButtonElement>(fixture, '.boton-validar').disabled).toBe(true);
      expect(nodo(fixture, '.pendiente').textContent).toContain('está repetido');
    });
  });

  describe('persistencia', () => {
    it('rehidrata las dos matrices al volver a la sección', async () => {
      const { fixture, store } = await montar();
      store.registrarCatalogoInsumos([
        insumoValido('ins-1'),
        { ...insumoValido('ins-2'), nombre: 'Cianuro de sodio' },
      ]);
      store.registrarCatalogoEquipos([
        equipoValido('eq-1'),
        { ...equipoValido('eq-2'), nombre: 'Cargador frontal' },
      ]);
      await asentar(fixture);

      expect(filasDe(fixture, 0).length).toBe(2);
      expect(filasDe(fixture, 1).length).toBe(2);
      expect(cuerpoDe(fixture, 0)).toContain('Cianuro de sodio');
      expect(cuerpoDe(fixture, 1)).toContain('Cargador frontal');
    });

    it('conserva los identificadores para que editar no alcance otra fila', async () => {
      const { fixture, store } = await montar();
      store.registrarCatalogoInsumos([
        insumoValido('ins-1'),
        { ...insumoValido('ins-2'), nombre: 'Grasas de perforación' },
      ]);
      store.registrarCatalogoEquipos([equipoValido('eq-1')]);
      await asentar(fixture);

      // Editar la segunda fila de insumos y guardar no debe tocar la primera.
      botonEn(filasDe(fixture, 0)[1]!, 'Editar').click();
      await asentar(fixture);
      escribir(fixture, campoDe(fixture, 'modal-ins-nombre'), 'Grasas especiales');
      boton(fixture, 'Grabar Insumo').click();
      await asentar(fixture);
      boton(fixture, 'Guardar y Validar Sección 2.9').click();
      await asentar(fixture);

      const guardados = store.catalogoInsumosRegistrado();
      expect(guardados[0]?.id).toBe('ins-1');
      expect(guardados[0]?.nombre).toBe('Bentonita en polvo');
      expect(guardados[1]?.id).toBe('ins-2');
      expect(guardados[1]?.nombre).toBe('Grasas especiales');
    });
  });
});
