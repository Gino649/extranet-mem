import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '4.1';

/** Fase legal en que se ejecutan los mecanismos obligatorios del estudio. */
const FASE_ANTES_PRESENTACION = 'ANTES DE LA PRESENTACIÓN DE ESTUDIO';

/** Mecanismo de participación declarado en la grilla, editado solo en el popup. */
interface MecanismoParticipacion {
  readonly id: number;
  readonly mecanismoNombre: string;
  readonly secuenciaFase: string;
  readonly descripcion: string;
  readonly numParticipantes: number;
  readonly completado: boolean;
}

/**
 * Los dos mecanismos que la norma exige para este tipo de estudio. La grilla
 * arranca con ellos presentes y pendientes para que el titular los complete.
 */
const MECANISMOS_INICIALES: readonly MecanismoParticipacion[] = [
  {
    id: 1,
    mecanismoNombre: 'Acceso de la población a Resúmenes Ejecutivos y contenido del texto completo',
    secuenciaFase: FASE_ANTES_PRESENTACION,
    descripcion: '',
    numParticipantes: 0,
    completado: false,
  },
  {
    id: 2,
    mecanismoNombre: 'Talleres Informativos y Participativos',
    secuenciaFase: FASE_ANTES_PRESENTACION,
    descripcion: '',
    numParticipantes: 0,
    completado: false,
  },
];

/**
 * Microcomponente de la sección 4.1 · Plan de Participación Ciudadana.
 *
 * Sigue el principio de formulario limpio: la grilla en pantalla es de solo
 * lectura y toda la edición ocurre dentro del popup que abre el botón de cada
 * fila. La tabla solo refleja el estado guardado, de modo que titulares y
 * evaluadores ven siempre una vista estable y no un formulario a medio teclear.
 *
 * La sección 4.2 (adjuntar documentos) la atiende el microcomponente común de
 * adjuntos, así que esta pieza declara únicamente la grilla de mecanismos y sus
 * resultados.
 */
@Component({
  selector: 'app-participacion-ciudadana',
  templateUrl: './participacion-ciudadana.component.html',
  styleUrls: ['./participacion-ciudadana.component.css'],
})
export class ParticipacionCiudadanaComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta en `inputs` al usar `ngComponentOutlet`, así que
   * el semáforo se confirma contra la fila correcta del árbol en lugar de
   * contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** Estado declarado de la grilla de mecanismos. */
  private readonly lista = signal<readonly MecanismoParticipacion[]>(MECANISMOS_INICIALES);

  protected readonly mecanismos = this.lista.asReadonly();

  /** Mecanismo que está abierto en el popup de edición; `null` si no hay popup. */
  protected readonly mecanismoEditando = signal<MecanismoParticipacion | null>(null);

  /** Borrador del mecanismo en edición, para no mutar la grilla en vivo. */
  protected readonly borrador = signal<MecanismoParticipacion | null>(null);

  /** Total de participantes declarados en la grilla, para el resumen del bloque. */
  protected readonly totalParticipantes = computed(() =>
    this.lista().reduce((total, mecanismo) => total + mecanismo.numParticipantes, 0),
  );

  /** La grilla queda conforme cuando todos los mecanismos obligatorios están completados. */
  protected readonly grillaConforme = computed(() =>
    this.lista().every((mecanismo) => mecanismo.completado),
  );

  /**
   * Abre el popup de edición con una copia del mecanismo.
   *
   * Se copia el objeto para que el titular escriba sobre un borrador: hasta que
   * no pulse «Guardar», la grilla sigue mostrando el estado anterior.
   */
  protected abrirModalMecanismo(mec: MecanismoParticipacion): void {
    this.borrador.set({ ...mec });
    this.mecanismoEditando.set({ ...mec });
  }

  /** Descarta el borrador y cierra el popup sin tocar la grilla. */
  protected cerrarModalMecanismo(): void {
    this.borrador.set(null);
    this.mecanismoEditando.set(null);
  }

  /** Aplica un campo del popup al borrador, conservando el resto. */
  protected actualizarBorrador(
    campo: keyof MecanismoParticipacion,
    valor: string | number | boolean,
  ): void {
    this.borrador.update((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  }

  /** Publica el borrador en la grilla de solo lectura y cierra el popup. */
  protected guardarMecanismo(): void {
    const borrador = this.borrador();
    if (!borrador) {
      return;
    }
    this.lista.update((actual) => actual.map((mec) => (mec.id === borrador.id ? borrador : mec)));
    if (this.grillaConforme()) {
      this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    }
    this.cerrarModalMecanismo();
  }

  /** Convierte el texto de un campo numérico a entero no negativo. */
  protected aNumeroDe(texto: string): number {
    const valor = Number.parseInt(texto, 10);
    return Number.isFinite(valor) ? Math.max(0, valor) : 0;
  }
}
