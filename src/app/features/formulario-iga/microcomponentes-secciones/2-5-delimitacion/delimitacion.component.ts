import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';
import {
  CAPAS_BASE,
  EPSG_POR_ZONA,
  MapaFacade,
  type ClaveCapaBase,
  type ParUTM,
  type ZonaUTM,
} from './mapa-facade';
import { extraerShapefileDeZip, leerEpsgDeZip, leerPoligonosShapefile } from './shapefile';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '2.5';

/** Datum único con el que se admite el expediente. */
const DATUM = 'WGS84';

/** Zonas UTM ofrecidas en el modal de alta. */
const ZONAS: readonly ZonaUTM[] = ['17S', '18S', '19S'];

/**
 * Filas de vértice con las que arranca una geometría.
 *
 * Tres porque es el mínimo de un polígono, y vacías porque un área recién dada de
 * alta todavía no tiene dónde: quien la dibuja es el titular, no el formulario.
 */
const VERTICES_INICIALES = 3;

/**
 * Filas que muestra la grilla de vértices de una sola vez.
 *
 * Es el tope que evita que una importación masiva (un shapefile puede traer
 * varios cientos de puntos) deje el modal dibujando filas infinitas. Los vértices
 * que no caben en la grilla siguen contando para la geometría: el polígono se
 * dibuja con todos, la grilla solo muestra la cabecera de la lista.
 */
const MAX_VERTICES_EN_GRILLA = 50;

/** Vértice en edición: las coordenadas admiten vacío hasta que se escriben. */
interface Vertice {
  readonly id: string;
  readonly este: number | null;
  readonly norte: number | null;
}

/** Las dos categorías de área que gobiernan el inventario de la sección. */
type TipoCategoriaArea = 'ACTIVIDAD' | 'USO';

/** Polígono del inventario de áreas superficiales. */
interface AreaSuperficial {
  readonly id: string;
  readonly categoria: TipoCategoriaArea;
  readonly descripcion: string;
  readonly actividad: string;
  readonly zona: ZonaUTM;
  readonly datum: typeof DATUM;
  readonly coordenadas: readonly Vertice[];
  /**
   * Polígono serializado en OGC WKT, en UTM y con el anillo cerrado.
   *
   * Es la forma en que la geometría viaja al backend: el store central y el
   * resto de la extranet trabajan con vértices sueltos, pero la base exige el
   * campo `geometry` como texto. Cadena vacía mientras el área no tenga tres
   * vértices completos, porque un WKT de dos puntos no encierra área.
   */
  readonly geometry: string;
}

/** Vértice con los dos ejes ya resueltos a número. */
type VerticeCompleto = Vertice & { readonly este: number; readonly norte: number };

/**
 * Cifra un eje UTM para la cadena WKT.
 *
 * Se redondea a tres decimales —milímetro en un plano UTM— porque los vértices
 * llegan de un `input` de texto y de archivos CSV, y sin redondear arrastrarían
 * ruido de coma flotante al WKT. Los ceros finales se recortan para que un Este
 * entero se lea `431250` y no `431250.000`.
 */
function cifrarEje(valor: number): string {
  return valor.toFixed(3).replace(/\.?0+$/, '');
}

/**
 * Serializa los vértices como geometría OGC WKT `POLYGON`.
 *
 * Se descartan las filas incompletas antes de construir el anillo: un vértice a
 * medio rellenar no es una posición y emitirlo produciría un WKT que ni el
 * visor ni el backend pueden leer.
 *
 * El anillo se cierra repitiendo el primer punto al final. OGC lo exige, y es lo
 * que distingue un polígono de una cadena abierta en la misma sintaxis.
 *
 * @returns El WKT, o cadena vacía si no hay tres vértices completos.
 */
function wktPoligono(vertices: readonly Vertice[]): string {
  const completos = vertices.filter(
    (vertice): vertice is VerticeCompleto => vertice.este !== null && vertice.norte !== null,
  );
  if (completos.length < 3) {
    return '';
  }
  const anillo = completos.map(
    (vertice) => `${cifrarEje(vertice.este)} ${cifrarEje(vertice.norte)}`,
  );
  const cerrado = [...anillo, anillo[0]!];
  return `POLYGON ((${cerrado.join(', ')}))`;
}

