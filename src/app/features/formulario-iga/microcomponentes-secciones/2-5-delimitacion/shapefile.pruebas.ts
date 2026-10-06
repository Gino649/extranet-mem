/**
 * Constructores de archivos binarios para las pruebas de shapefile.
 *
 * Viven aparte para que el spec del lector y el del componente compartan el
 * mismo genero, sin duplicarlo y sin que los dos se desincronicen.
 */

/** Cuadrilátero de control, cerrado, en las coordenadas del expediente. */
export const CUADRADO: (readonly [number, number])[] = [
  [431_250, 8_674_100],
  [436_800, 8_674_100],
  [436_800, 8_679_400],
  [431_250, 8_679_400],
];

/**
 * Construye un `.shp` de polígono en memoria.
 *
 * Fabricar el binario a mano es lo que permite probar el lector de verdad: un
 * doble del método probaría el doble, no la lectura de los bytes little-endian,
 * que es donde suele esconderse el error.
 */
export function construirShp(
  puntos: readonly (readonly [number, number])[] = CUADRADO,
  tipo = 5,
): ArrayBuffer {
  // 4 del tipo + 32 de la caja + 4 de partes + 4 del numero de puntos
  // + 4 del indice de parte + 16 por punto.
  const contenido = 48 + puntos.length * 16;
  const buffer = new ArrayBuffer(100 + 8 + contenido);
  const vista = new DataView(buffer);

  // Cabecera: codigo y longitud total en palabras, en big-endian.
  vista.setInt32(0, 9994, false);
  vista.setInt32(24, buffer.byteLength / 2, false);
  // Version y tipo de forma, en little-endian.
  vista.setInt32(28, 1000, true);
  vista.setInt32(32, tipo, true);

  // Registro: numero y longitud del contenido, en big-endian.
  const inicio = 108;
  vista.setInt32(100, 1, false);
  vista.setInt32(104, contenido / 2, false);
  vista.setInt32(inicio, tipo, true);

  const xs = puntos.map(([x]) => x);
  const ys = puntos.map(([, y]) => y);
  vista.setFloat64(inicio + 4, Math.min(...xs), true);
  vista.setFloat64(inicio + 12, Math.min(...ys), true);
  vista.setFloat64(inicio + 20, Math.max(...xs), true);
  vista.setFloat64(inicio + 28, Math.max(...ys), true);
  vista.setInt32(inicio + 36, 1, true);
  vista.setInt32(inicio + 40, puntos.length, true);
  vista.setInt32(inicio + 44, 0, true);

  puntos.forEach(([x, y], indice) => {
    const base = inicio + 48 + indice * 16;
    vista.setFloat64(base, x, true);
    vista.setFloat64(base + 8, y, true);
  });

  return buffer;
}

/** Empaqueta un buffer en un zip almacenado, sin comprimir. */
export function construirZip(nombre: string, contenido: ArrayBuffer): ArrayBuffer {
  return construirZipMultiple([{ nombre, contenido }]);
}

/**
 * Empaqueta varias entradas en un zip almacenado, sin comprimir.
 *
 * Existe porque una capa de catastro llega siempre con su `.shp` y su `.prj`, y
 * el `.prj` es justamente lo que decide en qué sistema están las coordenadas: con
 * un zip de una sola entrada no se puede probar la lectura del datum.
 */
export function construirZipMultiple(
  entradas: readonly { readonly nombre: string; readonly contenido: ArrayBuffer }[],
): ArrayBuffer {
  const nombreBytes = entradas.map((entrada) => new TextEncoder().encode(entrada.nombre));
  const contenidoBytes = entradas.map((entrada) => new Uint8Array(entrada.contenido));
  const cabeceras = entradas.reduce(
    (total, _, indice) => total + 30 + nombreBytes[indice]!.length,
    0,
  );
  const datos = entradas.reduce((total, _, indice) => total + contenidoBytes[indice]!.length, 0);
  const directorio = entradas.reduce(
    (total, _, indice) => total + 46 + nombreBytes[indice]!.length,
    0,
  );

  const buffer = new ArrayBuffer(cabeceras + datos + directorio + 22);
  const vista = new DataView(buffer);
  const salida = new Uint8Array(buffer);

  // Cabecera local de cada entrada.
  const inicioLocal: number[] = [];
  let cursor = 0;
  entradas.forEach((_, indice) => {
    const nombre = nombreBytes[indice]!;
    const contenido = contenidoBytes[indice]!;
    inicioLocal.push(cursor);

    vista.setUint32(cursor, 0x04034b50, true);
    vista.setUint16(cursor + 4, 20, true);
    vista.setUint16(cursor + 8, 0, true);
    vista.setUint32(cursor + 18, contenido.length, true);
    vista.setUint32(cursor + 22, contenido.length, true);
    vista.setUint16(cursor + 26, nombre.length, true);
    salida.set(nombre, cursor + 30);
    salida.set(contenido, cursor + 30 + nombre.length);
    cursor += 30 + nombre.length + contenido.length;
  });

  // Directorio central.
  const central = cursor;
  entradas.forEach((_, indice) => {
    const nombre = nombreBytes[indice]!;
    const contenido = contenidoBytes[indice]!;

    vista.setUint32(cursor, 0x02014b50, true);
    vista.setUint16(cursor + 4, 20, true);
    vista.setUint16(cursor + 6, 20, true);
    vista.setUint16(cursor + 10, 0, true);
    vista.setUint32(cursor + 20, contenido.length, true);
    vista.setUint32(cursor + 24, contenido.length, true);
    vista.setUint16(cursor + 28, nombre.length, true);
    vista.setUint32(cursor + 42, inicioLocal[indice]!, true);
    salida.set(nombre, cursor + 46);
    cursor += 46 + nombre.length;
  });

  // Fin del directorio central.
  vista.setUint32(cursor, 0x06054b50, true);
  vista.setUint16(cursor + 8, entradas.length, true);
  vista.setUint16(cursor + 10, entradas.length, true);
  vista.setUint32(cursor + 12, cursor + 22 - central, true);
  vista.setUint32(cursor + 16, central, true);

  return buffer;
}
