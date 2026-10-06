import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DaexStore,
  type EquipoCatalogo,
  type InsumoCatalogo,
  type UnidadInsumo,
} from '../../../../state/daex.store';

/**
 * Borrador del formulario de un insumo.
 *
 * Vive aparte de la colección y con `null` en la cantidad: en un formulario "en
 * blanco" no es lo mismo un 0 tecleado que un campo sin llenar, y la fila no se
 * graba hasta que trae descripción, cantidad y unidad.
 */
interface BorradorInsumo {
  readonly id: string | null;
  readonly nombre: string;
  readonly cantidad: number | null;
  readonly unidadMedida: UnidadInsumo | '';
}

/** Borrador del formulario de un equipo o maquinaria. */
interface BorradorEquipo {
  readonly id: string | null;
  readonly nombre: string;
  readonly especificaciones: string;
  readonly cantidad: number | null;
}

/** Pares del selector de unidad, con el código que se persiste. */
const UNIDADES: readonly { readonly codigo: UnidadInsumo; readonly etiqueta: string }[] = [
  { codigo: 'KG', etiqueta: 'Kilogramos (KG)' },
  { codigo: 'GL', etiqueta: 'Galones (GL)' },
  { codigo: 'TN', etiqueta: 'Toneladas (TN)' },
  { codigo: 'UND', etiqueta: 'Unidades (UD)' },
];

/**
 * Unidades en el orden en que las ofrece el popup.
 *
 * Se leen de `UNIDADES` en lugar de repetir la lista literal para que el
 * selector y el resumen de la cabecera no puedan quedar desalineados: si se
 * agrega una unidad en un sitio y no en el otro, el total del encabezado
 * anunciaría una unidad que el formulario nunca deja declarar.
 */
const UNIDADES_DISPONIBLES: readonly UnidadInsumo[] = UNIDADES.map((u) => u.codigo);

/** Totales de una tabla de insumos, agrupados por unidad. */
interface ResumenUnidad {
  readonly unidad: UnidadInsumo;
  readonly total: number;
}

/** Insumo recién creado, en blanco y sin unidad. */
function insumoNuevo(): BorradorInsumo {
  return { id: null, nombre: '', cantidad: null, unidadMedida: '' };
}

/** Borrador cargado desde un insumo existente. */
function insumoDe(fila: InsumoCatalogo): BorradorInsumo {
  return {
    id: fila.id,
    nombre: fila.nombre,
    cantidad: fila.cantidad,
    unidadMedida: fila.unidadMedida,
  };
}

/** Equipo recién creado, en blanco. */
function equipoNuevo(): BorradorEquipo {
  return { id: null, nombre: '', especificaciones: '', cantidad: null };
}

/** Borrador cargado desde un equipo existente. */
function equipoDe(fila: EquipoCatalogo): BorradorEquipo {
  return {
    id: fila.id,
    nombre: fila.nombre,
    especificaciones: fila.especificaciones,
    cantidad: fila.cantidad,
  };
}

/**
 * Convierte lo que llega del `input` numérico en número, o en `null` si está vacío.
 *
 * Un campo vacío es `null` y no `0`: el formulario distingue "sin llenar" de
 * "cero tecleado", y no se graba una fila sin cantidad. La comprobación de vacío
 * va antes del `parseFloat` porque `Number.parseFloat('')` devuelve `NaN`, y ese
 * `NaN` llegaría hasta la tabla disfrazado de cero.
 */
