import { Injectable, computed, signal } from '@angular/core';

/** Longitud exacta del RUC institucional peruano. */
const LONGITUD_RUC = 11;

/** Semáforo administrativo que puede adoptar un expediente. */
export type EstadoTramite = 'Borrador' | 'En Revisión' | 'Observado' | 'Aprobado';

/** Instrumento de Gestión Ambiental cubierto por la extranet. */
export type TipoIga = 'DAEX' | 'AIAD' | 'AIAI' | 'AISD' | 'AISI' | 'ITS';

/** Un expediente registrado en la bandeja del titular minero. */
export interface Expediente {
  readonly id: string;
  readonly tipoIga: TipoIga;
  readonly nombreProyecto: string;
  readonly unidadMinera: string;
  readonly numeroExpediente: string;
  /** `null` mientras el expediente sigue en Borrador: aún no tiene fecha de envío. */
  readonly fechaEnvio: string | null;
  readonly vigencia: string;
  readonly estado: EstadoTramite;
}

/** Acto administrativo emitido por la DGAAM. */
export interface Notificacion {
  readonly id: string;
  readonly acto: string;
  readonly numeroExpediente: string;
  readonly nombreProyecto: string;
  readonly emitido: string;
  readonly emisor: string;
  readonly nombreDocumento: string;
  readonly contenidoDocumento: string;
}

/** Criterios de búsqueda del listado de solicitudes. */
export interface FiltrosSolicitudes {
  readonly numeroExpediente: string;
  readonly nombreProyecto: string;
  readonly unidadMinera: string;
  readonly estado: EstadoTramite | 'TODOS';
  readonly tipoIga: TipoIga | 'TODOS';
}

/** Acuse de recibo electrónico generado al descargar un acto administrativo. */
export interface AcuseRegistrado {
  readonly notificacionId: string;
  readonly fechaHora: string;
}

const FILTROS_VACIOS: FiltrosSolicitudes = {
  numeroExpediente: '',
  nombreProyecto: '',
  unidadMinera: '',
  estado: 'TODOS',
  tipoIga: 'TODOS',
};

const EXPEDIENTES_INICIALES: readonly Expediente[] = [
  {
    id: 'EXP-001',
    tipoIga: 'DAEX',
    nombreProyecto: 'Expansión San Andrés',
    unidadMinera: 'Unidad Minera San Andrés',
    numeroExpediente: 'MINEM-2026-01482',
    fechaEnvio: '2026-02-11',
    vigencia: '24 meses',
    estado: 'Aprobado',
  },
  {
    id: 'EXP-002',
    tipoIga: 'AIAD',
    nombreProyecto: 'Prospección Sipur',
    unidadMinera: 'Unidad Minera San Andrés',
    numeroExpediente: 'MINEM-2026-02177',
    fechaEnvio: '2026-05-03',
    vigencia: '18 meses',
    estado: 'En Revisión',
  },
  {
    id: 'EXP-003',
    tipoIga: 'AIAI',
    nombreProyecto: 'Ampliación El Carmen',
    unidadMinera: 'Unidad Minera El Carmen',
    numeroExpediente: 'MINEM-2026-00930',
    fechaEnvio: '2025-11-27',
    vigencia: '36 meses',
    estado: 'Observado',
  },
  {
    id: 'EXP-004',
    tipoIga: 'DAEX',
    nombreProyecto: 'Fase B Las Dunas',
    unidadMinera: 'Unidad Minera Las Dunas',
    numeroExpediente: 'MINEM-2026-03218',
    fechaEnvio: null,
    vigencia: '24 meses',
    estado: 'Borrador',
  },
  {
    id: 'EXP-005',
    tipoIga: 'AISD',
    nombreProyecto: 'Recuperación Pampa Blanca',
    unidadMinera: 'Unidad Minera Pampa Blanca',
    numeroExpediente: 'MINEM-2025-08811',
    fechaEnvio: '2025-08-14',
    vigencia: '12 meses',
    estado: 'Aprobado',
  },
  {
    id: 'EXP-006',
    tipoIga: 'AISI',
    nombreProyecto: 'Cierre de Labores Huacachipa',
    unidadMinera: 'Unidad Minera Huacachipa',
    numeroExpediente: 'MINEM-2026-02564',
    fechaEnvio: '2026-06-19',
    vigencia: '60 meses',
    estado: 'En Revisión',
  },
  {
    id: 'EXP-007',
    tipoIga: 'DAEX',
    nombreProyecto: 'Exploración Pampa Blanca',
    unidadMinera: 'Unidad Minera Pampa Blanca',
    numeroExpediente: 'MINEM-2026-03745',
    fechaEnvio: null,
    vigencia: '24 meses',
    estado: 'Borrador',
  },
  {
    id: 'EXP-008',
    tipoIga: 'AIAD',
    nombreProyecto: 'Reubicación Plantas El Carmen',
    unidadMinera: 'Unidad Minera El Carmen',
    numeroExpediente: 'MINEM-2025-09472',
    fechaEnvio: '2025-12-05',
    vigencia: '18 meses',
    estado: 'Observado',
  },
  {
    id: 'EXP-009',
    tipoIga: 'AIAI',
    nombreProyecto: 'Monitoreo Huacachipa',
    unidadMinera: 'Unidad Minera Huacachipa',
    numeroExpediente: 'MINEM-2026-03002',
    fechaEnvio: '2026-07-22',
    vigencia: '36 meses',
    estado: 'Aprobado',
  },
];

const NOTIFICACIONES_INICIALES: readonly Notificacion[] = [
  {
    id: 'NTF-001',
    acto: 'Requerimiento de información',
    numeroExpediente: 'MINEM-2026-01482',
    nombreProyecto: 'Expansión San Andrés',
    emitido: '2026-09-08',
    emisor: 'DGAAM · Dirección de Evaluación',
    nombreDocumento: 'requerimiento-MINEM-2026-01482.txt',
    contenidoDocumento:
      'Se requiere remisión del plano decluste actualizado del área efectiva, en formato georreferenciado UTM WGS84.',
  },
  {
    id: 'NTF-002',
    acto: 'Observación al informe técnico',
    numeroExpediente: 'MINEM-2026-02177',
    nombreProyecto: 'Prospección Sipur',
    emitido: '2026-09-11',
    emisor: 'DGAAM · Dirección de Evaluación',
    nombreDocumento: 'observacion-MINEM-2026-02177.txt',
    contenidoDocumento:
      'El capítulo 2.4.1 consigna 14 plataformas de exploración, excediendo el máximo normativo de 10. Regularizar el inventario.',
  },
  {
    id: 'NTF-003',
    acto: 'Conformidad de expediente',
    numeroExpediente: 'MINEM-2026-00930',
    nombreProyecto: 'Ampliación El Carmen',
    emitido: '2026-09-02',
    emisor: 'DGAAM · Dirección de Evaluación',
    nombreDocumento: 'conformidad-MINEM-2026-00930.txt',
    contenidoDocumento:
      'El expediente cumple con los requisitos de admisibilidad. Continúa con la evaluación técnica sustantiva.',
  },
  {
    id: 'NTF-004',
    acto: 'Invitación a firma digital',
    numeroExpediente: 'MINEM-2025-08811',
    nombreProyecto: 'Recuperación Pampa Blanca',
    emitido: '2026-09-15',
    emisor: 'DGAAM · Dirección de Evaluación',
    nombreDocumento: 'invitacion-firma-MINEM-2025-08811.txt',
    contenidoDocumento:
      'Se invita al Colegio Profesional del ingeniero colegiado a suscribir electrónicamente la memoria descriptiva y los planos del expediente.',
  },
  {
    id: 'NTF-005',
    acto: 'Intimación para absolución',
    numeroExpediente: 'MINEM-2025-09472',
    nombreProyecto: 'Reubicación Plantas El Carmen',
    emitido: '2026-09-18',
    emisor: 'DGAAM · Dirección de Evaluación',
    nombreDocumento: 'intimacion-MINEM-2025-09472.txt',
    contenidoDocumento:
      'Se intima la absolución de las observaciones curriculares en el plazo de cinco días hábiles.',
  },
  {
    id: 'NTF-006',
    acto: 'Resolución de aprobación',
    numeroExpediente: 'MINEM-2026-03002',
    nombreProyecto: 'Monitoreo Huacachipa',
    emitido: '2026-09-24',
    emisor: 'DGAAM · Dirección de Evaluación',
    nombreDocumento: 'resolucion-MINEM-2026-03002.txt',
    contenidoDocumento:
      'Resolución Directoral que aprueba el Instrumento de Gestión Ambiental presentado por el titular minero.',
  },
];

/**
 * Semáforo de avance por sección del expediente.
 *
 * `Gris`   → no iniciado o pendiente de datos.
 * `Azul`   → en proceso de edición o con guardado parcial.
 * `Verde`  → completado y validado en el cliente.
 * `Rojo`   → alerta crítica o sección observada por el evaluador.
 */
export type EstadoSeccion = 'Gris' | 'Azul' | 'Verde' | 'Rojo';

/**
 * Normaliza la nomenclatura de estado de las pantallas del MINEM (`VERDE`,
 * `verde`, `Azul`…) al casing del dominio.
 *
 * Las etiquetas canónicas son Gris, Azul, Verde y Rojo. Cualquier otra cadena
 * cae en `Gris`, que es el estado neutro de una sección todavía sin completar.
 */
function normalizarEstadoSeccion(estado: string): EstadoSeccion {
  const clave = estado.trim().toLowerCase();
  if (clave === 'azul') {
    return 'Azul';
  }
  if (clave === 'verde') {
    return 'Verde';
  }
  if (clave === 'rojo') {
    return 'Rojo';
  }
  return 'Gris';
}

/** Naturaleza del widget que la sección exige al construirse. */
export type TipoSeccion =
  | 'formulario'
  | 'adjuntos'
  | 'adjuntos-finales'
  | 'mapa'
  | 'gantt'
  | 'matriz-componentes'
  | 'demanda-agua'
  | 'catalogo-insumos'
  | 'personal'
  | 'participacion-ciudadana'
  | 'compromisos-ambientales'
  | 'consultora'
  | 'arqueologia'
  | 'notificacion-electronica';

