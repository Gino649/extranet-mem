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
import { boundingExtent } from 'ol/extent';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import SourceVector from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { fromLonLat } from 'ol/proj';
import {
  AreaInfluencia,
  DaexStore,
  TipoAreaInfluencia,
  TipoInfluencia,
  VerticeInfluencia,
  ZonaUTM,
} from '../../../../state/daex.store';
import {
  CENTRO_PERU,
  EPSG_POR_ZONA,
  ZOOM_PERU,
  reproyectar,
} from '../2-5-delimitacion/mapa-facade';
import {
  extraerShapefileDeZip,
  leerEpsgDeZip,
  leerPoligonosShapefile,
} from '../2-5-delimitacion/shapefile';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '5.2';

/** Datum único con el que se admite el expediente. */
const DATUM = 'WGS84';

/** Zonas UTM ofrecidas en el selector del modal. */
const ZONAS: readonly ZonaUTM[] = ['17S', '18S', '19S'];

/** Alcances que admite cada inventario, directo e indirecto. */
const TIPOS: readonly TipoAreaInfluencia[] = ['DIRECTA', 'INDIRECTA'];

/** Zona por defecto de un área recién dada de alta. */
const ZONA_POR_DEFECTO: ZonaUTM = '18S';

/**
 * Filas de vértice con las que arranca la geometría de un área nueva.
 *
 * Tres porque es el mínimo de un polígono, y vacías porque quién dibuja es el
 * titular: el formulario no le inventa posiciones a un área recién nombrada.
 */
const VERTICES_INICIALES = 3;

/**
 * Tope de filas que muestra la grilla de captura.
 *
 * Una importación masiva de shapefile puede traer cientos de vértices y
 * renderizarlos todos congela la grilla; la captura se limita a los cincuenta
 * primeros y el aviso informa de cuántos quedan fuera. La geometría, el WKT y
 * la validación siempre trabajan con la lista completa, no con la recortada.
 */
const MAX_VERTICES_EN_GRILLA = 50;

/**
 * Plantilla de tiles del satelital, en la convención `{z}/{x}/{y}`.
 *
 * Vive aquí (y no en la 2.5) porque el visor de esta sección instancia
 * OpenLayers directamente; los parámetros son los mismos que declara la
 * fachada de la 2.5 para que ambos visores muestren la misma base.
 */
const URL_SATELITAL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Créditos que exige la fuente del satelital, mostrados por el control. */
const ATRIBUCION_ESRI = 'Esri, Maxar, Earthstar Geographics, and the GIS User Community';

/** Nivel máximo del satelital, por encima del cual amplía la misma imagen. */
const ZOOM_MAXIMO_SATELITAL = 19;

/**
 * Vértice con los dos ejes ya resueltos a número.
 *
 * Statement de captura: en la grilla los ejes admiten `null` (fila sin
 * escribir), pero para dibujar, validar y serializar solo cuentan los resueltos.
 */
type VerticeCompleto = VerticeInfluencia & { readonly este: number; readonly norte: number };

/**
 * Borrador del modal: los datos del área sin su geometría.
 *
 * La geometría no viaja aquí: se edita aparte en la señal `coordenadas` y se
 * consolida al grabar. `id` es `null` en el alta y el identificador de la fila
 * en la edición.
 */
interface BorradorAreaInfluencia {
  readonly id: string | null;
  readonly tipo: TipoAreaInfluencia;
  readonly nombre: string;
  readonly zona: ZonaUTM;
  readonly datum: 'WGS84';
}

/** Borrador recién abierto, en blanco y con el datum ya fijo. */
const BORRADOR_NUEVO: BorradorAreaInfluencia = {
  id: null,
  tipo: 'DIRECTA',
  nombre: '',
  zona: ZONA_POR_DEFECTO,
  datum: DATUM,
};

