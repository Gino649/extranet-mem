import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DaexStore,
  type FuenteAbastecimientoAgua,
  type ZonaUTM,
} from '../../../../state/daex.store';

/**
 * Borrador del formulario del modal.
 *
 * Vive aparte de la colección y con `null` en los numéricos: en un formulario
 * "en blanco" no es lo mismo un 0 tecleado que un campo sin llenar, y el punto
 * no se graba hasta que trae caudal, días y coordenada. Al grabar, el borrador
 * se convierte a los números de `FuenteAbastecimientoAgua`.
 */
interface BorradorPuntoAgua {
  readonly id: string | null;
  readonly fase: string;
  readonly etapa: string;
  readonly cantidadDia: number | null;
  readonly numDias: number | null;
  readonly fuente: string;
  readonly este: number | null;
  readonly norte: number | null;
  readonly zona: ZonaUTM;
}

/** Zonas UTM que atraviesan el territorio continental peruano. */
const ZONAS: readonly ZonaUTM[] = ['17S', '18S', '19S'];

/**
 * Zona por defecto.
 *
 * El expediente trabaja en 18S, que es la que declara el store para el vértice
 * del área efectiva y la que lleva el cursor al abrir el popup.
 */
const ZONA_POR_DEFECTO: ZonaUTM = '18S';

/** Punto recién creado, en blanco y sin coordenada. */
function puntoAguaNuevo(): BorradorPuntoAgua {
  return {
    id: null,
    fase: '',
    etapa: '',
    cantidadDia: null,
    numDias: null,
    fuente: '',
    este: null,
    norte: null,
    zona: ZONA_POR_DEFECTO,
  };
}

/** Borrador cargado desde un punto existente. */
function puntoAguaDe(fila: FuenteAbastecimientoAgua): BorradorPuntoAgua {
  return {
    id: fila.id,
    fase: fila.fase,
    etapa: fila.etapa,
    cantidadDia: fila.cantidadDia,
    numDias: fila.numDias,
    fuente: fila.fuente,
    este: fila.este,
    norte: fila.norte,
    zona: fila.zona,
  };
}

/**
 * Convierte lo que llega del `input` numérico en número, o en `null` si está vacío.
 *
 * Un campo vacío es `null` y no `0`: el formulario distingue "sin llenar" de
 * "cero tecleado", y no se graba un punto sin caudal ni sin coordenada. La
 * comprobación de vacío va antes del `parseFloat` porque `Number.parseFloat('')`
 * devuelve `NaN`, y ese `NaN` llegaría hasta la tabla disfrazado de cero.
 */