/** Nodo del árbol del expediente. Admite un nivel de anidamiento (cap. 5.2). */
export interface SeccionExpediente {
  readonly id: string;
  /** Índice oficial dentro del expediente, p. ej. `2.10` o `5.2.1`. */
  readonly numero: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly tipo: TipoSeccion;
  readonly estado: EstadoSeccion;
  /** `true` cuando el evaluador dejó observaciones: dispara el icono 📖 pulsante. */
  readonly observado: boolean;
  /** Sub-capas, usadas por el visor de mapa de influence (5.2.1 y 5.2.2). */
  readonly hijos: readonly SeccionExpediente[];
}

/**
 * Vértice del área efectiva, en UTM WGS84 (zona 18S).
 *
 * Comparte tipo con el visor de la 2.5: el polígono que la persona dibuja se
 * publica tal cual y la 2.2 lo consume sin traducir coordenadas.
 */
export interface VerticeArea {
  readonly este: number;
  readonly norte: number;
}

/**
 * Unidad en la que se declara un insumo.
 *
 * Se persiste el código y no la etiqueta larga porque el código es lo que se
 * compara entre filas y lo que la 2.10 cruzará con la dotación; la etiqueta
 * larga vive en el `select` del popup y se muestra en la grilla.
 */
export type UnidadInsumo = 'KG' | 'GL' | 'TN' | 'UND';

/**
 * Insumo químico o material del inventario técnico de la 2.9.
 *
 * La cantidad viaja con su unidad: sumar 40 galones a 200 kilogramos no da una
 * cifra interpretable, así que el encabezado de la tabla agrupa por unidad en
 * lugar de totalizar la columna.
 */
export interface InsumoCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly unidadMedida: UnidadInsumo;
}

/**
 * Equipo o maquinaria pesada de la 2.9.
 *
 * Aquí sí tiene sentido totalizar la cantidad, porque todas las filas se
 * cuentan en unidades.
 */
export interface EquipoCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly especificaciones: string;
  readonly cantidad: number;
}

/** Procedencia de la mano de obra declarada para una etapa. */
export type OrigenManoObra = 'LOCAL' | 'FORANEO';

/**
 * Dotación de personal de una etapa del cronograma.
 *
 * La fila se ancla al identificador de la etapa (`etapaId`) y no a su posición:
 * la 2.6 deja que el titular reordene, renombre y agregue etapas, y una dotación
 * atada al número de fila acabaría aplicándose a una etapa equivocada en cuanto
 * el orden cambiara. El nombre se guarda junto a la dotación solo como respaldo
 * de lo que el titular declaró; la grilla muestra el nombre vigente del
 * cronograma.
 */
export interface DotacionEtapa {
  readonly etapaId: string;
  readonly etapaNombre: string;
  readonly cantidad: number | null;
  readonly origen: OrigenManoObra | '';
  readonly especializacion: string;
}

/**
 * Una etapa del cronograma con su inversión asociada.
 *
 * Vive en el store y no en el microcomponente porque la 2.10 lee las etapas
 * activas para sincronizar su dotación, y porque el orquestador destruye los
 * microcomponentes al cambiar de capítulo: un signal local perdería lo editado.
 */
export interface EtapaCronograma {
  readonly id: string;
  readonly nombre: string;
  readonly hito: string;
  readonly meses: number;
  readonly inversion: number;
  readonly dependeDe: readonly string[];
  /**
   * Mes de arranque en formato `YYYY-MM`, solo en la etapa que no depende de
   * ninguna otra. Las fechas de las etapas siguientes se derivan de aquí.
   *
   * Cadena y no `Date` a propósito: `new Date('2026-01')` se interpreta como UTC
   * y en Lima (UTC-5) devuelve diciembre de 2025, un mes antes del real.
   */
  readonly fechaInicio: string;
}

/**
 * Etapas base mientras el titular no valida un cronograma propio.
 *
 * Vive aquí y no en el componente de la 2.6 porque la 2.10 precisa las mismas
 * cuatro fases para precargar su cuadro de personal: con dos copias, corregir
 * el nombre de una etapa en el Gantt dejaría la dotación de la 2.10 apuntando a
 * una fase que ya no existe en el cronograma.
 *
 * Solo la primera lleva `fechaInicio`: es el ancla del cronograma y su mes es lo
 * único que el titular fija a mano. Las demás se posicionan a partir de ella.
 */
export const ETAPAS_BASE_CRONOGRAMA: readonly EtapaCronograma[] = [
  {
    id: 'ET-1',
    nombre: 'Exploración',
    hito: 'Sondeos y muestreo',
    meses: 18,
    inversion: 2_450_000,
    dependeDe: [],
    fechaInicio: '',
  },
  {
    id: 'ET-2',
    nombre: 'Construcción',
    hito: 'Habilitación de plataformas',
    meses: 14,
    inversion: 5_800_000,
    dependeDe: ['ET-1'],
    fechaInicio: '',
  },
  {
    id: 'ET-3',
    nombre: 'Explotación',
    hito: 'Producción mineral',
    meses: 60,
    inversion: 12_300_000,
    dependeDe: ['ET-2'],
    fechaInicio: '',
  },
  {
    id: 'ET-4',
    nombre: 'Cierre',
    hito: 'Cierre de labores y restauración',
    meses: 24,
    inversion: 1_900_000,
    dependeDe: ['ET-3'],
    fechaInicio: '',
  },
];

/**
 * Una perforación diamantina perteneciente a una plataforma.
 *
 * El sondaje cuelga de la plataforma porque la ficha de la sección describe
 * los sondeos anidados dentro de ella, no como una lista plana aparte.
 */
export interface Sondaje {
  readonly id: string;
  readonly codigo: string;
  readonly profundidad: number;
  readonly inclinacion: number;
  readonly azimut: number;
}

/**
 * Una plataforma de perforación con sus sondajes y su referencia al agua.
 *
 * Una plataforma admite **varios** sondajes: los campos de la perforación
 * cuelgan de la tarjeta, no de la fila de la plataforma.
 */
export interface Plataforma {
  readonly id: string;
  readonly nombre: string;
  readonly este: number;
  readonly norte: number;
  readonly altitud: number;
  readonly cuerpoAgua: string;
  readonly distanciaAgua: number;
  readonly sondajes: readonly Sondaje[];
}

/** Un componente auxiliar con su coordenada y su distancia al cuerpo de agua. */
export interface Auxiliar {
  readonly id: string;
  readonly nombre: string;
  readonly este: number;
  readonly norte: number;
  readonly altitud: number;
  readonly cuerpoAgua: string;
  readonly distanciaAgua: number;
}

/** Un componente con sus dimensiones, de las que se derivan área y volumen. */
export interface Dimension {
  readonly id: string;
  readonly nombreComponente: string;
  readonly ancho: number;
  readonly largo: number;
  readonly profundidad: number;
  readonly cantidad: number;
}

/** Las tres matrices de la 2.7, guardadas y recuperadas como una sola unidad. */
export interface MatrizComponentes {
  readonly plataformas: readonly Plataforma[];
  readonly auxiliares: readonly Auxiliar[];
  readonly dimensiones: readonly Dimension[];
}

/**
 * Zonas UTM admitidas por el expediente.
 *
 * Espejo de la unión que declara `mapa-facade` para el visor de la 2.5: son las
 * mismas tres zonas que atraviesan el Perú, y la fila guardada tiene que poder
 * volver a pintarse sobre el mapa sin traducción. Se declara aquí porque el
 * store es quien guarda la fila, y no el visor.
 */
export type ZonaUTM = '17S' | '18S' | '19S';

/**
 * Un punto de abastecimiento de agua declarado por el titular.
 *
 * Es una fila del balance hídrico: cuánto consume el proyecto por día, durante
 * cuántos días, desde qué fuente y dónde se capta. El total de la fila no se
 * guarda porque es `cantidadDia * numDias`, y guardar un producto aparte
 * obligaría a recalcularlo en cada edición para que no quedara desfasado.
 *
 * `este` y `norte` son números ya resueltos: el popup no deja grabar la fila
 * sin coordenada, así que el store nunca recibe un punto sin ubicación.
 */
export interface FuenteAbastecimientoAgua {
  readonly id: string;
  readonly fase: string;
  readonly etapa: string;
  readonly cantidadDia: number;
  readonly numDias: number;
  readonly fuente: string;
  readonly este: number;
  readonly norte: number;
  readonly zona: ZonaUTM;
}

/**
 * Compromiso ambiental de la matriz 5.1.
 *
 * Cada fila correlaciona una etapa y sus actividades con el componente afectado,
 * la estrategia de manejo, el plazo y su presupuesto. Los identificadores se
 * conservan entre guardados: el `@for` de la grilla empareja cada fila con su
 * nodo por `id`, y uno nuevo en cada validación sacaría el DOM de su sitio.
 */
export interface CompromisoAmbiental {
  readonly id: string;
  readonly etapa: string;
  readonly actividades: string;
  readonly componenteFactor: string;
  readonly aspectos: string;
  readonly impactos: string;
  readonly estrategiaManejo: string;
  readonly plazoFrecuencia: string;
  readonly presupuesto: number;
}

/** Categoría del inventario de áreas de influencia de la sección 5.2. */
export type TipoInfluencia = 'AMBIENTAL' | 'SOCIAL';

/** Alcance del área dentro de su categoría: lindero directo o indirecto. */
export type TipoAreaInfluencia = 'DIRECTA' | 'INDIRECTA';

/**
 * Vértice de un área de influencia, en UTM WGS84 de la zona declarada.
 *
 * Los ejes admiten `null` mientras la fila está sin resolver: la grilla de
 * captura arranca con filas en blanco y `null` es la marca de «aún sin
 * escribir», distinta del `0` que sí significaría una coordenada real.
 */
export interface VerticeInfluencia {
  readonly id: string;
  readonly este: number | null;
  readonly norte: number | null;
}

/**
 * Área de influencia declarada en la sección 5.2.
 *
 * Viaja con su `geometry` en OGC WKT (UTM, con el anillo cerrado) porque es la
 * forma textual en que el expediente expone el polígono al backend: los
 * vértices se conservan además como números para la grilla de captura y para
 * recálculos, y el WKT evita que el receptor tenga que reconstruir el cierre.
 *
 * Los identificadores se conservan entre guardados para que el `@for` de la
 * grilla no descoloque el DOM al rehidratar.
 */
export interface AreaInfluencia {
  readonly id: string;
  readonly categoria: TipoInfluencia;
  readonly tipo: TipoAreaInfluencia;
  readonly nombre: string;
  readonly zona: ZonaUTM;
  readonly datum: 'WGS84';
  readonly vertices: readonly VerticeInfluencia[];
  readonly geometry: string;
}

