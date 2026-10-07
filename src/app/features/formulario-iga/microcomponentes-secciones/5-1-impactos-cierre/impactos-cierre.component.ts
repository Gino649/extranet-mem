import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompromisoAmbiental, DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '5.1';

/** Etapas ofrecidas en el selector del popup. */
const ETAPAS_DEL_PROYECTO = ['EXPLORACIÓN', 'CONSTRUCCIÓN', 'OPERACIÓN', 'CIERRE'] as const;

/** Borrador del popup: igual al compromiso pero con `id` opcional para el alta. */
type BorradorCompromiso = Omit<CompromisoAmbiental, 'id'> & { readonly id: string | null };

/** Borrador recién abierto, en blanco y sin identificador. */
function compromisoNuevo(): BorradorCompromiso {
  return {
    id: null,
    etapa: '',
    actividades: '',
    componenteFactor: '',
    aspectos: '',
    impactos: '',
    estrategiaManejo: '',
    plazoFrecuencia: '',
    presupuesto: 0,
  };
}

/** Borrador cargado desde un compromiso existente. */
function compromisoDe(fila: CompromisoAmbiental): BorradorCompromiso {
  return { ...fila };
}

/**
 * Contador de identificadores.
 *
 * Se usa un número y no `Date.now()` porque las filas se borran y se vuelven a
 * añadir: con el contador la fila nueva queda al final y `track` no reutiliza
 * el DOM de la que se acaba de eliminar.
 */
let secuencia = 0;

/** Identificador único de fila. */
function nuevoId(): string {
  secuencia += 1;
  return `IMP-${secuencia}`;
}

/**
 * Microcomponente de la sección 5.1 · Impactos ambientales, estrategias de
 * manejo y cierre.
 *
 * La matriz es de solo lectura en pantalla y todo el flujo CRUD ocurre en el
 * popup centralizado: prohibido editar en línea, porque una fila a medio teclear
 * no es un dato declarable. La grilla solo refleja el estado guardado.
 *
 * Los compromisos se publican al store al validar porque el orquestador
 * destruye los microcomponentes al cambiar de capítulo: un signal local perdería
 * lo que el titular acaba de teclear.
 */
@Component({
  selector: 'app-impactos-cierre',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './impactos-cierre.component.html',
  styleUrls: ['./impactos-cierre.component.css'],
})
export class ImpactosCierreComponent {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Etapas ofrecidas en el selector del popup. */
  protected readonly etapas = ETAPAS_DEL_PROYECTO;

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  private readonly estadoCompromisos = signal<readonly CompromisoAmbiental[]>([]);

  /** Compromisos declarados, en el orden en que se grabaron. */
  protected readonly compromisos = this.estadoCompromisos.asReadonly();

  /** Presupuesto total de la matriz, para el pie de la grilla. */
  protected readonly presupuestoTotal = computed(() =>
    this.estadoCompromisos().reduce((total, fila) => total + fila.presupuesto, 0),
  );

  /* ------------------------------------------------------------------
     MODAL DE ESTRATEGIA DE MANEJO Y CIERRE
     ------------------------------------------------------------------ */

  private readonly borrador = signal<BorradorCompromiso | null>(null);

  /** El modal está abierto si hay un borrador cargado. */
  protected readonly modalAbierto = computed(() => this.borrador() !== null);

  /** Borrador en edición, para la plantilla del popup. */
  protected readonly modalData = computed(() => this.borrador());

  /** Titular del modal: cambia entre alta y edición según haya `id`. */
  protected readonly modalEsEdicion = computed(() => this.borrador()?.id != null);

  /**
   * Si el popup tiene lo mínimo para grabarse.
   *
   * Se lee del signal del borrador, y no de un objeto plano, para que el botón
   * se habilite en cuanto se teclea: un `computed` sobre un objeto mutable no
   * tiene de dónde enterarse.
   */
  protected readonly modalDataValido = computed(() => {
    const borrador = this.borrador();
    if (!borrador) {
      return false;
    }
    return (
      borrador.etapa.trim() !== '' &&
      borrador.actividades.trim() !== '' &&
      borrador.componenteFactor.trim() !== '' &&
      borrador.aspectos.trim() !== '' &&
      borrador.impactos.trim() !== '' &&
      borrador.estrategiaManejo.trim() !== '' &&
      borrador.plazoFrecuencia.trim() !== '' &&
      borrador.presupuesto > 0
    );
  });

