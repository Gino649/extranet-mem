import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import Attribution from 'ol/control/Attribution';
import Zoom from 'ol/control/Zoom';
import Polygon from 'ol/geom/Polygon';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { boundingExtent } from 'ol/extent';
import { fromLonLat, transform } from 'ol/proj';

/** Centro del territorio continental peruano, en grados (lon, lat). */
export const CENTRO_PERU: readonly [number, number] = [-75.015592, -9.189967];

/** Zoom que abarca el país entero con el visor del expediente. */
export const ZOOM_PERU = 5;

/**
 * Mapas base que el visor puede mostrar.
 *
 * El satelital es el que serve para contrastar el polígono con el terreno, que es
 * lo que hace el titular al delimitar; el callejero queda como alternativa para
 * ubicarse por referencias de población.
 */
export type ClaveCapaBase = 'esri' | 'osm';

/** Orden de pintado y de presentación en el selector de capas. */
export interface OpcionCapaBase {
  readonly clave: ClaveCapaBase;
  readonly titulo: string;
}

/** Catálogo de mapas base, en el orden en que los ofrece el selector. */
export const CAPAS_BASE: readonly OpcionCapaBase[] = [
  { clave: 'esri', titulo: 'Satelital (Esri)' },
  { clave: 'osm', titulo: 'Callejero (OpenStreetMap)' },
];

/**
 * Créditos que exige la fuente del satelital.
 *
 * No son opcionales: la licencia de uso administrativo de World Imagery obliga a
 * mostrarlos, y el control `Attribution` los lee de la fuente para pintar el pie
 * del visor. Sin esta línea el mapa se vería sin referencia de origen.
 */
const ATRIBUCION_ESRI = 'Esri, Maxar, Earthstar Geographics, and the GIS User Community';

/** Plantilla de tiles del satelital, en la convención `{z}/{x}/{y}`. */
const URL_SATELITAL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Nivel máximo del satelital.
 *
 * Por encima de 19 la fuente sigue respondiendo, pero con una ampliación de la
 * misma imagen: el visor no debe prometer más detalle del que los tiles contienen.
 */
const ZOOM_MAXIMO_SATELITAL = 19;

/** Par de coordenadas proyectadas en UTM. */
export interface ParUTM {
  readonly este: number;
  readonly norte: number;
}

/** Zona UTM y su código EPSG. */
export type ZonaUTM = '17S' | '18S' | '19S';

/** Código EPSG de las coordenadas geográficas en grados, las que entrega un `.shp`. */
export const EPSG_GEOMETRICO = 4326;

/**
 * Zonas UTM que atraviesan el Perú, con su código EPSG hemisférico sur.
 *
 * OpenLayers trae el meridiano transversal soportado de fábrica, de modo que la
 * conversión UTM → Web Mercator es `transform` y no aritmética propia. Escribir
 * aquí el desplazamiento a mano habría producido un polígono deformado: UTM es
 * plana y Web Mercator no, y sumar un offset constante no corrige la diferencia
 * de escala entre ambas.
 */
export const EPSG_POR_ZONA: Record<ZonaUTM, string> = {
  '17S': 'EPSG:32717',
  '18S': 'EPSG:32718',
  '19S': 'EPSG:32719',
};

/**
 * Traduce un par de coordenadas entre dos sistemas EPSG.
 *
 * Vive aquí y no en el componente para que la configuración de proyección tenga un
 * solo sitio, que es la razón de ser de la fachada.
 */
export function reproyectar(
  x: number,
  y: number,
  epsgOrigen: string,
  epsgDestino: string,
): [number, number] {
  return transform([x, y], epsgOrigen, epsgDestino) as [number, number];
}

/**
 * Fachada sobre OpenLayers.
 *
 * Existe por dos razones concretas.
 *
 * La primera es aislar la librería del componente: `ol` construye canvas y
 * llama `getContext`, de modo que instanciarla dentro del runner rompe la
 * suite. Con la fachada, el componente depende de esta clase y los tests la
 * sustituyen por un doble.
 *
 * La segunda es que la conversión de proyección no es asunto del componente:
 * aislarla deja un solo sitio donde revisar el sistema de referencia cuando la
 * 2.5 deje de capturar en UTM y pase a hacerlo en grados.
 */
export class MapaFacade {
  private mapa: Map | null = null;
  private fuente: VectorSource | null = null;
  private capaPoligono: VectorLayer | null = null;
  private capasBase: Partial<Record<ClaveCapaBase, TileLayer>> = {};
  private claveBase: ClaveCapaBase = 'esri';

  /** `false` mientras el mapa no esté montado. */
  get montado(): boolean {
    return this.mapa !== null;
  }

  /** Mapa base que se está mostrando, para que el selector lo refleje. */
  get capaBaseActual(): ClaveCapaBase {
    return this.claveBase;
  }

  /** `false` cuando el usuario apagó la capa del polígono. */
  get poligonoVisible(): boolean {
    return this.capaPoligono?.getVisible() ?? true;
  }

