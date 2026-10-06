import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DaexStore,
  ETAPAS_BASE_CRONOGRAMA,
  type DotacionEtapa,
  type OrigenManoObra,
} from '../../../../state/daex.store';

/**
 * Datos que el titular declara para una etapa del cronograma.
 *
 * El nombre de la etapa no se guarda aquí a propósito: la fila precargada es
 * inmutable en identificador y nombre, porque son cosa del cronograma de la 2.6
 * y no de esta sección. Editarlos aquí dejaría dos verdades sobre cómo se llama
 * una etapa.
 */
interface AjusteEtapa {
  readonly cantidad: number | null;
  readonly origen: OrigenManoObra | '';
  readonly especializacion: string;
}

/** Relleno de una fila todavía sin configurar. */
function ajusteVacio(): AjusteEtapa {
  return { cantidad: null, origen: '', especializacion: '' };
}

/**
 * Convierte lo que llega del `input` numérico en número, o en `null` si está vacío.
 *
 * Un campo vacío es `null` y no `0`: el formulario distingue "sin llenar" de
 * "cero tecleado", y una etapa sin dotación declarada se muestra como pendiente
 * en la grilla, no como una etapa con cero operarios.
 */
function aNumeroONulo(entrada: string | number): number | null {
  if (typeof entrada === 'string' && entrada.trim() === '') {
    return null;
  }
  const valor = Number.parseFloat(String(entrada));
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Microcomponente de la sección 2.10 · Personal Requerido.
 *
 * La grilla no se crea ni se borra: sus filas son las etapas del cronograma de
 * la 2.6, precargadas e inmutables en identificador y nombre. Lo único que el
 * titular declara es la dotación de cada etapa, y eso se edita en el popup.
 *
 * La fila se ancla al identificador de la etapa y no a su posición, de modo que
 * reordenar o renombrar etapas en la 2.6 no desplaza una dotación hacia otra
 * etapa: si el titular agrega una etapa al cronograma, aquí aparece sola como
 * pendiente, y si la quita, su dotación deja de mostrarse sin tocar las demás.
 */
@Component({
  selector: 'app-personal',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './personal.component.html',
  styleUrls: ['./personal.component.css'],
})
export class PersonalComponent {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>('2.10');

  /**
   * Ajustes declarados por etapa, en un mapa en vez de una lista.
   *
   * Solo se guarda lo que el titular tecleó. Las filas de la grilla se arma
   * combining estas dotaciones con las etapas vigentes del cronograma, así que
   * una etapa nueva aparece sin tener que precargar nada y una etapa borrada
   * deja de existir en la grilla sin dejar un rastro huérfano.
   */
  private readonly ajustes = signal<ReadonlyMap<string, AjusteEtapa>>(new Map());

  /** Etapas vigentes: las del cronograma validado, o las base si aún no hay. */
  private readonly etapasVigentes = computed(() => {
    const registradas = this.store.cronogramaRegistrado();
    // Sin cronograma validado se recurre a las etapas base: el capítulo II las
    // declara obligatorias y la sección tiene que poder completarse antes de que
    // el titular cierre el Gantt.
    return registradas.length > 0 ? registradas : ETAPAS_BASE_CRONOGRAMA;
  });

  /** Cuadro de personal, una fila por etapa vigente. */
  protected readonly personalEtapas = computed<readonly DotacionEtapa[]>(() => {
    const ajustes = this.ajustes();
    return this.etapasVigentes().map((etapa) => {
      const ajuste = ajustes.get(etapa.id) ?? ajusteVacio();
      return {
        etapaId: etapa.id,
        etapaNombre: etapa.nombre,
        cantidad: ajuste.cantidad,
        origen: ajuste.origen,
        especializacion: ajuste.especializacion,
      };
    });
  });

  /** Aviso de la última acción, o `null` si la última acción no dijo nada. */
  protected readonly mensaje = signal<string | null>(null);

  /* ------------------------------------------------------------------
     MODAL DE DOTACIÓN
     ------------------------------------------------------------------ */

  private readonly borrador = signal<DotacionEtapa | null>(null);

  /** El modal está abierto si hay un borrador cargado. */
  protected readonly modalAbierto = computed(() => this.borrador() !== null);

  /** Borrador en edición, para el `[ngModel]` del formulario. */
  protected readonly modalData = computed(() => this.borrador());

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
      borrador.cantidad !== null &&
      borrador.cantidad > 0 &&
      borrador.origen !== '' &&
      borrador.especializacion.trim() !== ''
    );
  });

  /** Motivo por el que el botón de grabar está deshabilitado, o `null`. */
  protected readonly bloqueoModal = computed<string | null>(() => {
    const borrador = this.borrador();
    if (!borrador) {
      return null;
    }
    if (borrador.cantidad === null || borrador.cantidad <= 0) {
      return 'Indique el número de operarios, mayor que cero.';
    }
    if (borrador.origen === '') {
      return 'Elija el origen de la mano de obra.';
    }
    if (borrador.especializacion.trim() === '') {
      return 'Describa la especialización o el perfil del personal.';
    }
    return null;
  });

  /* ------------------------------------------------------------------
     REHIDRATACIÓN
     ------------------------------------------------------------------ */

  /**
   * Recupera la dotación ya validada.
   *
   * Se aplica sobre el mapa de ajustes y no sobre una lista de filas para que la
   * rehidratación no pueda pisar lo que el titular está tecleando en otra fila:
   * cada ajuste entra por su etapa, y las etapas que el cronograma ya no tiene
   * simplemente no se muestran.
   */
  constructor() {
    effect(() => {
      const guardadas = this.store.dotacionPersonalRegistrada();
      if (guardadas.length === 0) {
        return;
      }
      const mapa = new Map<string, AjusteEtapa>();
      for (const fila of guardadas) {
        mapa.set(fila.etapaId, {
          cantidad: fila.cantidad,
          origen: fila.origen,
          especializacion: fila.especializacion,
        });
      }
      this.ajustes.set(mapa);
    });
  }

  @HostListener('document:keydown.escape')
  protected alPulsarEscape(): void {
    this.cerrarModalPersonal();
  }

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP (CRUD)
     ------------------------------------------------------------------ */

  /** Abre el modal con la etapa a configurar ya cargada. */
  protected abrirModalPersonal(item: DotacionEtapa): void {
    this.borrador.set({ ...item });
  }

  /** Cierra el popup sin guardar: lo tecleado en el borrador se descarta. */
  protected cerrarModalPersonal(): void {
    this.borrador.set(null);
  }

  /** Edita la cantidad de operarios, distinguiendo vacío de cero. */
  protected editarCantidad(valor: string | number): void {
    this.borrador.update((borrador) =>
      borrador ? { ...borrador, cantidad: aNumeroONulo(valor) } : null,
    );
  }

  /** Edita la especialización o el perfil del personal. */
  protected editarEspecializacion(valor: string): void {
    this.borrador.update((borrador) => (borrador ? { ...borrador, especializacion: valor } : null));
  }

  /** Elige el origen de la mano de obra. */
  protected alElegirOrigen(evento: Event): void {
    const origen = (evento.target as HTMLSelectElement).value as OrigenManoObra | '';
    this.borrador.update((borrador) => (borrador ? { ...borrador, origen } : null));
  }

  /**
   * Transaccional del modal: graba la dotación o la descarta.
   *
   * Es el único camino de declaración, así que una etapa queda configurada
   * completa o sigue pendiente: si el titular cierra el popup a medio rellenar, la
   * fila conserva lo que tenía.
   */
  protected procesarGuardadoPersonalModal(): void {
    const borrador = this.borrador();
    if (!borrador || !this.modalDataValido()) {
      return;
    }

    const etapaId = borrador.etapaId;
    const ajuste: AjusteEtapa = {
      cantidad: borrador.cantidad,
      origen: borrador.origen as OrigenManoObra,
      especializacion: borrador.especializacion.trim(),
    };
    // Se copia el mapa en vez de mutarlo: el `computed` de la grilla compara por
    // identidad, y mutar el `Map` en su sitio no le avisaría del cambio.
    this.ajustes.update((mapa) => new Map(mapa).set(etapaId, ajuste));

    this.mensaje.set(`Dotación de «${borrador.etapaNombre}» registrada.`);
    this.cerrarModalPersonal();
  }

  /* ------------------------------------------------------------------
     VALIDACIÓN DE LA SECCIÓN
     ------------------------------------------------------------------ */

  /**
   * Motivo por el que la sección no puede validarse, o `null` si está lista.
   *
   * No se apoya en `every`: sobre una lista vacía `every` devuelve `true`, así
   * que sin la guarda del `length` el botón se habilitaría sin declarar ninguna
   * dotación, justo lo que la norma no admite.
   */
  protected readonly bloqueo = computed<string | null>(() => {
    const filas = this.personalEtapas();
    if (filas.length === 0) {
      return 'El cronograma del capítulo II no tiene etapas a las que dotar.';
    }

    const pendientes = filas.filter(
      (fila) =>
        fila.cantidad === null ||
        fila.cantidad <= 0 ||
        fila.origen === '' ||
        fila.especializacion.trim() === '',
    );
    // El conteo va siempre en el mensaje, incluso cuando no hay ninguna etapa
    // configurada: un "falta configurar N de N" dice de entrada cuánto trabajo
    // queda, mientras que un "falta configurar todas" no dice cuánto.
    if (pendientes.length === 0) {
      return null;
    }
    return `Falta configurar ${pendientes.length} de ${filas.length} etapas del cronograma.`;
  });

  /** Si todas las etapas del cronograma ya tienen dotación declarada. */
  protected readonly seccionTotalmenteCompletada = computed(() => this.bloqueo() === null);

  /** Operarios declarados en todas las etapas, para el resumen de la cabecera. */
  protected readonly totalOperarios = computed(() =>
    this.personalEtapas().reduce((suma, fila) => suma + (fila.cantidad ?? 0), 0),
  );

  /** Etapas ya configuradas, para el resumen de la cabecera. */
  protected readonly etapasCompletadas = computed(() => {
    const filas = this.personalEtapas();
    return filas.filter(
      (fila) =>
        fila.cantidad !== null &&
        fila.cantidad > 0 &&
        fila.origen !== '' &&
        fila.especializacion.trim() !== '',
    ).length;
  });

  /**
   * Publica la dotación y pone la sección en verde.
   *
   * Publica al store y no solo al semáforo porque el titular puede volver al
   * capítulo 2 más tarde: la dotación tiene que seguir ahí, y el store es lo
   * único que sobrevive a que el orquestador destruya este componente.
   */
  protected guardarYValidarPersonalSeccion(): void {
    const bloqueo = this.bloqueo();
    if (bloqueo) {
      this.mensaje.set(bloqueo);
      return;
    }
    this.store.registrarDotacionPersonal(this.personalEtapas());
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.mensaje.set('Dotación de personal validada.');
  }
}
