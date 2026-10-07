import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore, type TipoIga } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '2.1';

/** Unidad minera activa que el titular puede vincular al trámite. */
interface UnidadMinera {
  readonly id: string;
  readonly nombre: string;
}

/** Opción disparadora del alta de una unidad que aún no figura en el padrón. */
const OPCION_NUEVA_UNIDAD = 'NUEVA_UNIDAD';

/**
 * Padrón de unidades presented en el expediente.
 *
 * En producción este listado llega del servicio de padrón de unidades mineras;
 * se declara local para no simular una dependencia HTTP que el maquete no
 * necesita.
 */
const UNIDADES_MINERAS: readonly UnidadMinera[] = [
  { id: 'U_DUNAS', nombre: 'Unidad Las Dunas' },
  { id: 'U_CENTRO', nombre: 'Acumulación Centro' },
];

/**
 * Complejidad del instrumento según el tipo de IGA.
 *
 * El tipo viene del store porque el expediente se puede abrir desde cualquier
 * fila de la bandeja, no siempre como DAEX.
 */
const COMPLEJIDAD_POR_IGA: Record<TipoIga, string> = {
  DAEX: 'Menor Complejidad',
  AIAD: 'Amplia Información Adicional',
  AIAI: 'Amplia Información de Impacto Ambiental',
  AISD: 'Integrada de Sulfuros',
  AISI: 'Integrada de Sustancias Inertes',
  ITS: 'Informe Técnico Sustentatorio',
};

/**
 * Microcomponente de la sección 2.1 · Datos Generales del Proyecto.
 *
 * Se divide en dos bloques con permisos distintos: el bloque maestro, que
 * replica la identidad del expediente y es de solo lectura, y el registro activo,
 * que el titular completa. Los campos locales viven en signals y solo viajan al
 * store cuando la sección se valida, para que un guardado a medias no ensucie la
 * cabecera del formulario.
 */
@Component({
  selector: 'app-datos-proyecto',
  templateUrl: './datos-proyecto.component.html',
  styleUrls: ['./datos-proyecto.component.css'],
})
export class DatosProyectoComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta al apilar las fichas, de modo que el semáforo se
   * confirme contra la fila que corresponde en lugar de contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Padrón de unidades mineras del expediente. */
  protected readonly unidades = UNIDADES_MINERAS;

  /** Valor del selector para el alta de una unidad no registrada. */
  protected readonly idNuevaUnidad = OPCION_NUEVA_UNIDAD;

  protected readonly nombreProyecto = signal<string>('');
  protected readonly unidadMineraSeleccionada = signal<string>('');
  protected readonly montoInversion = signal<number | null>(null);
  protected readonly vidaUtil = signal<number | null>(null);

  /** Marca de confirmación, para acusar recibo del guardado sin abrir un toast. */
  protected readonly guardado = signal(false);

  /**
   * Metadatos de la sección, resueltos contra el árbol del store.
   *
   * El encabezado se rotula con el título que el árbol declara para 2.1, en
   * lugar de repetir el texto en el marcado. `seccionPorNumero` devuelve
   * `null` si el índice no existe en el árbol, de ahí el acceso opcional en la
   * plantilla con su título de reserva.
   */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** Etiqueta del instrumento con su nivel de complejidad. */
  protected readonly instrumento = computed(
    () =>
      `${this.store.formulario().tipoIga} · ${COMPLEJIDAD_POR_IGA[this.store.formulario().tipoIga]}`,
  );

  /** Etiqueta a grabar: la opción de alta aún no tiene unidad asociada. */
  protected readonly unidadResuelta = computed(() => {
    const seleccion = this.unidadMineraSeleccionada();
    if (seleccion === OPCION_NUEVA_UNIDAD) {
      return 'Unidad Minera en registro';
    }
    return UNIDADES_MINERAS.find((unidad) => unidad.id === seleccion)?.nombre ?? '';
  });

  /** Verdadero cuando la unidad elegida es la que aún no figura en el padrón. */
  protected readonly unidadPendiente = computed(
    () => this.unidadMineraSeleccionada() === OPCION_NUEVA_UNIDAD,
  );

  /**
   * Validador en caliente del botón de guardado.
   *
   * El nombre exige texto no vacío y los dos campos numéricos exigen un valor
   * estrictamente mayor que cero: una inversión de 0 o una vida útil de 0 meses
   * describen un proyecto que no existe.
   */
  protected readonly formularioValido = computed(() => {
    const nombre = this.nombreProyecto().trim();
    const monto = this.montoInversion();
    const vidaUtil = this.vidaUtil();

    return (
      nombre.length > 0 &&
      this.unidadMineraSeleccionada().length > 0 &&
      monto !== null &&
      monto > 0 &&
      vidaUtil !== null &&
      vidaUtil > 0
    );
  });

  protected alEscribirNombre(evento: Event): void {
    this.nombreProyecto.set((evento.target as HTMLInputElement).value);
    this.guardado.set(false);
  }

  protected alElegirUnidad(evento: Event): void {
    this.unidadMineraSeleccionada.set((evento.target as HTMLSelectElement).value);
    this.guardado.set(false);
  }

  protected alEscribirMonto(evento: Event): void {
    this.montoInversion.set(this.aNumero(evento));
    this.guardado.set(false);
  }

  protected alEscribirVidaUtil(evento: Event): void {
    this.vidaUtil.set(this.aNumero(evento));
    this.guardado.set(false);
  }

  /**
   * Interpreta el contenido de un input numérico.
   *
   * Se descarta cualquier valor no numérico en lugar de propagar `NaN`: un
   * `NaN` en la señal rompería la comparación `> 0` del validador sin avisar.
   */
  private aNumero(evento: Event): number | null {
    const bruto = (evento.target as HTMLInputElement).value.trim();
    if (bruto === '') {
      return null;
    }
    const numero = Number(bruto);
    return Number.isFinite(numero) ? numero : null;
  }

  /**
   * Publica la sección y la pasa a verde.
   *
   * El semáforo solo se muta cuando la validación pasa, de modo que el ícono de
   * conformidad nunca se anticipe a los datos que lo respaldan.
   */
  protected guardarYValidarSeccion(): void {
    if (!this.formularioValido()) {
      return;
    }

    this.store.actualizarFormulario({
      nombreProyecto: this.nombreProyecto().trim(),
      unidadMinera: this.unidadResuelta(),
    });
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.guardado.set(true);
  }
}
