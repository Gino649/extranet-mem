import { TestBed } from '@angular/core/testing';
import { LocalizacionComponent } from './localizacion.component';
import { DaexStore } from '../../../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Escribe en un control y dispara la cadena de eventos que usa la plantilla. */
function escribir(control: HTMLInputElement | HTMLSelectElement, valor: string): void {
  control.value = valor;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change'));
}

/** Cuadrilátero cerrado, la geometría mínima que acepta el store. */
const POLIGONO = [
  { este: 431_250, norte: 8_674_100 },
  { este: 436_800, norte: 8_674_100 },
  { este: 436_800, norte: 8_679_400 },
  { este: 431_250, norte: 8_679_400 },
];

function botonGuardar(raiz: HTMLElement): HTMLButtonElement {
  return elemento<HTMLButtonElement>(raiz, 'button[type="button"]');
}

describe('LocalizacionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocalizacionComponent],
    }).compileComponents();
  });

  async function montar() {
    const store = TestBed.inject(DaexStore);
    const fixture = TestBed.createComponent(LocalizacionComponent);
    fixture.detectChanges();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  function completar(raiz: HTMLElement): void {
    escribir(elemento<HTMLInputElement>(raiz, '#esteCentral'), '434025');
    escribir(elemento<HTMLInputElement>(raiz, '#norteCentral'), '8676750');
    escribir(elemento<HTMLSelectElement>(raiz, '#zonaCentral'), '18S');
    escribir(elemento<HTMLInputElement>(raiz, '#nombrePoblado'), 'CC.NN. San Antonio');
  }

  describe('Cabecera estándar', () => {
    it('muestra el índice, el título del árbol y la bajada', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelector('.etiqueta')?.textContent?.trim()).toBe('Sección 2.4');
      expect(raiz.querySelector('.titulo')?.textContent).toBe(
        'Localización Geográfica y Política del Proyecto',
      );
      expect(raiz.querySelector('.bajada')?.textContent).toContain('ubigeo político');
    });

    it('cae al título de reserva si el índice no está en el árbol', async () => {
      const { fixture, raiz } = await montar();
      fixture.componentRef.setInput('numero', '9.99');
      fixture.detectChanges();

      expect(raiz.querySelector('.titulo')?.textContent).toBe('Localización Geográfica y Política');
    });
  });

  describe('Bloque de ubigeo calculado', () => {
    it('arranca pendiente porque la 2.5 no publicó geometría', async () => {
      const { raiz } = await montar();
      const fila = elemento<HTMLElement>(raiz, 'tbody tr');

      expect(fila.textContent).toContain('Pendiente de cálculo espacial');
      expect(fila.textContent).toContain('Sección 2.5');
    });

    it('hereda los tres niveles políticos al confirmarse el área efectiva', async () => {
      const { fixture, store, raiz } = await montar();
      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();

      const fila = elemento<HTMLElement>(raiz, 'tbody tr');
      expect(fila.textContent).toContain('Huancavelica');
      expect(fila.textContent).toContain('Angaraes');
      expect(fila.textContent).toContain('Lircay');
      expect(raiz.textContent).not.toContain('Pendiente de cálculo espacial');
    });

    it('es de solo consulta: la fila política no admite controles', async () => {
      const { fixture, store, raiz } = await montar();
      store.registrarAreaEfectiva(POLIGONO);
      fixture.detectChanges();

      const bloque = elemento<HTMLElement>(raiz, '.marco-tabla');
      expect(bloque.querySelectorAll('input, select, textarea')).toHaveLength(0);
    });
  });

  describe('Punto central: validación de rango', () => {
    it('arranca bloqueado porque los cuatro campos están vacíos', async () => {
      const { raiz } = await montar();
      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('se desbloquea con los cuatro campos dentro del envelope', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(false);
    });

    it('rechaza un este fuera del rango peruano', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      escribir(elemento<HTMLInputElement>(raiz, '#esteCentral'), '250000');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
      expect(raiz.textContent).toContain('Fuera del rango');
    });

    it('rechaza un norte fuera del rango peruano', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      escribir(elemento<HTMLInputElement>(raiz, '#norteCentral'), '250000');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('no confunde un campo vacío con un cero capturado', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      escribir(elemento<HTMLInputElement>(raiz, '#norteCentral'), '');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('exige zona seleccionada', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      escribir(elemento<HTMLSelectElement>(raiz, '#zonaCentral'), '');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('exige el nombre del poblado y descarta los espacios', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      escribir(elemento<HTMLInputElement>(raiz, '#nombrePoblado'), '   ');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('ofrece solo las tres zonas que atraviesan el Perú', async () => {
      const { raiz } = await montar();
      const zonas = Array.from(raiz.querySelectorAll<HTMLOptionElement>('#zonaCentral option')).map(
        (opcion) => opcion.value,
      );

      expect(zonas).toEqual(['', '17S', '18S', '19S']);
    });
  });

  describe('Guardado transaccional', () => {
    it('suscribe el punto central y pasa la sección a verde', async () => {
      const { fixture, store, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      expect(store.formulario().puntoCentral).toEqual({
        este: 434025,
        norte: 8676750,
        zona: '18S',
        poblado: 'CC.NN. San Antonio',
      });
      expect(store.seccionPorNumero('2.4')?.estado).toBe('Verde');
    });

    it('no publica nada si se invoca el guardado con el formulario inválido', async () => {
      const { fixture, store, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#esteCentral'), '434025');
      fixture.detectChanges();
      store.actualizarEstadoSeccion('2.4', 'GRIS');

      (botonGuardar(raiz) as { disabled: boolean }).disabled = false;
      botonGuardar(raiz).click();

      expect(store.formulario().puntoCentral).toBeUndefined();
      expect(store.seccionPorNumero('2.4')?.estado).toBe('Gris');
      expect(raiz.querySelector('[role="status"]')).toBeNull();
    });

    it('aclara el acuse y lo retira al volver a editar', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      expect(elemento<HTMLElement>(raiz, '[role="status"]').textContent).toContain(
        'punto central queda georreferenciado',
      );

      escribir(elemento<HTMLInputElement>(raiz, '#esteCentral'), '435000');
      fixture.detectChanges();
      expect(raiz.querySelector('[role="status"]')).toBeNull();
    });

    it('rotula el botón con el índice inyectado', async () => {
      const { fixture, raiz } = await montar();
      fixture.componentRef.setInput('numero', '2.5');
      fixture.detectChanges();

      expect(botonGuardar(raiz).textContent).toContain('Guardar y Validar Sección 2.5');
    });
  });

  describe('Sobrevivencia al desmontaje de la ficha', () => {
    it('restaura el punto central al recuperar la sección', async () => {
      const { fixture } = await montar();
      const raiz = fixture.nativeElement as HTMLElement;
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();

      const segunda = TestBed.createComponent(LocalizacionComponent);
      segunda.detectChanges();
      const raizSegunda = segunda.nativeElement as HTMLElement;

      expect(elemento<HTMLInputElement>(raizSegunda, '#esteCentral').value).toBe('434025');
      expect(elemento<HTMLInputElement>(raizSegunda, '#norteCentral').value).toBe('8676750');
      expect(elemento<HTMLSelectElement>(raizSegunda, '#zonaCentral').value).toBe('18S');
      expect(elemento<HTMLInputElement>(raizSegunda, '#nombrePoblado').value).toBe(
        'CC.NN. San Antonio',
      );
    });

    it('no arrastra el punto central de otro expediente', async () => {
      const { fixture, store } = await montar();
      const raiz = fixture.nativeElement as HTMLElement;
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();

      store.iniciarFormularioNuevo();
      const otra = TestBed.createComponent(LocalizacionComponent);
      otra.detectChanges();

      expect(
        elemento<HTMLInputElement>(otra.nativeElement as HTMLElement, '#esteCentral').value,
      ).toBe('');
    });
  });

  describe('Alineación de la grilla técnica', () => {
    it('comparte una sola caja de altura entre los cuatro controles', async () => {
      const { raiz } = await montar();
      const controles = Array.from(raiz.querySelectorAll('.campo-cordenada'));

      expect(controles).toHaveLength(4);
      // El alto y la tipografía viven en la hoja de estilo; aquí se comprueba
      // que los cuatro controles pasan por la misma caja.
      expect(controles.filter((c) => c.classList.contains('campo-cordenada--texto'))).toHaveLength(
        1,
      );
      expect(controles[3].id).toBe('nombrePoblado');
    });

    it('restaura la zona elegida con la opción marcada, no con el value del select', async () => {
      const { fixture, store, raiz } = await montar();
      store.actualizarFormulario({
        puntoCentral: { este: 434025, norte: 8676750, zona: '19S', poblado: 'San Antonio' },
      });

      // Con `[value]` sobre el select y las opciones creadas por `@for`, la
      // asignación ocurre antes de que existan las opciones y falla en
      // silencio: el selector caía en la primera. Se marca la opción.
      const segunda = TestBed.createComponent(LocalizacionComponent);
      segunda.detectChanges();
      const raizSegunda = segunda.nativeElement as HTMLElement;

      expect(elemento<HTMLSelectElement>(raizSegunda, '#zonaCentral').value).toBe('19S');
      expect(raiz).toBeTruthy();
    });

    it('degrada la pista en rojo cuando la coordenada sale de rango', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#esteCentral'), '999999');
      fixture.detectChanges();

      const pistas = Array.from(raiz.querySelectorAll('.pista'));
      const conError = pistas.filter((pista) => pista.className.includes('pista--error'));

      expect(conError).toHaveLength(1);
      expect(conError[0].textContent).toContain('Fuera del rango');
    });
  });
});
