import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DaexStore } from '../../../../state/daex.store';

/**
 * Una perforación diamantina perteneciente a una plataforma.
 *
 * Antes los campos de sondaje vivían en la fila de la plataforma, lo que
 * obligaba a un solo pozo por plataforma. Ahora son una colección, y cada
 * plataforma declara los suyos en la mini-tabla del popup, que es la única
 * pantalla donde se editan.
 */
export interface Sondaje {
  readonly id: string;
  readonly codigo: string;
  readonly profundidad: number;
  readonly inclinacion: number;
  readonly azimut: number;
}

/** Una plataforma de perforación con sus sondajes y su referencia al agua. */
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

/**
 * Borrador del formulario del modal.
 *
 * Vive aparte de la colección y con `null` en los numéricos: en un formulario
 * "en blanco" no es lo mismo un 0 tecleado que un campo sin llenar, y la
 * plataforma no se graba hasta que Este y Norte traen coordenada. Al grabar, el
 * borrador se convierte a los números de `Plataforma`.
 *
 * Los sondajes viajan con el borrador porque el popup es la única pantalla
 * donde se declaran: se editan junto a la plataforma y se graban con ella, de
 * modo que no existe una etapa intermedia con datos a medio camino.
 */
interface BorradorPlataforma {
  readonly id: string | null;
  readonly nombre: string;
  readonly este: number | null;
  readonly norte: number | null;
  readonly altitud: number | null;
  readonly cuerpoAgua: string;
  readonly distanciaAgua: number | null;
  readonly sondajes: readonly Sondaje[];
}

/**
 * Borrador del popup de auxiliares.
 *
 * Misma razón que el de plataformas: el formulario en blanco distingue el
 * campo sin llenar del cero tecleado, y por eso los numéricos son `null`
 * hasta que el titular los completa.
 */
interface BorradorAuxiliar {
  readonly id: string | null;
  readonly nombre: string;
  readonly este: number | null;
  readonly norte: number | null;
  readonly altitud: number | null;
  readonly cuerpoAgua: string;
  readonly distanciaAgua: number | null;
}

/**
 * Borrador del popup de dimensionamiento.
 *
 * `cantidad` nace en 1 porque es el valor por defecto del formulario y no un
 * dato que el titular tenga que teclear para que la fila tenga sentido.
 */
interface BorradorDimension {
  readonly id: string | null;
  readonly nombreComponente: string;
  readonly ancho: number | null;
  readonly largo: number | null;
  readonly profundidad: number | null;
  readonly cantidad: number | null;
}

/**
 * Tope de plataformas.
 *
 * Es un tope duro del formulario, no una recomendación: el botón de alta y el
 * importador CSV se niegan a superarlo y la validación bloquea el guardado.
 */
const MAXIMO_PLATAFORMAS = 10;

/** Sondaje recién creado. */
function sondajeVacio(id: string): Sondaje {
  return { id, codigo: '', profundidad: 0, inclinacion: 0, azimut: 0 };
}

/** Auxiliar recién creado, en blanco y sin coordenada. */
function auxiliarNuevo(): BorradorAuxiliar {
  return {
    id: null,
    nombre: '',
    este: null,
    norte: null,
    altitud: null,
    cuerpoAgua: '',
    distanciaAgua: null,
  };
}

/** Borrador cargado desde un auxiliar existente. */
function auxiliarDe(aux: Auxiliar): BorradorAuxiliar {
  return {
    id: aux.id,
    nombre: aux.nombre,
    este: aux.este,
    norte: aux.norte,
    altitud: aux.altitud,
    cuerpoAgua: aux.cuerpoAgua,
    distanciaAgua: aux.distanciaAgua,
  };
}

/** Dimensionamiento recién creado, con la cantidad ya en 1. */
function dimensionNueva(): BorradorDimension {
  return {
    id: null,
    nombreComponente: '',
    ancho: null,
    largo: null,
    profundidad: null,
    cantidad: 1,
  };
}

/** Borrador cargado desde un dimensionamiento existente. */
function dimensionDe(dim: Dimension): BorradorDimension {
  return {
    id: dim.id,
    nombreComponente: dim.nombreComponente,
    ancho: dim.ancho,
    largo: dim.largo,
    profundidad: dim.profundidad,
    cantidad: dim.cantidad,
  };
}

/** Borrador de una plataforma nueva, con el nombre correlativo ya puesto. */
function borradorNuevo(numero: number): BorradorPlataforma {
  return {
    id: null,
    nombre: `PLA-${String(numero).padStart(2, '0')}`,
    este: null,
    norte: null,
    altitud: null,
    cuerpoAgua: '',
    distanciaAgua: null,
    sondajes: [],
  };
}

/** Borrador cargado desde una plataforma existente, con sus sondajes. */
function borradorDe(plat: Plataforma): BorradorPlataforma {
  return {
    id: plat.id,
    nombre: plat.nombre,
    este: plat.este,
    norte: plat.norte,
    altitud: plat.altitud,
    cuerpoAgua: plat.cuerpoAgua,
    distanciaAgua: plat.distanciaAgua,
    sondajes: plat.sondajes,
  };
}

/**
 * Contador de identificadores.
 *
 * Se usa un número y no `Date.now()` ni `randomUUID` porque las filas se borran
 * y se vuelven a añadir: con el contador la fila nueva queda al final, y `track`
 * no reutiliza el DOM de la que se acaba de eliminar.
 */
let secuencia = 0;

/** Identificador único de fila. */
function nuevoId(prefijo: string): string {
  secuencia += 1;
  return `${prefijo}-${secuencia}`;
}

/**
 * Microcomponente de la sección 2.7 · Componentes del Proyecto.
 *
 * El inventario de plataformas es la única vista del bloque, y cada fila se
 * registra y se edita en un popup que incluye sus perforaciones. Las tres
 * matrices viven aquí y se publican al store al validar, porque el orquestador
 * destruye los microcomponentes al cambiar de capítulo: un signal local perdería
 * lo que el titular acaba de teclear.
 */
@Component({
  selector: 'app-componentes',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './componentes.component.html',
  styleUrls: ['./componentes.component.css'],
})
export class ComponentesComponent {
  protected readonly store = inject(DaexStore);

  /** Índice de la sección; el orquestador lo inyecta en `inputs`. */
  readonly numero = input<string>('2.7');

  private readonly estadoPlataformas = signal<readonly Plataforma[]>([]);
  private readonly estadoAuxiliares = signal<readonly Auxiliar[]>([]);
  private readonly estadoDimensiones = signal<readonly Dimension[]>([]);

