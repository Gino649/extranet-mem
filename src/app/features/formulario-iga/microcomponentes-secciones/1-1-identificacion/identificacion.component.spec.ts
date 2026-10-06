import { TestBed } from '@angular/core/testing';
import { IdentificacionComponent } from './identificacion.component';
import { DaexStore } from '../../../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/**
 * Etiquetas de los pares dato/valor, en el orden en que se pintan.
 *
 * Se acota a `.dato` porque el pie de la ficha reutiliza la misma clase para su
 * rótulo de semáforo, y ese no es un campo de datos.
 */
function etiquetas(raiz: HTMLElement): string[] {
  return Array.from(raiz.querySelectorAll('.dato > .dato-etiqueta')).map((nodo) =>
    (nodo.textContent ?? '').trim(),
  );
}

/** Texto de un valor por su etiqueta, para no depender del orden del DOM. */
function valorDe(raiz: HTMLElement, etiqueta: string): string {
  const dato = Array.from(raiz.querySelectorAll('.dato')).find(
    (nodo) => nodo.querySelector('.dato-etiqueta')?.textContent?.trim() === etiqueta,
  );
  return (dato?.querySelector('.dato-valor')?.textContent ?? '').trim();
}

/*
 * Nota sobre el acabado Premium
 * -----------------------------
 * Las utilidades de volumen (`rounded-2xl`, `rounded-xl`, `border-slate-200/60`)
 * se declaran con `@apply` dentro de la hoja del componente, no como clases
 * utilitarias en el HTML. Por eso el `className` del DOM solo expone los
 * ganchos semánticos (`tarjeta`, `bloque`, `dato`, `dato-valor`) y estos tests
 * verifican la estructura y el comportamiento. El acabado visual queda
 * cubierto por la compilación de Tailwind, que falla si falta una utilidad.
 */

