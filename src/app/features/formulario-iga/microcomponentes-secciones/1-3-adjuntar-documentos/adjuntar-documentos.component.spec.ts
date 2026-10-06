import { TestBed } from '@angular/core/testing';
import { AdjuntarDocumentosComponent } from './adjuntar-documentos.component';

/** Tope legal por documento, espejo de la constante del componente. */
const TOPE = 50 * 1024 * 1024;

/** Localiza un elemento o falla con un mensaje explícito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontró el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Crea un archivo del tamaño declarado. */
function archivo(nombre: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre);
}

/**
 * Simula una selección de archivos sobre el input real del componente.
 *
 * `input.files` es de solo lectura, así que se inyecta con `defineProperty`; a
 * continuación se despacha `change`, que es exactamente lo que hace el navegador
 * y lo que escucha el `(change)` de la plantilla. No hace falta invocar los
 * métodos protegidos del componente.
 */
function elegir(raiz: HTMLElement, archivos: readonly File[]): void {
  const entrada = elemento<HTMLInputElement>(raiz, 'input[type="file"]');
  Object.defineProperty(entrada, 'files', {
    configurable: true,
    value: Object.assign([...archivos], { item: (i: number) => archivos[i] ?? null }),
  });
  entrada.dispatchEvent(new Event('change'));
}

/** Nombres de los archivos que la lista viene mostrando. */
function nombres(raiz: HTMLElement): string[] {
  return Array.from(raiz.querySelectorAll('.fila p.truncate')).map((nodo) =>
    (nodo.textContent ?? '').trim(),
  );
}

/**
 * Construye un `DragEvent` con archivos asociados.
 *
 * jsdom no implementa el constructor con `dataTransfer`, así que el evento se
 * crea a mano y la propiedad se fija por descriptor. `destino` modela
 * `relatedTarget`: el nodo al que el puntero entra o sale.
 */