  protected readonly plataformas = this.estadoPlataformas.asReadonly();
  protected readonly auxiliares = this.estadoAuxiliares.asReadonly();
  protected readonly dimensiones = this.estadoDimensiones.asReadonly();

  /** El tope se lee en la plantilla para el contador y el botón deshabilitado. */
  protected readonly MAXIMO_PLATAFORMAS = MAXIMO_PLATAFORMAS;

  /* ------------------------------------------------------------------
     INVENTARIO DE PLATAFORMAS
     ------------------------------------------------------------------
     Los sondajes ya no viven en una grilla aparte: se declaran dentro del
     popup, así que el inventario es la única vista y cada fila muestra solo
     cuántos perforaciones lleva declarados.
     ------------------------------------------------------------------ */

  /** Plataformas que aún no declaran perforación y por tanto no pueden validarse. */
  protected readonly plataformasSinSondaje = computed(() =>
    this.plataformas().filter((fila) => fila.sondajes.length === 0),
  );

  /* ------------------------------------------------------------------
     MODAL DE PLATAFORMAS
     ------------------------------------------------------------------ */

  private readonly borrador = signal<BorradorPlataforma | null>(null);

  /** El modal está abierto si hay un borrador cargado. */
  protected readonly modalPlatAbierto = computed(() => this.borrador() !== null);

  /** Borrador en edición, para el `[ngModel]` del formulario. */
  protected readonly modalPlatData = computed(() => this.borrador());

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
   * Como el popup escribe la plataforma con sus perforaciones, declarar un
   * sondaje deja de ser un pendiente posterior del inventario y pasa a formar
   * parte de lo que el botón de grabar exige: no tiene sentido confirmar una
   * plataforma para que el formulario la rechace acto seguido por falta de
   * sondaje.
   *
   * Se lee del signal del borrador, y no de un objeto plano, para que el botón
   * se habilite en cuanto se teclea: un `computed` sobre un objeto mutable no
   * tiene de dónde enterarse.
   */
  protected readonly modalPlatDataValido = computed(() => {
    const borrador = this.borrador();
    if (!borrador) {
      return false;
    }
    if (
      borrador.nombre.trim() === '' ||
      borrador.este === null ||
      borrador.este <= 0 ||
      borrador.norte === null ||
      borrador.norte <= 0
    ) {
      return false;
    }
    // El `length` se comprueba antes que el `every`: sobre una lista vacía
    // `every` devuelve `true`, así que sin esta guarda el botón se habilitaría
    // con cero perforaciones, justo lo que el popup declara pendiente.
    if (borrador.sondajes.length === 0) {
      return false;
    }
    return borrador.sondajes.every(
      (sondaje) => sondaje.codigo.trim() !== '' && sondaje.profundidad > 0,
    );
  });

  /** Motivo por el que el botón de grabar está deshabilitado, o `null`. */
  protected readonly bloqueoModal = computed<string | null>(() => {
    const borrador = this.borrador();
    if (!borrador) {
      return null;
    }
    if (borrador.nombre.trim() === '') {
      return 'Indique el nombre de la plataforma.';
    }
    if (borrador.este === null || borrador.norte === null) {
      return 'Indique la coordenada UTM (Este y Norte) de la plataforma.';
    }
    if (borrador.sondajes.length === 0) {
      return 'Añada al menos un (1) sondaje diamantino a la plataforma.';
    }
    if (borrador.sondajes.some((sondaje) => sondaje.codigo.trim() === '')) {
      return 'Todos los sondajes necesitan código.';
    }
    if (borrador.sondajes.some((sondaje) => sondaje.profundidad <= 0)) {
      return 'Todos los sondajes necesitan profundidad programada.';
    }
    return null;
  });

  /** Abre el modal en modo alta, con el nombre correlativo ya puesto. */
  protected abrirModalNuevaPlataforma(): void {
    if (!this.hayCupoDePlataforma()) {
      return;
    }
    this.borrador.set(borradorNuevo(this.plataformas().length + 1));
  }

  /** Abre el modal en modo edición sobre una plataforma del inventario. */
  protected abrirModalEditarPlataforma(plat: Plataforma): void {
    this.borrador.set(borradorDe(plat));
  }

  /** Cierra el modal descartando el borrador. */
  protected cerrarModalPlataforma(): void {
    this.borrador.set(null);
  }

  /**
   * Cierra con la tecla Escape cualquier popup abierto, sin grabar.
   *
   * La tecla vale como dismissive en toda la sección y se aplica a los tres
   * formularios: si solo cerrara uno, Escape dejaría al titular atrapado en
   * el siguiente popup con la misma tecla.
   */
  @HostListener('document:keydown.escape')
  protected alPulsarEscape(): void {
    this.cerrarModalPlataforma();
    this.cerrarModalAuxiliar();
    this.cerrarModalDimension();
  }

  /**
   * Edita un campo del borrador.
   *
   * El borrador se reemplaza entero en lugar de mutarse: el `[ngModel]` de la
   * plantilla está atado a este signal, y reescribir el objeto en su sitio no
   * dispararía ni el `computed` de validez ni el botón de grabar.
   */
  protected editarBorrador(
    campo: 'nombre' | 'cuerpoAgua' | 'este' | 'norte' | 'altitud' | 'distanciaAgua',
    valor: string | number,
  ): void {
    this.borrador.update((borrador) => {
      if (!borrador) {
        return null;
      }
      if (campo === 'nombre' || campo === 'cuerpoAgua') {
        return { ...borrador, [campo]: String(valor) };
      }
      return { ...borrador, [campo]: aNumeroONulo(valor) };
    });
  }