/**
 * División política dentro de la que cae el área efectiva.
 *
 * Los tres niveles son los del CENSO REDATAM del INEI: el evaluador contrasta
 * esta tabla contra la memoria descriptiva que adjunta el titular.
 */
export interface UbigeoPolitico {
  readonly departamento: string;
  readonly provincia: string;
  readonly distrito: string;
}

/** Capítulo (= menú principal) con su colección ordenada de secciones. */
export interface CapituloExpediente {
  readonly id: string;
  readonly numero: string;
  readonly titulo: string;
  readonly secciones: readonly SeccionExpediente[];
}

/**
 * Estado de una observación dentro de la bandeja de subsanación.
 *
 * `PENDIENTE` espera descargo del titular y `SUBSANADO` ya tiene el sustento
 * escrito. No hay un tercer estado "desestimada": el Evaluador Institucional no
 * retira observaciones, las subsana o las deja colgadas.
 */
export type EstadoAlertaObservacion = 'PENDIENTE' | 'SUBSANADO';

/**
 * Observación individual del evaluador sobre un microcomponente.
 *
 * `editandoDescargo` es estado de vista, no de dominio, pero viaja en el mismo
 * objeto porque solo hay una caja de descargo abierta a la vez. Se resuelve
 * siempre con una copia nueva: mutar la fila en sitio dejaría el `computed`
 * que resume la bandeja con la referencia que ya tiene cacheada, y el menú
 * seguiría mostrando el conteo anterior.
 */
export interface AlertaObservacion {
  readonly id: string;
  /** Etiqueta correlitiva que muestra la DGAAM, p. ej. `OBS-001`. */
  readonly numeroCorrelativo: string;
  readonly glosaEvaluador: string;
  readonly estado: EstadoAlertaObservacion;
  /** Descargo escrito por el titular; `null` mientras la observación cuelga. */
  readonly descargoSustento: string | null;
  readonly editandoDescargo: boolean;
}

/**
 * Etapa en la que está la remisión del expediente.
 *
 * `NUEVO` es el DAEX que se presenta por primera vez, `OBSERVADO` el que vuelve
 * con un acta de la DGAAM y `INFORMACION_COMPLEMENTARIA` el que ya fue
 * observado y ahora debe atender un pedido de documentación del MINEM.
 */
export type EstadoRemision = 'NUEVO' | 'OBSERVADO' | 'INFORMACION_COMPLEMENTARIA';

/**
 * Rótulo del botón general en cada etapa.
 *
 * Vive en el store y no en la plantilla porque el texto dice qué se va a
 * mandar, no solo cómo se llama el botón: es la misma regla de negocio que el
 * guardián que habilita la remisión.
 */
const ETIQUETAS_REMISION: Readonly<Record<EstadoRemision, string>> = {
  NUEVO: 'Enviar al MINEM',
  OBSERVADO: 'Enviar subsanación',
  INFORMACION_COMPLEMENTARIA: 'Enviar información complementaria',
};

/**
 * Microcomponente con observaciones abiertas del evaluador.
 *
 * El `id` es el índice oficial de la sección (`2.7`) y no su identificador
 * interno: es la misma clave que aceptan `seccionPorNumero()` y
 * `actualizarEstadoSeccion()`, así que la bandeja se engancha al árbol del
 * expediente sin traducir identificadores.
 */
export interface MicroComponenteEvaluado {
  readonly id: string;
  readonly nombreSeccion: string;
  readonly capitulo: string;
  readonly observaciones: readonly AlertaObservacion[];
}

/** Observación recién puesta por el evaluador, todavía sin descargo. */
function alertaPendiente(numeroCorrelativo: string, glosaEvaluador: string): AlertaObservacion {
  return {
    id: numeroCorrelativo,
    numeroCorrelativo,
    glosaEvaluador,
    estado: 'PENDIENTE',
    descargoSustento: null,
    editandoDescargo: false,
  };
}

/**
 * Bandeja de observaciones con la que arranca el expediente.
 *
 * Es semilla de arranque, igual que `CAPITULOS_INICIALES`: desde aquí la bandeja
 * vive en el store y es el titular quien la subsana. La 2.7 es la primera
 * sección con evaluación del Evaluador Institucional, y sus dos glosas son las
 * que dejó la DGAAM en el Acta de Observación.
 */
const MICROCOMPONENTES_EVALUADOS_INICIALES: readonly MicroComponenteEvaluado[] = [
  {
    id: '2.7',
    nombreSeccion: '2.7 Descripción de los Componentes del Proyecto',
    capitulo: '2',
    observaciones: [
      alertaPendiente(
        'OBS-001',
        'El número de sondajes declarados no coincide con el polígono cartográfico guardado en el visor geográfico de la sección 2.5.',
      ),
      alertaPendiente(
        'OBS-002',
        'Debe adjuntar la justificación técnica de la profundidad de perforación para la plataforma PLA-02.',
      ),
    ],
  },
];

/**
 * Semáforo agregado de un grupo de secciones: gana el estado más urgente.
 *
 * El índice lateral solo muestra capítulos, pero el estado vive en las
 * secciones. Se aplana el árbol entero —incluidas las sub-capas del capítulo 5—
 * y se devuelve la primera coincidencia en orden de urgencia, de modo que un
 * solo rojo en cualquier nivel enciende el capítulo completo.
 */
function agregarSemaforo(secciones: readonly SeccionExpediente[]): EstadoSeccion {
  const urgencia: readonly EstadoSeccion[] = ['Rojo', 'Azul', 'Verde', 'Gris'];
  const aplanar = (nodos: readonly SeccionExpediente[]): SeccionExpediente[] =>
    nodos.flatMap((nodo) => [nodo, ...aplanar(nodo.hijos)]);
  const estados = aplanar(secciones).map((nodo) => nodo.estado);
  return urgencia.find((candidato) => estados.includes(candidato)) ?? 'Gris';
}

function seccion(
  numero: string,
  titulo: string,
  descripcion: string,
  tipo: TipoSeccion,
  estado: EstadoSeccion = 'Gris',
  hijos: readonly SeccionExpediente[] = [],
  observado = false,
): SeccionExpediente {
  return { id: `SEC-${numero}`, numero, titulo, descripcion, tipo, estado, observado, hijos };
}

function capitulo(
  numero: string,
  titulo: string,
  secciones: readonly SeccionExpediente[],
): CapituloExpediente {
  return { id: `CAP-${numero}`, numero, titulo, secciones };
}

/**
 * Matriz oficial de capítulos y submenús del DAEX.
 *
 * Es la única fuente de verdad del árbol lateral: la plantilla no conoce ningún
 * título, índice ni estado; todo se recorre con `@for` sobre esta constante.
 */
const CAPITULOS_INICIALES: readonly CapituloExpediente[] = [
  capitulo('1', 'Información General', [
    seccion(
      '1.1',
      'Identificación del Titular',
      'Razón social, RUC, domicilio legal y representante legal con faculties de suscripción.',
      'formulario',
      'Verde',
    ),
    seccion(
      '1.2',
      'Notificación Electrónica',
      'Canal de notificación con constancia de envío y descarga del template oficial para adjuntar.',
      'notificacion-electronica',
      'Verde',
    ),
    seccion(
      '1.3',
      'Adjuntar Documentos',
      'Identidad del titular: DNI, RUC, vigencia de poder y certificado demines.',
      'adjuntos',
      'Azul',
    ),
  ]),

  capitulo('2', 'Descripción del Proyecto', [
    seccion(
      '2.1',
      'Datos del Proyecto',
      'Nombre, modality, escala, vida útil y unidad minera del proyecto.',
      'formulario',
      'Verde',
    ),
    seccion(
      '2.2',
      'Antecedentes',
      'Títulos mineros, propiedad, actos y resoluciones previas del área.',
      'formulario',
      'Verde',
    ),
    seccion(
      '2.3',
      'Objetivos y Justificación',
      'Objetivo general y específicos, con justificación técnica de la necesidad del IGA.',
      'formulario',
      'Verde',
    ),
    seccion(
      '2.4',
      'Localización Geográfica y Política del Proyecto',
      'Coordenadas UTM WGS84, clima, hidrografía y división política afectada.',
      'formulario',
      'Azul',
    ),
    seccion(
      '2.5',
      'Delimitación del Área Efectiva',
      'Polígono del área efectiva con visor de mapas OpenLayers y exportación a GeoJSON.',
      'mapa',
    ),
    seccion(
      '2.6',
      'Cronograma e Inversión del Proyecto',
      'Gantt dinámico por etapas con inversión asociada a cada hito.',
      'gantt',
    ),
    seccion(
      '2.7',
      'Descripción de los Componentes del Proyecto',
      'Matriz jerárquica de hasta 10 plataformas de exploración con sondajes anidados.',
      'matriz-componentes',
      'Rojo',
      [],
      true,
    ),
    seccion(
      '2.8',
      'Demanda de Agua',
      'Balance hídrico que fuerza la selección de al menos un tercero proveedor.',
      'demanda-agua',
    ),
    seccion(
      '2.9',
      'Insumos, Maquinarias y Equipos',
      'Inventario con predicción técnica minera de dotación por categoría.',
      'catalogo-insumos',
    ),
    seccion(
      '2.10',
      'Personal',
      'Dotación sincronizada transversalmente con las etapas activas del cronograma.',
      'personal',
    ),
    seccion(
      '2.11',
      'Adjuntar Documentos',
      'Memoria descriptiva, planos firmados y estudio topográfico del proyecto.',
      'adjuntos',
    ),
  ]),

  capitulo('3', 'Línea Base', [
    seccion(
      '3.1',
      'Descripción del Medio Físico y Biológico',
      'Geología, geomorfología, suelos, hidrología, clima, flora, fauna y corredores.',
      'formulario',
      'Azul',
    ),
    seccion(
      '3.2',
      'Descripción y Caracterización de los Aspectos Sociales',
      'Población, economía local, salud, educación y tenencia de la tierra.',
      'formulario',
    ),
    seccion(
      '3.3',
      'Arqueología y Patrimonio Cultural',
      'Bifurcación obligatoria entre CIRA y PMA, con validación documental.',
      'arqueologia',
    ),
    seccion(
      '3.4',
      'Adjuntar Documentos',
      'Informes de línea base, cartografías y surveys de fauna y flora.',
      'adjuntos',
    ),
  ]),

  capitulo('4', 'Plan de Participación Ciudadana', [
    seccion(
      '4.1',
      'Mecanismos de Participacion Ciudadana',
      'Grilla dinámica de talleres ejecutados con fechas pasadas y medios de verificación.',
      'participacion-ciudadana',
    ),
    seccion(
      '4.2',
      'Adjuntar Documentos del Plan de Participacion',
      'Actas, listas de asistencia, medios de verificación y material de las actividades de participación ciudadana.',
      'adjuntos',
    ),
  ]),

  capitulo(
    '5',
    'Identificación de Impactos, Estrategias de Manejo Ambiental, Cierre y Áreas de Influencia',
    [
      seccion(
        '5.1',
        'Impactos Ambientales, Estrategias de Manejo y Cierre',
        'Matriz iterativa de compromisos ambientales con responsable, plazo y evidencia.',
        'compromisos-ambientales',
      ),
      seccion(
        '5.2',
        'Área de Influencia',
        'Visor OpenLayers con las sub-capas de influencia ambiental y social.',
        'mapa',
        'Gris',
        [
          seccion(
            '5.2.1',
            'Área de Influencia Ambiental (Directa e Indirecta)',
            'Capa de influencia ambiental directa e indirecta sobre el área efectiva.',
            'mapa',
          ),
          seccion(
            '5.2.2',
            'Área de Influencia Social (Directa e Indirecta)',
            'Capa de influencia social directa e indirecta, con centros poblados afectados.',
            'mapa',
          ),
        ],
      ),
      seccion(
        '5.3',
        'Adjuntar Documentos',
        'Matriz de impactos, PRA y planes de manejo socioambiental.',
        'adjuntos',
      ),
    ],
  ),

  capitulo('6', 'Consultora', [
    seccion(
      '6.1',
      'Selección de Consultora y Profesionales',
      'Tabla declarativa de ingenieros firmantes con colegiatura activa habilitada.',
      'consultora',
    ),
    seccion(
      '6.2',
      'Adjuntar Documentos',
      'Contratos, currículos, diplomas y constancias de colegiatura.',
      'adjuntos',
    ),
  ]),

  capitulo('7', 'Anexos', [
    seccion(
      '7.1',
      'Adjuntar Documentos Finales',
      'Cierre del expediente: planos, Shapefiles .zip y memorias descriptivas consolidadas.',
      'adjuntos-finales',
    ),
  ]),
];