  /**
   * Monta el mapa base sobre el elemento destino.
   *
   * No falla si el destino no tiene tamaño medible: es el caso de un contenedor
   * aún oculto por un acordeón, y también el de jsdom.
   */
  montar(destino: HTMLElement, zona: ZonaUTM = '18S'): boolean {
    if (this.mapa) {
      return true;
    }
    try {
      this.fuente = new VectorSource();
      this.capasBase = {
        esri: new TileLayer({
          source: new XYZ({
            url: URL_SATELITAL,
            maxZoom: ZOOM_MAXIMO_SATELITAL,
            attributions: ATRIBUCION_ESRI,
            /*
             * La fuente envía `Access-Control-Allow-Origin: *`, así que pedir CORS
             * funciona y es lo que mantiene el canvas sin contaminar. Sin esto,
             * cualquier `toDataURL` del visor fallaría al imprimir en PDF.
             */
            crossOrigin: 'anonymous',
          }),
        }),
        osm: new TileLayer({
          visible: false,
          source: new OSM(),
        }),
      };
      this.claveBase = 'esri';
      this.capaPoligono = new VectorLayer({
        source: this.fuente,
      });

      this.mapa = new Map({
        target: destino,
        layers: [this.capasBase.esri!, this.capasBase.osm!, this.capaPoligono],
        /*
         * Los controles se declaran en vez de heredar `default` porque el
         * plegado de la atribución es una opción del control `Attribution`, no
         * de la fuente: `attributionsCollapsible` no existe en las opciones de
         * `ol/source/OSM`, que solo admite url, crossOrigin, tileLoadFunction y
         * attributions. Pasárselo a la fuente se descartaba en silencio.
         *
         * `Zoom` se declara explícito porque sustituir la lista de controles
         * elimina los que vienen por defecto, y sin él el visor perdía la
         * capacidad de acercarse al polígono dibujado.
         */
        controls: [new Zoom(), new Attribution({ collapsible: true })],
        view: new View({
          center: fromLonLat(CENTRO_PERU as [number, number]),
          zoom: ZOOM_PERU,
        }),
      });
      return true;
    } catch {
      this.mapa = null;
      this.fuente = null;
      this.capaPoligono = null;
      this.capasBase = {};
      return false;
    }
  }

  /**
   * Dibuja el polígono y, si se pide, encuadra la vista sobre él.
   *
   * Existe como método único y no como dos porque el anillo se proyecta una sola
   * vez. Con la 2.5 encuadrando en cada edición, hacer `pintarPoligono` y luego
   * `encuadrar` transformaba dos veces todos los vértices en cada tecla, y una
   * importación puede traer varios cientos.
   */
  actualizarPoligono(pares: readonly ParUTM[], zona: ZonaUTM = '18S', encuadrar = false): void {
    if (!this.fuente) {
      return;
    }
    this.fuente.clear();
    const anillo = this.anillo(pares, zona);
    if (anillo.length === 0) {
      return;
    }
    this.fuente.addFeature(new Feature({ geometry: new Polygon([anillo]) }));
    if (encuadrar) {
      this.encuadrarAnillo(anillo);
    }
  }

  /** Sustituye el polígono dibujado por el conjunto de vértices vigente. */
  pintarPoligono(pares: readonly ParUTM[], zona: ZonaUTM = '18S'): void {
    this.actualizarPoligono(pares, zona, false);
  }

  /** Recentra y escala la vista para encuadrar el polígono. */
  encuadrar(pares: readonly ParUTM[], zona: ZonaUTM = '18S'): void {
    const anillo = this.anillo(pares, zona);
    /*
     * Con menos de tres vértices no hay polígono que encuadrar, y recentrar en el
     * país entero cada vez que se borra un vértice compite con la edición: la
     * vista se iría del área al país entero mientras se corrige un vértice.
     */
    if (anillo.length === 0) {
      return;
    }
    this.encuadrarAnillo(anillo);
  }

  /** Vuelve al encuadre general del territorio peruano. */
  centrarEnPeru(): void {
    const vista = this.mapa?.getView();
    if (!vista) {
      return;
    }
    vista.setCenter(fromLonLat(CENTRO_PERU as [number, number]));
    vista.setZoom(ZOOM_PERU);
  }

  /** Muestra un mapa base y oculta el otro. */
  cambiarCapaBase(clave: ClaveCapaBase): void {
    for (const [nombre, capa] of Object.entries(this.capasBase)) {
      capa.setVisible(nombre === clave);
    }
    this.claveBase = clave;
  }

  /** Enciende o apaga la capa del polígono sin borrar su geometría. */
  alternarPoligono(visible: boolean): void {
    this.capaPoligono?.setVisible(visible);
  }

  /** Libera los recursos del mapa y su listening del DOM. */
  destruir(): void {
    this.mapa?.setTarget(undefined);
    this.mapa?.dispose();
    this.mapa = null;
    this.fuente = null;
    this.capaPoligono = null;
    this.capasBase = {};
  }

  /** Ajusta la vista a un anillo ya proyectado. */
  private encuadrarAnillo(anillo: readonly [number, number][]): void {
    const vista = this.mapa?.getView();
    if (!vista) {
      return;
    }
    vista.fit(boundingExtent(anillo as [number, number][]), {
      padding: [48, 48, 48, 48],
      maxZoom: 16,
    });
  }

  /**
   * Construye el anillo en Web Mercator, cerrando el polígono.
   *
   * Se necesitan cuatro puntos porque el último repite al primero: un polígono
   * de tres vértices reales exige cuatro coordenadas en el anillo.
   */
  private anillo(pares: readonly ParUTM[], zona: ZonaUTM): [number, number][] {
    const validos = pares.filter((par) => Number.isFinite(par.este) && Number.isFinite(par.norte));
    if (validos.length < 3) {
      return [];
    }
    const epsg = EPSG_POR_ZONA[zona] ?? EPSG_POR_ZONA['18S'];
    const proyectado = validos.map(
      (par) => transform([par.este, par.norte], epsg, 'EPSG:3857') as [number, number],
    );
    return [...proyectado, proyectado[0]!];
  }
}