  /**
   * Transaccional del modal: graba el borrador o descarta.
   *
   * Es el único camino de alta y de edición, así que la plataforma y sus
   * perforaciones se escriben juntas o no se escribe nada: si el titular
   * cancela a medio camino, el inventario no queda con una plataforma sin
   * sondajes.
   */
  protected procesarGuardadoPlataformaModal(): void {
    const borrador = this.borrador();
    if (!borrador || !this.modalPlatDataValido()) {
      return;
    }
    const nombre = borrador.nombre.trim();
    const nombreRepetido = this.plataformas().some(
      (fila) =>
        fila.id !== borrador.id && fila.nombre.trim().toUpperCase() === nombre.toUpperCase(),
    );
    if (nombreRepetido) {
      this.mensaje.set(`Ya existe una plataforma llamada ${nombre}.`);
      return;
    }

    const campos = {
      nombre,
      este: borrador.este ?? 0,
      norte: borrador.norte ?? 0,
      altitud: borrador.altitud ?? 0,
      cuerpoAgua: borrador.cuerpoAgua.trim(),
      distanciaAgua: borrador.distanciaAgua ?? 0,
      sondajes: borrador.sondajes,
    };

    if (borrador.id !== null) {
      this.estadoPlataformas.update((lista) =>
        lista.map((fila) => (fila.id === borrador.id ? { ...fila, ...campos } : fila)),
      );
      this.mensaje.set(
        `${nombre} actualizada con ${campos.sondajes.length} perforación(es) declarada(s).`,
      );
    } else {
      const nueva: Plataforma = { id: nuevoId('pl'), ...campos };
      this.estadoPlataformas.update((lista) => [...lista, nueva]);
      this.mensaje.set(`${nombre} registrada con ${campos.sondajes.length} perforación(es).`);
    }
    this.cerrarModalPlataforma();
  }

  /* ------------------------------------------------------------------
     SONDAJES DENTRO DEL POPUP
     ------------------------------------------------------------------
     Se editan sobre el borrador, no sobre la plataforma del inventario: el
     popup es una transacción, y escribir directamente en la colección dejaría
     filas a medias si el titular cancela.
     ------------------------------------------------------------------ */

  /** Añade una perforación en blanco a la plataforma del popup. */
  protected agregarSondajeEnModal(): void {
    this.borrador.update((borrador) => {
      if (!borrador) {
        return null;
      }
      const ordinal = borrador.sondajes.length + 1;
      return {
        ...borrador,
        sondajes: [
          ...borrador.sondajes,
          this.nuevoSondajeDe(ordinal, borrador.nombre.trim() || 'PLA'),
        ],
      };
    });
  }

  /** Quita una perforación de la plataforma del popup. */
  protected removerSondajeEnModal(sondajeId: string): void {
    this.borrador.update((borrador) => {
      if (!borrador) {
        return null;
      }
      return {
        ...borrador,
        sondajes: borrador.sondajes.filter((sondaje) => sondaje.id !== sondajeId),
      };
    });
  }

  /**
   * Edita un campo de un sondaje del popup.
   *
   * Cada pulsación sustituye el borrador entero: la mini-tabla está atada al
   * signal con `[ngModel]`, y mutar el sondaje en su sitio dejaría el botón de
   * grabar sin enterarse del cambio.
   */
  protected editarSondajeEnModal(
    sondajeId: string,
    campo: TextoDeSondaje | NumeroDeSondaje,
    valor: string | number,
  ): void {
    this.borrador.update((borrador) => {
      if (!borrador) {
        return null;
      }
      return {
        ...borrador,
        sondajes: borrador.sondajes.map((sondaje) =>
          sondaje.id === sondajeId
            ? CAMPO_NUMERICO_DE_SONDAJE.has(campo)
              ? { ...sondaje, [campo]: aNumero(valor, 0) }
              : { ...sondaje, [campo]: String(valor) }
            : sondaje,
        ),
      };
    });
  }

  /** Cupo disponible bajo el tope de plataformas. */
  private hayCupoDePlataforma(): boolean {
    if (this.estadoPlataformas().length < MAXIMO_PLATAFORMAS) {
      return true;
    }
    this.mensaje.set(
      `No se admiten más de ${MAXIMO_PLATAFORMAS} plataformas según las disposiciones de la DAEX de Menor Complejidad.`,
    );
    return false;
  }

  /* ------------------------------------------------------------------
     INVENTARIO DE PLATAFORMAS
     ------------------------------------------------------------------ */

  /** Baja de una plataforma con todos sus sondajes. */
  protected removerPlataformaCompleta(id: string): void {
    this.estadoPlataformas.update((lista) => lista.filter((fila) => fila.id !== id));
  }

  /**
   * Sondaje nuevo con código correlativo.
   *
   * El código se propone a partir del nombre de la plataforma, que es como se
   * nombra en campo, y el geólogo lo corrige si la nomenclatura del proyecto es
   * otra.
   */
  private nuevoSondajeDe(ordinal: number, nombrePlataforma: string): Sondaje {
    const base = nombrePlataforma.trim() || 'PLA';
    return {
      ...sondajeVacio(nuevoId('s')),
      codigo: `${base}-SD-${String(ordinal).padStart(2, '0')}`,
    };
  }

  /* ------------------------------------------------------------------
     POPUP DE COMPONENTES AUXILIARES
     ------------------------------------------------------------------
     La tabla es de solo lectura: el inventario muestra lo ya grabado y la
     edición ocurre en el popup, que es una transacción. Así ninguna fila
     queda a medio camino con un campo tecleado y otro sin confirmar.
     ------------------------------------------------------------------ */

  private readonly borradorAuxiliar = signal<BorradorAuxiliar | null>(null);

  protected readonly modalAuxAbierto = computed(() => this.borradorAuxiliar() !== null);

  /** Borrador en edición, para el `[ngModel]` del formulario. */
  protected readonly modalAuxData = computed(() => this.borradorAuxiliar());

  /** Titular del popup: distingue el alta de la edición. */
  protected readonly modalAuxEsEdicion = computed(() => this.borradorAuxiliar()?.id != null);

  /** Si el popup tiene lo mínimo para grabarse: nombre y coordenada UTM. */
  protected readonly modalAuxDataValido = computed(() => {
    const borrador = this.borradorAuxiliar();
    if (!borrador) {
      return false;
    }
    if (borrador.nombre.trim() === '') {
      return false;
    }
    return (
      borrador.este !== null && borrador.este > 0 && borrador.norte !== null && borrador.norte > 0
    );
  });

  /** Motivo por el que el botón de grabar está deshabilitado, o `null`. */
  protected readonly bloqueoAuxModal = computed<string | null>(() => {
    const borrador = this.borradorAuxiliar();
    if (!borrador) {
      return null;
    }
    if (borrador.nombre.trim() === '') {
      return 'Indique el nombre del componente auxiliar.';
    }
    if (borrador.este === null || borrador.norte === null) {
      return 'Indique la coordenada UTM (Este y Norte) del auxiliar.';
    }
    return null;
  });

  /**
   * Abre el popup de auxiliares en alta (`null`) o edición (una fila).
   *
   * Un solo manejador para los dos casos: el borrador se arma desde la fila
   * cuando viene y en blanco cuando no, así que el resto del formulario es
   * idéntico en las dos entradas.
   */
  protected abrirModalAuxiliar(aux: Auxiliar | null): void {
    this.borradorAuxiliar.set(aux === null ? auxiliarNuevo() : auxiliarDe(aux));
  }

