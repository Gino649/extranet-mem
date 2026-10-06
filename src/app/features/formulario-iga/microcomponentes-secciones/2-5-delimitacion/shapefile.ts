/**
 * Lectura mínima de shapefiles ESRI (`.shp`) y de su empaquetado `.zip`.
 *
 * OpenLayers trae `ol/format` para GeoJSON, no para shapefiles, y `proj4` para
 * reproyectar, pero no un lector de `.shp`. Como no hay una dependencia de
 * geodesia instalada, el lector va aquí y se limita a lo que la 2.5 necesita:
 * extraer el anillo exterior de cada polígono en coordenadas de origen.
 *
 * No se reproyecta nada. Las coordenadas de origen son las que el titular
 * capturó y las que la 2.5 publica al expediente; reproyectar a UTM exigiría el
 * datum del `.prj`, que el `.shp` no incluye por definición.
 */

/** Par de coordenadas de origen tal como viene en el archivo. */
export interface PuntoOrigen {
  readonly x: number;
  readonly y: number;
}

/** Resultado de la lectura, con los motivos por los que se rechaza un archivo. */
export interface LecturaShapefile {
  readonly anillos: readonly (readonly PuntoOrigen[])[];
  readonly error: string | null;
}

/** Tipos de registro que contienen polígonos. */
const POLIGONOS = new Set([5, 15, 25]);

/** Código de archivo válido según la especificación ESRI. */
const CODIGO_ARCHIVO = 9994;

/** Longitud de la cabecera del `.shp`, en bytes. */
const CABECERA = 100;

/**
 * Extrae los anillos exteriores de los polígonos de un `.shp`.
 *
 * Los multianillos se toman completos, con su parte 0, que es la exterior por
 * definición en el formato. Los agujeros interiores no se restan: sin una
 * geometría con_or la superficie saldría mal, y aquí la superficie no es el
 * objeto de la 2.5.
 */
export function leerPoligonosShapefile(datos: ArrayBuffer): LecturaShapefile {
  if (datos.byteLength < CABECERA) {
    return { anillos: [], error: 'El archivo no tiene cabecera de shapefile.' };
  }
  const vista = new DataView(datos);

  // La cabecera mezcla extremos: el codigo de archivo y la longitud son big-endian.
  if (vista.getInt32(0, false) !== CODIGO_ARCHIVO) {
    return { anillos: [], error: 'El archivo no es un shapefile de ESRI.' };
  }

  const version = vista.getInt32(28, true);
  if (version !== 1000) {
    return { anillos: [], error: `Versión de shapefile no soportada: ${version}.` };
  }

  const anillos: PuntoOrigen[][] = [];
  let desplazamiento = CABECERA;

  while (desplazamiento + 8 <= datos.byteLength) {
    // Numero de registro y longitud del contenido, ambos big-endian.
    const longitud = vista.getInt32(desplazamiento + 4, false) * 2;
    const inicio = desplazamiento + 8;
    if (longitud < 4 || inicio + longitud > datos.byteLength) {
      break;
    }

    const tipo = vista.getInt32(inicio, true);
    if (POLIGONOS.has(tipo)) {
      const anillo = leerPoligono(vista, inicio);
      if (anillo.length > 0) {
        anillos.push(anillo);
      }
    }
    desplazamiento = inicio + longitud;
  }

  if (anillos.length === 0) {
    return {
      anillos: [],
      error: 'El shapefile no contiene polígonos con vértices legibles.',
    };
  }
  return { anillos, error: null };
}

/** Lee un registro de polígono y devuelve su anillo exterior. */
function leerPoligono(vista: DataView, inicio: number): PuntoOrigen[] {
  const partes = vista.getInt32(inicio + 36, true);
  const puntos = vista.getInt32(inicio + 40, true);
  if (partes < 1 || puntos < 1) {
    return [];
  }

  // Tras los limites y los dos contadores vienen los indices de parte: el
  // primero marca donde arranca la parte y el siguiente donde termina. Con una
  // sola parte, el anillo llega hasta el ultimo punto.
  const desde = vista.getInt32(inicio + 44, true);
  const hasta = partes > 1 ? vista.getInt32(inicio + 48, true) : puntos;
  if (desde < 0 || hasta > puntos || hasta <= desde) {
    return [];
  }

  const base = inicio + 44 + partes * 4;
  if (base + puntos * 16 > vista.byteLength) {
    return [];
  }

  const anillo: PuntoOrigen[] = [];
  for (let indice = desde; indice < hasta; indice += 1) {
    const posicion = base + indice * 16;
    anillo.push({
      x: vista.getFloat64(posicion, true),
      y: vista.getFloat64(posicion + 8, true),
    });
  }
  return anillo;
}

