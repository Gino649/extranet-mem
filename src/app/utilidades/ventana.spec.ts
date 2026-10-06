import { ANCHO_ESTRECHO_REMEDIO, esVentanaEstrecha } from './ventana';

describe('esVentanaEstrecha', () => {
  const original = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  /** Sustituye `matchMedia` por una versión que solo acepta la consulta dada. */
  function fingir(consulta: string, coincide: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (candidata: string) => ({
        matches: candidata === consulta && coincide,
        media: candidata,
      }),
    });
  }

  it('detecta la franja estrecha con la consulta compartida', () => {
    fingir(ANCHO_ESTRECHO_REMEDIO, true);

    expect(esVentanaEstrecha()).toBe(true);
  });

  it('informa que no es estrecha en una pantalla ancha', () => {
    fingir(ANCHO_ESTRECHO_REMEDIO, false);

    expect(esVentanaEstrecha()).toBe(false);
  });

  it('acepta una consulta propia', () => {
    fingir('(max-width: 30rem)', true);

    expect(esVentanaEstrecha('(max-width: 30rem)')).toBe(true);
  });

  it('devuelve false si el entorno no implementa matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    // Sin `matchMedia` no hay forma de consultar el ancho: se asume la pantalla
    // normal de trabajo, con el índice visible, y no se pliega por sorpresa.
    expect(esVentanaEstrecha()).toBe(false);
  });
});