describe('IdentificacionComponent', () => {
  async function montar() {
    await TestBed.configureTestingModule({
      imports: [IdentificacionComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(IdentificacionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const store = TestBed.inject(DaexStore);
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  describe('Régimen de solo consulta', () => {
    it('no monta ningún control editable en el bloque', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelector('input')).toBeNull();
      expect(raiz.querySelector('textarea')).toBeNull();
      expect(raiz.querySelector('select')).toBeNull();
      expect(raiz.querySelector('form')).toBeNull();
      expect(raiz.querySelectorAll('button')).toHaveLength(0);
    });

    it('no declara atributos disabled porque no hay nada que deshabilitar', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelectorAll('[disabled]')).toHaveLength(0);
      expect(raiz.querySelectorAll('[readonly]')).toHaveLength(0);
    });

    it('anuncia que la edición se hace en el padrón', async () => {
      const { raiz } = await montar();

      expect(raiz.textContent).toContain('Registro Maestro de Administrados');
      expect(elemento<HTMLElement>(raiz, '.sello-lectura').textContent?.trim()).toBe(
        'Solo consulta',
      );
    });
  });

  describe('Densidad de datos', () => {
    it('presenta los dos bloques con sus títulos institucionales', async () => {
      const { raiz } = await montar();
      const bloques = Array.from(raiz.querySelectorAll('.bloque-titulo'));

      expect(bloques).toHaveLength(2);
      expect(bloques[0]?.textContent).toContain('Datos de la Persona Jurídica');
      expect(bloques[1]?.textContent).toContain('Representación Legal Autorizada');
    });

    it('reparte los ocho datos entre persona jurídica y representación', async () => {
      const { raiz } = await montar();

      expect(etiquetas(raiz)).toEqual([
        'Razón Social',
        'RUC Institucional',
        'Domicilio Legal',
        'Ubigeo',
        'Correo Electrónico Institucional',
        'Nombres y Apellidos',
        'Cargo del Representante',
        'Correo Electrónico de Notificación',
      ]);
    });

    it('expone los campos que exige el padrón de administrados', async () => {
      const { raiz } = await montar();

      expect(valorDe(raiz, 'Razón Social')).toBe('Corporación Minera San Andrés S.A.C.');
      expect(valorDe(raiz, 'RUC Institucional')).toBe('20501234567');
      expect(valorDe(raiz, 'Ubigeo')).toBe('Lima / Lima / Santiago de Surco');
      expect(valorDe(raiz, 'Nombres y Apellidos')).toBe('María Fernanda Quispe Rojas');
      expect(valorDe(raiz, 'Cargo del Representante')).toBe('Gerente General');
    });

    it('marca el RUC como código y lo muestra sin teñir de anomalía', async () => {
      const { raiz } = await montar();
      const ruc = elemento<HTMLElement>(raiz, '.dato-valor--codigo');

      expect(ruc.className).not.toContain('dato-valor--anomalo');
    });

    it('extiende a dos columnas los datos de ancho completo', async () => {
      const { raiz } = await montar();
      const anchos = Array.from(raiz.querySelectorAll('.dato--ancho'));

      expect(anchos).toHaveLength(2);
      expect(
        Array.from(anchos).map((nodo) => nodo.querySelector('.dato-etiqueta')?.textContent?.trim()),
      ).toEqual(['Domicilio Legal', 'Correo Electrónico de Notificación']);
    });

    it('titula la sección con su índice oficial y el nombre del estado', async () => {
      const { raiz } = await montar();

      expect(elemento<HTMLElement>(raiz, '.titulo').textContent).toContain('1.1');
      expect(elemento<HTMLElement>(raiz, '.titulo').textContent).toContain(
        'Identificación del Titular',
      );
    });
  });

  describe('Estado autónomo conforme', () => {
    it('enciende el semáforo en Verde al montarse, sin acción del titular', async () => {
      await TestBed.configureTestingModule({
        imports: [IdentificacionComponent],
      }).compileComponents();
      const store = TestBed.inject(DaexStore);
      store.actualizarEstadoSeccion('1.1', 'AZUL');
      expect(store.seccionPorNumero('1.1')?.estado).toBe('Azul');

      const fixture = TestBed.createComponent(IdentificacionComponent);
      fixture.detectChanges();

      expect(store.seccionPorNumero('1.1')?.estado).toBe('Verde');
    });

    it('refleja el semáforo en verde en el pie de la ficha', async () => {
      const { raiz } = await montar();

      expect(elemento<HTMLElement>(raiz, '.estado').textContent).toContain('Verde Conforme');
    });

    it('deja el semáforo donde estaba si la sección no existe en el expediente', async () => {
      await TestBed.configureTestingModule({
        imports: [IdentificacionComponent],
      }).compileComponents();
      const fixture = TestBed.createComponent(IdentificacionComponent);
      fixture.componentRef.setInput('numero', '9.9');
      fixture.detectChanges();
      await fixture.whenStable();

      const store = TestBed.inject(DaexStore);
      expect(store.seccionPorNumero('9.9')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Sección no registrada en el expediente',
      );
    });

    it('propaga la transición al árbol completo de capítulos', async () => {
      await TestBed.configureTestingModule({
        imports: [IdentificacionComponent],
      }).compileComponents();
      const store = TestBed.inject(DaexStore);
      store.actualizarEstadoSeccion('1.1', 'AZUL');

      const fixture = TestBed.createComponent(IdentificacionComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const seccionEnArbol = store.capitulos()[0]?.secciones.find((item) => item.numero === '1.1');
      expect(seccionEnArbol?.estado).toBe('Verde');
    });

    it('es idempotente: reapilar la sección no altera otros semáforos', async () => {
      await TestBed.configureTestingModule({
        imports: [IdentificacionComponent],
      }).compileComponents();
      const store = TestBed.inject(DaexStore);
      const previo = store.seccionPorNumero('1.2')?.estado;

      const fixture = TestBed.createComponent(IdentificacionComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.componentRef.setInput('numero', '1.1');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(store.seccionPorNumero('1.1')?.estado).toBe('Verde');
      expect(store.seccionPorNumero('1.2')?.estado).toBe(previo);
    });
  });
});
