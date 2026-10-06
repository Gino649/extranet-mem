import { TestBed } from '@angular/core/testing';
import { DatosProyectoComponent } from './datos-proyecto.component';
import { DaexStore } from '../../../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Escribe en un input como lo haría el titular y dispara la cadena de eventos. */
function escribir(input: HTMLInputElement | HTMLSelectElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

/** Rellena los cuatro campos obligatorios de la sección. */
function completar(raiz: HTMLElement): void {
  escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas Fase II');
  escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'U_DUNAS');
  escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '1250000');
  escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '12');
}

function botonGuardar(raiz: HTMLElement): HTMLButtonElement {
  return elemento<HTMLButtonElement>(raiz, 'button[type="button"]');
}

describe('DatosProyectoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatosProyectoComponent],
    }).compileComponents();
  });

  async function montar() {
    const store = TestBed.inject(DaexStore);
    store.inyectarSesion('20501234567', 'token', 'Titular Minero 20501234567');
    const fixture = TestBed.createComponent(DatosProyectoComponent);
    fixture.detectChanges();
    return { fixture, store, raiz: fixture.nativeElement as HTMLElement };
  }

  describe('Bloque maestro de solo consulta', () => {
    it('replica la identidad del expediente sin campos editables', async () => {
      const { raiz } = await montar();
      const maestro = elemento<HTMLElement>(raiz, '.data-maestra');

      expect(maestro.textContent).toContain('Titular Minero 20501234567');
      expect(maestro.textContent).toContain('DAEX · Menor Complejidad');
      expect(maestro.querySelectorAll('input, select, textarea')).toHaveLength(0);
      expect(maestro.className).toContain('bg-slate-50/60');
    });

    it('deriva la complejidad del tipo de IGA, no la fija en DAEX', async () => {
      const { store, fixture, raiz } = await montar();
      store.iniciarFormularioNuevo('AISD');
      fixture.detectChanges();

      expect(raiz.textContent).toContain('AISD · Integrada de Sulfuros');
    });
  });

  describe('Validador en caliente', () => {
    it('arranca bloqueado porque no hay nada capturado', async () => {
      const { raiz } = await montar();
      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('se desbloquea al completar los cuatro campos', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(false);
    });

    it('exige texto real en el nombre y descarta los espacios', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), '    ');
      escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'U_DUNAS');
      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '10');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '12');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('rechaza inversión y vida útil en cero o negativas', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas');
      escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'U_CENTRO');

      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '0');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '0');
      fixture.detectChanges();
      expect(botonGuardar(raiz).disabled).toBe(true);

      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '-500');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '-3');
      fixture.detectChanges();
      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('no confunde un campo vacío con un cero capturado', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas');
      escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'U_DUNAS');
      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '800');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '0');
      fixture.detectChanges();

      // Vaciar el campo devuelve el estado a null, no a 0: el botón queda
      // bloqueado por falta de dato, no por un valor falsy.
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '');
      fixture.detectChanges();
      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('sigue bloqueado si falta la unidad minera', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas');
      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '800');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '24');
      fixture.detectChanges();

      expect(botonGuardar(raiz).disabled).toBe(true);
    });
  });

  describe('Unidad minera pendiente de registro', () => {
    it('advierte que la unidad se incorporará al padrón al remitir', async () => {
      const { fixture, raiz } = await montar();
      escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'NUEVA_UNIDAD');
      fixture.detectChanges();

      expect(raiz.textContent).toContain('quedará registrada en el padrón');
      expect(botonGuardar(raiz).disabled).toBe(true);
    });

    it('graba la unidad en registro como nombre provisional', async () => {
      const { fixture, store, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas II');
      escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'NUEVA_UNIDAD');
      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '90000');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '6');
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      expect(store.formulario().unidadMinera).toBe('Unidad Minera en registro');
    });
  });

  describe('Guardado transaccional', () => {
    it('publica nombre y unidad en la cabecera del expediente', async () => {
      const { fixture, store, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      expect(store.formulario().nombreProyecto).toBe('Las Dunas Fase II');
      expect(store.formulario().unidadMinera).toBe('Unidad Las Dunas');
      expect(store.formulario().numeroExpediente).toBeNull();
    });

    it('normaliza el nombre antes de publicarlo', async () => {
      const { fixture, store, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), '  Proyecto Las Dunas  ');
      escribir(elemento<HTMLSelectElement>(raiz, '#unidadMinera'), 'U_CENTRO');
      escribir(elemento<HTMLInputElement>(raiz, '#montoInversion'), '500');
      escribir(elemento<HTMLInputElement>(raiz, '#vidaUtil'), '3');
      fixture.detectChanges();
      botonGuardar(raiz).click();

      expect(store.formulario().nombreProyecto).toBe('Proyecto Las Dunas');
    });

    it('pasa la sección 2.1 a verde', async () => {
      const { fixture, store, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();

      expect(store.seccionPorNumero('2.1')?.estado).toBe('Verde');
    });

    it('no publica nada si se invoca el guardado con el formulario inválido', async () => {
      const { fixture, store, raiz } = await montar();
      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas');
      fixture.detectChanges();

      // El botón está deshabilitado, pero la vista llama al método si alguien
      // lo dispara por teclado: la guarda del propio método es la real.
      (botonGuardar(raiz) as { disabled: boolean }).disabled = false;
      botonGuardar(raiz).click();

      expect(store.formulario().nombreProyecto).not.toBe('Las Dunas');
      expect(raiz.querySelector('[role="status"]')).toBeNull();
    });

    it('aclara el acuse y lo retira al volver a editar', async () => {
      const { fixture, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();
      botonGuardar(raiz).click();
      fixture.detectChanges();

      const aviso = elemento<HTMLElement>(raiz, '[role="status"]');
      expect(aviso.textContent).toContain('Sección 2.1 validada');

      escribir(elemento<HTMLInputElement>(raiz, '#nombreProyecto'), 'Las Dunas III');
      fixture.detectChanges();
      expect(raiz.querySelector('[role="status"]')).toBeNull();
    });
  });

  describe('Encabezado resuelto contra el store', () => {
    it('rotula la sección con el título que declara el árbol', async () => {
      const { raiz } = await montar();
      const titulo = elemento<HTMLElement>(raiz, 'h1');

      expect(raiz.querySelector('.etiqueta')?.textContent).toContain('2.1');
      expect(titulo.textContent).toBe('Datos del Proyecto');
    });

    it('cae al título de reserva si el índice no está en el árbol', async () => {
      const { fixture, raiz } = await montar();
      fixture.componentRef.setInput('numero', '9.99');
      fixture.detectChanges();

      expect(raiz.querySelector('h1')?.textContent).toBe(
        'Datos Generales del Proyecto de Exploración',
      );
    });

    it('confirma el semáforo contra el índice inyectado, no contra un literal', async () => {
      const { fixture, store, raiz } = await montar();
      completar(raiz);
      fixture.detectChanges();

      store.actualizarEstadoSeccion('2.1', 'GRIS');
      botonGuardar(raiz).click();

      expect(store.seccionPorNumero('2.1')?.estado).toBe('Verde');
    });
  });

  describe('Alineación de los campos numéricos', () => {
    it('deja una sola caja por campo: el borde vive en el envoltorio', async () => {
      const { raiz } = await montar();
      const campos = raiz.querySelectorAll('.campo-adornado');
      expect(campos).toHaveLength(2);

      campos.forEach((campo) => {
        const input = elemento<HTMLInputElement>(campo as HTMLElement, 'input');
        // El input entra sin marco propio para no duplicar el borde.
        expect(input.className).not.toContain('border-slate-200');
        expect(input.className).toContain('focus:outline-none');
      });
    });

    it('comparte relleno vertical para que ambas cajas midan lo mismo', async () => {
      const { raiz } = await montar();
      const inputs = Array.from(raiz.querySelectorAll('.campo-adornado input'));

      expect(inputs).toHaveLength(2);
      inputs.forEach((input) => expect(input.className).toContain('py-3'));
      // Cada adorno abre el espacio correspondiente: moneda a la izquierda,
      // unidad de tiempo a la derecha.
      expect(raiz.querySelector('.adorno-izquierdo')?.textContent?.trim()).toBe('$');
      expect(raiz.querySelector('.adorno-derecho')?.textContent?.trim()).toBe('Meses');
    });
  });

  describe('Opciones del selector de unidad', () => {
    it('lista el padrón más el alta de una unidad nueva', async () => {
      const { raiz } = await montar();
      const opciones = Array.from(raiz.querySelectorAll<HTMLOptionElement>('#unidadMinera option'));

      expect(opciones[0].disabled).toBe(true);
      expect(opciones.map((opcion) => opcion.value)).toEqual([
        '',
        'U_DUNAS',
        'U_CENTRO',
        'NUEVA_UNIDAD',
      ]);
    });
  });
});