  /** Cierra el popup descartando el borrador. */
  protected cerrarModalAuxiliar(): void {
    this.borradorAuxiliar.set(null);
  }

  /** Edita un campo del borrador de auxiliar, reescribiendo el objeto entero. */
  protected editarBorradorAuxiliar(
    campo: TextoDeAuxiliar | NumeroDeAuxiliar,
    valor: string | number,
  ): void {
    this.borradorAuxiliar.update((borrador) => {
      if (!borrador) {
        return null;
      }
      if (CAMPO_NUMERICO_DE_AUXILIAR.has(campo)) {
        return { ...borrador, [campo]: aNumeroONulo(valor) };
      }
      return { ...borrador, [campo]: String(valor) };
    });
  }

  /**
   * Transaccional del popup: graba el auxiliar o lo descarta.
   *
   * El nombre se compara en mayúsculas, igual que en las plataformas:
   * `Almacén` y `ALMACÉN` serían dos filas que el titular no distingue al leer
   * el inventario, y una de las dos quedaría con datos que parece no existir.
   */
  protected procesarGuardadoAuxiliarModal(): void {
    const borrador = this.borradorAuxiliar();
    if (!borrador || !this.modalAuxDataValido()) {
      return;
    }
    const nombre = borrador.nombre.trim();
    const repetido = this.auxiliares().some(
      (fila) =>
        fila.id !== borrador.id && fila.nombre.trim().toUpperCase() === nombre.toUpperCase(),
    );
    if (repetido) {
      this.mensaje.set(`Ya existe un componente auxiliar llamado ${nombre}.`);
      return;
    }

    const campos = {
      nombre,
      este: borrador.este ?? 0,
      norte: borrador.norte ?? 0,
      altitud: borrador.altitud ?? 0,
      cuerpoAgua: borrador.cuerpoAgua.trim(),
      distanciaAgua: borrador.distanciaAgua ?? 0,
    };

    if (borrador.id !== null) {
      this.estadoAuxiliares.update((lista) =>
        lista.map((fila) => (fila.id === borrador.id ? { ...fila, ...campos } : fila)),
      );
      this.mensaje.set(`${nombre} actualizado.`);
    } else {
      const nuevo: Auxiliar = { id: nuevoId('aux'), ...campos };
      this.estadoAuxiliares.update((lista) => [...lista, nuevo]);
      this.mensaje.set(`${nombre} registrado como componente auxiliar.`);
    }
    this.cerrarModalAuxiliar();
  }

  /** Baja de un auxiliar del inventario. */
  protected removerAuxiliarCompleto(id: string): void {
    this.estadoAuxiliares.update((lista) => lista.filter((fila) => fila.id !== id));
  }

  /* ------------------------------------------------------------------
     POPUP DE DIMENSIONAMIENTOS
     ------------------------------------------------------------------
     Mismo patrón que el de auxiliares. El área y el volumen ni se teclean ni
     se guardan: se derivan al leer, para que cambiar el ancho no pueda dejar
     una cifra vieja pegada en la fila.
     ------------------------------------------------------------------ */

  private readonly borradorDimension = signal<BorradorDimension | null>(null);

  protected readonly modalDimAbierto = computed(() => this.borradorDimension() !== null);

  protected readonly modalDimData = computed(() => this.borradorDimension());

  protected readonly modalDimEsEdicion = computed(() => this.borradorDimension()?.id != null);

  /** Si el popup tiene lo mínimo: nombre, ancho, largo y cantidad al menos 1. */
  protected readonly modalDimDataValido = computed(() => {
    const borrador = this.borradorDimension();
    if (!borrador) {
      return false;
    }
    if (borrador.nombreComponente.trim() === '') {
      return false;
    }
    if (borrador.ancho === null || borrador.ancho <= 0) {
      return false;
    }
    if (borrador.largo === null || borrador.largo <= 0) {
      return false;
    }
    return borrador.cantidad !== null && borrador.cantidad >= 1;
  });

  protected readonly bloqueoDimModal = computed<string | null>(() => {
    const borrador = this.borradorDimension();
    if (!borrador) {
      return null;
    }
    if (borrador.nombreComponente.trim() === '') {
      return 'Indique el nombre o tipo del componente.';
    }
    if (borrador.ancho === null || borrador.ancho <= 0) {
      return 'Indique el ancho del componente.';
    }
    if (borrador.largo === null || borrador.largo <= 0) {
      return 'Indique el largo del componente.';
    }
    if (borrador.cantidad === null || borrador.cantidad < 1) {
      return 'La cantidad debe ser al menos 1.';
    }
    return null;
  });

  /** Abre el popup de dimensiones en alta (`null`) o edición (una fila). */
  protected abrirModalDimension(dim: Dimension | null): void {
    this.borradorDimension.set(dim === null ? dimensionNueva() : dimensionDe(dim));
  }

  /** Cierra el popup descartando el borrador. */
  protected cerrarModalDimension(): void {
    this.borradorDimension.set(null);
  }

  /** Edita un campo del borrador de dimensión, reescribiendo el objeto entero. */
  protected editarBorradorDimension(
    campo: TextoDeDimension | NumeroDeDimension,
    valor: string | number,
  ): void {
    this.borradorDimension.update((borrador) => {
      if (!borrador) {
        return null;
      }
      if (CAMPO_NUMERICO_DE_DIMENSION.has(campo)) {
        return { ...borrador, [campo]: aNumeroONulo(valor) };
      }
      return { ...borrador, [campo]: String(valor) };
    });
  }

  /** Transaccional del popup de dimensiones: graba o descarta. */
  protected procesarGuardadoDimensionModal(): void {
    const borrador = this.borradorDimension();
    if (!borrador || !this.modalDimDataValido()) {
      return;
    }
    const nombre = borrador.nombreComponente.trim();
    const repetido = this.dimensiones().some(
      (fila) =>
        fila.id !== borrador.id &&
        fila.nombreComponente.trim().toUpperCase() === nombre.toUpperCase(),
    );
    if (repetido) {
      this.mensaje.set(`Ya existe un componente llamado ${nombre}.`);
      return;
    }

    const campos = {
      nombreComponente: nombre,
      ancho: borrador.ancho ?? 0,
      largo: borrador.largo ?? 0,
      profundidad: borrador.profundidad ?? 0,
      cantidad: borrador.cantidad ?? 1,
    };

    if (borrador.id !== null) {
      this.estadoDimensiones.update((lista) =>
        lista.map((fila) => (fila.id === borrador.id ? { ...fila, ...campos } : fila)),
      );
      this.mensaje.set(`${nombre} actualizado.`);
    } else {
      const nueva: Dimension = { id: nuevoId('dim'), ...campos };
      this.estadoDimensiones.update((lista) => [...lista, nueva]);
      this.mensaje.set(`${nombre} registrado como dimensionamiento.`);
    }
    this.cerrarModalDimension();
  }