/**
 * Rótulos con los que un catastro nombra el eje Este.
 *
 * Se aceptan los alias en inglés porque las descargas de SIG traen `Easting`
 * y `Northing` en lugar de los términos castellanos.
 */
const ROTULOS_ESTE: readonly string[] = ['este', 'easting', 'x', 'coordx', 'coordenadax'];

/** Rótulos con los que un catastro nombra el eje Norte. */
const ROTULOS_NORTE: readonly string[] = ['norte', 'northing', 'y', 'coordy', 'coordenaday'];

/** Posición de los dos ejes dentro de una fila. */
interface DisposicionColumnas {
  readonly este: number;
  readonly norte: number;
}

/**
 * Normaliza un rótulo de cabecera para compararlo sin tildes ni signos.
 *
 * `Éste` y `este;` tienen que ser la misma columna, y la puntuación que exporta el
 * catastro no es siempre la misma que usa el archivo.
 */
function normalizarRotulo(rotulo: string): string {
  return rotulo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Convierte una celda en número, o `null` si no es un número entero y limpio. */
function aNumero(celda: string | undefined): number | null {
  const texto = celda?.trim() ?? '';
  // `Number('')` es 0, de modo que una celda vacía pasaría por número y pondría un
  // cero en el Este. Se descarta antes de convertir por eso.
  if (texto === '') {
    return null;
  }
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Localiza los ejes por el nombre de sus columnas de cabecera.
 *
 * Es lo que evita que un identificador de vértice acabe en el Este. Buscar «el
 * primer par de celdas numéricas» no sirve cuando ese identificador es numérico:
 * en `1,431250,8674100` la pareja más a la izquierda es `(1, 431250)` y el Norte
 * se leería del Este. Leyendo por rótulo no hay ambigüedad posible.
 *
 * @returns `null` si la primera fila no nombra los dos ejes con claridad.
 */
function disposicionPorRotulos(cabecera: readonly string[]): DisposicionColumnas | null {
  const este = cabecera.findIndex((celda) => ROTULOS_ESTE.includes(normalizarRotulo(celda)));
  const norte = cabecera.findIndex((celda) => ROTULOS_NORTE.includes(normalizarRotulo(celda)));
  if (este < 0 || norte < 0 || este === norte) {
    return null;
  }
  return { este, norte };
}

/**
 * Decide de qué columnas se lee el Este y el Norte en todo el archivo.
 *
 * Con cabecera reconociente mandan los rótulos. Sin ella, o si los rótulos no
 * nombran los ejes, decide el ancho mayoritario del archivo: tres columnas o más
 * significan que la primera es un identificador de vértice y los ejes van en la
 * segunda y la tercera; dos columnas significan que los ejes son las dos
 * primeras.
 *
 * La decisión se toma una vez para todo el archivo y no fila a fila porque es lo
 * único que evita la ambigüedad del identificador numérico: leer cada fila por
 * separado haría que el mismo campo significara Este en unas y Norte en otras.
 */
function resolverDisposicion(filas: readonly string[][]): DisposicionColumnas {
  const porRotulos = filas.length > 0 ? disposicionPorRotulos(filas[0]) : null;
  if (porRotulos) {
    return porRotulos;
  }
  const ancho = filas.reduce((mayor, fila) => Math.max(mayor, fila.length), 0);
  return ancho >= 3 ? { este: 1, norte: 2 } : { este: 0, norte: 1 };
}

/**
 * Extrae el par Este/Norte de una fila segun la disposicion del archivo.
 *
 * `Number` y no `parseFloat` a proposito: `parseFloat('431250abc')` devuelve
 * 431250 y daria por buena una fila corrupta, mientras que `Number` exige que la
 * celda entera sea un numero. Una cabecera como `ESTE,NORTE` cae aqui y se
 * descarta sola, sin que haga falta suponer que la primera linea es una cabecera.
 */
function parEnFila(fila: readonly string[], disposicion: DisposicionColumnas): ParUTM | null {
  const este = aNumero(fila[disposicion.este]);
  const norte = aNumero(fila[disposicion.norte]);
  return este !== null && norte !== null ? { este, norte } : null;
}

/** Borrador del modal de alta y edición. */
interface BorradorArea {
  readonly id: string | null;
  readonly descripcion: string;
  readonly actividad: string;
  readonly zona: ZonaUTM;
  readonly datum: typeof DATUM;
}

/** Borrador vacío, con el datum ya fijo porque no se negocia. */
const BORRADOR_NUEVO: BorradorArea = {
  id: null,
  descripcion: '',
  actividad: '',
  zona: '18S',
  datum: DATUM,
};

/**
 * Microcomponente de la sección 2.5 · Delimitación del Área Efectiva.
 *
 * La sección lleva un inventario de dos categorías —áreas en actividad minera y
 * áreas en uso minero— y, en un único modal de una sola pantalla, los datos del
 * área y el trazado de su polígono. El inventario persiste en memoria mientras
 * la ficha esté viva; el polígono que sí alimenta el expediente se publica al
 * grabar, que es también el momento en que el área entra o se actualiza en el
 * inventario.
 *
 * El visor y la grilla de vértices viven dentro del modal y se montan con él,
 * no junto al inventario: un polígono a medio cerrar no es un dato del
 * expediente sino un borrador, y junto a las áreas ya grabadas parecería
 * definitivo.
 */
@Component({
  selector: 'app-delimitacion',
  templateUrl: './delimitacion.component.html',
  styleUrls: ['./delimitacion.component.css'],
  providers: [MapaFacade],
})
export class DelimitacionComponent {
  protected readonly store = inject(DaexStore);

  /** Datos y proyección del mapa, aislados detrás de una fachada. */
  private readonly mapa = inject(MapaFacade);

  /**
   * Contenedor del visor, que solo existe mientras el modal está abierto. Un
   * `viewChild` de señal y no `@ViewChild` porque el montaje del mapa tiene que
   * seguir al elemento, y ese elemento aparece y desaparece.
   */
  private readonly lienzo = viewChild<ElementRef<HTMLDivElement>>('mapaCore');

  /** Datum fijo, mostrado como dato bloqueado en el modal. */
  protected readonly datum = DATUM;

  /** Zonas ofrecidas en el modal. */
  protected readonly zonas = ZONAS;

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta al apilar las fichas, de modo que el semáforo se
   * confirme contra la fila que corresponde en lugar de contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  protected readonly areasActividad = signal<readonly AreaSuperficial[]>([]);
  protected readonly areasUso = signal<readonly AreaSuperficial[]>([]);

  protected readonly modalAbierto = signal(false);
  protected readonly modalCategoria = signal<TipoCategoriaArea>('ACTIVIDAD');
  protected readonly borrador = signal<BorradorArea>(BORRADOR_NUEVO);

  /** Resultado de la última importación, sea buena o mala. */
  protected readonly aviso = signal<string | null>(null);

  /** Mapa base visible en el visor, y capa del polígono encendida o apagada. */
  protected readonly capaBase = signal<ClaveCapaBase>('esri');
  protected readonly poligonoVisible = signal(true);

  /** Opciones de mapa base que ofrece el selector de capas. */
  protected readonly capasBase = CAPAS_BASE;

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /**
   * Vértices en edición dentro del modal.
   *
   * Son un borrador propio de la pantalla: los datos de una importación o de una
   * corrección no entran al inventario hasta que se graba el área, que es cuando
   * se consolidan en la fila correspondiente.
   */
  protected readonly coordenadas = signal<readonly Vertice[]>([]);

  /**
   * Filas que caben en la grilla.
   *
   * `slice` y no un filtro: los vértices que quedan fuera de la ventana siguen
   * formando parte del polígono, solo dejan de mostrarse. La grilla muestra la
   * cabecera de la lista, no la lista entera.
   */
  protected readonly coordenadasVisibles = computed(() =>
    this.coordenadas().slice(0, MAX_VERTICES_EN_GRILLA),
  );

  /**
   * Vértices ya resueltos.
   *
   * Un polígono en el mapa necesita tres vértices como mínimo. El aviso del
   * enunciado pedía dos pares, y con dos no hay polígono: hay una línea, que no
   * encierra área y no sirve ni para calcular superficie ni para cruzar contra
   * el catastro.
   */
  protected readonly coordenadasCompletas = computed<VerticeCompleto[]>(() =>
    this.coordenadas().filter(
      (vertice): vertice is VerticeCompleto => vertice.este !== null && vertice.norte !== null,
    ),
  );

  protected readonly coordenadasValidas = computed(() => this.coordenadasCompletas().length >= 3);

  /** Estado geométrico para el aviso flotante sobre el visor. */
  protected readonly estadoGeometrico = computed(() => {
    const total = this.coordenadasCompletas().length;
    if (total >= 3) {
      return 'Polígono en pantalla';
    }
    if (total === 2) {
      return 'Faltan vértices: una línea no encierra área';
    }
    return 'Mínimo 3 vértices requeridos';
  });

  protected readonly modalDataValido = computed(() => {
    const borrador = this.borrador();
    return borrador.descripcion.trim() !== '' && borrador.actividad.trim() !== '';
  });

  /** `true` cuando el modal está editando un área ya existente. */
  protected readonly modalEnEdicion = computed(() => this.borrador().id !== null);

  private contador = 0;

  /** `true` entre un montaje del visor y su liberación. */
  private mapaMontado = false;

  constructor() {
    /*
     * El visor vive dentro del modal, así que su elemento no existe hasta que
     * el modal se abre. Montarlo en `ngAfterViewInit` lo dejaría sin destino
     * siempre. El efecto ata el montaje a la existencia del propio lienzo:
     * aparece al abrir, desaparece al cerrar, y en ese momento se libera.
     *
     * Se sigue únicamente al lienzo, no al borrador ni a los vértices. Tocar un
     * vértice o escribir un campo no debe remontar el mapa: el repintado de cada
     * pulsación lo dispara `actualizarGraficoMapa`, que para eso existe.
     *
     * `mapaMontado` evita destruir un mapa que nunca llegó a existir: con el
     * modal cerrado de entrada el efecto se ejecuta igual, y sin este testigo
     * la primera pasada sería una liberación de la nada.
     */
    effect(() => {
      const destino = this.lienzo()?.nativeElement ?? null;
      if (!destino) {
        if (this.mapaMontado) {
          this.mapaMontado = false;
          this.mapa.destruir();
        }
        return;
      }
      if (!this.mapaMontado) {
        this.mapaMontado = this.mapa.montar(
          destino,
          untracked(() => this.borrador().zona),
        );
      }
      untracked(() => this.actualizarGraficoMapa());
    });
  }

  ngOnDestroy(): void {
    this.mapa.destruir();
  }

  /* ------------------------------------------------------------------
     MODAL DE ALTA Y EDICIÓN
     ------------------------------------------------------------------ */

  /**
   * Abre el modal para una categoría nueva.
   *
   * El datum no se limpia: no es un campo que el titular pueda cambiar, así que
   * arrastrarlo como si lo fuera solo daría la impresión de que sí.
   */
  protected abrirModalNuevo(categoria: TipoCategoriaArea): void {
    this.modalCategoria.set(categoria);
    this.borrador.set({ ...BORRADOR_NUEVO });
    this.coordenadas.set(this.verticesEnBlanco(VERTICES_INICIALES));
    this.aviso.set(null);
    this.modalAbierto.set(true);
  }

  /** Abre el modal sobre un área existente, con sus datos y su geometría. */
  protected abrirModalEdicion(area: AreaSuperficial): void {
    this.modalCategoria.set(area.categoria);
    this.borrador.set({
      id: area.id,
      descripcion: area.descripcion,
      actividad: area.actividad,
      zona: area.zona,
      datum: area.datum,
    });
    // Los vértices se clonan: editar la geometría del modal no debería alterar
    // el inventario hasta que el titular pulse grabar.
    this.coordenadas.set(area.coordenadas.map((vertice) => ({ ...vertice })));
    this.aviso.set(null);
    this.modalAbierto.set(true);
  }

  /** Cierra el modal y descarta el borrador. */
  protected cerrarModalArea(): void {
    this.modalAbierto.set(false);
    this.aviso.set(null);
  }

  protected alEscribirBorrador(campo: 'descripcion' | 'actividad', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.borrador.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected alElegirZona(evento: Event): void {
    const zona = (evento.target as HTMLSelectElement).value as ZonaUTM;
    this.borrador.update((actual) => ({ ...actual, zona }));
    // La zona es parte del dibujo: cambiar a qué banda UTM pertenece el área
    // debe reflejarse en el visor de inmediato, no esperar a la siguiente
    // edición de un vértice.
    this.actualizarGraficoMapa();
  }

  /* ------------------------------------------------------------------
     INVENTARIO DE ÁREAS
     ------------------------------------------------------------------ */

  protected eliminarArea(id: string, categoria: TipoCategoriaArea): void {
    const coleccion = this.coleccionDe(categoria);
    coleccion.update((areas) => areas.filter((area) => area.id !== id));
  }

  /** Añade una fila de vértice en blanco la geometría en edición. */
  protected agregarNuevaCoordenadaManual(): void {
    this.coordenadas.update((actual) => [...actual, ...this.verticesEnBlanco(1)]);
  }

  /** Quita la fila indicada y repinta el polígono. */
  protected eliminarCoordenadaFila(id: string): void {
    this.coordenadas.update((actual) => actual.filter((vertice) => vertice.id !== id));
    this.actualizarGraficoMapa();
  }

  protected alEscribirVertice(id: string, campo: 'este' | 'norte', evento: Event): void {
    const bruto = (evento.target as HTMLInputElement).value.trim();
    const valor = bruto === '' ? null : Number(bruto);
    const seguro = valor !== null && Number.isFinite(valor) ? valor : null;

    this.coordenadas.update((actual) =>
      actual.map((vertice) => (vertice.id === id ? { ...vertice, [campo]: seguro } : vertice)),
    );
    this.actualizarGraficoMapa();
  }

  /**
   * Descarta el polígono dibujado y repone las filas de partida.
   *
   * No se deja la grilla vacía porque quien limpia casi siempre va a redibujar de
   * inmediato, y empezar de cero en blanco obliga a crear las filas a mano.
   */
  protected limpiarEstructuraMapa(): void {
    this.coordenadas.set(this.verticesEnBlanco(VERTICES_INICIALES));
    this.actualizarGraficoMapa();
  }

  /* ------------------------------------------------------------------
     TRAZADO EN CALIENTE SOBRE EL VISOR
     ------------------------------------------------------------------ */

  /**
   * Vuelca los vértices vigentes en el mapa.
   *
   * Se ejecuta en cada edición, y por eso limpia la fuente antes de dibujar: si
   * al borrar el tercer vértice el polígono se quedara congelado en pantalla,
   * el visor prometería un área que ya no existe. Con menos de tres vértices
   * válidos lo que corresponde es borrar, no dibujar.
   *
   * Encuadra en cada pasada para que el polígono recién dibujado quede siempre a
   * la vista. Delega en un solo método de la fachada porque el anillo se proyecta
   * una vez: dibujar y luego encuadrar por separado transformaría dos veces todos
   * los vértices en cada tecla, y una importación puede traer varios cientos.
   */
  protected actualizarGraficoMapa(): void {
    this.mapa.actualizarPoligono(
      this.coordenadasCompletas().map((vertice) => ({ este: vertice.este, norte: vertice.norte })),
      this.borrador().zona,
      true,
    );
  }

  /* ------------------------------------------------------------------
     CONTROL DE CAPAS DEL VISOR
     ------------------------------------------------------------------ */

  /** Cambia el mapa base y deja el selector coherente con lo pintado. */
  protected cambiarCapaBase(clave: ClaveCapaBase): void {
    this.capaBase.set(clave);
    this.mapa.cambiarCapaBase(clave);
  }

  /** Enciende o apaga la capa del polígono sin perder la geometría capturada. */
  protected alternarPoligono(evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    this.poligonoVisible.set(marcado);
    this.mapa.alternarPoligono(marcado);
  }

  /* ------------------------------------------------------------------
     IMPORTACIÓN DE ARCHIVOS
     ------------------------------------------------------------------ */

  /**
   * Lee un CSV de coordenadas UTM.
   *
   * Admite las dos formas que circulan en catastro: `este,norte` a dos columnas, y
   * `id,este,norte` cuando el archivo numera el vertice en la primera. La
   * disposicion se resuelve una vez para todo el archivo, con los rotulos de la
   * cabecera cuando los hay, y segun el ancho cuando el archivo no los trae: la
   * heuristica de buscar celdas consecutivas numericas fallaba justo con el id.
   *
   * Se aceptan coma y punto y coma como separador porque las descargas de
   * catastro usan uno u otro. Las lineas de encabezado se descartan solas con
   * el filtro numerico: el archivo no declara cual de ellas lo es.
   */
  protected async alSubirCsv(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      return;
    }
    const texto = await archivo.text();
    const separador = texto.includes(';') ? ';' : ',';

    const filas = texto
      .split(/\r?\n/)
      .filter((linea) => linea.trim() !== '')
      .map((linea) => linea.split(separador));
    const disposicion = resolverDisposicion(filas);

    const puntos: ParUTM[] = [];
    for (const fila of filas) {
      const par = parEnFila(fila, disposicion);
      if (par) {
        puntos.push(par);
      }
    }
    if (puntos.length === 0) {
      this.aviso.set('El CSV no contenía pares de coordenadas numéricos.');
      entrada.value = '';
      return;
    }
    this.incorporarPuntos(puntos);
    this.aviso.set(`CSV leído: ${puntos.length} vértices importados.`);
    entrada.value = '';
  }

  /**
   * Lee un shapefile, en bruto o empaquetado en `.zip`.
   *
   * El `.zip` es el formato con el que suele llegar el shapefile desde el
   * catastro, de modo que ambos se aceptan. El `.prj` que lo acompaña sí se
   * aprovecha: sin él, las coordenadas del anillo no se sabe en qué sistema
   * están, y escribirlas como UTM produce un expediente con la geometría corrida.
   */
  protected async alSubirShapefile(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      return;
    }
    const nombre = archivo.name.toLowerCase();
    if (!nombre.endsWith('.zip') && !nombre.endsWith('.shp')) {
      this.aviso.set('El archivo debe ser un shapefile .shp o un .zip con la capa.');
      entrada.value = '';
      return;
    }
    const bruto = await archivo.arrayBuffer();
    const datos = nombre.endsWith('.zip') ? await extraerShapefileDeZip(bruto) : bruto;

    if (!datos) {
      this.aviso.set('El archivo comprimido no contiene un shapefile legible.');
      entrada.value = '';
      return;
    }
    const lectura = leerPoligonosShapefile(datos);
    if (lectura.error) {
      this.aviso.set(lectura.error);
      entrada.value = '';
      return;
    }

    // Solo se toma el primer anillo: un multianillo exige restar agujeros, y esa
    // geometría no es la que esta sección necesita calcular.
    const primero = lectura.anillos[0] ?? [];
    if (primero.length === 0) {
      this.aviso.set('El shapefile no tiene vértices que importar.');
      entrada.value = '';
      return;
    }

    const avisoZona = await this.comprobarZonaDelShapefile(bruto, nombre);
    this.incorporarPuntos(primero.map((punto) => ({ este: punto.x, norte: punto.y })));
    this.aviso.set(`Shapefile leído: ${primero.length} vértices del anillo exterior${avisoZona}.`);
    entrada.value = '';
  }

  /**
   * Compara el sistema de referencia que declara el `.prj` con la zona del área.
   *
   * No reproyecta: los vértices entran tal cual, en la zona que el titular
   * declaró. El `.prj` se lee solo para avisar cuando no coinciden, porque los
   * shapefiles llegan de varias fuentes y un archivo en grados entraría al
   * expediente como si fueran metros. Es preferible que el titular lo detecte a
   * que se guarde una geometría corrida en la base.
   *
   * Devuelve el texto a añadir al aviso de éxito, o cadena vacía si todo cuadra.
   */
  private async comprobarZonaDelShapefile(bruto: ArrayBuffer, nombre: string): Promise<string> {
    // Solo el `.zip` puede traer el `.prj` al lado; un `.shp` suelto llega sin él.
    const epsg = nombre.endsWith('.zip') ? await leerEpsgDeZip(bruto) : null;
    if (epsg === null) {
      return '';
    }
    const destino = EPSG_POR_ZONA[this.borrador().zona] ?? EPSG_POR_ZONA['18S'];
    if (`EPSG:${epsg}` === destino) {
      return '';
    }
    return (
      ` Ojo: el archivo se declara en EPSG:${epsg} y el área está en ${destino}; ` +
      'los vértices se tomaron tal cual, así que conviene revisarlos.'
    );
  }

  /** Reemplaza los vértices del modal por los puntos importados. */
  private incorporarPuntos(puntos: readonly { este: number; norte: number }[]): void {
    if (puntos.length === 0) {
      this.aviso.set('El archivo no trajo coordenadas que importar.');
      return;
    }
    this.coordenadas.set(
      puntos.map((punto) => ({
        id: this.nuevoId('v'),
        este: punto.este,
        norte: punto.norte,
      })),
    );
    this.actualizarGraficoMapa();
  }

  /* ------------------------------------------------------------------
     GRABADO EN EL EXPEDIENTE
     ------------------------------------------------------------------ */

  /**
   * Serializa el polígono vigente como OGC WKT `POLYGON`.
   *
   * Es la representación textual del campo `geometry` que consume la base de
   * datos: los vértices viajan además como números para el cruce catastral de la
   * 2.2, y el WKT evita que el backend tenga que volver a construir el anillo y
   * decidir por su cuenta dónde cerrarlo.
   *
   * Solo considera los vértices completos y los entrega en UTM, que es el datum
   * con el que se admiten los expedientes. Cadena vacía si no hay polígono
   * cerrado, que es el mismo criterio de `coordenadasValidas`.
   */
  public calcularWktGeometria(): string {
    return wktPoligono(this.coordenadas());
  }

  /**
   * Sella el expediente: consolida el área y publica su polígono.
   *
   * Es el único punto por el que el resto de la 2.5 puede leer geometría: la 2.2
   * cruza las coordenadas contra el catastro y la 2.4 hereda el ubigeo político,
   * que sigue derivándose de esta área en lugar de escrito a mano. Si este botón
   * no se pulsa, esas secciones quedan pendientes por una razón que no es suya.
   *
   * El alta crea la fila del inventario; la edición actualiza la existente por su
   * `id`. Ambas guardan la geometría del modal en el mismo paso, de modo que no
   * existe un momento en que el rótulo esté actualizado y el polígono no.
   *
   * `registrarAreaEfectiva` va antes que el semáforo porque es la escritura que
   * habilita a las secciones vecinas: poner en verde una sección cuyo polígono
   * no se ha publicado dejaría el expediente en verde y sin geometría que cruzar.
   *
   * El cierre es parte del sello: el área ya está en el expediente y dejarla
   * abierta invitaría a un segundo desenho que no se confundiría con el primero.
   */
  protected grabarAreaValidada(): void {
    if (!this.modalDataValido() || !this.coordenadasValidas()) {
      return;
    }
    const borrador = this.borrador();
    const categoria = this.modalCategoria();
    const coordenadas = this.coordenadas().map((vertice) => ({ ...vertice }));
    const grabada: AreaSuperficial = {
      id: borrador.id ?? this.nuevoId('a'),
      categoria,
      descripcion: borrador.descripcion.trim(),
      actividad: borrador.actividad.trim(),
      zona: borrador.zona,
      datum: DATUM,
      coordenadas,
      // El WKT viaja en el mismo objeto que los vértices para que no exista un
      // momento en que uno esté calculado y el otro no.
      geometry: wktPoligono(coordenadas),
    };
    this.coleccionDe(categoria).update((areas) =>
      borrador.id !== null
        ? areas.map((area) => (area.id === borrador.id ? grabada : area))
        : [...areas, grabada],
    );

    this.store.registrarAreaEfectiva(
      this.coordenadasCompletas().map((vertice) => ({
        este: vertice.este,
        norte: vertice.norte,
      })),
    );
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.cerrarModalArea();
  }

  /* ------------------------------------------------------------------
     SOPORTE INTERNO
     ------------------------------------------------------------------ */

  private coleccionDe(categoria: TipoCategoriaArea) {
    return categoria === 'ACTIVIDAD' ? this.areasActividad : this.areasUso;
  }

  /** Filas de vértice vacías, con identificadores únicos y deterministas. */
  private verticesEnBlanco(cantidad: number): Vertice[] {
    return Array.from({ length: cantidad }, () => ({
      id: this.nuevoId('v'),
      este: null as number | null,
      norte: null as number | null,
    }));
  }

  private nuevoId(prefijo: string): string {
    this.contador += 1;
    return `${prefijo}-${this.contador}`;
  }
}
