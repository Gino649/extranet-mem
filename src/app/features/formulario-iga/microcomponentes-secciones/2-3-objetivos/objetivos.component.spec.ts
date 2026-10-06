import { TestBed } from '@angular/core/testing';
import { ObjetivosComponent } from './objetivos.component';
import { DaexStore } from '../../../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Escribe en un textarea como lo haría el titular y dispara el `input`. */
function escribir(area: HTMLTextAreaElement, texto: string): void {
  area.value = texto;
  area.dispatchEvent(new Event('input'));
}

const OBJETIVO =
  'Realizar perforaciones diamantinas para cubicar la continuidad de las estructuras mineralizadas de cobre en la zona.';
const JUSTIFICACION =
  'Los estudios geológicos superficiales y el muestreo geoquímico previo indican un alto potencial de mineralización anómala.';

function botonGuardar(raiz: HTMLElement): HTMLButtonElement {
  return elemento<HTMLButtonElement>(raiz, 'button[type="button"]');
}

describe('ObjetivosComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjetivosComponent],
    }).compileComponents();
  });

  async function montar() {
    const store = TestBed.inject(DaexStore);
    const fixture = TestBed.createComponent(ObjetivosComponent);
    fixture.detectChanges();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  function completar(raiz: HTMLElement): void {
    escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), OBJETIVO);
    escribir(elemento<HTMLTextAreaElement>(raiz, '#justificacion'), JUSTIFICACION);
  }

  describe('Cabecera estándar', () => {
    it('muestra el índice, el título del árbol y la bajada', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelector('.etiqueta')?.textContent?.trim()).toBe('Sección 2.3');
      expect(raiz.querySelector('.titulo')?.textContent).toBe('Objetivos y Justificación');
      expect(raiz.querySelector('.bajada')?.textContent).toContain('propósito técnico');
    });

    it('cae al título de reserva si el índice no está en el árbol', async () => {
      const { fixture, raiz } = await montar();
      fixture.componentRef.setInput('numero', '9.99');
      fixture.detectChanges();

      expect(raiz.querySelector('.titulo')?.textContent).toBe('Objetivos y Justificación');
    });

    it('opone la cabecera al cuerpo del formulario', async () => {
      const { raiz } = await montar();
      const tarjeta = elemento<HTMLElement>(raiz, '.tarjeta');
      const cabecera = elemento<HTMLElement>(raiz, '.cabecera');

      // La cabecera envuelve los tres rótulos y antecede a los campos: es una
      // banda propia, no parte del primer textarea.
      expect(cabecera.querySelector('.etiqueta')).toBeTruthy();
      expect(cabecera.querySelector('.titulo')).toBeTruthy();
      expect(cabecera.querySelector('.bajada')).toBeTruthy();
      expect(cabecera.nextElementSibling?.querySelector('textarea')).toBeTruthy();
      expect(Array.from(tarjeta.children)[0]).toBe(cabecera);
    });
  });

  describe('Contador de caracteres', () => {
    it('arranca en cero y escala con lo escrito', async () => {
      const { fixture, raiz } = await montar();
      const contadores = () =>
        Array.from(raiz.querySelectorAll('.contador')).map((nodo) => nodo.textContent?.trim());

      expect(contadores()[0]).toContain('0/1000');

      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), OBJETIVO);
      fixture.detectChanges();
      expect(contadores()[0]).toContain(`${OBJETIVO.length}/1000`);
    });

    it('avisa en ámbar al acercarse al tope, no al superarlo', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), 'x'.repeat(950));
      fixture.detectChanges();

      const contador = elemento<HTMLElement>(raiz, '.contador');
      expect(contador.className).toContain('contador--aviso');
      expect(contador.textContent).toContain('quedan 50');
      // La condición del enunciado, «pintar en rojo al pasar de 1000», era
      // inalcanzable porque el textarea impone maxlength=1000.
      expect(contador.className).not.toContain('contador--limite');
    });

    it('pone el contador en rojo solo al alcanzar el tope', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), 'x'.repeat(1000));
      fixture.detectChanges();

      const contador = elemento<HTMLElement>(raiz, '.contador');
      expect(contador.className).toContain('contador--limite');
      expect(contador.className).not.toContain('contador--aviso');
    });

    it('mantiene el tope duro en el propio textarea', async () => {
      const { raiz } = await montar();
      const areas = raiz.querySelectorAll('textarea');

      expect(areas).toHaveLength(2);
      areas.forEach((area) => expect(area.getAttribute('maxlength')).toBe('1000'));
    });

    it('advierte que el textarea no crece con la escritura', async () => {
      const { raiz } = await montar();
      expect(raiz.querySelectorAll('textarea.resize-none')).toHaveLength(2);
    });
  });

  describe('Validador de contenido', () => {
    it('arranca bloqueado porque ambos campos están vacíos', async () => {
      const { raiz } = await montar();
      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('exige contenido en los dos campos, no solo en uno', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), OBJETIVO);
      fixture.detectChanges();
      expect(botonGuardar(raiz).disabled).toBe(true);

      escribir(elemento<HTMLTextAreaElement>(raiz, '#justificacion'), JUSTIFICACION);
      fixture.detectChanges();
      expect(botonGuardar(raiz).disabled).toBe(false);
    });

    it('descarta el texto formado solo por espacios', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), '        ');
      escribir(elemento<HTMLTextAreaElement>(raiz, '#justificacion'), JUSTIFICACION);
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('exige una extensión redactada y no una línea suelta', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), 'Cubicar el yacimiento.');
      escribir(elemento<HTMLTextAreaElement>(raiz, '#justificacion'), JUSTIFICACION);
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
      expect(raiz.textContent).toContain('Extensión mínima de 30 caracteres');
    });

    it('acepta el texto justo en el mínimo redactado', async () => {
      const { fixture, raiz } = await montar();
      const ajustado = 'a'.repeat(30);
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), ajustado);
      escribir(elemento<HTMLTextAreaElement>(raiz, '#justificacion'), JUSTIFICACION);
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(false);
    });
  });

  describe('Guardado transaccional', () => {
    it('suscribe los dos textos en el expediente y pasa a verde', async () => {
      const { fixture, store, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      expect(store.formulario().objetivos).toBe(OBJETIVO);
      expect(store.formulario().justificacion).toBe(JUSTIFICACION);
      expect(store.seccionPorNumero('2.3')?.estado).toBe('Verde');
    });

    it('normaliza los bordes antes de publicar', async () => {
      const { fixture, store, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), `  ${OBJETIVO}  `);
      escribir(elemento<HTMLTextAreaElement>(raiz, '#justificacion'), JUSTIFICACION);
      fixture.detectChanges();
      botonGuardar(raiz).click();

      expect(store.formulario().objetivos).toBe(OBJETIVO);
    });

    it('no publica nada si se invoca el guardado con el formulario inválido', async () => {
      const { fixture, store, raiz } = await montar();
      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), OBJETIVO);
      fixture.detectChanges();
      store.actualizarEstadoSeccion('2.3', 'GRIS');

      (botonGuardar(raiz) as { disabled: boolean }).disabled = false;
      botonGuardar(raiz).click();

      expect(store.formulario().objetivos).toBeUndefined();
      expect(store.seccionPorNumero('2.3')?.estado).toBe('Gris');
      expect(raiz.querySelector('[role="status"]')).toBeNull();
    });

    it('aclara el acuse y lo retira al volver a editar', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      expect(elemento<HTMLElement>(raiz, '[role="status"]').textContent).toContain(
        'Sección 2.3 validada',
      );

      escribir(elemento<HTMLTextAreaElement>(raiz, '#objetivos'), `${OBJETIVO} Ampliación.`);
      fixture.detectChanges();
      expect(raiz.querySelector('[role="status"]')).toBeNull();
    });

    it('rotula el botón con el índice inyectado', async () => {
      const { fixture, raiz } = await montar();
      fixture.componentRef.setInput('numero', '2.4');
      fixture.detectChanges();

      expect(botonGuardar(raiz).textContent).toContain('Guardar y Validar Sección 2.4');
    });
  });

  describe('Sobrevivencia al desmontaje de la ficha', () => {
    it('restaura la redacción al recuperar la sección', async () => {
      const { fixture, store } = await montar();
      const raiz = fixture.nativeElement as HTMLElement;
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();

      // El orquestador destruye la pieza al cambiar de capítulo: se monta una
      // copia nueva sobre el mismo store, como si el titular volviera a la 2.3.
      const segunda = TestBed.createComponent(ObjetivosComponent);
      segunda.detectChanges();
      const raizSegunda = segunda.nativeElement as HTMLElement;

      expect(elemento<HTMLTextAreaElement>(raizSegunda, '#objetivos').value).toBe(OBJETIVO);
      expect(elemento<HTMLTextAreaElement>(raizSegunda, '#justificacion').value).toBe(
        JUSTIFICACION,
      );
      expect(store.formulario().objetivos).toBe(OBJETIVO);
    });

    it('no arrastra la redacción de otro expediente', async () => {
      const { fixture, store } = await montar();
      const raiz = fixture.nativeElement as HTMLElement;
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();

      store.iniciarFormularioNuevo();
      const otra = TestBed.createComponent(ObjetivosComponent);
      otra.detectChanges();
      const raizOtra = otra.nativeElement as HTMLElement;

      expect(elemento<HTMLTextAreaElement>(raizOtra, '#objetivos').value).toBe('');
    });
  });
});