  /** Baja de un dimensionamiento del inventario. */
  protected removerDimensionCompleta(id: string): void {
    this.estadoDimensiones.update((lista) => lista.filter((fila) => fila.id !== id));
  }

  /* ------------------------------------------------------------------
     IMPORTADOR CSV DE PLATAFORMAS
     ------------------------------------------------------------------
     Una plataforma con varios sondajes ocupa varias filas del CSV: se agrupan
     por nombre de plataforma y cada fila aporta un sondaje. Así el archivo se
     puede exportar desde la planilla del geólogo sin partir las plataformas en
     varias entradas distintas.
     ------------------------------------------------------------------ */

  protected async alImportarCSVPlataformas(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      return;
    }
    // Se vacía el input para que volver a elegir el mismo archivo dispare el cambio.
    entrada.value = '';
    try {
      const filas = this.leerTabla(await archivo.text());
      const importadas = this.agruparFilasComoPlataformas(filas);
      if (importadas.sinColumna) {
        this.mensaje.set('El archivo no traía una columna de plataforma reconocible.');
        return;
      }
      if (importadas.plataformas.length === 0) {
        this.mensaje.set(
          `${importadas.omitidas} fila(s) descartada(s) por venir sin nombre de plataforma.`,
        );
        return;
      }
      const resultado = this.fusionarPlataformasImportadas(importadas.plataformas);
      const sondeos = resultado.plataformas.reduce(
        (total, fila) => total + fila.sondajes.length,
        0,
      );
      const avisos = [
        `${resultado.nuevas} plataforma(s) y ${sondeos} sondaje(s) importados.`,
        resultado.fusionadas > 0
          ? `${resultado.fusionadas} fusionada(s) con plataformas ya existentes.`
          : '',
        resultado.omitidasPorCupo > 0
          ? `${resultado.omitidasPorCupo} plataforma(s) omitida(s): el tope es ${MAXIMO_PLATAFORMAS}.`
          : '',
        importadas.omitidas > 0
          ? `${importadas.omitidas} fila(s) descartada(s) por venir sin nombre de plataforma.`
          : '',
      ].filter(Boolean);
      this.mensaje.set(avisos.join(' '));
    } catch {
      this.mensaje.set('No se pudo leer el archivo: revisa que sea un CSV de texto plano.');
    }
  }

  /**
   * Corta un CSV en filas de celdas.
   *
   * Acepta coma, punto y coma o tabulador como separador, que es lo que
   * exporta Excel o una planilla según el equipo y la configuración regional,
   * y quita las comillas dobles envolventes. No es un parser RFC 4180
   * completo: no maneja saltos de línea dentro de una celda entrecomillada, y
   * no hace falta para una matriz de coordenadas.
   */
  private leerTabla(texto: string): string[][] {
    const lineas = texto
      .replace(/^\uFEFF/, '')
      .split(/\r\n|\n|\r/)
      .filter((linea) => linea.trim() !== '');
    if (lineas.length === 0) {
      return [];
    }
    const separador = lineaConMasSeparadores(lineas[0]);
    return lineas.map((linea) =>
      linea.split(separador).map((celda) => celda.replace(/^"|"$/g, '').trim()),
    );
  }

  /** Convierte filas sueltas en plataformas agrupando por nombre. */
  private agruparFilasComoPlataformas(filas: string[][]): {
    plataformas: Plataforma[];
    omitidas: number;
    sinColumna: boolean;
  } {
    if (filas.length < 2) {
      return { plataformas: [], omitidas: filas.length, sinColumna: false };
    }
    const cabeceras = filas[0].map(claveDeCabecera);
    const columnas = resolverColumnas(cabeceras);
    if (columnas.plataforma < 0) {
      // Sin columna de plataforma el archivo no describe esta matriz: se avisa
      // de eso, y no de filas descartadas, que es un problema distinto.
      return { plataformas: [], omitidas: 0, sinColumna: true };
    }

    const porNombre = new Map<string, Plataforma>();
    let omitidas = 0;
    for (const celdas of filas.slice(1)) {
      const nombre = celdas[columnas.plataforma]?.trim() ?? '';
      if (nombre === '') {
        omitidas += 1;
        continue;
      }
      const clave = nombre.toUpperCase();
      const existente = porNombre.get(clave);
      const sonda = this.crearSondajeDeFila(celdas, columnas);
      // Una fila puede no traer datos de sondaje; entonces solo aporta la
      // plataforma, y no un `null` colgando de su lista.
      const aportados = sonda === null ? [] : [sonda];
      porNombre.set(
        clave,
        existente
          ? { ...existente, sondajes: [...existente.sondajes, ...aportados] }
          : {
              ...this.crearPlataformaDeFila(nombre, celdas, columnas),
              sondajes: aportados,
            },
      );
    }
    return { plataformas: [...porNombre.values()], omitidas, sinColumna: false };
  }

  /** Platforma a partir de una fila, con sus coordenadas e hidrología. */
  private crearPlataformaDeFila(nombre: string, celdas: string[], columnas: Columnas): Plataforma {
    return {
      id: nuevoId('pl'),
      nombre,
      este: leerNumero(celdas, columnas.este),
      norte: leerNumero(celdas, columnas.norte),
      altitud: leerNumero(celdas, columnas.altitud),
      cuerpoAgua: leerTexto(celdas, columnas.cuerpoAgua),
      distanciaAgua: leerNumero(celdas, columnas.distanciaAgua),
      sondajes: [],
    };
  }

  /**
   * Sondaje a partir de una fila, o `null` si la fila no trae datos de sondaje.
   *
   * Una fila puede declarar solo la plataforma, si el archivo viene con las
   * perforaciones en otro bloque: en ese caso se crea la plataforma y el
   * titular añade sus sondajes desde el popup.
   */
  private crearSondajeDeFila(celdas: string[], columnas: Columnas): Sondaje | null {
    const codigo = leerTexto(celdas, columnas.sondaje);
    const profundidad = leerNumero(celdas, columnas.profundidad);
    const inclinacion = leerNumero(celdas, columnas.inclinacion);
    const azimut = leerNumero(celdas, columnas.azimut);
    if (codigo === '' && profundidad === 0 && inclinacion === 0 && azimut === 0) {
      return null;
    }
    return { id: nuevoId('s'), codigo, profundidad, inclinacion, azimut };
  }

  /**
   * Fusiona las plataformas importadas con las que ya hay en pantalla.
   *
   * Se agrupan por nombre en mayúsculas para no duplicar `PL-01` y `pl-01`. Las
   * que no cupen se descartan y se cuentan: importando por encima del tope, el
   * archivo tendría plataformas ignoradas en silencio, que es justo lo que este
   * bloque quiere evitar.
   */
  private fusionarPlataformasImportadas(entrantes: readonly Plataforma[]): {
    plataformas: readonly Plataforma[];
    nuevas: number;
    fusionadas: number;
    omitidasPorCupo: number;
  } {
    let nuevas = 0;
    let fusionadas = 0;
    let omitidasPorCupo = 0;
    this.estadoPlataformas.update((lista) => {
      const resultado = [...lista];
      for (const entrante of entrantes) {
        const indice = resultado.findIndex(
          (fila) => fila.nombre.trim().toUpperCase() === entrante.nombre.trim().toUpperCase(),
        );
        if (indice >= 0) {
          const existente = resultado[indice];
          resultado[indice] = {
            ...existente,
            sondajes: [...existente.sondajes, ...entrante.sondajes],
          };
          fusionadas += 1;
          continue;
        }
        if (resultado.length >= MAXIMO_PLATAFORMAS) {
          omitidasPorCupo += 1;
          continue;
        }
        resultado.push(entrante);
        nuevas += 1;
      }
      return resultado;
    });
    return { plataformas: this.estadoPlataformas(), nuevas, fusionadas, omitidasPorCupo };
  }

  /* ------------------------------------------------------------------
     ÁREAS Y VOLÚMENES DERIVADOS
     ------------------------------------------------------------------
     Área unitaria, área total y volumen se calculan al leer, no se guardan.
     Guardados, cualquier edición de ancho, largo o profundidad los deja
     desfasados y hace falta una segunda pasada que los reescriba; mientras
     que como derivadas no pueden dejar de cuadrar con sus factores.
     ------------------------------------------------------------------ */

  /** Área de la cara de un componente, en metros cuadrados. */
  protected areaDe(dim: Dimension): number {
    return dim.ancho * dim.largo;
  }

  /** Área total de todos los ejemplares, en metros cuadrados. */
  protected areaTotalDe(dim: Dimension): number {
    return this.areaDe(dim) * dim.cantidad;
  }

  /** Volumen total de todos los ejemplares, en metros cúbicos. */
  protected volumenTotalDe(dim: Dimension): number {
    return this.areaTotalDe(dim) * dim.profundidad;
  }

  /** Suma de las áreas totales declaradas. */
  protected readonly areaTotalGeneral = computed(() =>
    this.dimensiones().reduce((total, dim) => total + this.areaTotalDe(dim), 0),
  );

  /** Suma de los volúmenes totales declarados. */
  protected readonly volumenTotalGeneral = computed(() =>
    this.dimensiones().reduce((total, dim) => total + this.volumenTotalDe(dim), 0),
  );

  /* ------------------------------------------------------------------
     MENSAJES Y VALIDACIÓN
     ------------------------------------------------------------------ */

  /** Resultado de la última acción: importación, alta, error de regrabado. */
  protected readonly mensaje = signal<string | null>(null);

  /** Motivo por el que la matriz no puede validarse todavía. */
  protected readonly bloqueo = computed<string | null>(() => {
    const plataformas = this.plataformas();
    if (plataformas.length === 0) {
      return 'Registre al menos una plataforma de perforación.';
    }
    if (plataformas.length > MAXIMO_PLATAFORMAS) {
      return `La sección admite hasta ${MAXIMO_PLATAFORMAS} plataformas y hay ${plataformas.length}.`;
    }
    if (plataformas.some((fila) => fila.nombre.trim() === '')) {
      return 'Todas las plataformas necesitan nombre.';
    }
    const plataformaRepetida = this.nombreRepetido(this.plataformas(), (fila) => fila.nombre);
    if (plataformaRepetida !== null) {
      return `La plataforma ${plataformaRepetida} está repetida.`;
    }
    if (plataformas.some((fila) => fila.este <= 0 || fila.norte <= 0)) {
      return 'Todas las plataformas necesitan su coordenada UTM (Este y Norte).';
    }
    const sinSondaje = this.plataformasSinSondaje();
    if (sinSondaje.length > 0) {
      const nombres = sinSondaje
        .map((fila) => fila.nombre.trim() || 'sin nombre')
        .slice(0, 3)
        .join(', ');
      const resto = sinSondaje.length > 3 ? ` y ${sinSondaje.length - 3} más` : '';
      return `Cada plataforma requiere al menos una perforación: falta en ${nombres}${resto}.`;
    }
    if (plataformas.some((fila) => fila.sondajes.some((sondaje) => sondaje.codigo.trim() === ''))) {
      return 'Todos los sondajes necesitan código.';
    }
    if (plataformas.some((fila) => fila.sondajes.some((sondaje) => sondaje.profundidad <= 0))) {
      return 'Todos los sondajes necesitan profundidad programada.';
    }
    if (this.auxiliares().some((fila) => fila.nombre.trim() === '')) {
      return 'Todos los auxiliares necesitan nombre.';
    }
    const auxiliarRepetido = this.nombreRepetido(this.auxiliares(), (fila) => fila.nombre);
    if (auxiliarRepetido !== null) {
      return `El componente auxiliar ${auxiliarRepetido} está repetido.`;
    }
    if (this.auxiliares().some((fila) => fila.este <= 0 || fila.norte <= 0)) {
      return 'Todos los auxiliares necesitan su coordenada UTM (Este y Norte).';
    }
    if (this.dimensiones().some((fila) => fila.nombreComponente.trim() === '')) {
      return 'Todos los dimensionamientos necesitan nombre de componente.';
    }
    const componenteRepetido = this.nombreRepetido(
      this.dimensiones(),
      (fila) => fila.nombreComponente,
    );
    if (componenteRepetido !== null) {
      return `El componente ${componenteRepetido} está repetido.`;
    }
    const negativo = this.primerNegativo();
    if (negativo) {
      return negativo;
    }
    const angular = this.primerAngularFueraDeRango();
    if (angular) {
      return angular;
    }
    if (this.dimensiones().some((fila) => fila.cantidad < 1)) {
      return 'La cantidad de cada componente debe ser al menos 1.';
    }
    return null;
  });

  protected readonly matrizValida = computed(() => this.bloqueo() === null);

  /**
   * Primer nombre repetido de una colección, o `null` si no hay ninguno.
   *
   * Se comparan los nombres recortados y en mayúsculas porque es como los
   * guarda el popup: dos filas que solo difieren en mayúsculas o en un espacio
   * final son indistinguibles en el inventario, y una de las dos quedaría con
   * datos que parece no existir. Es la misma comparación que aplican los tres
   * popups al grabar, así que el motivo no cambia entre el aviso y el bloqueo.
   *
   * Devuelve el nombre tal como está en la fila que ya existía, no el de la
   * que se acaba de teclear: el aviso tiene que apuntar a la fila que el
   * titular ya ve en la tabla.
   */
  private nombreRepetido<T>(filas: readonly T[], nombreDe: (fila: T) => string): string | null {
    const vistos = new Map<string, string>();
    for (const fila of filas) {
      const nombre = nombreDe(fila).trim();
      const clave = nombre.toUpperCase();
      const anterior = vistos.get(clave);
      if (anterior !== undefined) {
        return anterior;
      }
      vistos.set(clave, nombre);
    }
    return null;
  }

  /**
   * Rehidrata las matrices con lo ya validado.
   *
   * Los identificadores los conserva el store: el `@for` empareja cada fila con
   * su nodo por `id`, así que un identificador distinto en cada guardado sacaría
   * el DOM de una fila del sitio al recuperar la sección.
   */
  constructor() {
    effect(() => {
      const guardado = this.store.matrizComponentesRegistrada();
      if (!guardado) {
        return;
      }
      this.estadoPlataformas.set(guardado.plataformas);
      this.estadoAuxiliares.set(guardado.auxiliares);
      this.estadoDimensiones.set(guardado.dimensiones);
    });
  }

  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** Publica la matriz y pone la sección en verde. */
  protected guardarYValidarComponentesSeccion(): void {
    const bloqueo = this.bloqueo();
    if (bloqueo) {
      this.mensaje.set(bloqueo);
      return;
    }
    this.store.registrarMatrizComponentes({
      plataformas: this.plataformas(),
      auxiliares: this.auxiliares(),
      dimensiones: this.dimensiones(),
    });
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.mensaje.set('Componentes validados.');
  }

  /**
   * Primer campo numérico en negativo, en cualquiera de las tres matrices.
   *
   * Los negativos no se truncan al teclear porque el input está atado al modelo
   * con `[ngModel]` y una sobrescritura silenciosa lo dejaría desincronizado de
   * lo tecleado; se rechazan aquí, con el motivo a la vista.
   */
  private primerNegativo(): string | null {
    for (const fila of this.plataformas()) {
      for (const [campo, etiqueta] of CAMPOS_DE_PLATAFORMA) {
        if (fila[campo] < 0) {
          return `La plataforma ${fila.nombre.trim() || 'sin nombre'} tiene ${etiqueta} en negativo.`;
        }
      }
      for (const sondaje of fila.sondajes) {
        for (const [campo, etiqueta] of CAMPOS_DE_SONDAJE) {
          if (sondaje[campo] < 0) {
            return `El sondaje ${sondaje.codigo.trim() || 'sin código'} tiene ${etiqueta} en negativo.`;
          }
        }
      }
    }
    for (const fila of this.auxiliares()) {
      for (const [campo, etiqueta] of CAMPOS_DE_AUXILIAR) {
        if (fila[campo] < 0) {
          return `El auxiliar ${fila.nombre.trim() || 'sin nombre'} tiene ${etiqueta} en negativo.`;
        }
      }
    }
    for (const fila of this.dimensiones()) {
      for (const [campo, etiqueta] of CAMPOS_DE_DIMENSION) {
        if (fila[campo] < 0) {
          return `El componente ${fila.nombreComponente.trim() || 'sin nombre'} tiene ${etiqueta} en negativo.`;
        }
      }
    }
    return null;
  }

  /**
   * Inclinación o azimut fuera de su rango físico.
   *
   * Un azimut de 400° o una inclinación de 120° son delatables a simple vista,
   * pero no bloquean nada por sí solos y terminarían en un informe de sondeos
   * con cifras imposibles.
   */
  private primerAngularFueraDeRango(): string | null {
    for (const fila of this.plataformas()) {
      for (const sondaje of fila.sondajes) {
        if (sondaje.inclinacion > 90) {
          return `El sondaje ${sondaje.codigo.trim() || 'sin código'} tiene una inclinación mayor de 90°.`;
        }
        if (sondaje.azimut > 360) {
          return `El sondaje ${sondaje.codigo.trim() || 'sin código'} tiene un azimut mayor de 360°.`;
        }
      }
    }
    return null;
  }
}

