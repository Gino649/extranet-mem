import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Tope estricto por documento: 50 MB expresados en bytes. */
const TOPE_BYTES = 50 * 1024 * 1024;

/** Extensiones admitidas por el repositorio de documentos del expediente. */
const EXTENSIONES_ADMITIDAS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'tif',
  'tiff',
  'dwg',
  'dxf',
  'zip',
  'shp',
  'geojson',
] as const;

/** Veredicto de la validación de un archivo seleccionado por el uploader. */
interface ArchivoEvaluado {
  readonly id: string;
  readonly nombre: string;
  readonly tamano: number;
  readonly tamanoLegible: string;
  readonly aceptado: boolean;
  /** Causa del rechazo; `null` cuando el archivo pasa la validación. */
  readonly motivo: string | null;
}

/**
 * Microcomponente genérico de adjuntos, reutilizado por las secciones 1.2, 1.3,
 * 2.11, 3.4, 5.3, 6.2 y 7.1.
 *
 * Valida extensión, tamaño y contenido antes de aceptar cada archivo. La lista
 * de archivos vive en la instancia, de modo que dos copias apiladas del
 * componente nunca comparten documentos.
 *
 * Se publica con dos etiquetas. `app-adjuntar-documentos` es la ficha completa
 * de sección, con encabezado y tarjeta. `app-smart-uploader` es la variante
 * embebida que otra sección incrusta en uno de sus bloques —por ejemplo, el
 * formato firmado de la 1.2— y que solo aporta la zona de carga.
 *
 * La implementación es una sola: duplicar el uploader para tener dos nombres
 * habría dejado dos listas de reglas de validación que divergirían con el
 * tiempo, y el tope de 50 MB es una restricción legal, no un detalle de estilo.
 */