/**
 * Cifra un eje UTM para la cadena WKT.
 *
 * Se redondea a tres decimales —milímetro en un plano UTM— porque los vértices
 * llegan de una grilla y de archivos, y sin redondear arrastrarían ruido de
 * coma flotante. Los ceros finales se recortan para que un Este entero se lea
 * `431250` y no `431250.000`.
 */
function cifrarEje(valor: number): string {
  return valor.toFixed(3).replace(/\.?0+$/, '');
}

/**
 * Serializa los vértices como geometría OGC WKT en UTM.
 *
 * Con dos vértices completos se emite `LINESTRING`: dos pares no encierran
 * área, y es la geometría honesta de lo que hay dibujado. Con tres o más se
 * emite `POLYGON`, cerrando el anillo repitiendo el primer punto (OGC lo exige
 * y es lo que distingue un polígono de una cadena abierta).
 *
 * Las filas incompletas se descartan antes de construir el texto: un vértice a
 * medio rellenar no es una posición.
 *
 * @returns El WKT, o cadena vacía si hay menos de dos vértices completos.
 */
function wktInfluencia(vertices: readonly VerticeInfluencia[]): string {
  const completos = vertices.filter(
    (vertice): vertice is VerticeCompleto => vertice.este !== null && vertice.norte !== null,
  );
  if (completos.length < 2) {
    return '';
  }
  const pares = completos.map(
    (vertice) => `${cifrarEje(vertice.este)} ${cifrarEje(vertice.norte)}`,
  );
  if (completos.length === 2) {
    return `LINESTRING (${pares.join(', ')})`;
  }
  return `POLYGON ((${[...pares, pares[0]!].join(', ')}))`;
}

/**
 * Convierte una celda en número, o `null` si no es un número.
 *
 * `Number('')` es 0, así que una celda vacía pasaría por coordenada: se
 * descarta antes de convertir. `Number` y no `parseFloat` a propósito, porque
 * `parseFloat('431250abc')` devuelve 431250 y daría por buena una fila corrupta.
 */