/**
 * Desempaqueta un `.zip` y devuelve el primer `.shp` que encuentre.
 *
 * Se recorre el directorio central, que es donde el formato lista los nombres, y
 * no la heurística de buscar la firma del primer archivo local: esa firma puede
 * aparecer por azar dentro de datos comprimidos y llevaría a leer basura.
 *
 * Devuelve `null` si el archivo no es un zip legible o no trae shapefile.
 */
export async function extraerShapefileDeZip(datos: ArrayBuffer): Promise<ArrayBuffer | null> {
  return (await extraerDeZip(datos, '.shp')) ?? null;
}

/**
 * Extrae el `.prj` del mismo `.zip` y devuelve el código EPSG que declara.
 *
 * El datum del shapefile vive únicamente en el `.prj`, y sin él las coordenadas
 * no significan nada: un archivo en UTM y otro en grados se ven igual en el
 * binario. Se busca un código EPSG con la forma habitual de los `.prj` de ESRI
 * (`PROJCS[... ] AUTHORITY["EPSG","32718"]`, o el código suelto al final). Un
 * `.prj` proyectado en parámetros sin código no es traducible y se devuelve
 * `null`, que es lo mismo que no tener `.prj`.
 */
export async function leerEpsgDeZip(datos: ArrayBuffer): Promise<number | null> {
  const crudo = await extraerDeZip(datos, '.prj');
  if (!crudo) {
    return null;
  }
  const texto = new TextDecoder().decode(new Uint8Array(crudo));
  const authority = texto.match(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"(\d{4,6})"\s*\]/i);
  if (authority?.[1]) {
    return Number(authority[1]);
  }
  const suelto = texto.match(/EPSG["']?\s*[,:#]?\s*(\d{4,6})/i);
  return suelto?.[1] ? Number(suelto[1]) : null;
}

/** Extrae del `.zip` la primera entrada cuya extensión coincide. */
async function extraerDeZip(datos: ArrayBuffer, extension: string): Promise<ArrayBuffer | null> {
  const vista = new DataView(datos);
  const total = datos.byteLength;

  // Firma del fin de directorio central: la ultima que aparece en el archivo.
  let eocd = -1;
  for (let i = total - 22; i >= 0 && i >= total - 22 - 0xffff; i -= 1) {
    if (vista.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    return null;
  }

  const entradas = vista.getUint16(eocd + 10, true);
  let cursor = vista.getUint32(eocd + 16, true);

  for (let indice = 0; indice < entradas && cursor + 46 <= total; indice += 1) {
    if (vista.getUint32(cursor, true) !== 0x02014b50) {
      return null;
    }
    const compresion = vista.getUint16(cursor + 10, true);
    const tamanoComprimido = vista.getUint32(cursor + 20, true);
    const largoNombre = vista.getUint16(cursor + 28, true);
    const largoExtra = vista.getUint16(cursor + 30, true);
    const largoComentario = vista.getUint16(cursor + 32, true);
    const inicioLocal = vista.getUint32(cursor + 42, true);

    const nombre = new TextDecoder().decode(new Uint8Array(datos, cursor + 46, largoNombre));

    if (nombre.toLowerCase().endsWith(extension)) {
      const inicio =
        inicioLocal +
        30 +
        vista.getUint16(inicioLocal + 26, true) +
        vista.getUint16(inicioLocal + 28, true);
      if (compresion === 0) {
        return datos.slice(inicio, inicio + tamanoComprimido);
      }
      if (compresion === 8 && typeof DecompressionStream === 'function') {
        return descomprimir(datos.slice(inicio, inicio + tamanoComprimido));
      }
      return null;
    }
    cursor += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}

/** Infla un bloque `deflate-raw`, que es como zip guarda las entradas comprimidas. */
async function descomprimir(bloque: ArrayBuffer): Promise<ArrayBuffer> {
  const flujo = new Blob([bloque]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(flujo).arrayBuffer();
}