@Component({
  selector: 'app-adjuntar-documentos, app-smart-uploader',
  templateUrl: './adjuntar-documentos.component.html',
  styleUrls: ['./adjuntar-documentos.component.css'],
})
export class AdjuntarDocumentosComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * Es la pieza que obliga a recibir el número por input: al apilarse varias
   * copias del mismo uploader en distintos capítulos, «la sección activa» ya no
   * identifica cuál de ellas está en pantalla.
   */
  readonly numero = input<string>('1.3');

  /**
   * Extensiones admitidas, en notación de punto y separadas por comas.
   *
   * Por ejemplo `'.pdf'` restringe la carga al formato oficial firmado. Si se
   * deja vacío o sin valor, aplica la lista completa de la sección.
   */
  readonly aceptarExtensiones = input<string>('');

  /** Permite adjuntar varios archivos en una sola selección. */
  readonly multiple = input<boolean>(true);

  /**
   * Oculta la tarjeta y el encabezado de sección.
   *
   * Lo activa la variante `app-smart-uploader` cuando otra sección ya envuelve
   * la zona de carga en su propio bloque: anidar dos tarjetas produciría el
   * marco pesado que la densidad del capítulo busca eliminar.
   */
  readonly embebido = input<boolean>(false);

  private static correlativo = 0;

  /**
   * Identificador único del input, distinto en cada instancia.
   *
   * El capítulo I apila la 1.2 con su uploader embebido y la 1.3 completa, de
   * modo que un `id` fijo existiría dos veces en el mismo documento. `<label for>`
   * resuelve siempre al primer elemento con ese id, así que la zona de la 1.3
   * acababa etiqueta al input de la 1.2: se abría su explorador —un único archivo
   * PDF— y el documento se listaba en la sección equivocada.
   */
  private static instancias = 0;

  protected readonly idEntrada = `carga-archivos-${++AdjuntarDocumentosComponent.instancias}`;

  private readonly lista = signal<readonly ArchivoEvaluado[]>([]);
  protected readonly archivos = this.lista.asReadonly();

  protected readonly aceptados = computed(() => this.lista().filter((a) => a.aceptado));
  protected readonly rechazados = computed(() => this.lista().filter((a) => !a.aceptado));
  protected readonly pesoAceptado = computed(() =>
    this.aceptados().reduce((total, archivo) => total + archivo.tamano, 0),
  );

  /** Sección que está instanciando el uploader; fija el encabezado. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  protected readonly topeLegible = this.formatearTamano(TOPE_BYTES);

  /**
   * Extensiones que aplican a esta instancia.
   *
   * Se normalizan a minúsculas y sin punto para comparar contra la extensión
   * del archivo. Un valor vacío significa «la lista completa de la sección».
   */
  private readonly admitidas = computed<readonly string[]>(() => {
    const declaradas = this.aceptarExtensiones()
      .split(',')
      .map((extension) => extension.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
    return declaradas.length > 0 ? declaradas : [...EXTENSIONES_ADMITIDAS];
  });

  /** Texto de ayuda con las extensiones vigentes en esta instancia. */
  protected readonly extensionesLegible = computed(() =>
    this.admitidas()
      .map((extension) => `.${extension}`)
      .join(', '),
  );

  protected alSeleccionar(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.procesarArchivos(entrada.files ?? []);
    // Libera el input para permitir volver a elegir el mismo archivo.
    entrada.value = '';
  }

  /**
   * Válvula única de entrada de archivos.
   *
   * El explorador y el arrastre llegan por caminos distintos pero terminan en las
   * mismas reglas: si cada uno tuviera su propio bucle, el tope de 50 MB y la
   * lista de formatos se auditarían en dos lugares distintos y divergirían.
   */
  protected procesarArchivos(seleccionados: FileList | readonly File[]): void {
    const lista = Array.from(seleccionados);
    if (lista.length === 0) {
      return;
    }

    // En modo single solo se toma el primer archivo y se reemplaza el contenido:
    // un campo de «un solo documento firmado» no puede acumular descargas.
    const evaluados = (this.multiple() ? lista : lista.slice(0, 1)).map((archivo) =>
      this.evaluar(archivo),
    );
    this.lista.update((actual) => (this.multiple() ? [...actual, ...evaluados] : evaluados));
  }

  /* ------------------------------------------------------------------
     Arrastre y soltar
     ------------------------------------------------------------------ */

  protected readonly esArrastrando = signal(false);

  protected alArrastrarSobre(evento: DragEvent): void {
    // Sin `preventDefault` el navegador cancela la operación y nunca dispara `drop`.
    evento.preventDefault();
    if (evento.dataTransfer) {
      evento.dataTransfer.dropEffect = 'copy';
    }
    this.esArrastrando.set(true);
  }

  /**
   * Apaga el marco solo cuando el puntero abandona la zona de verdad.
   *
   * Los eventos de arrastre son burbujeantes: al mover el puntero de la zona a uno
   * de sus hijos, la zona recibe un `dragleave` aunque el archivo siga encima, y
   * `relatedTarget` es precisamente el hijo recién entered. Un simple booleano
   * haría parpadear el marco durante todo el arrastre; un contador tampoco
   * resuelve el caso, porque el `dragleave` de la zona y el `dragenter` del hijo
   * llegan en eventos separados. La pertenencia al nodo sí distingue un caso
   * del otro.
   */
  protected alSalirDeArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    const destino = evento.relatedTarget as Node | null;
    const zona = evento.currentTarget as HTMLElement | null;
    if (destino instanceof Node && zona?.contains(destino)) {
      return;
    }
    this.esArrastrando.set(false);
  }

  protected alSoltarArchivos(evento: DragEvent): void {
    // Sin `preventDefault`, soltar el archivo fuera de la zona haría que el
    // navegador navegara hasta él y cerrara el formulario con el expediente a medias.
    evento.preventDefault();
    this.esArrastrando.set(false);
    this.procesarArchivos(evento.dataTransfer?.files ?? []);
  }

  protected quitar(id: string): void {
    this.lista.update((actual) => actual.filter((archivo) => archivo.id !== id));
  }

  protected limpiar(): void {
    this.lista.set([]);
  }

  protected formatearTamano(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private evaluar(archivo: File): ArchivoEvaluado {
    AdjuntarDocumentosComponent.correlativo += 1;
    const id = `ARC-${AdjuntarDocumentosComponent.correlativo}`;
    const nombre = archivo.name;
    const extension = nombre.includes('.') ? (nombre.split('.').pop() ?? '').toLowerCase() : '';

    let motivo: string | null = null;
    if (archivo.size > TOPE_BYTES) {
      motivo = `Supera el tope de ${this.formatearTamano(TOPE_BYTES)} por documento`;
    } else if (!this.admitidas().includes(extension)) {
      motivo = `Formato .${extension || 'sin extensión'} no admitido`;
    } else if (archivo.size === 0) {
      motivo = 'El archivo está vacío';
    }

    return {
      id,
      nombre,
      tamano: archivo.size,
      tamanoLegible: this.formatearTamano(archivo.size),
      aceptado: motivo === null,
      motivo,
    };
  }
}