function eventoArrastre(
  tipo: string,
  archivos: readonly File[] = [],
  destino: Node | null = null,
): DragEvent {
  const evento = new Event(tipo, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(evento, 'dataTransfer', {
    value: {
      files: Object.assign([...archivos], { item: (i: number) => archivos[i] ?? null }),
      dropEffect: 'none',
    },
  });
  Object.defineProperty(evento, 'relatedTarget', { value: destino });
  return evento;
}

describe('AdjuntarDocumentosComponent', () => {
  async function montar(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [AdjuntarDocumentosComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdjuntarDocumentosComponent);
    for (const [entrada, valor] of Object.entries(inputs)) {
      fixture.componentRef.setInput(entrada, valor);
    }
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  describe('Ficha de sección', () => {
    it('muestra su rótulo, su título y la bajada con el tope legal', async () => {
      const { raiz } = await montar({ numero: '1.3' });

      expect(elemento<HTMLElement>(raiz, '.etiqueta').textContent).toContain('Sección 1.3');
      expect(elemento<HTMLElement>(raiz, '.titulo').textContent).toContain('Adjuntar');
      expect(raiz.textContent).toContain('50.00 MB');
    });

    it('arranca con la carga múltiple y sin filtro de formato', async () => {
      const { raiz } = await montar();
      const entrada = elemento<HTMLInputElement>(raiz, 'input[type="file"]');

      expect(entrada.multiple).toBe(true);
      // `accept` vacío equivale a «cualquier formato» en el diálogo del sistema.
      // Se prefiere así a listar la admisión completa en el atributo: el rechazo
      // lo explica el componente fila por fila, que es más útil que un filtro
      // que el usuario no puede ver.
      expect(entrada.getAttribute('accept')).toBe('');
      expect(raiz.textContent).toContain('.pdf, .doc, .docx');
    });
  });

  describe('Variante embebida', () => {
    it('suprime encabezado y marco cuando otra sección ya aporta la tarjeta', async () => {
      const { raiz } = await montar({ numero: '1.2', embebido: true });

      expect(raiz.querySelector('.etiqueta')).toBeNull();
      expect(raiz.querySelector('.bajada')).toBeNull();
      expect(elemento<HTMLElement>(raiz, '.tarjeta').className).toContain('tarjeta--embebida');
    });

    it('sigue mostrando la zona de carga y el input', async () => {
      const { raiz } = await montar({ embebido: true });

      expect(raiz.querySelector('.zona-soltar')).toBeTruthy();
      expect(raiz.querySelector('input[type="file"]')).toBeTruthy();
    });
  });

  describe('Extensiones admitidas', () => {
    it('restringe el filtro del input a lo declarado', async () => {
      const { raiz } = await montar({ aceptarExtensiones: '.pdf' });

      expect(elemento<HTMLInputElement>(raiz, 'input[type="file"]').getAttribute('accept')).toBe(
        '.pdf',
      );
      expect(raiz.textContent).toContain('.pdf');
    });

    it('normaliza mayúsculas y espacios en la lista declarada', async () => {
      const { raiz } = await montar({ aceptarExtensiones: ' PDF , DocX ' });

      expect(raiz.textContent).toContain('.pdf, .docx');
    });

    it('acepta un formato de la lista completa por omisión', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('plano.dwg', 1024)]);
      fixture.detectChanges();

      expect(raiz.textContent).toContain('1 aceptados');
      expect(raiz.textContent).not.toContain('no admitido');
    });

    it('rechaza un formato fuera de la lista declarada', async () => {
      const { fixture, raiz } = await montar({ aceptarExtensiones: '.pdf', multiple: false });
      elegir(raiz, [archivo('plano.dwg', 1024)]);
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Formato .dwg no admitido');
      expect(raiz.textContent).toContain('0 aceptados');
    });

    it('anuncia que en modo único se acepta un solo archivo', async () => {
      const { raiz } = await montar({ multiple: false, aceptarExtensiones: '.pdf' });

      expect(raiz.textContent).toContain('Un solo archivo');
      expect(raiz.textContent).not.toContain('Puede adjuntar varios');
    });
  });

  describe('Tope de 50 MB', () => {
    it('admite un archivo que apenas alcanza el tope', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('justo.pdf', TOPE)]);
      fixture.detectChanges();

      expect(raiz.textContent).toContain('1 aceptados');
    });

    it('rechaza un byte por encima del tope', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('exceso.pdf', TOPE + 1)]);
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Supera el tope');
      expect(raiz.textContent).toContain('0 aceptados');
    });

    it('rechaza un archivo vacío', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('vacio.pdf', 0)]);
      fixture.detectChanges();

      expect(raiz.textContent).toContain('El archivo está vacío');
    });
  });

  describe('Arrastre y soltar', () => {
    it('enciende el marco mientras un archivo está encima de la zona', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('dragover'));
      fixture.detectChanges();

      expect(zona.className).toContain('zona-soltar--activa');
      expect(raiz.textContent).toContain('Suelte los archivos para adjuntarlos');
    });

    it('apaga el marco al salir el arrastre', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('dragover'));
      fixture.detectChanges();
      zona.dispatchEvent(eventoArrastre('dragleave', [], document.body));
      fixture.detectChanges();

      expect(zona.className).not.toContain('zona-soltar--activa');
    });

    it('mantiene el marco encendido al pasar sobre los hijos de la zona', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');
      const hijo = elemento<HTMLElement>(raiz, '.titulo-zona');

      zona.dispatchEvent(eventoArrastre('dragover'));
      // El archivo sigue encima: solo pasó de la zona a un hijo. Los eventos de
      // arrastre son burbujeantes, así que la zona recibe el `dragleave` igual;
      // lo que distingue el caso es que el destino sigue dentro de la zona.
      zona.dispatchEvent(eventoArrastre('dragleave', [], hijo));
      fixture.detectChanges();

      expect(zona.className).toContain('zona-soltar--activa');
    });

    it('cancela el evento de arrastre para que el navegador acepte la soltada', async () => {
      const { raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');
      const sobre = eventoArrastre('dragover');

      zona.dispatchEvent(sobre);

      expect(sobre.defaultPrevented).toBe(true);
    });

    it('sugiere copiar en lugar de mover', async () => {
      const { raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');
      const sobre = eventoArrastre('dragover');

      zona.dispatchEvent(sobre);

      expect(sobre.dataTransfer?.dropEffect).toBe('copy');
    });

    it('incorpora todos los archivos de la soltada', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(
        eventoArrastre('drop', [archivo('anexo.pdf', 10), archivo('plano.dwg', 20)]),
      );
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['anexo.pdf', 'plano.dwg']);
    });

    it('acumula la soltada sobre lo ya elegido con el explorador', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      elegir(raiz, [archivo('previo.pdf', 10)]);
      zona.dispatchEvent(eventoArrastre('drop', [archivo('soltado.pdf', 10)]));
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['previo.pdf', 'soltado.pdf']);
    });

    it('aplica el mismo tope de 50 MB a los archivos soltados', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('drop', [archivo('exceso.pdf', TOPE + 1)]));
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Supera el tope');
      expect(raiz.textContent).toContain('0 aceptados');
    });

    it('rechaza un formato no admitido también por arrastre', async () => {
      const { fixture, raiz } = await montar({ aceptarExtensiones: '.pdf' });
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('drop', [archivo('hoja.xlsx', 10)]));
      fixture.detectChanges();

      expect(raiz.textContent).toContain('Formato .xlsx no admitido');
    });

    it('ignora una soltada sin archivos', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('drop'));
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual([]);
      expect(raiz.querySelector('.fila')).toBeNull();
    });

    it('impide que soltar fuera de la zona navegue hacia el archivo', async () => {
      const { raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');
      const suelta = eventoArrastre('drop', [archivo('anexo.pdf', 10)]);

      zona.dispatchEvent(suelta);

      expect(suelta.defaultPrevented).toBe(true);
    });

    it('restablece el marco tras una soltada, para el siguiente arrastre', async () => {
      const { fixture, raiz } = await montar();
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('dragover'));
      zona.dispatchEvent(eventoArrastre('drop', [archivo('anexo.pdf', 10)]));
      fixture.detectChanges();

      expect(zona.className).not.toContain('zona-soltar--activa');
      // Un `dragleave` tardío, por ejemplo el que dispara el propio navegador al
      // terminar la operación, no debe dejar el margen a medias.
      zona.dispatchEvent(eventoArrastre('dragleave', [], document.body));
      fixture.detectChanges();
      expect(zona.className).not.toContain('zona-soltar--activa');
    });

    it('respeta el modo de archivo único también al arrastrar', async () => {
      const { fixture, raiz } = await montar({ multiple: false, aceptarExtensiones: '.pdf' });
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('drop', [archivo('uno.pdf', 10), archivo('dos.pdf', 10)]));
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['uno.pdf']);
    });

    it('hereda el arrastre a las instancias incrustadas de otras secciones', async () => {
      const { fixture, raiz } = await montar({ numero: '1.2', embebido: true });
      const zona = elemento<HTMLElement>(raiz, '.zona-soltar');

      zona.dispatchEvent(eventoArrastre('drop', [archivo('firmado.pdf', 10)]));
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['firmado.pdf']);
      expect(zona.className).not.toContain('tarjeta');
    });
  });

  describe('Selección múltiple', () => {
    it('acumula los archivos de una tanda', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('uno.pdf', 10), archivo('dos.pdf', 20)]);
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['uno.pdf', 'dos.pdf']);
    });

    it('conserva lo anterior al añadir otra tanda', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('uno.pdf', 10)]);
      elegir(raiz, [archivo('dos.pdf', 20)]);
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['uno.pdf', 'dos.pdf']);
    });
  });

  describe('Modo de archivo único', () => {
    it('conserva solo el primer archivo de la tanda', async () => {
      const { fixture, raiz } = await montar({ multiple: false });
      elegir(raiz, [archivo('primero.pdf', 10), archivo('segundo.pdf', 20)]);
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['primero.pdf']);
    });

    it('reemplaza el archivo anterior en lugar de acumularlos', async () => {
      const { fixture, raiz } = await montar({ multiple: false });
      elegir(raiz, [archivo('anterior.pdf', 10)]);
      elegir(raiz, [archivo('nuevo.pdf', 10)]);
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['nuevo.pdf']);
    });
  });

  describe('Gestión de la lista', () => {
    it('quita un archivo suelto por su botón de fila', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('uno.pdf', 10), archivo('dos.pdf', 20)]);
      fixture.detectChanges();

      elemento<HTMLButtonElement>(raiz, '.fila .boton-tenue').click();
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual(['dos.pdf']);
    });

    it('vacía la lista completa', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('uno.pdf', 10)]);
      fixture.detectChanges();

      elemento<HTMLButtonElement>(raiz, '.boton-tenue').click();
      fixture.detectChanges();

      expect(nombres(raiz)).toEqual([]);
    });

    it('mantiene dos instancias con listas independientes', async () => {
      await TestBed.configureTestingModule({
        imports: [AdjuntarDocumentosComponent],
      }).compileComponents();

      const primera = TestBed.createComponent(AdjuntarDocumentosComponent);
      const segunda = TestBed.createComponent(AdjuntarDocumentosComponent);
      primera.detectChanges();
      segunda.detectChanges();

      const raizA = primera.nativeElement as HTMLElement;
      const raizB = segunda.nativeElement as HTMLElement;
      elegir(raizA, [archivo('a.pdf', 10)]);
      primera.detectChanges();
      segunda.detectChanges();

      expect(nombres(raizA)).toEqual(['a.pdf']);
      expect(nombres(raizB)).toEqual([]);
    });

    it('da un identificador de input distinto a cada instancia', async () => {
      await TestBed.configureTestingModule({
        imports: [AdjuntarDocumentosComponent],
      }).compileComponents();

      const primera = TestBed.createComponent(AdjuntarDocumentosComponent);
      const segunda = TestBed.createComponent(AdjuntarDocumentosComponent);
      primera.detectChanges();
      segunda.detectChanges();

      const raizA = primera.nativeElement as HTMLElement;
      const raizB = segunda.nativeElement as HTMLElement;
      const idA = elemento<HTMLInputElement>(raizA, 'input').id;
      const idB = elemento<HTMLInputElement>(raizB, 'input').id;

      expect(idA).not.toBe(idB);
      expect(elemento<HTMLLabelElement>(raizA, '.zona-soltar').htmlFor).toBe(idA);
      expect(elemento<HTMLLabelElement>(raizB, '.zona-soltar').htmlFor).toBe(idB);
    });
  });

  describe('Resumen de peso', () => {
    it('suma solo el peso de los archivos aceptados', async () => {
      const { fixture, raiz } = await montar();
      elegir(raiz, [archivo('bueno.pdf', 3 * 1024 * 1024), archivo('malo.exe', 10)]);
      fixture.detectChanges();

      expect(raiz.textContent).toContain('1 aceptados');
      expect(raiz.textContent).toContain('3.00 MB en total');
    });
  });
});
