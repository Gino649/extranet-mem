import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '2.3';

/** Tope duro de caracteres, impuesto también por el `maxlength` del textarea. */
const LIMITE_CARACTERES = 1000;

/**
 * Umbral desde el que el contador avisa que se acerca al tope.
 *
 * El enunciado pintaba el contador en rojo «al superar 1000», pero el mismo
 * marcado imponía `maxlength="1000"`: la condición era inalcanzable. El aviso
 * útil es el contrario, anticipar que quedan pocas teclas.
 */
const UMBRAL_AVISO = 900;

/**
 * Extensión mínima para considerar redactado un texto.
 *
 * Un objetivo de tres palabras no es revisable por el evaluatesor, así que
 * dar por válida una línea suelta declara conforme algo que nadie pudo leer.
 */
const MINIMO_CARACTERES = 30;

/**
 * Microcomponente de la sección 2.3 · Objetivos y Justificación.
 *
 * Los dos textos son la memoria técnica del proyecto: el evaluador contrasta
 * el objetivo contra la justificación, así que conviven en la misma pantalla
 * en lugar de repartirse en pasos.
 */
@Component({
  selector: 'app-objetivos',
  templateUrl: './objetivos.component.html',
  styleUrls: ['./objetivos.component.css'],
})
export class ObjetivosComponent {
  protected readonly store = inject(DaexStore);

  /** Tope duro, expuesto para el contador y los tests. */
  protected readonly limite = LIMITE_CARACTERES;

  /** Umbral de aviso del contador. */
  protected readonly umbralAviso = UMBRAL_AVISO;

  /** Extensión mínima para dar por redactado un campo. */
  protected readonly minimo = MINIMO_CARACTERES;

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta al apilar las fichas, de modo que el semáforo se
   * confirme contra la fila que corresponde en lugar de contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  protected readonly objetivos = signal<string>('');
  protected readonly justificacion = signal<string>('');

  /** Marca de confirmación, para acusar recibo del guardado sin abrir un toast. */
  protected readonly guardado = signal(false);

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /**
   * Validador de contenido.
   *
   * Exige que ambos campos tengan longitud redactada y que ninguno exceda el
   * tope. La cota superior es una defensa: el `maxlength` del textarea ya
   * impide superarla desde la interfaz, pero el texto puede llegar desde el
   * store o desde una pegada programática.
   */
  protected readonly formularioValido = computed(() => {
    const objetivos = this.objetivos().trim();
    const justificacion = this.justificacion().trim();

    return (
      objetivos.length >= MINIMO_CARACTERES &&
      justificacion.length >= MINIMO_CARACTERES &&
      objetivos.length <= LIMITE_CARACTERES &&
      justificacion.length <= LIMITE_CARACTERES
    );
  });

  /**
   * Restaura lo ya redactado al recuperar la ficha.
   *
   * El orquestador destruye las piezas al cambiar de capítulo, de modo que un
   * texto guardado solo en memoria se perdería al navegar y volver, mientras
   * el semáforo seguiría en verde: la sección conforme sin texto que lo
   * respalde. Se lee del store para que la conformidad y su contenidoternezcan
   * separados.
   */
  constructor() {
    const contexto = this.store.formulario();
    this.objetivos.set(contexto.objetivos ?? '');
    this.justificacion.set(contexto.justificacion ?? '');
  }

  protected alEscribirObjetivos(evento: Event): void {
    this.objetivos.set((evento.target as HTMLTextAreaElement).value);
    this.guardado.set(false);
  }

  protected alEscribirJustificacion(evento: Event): void {
    this.justificacion.set((evento.target as HTMLTextAreaElement).value);
    this.guardado.set(false);
  }

  /** Caracteres que quedan antes del tope duro. */
  protected restantes(texto: string): number {
    return LIMITE_CARACTERES - texto.length;
  }

  protected cercaDelTope(texto: string): boolean {
    return texto.length >= UMBRAL_AVISO && texto.length < LIMITE_CARACTERES;
  }

  protected enElTope(texto: string): boolean {
    return texto.length >= LIMITE_CARACTERES;
  }

  /**
   * Publica los textos y pasa la sección a verde.
   *
   * El semáforo solo se muta cuando la validación pasa, de modo que el ícono de
   * conformidad nunca se anticipe al contenido que lo respalda.
   */
  protected guardarYValidarSeccion(): void {
    if (!this.formularioValido()) {
      return;
    }

    this.store.actualizarFormulario({
      objetivos: this.objetivos().trim(),
      justificacion: this.justificacion().trim(),
    });
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.guardado.set(true);
  }
}
