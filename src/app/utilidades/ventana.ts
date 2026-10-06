/**
 * Anchos por debajo de los cuales el expediente se vuelve incómodo.
 *
 * Coincide con el punto en que el pie institucional pasa a dos líneas, de modo
 * que el umbral de plegado y el del pie describen la misma franja de pantalla.
 */
export const ANCHO_ESTRECHO_REMEDIO = '(max-width: 47.999rem)';

/**
 * Indica si la ventana es demasiado estrecha para el índice lateral abierto.
 *
 * Devuelve `false` cuando no hay forma de consultarlo —renderizado en servidor
 * o entornos de prueba sin `matchMedia`— porque el resultado por omisión debe
 * ser el estado normal de trabajo, con el índice visible, y no el plegado.
 */
export function esVentanaEstrecha(consulta = ANCHO_ESTRECHO_REMEDIO): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(consulta).matches
  );
}
