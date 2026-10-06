import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NotificacionComponent } from './notificacion.component';
import { AdjuntarDocumentosComponent } from '../1-3-adjuntar-documentos/adjuntar-documentos.component';
import { DaexStore } from '../../../../state/daex.store';

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Escribe en un input de la grilla simulando la pulsación de una tecla. */
function escribir(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

/** Inputs de la grilla en orden: nombres, teléfono, correo de cada fila. */
function campos(raiz: HTMLElement): HTMLInputElement[] {
  return Array.from(raiz.querySelectorAll<HTMLInputElement>('tbody .celda-input'));
}

/** Rellena por completo la fila indicada de la grilla. */
function rellenarFila(
  raiz: HTMLElement,
  indice: number,
  nombres: string,
  telefono: string,
  email: string,
): void {
  const fila = campos(raiz).slice(indice * 3, indice * 3 + 3);
  escribir(fila[0]!, nombres);
  escribir(fila[1]!, telefono);
  escribir(fila[2]!, email);
}

/** Fila con datos válidos listos para confirmar. */
const CONTACTO_VALIDO = [
  'Ana Quispe Vela',
  '999888777',
  'anaquispe@corpminsanandres.com.pe',
] as const;

describe('NotificacionComponent', () => {
  async function montar() {
    await TestBed.configureTestingModule({
      imports: [NotificacionComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(NotificacionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const store = TestBed.inject(DaexStore);
    return {
      fixture,
      store,
      raiz: fixture.nativeElement as HTMLElement,
      instancia: fixture.componentInstance,
    };
  }

  describe('Estructura de la sección', () => {
    it('marca su índice en el rótulo y su nombre en el título', async () => {
      const { raiz } = await montar();

      expect(elemento<HTMLElement>(raiz, '.etiqueta').textContent).toContain('Sección 1.2');
      expect(elemento<HTMLElement>(raiz, '.titulo').textContent).toContain(
        'Notificación Electrónica',
      );
    });

    it('presenta los dos bloques con sus encabezados', async () => {
      const { raiz } = await montar();
      const titulos = Array.from(raiz.querySelectorAll('.bloque-titulo')).map((nodo) =>
        (nodo.textContent ?? '').trim(),
      );

      expect(titulos[0]).toContain('Personal Autorizado');
      expect(titulos[1]).toContain('Declaración Jurada');
    });

    it('expone las cinco columnas de la matriz de contactos', async () => {
      const { raiz } = await montar();
      const cabeceras = Array.from(raiz.querySelectorAll('thead th')).map((nodo) =>
        (nodo.textContent ?? '').trim(),
      );

      // La última columna solo lleva texto para lectores de pantalla, de ahí que
      // su rótulo no sea visible pero sí forme parte del encabezado.
      expect(cabeceras).toEqual([
        '#',
        'Nombres y Apellidos',
        'Teléfono / Celular',
        'Correo Electrónico',
        'Acciones',
      ]);
    });
  });

  describe('Grilla dinámica de contactos', () => {
    it('arranca con una fila para que la grilla no se vea desierta', async () => {
      const { raiz } = await montar();

      expect(campos(raiz)).toHaveLength(3);
      expect(raiz.querySelectorAll('tbody .fila-contacto')).toHaveLength(1);
    });

    it('agrega una fila en blanco con el botón de alta', async () => {
      const { fixture, raiz } = await montar();

      elemento<HTMLButtonElement>(raiz, '.boton-agregar').click();
      fixture.detectChanges();

      expect(campos(raiz)).toHaveLength(6);
      expect(campos(raiz)[3]?.value).toBe('');
    });

    it('numera las filas correlativamente al agregarlas', async () => {
      const { fixture, raiz } = await montar();
      const boton = elemento<HTMLButtonElement>(raiz, '.boton-agregar');

      boton.click();
      boton.click();
      fixture.detectChanges();

      const ordenes = Array.from(raiz.querySelectorAll('.celda--orden')).map((nodo) =>
        nodo.textContent?.trim(),
      );
      expect(ordenes).toEqual(['1', '2', '3']);
    });

    it('remueve la fila indicada conservando los datos de las demás', async () => {
      const { fixture, raiz } = await montar();

      // Tres filas: la primera vacía, la segunda válida y la tercera con RUC.
      elemento<HTMLButtonElement>(raiz, '.boton-agregar').click();
      elemento<HTMLButtonElement>(raiz, '.boton-agregar').click();
      fixture.detectChanges();
      rellenarFila(raiz, 1, ...CONTACTO_VALIDO);
      escribir(campos(raiz)[6]!, 'Rocío Paredes');
      fixture.detectChanges();

      // Se quita la fila del medio: la última debe sobrevivir intacta.
      const quitar = Array.from(
        raiz.querySelectorAll<HTMLButtonElement>('.boton-quitar'),
      ) as HTMLButtonElement[];
      quitar[1]?.click();
      fixture.detectChanges();

      expect(raiz.querySelectorAll('tbody .fila-contacto')).toHaveLength(2);
      expect(campos(raiz)).toHaveLength(6);
      expect(campos(raiz)[3]?.value).toBe('Rocío Paredes');
      expect(campos(raiz)[4]?.value).toBe('');
    });

    it('muestra el estado vacío cuando se quitan todas las filas', async () => {
      const { fixture, raiz } = await montar();

      elemento<HTMLButtonElement>(raiz, '.boton-quitar').click();
      fixture.detectChanges();

      expect(raiz.querySelectorAll('tbody .fila-contacto')).toHaveLength(0);
      expect(raiz.textContent).toContain('No hay contactos declarados');
    });
  });

  describe('Validación transaccional', () => {
    it('bloquea la confirmación mientras no haya ningún contacto válido', async () => {
      const { raiz } = await montar();
      const confirmar = elemento<HTMLButtonElement>(raiz, '.boton-oro');

      expect(confirmar.disabled).toBe(true);
      expect(confirmar.getAttribute('title')).toContain('al menos un contacto válido');
    });

    it('exige correo y celular válidos además del nombre', async () => {
      const { fixture, raiz } = await montar();

      // Nombre correcto, pero sin celular ni correo.
      escribir(campos(raiz)[0]!, 'Ana Quispe Vela');
      fixture.detectChanges();
      expect(elemento<HTMLButtonElement>(raiz, '.boton-oro').disabled).toBe(true);

      // Celular peruano de nueve dígitos.
      escribir(campos(raiz)[1]!, '999888777');
      fixture.detectChanges();
      expect(elemento<HTMLButtonElement>(raiz, '.boton-oro').disabled).toBe(true);

      escribir(campos(raiz)[2]!, 'anaquispe@corpminsanandres.com.pe');
      fixture.detectChanges();
      expect(elemento<HTMLButtonElement>(raiz, '.boton-oro').disabled).toBe(false);
    });

    it('rechaza un celular que no sea un móvil peruano', async () => {
      const { fixture, raiz } = await montar();

      rellenarFila(raiz, 0, 'Ana Quispe Vela', '123456', 'anaquispe@corpminsanandres.com.pe');
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Teléfono inválido');
      expect(elemento<HTMLButtonElement>(raiz, '.boton-oro').disabled).toBe(true);
    });

    it('acepta el prefijo internacional +51 en el celular', async () => {
      const { fixture, raiz } = await montar();

      rellenarFila(
        raiz,
        0,
        'Ana Quispe Vela',
        '+51 999888777',
        'anaquispe@corpminsanandres.com.pe',
      );
      fixture.detectChanges();

      expect(elemento<HTMLButtonElement>(raiz, '.boton-oro').disabled).toBe(false);
    });

    it('rechaza un correo sin dominio válido', async () => {
      const { fixture, raiz } = await montar();

      rellenarFila(raiz, 0, 'Ana Quispe Vela', '999888777', 'anaquispe@corpminsanandres');
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Correo inválido');
    });

    it('impide confirmar con una fila a medias aunque otra sea válida', async () => {
      const { fixture, raiz } = await montar();

      rellenarFila(raiz, 0, ...CONTACTO_VALIDO);
      elemento<HTMLButtonElement>(raiz, '.boton-agregar').click();
      fixture.detectChanges();

      // Una fila válida y otra en blanco: la sección no está lista.
      expect(elemento<HTMLButtonElement>(raiz, '.boton-oro').disabled).toBe(true);
      expect(raiz.textContent).toContain('1 fila(s) con datos pendientes');
    });

    it('cuenta los contactos válidos en la cabecera', async () => {
      const { fixture, raiz } = await montar();

      expect(elemento<HTMLElement>(raiz, '.contador-contactos').textContent).toContain('0 válidos');

      rellenarFila(raiz, 0, ...CONTACTO_VALIDO);
      fixture.detectChanges();

      expect(elemento<HTMLElement>(raiz, '.contador-contactos').textContent).toContain('1 válido');
    });

    it('detalla los errores de la fila que ya tiene nombre', async () => {
      const { fixture, raiz } = await montar();

      // Dos caracteres no bastan para nombres y apellidos completos.
      escribir(campos(raiz)[0]!, 'An');
      fixture.detectChanges();

      const detalle = elemento<HTMLElement>(raiz, '.celda-detalle');
      expect(detalle.textContent).toContain('Nombres y apellidos incompletos');
      expect(detalle.textContent).toContain('Teléfono inválido');
    });

    it('no ensucia la grilla con errores mientras la fila está en blanco', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelector('.celda-detalle')).toBeNull();
    });
  });

  describe('Transición del semáforo', () => {
    it('enciende el semáforo en Verde al confirmar un padrón válido', async () => {
      const { fixture, store, raiz } = await montar();
      store.actualizarEstadoSeccion('1.2', 'AZUL');
      fixture.detectChanges();

      rellenarFila(raiz, 0, ...CONTACTO_VALIDO);
      fixture.detectChanges();
      elemento<HTMLButtonElement>(raiz, '.boton-oro').click();
      fixture.detectChanges();

      expect(store.seccionPorNumero('1.2')?.estado).toBe('Verde');
      expect(raiz.textContent).toContain('1 contacto(s) autorizado(s)');
    });

    it('deja el semáforo intacto si se invoca la confirmación con la grilla vacía', async () => {
      const { fixture, store, raiz, instancia } = await montar();
      store.actualizarEstadoSeccion('1.2', 'AZUL');
      fixture.detectChanges();

      // Se invoca por la vía directa para saltar el `disabled` del botón.
      (instancia as unknown as { confirmar(): void }).confirmar();
      fixture.detectChanges();

      expect(store.seccionPorNumero('1.2')?.estado).toBe('Azul');
      expect(raiz.textContent).toContain('no deje filas a medias');
    });

    it('tiñe el rótulo con el color que le corresponde al semáforo', async () => {
      const { fixture, store, raiz } = await montar();

      store.actualizarEstadoSeccion('1.2', 'AZUL');
      fixture.detectChanges();
      expect(elemento<HTMLElement>(raiz, '.estado').className).toContain('estado--azul');

      store.actualizarEstadoSeccion('1.2', 'VERDE');
      fixture.detectChanges();
      const rotulo = elemento<HTMLElement>(raiz, '.estado');
      expect(rotulo.className).toContain('estado--verde');
      expect(rotulo.textContent).toContain('Verde');
    });
  });

  describe('Uploader embebido de evidencias', () => {
    it('incrusta el uploader compartido en modo restringido a PDF', async () => {
      const { raiz } = await montar();

      expect(raiz.querySelector('app-smart-uploader')).toBeTruthy();
      const entrada = elemento<HTMLInputElement>(raiz, 'app-smart-uploader input[type="file"]');
      expect(entrada.getAttribute('accept')).toBe('.pdf');
      expect(entrada.multiple).toBe(false);
    });

    it('hereda el índice de la sección para no escribir en la fila equivocada', async () => {
      const { fixture } = await montar();
      const uploader = fixture.debugElement.query(By.directive(AdjuntarDocumentosComponent));

      expect(uploader.componentInstance.numero()).toBe('1.2');
    });

    it('no anida una segunda tarjeta dentro del bloque', async () => {
      const { raiz } = await montar();
      const tarjetaInterna = elemento<HTMLElement>(raiz, 'app-smart-uploader .tarjeta');

      expect(tarjetaInterna.className).toContain('tarjeta--embebida');
    });
  });
});