/** Ajustes de semáforo aplicados en caliente sobre la matriz de arranque. */
interface AjustesSeccion {
  readonly estado?: EstadoSeccion;
  readonly observado?: boolean;
}

/**
 * Contexto inmutable del expediente abierto en el formulario de edición.
 *
 * La cabecera de `FormularioIgaComponent` muestra estos metadatos tal cual,
 * sin derivarlos de los campos editables de la sección 1.1.
 */
export interface ContextoFormulario {
  readonly nombreProyecto: string;
  readonly unidadMinera: string;
  readonly numeroExpediente: string | null;
  readonly tipoIga: TipoIga;

  /**
   * Redacción de la sección 2.3.
   *
   * Opcionales porque las fichas del expediente todavía no los traen: las
   * cargo los microcomponentes al validar y se leen de vuelta al recuperar la
   * sección, para que el texto sobreviva a la destrucción de la pieza al
   * cambiar de capítulo.
   */
  readonly objetivos?: string;
  readonly justificacion?: string;

  /**
   * Punto central de la campaña, capturado en la sección 2.4.
   *
   * Opcional por la misma razón que los dos campos narrativos: lo escribe el
   * microcomponente al validar y se relee al recuperar la ficha, para que el
   * semáforo verde nunca quede sin las coordenadas que lo respaldan.
   */
  readonly puntoCentral?: PuntoCentral;
}

/** Coordenadas y referencia del centro geométrico del proyecto. */
export interface PuntoCentral {
  readonly este: number;
  readonly norte: number;
  readonly zona: string;
  readonly poblado: string;
}

/** Contexto por defecto al crear un DAEX nuevo desde la bandeja. */
const CONTEXTO_NUEVO: ContextoFormulario = {
  nombreProyecto: 'Proyecto sin denominar',
  unidadMinera: 'Unidad Minera sin denominar',
  numeroExpediente: null,
  tipoIga: 'DAEX',
};

/**
 * Catálogo local de ubigeo para el maquete.
 *
 * Sustituye, por ahora, a la geocodificación inversa sobre REDATAM. Los
 * nombres corresponden a la franja UTM donde cae el polígono por defecto de la
 * sección 2.5, de modo que el flujo completo puede demostrarse sin backend.
 *
 * @see `DaexStore.ubigeo`, que es el punto de sustitución cuando la API entre.
 */
const UBIGEO_POR_AREA: UbigeoPolitico = {
  departamento: 'Huancavelica',
  provincia: 'Angaraes',
  distrito: 'Lircay',
};

/**
 * Store central de la extranet basado en Signals.
 *
 * Bloque 1 (identidad): `ruc`, `tokenJwt` y `razonSocial` de la sesión.
 * Bloque 2 (bandeja): catálogo de expedientes, actos administrativos,
 * filtrado en cliente, paginación y registro de acuses de recibo.
 * Bloque 3 (expediente): árbol dinámico de capítulos y secciones, semáforo de
 * avance y sección activa. La plantilla no replica esta estructura.
 */
@Injectable({ providedIn: 'root' })
export class DaexStore {
  private readonly estadoRuc = signal('');
  private readonly estadoToken = signal('');
  private readonly estadoRazonSocial = signal('');

  private readonly listaExpedientes = signal<readonly Expediente[]>(EXPEDIENTES_INICIALES);
  private readonly listaNotificaciones = signal<readonly Notificacion[]>(NOTIFICACIONES_INICIALES);
  private readonly criterios = signal<FiltrosSolicitudes>(FILTROS_VACIOS);
  private readonly paginaActual = signal(1);
  private readonly registrosAcuse = signal<readonly AcuseRegistrado[]>([]);
  private readonly ajustesSecciones = signal<Readonly<Record<string, AjustesSeccion>>>({});
  private readonly capitulosAbiertos = signal<ReadonlySet<string>>(new Set(['CAP-1', 'CAP-2']));
  private readonly seccionSeleccionada = signal('SEC-1.1');
  private readonly capituloSeleccionado = signal('1');
  private readonly contextoFormulario = signal<ContextoFormulario>(CONTEXTO_NUEVO);

  /** Filas por página del grid de resultados. */
  readonly tamanoPagina = 5;

  /** RUC del titular minero autenticado. Cadena vacía si no hay sesión. */
  readonly ruc = this.estadoRuc.asReadonly();

  /** Token JWT de la sesión; se inyecta de forma opaca desde el cliente. */
  readonly tokenJwt = this.estadoToken.asReadonly();

  /** Razón social del titular minero autenticado. */
  readonly razonSocial = this.estadoRazonSocial.asReadonly();

  /** `true` únicamente cuando existe una sesión completa y sintácticamente válida. */
  readonly autenticado = computed(
    () => this.estadoRuc().length === LONGITUD_RUC && this.estadoToken().length > 0,
  );

  readonly expedientes = this.listaExpedientes.asReadonly();
  readonly notificaciones = this.listaNotificaciones.asReadonly();
  readonly filtros = this.criterios.asReadonly();
  readonly acuses = this.registrosAcuse.asReadonly();

  /** Catálogos cerrados que alimentan los desplegables del buscador. */
  readonly estadosDisponibles: readonly EstadoTramite[] = [
    'Borrador',
    'En Revisión',
    'Observado',
    'Aprobado',
  ];

  readonly tiposDisponibles: readonly TipoIga[] = ['DAEX', 'AIAD', 'AIAI', 'AISD', 'AISI', 'ITS'];

  /**
   * Filtrado en cliente. La búsqueda de expediente y proyecto es insensible a
   * mayúsculas; unidad minera exige coincidencia exacta por ser catálogo cerrado.
   */
  readonly expedientesFiltrados = computed(() => {
    const { numeroExpediente, nombreProyecto, unidadMinera, estado, tipoIga } = this.criterios();
    const textoExpediente = numeroExpediente.trim().toLowerCase();
    const textoProyecto = nombreProyecto.trim().toLowerCase();

    return this.listaExpedientes().filter((expediente) => {
      if (textoExpediente && !expediente.numeroExpediente.toLowerCase().includes(textoExpediente)) {
        return false;
      }
      if (textoProyecto && !expediente.nombreProyecto.toLowerCase().includes(textoProyecto)) {
        return false;
      }
      if (unidadMinera && expediente.unidadMinera !== unidadMinera) {
        return false;
      }
      if (estado !== 'TODOS' && expediente.estado !== estado) {
        return false;
      }
      return tipoIga === 'TODOS' || expediente.tipoIga === tipoIga;
    });
  });