function aNumero(celda: string | undefined): number | null {
  const texto = celda?.trim() ?? '';
  if (texto === '') {
    return null;
  }
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Microcomponente de la sección 5.2 · Área de Influencia.
 *
 * Lleva dos inventarios —ambiental (5.2.1) y social (5.2.2)— y, en un Súper
 * Modal de vista partida, la captura de la geometría de cada área: la grilla de
 * vértices a la izquierda y un visor OpenLayers a la derecha alimentado en
 * caliente con lo que se teclea o se importa.
 *
 * El visor instancia OpenLayers directamente (y no la fachada de la 2.5)
 * porque esta sección también dibuja líneas: un área capturada con dos vértices
 * es un `LINESTRING`, y la fachada de la 2.5 solo sabe de polígonos. La
 * configuración de proyección (zonas UTM → Web Mercator) sí se reutiliza de
 * la fachada para que el sistema de referencia tenga un solo sitio.
 *
 * Las áreas se publican al store al validar porque el orquestador destruye los
 * microcomponentes al cambiar de capítulo: un signal local perdería lo que el
 * titular acaba de teclear.
 */
@Component({
  selector: 'app-areas-influencia',
  templateUrl: './areas-influencia.component.html',
  styleUrls: ['./areas-influencia.component.css'],
})
export class AreasInfluenciaComponent implements OnDestroy {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** Zonas y tipos ofrecidos en el selector del modal. */
  protected readonly zonas = ZONAS;
  protected readonly tipos = TIPOS;

  /** Inventario de influencia ambiental; el social vive en `areasSociales`. */
  protected readonly areasAmbientales = signal<readonly AreaInfluencia[]>([]);
  protected readonly areasSociales = signal<readonly AreaInfluencia[]>([]);

  protected readonly areaSeleccionada = signal<AreaInfluencia | null>(null);

  /** Vértices del área en edición, con filas en blanco mientras no se escriben. */
  protected readonly coordenadas = signal<readonly VerticeInfluencia[]>([]);

  /** El modal está abierto. */
  protected readonly modalAbierto = signal(false);

  /** Inventario que recibe el área creada o editada por el modal. */
  protected readonly modalCategoria = signal<TipoInfluencia>('AMBIENTAL');

  private readonly borrador = signal<BorradorAreaInfluencia>(BORRADOR_NUEVO);

  /** Resultado de la última importación, sea buena o mala. */
  protected readonly aviso = signal<string | null>(null);

  /** Borrador en edición, para la plantilla del modal. */
  protected readonly modalData = computed(() => this.borrador());

  /** El modal edita un área existente cuando el borrador trae identificador. */
  protected readonly modalEsEdicion = computed(() => this.borrador().id !== null);

  /**
   * El modal puede grabarse cuando el área tiene nombre.
   *
   * Se lee del signal del borrador, y no de un objeto plano, para que el botón
   * se habilite en cuanto se teclea: un `computed` sobre un objeto mutable no
   * tiene de dónde enterarse.
   */
  protected readonly modalDataValido = computed(() => this.borrador().nombre.trim() !== '');

  /** Filas mostradas en la grilla: las primeras cincuenta de la lista completa. */
  protected readonly coordenadasVisibles = computed(() =>
    this.coordenadas().slice(0, MAX_VERTICES_EN_GRILLA),
  );

  /** Vértices ya resueltos a número, sobre la lista completa (no la recortada). */
  private readonly coordenadasCompletas = computed<readonly VerticeCompleto[]>(() =>
    this.coordenadas().filter(
      (vertice): vertice is VerticeCompleto => vertice.este !== null && vertice.norte !== null,
    ),
  );

  /** Dos vértices completos bastan para que exista geometría. */
  protected readonly coordenadasValidas = computed(() => this.coordenadasCompletas().length >= 2);

  /** Cada inventario necesita al menos un área para validar la sección. */
  protected readonly grillaValida = computed(
    () => this.areasAmbientales().length > 0 && this.areasSociales().length > 0,
  );

  /** Estado geométrico para el aviso sobre el visor y bajo la grilla. */
  protected readonly estadoGeometrico = computed(() => {
    const total = this.coordenadasCompletas().length;
    if (total >= 3) {
      return 'Polígono en pantalla';
    }
    if (total === 2) {
      return 'Línea en pantalla: no encierra área';
    }
    return 'Mínimo 2 vértices requeridos';
  });

  /* ------------------------------------------------------------------
     VISOR OPENLAYERS
     ------------------------------------------------------------------ */

  /**
   * Contenedor del visor, que solo existe mientras el modal está abierto.
   * Un `viewChild` de señal y no `@ViewChild` porque el montaje del mapa tiene
   * que seguir al elemento, y ese elemento aparece y desaparece con el modal.
   */
  private readonly lienzo = viewChild<ElementRef<HTMLDivElement>>('mapaContainer');

  private mapa: Map | null = null;
  private fuente: SourceVector | null = null;

  /** `true` entre un montaje del visor y su liberación. */
  private mapaMontado = false;

  constructor() {
    /*
     * El visor vive dentro del modal, así que su elemento no existe hasta que
     * el modal se abre. Montarlo en `ngAfterViewInit` lo dejaría sin destino
     * siempre. El efecto ata el montaje a la existencia del propio lienzo:
     * aparece al abrir, desaparece al cerrar.
     *
     * Se sigue únicamente al lienzo, no a los vértices. Editar una fila no debe
     * relanzar el efecto de montaje; el repintado en caliente lo dispara
     * `actualizarGraficoMapaInfluencia`, que para eso existe.
     */
    effect(() => {
      const destino = this.lienzo()?.nativeElement ?? null;
      if (!destino) {
        if (this.mapaMontado) {
          this.mapaMontado = false;
          this.destruirMapa();
        }
        return;
      }
      if (!this.mapaMontado) {
        this.mapaMontado = this.montarMapa(destino);
      }
      untracked(() => this.actualizarGraficoMapaInfluencia());
    });

    // Rehidratación: el orquestador destruye la pieza al cambiar de capítulo,
    // y al volver se repueblan las grillas desde lo que el titular validó.
    effect(() => {
      const guardadas = this.store.areasInfluenciaRegistrada();
      if (guardadas.length === 0) {
        return;
      }
      this.areasAmbientales.set(guardadas.filter((area) => area.categoria === 'AMBIENTAL'));
      this.areasSociales.set(guardadas.filter((area) => area.categoria === 'SOCIAL'));
    });
  }

  ngOnDestroy(): void {
    this.destruirMapa();
  }

  /** Monta el mapa base y la capa de geometría sobre el destino. */
  private montarMapa(destino: HTMLElement): boolean {
    try {
      this.fuente = new SourceVector();
      this.mapa = new Map({
        target: destino,
        layers: [
          new TileLayer({
            source: new XYZ({
              url: URL_SATELITAL,
              maxZoom: ZOOM_MAXIMO_SATELITAL,
              attributions: ATRIBUCION_ESRI,
              crossOrigin: 'anonymous',
            }),
          }),
          new VectorLayer({ source: this.fuente }),
        ],
        controls: [new Zoom(), new Attribution({ collapsible: true })],
        view: new View({
          center: fromLonLat(CENTRO_PERU as [number, number]),
          zoom: ZOOM_PERU,
        }),
      });
      return true;
    } catch {
      this.destruirMapa();
      return false;
    }
  }

  /** Desmonta el visor y sus escuchas del DOM. */
  private destruirMapa(): void {
    this.mapa?.dispose();
    this.mapa = null;
    this.fuente = null;
  }

  /* ------------------------------------------------------------------
     FLUJO DEL MODAL (CRUD)
     ------------------------------------------------------------------ */

  /** Abre el modal en modo alta para una categoría, con la geometría en blanco. */
  protected abrirModalNuevo(categoria: TipoInfluencia): void {
    this.modalCategoria.set(categoria);
    this.borrador.set({ ...BORRADOR_NUEVO });
    this.areaSeleccionada.set(null);
    this.inyectar3FilasVaciasIniciales();
    this.aviso.set(null);
    this.modalAbierto.set(true);
  }

  /** Abre el modal sobre un área existente para corregir datos o geometría. */
  protected abrirModalEditar(area: AreaInfluencia): void {
    this.modalCategoria.set(area.categoria);
    this.borrador.set({
      id: area.id,
      tipo: area.tipo,
      nombre: area.nombre,
      zona: area.zona,
      datum: area.datum,
    });
    this.areaSeleccionada.set(area);
    this.coordenadas.set(area.vertices.map((vertice) => ({ ...vertice })));
    this.aviso.set(null);
    this.modalAbierto.set(true);
  }

  /** Cierra el modal y suelta el área en edición. */
  protected cerrarModalArea(): void {
    this.modalAbierto.set(false);
    this.areaSeleccionada.set(null);
    this.coordenadas.set([]);
    this.borrador.set({ ...BORRADOR_NUEVO });
    this.aviso.set(null);
  }

  /** Edita el nombre del área en el borrador. */
  protected alEscribirNombre(evento: Event): void {
    const nombre = (evento.target as HTMLInputElement).value;
    this.borrador.update((actual) => ({ ...actual, nombre }));
  }

  /** Elige el tipo (directo o indirecto) en el selector del modal. */
  protected alElegirTipo(evento: Event): void {
    const tipo = (evento.target as HTMLSelectElement).value as TipoAreaInfluencia;
    this.borrador.update((actual) => ({ ...actual, tipo }));
  }

  /**
   * Elige la zona UTM y repinta la geometría.
   *
   * Cambiar de zona reproyecta la misma lista: los vértices están escritos en
   * la zona que el titular declara, y el repintado debe reflejar la nueva.
   */
  protected alElegirZona(evento: Event): void {
    const zona = (evento.target as HTMLSelectElement).value as ZonaUTM;
    this.borrador.update((actual) => ({ ...actual, zona }));
    this.actualizarGraficoMapaInfluencia();
  }

  /* ------------------------------------------------------------------
     GRILLA DE VÉRTICES
     ------------------------------------------------------------------ */

  /** Repone las tres filas en blanco de partida. */
  protected inyectar3FilasVaciasIniciales(): void {
    this.coordenadas.set(this.verticesEnBlanco(VERTICES_INICIALES));
  }

  /** Añade una fila en blanco al final de la grilla. */
  protected agregarVerticeManual(): void {
    this.coordenadas.update((actual) => [...actual, ...this.verticesEnBlanco(1)]);
    this.actualizarGraficoMapaInfluencia();
  }

  /** Quita la fila indicada y repinta la geometría. */
  protected eliminarVerticeFila(id: string): void {
    this.coordenadas.update((actual) => actual.filter((vertice) => vertice.id !== id));
    this.actualizarGraficoMapaInfluencia();
  }

  /**
   * Escribe un eje de un vértice y repinta.
   *
   * Un campo vacío vuelve a `null` (fila sin resolver), y un texto que no es
   * número también: escribir «abc» en el Este no debe dejar un número corrupto
   * dentro de la grilla que luego se serialice al WKT.
   */
  protected alEscribirVertice(id: string, campo: 'este' | 'norte', evento: Event): void {
    const bruto = (evento.target as HTMLInputElement).value.trim();
    const numero = bruto === '' ? null : Number(bruto);
    const seguro = numero !== null && Number.isFinite(numero) ? numero : null;

    this.coordenadas.update((actual) =>
      actual.map((vertice) => (vertice.id === id ? { ...vertice, [campo]: seguro } : vertice)),
    );
    this.actualizarGraficoMapaInfluencia();
  }

  /**
   * Descarta la geometría dibujada y repone las filas de partida.
   *
   * No se deja la grilla vacía porque quien limpia casi siempre va a redibujar
   * de inmediato, y empezar de cero en blanco obliga a crear las filas a mano.
   */
  protected limpiarEstructuraMapaInfluencia(): void {
    this.inyectar3FilasVaciasIniciales();
    this.actualizarGraficoMapaInfluencia();
  }

  /* ------------------------------------------------------------------
     TRAZADO EN CALIENTE SOBRE EL VISOR
     ------------------------------------------------------------------ */

  /**
   * Vuelca los vértices vigentes en el mapa.
   *
   * Se ejecuta en cada edición, y por eso limpia la fuente antes de dibujar:
   * si al borrar un vértice la geometría se quedara congelada en pantalla, el
   * visor prometería un área que ya no existe. Con dos puntos se dibuja una
   * línea (`LINESTRING`); con tres o más, un polígono cerrado.
   *
   * Encuadra en cada pasada para que la geometría recién dibujada quede siempre
   * a la vista.
   */
  protected actualizarGraficoMapaInfluencia(): void {
    if (!this.fuente) {
      return;
    }
    this.fuente.clear();
    const puntos = this.coordenadasCompletas().map((vertice) =>
      this.reprojectarUtmALineasWebInfluencia(vertice.este, vertice.norte),
    );
    if (puntos.length < 2) {
      return;
    }
    const geometria =
      puntos.length === 2 ? new LineString(puntos) : new Polygon([[...puntos, puntos[0]!]]);
    this.fuente.addFeature(new Feature({ geometry: geometria }));
    this.encuadrarGeometria(puntos);
  }

  /** Ajusta la vista al envolvente de la geometría dibujada. */
  private encuadrarGeometria(puntos: [number, number][]): void {
    this.mapa?.getView().fit(boundingExtent(puntos as [number, number][]), {
      padding: [48, 48, 48, 48],
      maxZoom: 16,
    });
  }

  /**
   * Traduce un par UTM de la zona vigente a Web Mercator.
   *
   * El plan original preveía `proj4` global en `window`, pero la aplicación no
   * instala proj4. OpenLayers trae el meridiano transversal soportado de fábrica
   * y `transform` hace la conversión: es la misma razón documentada en la
   * fachada de la 2.5, y por eso se delega en `reprojectar` para que el sistema
   * de referencia tenga un solo sitio.
   */
  private reprojectarUtmALineasWebInfluencia(este: number, norte: number): [number, number] {
    const epsg = EPSG_POR_ZONA[this.borrador().zona] ?? EPSG_POR_ZONA['18S'];
    return reproyectar(este, norte, epsg, 'EPSG:3857');
  }

  /* ------------------------------------------------------------------
     IMPORTACIÓN DE ARCHIVOS
     ------------------------------------------------------------------ */

  /**
   * Lee un CSV de coordenadas UTM.
   *
   * El formato esperado es `vertice,este,norte` y la primera línea se omite
   * como cabecera. Se admite también el `;` como separador, que es el que
   * exportan las descargas de catastro del ámbito. Las celdas no numéricas se
   * descartan solas: `aNumero` exige que la celda entera sea un número.
   *
   * Lo importado se añade a la lista: primero se descartan las filas en blanco
   * que dejó la estructura de partida, para que una carga no acumule celdas
   * vacías delante de lo leído, y a continuación se encadenan los vértices
   * nuevos (semántica `push` del conjunto de coordenadas).
   */
  protected async alCargarCSVInfluencia(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      return;
    }
    const texto = await archivo.text();
    const separador = texto.includes(';') ? ';' : ',';
    const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim() !== '');

    // Primera línea fuera: la cabecera declara las columnas, no trae vértices.
    const filas = lineas.slice(1);

    const importados: VerticeInfluencia[] = [];
    for (const fila of filas) {
      const celdas = fila.split(separador);
      const este = aNumero(celdas[1]);
      const norte = aNumero(celdas[2]);
      if (este === null || norte === null) {
        continue;
      }
      importados.push({ id: this.nuevoId('v'), este, norte });
    }
    if (importados.length === 0) {
      this.aviso.set('El CSV no contenía filas con Este y Norte numéricos.');
      entrada.value = '';
      return;
    }

    const conservadas = this.coordenadas().filter(
      (vertice) => vertice.este !== null || vertice.norte !== null,
    );
    this.coordenadas.set([...conservadas, ...importados]);
    this.actualizarGraficoMapaInfluencia();
    this.aviso.set(`CSV leído: ${importados.length} vértices importados.`);
    entrada.value = '';
  }

  /**
   * Lee un shapefile, en bruto o empaquetado en `.zip`.
   *
   * El `.zip` es el formato con el que suele llegar la capa desde el catastro,
   * así que ambos se aceptan. El `.prj` que lo acompaña sí se aprovecha: sin él,
   * las coordenadas del anillo no se sabe en qué sistema están, y escribirlas
   * como UTM produce un área con la geometría corrida.
   *
   * Solo se toma el primer anillo: un multianillo exige restar agujeros, y esa
   * geometría no es la que esta sección necesita calcular.
   */
  protected async alCargarShapefileInfluencia(evento: Event): Promise<void> {
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
    const primero = lectura.anillos[0] ?? [];
    if (primero.length === 0) {
      this.aviso.set('El shapefile no tiene vértices que importar.');
      entrada.value = '';
      return;
    }

    const avisoZona = await this.comprobarZonaDelShapefile(bruto, nombre);
    const importados: VerticeInfluencia[] = primero.map((punto) => ({
      id: this.nuevoId('v'),
      este: punto.x,
      norte: punto.y,
    }));

    // Igual que con el CSV: se descartan las filas en blanco de partida y se
    // encadenan los vértices leídos sobre los que el titular hubiera escrito.
    const conservadas = this.coordenadas().filter(
      (vertice) => vertice.este !== null || vertice.norte !== null,
    );
    this.coordenadas.set([...conservadas, ...importados]);
    this.actualizarGraficoMapaInfluencia();
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

  /* ------------------------------------------------------------------
     GRABADO EN EL EXPEDIENTE
     ------------------------------------------------------------------ */

  /**
   * Serializa la geometría vigente como OGC WKT en UTM.
   *
   * Es la misma representación textual que recibe el campo `geometry` de la
   * base: dos vértices como `LINESTRING`, tres o más como `POLYGON` cerrado.
   * Los vértices viajan además como números para la grilla de captura, y el
   * WKT evita que el backend tenga que decidir por su cuenta dónde cerrar.
   */
  public calcularWktGeometriaInfluencia(): string {
    return wktInfluencia(this.coordenadas());
  }

  /** Transacción del modal: graba el área o la descarta. */
  protected procesarGuardadoAreaInfluenciaModal(): void {
    if (!this.modalDataValido() || !this.coordenadasValidas()) {
      return;
    }
    const borrador = this.borrador();
    const grabada: AreaInfluencia = {
      id: borrador.id ?? this.nuevoId('INF'),
      categoria: this.modalCategoria(),
      tipo: borrador.tipo,
      nombre: borrador.nombre.trim(),
      zona: borrador.zona,
      datum: DATUM,
      vertices: this.coordenadas().map((vertice) => ({ ...vertice })),
      geometry: wktInfluencia(this.coordenadas()),
    };
    const coleccion = this.coleccionDe(grabada.categoria);
    coleccion.update((actual) =>
      borrador.id !== null
        ? actual.map((area) => (area.id === borrador.id ? grabada : area))
        : [...actual, grabada],
    );
    this.cerrarModalArea();
  }

  /** Elimina un área del inventario que la contiene. */
  protected eliminarAreaCompleta(id: string): void {
    const enAmbientales = this.areasAmbientales().some((area) => area.id === id);
    const coleccion = enAmbientales ? this.areasAmbientales : this.areasSociales;
    coleccion.update((actual) => actual.filter((area) => area.id !== id));
    if (this.areaSeleccionada()?.id === id) {
      this.areaSeleccionada.set(null);
    }
  }

  /**
   * Publica el inventario completo y pasa la sección a verde.
   *
   * Se exige al menos un área por inventario: la influencia ambiental y la
   * social se declaran juntas en el EIA, y firmar una sola dejaría un análisis
   * a medias. Las sub-capas 5.2.1 y 5.2.2 quedan absorbidas por este inventario
   * compuesto, así que se marcan junto a la 5.2; si no, el avance del capítulo
   * las dejaría en gris sin forma de completarlas.
   */
  protected guardarYValidarAreasInfluenciaSeccion(): void {
    if (!this.grillaValida()) {
      return;
    }
    this.store.registrarAreasInfluencia([...this.areasAmbientales(), ...this.areasSociales()]);
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.store.actualizarEstadoSeccion('5.2.1', 'VERDE');
    this.store.actualizarEstadoSeccion('5.2.2', 'VERDE');
  }

  /* ------------------------------------------------------------------
     SOPORTE INTERNO
     ------------------------------------------------------------------ */

  /** Colección según la categoría del área. */
  private coleccionDe(categoria: TipoInfluencia) {
    return categoria === 'AMBIENTAL' ? this.areasAmbientales : this.areasSociales;
  }

  /** Filas de vértice en blanco, con identificadores únicos y deterministas. */
  private verticesEnBlanco(cantidad: number): VerticeInfluencia[] {
    return Array.from({ length: cantidad }, () => ({
      id: this.nuevoId('v'),
      este: null as number | null,
      norte: null as number | null,
    }));
  }

  /**
   * Identificador único de fila.
   *
   * Se usa un contador y no `Date.now()` porque las filas se borran y se
   * vuelven a añadir: con el contador la fila nueva queda al final y `track` no
   * reutiliza el DOM de la que se acaba de eliminar. Los rótulos de los
   * archivos importados no se usan como id porque pueden repetirse entre dos
   * cargas y romper el `track` del `@for`.
   */
  private contador = 0;

  private nuevoId(prefijo: string): string {
    this.contador += 1;
    return `${prefijo}-${this.contador}`;
  }
}