  /** Una matriz con compromisos completos es la que se puede validar. */
  protected readonly matrizValida = computed(() => this.estadoCompromisos().length > 0);

  /* ------------------------------------------------------------------
     REHIDRATACIÓN
     ------------------------------------------------------------------ */

  constructor() {
    effect(() => {
      const guardados = this.store.compromisosAmbientalesRegistrada();
      if (guardados.length === 0) {
        return;
      }
      this.estadoCompromisos.set(guardados);
    });
  }

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP (CRUD)
     ------------------------------------------------------------------ */

  /** Abre el modal en modo alta, o en modo edición si se le pasa una fila. */
  protected abrirModalImpacto(item: CompromisoAmbiental | null): void {
    this.borrador.set(item ? compromisoDe(item) : compromisoNuevo());
  }

  /** Cierra el popup sin guardar: lo tecleado en el borrador se descarta. */
  protected cerrarModalImpacto(): void {
    this.borrador.set(null);
  }

  /** Edita un campo de texto del borrador, reemplazándolo de forma inmutable. */
  protected editarBorrador(
    campo:
      | 'etapa'
      | 'actividades'
      | 'componenteFactor'
      | 'aspectos'
      | 'impactos'
      | 'estrategiaManejo'
      | 'plazoFrecuencia',
    valor: string | Event,
  ): void {
    const texto =
      typeof valor === 'string'
        ? valor
        : (valor.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.borrador.update((borrador) => (borrador ? { ...borrador, [campo]: texto } : null));
  }

  /** Elige la etapa del proyecto en el selector del popup. */
  protected alElegirEtapa(valor: string): void {
    this.borrador.update((borrador) => (borrador ? { ...borrador, etapa: valor } : null));
  }

  /** Edita el presupuesto, distinguiendo un campo vacío (0) de un valor tecleado. */
  protected editarPresupuesto(valor: string | Event): void {
    const texto = typeof valor === 'string' ? valor : (valor.target as HTMLInputElement).value;
    const numero = Number.parseFloat(texto);
    this.borrador.update((borrador) =>
      borrador ? { ...borrador, presupuesto: Number.isFinite(numero) ? numero : 0 } : null,
    );
  }

  /**
   * Transaccional del modal: graba el borrador o lo descarta.
   *
   * En modo alta asigna un identificador nuevo; en modo edición conserva el de
   * la fila para que el `@for` empareje el DOM con el mismo nodo. Un `id`
   * distinto en cada guardado sacaría la fila de su sitio al recuperar la
   * sección.
   */
  protected procesarGuardadoImpactoModal(): void {
    const borrador = this.borrador();
    if (!borrador || !this.modalDataValido()) {
      return;
    }
    const grabado: CompromisoAmbiental =
      borrador.id !== null ? { ...borrador, id: borrador.id } : { ...borrador, id: nuevoId() };
    this.estadoCompromisos.update((actual) =>
      borrador.id !== null
        ? actual.map((fila) => (fila.id === borrador.id ? grabado : fila))
        : [...actual, grabado],
    );
    this.borrador.set(null);
  }

  /** Elimina un compromiso de la matriz por su identificador. */
  protected removerCompromiso(id: string): void {
    this.estadoCompromisos.update((actual) => actual.filter((fila) => fila.id !== id));
  }

  /**
   * Publica la matriz completa y pasa la sección a verde.
   *
   * El semáforo solo se muta cuando hay al menos un compromiso declarado y
   * completo, de modo que la conformidad nunca se anticipe a la matriz que la
   * respalda.
   */
  protected guardarYValidarImpactosSeccion(): void {
    if (!this.matrizValida()) {
      return;
    }
    this.store.registrarCompromisosAmbientales(this.estadoCompromisos());
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
  }
}
