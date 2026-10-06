import { provideRouter, withComponentInputBinding } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ContenedorCapituloComponent } from './contenedor-capitulo.component';
import { DaexStore } from '../../../state/daex.store';
import { routes } from '../../../app.routes';

/**
 * Crea el orquestador con un capítulo explícito.
 *
 * `capituloId` es un `input()` enlazado al parámetro de ruta por
 * `withComponentInputBinding`, así que el test lo fija con `setInput` en lugar
 * de navegar: el comportamiento que importa aquí es la proyección del
 * catálogo, no la resolución de la URL.
 */
function montar(capituloId: string) {
  const fixture = TestBed.createComponent(ContenedorCapituloComponent);
  fixture.componentRef.setInput('capituloId', capituloId);
  fixture.detectChanges();
  return { fixture, raiz: fixture.nativeElement as HTMLElement, store: TestBed.inject(DaexStore) };
}

/** Anclas `seccion-<numero>` que el orquestador emitió en el DOM. */
function anclas(raiz: HTMLElement): string[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>('[id^="seccion-"]')).map((nodo) => nodo.id);
}

/** Primer elemento que coincide con el selector, con mensaje explícito si falta. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

describe('ContenedorCapituloComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContenedorCapituloComponent],
      providers: [provideRouter(routes, withComponentInputBinding())],
    }).compileComponents();
  });

  describe('Proyección del catálogo', () => {
    it('apila solo las microsecciones del capítulo recibido', () => {
      const { raiz } = montar('1');
      expect(anclas(raiz)).toEqual(['seccion-1.1', 'seccion-1.2', 'seccion-1.3']);
    });

    it('cambia la proyección al cambiar de capítulo sin recrear el contenedor', () => {
      const { fixture, raiz } = montar('1');
      expect(raiz.textContent).toContain('Identificación del Titular');

      fixture.componentRef.setInput('capituloId', '2');
      fixture.detectChanges();

      expect(anclas(raiz)).toEqual([
        'seccion-2.1',
        'seccion-2.2',
        'seccion-2.3',
        'seccion-2.4',
        'seccion-2.5',
        'seccion-2.6',
        'seccion-2.7',
        'seccion-2.8',
        'seccion-2.9',
        'seccion-2.10',
        'seccion-2.11',
      ]);
      expect(raiz.textContent).not.toContain('Identificación del Titular');
    });

    it('conserva el orden del catálogo dentro del capítulo', () => {
      const { raiz } = montar('5');
      // 5.2 se desglosa en dos sub-capas que comparten la pieza de delimitación.
      expect(anclas(raiz)).toEqual(['seccion-5.2.1', 'seccion-5.2.2', 'seccion-5.3']);
    });

    it('reutiliza el uploader en los tres capítulos que lo requieren', () => {
      expect(anclas(montar('3').raiz)).toEqual(['seccion-3.4']);
      expect(anclas(montar('6').raiz)).toEqual(['seccion-6.2']);
      expect(anclas(montar('7').raiz)).toEqual(['seccion-7.1']);
    });

    it('muestra el estado vacío en los capítulos sin piezas construidas', () => {
      const { raiz } = montar('4');

      expect(anclas(raiz)).toEqual([]);
      expect(raiz.textContent).toContain('aún no están habilitadas');
    });
  });

  describe('Sincronización con el store', () => {
    it('propaga el capítulo de la ruta al store', () => {
      const { store } = montar('5');

      expect(store.capituloSeleccionadoId()).toBe('5');
      expect(store.capituloAbierto('CAP-5')).toBe(true);
    });

    it('deja intacto el capítulo activo si la ruta no trae ninguno', () => {
      const { fixture, store } = montar('2');

      // Un capítulo inexistente no debe vaciar la vista ni desmarcar el store.
      fixture.componentRef.setInput('capituloId', '9');
      fixture.detectChanges();

      expect(store.capituloSeleccionadoId()).toBe('2');
    });
  });

  describe('Entrega del índice a los microcomponentes', () => {
    it('inyecta el número de sección en cada ficha apilada', () => {
      const { raiz } = montar('1');

      // Cada pieza titula con su propio índice: 1.1 lo hace su propio encabezado
      // y 1.2 y 1.3 con el rótulo de sección de su ficha.
      expect(elemento(raiz, '.titulo').textContent).toContain('1.1');
      const etiquetas = Array.from(raiz.querySelectorAll<HTMLElement>('.etiqueta')).map((nodo) =>
        nodo.textContent?.trim(),
      );
      expect(etiquetas).toEqual(['Sección 1.2', 'Sección 1.3']);
    });

    it('muestra la 1.1 como ficha de consulta sin acción de guardado', () => {
      const { raiz } = montar('1');

      expect(elemento(raiz, '.sello-lectura').textContent?.trim()).toBe('Solo consulta');
      expect(elemento(raiz, 'app-identificacion').querySelector('form')).toBeNull();
    });

    it('valida contra su propia fila del store y no contra la de otro capítulo', () => {
      const { raiz, store } = montar('5');
      const botones = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.boton-oro'));

      const estadoPrevioDe25 = store.seccionPorNumero('2.5')?.estado;
      const confirmarMapa = botones.find((boton) =>
        boton.textContent?.includes('Confirmar delimitación'),
      );
      confirmarMapa?.click();

      // La copia del capítulo 5 confirma 5.2.1 y no toca la 2.5 del capítulo 2.
      expect(store.seccionPorNumero('5.2.1')?.estado).toBe('Verde');
      expect(store.seccionPorNumero('2.5')?.estado).toBe(estadoPrevioDe25);
    });

    it('mantiene independientes las copias apiladas del uploader', () => {
      const { raiz } = montar('2');
      const tarjetas = Array.from(
        raiz.querySelectorAll<HTMLElement>('app-adjuntar-documentos'),
      ) as HTMLElement[];

      // La pieza se registra una vez por sección: 2.11 en el capítulo 2.
      expect(tarjetas.length).toBe(1);
      expect(tarjetas[0]?.querySelector('.etiqueta')?.textContent?.trim()).toBe('Sección 2.11');
      expect(tarjetas[0]?.textContent).toContain('Adjuntar Documentos');
    });

    it('apunta cada zona de arrastre a su propio input', () => {
      // El capítulo 1 apila dos uploaders a la vez: el embebido de la 1.2, que
      // admite un único PDF, y el completo de la 1.3, que admite varios. Con un
      // `id` de input compartido, `<label for>` resolvía al primero del
      // documento y la zona de la 1.3 abría el explorador de la 1.2: no dejaba
      // escoger más de un archivo y el documento se listaba en la 1.2.
      const { raiz } = montar('1');
      const zonas = Array.from(raiz.querySelectorAll<HTMLLabelElement>('.zona-soltar'));
      const entradas = Array.from(raiz.querySelectorAll<HTMLInputElement>('input[type="file"]'));

      expect(zonas.length).toBe(2);
      expect(entradas.length).toBe(2);
      expect(new Set(entradas.map((entrada) => entrada.id)).size).toBe(2);

      for (const zona of zonas) {
        const entrada = entradas.find((candidata) => candidata.id === zona.htmlFor);
        expect(entrada).toBeDefined();
        expect(zona.contains(entrada as HTMLInputElement)).toBe(true);
      }
    });

    it('deja la 1.3 en carga múltiple y la 1.2 restringida a un PDF', () => {
      const { raiz } = montar('1');
      const porSeccion = new Map<string, HTMLInputElement>();
      for (const entrada of Array.from(
        raiz.querySelectorAll<HTMLInputElement>('input[type="file"]'),
      )) {
        const zona = entrada.closest('app-adjuntar-documentos, app-smart-uploader');
        porSeccion.set(zona?.tagName.toLowerCase() ?? '', entrada);
      }

      // La ficha completa de la 1.3 admite la lista de formatos del capítulo.
      expect(porSeccion.get('app-adjuntar-documentos')?.multiple).toBe(true);
      expect(porSeccion.get('app-adjuntar-documentos')?.getAttribute('accept')).toBe('');

      // El bloque de evidencia de la 1.2 sigue siendo de un único PDF.
      expect(porSeccion.get('app-smart-uploader')?.multiple).toBe(false);
      expect(porSeccion.get('app-smart-uploader')?.getAttribute('accept')).toBe('.pdf');
    });

    it('titula cada copia con el estado de su propia fila del árbol', () => {
      const { raiz } = montar('5');
      const titulos = Array.from(raiz.querySelectorAll<HTMLElement>('.titulo')).map((nodo) =>
        nodo.textContent?.trim(),
      );

      // 5.2.1 y 5.2.2 comparten la pieza de mapa pero no su título.
      expect(titulos[0]).not.toBe(titulos[1]);
      expect(titulos.every((titulo) => titulo !== null && titulo.length > 0)).toBe(true);
    });
  });
});