  /** Paginación reactiva sobre el conjunto ya filtrado. */
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.expedientesFiltrados().length / this.tamanoPagina)),
  );

  readonly pagina = this.paginaActual.asReadonly();

  /** Porción de filas que corresponde a la página activa. */
  readonly expedientesPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina;
    return this.expedientesFiltrados().slice(inicio, inicio + this.tamanoPagina);
  });

  /** Registra la identidad del titular y habilita el salto directo a la consola. */
  inyectarSesion(ruc: string, tokenJwt: string, razonSocial: string): void {
    this.estadoRuc.set(ruc);
    this.estadoToken.set(tokenJwt);
    this.estadoRazonSocial.set(razonSocial);
  }

  /** Cierra la sesión y devuelve el store a su estado inicial. */
  limpiarSesion(): void {
    this.estadoRuc.set('');
    this.estadoToken.set('');
    this.estadoRazonSocial.set('');
  }

  /** Aplica un criterio de búsqueda y vuelve a la primera página. */
  filtrar(cambios: Partial<FiltrosSolicitudes>): void {
    this.criterios.update((actuales) => ({ ...actuales, ...cambios }));
    this.paginaActual.set(1);
  }

  /** Descarta todos los filtros y restaura el listado completo. */
  limpiarFiltros(): void {
    this.criterios.set(FILTROS_VACIOS);
    this.paginaActual.set(1);
  }

  irAPagina(pagina: number): void {
    const total = this.totalPaginas();
    this.paginaActual.set(Math.min(Math.max(1, pagina), total));
  }

  /**
   * Sella la marca de tiempo del acuse de recibo en la sesión del titular,
   * de modo que la descarga del acto queda trazada.
   */
  registrarAcuse(notificacionId: string, fechaHora: Date): void {
    this.registrosAcuse.update((registros) => [
      ...registros,
      { notificacionId, fechaHora: fechaHora.toISOString() },
    ]);
  }

  /** Devuelve la marca de tiempo del acuse, o `undefined` si aún no se descargó. */
  acuseDe(notificacionId: string): string | undefined {
    return this.registrosAcuse()
      .filter((acuse) => acuse.notificacionId === notificacionId)
      .at(-1)?.fechaHora;
  }

  /* ------------------------------------------------------------------
     BLOQUE 3 · ÁRBOL DINÁMICO DEL EXPEDIENTE
     ------------------------------------------------------------------ */

  /**
   * Árbol de capítulos con el semáforo ya resuelto: la matriz de arranque se
   * combina con los ajustes hechos en caliente, sin mutar la constante semilla.
   */
  readonly capitulos = computed<readonly CapituloExpediente[]>(() => {
    const ajustes = this.ajustesSecciones();
    const resolver = (seccionBase: SeccionExpediente): SeccionExpediente => {
      const ajuste = ajustes[seccionBase.id];
      return {
        ...seccionBase,
        estado: ajuste?.estado ?? seccionBase.estado,
        observado: ajuste?.observado ?? seccionBase.observado,
        hijos: seccionBase.hijos.map(resolver),
      };
    };

    return CAPITULOS_INICIALES.map((capituloBase) => ({
      ...capituloBase,
      secciones: capituloBase.secciones.map(resolver),
    }));
  });

  /** Número total de secciones, incluidas las sub-capas anidadas. */
  readonly totalSecciones = computed(() => {
    const contar = (secciones: readonly SeccionExpediente[]): number =>
      secciones.reduce((total, seccionActual) => total + 1 + contar(seccionActual.hijos), 0);
    return contar(this.capitulos().flatMap((capituloActual) => capituloActual.secciones));
  });

  /** `true` cuando el capítulo tiene su grupo de secciones desplegado. */
  capituloAbierto(capituloId: string): boolean {
    return this.capitulosAbiertos().has(capituloId);
  }

  /** Sección actualmente abierta en el panel del expediente. */
  readonly seccionActiva = computed<SeccionExpediente | null>(() => {
    const objetivo = this.seccionSeleccionada();
    for (const capituloActual of this.capitulos()) {
      for (const seccionActual of capituloActual.secciones) {
        if (seccionActual.id === objetivo) {
          return seccionActual;
        }
        const descendiente = this.buscarHijo(seccionActual.hijos, objetivo);
        if (descendiente) {
          return descendiente;
        }
      }
    }
    return null;
  });

  /**
   * Localiza una sección por su índice oficial (`2.10`, `5.2.1`), incluidas
   * las sub-capas anidadas. Es el enlace entre la URL y el árbol del store.
   */
  seccionPorNumero(numero: string): SeccionExpediente | null {
    return this.buscarPorNumero(this.seccionesAplanadas(), numero);
  }

  /** Capítulo que hospeda una sección concreta. */
  capituloDeSeccion(seccionId: string): CapituloExpediente | null {
    return (
      this.capitulos().find((capituloActual) =>
        capituloActual.secciones.some(
          (seccionActual) =>
            seccionActual.id === seccionId ||
            this.buscarHijo(seccionActual.hijos, seccionId) !== null,
        ),
      ) ?? null
    );
  }

  /** Capítulo que hospeda la sección activa, para titular la cabecera del panel. */
  readonly capituloActivo = computed<CapituloExpediente | null>(() => {
    const seccionObjetivo = this.seccionActiva();
    if (!seccionObjetivo) {
      return null;
    }
    return (
      this.capitulos().find((capituloActual) =>
        capituloActual.secciones.some(
          (seccionActual) =>
            seccionActual.id === seccionObjetivo.id ||
            this.buscarHijo(seccionActual.hijos, seccionObjetivo.id) !== null,
        ),
      ) ?? null
    );
  });

  /**
   * Índice del capítulo que el orquestador debe apilar, p. ej. `'1'`.
   *
   * Es la señal que lee `ContenedorCapituloComponent` para filtrar en caliente
   * su catálogo de microcomponentes, de modo que la columna derecha siempre
   * refleja el capítulo que el titular acaba de pulsar en el índice lateral.
   */
  readonly capituloSeleccionadoId = this.capituloSeleccionado.asReadonly();

  /**
   * Selecciona el capítulo activo y lo despliega en el índice lateral.
   *
   * Acepta el índice oficial (`'2'`) o el identificador interno (`'CAP-2'`),
   * porque el primero llega de la ruta y el segundo del árbol de capítulos.
   * Un índice desconocido se ignora en lugar de dejar la vista en blanco.
   */
  seleccionarCapitulo(capitulo: string): void {
    const capituloObjetivo = this.capitulos().find(
      (capituloActual) =>
        capituloActual.id === capitulo ||
        capituloActual.numero === capitulo.trim().replace(/^CAP-?/, ''),
    );
    if (!capituloObjetivo) {
      return;
    }
    this.capituloSeleccionado.set(capituloObjetivo.numero);
    this.capitulosAbiertos.update((abiertos) => new Set(abiertos).add(capituloObjetivo.id));
  }

  /**
   * Abre una sección y despliega automáticamente su capítulo para que el
   * submenú activo quede visible en el árbol lateral.
   */
  abrirSeccion(seccionId: string): void {
    this.seccionSeleccionada.set(seccionId);
    const capituloDueño = this.capitulos().find((capituloActual) =>
      capituloActual.secciones.some(
        (seccionActual) =>
          seccionActual.id === seccionId ||
          this.buscarHijo(seccionActual.hijos, seccionId) !== null,
      ),
    );
    if (capituloDueño) {
      // El orquestor apila el capítulo dueño de la sección que se acaba de abrir.
      this.capituloSeleccionado.set(capituloDueño.numero);
      this.capitulosAbiertos.update((abiertos) => {
        const copia = new Set(abiertos);
        copia.add(capituloDueño.id);
        return copia;
      });
    }
  }

  alternarCapitulo(capituloId: string): void {
    this.capitulosAbiertos.update((abiertos) => {
      const copia = new Set(abiertos);
      if (copia.has(capituloId)) {
        copia.delete(capituloId);
      } else {
        copia.add(capituloId);
      }
      return copia;
    });
  }

  /**
   * Avanza el semáforo de una sección sin tocar la matriz semilla.
   *
   * La escritura es idempotente a propósito: si el estado ya es el solicitado
   * se devuelve la misma referencia, y como las signals comparan con
   * `Object.is`, no se invalida nada aguas arriba.
   *
   * Sin esa guarda, cualquier consumidor que confirme su propia sección desde
   * un `effect` realimenta el ciclo sin fin, porque leer el semáforo para
   * localizar la fila es justamente lo que invalida la escritura. También evita
   * el trabajo inútil de reconstruir el árbol completo en cada confirmación.
   */
  fijarEstadoSeccion(seccionId: string, estado: EstadoSeccion): void {
    this.ajustesSecciones.update((ajustes) => {
      if (ajustes[seccionId]?.estado === estado) {
        return ajustes;
      }
      return { ...ajustes, [seccionId]: { ...ajustes[seccionId], estado } };
    });
  }

  /**
   * Avanza el semáforo desde el propio formulario, usando el índice oficial de
   * la sección (`1.1`, `2.5`) en lugar de su identificador interno.
   *
   * El estado se acepta en cualquier caja, de modo que los formularios pueden
   * escribir `'VERDE'` —la nomenclatura de las pantallas del MINEM— sin conocer
   * la capitalización del dominio. La matriz semilla nunca se muta: el cambio
   * viaja por `ajustesSecciones` y el semáforo del menú lateral se recalcula
   * reactivamente mediante `capitulos`.
   *
   * @returns `true` si la sección existe y el semáforo quedó actualizado.
   */
  actualizarEstadoSeccion(numero: string, estado: string): boolean {
    const seccionObjetivo = this.seccionPorNumero(numero);
    if (!seccionObjetivo) {
      return false;
    }
    this.fijarEstadoSeccion(seccionObjetivo.id, normalizarEstadoSeccion(estado));
    return true;
  }

  /**
   * Marca o levanta la observación del evaluador sobre una sección.
   *
   * Igual que `fijarEstadoSeccion`, la escritura es idempotente: si la sección
   * ya está en el valor pedido se devuelve el mismo diccionario de ajustes. La
   * verificación del semáforo la llama tras cada subsanación, y sin la guarda
   * reconstruiría el árbol completo del expediente en cada tecla.
   */
  marcarObservada(seccionId: string, observado: boolean): void {
    const efectivo =
      this.ajustesSecciones()[seccionId]?.observado ?? this.observadoEnSemilla(seccionId);
    if (efectivo === observado) {
      return;
    }
    this.ajustesSecciones.update((ajustes) => ({
      ...ajustes,
      [seccionId]: { ...ajustes[seccionId], observado },
    }));
  }

  /** Marca de observación que trae la matriz semilla para una sección. */
  private observadoEnSemilla(seccionId: string): boolean {
    for (const capitulo of CAPITULOS_INICIALES) {
      const hallado = this.buscarHijo(capitulo.secciones, seccionId);
      if (hallado) {
        return hallado.observado;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------
     MOTOR DE OBSERVACIONES Y SUBSANACIÓN
     ------------------------------------------------------------------
     La bandeja del evaluador vive en el store y no como señal del
     microcomponente por la misma razón que las matrices de la 2.7: el
     orquestador destruye el componente al cambiar de capítulo, y un estado
     local perdería el descargo que el titular acaba de escribir.
     Toda la API recibe el índice de la sección como parámetro. El motor se
     invoca una vez por cada sección observada del capítulo y todas esas
     instancias están vivas a la vez, así que un puntero global de «sección
     activa» las habría dejado a todas leyendo la misma bandeja.
     ------------------------------------------------------------------ */

  /** Bandeja completa, por microcomponente observado. */
  private readonly registroEvaluaciones = signal<readonly MicroComponenteEvaluado[]>(
    MICROCOMPONENTES_EVALUADOS_INICIALES,
  );

  /** Lista estable para las secciones sin bandeja, para no invalidar el `@for`. */
  private static readonly SIN_OBSERVACIONES: readonly AlertaObservacion[] = [];

  /**
   * Abre un acta del evaluador sobre cualquier sección.
   *
   * Es la entrada que usa el sistema cuando llega una observación nueva, y no
   * solo un atajo para las pruebas: la bandeja del 2.7 es una semilla, y sin
   * este método el motor genérico no tendría por dónde recibir un acta sobre
   * otra sección —que es justamente lo que vino a resolver.
   *
   * El correlativo se numera por bandeja y no por expediente para que dos actas
   * simultáneas no colisionen al ordenarse.
   *
   * @returns `false` si la sección no existe en el expediente.
   */
  registrarActaEvaluador(idSeccion: string, glosaEvaluador: string): boolean {
    const seccionObjetivo = this.seccionPorNumero(idSeccion);
    if (!seccionObjetivo) {
      return false;
    }
    const correlativo = `OBS-${String(this.totalObservaciones() + 1).padStart(3, '0')}`;
    const nueva: MicroComponenteEvaluado = {
      id: seccionObjetivo.numero,
      nombreSeccion: `${seccionObjetivo.numero} ${seccionObjetivo.titulo}`,
      capitulo: seccionObjetivo.numero.split('.')[0] ?? seccionObjetivo.numero,
      observaciones: [alertaPendiente(correlativo, glosaEvaluador)],
    };
    this.registroEvaluaciones.update((registro) => [
      ...registro.filter((micro) => micro.id !== seccionObjetivo.numero),
      nueva,
    ]);
    this.marcarObservada(seccionObjetivo.id, true);
    this.fijarEstadoSeccion(seccionObjetivo.id, 'Rojo');
    return true;
  }

  /** Observaciones registradas en todo el expediente, resueltas y pendientes. */
  readonly totalObservaciones = computed(() =>
    this.registroEvaluaciones().reduce((total, micro) => total + micro.observaciones.length, 0),
  );

  /** Microcomponente observado de una sección, o `null` si no tiene bandeja. */
  microComponenteEvaluadoDe(idSeccion: string): MicroComponenteEvaluado | null {
    const id = idSeccion.trim();
    return this.registroEvaluaciones().find((micro) => micro.id === id) ?? null;
  }

  /** Observaciones que debe resolver una sección concreta. */
  observacionesDeSeccion(idSeccion: string): readonly AlertaObservacion[] {
    return this.microComponenteEvaluadoDe(idSeccion)?.observaciones ?? DaexStore.SIN_OBSERVACIONES;
  }

  /**
   * `true` cuando una sección ya no tiene observaciones sin descargo.
   *
   * Una sección sin bandeja devuelve `false`: no tiene nada que remitir, y
   * darla por resuelta contaría como subsanada una bandeja que no existe.
   */
  todoSubsanadoEnSeccion(idSeccion: string): boolean {
    const observaciones = this.observacionesDeSeccion(idSeccion);
    return observaciones.length > 0 && observaciones.every((obs) => obs.estado === 'SUBSANADO');
  }

  /** Observaciones de todo el expediente que siguen sin descargo. */
  readonly observacionesPendientesTotales = computed(
    () =>
      this.registroEvaluaciones()
        .flatMap((micro) => micro.observaciones)
        .filter((obs) => obs.estado === 'PENDIENTE').length,
  );

  /** Secciones con acta del evaluador, leídas del árbol y no de la bandeja. */
  readonly seccionesObservadas = computed(
    () => this.seccionesAplanadas().filter((seccionActual) => seccionActual.observado).length,
  );

  /** Abre la caja de descargo de una fila pendiente. */
  abrirCajaTextoSubsanarFila(idSeccion: string, idAlerta: string): void {
    this.editarCajaDescargo(idSeccion, idAlerta, true);
  }

  /** Cierra la caja de descargo sin guardar: la observación sigue pendiente. */
  cerrarCajaTextoSubsanarFila(idSeccion: string, idAlerta: string): void {
    this.editarCajaDescargo(idSeccion, idAlerta, false);
  }

  /**
   * Mueve la caja de descargo de una fila.
   *
   * Una fila ya subsanada no se reabre: su descargo es parte del expediente
   * remitido y se revisa contra el acta, no se reescribe desde la bandeja.
   */
  private editarCajaDescargo(idSeccion: string, idAlerta: string, editando: boolean): void {
    const micro = this.microComponenteEvaluadoDe(idSeccion);
    const fila = micro?.observaciones.find((obs) => obs.id === idAlerta);
    if (!micro || !fila || fila.estado === 'SUBSANADO') {
      return;
    }
    this.registroEvaluaciones.update((registro) =>
      registro.map((microActual) =>
        microActual.id === micro.id
          ? {
              ...microActual,
              observaciones: microActual.observaciones.map((obs) =>
                obs.id === idAlerta ? { ...obs, editandoDescargo: editando } : obs,
              ),
            }
          : microActual,
      ),
    );
  }

  /**
   * Guarda el descargo de una fila, la marca como subsanada y cierra su caja.
   *
   * @returns `false` si la fila no existe, ya estaba subsanada o el descargo
   *   llegó vacío. En esos tres casos la bandeja no se toca: la caja sigue
   *   abierta para que el titular corrija lo que falta.
   */
  procesarGuardarSubsanacionFila(idSeccion: string, idAlerta: string, descargo: string): boolean {
    const descargoNormalizado = descargo.trim();
    const micro = this.microComponenteEvaluadoDe(idSeccion);
    const fila = micro?.observaciones.find((obs) => obs.id === idAlerta);
    if (!micro || !fila || fila.estado === 'SUBSANADO') {
      return false;
    }
    if (descargoNormalizado === '') {
      return false;
    }
    this.registroEvaluaciones.update((registro) =>
      registro.map((microActual) =>
        microActual.id === micro.id
          ? {
              ...microActual,
              observaciones: microActual.observaciones.map((obs) =>
                obs.id === idAlerta
                  ? {
                      ...obs,
                      estado: 'SUBSANADO' as const,
                      descargoSustento: descargoNormalizado,
                      editandoDescargo: false,
                    }
                  : obs,
              ),
            }
          : microActual,
      ),
    );
    this.verificarYActualizarSemaforoMenuGeneral(idSeccion);
    return true;
  }

  /**
   * Traduce el estado de la bandeja al semáforo de la sección.
   *
   * Con observaciones sin subsanar la sección queda en rojo, que es la señal
   * que enciende el capítulo en el índice lateral. Al quedar todas subsanadas
   * pasa a azul —resuelto en el cliente, a la espera de que lo revise el
   * MINEM— y nunca a verde: el verde significa "validado", y quien valida es el
   * MINEM, no el titular.
   *
   * La sección queda observada mientras haya bandeja, porque subsanar no
   * retira la observación: solo le responde.
   */
  verificarYActualizarSemaforoMenuGeneral(idSeccion: string): void {
    const micro = this.microComponenteEvaluadoDe(idSeccion);
    if (!micro || micro.observaciones.length === 0) {
      return;
    }
    const seccionObjetivo = this.seccionPorNumero(micro.id);
    if (!seccionObjetivo) {
      return;
    }
    const todoResuelto = micro.observaciones.every((obs) => obs.estado === 'SUBSANADO');
    this.actualizarEstadoSeccion(micro.id, todoResuelto ? 'AZUL' : 'ROJO');
    this.marcarObservada(seccionObjetivo.id, true);
  }

  /* ------------------------------------------------------------------
     ETAPA DE LA REMISIÓN AL MINEM
     ------------------------------------------------------------------
     El botón general de la cabecera no remite siempre lo mismo: su rótulo
     depende de en qué punto del trámite está el expediente, porque lo que se
     manda al MINEM es distinto en cada caso.
     ------------------------------------------------------------------ */

  /** Etapa forzada por el MINEM; si no hay, la etapa se deduce del expediente. */
  private readonly etapaRemisionForzada = signal<EstadoRemision | null>(null);

  /** Marca de tiempo de cada remisión hecha, por etapa. */
  private readonly remisiones = signal<ReadonlyMap<EstadoRemision, string>>(new Map());

  /**
   * Etapa en la que está la remisión.
   *
   * Se deduce del expediente en lugar de guardarse: basta con que exista
   * alguna sección observada para que el envío ya no sea el de un DAEX nuevo, y
   * esa información vive en el árbol de secciones, no en una bandera suelta que
   * se desincronizaría de él. La única etapa que sí se guarda es la solicitud
   * de información complementaria, porque llega del MINEM y no se deduce de
   * ninguna sección.
   */
  readonly estadoRemision = computed<EstadoRemision>(() => {
    const forzada = this.etapaRemisionForzada();
    if (forzada) {
      return forzada;
    }
    return this.seccionesObservadas() > 0 ? 'OBSERVADO' : 'NUEVO';
  });

  /** Rótulo del botón general, que es lo que el titular va a mandar. */
  readonly etiquetaRemision = computed(() => ETIQUETAS_REMISION[this.estadoRemision()]);

  /**
   * Guardián del botón general, distinto en cada etapa.
   *
   * En un DAEX nuevo se exige el expediente entero en verde. Observado, lo que
   * se manda son subsanaciones, así que la condición es que no quede ninguna
   * observación sin descargo: exigir las 27 secciones volvería a bloquear al
   * titular que solo tiene que responder al acta. Con información
   * complementaria no hay estructura que comprobar, porque lo que se remite es
   * el documento que el MINEM pidió.
   */
  readonly puedeRemitir = computed(() => {
    switch (this.estadoRemision()) {
      case 'NUEVO':
        return this.puedeEnviarAlMinem();
      case 'OBSERVADO':
        return this.seccionesObservadas() > 0 && this.observacionesPendientesTotales() === 0;
      case 'INFORMACION_COMPLEMENTARIA':
        return true;
    }
  });

  /** Motivo legible del bloqueo, o `null` si el botón está disponible. */
  readonly motivoRemision = computed<string | null>(() => {
    if (this.puedeRemitir()) {
      return null;
    }
    switch (this.estadoRemision()) {
      case 'NUEVO':
        return `${this.seccionesPendientes().length} de ${this.totalSecciones()} secciones siguen pendientes de completar.`;
      case 'OBSERVADO':
        return `Faltan ${this.observacionesPendientesTotales()} descargo(s) de sustento por responder antes de remitir la subsanación.`;
      case 'INFORMACION_COMPLEMENTARIA':
        return null;
    }
  });

  /** El MINEM pide información complementaria: cambia lo que se remite. */
  solicitarInformacionComplementaria(): void {
    this.etapaRemisionForzada.set('INFORMACION_COMPLEMENTARIA');
  }

  /** Cierra la solicitud de información complementaria y vuelve a la etapa real. */
  cerrarSolicitudInformacionComplementaria(): void {
    this.etapaRemisionForzada.set(null);
  }

  /**
   * Registra la remisión del expediente en la etapa vigente.
   *
   * No mueve la etapa a propósito: la siguiente la declara el MINEM al revisar
   * lo recibido, y adelantarla aquí dejaría el botón anunciando algo que
   * todavía no se ha mandado.
   *
   * @returns `false` si la etapa vigente no cumple su guardián.
   */
  registrarRemision(): boolean {
    if (!this.puedeRemitir()) {
      return false;
    }
    this.remisiones.update((remisiones) => {
      const siguiente = new Map(remisiones);
      siguiente.set(this.estadoRemision(), new Date().toISOString());
      return siguiente;
    });
    return true;
  }

  /** Instante de la última remisión de una etapa, o `null` si no se mandó. */
  ultimaRemision(estado: EstadoRemision): string | null {
    return this.remisiones().get(estado) ?? null;
  }

  /* ------------------------------------------------------------------
     SEMÁFORO AGREGADO DEL ÍNDICE LATERAL
     ------------------------------------------------------------------ */

  /** Estado de cada capítulo, listo para pintar los círculos del índice. */
  readonly semaforoCapitulos = computed<ReadonlyMap<string, EstadoSeccion>>(
    () =>
      new Map(
        this.capitulos().map(
          (capituloActual) =>
            [capituloActual.numero, agregarSemaforo(capituloActual.secciones)] as const,
        ),
      ),
  );

  /**
   * Semáforo de un capítulo para el círculo del índice.
   *
   * Se resuelve contra el mapa ya computado en vez de recorrer el árbol en cada
   * fila de la plantilla: son siete lecturas por pasada y el mapa solo cambia
   * cuando cambia el estado de alguna sección.
   */
  estadoCapitulo(numero: string): EstadoSeccion {
    return this.semaforoCapitulos().get(numero) ?? 'Gris';
  }

  /** `true` si el capítulo tiene alguna sección en rojo: su círculo late. */
  capituloEnAlerta(numero: string): boolean {
    return this.estadoCapitulo(numero) === 'Rojo';
  }

  private buscarHijo(
    secciones: readonly SeccionExpediente[],
    seccionId: string,
  ): SeccionExpediente | null {
    for (const seccionActual of secciones) {
      if (seccionActual.id === seccionId) {
        return seccionActual;
      }
      const descendiente = this.buscarHijo(seccionActual.hijos, seccionId);
      if (descendiente) {
        return descendiente;
      }
    }
    return null;
  }

  private buscarPorNumero(
    secciones: readonly SeccionExpediente[],
    numero: string,
  ): SeccionExpediente | null {
    for (const seccionActual of secciones) {
      if (seccionActual.numero === numero) {
        return seccionActual;
      }
      const descendiente = this.buscarPorNumero(seccionActual.hijos, numero);
      if (descendiente) {
        return descendiente;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------
     CONTEXTO DEL FORMULARIO DE EDICIÓN
     ------------------------------------------------------------------ */

  /** Metadatos inmutables que titulan el formulario de edición. */
  readonly formulario = this.contextoFormulario.asReadonly();

  /* ------------------------------------------------------------------
     ÁREA EFECTIVA REGISTRADA

     La 2.5 publica aquí el polígono confirmado. Es el único insumo que
     necesita la 2.2 para disparar su cruce catastral, de modo que la
     dependencia entre ambas secciones queda explícita y no implícita en
     un temporizador de cada componente.
     ------------------------------------------------------------------ */

  private readonly areaEfectiva = signal<readonly VerticeArea[]>([]);

  /** Vértices del área efectiva ya confirmados por el titular. */
  readonly areaEfectivaRegistrada = this.areaEfectiva.asReadonly();

  /**
   * Ubigeo político del área efectiva, o `null` si todavía no hay polígono.
   *
   * El origen real de estos tres nombres es el servicio de geocodificación
   * inversa del INEI sobre el centroide del polígono: geocodificar no es una
   * operación que el navegador pueda resolver sin la base REDATAM completa.
   *
   * Hasta que ese servicio entre, se resuelve contra un catálogo local
   * declarado en `UBIGEO_POR_AREA`. Es el único punto que hay que reemplazar
   * cuando la API esté disponible; la firma y el consumo no cambian, de modo
   * que la 2.4 no se entera.
   */
  readonly ubigeo = computed<UbigeoPolitico | null>(() => {
    if (this.areaEfectiva().length < 3) {
      return null;
    }
    return UBIGEO_POR_AREA;
  });

  /**
   * Publica el polígono de la 2.5 para el cruce catastral de la 2.2.
   *
   * Se acepta solo geometría con tres vértices o más: un polígono con menos
   * puntos no encloses área y no puede cruzarse contra ningún catastro.
   */
  registrarAreaEfectiva(vertices: readonly VerticeArea[]): void {
    if (vertices.length < 3) {
      return;
    }
    this.areaEfectiva.set([...vertices]);
  }

  /** Descarta el área efectiva, por ejemplo al abandonar el expediente. */
  limpiarAreaEfectiva(): void {
    this.areaEfectiva.set([]);
  }

  /* ------------------------------------------------------------------
     2.6 · CRONOGRAMA E INVERSIÓN
     ------------------------------------------------------------------
     Las etapas viven aquí y no dentro del componente porque la 2.10
     sincroniza su dotación con las etapas activas de este cronograma. Si
     el Gantt las guardara en un signal local, al apilar ambas secciones en
     la columna no habría un único lugar del que leerlas, y la
     sincronización dependería del orden de montaje.

     Cada guarda rehidrata el microcomponente: el orquestador los destruye
     y los vuelve a crear al cambiar de capítulo, así que un signal local
     perdería las duraciones que el titular acaba de editar.
     ------------------------------------------------------------------ */

  private readonly cronograma = signal<readonly EtapaCronograma[]>([]);

  /** Etapas del cronograma ya validadas por el titular. */
  readonly cronogramaRegistrado = this.cronograma.asReadonly();

  /**
   * Publica el cronograma validado de la 2.6.
   *
   * Las etapas sin duración no se guardan: un Gantt con una etapa de cero
   * meses es indistinguible de una etapa ausente, y el total dejaría de
   * cuadrar con lo que el titular ve en pantalla.
   */
  registrarCronograma(etapas: readonly EtapaCronograma[]): void {
    if (etapas.length === 0) {
      return;
    }
    this.cronograma.set(
      etapas
        .filter((etapa) => etapa.meses > 0)
        .map((etapa) => ({ ...etapa, dependeDe: [...etapa.dependeDe] })),
    );
  }

  /** Descarta el cronograma, por ejemplo al abandonar el expediente. */
  limpiarCronograma(): void {
    this.cronograma.set([]);
  }

  /* ------------------------------------------------------------------
     2.7 · COMPONENTES DEL PROYECTO
     ------------------------------------------------------------------
     Las tres matrices de la 2.7 viven aquí por la misma razón que las
     etapas del cronograma: el orquestador destruye el microcomponente al
     cambiar de capítulo, así que un signal local perdería lo tecleado. Se
     guarda un único objeto para que las tres tablas se validen y se
     recuperen como una sola unidad.
     ------------------------------------------------------------------ */

  private readonly matrizComponentes = signal<MatrizComponentes | null>(null);

  /** Matriz de componentes ya validada, o `null` si la sección está vacía. */
  readonly matrizComponentesRegistrada = this.matrizComponentes.asReadonly();

  /**
   * Publica las matrices de plataformas, auxiliares y dimensiones.
   *
   * Las filas llegan ya validadas por el componente: aquí no se revalida nada
   * para no tener dos definiciones de qué es una matriz correcta. El clon es
   * superficial salvo en los sondajes, que se copian uno a uno porque cuelgan
   * de la plataforma y una edición posterior en el componente alcanzaría al
   * guardado. Los identificadores se conservan: el `@for` empareja filas por
   * `id`, y uno nuevo en cada guardado sacaría el DOM de una fila del sitio.
   */
  registrarMatrizComponentes(matriz: MatrizComponentes): void {
    this.matrizComponentes.set({
      plataformas: matriz.plataformas.map((fila) => ({
        ...fila,
        sondajes: fila.sondajes.map((sondaje) => ({ ...sondaje })),
      })),
      auxiliares: matriz.auxiliares.map((fila) => ({ ...fila })),
      dimensiones: matriz.dimensiones.map((fila) => ({ ...fila })),
    });
  }

  /** Descarta la matriz de componentes, por ejemplo al abandonar el expediente. */
  limpiarMatrizComponentes(): void {
    this.matrizComponentes.set(null);
  }

  /* ------------------------------------------------------------------
     2.8 · DEMANDA DE AGUA
     ------------------------------------------------------------------
     El balance hídrico vive aquí por la misma razón que las etapas del
     cronograma y las matrices de la 2.7: el orquestador destruye el
     microcomponente al cambiar de capítulo, así que un signal local perdería
     los puntos que el titular acaba de declarar. Un array plano basta porque
     la sección tiene una sola tabla.
     ------------------------------------------------------------------ */

  private readonly demandaAgua = signal<readonly FuenteAbastecimientoAgua[]>([]);

  /** Puntos de abastecimiento ya validados por el titular. */
  readonly demandaAguaRegistrada = this.demandaAgua.asReadonly();

  /**
   * Publica el balance hídrico validado.
   *
   * Las filas llegan ya validadas por el componente: aquí no se revalida nada
   * para no tener dos definiciones de qué es una fila correcta. El clon es
   * superficial porque la fila es plana, y los identificadores se conservan: el
   * `@for` empareja cada fila con su nodo por `id`, y uno nuevo en cada guardado
   * sacaría el DOM de una fila del sitio.
   */
  registrarDemandaAgua(filas: readonly FuenteAbastecimientoAgua[]): void {
    this.demandaAgua.set(filas.map((fila) => ({ ...fila })));
  }

  /** Descarta el balance hídrico, por ejemplo al abandonar el expediente. */
  limpiarDemandaAgua(): void {
    this.demandaAgua.set([]);
  }

  /* ------------------------------------------------------------------
     2.9 · INSUMOS, MAQUINARIAS Y EQUIPOS
     ------------------------------------------------------------------
     Dos matrices y, por tanto, dos signals. Se publican al validar la sección
     por la misma razón que el balance de la 2.8, pero se guardan aparte porque
     cada tabla se edita por su cuenta y el componente tiene que poder
     rehidratar una sin tocar la otra.
     ------------------------------------------------------------------ */

  private readonly insumosCatalogo = signal<readonly InsumoCatalogo[]>([]);

  /** Insumos y materiales ya validados por el titular. */
  readonly catalogoInsumosRegistrado = this.insumosCatalogo.asReadonly();

  /**
   * Publica la matriz de insumos.
   *
   * Sin revalidación, por el mismo motivo que el resto de secciones: quien
   * valida es el componente, y duplicar aquí la definición de fila correcta
   * haría que las dos capas pudieran discrepar.
   */
  registrarCatalogoInsumos(filas: readonly InsumoCatalogo[]): void {
    this.insumosCatalogo.set(filas.map((fila) => ({ ...fila })));
  }

  /** Descarta la matriz de insumos. */
  limpiarCatalogoInsumos(): void {
    this.insumosCatalogo.set([]);
  }

  private readonly equiposCatalogo = signal<readonly EquipoCatalogo[]>([]);

  /** Equipos y maquinarias ya validados por el titular. */
  readonly catalogoEquiposRegistrado = this.equiposCatalogo.asReadonly();

  /** Publica la matriz de equipos y maquinarias. */
  registrarCatalogoEquipos(filas: readonly EquipoCatalogo[]): void {
    this.equiposCatalogo.set(filas.map((fila) => ({ ...fila })));
  }

  /** Descarta la matriz de equipos y maquinarias. */
  limpiarCatalogoEquipos(): void {
    this.equiposCatalogo.set([]);
  }

  /* ------------------------------------------------------------------
     2.10 · PERSONAL
     ------------------------------------------------------------------
     La dotación se guarda por identificador de etapa y no como una grilla
     propia: las filas de esta sección son las etapas del cronograma de la 2.6,
     y la 2.6 deja que el titular reordene y renombre sus etapas. Guardar una
     lista independiente obligaría a reconciliar las dos en cada montaje, y un
     orden distinto aplicaría una dotación a la etapa equivocada.
     ------------------------------------------------------------------ */

  private readonly dotacionPersonal = signal<readonly DotacionEtapa[]>([]);

  /** Dotación de personal ya validada por el titular, indexada por etapa. */
  readonly dotacionPersonalRegistrada = this.dotacionPersonal.asReadonly();

  /**
   * Publica la dotación de personal.
   *
   * Sin revalidación, por el mismo motivo que el resto de secciones: quien
   * valida es el componente. Se guarda incluso una fila sin cantidad declarada,
   * porque el estado "pendiente" de una etapa forma parte de lo que el titular
   * llevaba hasta decidir no declararla.
   */
  registrarDotacionPersonal(filas: readonly DotacionEtapa[]): void {
    this.dotacionPersonal.set(
      filas.map((fila) => ({
        ...fila,
        especializacion: fila.especializacion.trim(),
      })),
    );
  }

  /** Descarta la dotación de personal, por ejemplo al abandonar el expediente. */
  limpiarDotacionPersonal(): void {
    this.dotacionPersonal.set([]);
  }

  /* ------------------------------------------------------------------
     5.1 · IMPACTOS AMBIENTALES, ESTRATEGIAS DE MANEJO Y CIERRE
     ------------------------------------------------------------------
     Matriz de compromisos ambientales. Se guarda como lista porque la grilla
     la recorre en el orden en que el titular la declara; los identificadores
     los conserva el store para que el @for no descoloque filas al rehidratar.
     ------------------------------------------------------------------ */

  private readonly compromisosAmbientales = signal<readonly CompromisoAmbiental[]>([]);

  /** Compromisos ambientales ya validados por el titular. */
  readonly compromisosAmbientalesRegistrada = this.compromisosAmbientales.asReadonly();

  /**
   * Publica la matriz de compromisos ambientales.
   *
   * Las filas llegan ya validadas por el componente: aquí no se revalida nada
   * para no tener dos definiciones de qué es una declaración correcta. El clon
   * es superficial porque la fila es plana.
   */
  registrarCompromisosAmbientales(compromisos: readonly CompromisoAmbiental[]): void {
    this.compromisosAmbientales.set(compromisos.map((compromiso) => ({ ...compromiso })));
  }

  /** Descarta la matriz de impactos, por ejemplo al abandonar el expediente. */
  limpiarCompromisosAmbientales(): void {
    this.compromisosAmbientales.set([]);
  }

  /* ------------------------------------------------------------------
     5.2 · ÁREA DE INFLUENCIA
     ------------------------------------------------------------------
     Inventario compuesto de influencia ambiental y social. Se guarda como una
     sola lista, y la categoría de cada área la distingue al rehidratar: el
     componente reparte las filas entre sus dos grillas según `categoria`.
     ------------------------------------------------------------------ */

  private readonly areasInfluencia = signal<readonly AreaInfluencia[]>([]);

  /** Áreas de influencia ya validadas por el titular. */
  readonly areasInfluenciaRegistrada = this.areasInfluencia.asReadonly();

  /**
   * Publica el inventario completo de áreas de influencia.
   *
   * Las filas llegan ya validadas por el componente; aquí no se revalida nada
   * para no tener dos definiciones de qué es un área correcta. El clon baja dos
   * niveles (área y sus vértices) porque los vértices son objetos y la
   * aplicación los actualiza de forma inmutable.
   */
  registrarAreasInfluencia(areas: readonly AreaInfluencia[]): void {
    this.areasInfluencia.set(
      areas.map((area) => ({
        ...area,
        vertices: area.vertices.map((vertice) => ({ ...vertice })),
      })),
    );
  }

  /** Descarta el inventario de influencia, por ejemplo al abandonar el expediente. */
  limpiarAreasInfluencia(): void {
    this.areasInfluencia.set([]);
  }

  /** Todas las secciones del árbol, aplanadas, incluidas las sub-capas. */
  private readonly seccionesAplanadas = computed<readonly SeccionExpediente[]>(() => {
    const aplanar = (secciones: readonly SeccionExpediente[]): SeccionExpediente[] =>
      secciones.flatMap((seccionActual) => [seccionActual, ...aplanar(seccionActual.hijos)]);
    return aplanar(this.capitulos().flatMap((capituloActual) => capituloActual.secciones));
  });

  /** Secciones que aún no están en verde. */
  readonly seccionesPendientes = computed(() =>
    this.seccionesAplanadas().filter((seccionActual) => seccionActual.estado !== 'Verde'),
  );

  /**
   * Guardián de la remisión: solo habilita «Enviar al MINEM» cuando la
   * totalidad de las 27 secciones está en verde. Basta un semáforo en rojo
   * o un gris pendiente para bloquear el envío.
   */
  readonly puedeEnviarAlMinem = computed(
    () => this.seccionesAplanadas().length > 0 && this.seccionesPendientes().length === 0,
  );

  /** Avance porcentual del expediente para la barra de progreso del formulario. */
  readonly avanceExpediente = computed(() => {
    const total = this.seccionesAplanadas().length;
    if (total === 0) {
      return 0;
    }
    return Math.round(((total - this.seccionesPendientes().length) / total) * 100);
  });

  // Bandera maestra: determina si el usuario visualiza el expediente sin permisos de edición
  public modoSoloConsulta = signal<boolean>(false);

  public activarModoSoloConsulta(activo: boolean): void {
    this.modoSoloConsulta.set(activo);
  }

  /** Abre el formulario de edición sobre un expediente de la bandeja. */
  editarExpediente(expediente: Expediente): void {
    this.contextoFormulario.set({
      nombreProyecto: expediente.nombreProyecto,
      unidadMinera: expediente.unidadMinera,
      numeroExpediente: expediente.numeroExpediente,
      tipoIga: expediente.tipoIga,
    });
  }

  /** Prepara el contexto de un DAEX nuevo, todavía sin expediente asignado. */
  iniciarFormularioNuevo(tipoIga: TipoIga = 'DAEX'): void {
    this.contextoFormulario.set({ ...CONTEXTO_NUEVO, tipoIga });
  }

  /**
   * Abre un expediente derivado tipo ITS vinculado a un IGA aprobado.
   *
   * La bifurcación no toca el expediente origen: la modificación no
   * significativa se tramita como hito independiente, en estado Borrador y
   * listo para que el titular lo complete desde la bandeja. Devuelve `null`
   * si el expediente de referencia no existe en el catálogo.
   */
  abrirExpedienteItsDerivado(expedienteOrigenId: string): Expediente | null {
    const origen = this.listaExpedientes().find(
      (expediente) =>
        expediente.id === expedienteOrigenId || expediente.numeroExpediente === expedienteOrigenId,
    );
    if (!origen) {
      return null;
    }

    const anio = new Date().getFullYear();
    const correlativo = String(
      this.listaExpedientes().filter((expediente) => expediente.tipoIga === 'ITS').length + 1,
    ).padStart(3, '0');
    const derivado: Expediente = {
      id: `EXP-ITS-${anio}-${correlativo}`,
      tipoIga: 'ITS',
      nombreProyecto: origen.nombreProyecto,
      unidadMinera: origen.unidadMinera,
      numeroExpediente: `ITS-${anio}-${correlativo}`,
      fechaEnvio: null,
      vigencia: '—',
      estado: 'Borrador',
    };
    this.listaExpedientes.update((expedientes) => [...expedientes, derivado]);
    return derivado;
  }

  /**
   * Aplica un parche al contexto del expediente en edición.
   *
   * Las secciones del capítulo 2 escriben aquí los campos que la cabecera
   * replica (nombre del proyecto, unidad minera). Se fusiona de forma
   * inmutable porque el objeto completo se lee desde varias plantillas y
   * conservar la referencia anterior rompería las signals derivadas que ya
   * lo cachearon.
   */
  actualizarFormulario(parcial: Partial<ContextoFormulario>): void {
    this.contextoFormulario.update((contexto) => ({ ...contexto, ...parcial }));
  }
}
