import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CronogramaComponent } from './cronograma.component';
import { DaexStore } from '../../../../state/daex.store';

/** Encuentra un elemento por selector dentro del fixture. */
function nodo<T extends HTMLElement>(
  fixture: ComponentFixture<CronogramaComponent>,
  selector: string,
): T {
  const encontrado = fixture.nativeElement.querySelector(selector) as T | null;
  if (!encontrado) {
    throw new Error(`No se encontró ${selector} en la plantilla de la 2.6`);
  }
  return encontrado;
}

describe('CronogramaComponent', () => {
  /** Levanta el componente con el store real y una sección 2.6 registrada. */
  async function montar(): Promise<{
    fixture: ComponentFixture<CronogramaComponent>;
    store: DaexStore;
    componente: CronogramaComponent;
  }> {
    const fixture = TestBed.createComponent(CronogramaComponent);
    const store = TestBed.inject(DaexStore);
    fixture.componentRef.setInput('numero', '2.6');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store, componente: fixture.componentInstance };
  }

  /** Escribe en un input como lo haría el navegador y dispara `input`. */
  function escribir(
    fixture: ComponentFixture<CronogramaComponent>,
    input: HTMLInputElement,
    valor: string,
  ): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Forma de una etapa tal y como la guarda el componente. */
  interface EtapaDePrueba {
    id: string;
    nombre: string;
    hito: string;
    meses: number;
    inversion: number;
    dependeDe: readonly string[];
    fechaInicio: string;
    editando: boolean;
  }

  /**
   * Acceso tipado al signal privado de etapas.
   *
   * `etapas` es `private`, así que el test lo alcanza por cast: en runtime es un
   * signal común, y hace falta para inyectar estados que la interfaz no permite
   * construir, como una dependencia circular.
   */
  function etapasDe(fixture: ComponentFixture<CronogramaComponent>): {
    (): readonly EtapaDePrueba[];
    set: (valor: readonly EtapaDePrueba[]) => void;
  } {
    return (
      fixture.componentInstance as unknown as {
        etapas: {
          (): readonly EtapaDePrueba[];
          set: (valor: readonly EtapaDePrueba[]) => void;
        };
      }
    ).etapas;
  }

  /** Fija el mes de arranque del cronograma y vuelve a dibujar. */
  function anclarEn(fixture: ComponentFixture<CronogramaComponent>, anioMes: string): void {
    const senal = etapasDe(fixture);
    senal.set(
      senal().map((etapa) => ({
        ...etapa,
        fechaInicio: etapa.dependeDe.length === 0 ? anioMes : '',
      })),
    );
    fixture.detectChanges();
  }

  /**
   * * Lee las fechas de una fila, sin contar la cabecera.
   *
   * Con la fila cerrada, inicio y fin son dos píldoras. Con el ancla en edición
   * el inicio es un `input type="month"`, así que se cae a su valor crudo.
   */
  function fechasDeFila(
    fixture: ComponentFixture<CronogramaComponent>,
    indice: number,
  ): { inicio: string; fin: string } {
    const fila = fixture.nativeElement.querySelectorAll('.gantt-fila')[indice + 1]!;
    const textos = Array.from<Element>(fila.querySelectorAll('.fecha-pill')).map((p) =>
      (p.textContent ?? '').trim(),
    );
    const mesEditable = fila.querySelector('input[type="month"]') as HTMLInputElement | null;
    return {
      inicio: textos[0] ?? mesEditable?.value ?? '',
      fin: textos.at(-1) ?? '',
    };
  }

  /** Abre y cierra el editor de una fila para volverla al estado de lectura. */
  function alternarEditor(fixture: ComponentFixture<CronogramaComponent>, indice: number): void {
    const boton = fixture.nativeElement.querySelectorAll('.boton-editar')[
      indice
    ] as HTMLButtonElement;
    boton.click();
    fixture.detectChanges();
  }

  describe('edición en línea de las etapas', () => {
    it('abre y cierra la fila al pulsar el botón de edición', async () => {
      const { fixture } = await montar();

      expect(nodo(fixture, '.boton-editar').getAttribute('aria-pressed')).toBe('false');

      nodo(fixture, '.boton-editar').click();
      fixture.detectChanges();

      expect(nodo(fixture, '.boton-editar').getAttribute('aria-pressed')).toBe('true');
      // Con la fila abierta aparecen las dos cajas y el monto sale en lectura.
      expect(fixture.nativeElement.querySelectorAll('.inline-input').length).toBe(3);

      nodo(fixture, '.boton-editar').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.inline-input').length).toBe(0);
    });

    it('solo deja una fila abierta a la vez', async () => {
      const { fixture } = await montar();
      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;

      botones[0]!.click();
      fixture.detectChanges();
      botones[1]!.click();
      fixture.detectChanges();

      const abiertos = Array.from<Element>(
        fixture.nativeElement.querySelectorAll('.boton-editar'),
      ).filter((b) => b.getAttribute('aria-pressed') === 'true');
      expect(abiertos.length).toBe(1);
    });

    it('recalcula el total de meses y el ancho de la barra al escribir', async () => {
      const { fixture } = await montar();
      const antes = fixture.nativeElement.querySelectorAll('.dato')[0]!.textContent!.trim();

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      escribir(fixture, nodo<HTMLInputElement>(fixture, '.celda-cronologia .inline-input'), '30');

      const despues = fixture.nativeElement.querySelectorAll('.dato')[0]!.textContent!.trim();
      expect(despues).not.toBe(antes);
      // La ruta crítica pasa de 18 a 30 meses en ET-1: 30 + 14 + 60 + 24 = 128.
      expect(despues).toContain('128');
    });

    it('recalcula la inversión total al escribir el monto', async () => {
      const { fixture } = await montar();

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      escribir(fixture, nodo<HTMLInputElement>(fixture, '.inline-input-dinero'), '1000');

      const totales = Array.from<Element>(fixture.nativeElement.querySelectorAll('.dato')).map(
        (d) => d.textContent!.trim(),
      );
      // Base 22 450 000 menos los 2 450 000 de ET-1, más lo nuevo: 20 001 000.
      expect(totales[1]).toContain('20,001,000');
    });

    it('acota los meses a un mínimo de uno cuando se vacía el campo', async () => {
      const { fixture } = await montar();

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      escribir(fixture, nodo<HTMLInputElement>(fixture, '.celda-cronologia .inline-input'), '');

      // Vaciar el campo no puede dejar la etapa en cero meses.
      expect(nodo<HTMLInputElement>(fixture, '.celda-cronologia .inline-input').value).toBe('1');
    });

    it('impide que el desplazamiento y el ancho sumen más de la pista', async () => {
      const { fixture } = await montar();

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      // Una duración enorme llevaría el ancho por encima del 100% compartido.
      escribir(fixture, nodo<HTMLInputElement>(fixture, '.celda-cronologia .inline-input'), '240');

      for (const barra of fixture.nativeElement.querySelectorAll(
        '.gantt-barra',
      ) as NodeListOf<HTMLElement>) {
        const ancho = Number.parseFloat(barra.style.width);
        expect(ancho).toBeLessThanOrEqual(100);
        expect(ancho).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('fechas calendario', () => {
    it('parte del mes actual cuando el titular no fija ninguno', async () => {
      const { fixture } = await montar();

      const hoy = new Date();
      const esperado = [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Oct',
        'Nov',
        'Dic',
      ][hoy.getMonth()];
      expect(fechasDeFila(fixture, 0).inicio).toBe(`${esperado} ${hoy.getFullYear()}`);
    });

    it('encadena el inicio de cada etapa en el mes siguiente al fin anterior', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      // 18 meses desde enero 2026 acaban en junio 2027; ET-2 arranca en julio.
      expect(fechasDeFila(fixture, 0)).toEqual({ inicio: 'Ene 2026', fin: 'Jun 2027' });
      expect(fechasDeFila(fixture, 1)).toEqual({ inicio: 'Jul 2027', fin: 'Ago 2028' });
    });

    it('calcula la fecha de fin sumando la duración menos un mes', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      // ET-3 dura 60 meses: cinco años exactos, enero 2028 a diciembre 2032.
      expect(fechasDeFila(fixture, 2)).toEqual({ inicio: 'Set 2028', fin: 'Ago 2033' });
    });

    it('cambia el fin cuando el titular alarga la duración', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      escribir(fixture, nodo<HTMLInputElement>(fixture, '.celda-cronologia .inline-input'), '6');

      // 6 meses desde enero 2026 termina en junio 2026.
      expect(fechasDeFila(fixture, 0).fin).toBe('Jun 2026');
    });

    it('deja la fecha de inicio editable solo en la etapa ancla', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[1]!.click(); // ET-2, que sí tiene predecesora
      fixture.detectChanges();

      // El input type="month" solo puede aparecer en el ancla.
      expect(fixture.nativeElement.querySelectorAll('input[type="month"]').length).toBe(0);

      botones[0]!.click(); // ET-1, el ancla
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('input[type="month"]').length).toBe(1);
    });

    it('reubica toda la cascada cuando el titular cambia el mes ancla', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      const input = nodo<HTMLInputElement>(fixture, 'input[type="month"]');
      input.value = '2027-03';
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      alternarEditor(fixture, 0);

      expect(fechasDeFila(fixture, 0).inicio).toBe('Mar 2027');
      expect(fechasDeFila(fixture, 1).inicio).toBe('Set 2028');
    });

    it('cruza el cambio de año sin descuadrar el mes', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-11');

      // 18 meses desde noviembre 2026: termina en abril 2028.
      expect(fechasDeFila(fixture, 0).fin).toBe('Abr 2028');
    });

    it('ignora una fecha con formato inválido en vez de romper el cronograma', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      const input = nodo<HTMLInputElement>(fixture, 'input[type="month"]');
      input.value = '2026-13';
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      alternarEditor(fixture, 0);

      // Un mes 13 no existe: el ancla debe seguir en enero.
      expect(fechasDeFila(fixture, 0).inicio).toBe('Ene 2026');
    });

    it('muestra el mes de término del proyecto completo', async () => {
      const { fixture } = await montar();
      anclarEn(fixture, '2026-01');

      const totales = Array.from<Element>(fixture.nativeElement.querySelectorAll('.dato')).map(
        (d) => d.textContent!.trim(),
      );
      // ET-4 cierra: 116 meses de ruta crítica desde enero 2026.
      expect(totales[3]).toBe('Ago 2035');
    });

    it('conserva el mes ancla al validar y rehidratar', async () => {
      const { fixture, store } = await montar();
      anclarEn(fixture, '2026-01');

      nodo(fixture, '.boton-oro').click();
      fixture.detectChanges();

      expect(store.cronogramaRegistrado()[0]!.fechaInicio).toBe('2026-01');

      // Un componente nuevo debe recuperar el mes, no el mes actual.
      const { fixture: otro } = await montar();
      expect(fechasDeFila(otro, 0).inicio).toBe('Ene 2026');
    });
  });

  describe('dependencias del cronograma', () => {
    it('coloca cada barra después del final de su etapa predecesora', async () => {
      const { fixture } = await montar();
      const barras = fixture.nativeElement.querySelectorAll(
        '.gantt-barra',
      ) as NodeListOf<HTMLElement>;

      // ET-1 arranca en 0; ET-2 arranca tras los 18 meses de ET-1 sobre 116.
      expect(Number.parseFloat(barras[1]!.style.left)).toBeCloseTo((18 / 116) * 100, 5);
      expect(Number.parseFloat(barras[2]!.style.left)).toBeCloseTo((32 / 116) * 100, 5);
    });

    it('bloquea la validación si el cronograma tiene una dependencia circular', async () => {
      const { fixture, store } = await montar();

      // Inyecta un ciclo directamente: no hay interfaz para crearlo.
      const etapas = fixture.componentInstance['etapas' as keyof CronogramaComponent];
      (etapas as unknown as { set: (v: unknown) => void }).set([
        {
          id: 'A',
          nombre: 'A',
          hito: '',
          meses: 2,
          inversion: 1,
          dependeDe: ['B'],
          editando: false,
        },
        {
          id: 'B',
          nombre: 'B',
          hito: '',
          meses: 2,
          inversion: 1,
          dependeDe: ['A'],
          editando: false,
        },
      ]);
      fixture.detectChanges();

      // El botón queda deshabilitado, así que el ciclo no puede llegar a guardarse.
      expect(nodo<HTMLButtonElement>(fixture, '.boton-oro').disabled).toBe(true);
      expect(store.seccionPorNumero('2.6')?.estado).not.toBe('Verde');
      expect(store.cronogramaRegistrado().length).toBe(0);
    });
  });

  describe('validación y persistencia', () => {
    it('publica el cronograma en el store y pone la sección en verde', async () => {
      const { fixture, store } = await montar();

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      escribir(fixture, nodo<HTMLInputElement>(fixture, '.celda-cronologia .inline-input'), '24');

      nodo(fixture, '.boton-oro').click();
      fixture.detectChanges();

      expect(nodo(fixture, '.aviso').textContent).toContain('validados');
      expect(store.seccionPorNumero('2.6')?.estado).toBe('Verde');

      const guardadas = store.cronogramaRegistrado();
      expect(guardadas.length).toBe(4);
      expect(guardadas[0]!.meses).toBe(24);
    });

    it('cierra los editores abiertos al validar', async () => {
      const { fixture } = await montar();

      const botones = fixture.nativeElement.querySelectorAll(
        '.boton-editar',
      ) as NodeListOf<HTMLButtonElement>;
      botones[0]!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.inline-input').length).toBe(3);

      nodo(fixture, '.boton-oro').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.inline-input').length).toBe(0);
    });

    it('rehidrata el Gantt con lo validado cuando el componente se vuelve a crear', async () => {
      const { store } = await montar();

      store.registrarCronograma([
        {
          id: 'ET-1',
          nombre: 'Exploración',
          hito: 'h',
          meses: 36,
          inversion: 111,
          dependeDe: [],
          fechaInicio: '2026-01',
        },
      ]);
      store.limpiarCronograma();
      store.registrarCronograma([
        {
          id: 'ET-1',
          nombre: 'Exploración',
          hito: 'h',
          meses: 36,
          inversion: 111,
          dependeDe: [],
          fechaInicio: '2026-01',
        },
      ]);

      // UnMicrocomponente nuevo debe encontrar el cronograma, no las etapas base.
      const { fixture } = await montar();
      const totales = Array.from<Element>(fixture.nativeElement.querySelectorAll('.dato')).map(
        (d) => d.textContent!.trim(),
      );
      expect(totales[0]).toContain('36');
      expect(totales[2]).toContain('1');
    });
  });
});