/* ------------------------------------------------------------------
   CAMPOS DE TEXTO Y NUMÉRICOS POR FILA

   Los conjuntos deciden si un campo se guarda tal cual llega del `input` o pasa
   por `aNumero`. Separarlos por tabla evita un `if` por campo en el medio de la
   actualización inmutable.
   ------------------------------------------------------------------ */

type TextoDeSondaje = 'codigo';
type NumeroDePlataforma = 'altitud' | 'distanciaAgua';
type NumeroDeSondaje = 'profundidad' | 'inclinacion' | 'azimut';
type TextoDeAuxiliar = 'nombre' | 'cuerpoAgua';
type NumeroDeAuxiliar = 'este' | 'norte' | 'altitud' | 'distanciaAgua';
type TextoDeDimension = 'nombreComponente';
type NumeroDeDimension = 'ancho' | 'largo' | 'profundidad' | 'cantidad';

const CAMPO_NUMERICO_DE_SONDAJE: ReadonlySet<string> = new Set<NumeroDeSondaje>([
  'profundidad',
  'inclinacion',
  'azimut',
]);

const CAMPO_NUMERICO_DE_AUXILIAR: ReadonlySet<string> = new Set<NumeroDeAuxiliar>([
  'este',
  'norte',
  'altitud',
  'distanciaAgua',
]);