function aNumeroONulo(entrada: string | number): number | null {
  if (typeof entrada === 'string' && entrada.trim() === '') {
    return null;
  }
  const valor = Number.parseFloat(String(entrada));
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Primera fila repetida de una tabla, o `null` si no hay ninguna.
 *
 * Dos filas con la misma descripción son la misma declaración escrita dos veces,
 * y en el caso de los insumos además inflan el total de su unidad: el Evaluador
 * no tiene forma de saber cuál de las dos es la buena. La comparación es la
 * misma que aplica el popup al grabar, así que el aviso no cambia entre el
 * momento de teclear y el de validar.
 */
function filaRepetida<T>(filas: readonly T[], nombreDe: (fila: T) => string): T | null {
  const vistos = new Map<string, T>();
  for (const fila of filas) {
    // Se comparan las descripciones con espacios normalizados: "Bentonita  en
    // polvo" y "Bentonita en polvo" son el mismo insumo tecleado con distinto
    // ritmo, así que sin esta normalización el duplicado se colaría.
    const clave = nombreDe(fila).trim().replace(/\s+/g, ' ').toUpperCase();
    const anterior = vistos.get(clave);
    if (anterior) {
      return anterior;
    }
    vistos.set(clave, fila);
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
 * Microcomponente de la sección 2.9 · Insumos, Maquinarias y Equipos.
 *
 * Dos matrices, dos popups y un solo botón de validación: la sección exige
 * inventario de insumos y de maquinarias, y ninguno de los dos basta por sí solo.
 * Las grillas van en modo lectura y cada fila se registra y se edita en su popup,
 * porque una fila a medio teclear no es un dato declarable.
 *
 * Las dos matrices viven aquí y se publican al store al validar, porque el
 * orquestador destruye los microcomponentes al cambiar de capítulo: un signal
 * local perdería lo que el titular acaba de teclear.
 */
@Component({
  selector: 'app-insumos-equipos',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './insumos-equipos.component.html',
  styleUrls: ['./insumos-equipos.component.css'],
})
export class InsumosEquiposComponent {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>('2.9');

  /** Pares del selector de unidad, para el popup de insumos. */
  protected readonly unidades = UNIDADES;

  private readonly estadoInsumos = signal<readonly InsumoCatalogo[]>([]);

  /** Insumos declarados, en el orden en que se grabaron. */
  protected readonly insumos = this.estadoInsumos.asReadonly();

  private readonly estadoEquipos = signal<readonly EquipoCatalogo[]>([]);

  /** Equipos y maquinarias declarados, en el orden en que se grabaron. */
  protected readonly equipos = this.estadoEquipos.asReadonly();

  /** Aviso de la última acción, o `null` si la última acción no dijo nada. */
  protected readonly mensaje = signal<string | null>(null);

  /* ------------------------------------------------------------------
     MODAL DE INSUMO
     ------------------------------------------------------------------ */

  private readonly borradorInsumo = signal<BorradorInsumo | null>(null);

  /** El modal de insumo está abierto si hay un borrador cargado. */
  protected readonly modalInsAbierto = computed(() => this.borradorInsumo() !== null);

  /** Borrador de insumo en edición, para el `[ngModel]` del formulario. */
  protected readonly modalInsData = computed(() => this.borradorInsumo());

  /**
   * Titular del modal de insumo: cambia entre alta y edición.
   *
   * Se compara contra `null` y no con `!== null` a secas: sin borrador el
   * encadenamiento opcional devuelve `undefined`, que también sería distinto de
   * `null` y dejaría el modal rotulado como edición.
   */
  protected readonly modalInsEsEdicion = computed(() => this.borradorInsumo()?.id != null);

  /**
   * Si el popup de insumo tiene lo mínimo para grabarse.
   *
   * Se lee del signal del borrador, y no de un objeto plano, para que el botón
   * se habilite en cuanto se teclea: un `computed` sobre un objeto mutable no
   * tiene de dónde enterarse.
   */
  protected readonly modalInsDataValido = computed(() => {
    const borrador = this.borradorInsumo();
    if (!borrador) {
      return false;
    }
    return (
      borrador.nombre.trim() !== '' &&
      borrador.cantidad !== null &&
      borrador.cantidad > 0 &&
      borrador.unidadMedida !== ''
    );
  });

  /** Motivo por el que el botón de grabar está deshabilitado, o `null`. */
  protected readonly bloqueoModalIns = computed<string | null>(() => {
    const borrador = this.borradorInsumo();
    if (!borrador) {
      return null;
    }
    if (borrador.nombre.trim() === '') {
      return 'Describa el insumo o material.';
    }
    if (borrador.cantidad === null || borrador.cantidad <= 0) {
      return 'Indique la cantidad requerida, mayor que cero.';
    }
    if (borrador.unidadMedida === '') {
      return 'Elija la unidad de medida.';
    }
    return null;
  });

  /* ------------------------------------------------------------------
     MODAL DE EQUIPO
     ------------------------------------------------------------------ */

  private readonly borradorEquipo = signal<BorradorEquipo | null>(null);

  /** El modal de equipo está abierto si hay un borrador cargado. */
  protected readonly modalEqAbierto = computed(() => this.borradorEquipo() !== null);

  /** Borrador de equipo en edición, para el `[ngModel]` del formulario. */
  protected readonly modalEqData = computed(() => this.borradorEquipo());

  /** Titular del modal de equipo: cambia entre alta y edición. */
  protected readonly modalEqEsEdicion = computed(() => this.borradorEquipo()?.id != null);

  /** Si el popup de equipo tiene lo mínimo para grabarse. */
  protected readonly modalEqDataValido = computed(() => {
    const borrador = this.borradorEquipo();
    if (!borrador) {
      return false;
    }
    return (
      borrador.nombre.trim() !== '' &&
      borrador.especificaciones.trim() !== '' &&
      borrador.cantidad !== null &&
      borrador.cantidad > 0
    );
  });

  /** Motivo por el que el botón de grabar está deshabilitado, o `null`. */
  protected readonly bloqueoModalEq = computed<string | null>(() => {
    const borrador = this.borradorEquipo();
    if (!borrador) {
      return null;
    }
    if (borrador.nombre.trim() === '') {
      return 'Indique el equipo o maquinaria.';
    }
    if (borrador.especificaciones.trim() === '') {
      return 'Describa las especificaciones técnicas o la capacidad.';
    }
    if (borrador.cantidad === null || borrador.cantidad <= 0) {
      return 'Indique la cantidad de unidades, mayor que cero.';
    }
    return null;
  });

  /* ------------------------------------------------------------------
     RESÚMENES DE CABECERA
     ------------------------------------------------------------------ */

  /**
   * Totales de insumos agrupados por unidad.
   *
   * No se totaliza la columna: 40 galones y 200 kilogramos no son una cantidad
   * comparable, así que el encabezado anuncia un subtotal por unidad y solo
   * recorre las unidades que el popup puede declarar.
   */
  protected readonly resumenInsumos = computed<readonly ResumenUnidad[]>(() => {
    const totales = new Map<UnidadInsumo, number>();
    for (const unidad of UNIDADES_DISPONIBLES) {
      totales.set(unidad, 0);
    }
    for (const fila of this.insumos()) {
      totales.set(fila.unidadMedida, (totales.get(fila.unidadMedida) ?? 0) + fila.cantidad);
    }
    return UNIDADES_DISPONIBLES.filter((unidad) => (totales.get(unidad) ?? 0) > 0).map(
      (unidad) => ({ unidad, total: totales.get(unidad) ?? 0 }),
    );
  });

  /** Unidades de maquinaria declaradas; aquí sí todas las filas cuentan igual. */
  protected readonly totalEquipos = computed(() =>
    this.equipos().reduce((suma, fila) => suma + fila.cantidad, 0),
  );

  /* ------------------------------------------------------------------
     REHIDRATACIÓN
     ------------------------------------------------------------------ */

  /**
   * Recupera las dos matrices ya validadas.
   *
   * Los identificadores los conserva el store: el `@for` empareja cada fila con
   * su nodo por `id`, así que un identificador distinto en cada guardado sacaría
   * el DOM de una fila del sitio al recuperar la sección. Cada matriz se
   * rehidrata por separado para que volver a la sección no mezcle el estado de
   * una con el de la otra.
   */
  constructor() {
    effect(() => {
      const guardados = this.store.catalogoInsumosRegistrado();
      if (guardados.length > 0) {
        this.estadoInsumos.set(guardados);
      }
    });
    effect(() => {
      const guardados = this.store.catalogoEquiposRegistrado();
      if (guardados.length > 0) {
        this.estadoEquipos.set(guardados);
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected alPulsarEscape(): void {
    // Se cierra el popup abierto, no los dos: solo puede haber uno, y sin este
    // orden el Escape del modal de equipo cerraría también el de insumo.
    if (this.borradorEquipo() !== null) {
      this.cerrarModalEquipo();
      return;
    }
    this.cerrarModalInsumo();
  }

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP DE INSUMOS (CRUD)
     ------------------------------------------------------------------ */

  /** Abre el modal de insumo en modo alta, o en modo edición si se le pasa una fila. */
  protected abrirModalInsumo(item: InsumoCatalogo | null): void {
    this.borradorInsumo.set(item ? insumoDe(item) : insumoNuevo());
  }

  /** Cierra el popup sin guardar: lo tecleado en el borrador se descarta. */
  protected cerrarModalInsumo(): void {
    this.borradorInsumo.set(null);
  }

  /**
   * Edita un campo de texto del borrador de insumo.
   *
   * El borrador se reemplaza entero en lugar de mutarse: el `[ngModel]` de la
   * plantilla está atado a este signal, y reescribir el objeto en su sitio no
   * dispararía ni el `computed` de validez ni el botón de grabar.
   */
  protected editarBorradorIns(campo: 'nombre', valor: string): void {
    this.borradorInsumo.update((borrador) => (borrador ? { ...borrador, [campo]: valor } : null));
  }

  /** Edita la cantidad del insumo, distinguiendo vacío de cero. */
  protected editarCantidadIns(valor: string | number): void {
    this.borradorInsumo.update((borrador) =>
      borrador ? { ...borrador, cantidad: aNumeroONulo(valor) } : null,
    );
  }

  /** Elige la unidad de medida del insumo. */
  protected alElegirUnidad(evento: Event): void {
    const unidad = (evento.target as HTMLSelectElement).value as UnidadInsumo | '';
    this.borradorInsumo.update((borrador) =>
      borrador ? { ...borrador, unidadMedida: unidad } : null,
    );
  }

  /**
   * Transaccional del modal de insumos: graba el borrador o lo descarta.
   *
   * Es el único camino de alta y de edición, así que una fila entra completa o
   * no entra: si el titular cierra el popup a medio rellenar, la matriz queda
   * como estaba.
   */
  protected procesarGuardadoInsumoModal(): void {
    const borrador = this.borradorInsumo();
    if (!borrador || !this.modalInsDataValido()) {
      return;
    }

    // El `!` de la vista previa es seguro: `modalInsDataValido()` ya comprobó que
    // la cantidad viene nula o positiva y que la unidad está elegida.
    const campos = {
      nombre: borrador.nombre.trim(),
      cantidad: borrador.cantidad!,
      unidadMedida: borrador.unidadMedida as UnidadInsumo,
    };

    if (borrador.id !== null) {
      const id = borrador.id;
      this.estadoInsumos.update((lista) =>
        lista.map((fila) => (fila.id === id ? { id, ...campos } : fila)),
      );
      this.mensaje.set(`Insumo «${campos.nombre}» actualizado.`);
    } else {
      const nuevo: InsumoCatalogo = { id: nuevoId('ins'), ...campos };
      this.estadoInsumos.update((lista) => [...lista, nuevo]);
      this.mensaje.set(`Insumo «${campos.nombre}» registrado.`);
    }

    this.cerrarModalInsumo();
  }

  /** Quita un insumo del inventario. */
  protected removerInsumo(id: string): void {
    const fila = this.insumos().find((insumo) => insumo.id === id);
    this.estadoInsumos.update((lista) => lista.filter((insumo) => insumo.id !== id));
    this.mensaje.set(fila ? `Insumo «${fila.nombre}» eliminado.` : 'Insumo eliminado.');
  }

  /* ------------------------------------------------------------------
     FLUJO DEL POPUP DE EQUIPOS (CRUD)
     ------------------------------------------------------------------ */

  /** Abre el modal de equipo en modo alta, o en modo edición si se le pasa una fila. */
  protected abrirModalEquipo(item: EquipoCatalogo | null): void {
    this.borradorEquipo.set(item ? equipoDe(item) : equipoNuevo());
  }

  /** Cierra el popup sin guardar: lo tecleado en el borrador se descarta. */
  protected cerrarModalEquipo(): void {
    this.borradorEquipo.set(null);
  }

  /** Edita la descripción o las especificaciones del borrador de equipo. */
  protected editarBorradorEq(campo: 'nombre' | 'especificaciones', valor: string): void {
    this.borradorEquipo.update((borrador) => (borrador ? { ...borrador, [campo]: valor } : null));
  }

  /** Edita la cantidad de equipos, distinguiendo vacío de cero. */
  protected editarCantidadEq(valor: string | number): void {
    this.borradorEquipo.update((borrador) =>
      borrador ? { ...borrador, cantidad: aNumeroONulo(valor) } : null,
    );
  }

  /** Transaccional del modal de equipos: graba el borrador o lo descarta. */
  protected procesarGuardadoEquipoModal(): void {
    const borrador = this.borradorEquipo();
    if (!borrador || !this.modalEqDataValido()) {
      return;
    }

    const campos = {
      nombre: borrador.nombre.trim(),
      especificaciones: borrador.especificaciones.trim(),
      cantidad: borrador.cantidad!,
    };

    if (borrador.id !== null) {
      const id = borrador.id;
      this.estadoEquipos.update((lista) =>
        lista.map((fila) => (fila.id === id ? { id, ...campos } : fila)),
      );
      this.mensaje.set(`Equipo «${campos.nombre}» actualizado.`);
    } else {
      const nuevo: EquipoCatalogo = { id: nuevoId('eq'), ...campos };
      this.estadoEquipos.update((lista) => [...lista, nuevo]);
      this.mensaje.set(`Equipo «${campos.nombre}» registrado.`);
    }

    this.cerrarModalEquipo();
  }

  /** Quita un equipo o maquinaria del inventario. */
  protected removerEquipo(id: string): void {
    const fila = this.equipos().find((equipo) => equipo.id === id);
    this.estadoEquipos.update((lista) => lista.filter((equipo) => equipo.id !== id));
    this.mensaje.set(fila ? `Equipo «${fila.nombre}» eliminado.` : 'Equipo eliminado.');
  }

  /* ------------------------------------------------------------------
     VALIDACIÓN DE LA SECCIÓN
     ------------------------------------------------------------------ */

  /**
   * Motivo por el que la sección no puede validarse, o `null` si está lista.
   *
   * El `length` se comprueba antes que el `every`: sobre una lista vacía `every`
   * devuelve `true`, así que sin esta guarda el botón se habilitaría con una de
   * las dos matrices vacía, justo lo que la norma no admite.
   */
  protected readonly bloqueo = computed<string | null>(() => {
    const insumos = this.insumos();
    const equipos = this.equipos();

    if (insumos.length === 0) {
      return 'Declare al menos un (1) insumo o material.';
    }
    if (equipos.length === 0) {
      return 'Declare al menos un (1) equipo o maquinaria.';
    }
    if (insumos.some((fila) => fila.nombre.trim() === '')) {
      return 'Todos los insumos necesitan descripción.';
    }
    if (insumos.some((fila) => fila.cantidad <= 0)) {
      return 'La cantidad de cada insumo debe ser mayor que cero.';
    }
    if (equipos.some((fila) => fila.nombre.trim() === '')) {
      return 'Todos los equipos necesitan nombre.';
    }
    if (equipos.some((fila) => fila.especificaciones.trim() === '')) {
      return 'Todos los equipos necesitan sus especificaciones técnicas.';
    }
    if (equipos.some((fila) => fila.cantidad <= 0)) {
      return 'La cantidad de cada equipo debe ser mayor que cero.';
    }

    const insumoRepetido = filaRepetida(insumos, (fila) => fila.nombre);
    if (insumoRepetido) {
      return `El insumo «${insumoRepetido.nombre}» está repetido.`;
    }
    const equipoRepetido = filaRepetida(equipos, (fila) => fila.nombre);
    if (equipoRepetido) {
      return `El equipo «${equipoRepetido.nombre}» está repetido.`;
    }
    return null;
  });

  /** Si el inventario técnico tiene lo mínimo para publicarse. */
  protected readonly seccionValida = computed(() => this.bloqueo() === null);

  /**
   * Publica las dos matrices y pone la sección en verde.
   *
   * Publica al store y no solo al semáforo porque el titular puede volver al
   * capítulo 2 más tarde: el inventario tiene que seguir ahí, y el store es lo
   * único que sobrevive a que el orquestador destruya este componente.
   */
  protected guardarYValidarInsumosSeccion(): void {
    const bloqueo = this.bloqueo();
    if (bloqueo) {
      this.mensaje.set(bloqueo);
      return;
    }
    this.store.registrarCatalogoInsumos(this.insumos());
    this.store.registrarCatalogoEquipos(this.equipos());
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.mensaje.set('Inventario de insumos y equipos validado.');
  }
}
