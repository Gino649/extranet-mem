import { TestBed } from '@angular/core/testing';
import { AntecedentesComponent } from './antecedentes.component';
import { DaexStore } from '../../../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Cuadrilátero cerrado, la geometría mínima que acepta el store. */
const POLIGONO = [
  { este: 431_250, norte: 8_674_100 },
  { este: 436_800, norte: 8_674_100 },
  { este: 436_800, norte: 8_679_400 },
  { este: 431_250, norte: 8_679_400 },
];

describe('AntecedentesComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AntecedentesComponent],
    }).compileComponents();
  });

  async function montar() {
    const store = TestBed.inject(DaexStore);
    const fixture = TestBed.createComponent(AntecedentesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  describe('Modo consulta', () => {
    it('no expone ningún control de captura', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelectorAll('input, select, textarea')).toHaveLength(0);
      expect(raiz.querySelectorAll('button')).toHaveLength(0);
    });

    it('rotula la sección con el título que declara el árbol', async () => {
      const { raiz } = await montar();
      expect(raiz.querySelector('.etiqueta')?.textContent).toContain('2.2');
      expect(raiz.querySelector('.titulo')?.textContent).toBe('Antecedentes');
    });

    it('cae al título de reserva si el índice no está en el árbol', async () => {
      const { fixture, raiz } = await montar();
      fixture.componentRef.setInput('numero', '9.99');
      fixture.detectChanges();

      expect(raiz.querySelector('.titulo')?.textContent).toBe('Antecedentes y Derechos Mineros');
    });

    it('advierte que la data es automática y de dónde sale', async () => {
      const { raiz } = await montar();
      const nota = elemento<HTMLElement>(raiz, '.bg-amber-50\\/60');

      expect(nota.textContent).toContain('Nota de Validación Catastral Automatizada');
      expect(nota.textContent).toContain('Sección 2.5');
    });
  });

  describe('Estado pendiente de cálculo espacial', () => {
    it('arranca con las dos grillas vacías y su mensaje de espera', async () => {
      const { raiz } = await montar();
      const filas = raiz.querySelectorAll('tbody tr');

      expect(filas).toHaveLength(2);
      expect(raiz.textContent).toContain(
        'Registre las coordenadas en la Sección 2.5 para visualizar las concesiones mineras propias.',
      );
      expect(raiz.textContent).toContain(
        'Registre las coordenadas en la Sección 2.5 para detectar posibles superposiciones con terceros.',
      );
    });

    it('no inventa concesiones mientras la 2.5 no publica geometría', async () => {
      const { raiz } = await montar();
      expect(raiz.querySelectorAll('tbody tr.fila-tercero')).toHaveLength(0);
    });
  });

  describe('Cruce catastral disparado por la 2.5', () => {
    it('inyecta ambas grillas al confirmarse el polígono, sin tocar la sección', async () => {
      const { fixture, store, raiz } = await montar();
      expect(raiz.querySelectorAll('tbody tr')).toHaveLength(2);

      // La 2.2 no tiene botón: el detonante es el store.
      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();

      const filas = raiz.querySelectorAll('tbody tr');
      expect(filas.length).toBeGreaterThan(2);
      expect(raiz.textContent).toContain('Concesión Metálica Las Dunas');
      expect(raiz.textContent).toContain('Concesión Metálica Pampa del Sol');
      expect(raiz.textContent).not.toContain('Pendiente de cálculo espacial');
    });

    it('pasa la sección 2.2 a verde por su cuenta', async () => {
      const { fixture, store } = await montar();
      store.actualizarEstadoSeccion('2.2', 'GRIS');

      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();

      expect(store.seccionPorNumero('2.2')?.estado).toBe('Verde');
    });

    it('reacciona a una geometría posterior sin recrear el componente', async () => {
      const { fixture, store, raiz } = await montar();
      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();
      const marcasIniciales = raiz.querySelectorAll('.fila-tercero').length;

      // Retirar el área efectiva invalida el cruce anterior: no se muestran
      // concessions de un polígono que ya no existe.
      store.limpiarAreaEfectiva();
      fixture.detectChanges();
      expect(raiz.querySelectorAll('.fila-tercero')).toHaveLength(0);
      expect(raiz.textContent).toContain('Pendiente de cálculo espacial');
      expect(store.seccionPorNumero('2.2')?.estado).toBe('Gris');

      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();
      expect(raiz.querySelectorAll('.fila-tercero').length).toBe(marcasIniciales);
      expect(store.seccionPorNumero('2.2')?.estado).toBe('Verde');
    });

    it('rechaza una geometría degenerada que no encloses área', async () => {
      const { fixture, store, raiz } = await montar();
      store.registrarAreaEfectiva([{ este: 1, norte: 1 }]);
      fixture.detectChanges();

      // Menos de tres vértices: el cruce no llega a ejecutarse.
      expect(raiz.textContent).toContain('Pendiente de cálculo espacial');
    });

    it('confirma el semáforo contra el índice inyectado, no contra un literal', async () => {
      const { fixture, store } = await montar();
      fixture.componentRef.setInput('numero', '2.4');
      // Se degradan ambas para distinguir cuál confirmó el efecto.
      store.actualizarEstadoSeccion('2.4', 'GRIS');
      store.actualizarEstadoSeccion('2.2', 'GRIS');

      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();

      expect(store.seccionPorNumero('2.4')?.estado).toBe('Verde');
      expect(store.seccionPorNumero('2.2')?.estado).toBe('Gris');
    });
  });

  describe('Contenido de las concessions', () => {
    async function conCruce() {
      const montado = await montar();
      montado.store.registrarAreaEfectiva(POLIGONO);
      montado.fixture.detectChanges();
      return montado;
    }

    it('expone las siete columnas del catastro en ambas grillas', async () => {
      const { raiz } = await conCruce();
      const cabeceras = Array.from(raiz.querySelectorAll('thead th')).map((th) =>
        th.textContent?.trim(),
      );

      expect(cabeceras).toHaveLength(14);
      expect(cabeceras.slice(0, 7)).toEqual([
        'Código',
        'Nombre Concesión',
        'Tipo',
        'Nº Expediente',
        'Titularidad (SUNARP)',
        '% Part.',
        'Fecha Formul.',
      ]);
    });

    it('distingue la concesión propia de la de un tercero', async () => {
      const { raiz } = await conCruce();
      const propias = Array.from(
        raiz
          .querySelectorAll('.marco-grilla')[0]!
          .querySelectorAll<HTMLTableRowElement>('tbody tr'),
      );

      expect(propias).toHaveLength(2);
      expect(propias[0]?.cells[5]?.textContent).toContain('100%');
      expect(propias[1]?.cells[5]?.textContent).toContain('60%');
    });

    it('marca solo las filas de terceros como superpuestas', async () => {
      const { raiz } = await conCruce();
      const filas = Array.from(raiz.querySelectorAll('tbody tr'));

      expect(filas.filter((fila) => fila.classList.contains('fila-tercero'))).toHaveLength(2);
      expect(filas.filter((fila) => !fila.classList.contains('fila-tercero'))).toHaveLength(2);
    });
  });

  describe('Densidad de la matriz', () => {
    it('escribe los códigos y expedientes en monoespaciada', async () => {
      const { fixture, store, raiz } = await montar();
      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();

      const codigo = elemento<HTMLElement>(raiz, 'tbody td');
      expect(codigo.className).toContain('font-mono');
      expect(codigo.className).toContain('tracking-wider');

      const expedientes = Array.from(raiz.querySelectorAll('tbody td.font-mono')).map((td) =>
        td.textContent?.trim(),
      );
      expect(expedientes).toContain('2021-0345217-RM');
    });

    it('permite desplazar la tabla en horizontal en pantallas angostas', async () => {
      const { raiz } = await montar();
      const marco = elemento<HTMLElement>(raiz, '.marco-tabla');

      expect(marco.className).toContain('overflow-x-auto');
    });
  });
});