const CAMPO_NUMERICO_DE_DIMENSION: ReadonlySet<string> = new Set<NumeroDeDimension>([
  'ancho',
  'largo',
  'profundidad',
  'cantidad',
]);

/** Campos numéricos y su rótulo, para nombrar el motivo de un rechazo. */
const CAMPOS_DE_PLATAFORMA: ReadonlyArray<readonly [NumeroDePlataforma, string]> = [
  ['altitud', 'la altitud'],
  ['distanciaAgua', 'la distancia al agua'],
];

const CAMPOS_DE_SONDAJE: ReadonlyArray<readonly [NumeroDeSondaje, string]> = [
  ['profundidad', 'la profundidad'],
  ['inclinacion', 'la inclinación'],
  ['azimut', 'el azimut'],
];

const CAMPOS_DE_AUXILIAR: ReadonlyArray<readonly [NumeroDeAuxiliar, string]> = [
  ['este', 'el Este (X)'],
  ['norte', 'el Norte (Y)'],
  ['altitud', 'la altitud'],
  ['distanciaAgua', 'la distancia al agua'],
];

const CAMPOS_DE_DIMENSION: ReadonlyArray<readonly [NumeroDeDimension, string]> = [
  ['ancho', 'el ancho'],
  ['largo', 'el largo'],
  ['profundidad', 'la profundidad'],
  ['cantidad', 'la cantidad'],
];