function aNumeroONulo(entrada: string | number): number | null {
  if (typeof entrada === 'string' && entrada.trim() === '') {
    return null;
  }
  const valor = Number.parseFloat(String(entrada));
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Primer punto duplicado del balance, o `null` si no hay ninguno.
 *
 * Dos filas con la misma fase, etapa y fuente son la misma declaración escrita
 * dos veces: al sumar el total contando las dos, la demanda se infla y el
 * Evaluador no tiene forma de saber cuál de las dos es la buena. La comparación
 * es la misma que aplica el popup al grabar, así que el aviso no cambia entre el
 * momento de teclear y el de validar.
 */
function puntoRepetido(
  puntos: readonly FuenteAbastecimientoAgua[],
): FuenteAbastecimientoAgua | null {
  const vistos = new Map<string, FuenteAbastecimientoAgua>();
  for (const punto of puntos) {
    const clave = `${punto.fase} ${punto.etapa} ${punto.fuente}`.trim().toUpperCase();
    const anterior = vistos.get(clave);
    if (anterior) {
      return anterior;
    }
    vistos.set(clave, punto);
  }
  return null;
}

/**
 * Contador de identificadores.
 *
 * Se usa un número y no `Date.now()` porque las filas se borran y se vuelven a
 * añadir: con el contador la fila nueva queda al final, y `track` no reutiliza el
 * DOM de la que se acaba de eliminar. Además dos altas en el mismo milisegundo
 * colisionarían el identificador, y la edición alcanzaría a la fila equivocada.
 */
let secuencia = 0;

/** Identificador único de fila. */
function nuevoId(prefijo: string): string {
  secuencia += 1;
  return `${prefijo}-${secuencia}`;
}

/**
 * Microcomponente de la sección 2.8 · Demanda de Agua.
 *
 * La tabla es la única vista del balance hídrico, y cada fila se registra y se
 * edita en un popup: la grilla no lleva inputs en línea porque una fila a medio
 * teclear no es un dato declarable, y el total de la fila se deriva al leer en
 * lugar de guardarse.
 *
 * Los puntos viven aquí y se publican al store al validar, porque el orquestador
 * destruye los microcomponentes al cambiar de capítulo: un signal local perdería
 * lo que el titular acaba de teclear.
 */
@Component({
  selector: 'app-demanda-agua',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './demanda-agua.component.html',
  styleUrls: ['./demanda-agua.component.css'],
})
export class DemandaAguaComponent {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>('2.8');

  /** Zonas ofrecidas en el selector del popup. */
  protected readonly zonas = ZONAS;

  private readonly estadoPuntos = signal<readonly FuenteAbastecimientoAgua[]>([]);

  /** Puntos de abastecimiento declarados, en el orden en que se grabaron. */
  protected readonly fuentesAgua = this.estadoPuntos.asReadonly();

  /** Aviso de la última acción, o `null` si la última acción no dijo nada. */
  protected readonly mensaje = signal<string | null>(null);

  /* ------------------------------------------------------------------
     MODAL DE PUNTO DE ABASTECIMIENTO
     ------------------------------------------------------------------ */

  private readonly borrador = signal<BorradorPuntoAgua | null>(null);

  /** El modal está abierto si hay un borrador cargado. */
  protected readonly modalAbierto = computed(() => this.borrador() !== null);

  /** Borrador en edición, para el `[ngModel]` del formulario. */
  protected readonly modalData = computed(() => this.borrador());

  /**
   * Titular del modal: cambia entre alta y edición.
   *
   * Se compara contra `null` y no con `!== null` a secas: sin borrador el
   * encadenamiento opcional devuelve `undefined`, que también sería distinto de
   * `null` y dejaría el modal rotulado como edición.
   */
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
      borrador.fase.trim() !== '' &&
      borrador.etapa.trim() !== '' &&
      borrador.cantidadDia !== null &&
      borrador.cantidadDia > 0 &&
      borrador.numDias !== null &&
      borrador.numDias > 0 &&
      borrador.fuente.trim() !== '' &&
      borrador.este !== null &&
      borrador.este > 0 &&
      borrador.norte !== null &&
      borrador.norte > 0
    );
  });

  /** Motivo por el que el botón de grabar está deshabilitado, o `null`. */
  protected readonly bloqueoModal = computed<string | null>(() => {
    const borrador = this.borrador();
    if (!borrador) {
      return null;
    }
    if (borrador.fase.trim() === '') {
      return 'Indique la fase del proyecto que demanda el agua.';
    }
    if (borrador.etapa.trim() === '') {
      return 'Indique la etapa de la fase.';
    }
    if (borrador.cantidadDia === null || borrador.cantidadDia <= 0) {
      return 'Indique el caudal diario requerido, mayor que cero.';
    }
    if (borrador.numDias === null || borrador.numDias <= 0) {
      return 'Indique el número de días de consumo, mayor que cero.';
    }
    if (borrador.fuente.trim() === '') {
      return 'Indique la fuente de abastecimiento.';
    }
    if (borrador.este === null || borrador.norte === null) {
      return 'Indique la coordenada UTM (Este y Norte) del punto de captación.';
    }
    if (borrador.este <= 0 || borrador.norte <= 0) {
      return 'La coordenada UTM debe ser mayor que cero.';
    }
    return null;
  });

  /** Total del borrador, para el eco del popup mientras se teclea. */
  protected readonly totalModal = computed(() => {
    const borrador = this.borrador();
    if (!borrador) {
      return 0;
    }
    return (borrador.cantidadDia ?? 0) * (borrador.numDias ?? 0);
  });

  /** Suma de toda la demanda declarada, en m³. */
  protected readonly totalDemanda = computed(() =>
    this.fuentesAgua().reduce((suma, fila) => suma + fila.cantidadDia * fila.numDias, 0),
  );

  /* ------------------------------------------------------------------
     REHIDRATACIÓN
     ------------------------------------------------------------------ */

  /**
   * Recupera los puntos ya validados.
   *
   * Los identificadores los conserva el store: el `@for` empareja cada fila con
   * su nodo por `id`, así que un identificador distinto en cada guardado sacaría
   * el DOM de una fila del sitio al recuperar la sección.
   */
  constructor() {
    effect(() => {
      const guardados = this.store.demandaAguaRegistrada();
      if (guardados.length === 0) {
        return;
      }
      this.estadoPuntos.set(guardados);
    });
  }

  @HostListener('document:keydown.escape')
  protected alPulsarEscape(): void {
    this.cerrarModalDemanda();
  }

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP (CRUD)
     ------------------------------------------------------------------ */

  /** Abre el modal en modo alta, o en modo edición si se le pasa una fila. */
  protected abrirModalDemanda(item: FuenteAbastecimientoAgua | null): void {
    this.borrador.set(item ? puntoAguaDe(item) : puntoAguaNuevo());
  }

  /** Cierra el popup sin guardar: lo tecleado en el borrador se descarta. */
  protected cerrarModalDemanda(): void {
    this.borrador.set(null);
  }

  /**
   * Edita un campo de texto del borrador.
   *
   * El borrador se reemplaza entero en lugar de mutarse: el `[ngModel]` de la
   * plantilla está atado a este signal, y reescribir el objeto en su sitio no
   * dispararía ni el `computed` de validez ni el botón de grabar.
   */
  protected editarBorrador(campo: 'fase' | 'etapa' | 'fuente', valor: string): void {
    this.borrador.update((borrador) => (borrador ? { ...borrador, [campo]: valor } : null));
  }

  /** Edita un campo numérico del borrador, distinguiendo vacío de cero. */
  protected editarBorradorNumero(
    campo: 'cantidadDia' | 'numDias' | 'este' | 'norte',
    valor: string | number,
  ): void {
    this.borrador.update((borrador) =>
      borrador ? { ...borrador, [campo]: aNumeroONulo(valor) } : null,
    );
  }

  /** Elige la zona UTM del punto de captación. */
  protected alElegirZona(evento: Event): void {
    const zona = (evento.target as HTMLSelectElement).value as ZonaUTM;
    this.borrador.update((borrador) => (borrador ? { ...borrador, zona } : null));
  }

  /**
   * Transaccional del modal: graba el borrador o lo descarta.
   *
   * Es el único camino de alta y de edición, así que una fila entra completa o
   * no entra: si el titular cierra el popup a medio rellenar, el inventario
   * queda como estaba.
   */
  protected procesarGuardadoDemandaModal(): void {
    const borrador = this.borrador();
    if (!borrador || !this.modalDataValido()) {
      return;
    }

    // El `!` de la vista previa es seguro: `modalDataValido()` ya comprobó que
    // los cuatro numéricos vienen nulos o positivos.
    const campos = {
      fase: borrador.fase.trim(),
      etapa: borrador.etapa.trim(),
      cantidadDia: borrador.cantidadDia!,
      numDias: borrador.numDias!,
      fuente: borrador.fuente.trim(),
      este: borrador.este!,
      norte: borrador.norte!,
      zona: borrador.zona,
    };

    if (borrador.id !== null) {
      const id = borrador.id;
      this.estadoPuntos.update((lista) =>
        lista.map((fila) => (fila.id === id ? { id, ...campos } : fila)),
      );
      this.mensaje.set(`Punto «${campos.fase} / ${campos.etapa}» actualizado.`);
    } else {
      const nueva: FuenteAbastecimientoAgua = { id: nuevoId('agua'), ...campos };
      this.estadoPuntos.update((lista) => [...lista, nueva]);
      this.mensaje.set(`Punto «${campos.fase} / ${campos.etapa}» registrado.`);
    }

    this.cerrarModalDemanda();
  }

  /** Quita un punto del inventario. */
  protected removerPuntoDemanda(id: string): void {
    const fila = this.fuentesAgua().find((punto) => punto.id === id);
    this.estadoPuntos.update((lista) => lista.filter((punto) => punto.id !== id));
    this.mensaje.set(fila ? `Punto «${fila.fase} / ${fila.etapa}» eliminado.` : 'Punto eliminado.');
  }

  /* ------------------------------------------------------------------
     VALIDACIÓN DE LA SECCIÓN
     ------------------------------------------------------------------ */

  /**
   * Motivo por el que la sección no puede validarse, o `null` si está lista.
   *
   * El `length` se comprueba antes que el `every`: sobre una lista vacía
   * `every` devuelve `true`, así que sin esta guarda el botón se habilitaría sin
   * declarar ni un punto, justo lo que la norma no admite.
   */
  protected readonly bloqueo = computed<string | null>(() => {
    const puntos = this.fuentesAgua();
    if (puntos.length === 0) {
      return 'Declare al menos un (1) punto de abastecimiento de agua.';
    }
    if (puntos.some((fila) => fila.fase.trim() === '' || fila.etapa.trim() === '')) {
      return 'Todos los puntos necesitan fase y etapa.';
    }
    if (puntos.some((fila) => fila.fuente.trim() === '')) {
      return 'Todos los puntos necesitan su fuente de abastecimiento.';
    }
    if (puntos.some((fila) => fila.cantidadDia <= 0)) {
      return 'El caudal diario de cada punto debe ser mayor que cero.';
    }
    if (puntos.some((fila) => fila.numDias <= 0)) {
      return 'El número de días de cada punto debe ser mayor que cero.';
    }
    if (puntos.some((fila) => fila.este <= 0 || fila.norte <= 0)) {
      return 'Todos los puntos necesitan su coordenada UTM (Este y Norte).';
    }
    const repetido = puntoRepetido(puntos);
    if (repetido !== null) {
      return `El punto «${repetido.fase} / ${repetido.etapa}» de ${repetido.fuente} está repetido.`;
    }
    return null;
  });

  /** Si el balance hídrico tiene lo mínimo para publicarse. */
  protected readonly grillaValida = computed(() => this.bloqueo() === null);

  /**
   * Publica el balance y pone la sección en verde.
   *
   * Publica al store y no solo al semáforo porque el titular puede volver al
   * capítulo 2 más tarde: los puntos tienen que seguir ahí, y el store es lo
   * único que sobrevive a que el orquestador destruya este componente.
   */
  protected guardarYValidarDemandaSeccion(): void {
    const bloqueo = this.bloqueo();
    if (bloqueo) {
      this.mensaje.set(bloqueo);
      return;
    }
    this.store.registrarDemandaAgua(this.fuentesAgua());
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.mensaje.set('Demanda de agua validada.');
  }
}