/**
 * Convierte el texto de un campo numérico, con respaldo a cero.
 *
 * El texto llega tal cual lo tecleó el titular, incluido un negativo: la
 * plantilla está atada al modelo con `[ngModel]`, así que reescribir el valor
 * aquí dejaría el input mostrando `-5000` mientras el modelo guarda `0`, y
 * bastaría un redibujado para que el número saltase bajo el cursor. Un
 * negativo se rechaza al validar, no en silencio. `Number('')` es `0`, y
 * `parseFloat` devuelve `NaN` en los campos a medio teclear: de ahí el
 * `isFinite`.
 *
 * `entrada` admite número porque el `value accessor` de los `<input type=number>`
 * entrega un `number` ya interpretado, no el texto tecleado.
 */
function aNumero(entrada: string | number, respaldo: number): number {
  const valor = typeof entrada === 'number' ? entrada : Number.parseFloat(entrada);
  return Number.isFinite(valor) ? valor : respaldo;
}

/**
 * Igual que `aNumero`, pero para el borrador del modal.
 *
 * Aquí un campo vacío sí es `null` y no `0`: el formulario distingue "sin
 * llenar" de "cero tecleado", y no se grava una plataforma sin coordenada.
 */
function aNumeroONulo(entrada: string | number): number | null {
  if (typeof entrada === 'string' && entrada.trim() === '') {
    return null;
  }
  const valor = Number.parseFloat(String(entrada));
  return Number.isFinite(valor) ? valor : null;
}

/* ------------------------------------------------------------------
   LECTURA DEL CSV DE PLATAFORMAS
   ------------------------------------------------------------------ */

/** Posiciones de cada campo en el CSV; `-1` cuando la columna no viene. */
interface Columnas {
  readonly plataforma: number;
  readonly este: number;
  readonly norte: number;
  readonly altitud: number;
  readonly cuerpoAgua: number;
  readonly distanciaAgua: number;
  readonly sondaje: number;
  readonly profundidad: number;
  readonly inclinacion: number;
  readonly azimut: number;
}

/**
 * Reduce un encabezado a una clave comparable.
 *
 * "Cuerpo de Agua", "cuerpo_de_agua" y "CUERPO DE AGUA" tienen que resolver a la
 * misma columna, así que se quitan tildes, signos y espacios antes de comparar.
 */
function claveDeCabecera(encabezado: string): string {
  return encabezado
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Alias aceptados por columna, en el orden en que se buscan. */
const ALIAS: Readonly<Record<keyof Columnas, readonly string[]>> = {
  plataforma: ['plataforma', 'nombreplataforma', 'codigoplataforma', 'nombre', 'idplataforma'],
  este: ['este', 'estex', 'coordenadax', 'x'],
  norte: ['norte', 'nortey', 'coordenaday', 'y'],
  altitud: ['altitud', 'altura', 'cota', 'elevacion', 'z'],
  cuerpoAgua: ['cuerpodeagua', 'cuerpoagua', 'fuenteagua', 'aguacercana'],
  distanciaAgua: ['distanciaalagua', 'distanciaagua', 'distancia'],
  sondaje: [
    'codigosondaje',
    'codigodelsondaje',
    'numerodesondaje',
    'sondaje',
    'sondajecodigo',
    'perforacion',
    'codigo',
    'pozo',
  ],
  profundidad: ['profundidadprogramada', 'profundidad', 'prof'],
  inclinacion: ['inclinacion', 'incl'],
  azimut: ['azimut', 'azim'],
};

/** Localiza cada columna por alias; una que no existe queda en `-1`. */
function resolverColumnas(cabeceras: readonly string[]): Columnas {
  const buscar = (clave: keyof Columnas): number => {
    const alias = ALIAS[clave];
    for (const nombre of alias) {
      const indice = cabeceras.indexOf(nombre);
      if (indice >= 0) {
        return indice;
      }
    }
    return -1;
  };
  return {
    plataforma: buscar('plataforma'),
    este: buscar('este'),
    norte: buscar('norte'),
    altitud: buscar('altitud'),
    cuerpoAgua: buscar('cuerpoAgua'),
    distanciaAgua: buscar('distanciaAgua'),
    sondaje: buscar('sondaje'),
    profundidad: buscar('profundidad'),
    inclinacion: buscar('inclinacion'),
    azimut: buscar('azimut'),
  };
}

/** Texto de una celda, o cadena vacía si la columna no existe. */
function leerTexto(celdas: readonly string[], indice: number): string {
  return indice >= 0 ? (celdas[indice]?.trim() ?? '') : '';
}

/** Número de una celda, o cero si la columna no existe o no hay número. */
function leerNumero(celdas: readonly string[], indice: number): number {
  return aNumero(leerTexto(celdas, indice), 0);
}

/** Separador de la línea: el que más apariciones tenga en ella. */
function lineaConMasSeparadores(linea: string): string {
  const candidatos = [',', ';', '\t'];
  let mejor = ',';
  let maximo = -1;
  for (const candidato of candidatos) {
    const cuenta = linea.split(candidato).length - 1;
    if (cuenta > maximo) {
      maximo = cuenta;
      mejor = candidato;
    }
  }
  return mejor;
}
