import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DaexStore,
  type EstadoTramite,
  type Expediente,
  type FiltrosSolicitudes,
  type Notificacion,
  type TipoIga,
} from '../../state/daex.store';
import { esVentanaEstrecha } from '../../utilidades/ventana';
import { ReporteImpresionComponent } from '../formulario-iga/reporte-impresion/reporte-impresion.component';

/**
 * Vistas de la bandeja general.
 *
 * La consola solo lista y notifica: la edición del expediente DAEX vive en
 * `FormularioIgaComponent`, en la ruta `/formulario-iga`.
 */
type VistaActiva = 'SOLICITUDES' | 'NOTIFICACIONES';

/** Opción del catálogo de instrumentos ofrecida por el modal de nuevo DAEX. */
interface OpcionIga {
  readonly tipo: TipoIga;
  readonly titulo: string;
  readonly vinetas: readonly string[];
}

/** Notificación con la marca de tiempo del acuse ya resuelta para el marcado. */
interface NotificacionDecorada extends Notificacion {
  /** `null` mientras el acto administrativo no se ha descargado. */
  readonly acuse: string | null;
}

/** Margen de página del PDF de acuse, en puntos. */
const MARGEN_PDF = 56;

/**
 * Fila del catálogo maestro de comunicaciones y obligaciones posteriores.
 *
 * Extraída de la hoja de cálculo de la maestra legal: cada fila identifica la
 * obligación con un `idNota` correlativo, su glosa y el articulado que la
 * ampara. Es catálogo cerrado, por eso viaja como constante y no como signal.
 */
interface NotaComunicacionPosterior {
  readonly idNota: number;
  readonly descripcion: string;
  readonly articulo: string;
}

const MAESTRO_NOTAS_COMUNICACIONES: readonly NotaComunicacionPosterior[] = [
  {
    idNota: 1,
    descripcion: 'Comunicación de Responsabilidad del Titular',
    articulo: 'Artículo 16° y 22° D.S. N° 040-2014-EM',
  },
  { idNota: 2, descripcion: 'Comunicación de Inicio de Actividades', articulo: '17°' },
  {
    idNota: 3,
    descripcion: 'Comunicación de obstaculización de actividad de exploración',
    articulo: '18°',
  },
  {
    idNota: 4,
    descripcion: 'Modificación del plazo de Ejecución (no mayor de 6 meses)',
    articulo: '26°',
  },
  { idNota: 5, descripcion: 'Modificación del alcance de la DIA aprobada', articulo: '33°' },
  { idNota: 6, descripcion: 'Comunicación de Cierre Final de Actividades', articulo: '41°' },
  { idNota: 7, descripcion: 'Transito hacia la exploración', articulo: '42°' },
  { idNota: 8, descripcion: 'Comunicación de MOdificación de EIASD', articulo: '36.2°' },
  {
    idNota: 13,
    descripcion: 'Comunicación de variaciones no significativas a la clasificación',
    articulo: 'Artículo 45° D.S. N° 019-2009-MINAM',
  },
  {
    idNota: 14,
    descripcion: 'Comunicación de mecanismo de participación ciudadana antes',
    articulo: 'Artículo 4° R.M. N° 092-2014-MEM/DM',
  },
  {
    idNota: 9,
    descripcion: 'Comunicación de Ampliación de Plazo de Observaciones',
    articulo: '136°',
  },
  {
    idNota: 11,
    descripcion: 'Plan de Participación Ciudadana',
    articulo: 'Artículo 29°, literal d) DS N° 040-2014-EM',
  },
  {
    idNota: 12,
    descripcion: 'Comunicación de Inicio de Elaboración de Estudio Ambiental',
    articulo: 'Artículo 29°, literal b) DS N° 040-2014-EM',
  },
  { idNota: 19, descripcion: 'Comunicación de Informacion Complementaria', articulo: 'otros' },
  {
    idNota: 20,
    descripcion: 'Comunicación de reubicación de componentes de exploración',
    articulo: 'otras comunicaciones',
  },
  {
    idNota: 21,
    descripcion: 'Comunicación de suspención de actividades de exploracion',
    articulo: 'otras comunicaciones',
  },
  {
    idNota: 22,
    descripcion: 'Comunicación de Excepción del Cierre Final y/o Transferencia de',
    articulo: 'otras comunicaciones',
  },
  { idNota: 15, descripcion: 'INFORME SEMESTRAL DEL SEMESTRE_1', articulo: 'PCM' },
  { idNota: 16, descripcion: 'INFORME SEMESTRAL DEL SEMESTRE_2', articulo: 'PCM' },
  { idNota: 17, descripcion: 'GARANTIA ANUAL', articulo: 'PCM' },
  { idNota: 18, descripcion: 'OTROS', articulo: 'PCM' },
];

@Component({
  selector: 'app-workspace',
  imports: [ReporteImpresionComponent],
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.css'],
})
export class WorkspaceComponent implements OnDestroy {
  protected readonly store = inject(DaexStore);
  private readonly router = inject(Router);
  private readonly panelModal = viewChild<ElementRef<HTMLElement>>('panelModal');

  /** Vista renderizada en el panel central. */
  protected readonly vistaActiva = signal<VistaActiva>('SOLICITUDES');

  /** Colapso del menú lateral: alterna `w-72` y `w-0`. */
  /**
   * Colapso del índice lateral.
   *
   * Arranca plegado por debajo de 768 px: con el índice abierto a 288 px, el
   * contenido de trabajo se queda sin sitio útil en una ventana estrecha o en
   * una tableta. El titular lo despliega con el botón `[≡]` cuando lo necesita.
   */
  protected readonly menuColapsado = signal(esVentanaEstrecha());

  /** Visibilidad del menú flotante de la sesión. */
  protected readonly menuSesionAbierto = signal(false);

  /** Visibilidad del modal esmerilado de selección de IGA. */
  protected readonly modalAbierto = signal(false);

  /** Visibilidad del popup de estrategia de modificación (bifurcación IGA / ITS). */
  protected readonly modalModificacionAbierto = signal(false);

  /** Alerta técnica de ITS visible dentro del popup de modificación. */
  protected readonly mostrarAlertaIts = signal(false);

  /**
   * Cierra el informe de impresión una vez que el navegador termina de
   * componer el PDF. Desmontarlo evita mantener 26 fichas vivas en el fondo
   * del workspace después de imprimir o cancelar el diálogo.
   */
  private readonly cerrarInformePorImpresionTerminada = (): void => {
    this.reporteAbierto.set(false);
  };

  constructor() {
    window.addEventListener('afterprint', this.cerrarInformePorImpresionTerminada);
  }

  ngOnDestroy(): void {
    window.removeEventListener('afterprint', this.cerrarInformePorImpresionTerminada);
  }

  /** Expediente de referencia cuyo IGA se va a modificar. */
  protected readonly expedienteIdEnModificacion = signal('');

  /** Aviso que resume la apertura del ITS derivado, descartable por el titular. */
  protected readonly avisoItsCreado = signal<string | null>(null);

  /** Visibilidad del popup del catálogo de comunicaciones posteriores. */
  protected readonly modalComunicacionesAbierto = signal(false);

  /** Expediente de referencia cuyo ciclo de vida se está consultando. */
  protected readonly expedienteActivoId = signal('');

  /** Texto del buscador interno del catálogo de comunicaciones. */
  protected readonly busquedaFiltroNota = signal('');

  /** Aviso que confirma la apertura de un trámite derivado de obligación posterior. */
  protected readonly avisoComunicacionCreado = signal<string | null>(null);

  /** Expediente cuyo informe consolidado se está descargando. */
  protected readonly expedienteParaImprimir = signal<Expediente | null>(null);

  /** Presencia del informe de impresión en el DOM (oculto hasta `@media print`). */
  protected readonly reporteAbierto = signal(false);

  /** Instrumento elegido en el modal antes de iniciar el registro. */
  protected readonly igaSeleccionada = signal<TipoIga | null>(null);

  /** Catálogo de instrumentos del modal, con su ayuda normativa directa. */
  protected readonly opcionesIga: readonly OpcionIga[] = [
    {
      tipo: 'DAEX',
      titulo: 'Declaración Jurada de Inicio de Actividades Mineras',
      vinetas: [
        'Soporta un máximo estricto de hasta 10 plataformas físicas de perforación.',
        'Área efectiva total a disturbar menor a 5 hectáreas.',
      ],
    },
    {
      tipo: 'AIAD',
      titulo: 'Autorización de Inicio de Actividades de Desarrollo Minero',
      vinetas: [
        'Requiere georreferenciación UTM WGS84 de todas las capas declaradas.',
        'Plazo de vigencia de hasta 24 meses.',
      ],
    },
    {
      tipo: 'AIAI',
      titulo: 'Autorización de Inicio de Actividades de Investigación Minera',
      vinetas: ['Máximo 10 plataformas de exploración por expediente.'],
    },
    {
      tipo: 'AISD',
      titulo: 'Autorización de Inicio de Actividades de Saneamiento',
      vinetas: ['Plazo de vigencia de hasta 12 meses.'],
    },
    {
      tipo: 'AISI',
      titulo: 'Autorización de Inicio de Actividades de Instalación',
      vinetas: ['Exige certificado de conformidad de uso de suelo vigente.'],
    },
  ];

  /** Título de la cabecera: refleja siempre la vista activa. */
  protected readonly tituloVista = computed(() =>
    this.vistaActiva() === 'SOLICITUDES'
      ? 'Listado de Solicitudes de IGAs'
      : 'Notificaciones y Cargos de la DGAAM',
  );

  /** Iniciales del titular para el avatar de la cabecera. */
  protected readonly iniciales = computed(() => {
    const palabras = this.store.razonSocial().trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      return '··';
    }
    const inicial = palabras[0]?.charAt(0) ?? '';
    const final = palabras.length > 1 ? (palabras.at(-1)?.charAt(0) ?? '') : '';
    return (inicial + final).toUpperCase();
  });

  /** Filas que muestra la página activa. */
  protected readonly totalMostrado = computed(() => this.store.expedientesPaginados().length);

  /** Ventana de hasta cinco páginas alrededor de la actual. */
  protected readonly paginasVisibles = computed(() => {
    const total = this.store.totalPaginas();
    const desde = Math.max(1, this.store.pagina() - 2);
    const hasta = Math.min(total, desde + 4);
    return Array.from({ length: hasta - desde + 1 }, (_, indice) => desde + indice);
  });

  /** Clases del CTA del modal: el sello dorado solo aparece con instrumento elegido. */
  protected readonly claseBotonModal = computed(() =>
    this.igaSeleccionada() ? 'boton-oro' : 'boton-tenue cursor-not-allowed',
  );

  /**
   * Motor de búsqueda reactivo del catálogo de comunicaciones.
   * Filtra las filas de la maestra según coincida con la glosa de la
   * descripción, con el articulado legal o con el propio `idNota`.
   */
  protected readonly catalogoNotasFiltrado = computed(() => {
    const texto = this.busquedaFiltroNota().trim().toLowerCase();
    if (!texto) {
      return MAESTRO_NOTAS_COMUNICACIONES;
    }
    return MAESTRO_NOTAS_COMUNICACIONES.filter(
      (nota) =>
        nota.descripcion.toLowerCase().includes(texto) ||
        nota.articulo.toLowerCase().includes(texto) ||
        nota.idNota.toString().includes(texto),
    );
  });

  // -----------------------------------------------------------------
  // NAVEGACIÓN Y VISTAS
  // -----------------------------------------------------------------

  protected cambiarVista(vista: VistaActiva): void {
    this.vistaActiva.set(vista);
  }

  /** Colapsa y expande el menú lateral con transición de ancho. */
  protected alternarMenu(): void {
    this.menuColapsado.update((colapsado) => !colapsado);
  }

  protected alternarMenuSesion(): void {
    this.menuSesionAbierto.update((abierto) => !abierto);
  }

  protected cerrarMenuSesion(): void {
    this.menuSesionAbierto.set(false);
  }

  protected async cerrarSesion(): Promise<void> {
    this.cerrarMenuSesion();
    this.store.limpiarSesion();
    await this.router.navigate(['/login']);
  }

  // -----------------------------------------------------------------
  // FILTRADO Y PAGINACIÓN
  // -----------------------------------------------------------------

  protected filtrarPor(
    campo: 'numeroExpediente' | 'nombreProyecto' | 'unidadMinera',
    evento: Event,
  ): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.store.filtrar({ [campo]: valor } as Partial<FiltrosSolicitudes>);
  }

  protected filtrarEstado(evento: Event): void {
    this.store.filtrar({
      estado: (evento.target as HTMLSelectElement).value as EstadoTramite | 'TODOS',
    });
  }

  protected filtrarTipo(evento: Event): void {
    this.store.filtrar({
      tipoIga: (evento.target as HTMLSelectElement).value as TipoIga | 'TODOS',
    });
  }

  /** `Buscar` reafirma los criterios; el filtrado ya es reactivo. */
  protected buscar(): void {
    this.store.irAPagina(1);
  }

  protected limpiar(): void {
    this.store.limpiarFiltros();
  }

  protected irAPagina(pagina: number): void {
    this.store.irAPagina(pagina);
  }

  // -----------------------------------------------------------------
  // ACCIONES DE FILA
  // -----------------------------------------------------------------

  /**
   * DETONADOR DE MODO LECTURA PROTEGIDO
   * Abre el formulario IGA bloqueando de forma radical la inserción, edición y
   * eliminación de datos.
   *
   * Primero se carga el contexto del expediente en el store —igual que lo hace
   * `editar`— para que la cabecera del formulario no herede un borrador ajeno;
   * luego se enciende el candado de solo lectura y se navega pasando la
   * referencia y el modo por la URL, que el formulario consumirá más adelante.
   */
  protected ingresarAFormularioModoConsulta(expedienteId: string): void {
    const origen = this.store
      .expedientes()
      .find(
        (expediente) =>
          expediente.id === expedienteId || expediente.numeroExpediente === expedienteId,
      );
    if (origen) {
      this.store.editarExpediente(origen);
    }

    // 1. Encender el candado de solo lectura en el Store Central.
    this.store.activarModoSoloConsulta(true);

    // 2. Redirigir al formulario-iga pasando el id del expediente en los
    //    parámetros de ruta.
    void this.router.navigate(['/formulario-iga'], {
      queryParams: { ref: expedienteId, modo: 'CONSULTA' },
    });
  }

  protected editar(expediente: Expediente): void {
    this.store.editarExpediente(expediente);
    // La edición requiere el candado apagado: el modo viaja en la URL y la
    // bandera del store queda sincronizada con él desde la propia bandeja.
    this.store.activarModoSoloConsulta(false);
    void this.router.navigate(['/formulario-iga'], {
      queryParams: { ref: expediente.id, modo: 'EDICION' },
    });
  }

  /**
   * Descarga del expediente consolidado en PDF.
   *
   * Monta el informe oculto (todas las fichas de los siete capítulos en un solo
   * documento) y abre el diálogo nativo de impresión una tarea después, cuando
   * Angular ya haya proyectado el `NgComponentOutlet` de cada sección. El
   * navegador es quien exporta el PDF: "Guardar como PDF" o "Microsoft Print to
   * PDF". Al terminar (imprimir o cancelar), `afterprint` desmonta el informe.
   */
  protected imprimir(expediente: Expediente): void {
    this.expedienteParaImprimir.set(expediente);
    // La impresión es una captura de solo lectura: se enciende el mismo candado
    // que consulta, aunque el PDF se genere sin navegar fuera del workspace.
    this.store.activarModoSoloConsulta(true);
    this.reporteAbierto.set(true);
    setTimeout(() => window.print(), 0);
  }

  protected comunicaciones(expediente: Expediente): void {
    this.abrirModalComunicacionesPosteriores(expediente.numeroExpediente);
  }

  protected modificacion(expediente: Expediente): void {
    this.abrirModalOpcionesModificacion(expediente.numeroExpediente);
  }

  // -----------------------------------------------------------------
  // ESTRATEGIA DE MODIFICACIÓN · Bifurcación IGA / ITS
  // -----------------------------------------------------------------

  /**
   * Abre el popup que discrimina entre modificación significativa y el
   * trámite derivado ITS. La alerta de ITS arranca siempre colapsada para
   * que la decisión se pueda corregir antes de confirmar.
   */
  protected abrirModalOpcionesModificacion(expedienteId: string): void {
    this.expedienteIdEnModificacion.set(expedienteId);
    this.mostrarAlertaIts.set(false);
    this.modalModificacionAbierto.set(true);
  }

  protected cerrarModalModificacion(): void {
    this.modalModificacionAbierto.set(false);
    this.mostrarAlertaIts.set(false);
    this.expedienteIdEnModificacion.set('');
  }

  /** Opción 2: el titular detalla, y se revela la notificación técnica del ITS. */
  protected seleccionarOpcionItsNoSignificativa(): void {
    this.mostrarAlertaIts.set(true);
  }

  /**
   * Opción 1 (significativa): reabre el formulario IGA completo sobre el
   * expediente de referencia. Se carga el contexto en el store antes de
   * navegar para que la cabecera del formulario no herede un borrador ajeno.
   */
  protected irAlFormularioIgaModificacion(): void {
    const referencia = this.expedienteIdEnModificacion();
    const origen = this.store
      .expedientes()
      .find(
        (expediente) => expediente.id === referencia || expediente.numeroExpediente === referencia,
      );
    if (origen) {
      this.store.editarExpediente(origen);
    }
    // Reabrir para modificar es edición plena: candado apagado, igual que en el
    // resto de rutas de escritura del formulario.
    this.store.activarModoSoloConsulta(false);
    this.cerrarModalModificacion();
    void this.router.navigate(['/formulario-iga'], {
      queryParams: { ref: referencia, tipo: 'SIGNIFICATIVA', modo: 'EDICION' },
    });
  }

  /**
   * Confirma el ITS: persiste el expediente derivado en la bandeja y cierra el
   * popup. La grilla reacciona sola porque la lista del store es una signal;
   * el aviso hace visible el hito recién creado.
   */
  protected confirmarAperturaExpedienteIts(): void {
    const referencia = this.expedienteIdEnModificacion();
    const derivado = this.store.abrirExpedienteItsDerivado(referencia);
    if (derivado) {
      this.avisoItsCreado.set(
        `Se aperturó el ITS ${derivado.numeroExpediente} como hito derivado del IGA ${referencia}.`,
      );
    }
    this.cerrarModalModificacion();
  }

  protected cerrarAvisoIts(): void {
    this.avisoItsCreado.set(null);
  }

  // -----------------------------------------------------------------
  // CATÁLOGO DE COMUNICACIONES Y OBLIGACIONES POSTERIORES
  // -----------------------------------------------------------------

  /** Abre el catálogo de control de trámites corrientes del expediente. */
  protected abrirModalComunicacionesPosteriores(expedienteId: string): void {
    this.expedienteActivoId.set(expedienteId);
    this.busquedaFiltroNota.set('');
    this.modalComunicacionesAbierto.set(true);
  }

  protected cerrarModalComunicaciones(): void {
    this.modalComunicacionesAbierto.set(false);
    this.expedienteActivoId.set('');
  }

  /** Conecta la caja de búsqueda del catálogo con su signal. */
  protected buscarNota(evento: Event): void {
    this.busquedaFiltroNota.set((evento.target as HTMLInputElement).value);
  }

  /**
   * Levanta la sub-solicitud derivada de la obligación posterior elegida. Cierra
   * el catálogo y deja visible un aviso que resume el trámite aperturado; la
   * navegación al formulario específico de la comunicación llega en un paso
   * posterior.
   */
  protected iniciarTramiteComunicacionDerivada(nota: NotaComunicacionPosterior): void {
    const referencia = this.expedienteActivoId();
    if (referencia) {
      this.avisoComunicacionCreado.set(
        `Se aperturó el trámite derivado de la Obligación Posterior ` +
          `N° ${nota.idNota.toFixed(2)} — "${nota.descripcion}" para el expediente ${referencia}.`,
      );
    }
    this.cerrarModalComunicaciones();
  }

  protected cerrarAvisoComunicacion(): void {
    this.avisoComunicacionCreado.set(null);
  }

  // -----------------------------------------------------------------
  // MODAL ESMERILADO DE SELECCIÓN DE IGA
  // -----------------------------------------------------------------

  /** Abre el catálogo de IGA aislando los formularios del fondo. */
  protected abrirModalNuevo(): void {
    this.igaSeleccionada.set(null);
    this.modalAbierto.set(true);
    setTimeout(() => this.panelModal()?.nativeElement.focus());
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
    this.igaSeleccionada.set(null);
  }

  protected seleccionarIga(tipo: TipoIga): void {
    this.igaSeleccionada.set(tipo);
  }

  protected iniciarRegistro(): void {
    const tipo = this.igaSeleccionada();
    if (!tipo) {
      return;
    }
    this.cerrarModal();
    this.store.iniciarFormularioNuevo(tipo);
    // Un registro nuevo es una sesión de edición plena y así lo declara la ruta.
    this.store.activarModoSoloConsulta(false);
    void this.router.navigate(['/formulario-iga'], {
      queryParams: { modo: 'EDICION' },
    });
  }

  // -----------------------------------------------------------------
  // NOTIFICACIONES Y ACUSE DE RECIBO
  // -----------------------------------------------------------------

  /**
   * Descarga el acto administrativo y, a continuación, genera y descarga el
   * acuse de recibo electrónico, sellando la marca de tiempo en la sesión.
   * Las dos descargas se emiten en la misma tarea para que el navegador no
   * bloquee la segunda como descarga automática.
   */
  protected descargarCargo(notificacion: Notificacion): void {
    const sello = new Date();
    this.descargar(
      notificacion.nombreDocumento,
      new Blob([notificacion.contenidoDocumento], { type: 'text/plain;charset=utf-8' }),
    );
    this.descargar(
      `acuse-${notificacion.numeroExpediente}.pdf`,
      this.construirAcusePdf(notificacion, sello),
    );
    this.store.registrarAcuse(notificacion.id, sello);
  }

  protected acuseDe(notificacionId: string): string | undefined {
    return this.store.acuseDe(notificacionId);
  }

  /**
   * Notificaciones con la marca de tiempo del acuse ya resuelta. Evita invocar
   * el store dos veces por celda en la plantilla.
   */
  protected readonly notificacionesDecoradas = computed<readonly NotificacionDecorada[]>(() =>
    this.store.notificaciones().map((notificacion) => {
      const iso = this.store.acuseDe(notificacion.id);
      return { ...notificacion, acuse: iso ? this.formatearMarca(iso) : null };
    }),
  );

  /** Presenta la marca de tiempo del acuse en formato local legible. */
  protected formatearMarca(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) {
      return iso;
    }
    return fecha.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // -----------------------------------------------------------------
  // EXPORTACIÓN
  // -----------------------------------------------------------------

  /**
   * Exporta el conjunto filtrado a CSV con BOM UTF-8, formato que Excel abre
   * nativamente. Evita introducir una librería de hoja de cálculo.
   */
  protected exportarExcel(): void {
    const cabeceras = [
      'Tipo de IGA',
      'Nombre del Proyecto',
      'Unidad Minera',
      'Nº de Expediente',
      'Fecha de Envío',
      'Vigencia',
      'Estado',
    ];
    const filas = this.store
      .expedientesFiltrados()
      .map((expediente) => [
        expediente.tipoIga,
        expediente.nombreProyecto,
        expediente.unidadMinera,
        expediente.numeroExpediente,
        expediente.fechaEnvio ?? '',
        expediente.vigencia,
        expediente.estado,
      ]);
    const cuerpo = [cabeceras, ...filas]
      .map((fila) => fila.map((celda) => this.escaparCsv(celda)).join(','))
      .join('\r\n');
    this.descargar(
      'solicitudes-igas.csv',
      new Blob([`﻿${cuerpo}`], { type: 'text/csv;charset=utf-8' }),
    );
  }

  // -----------------------------------------------------------------
  // UTILIDADES DE DESCARGA
  // -----------------------------------------------------------------

  /** Escapa separadores y comillas conforme a RFC 4180. */
  private escaparCsv(celda: string): string {
    return /[",\r\n]/.test(celda) ? `"${celda.replace(/"/g, '""')}"` : celda;
  }

  private descargar(nombre: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Genera un PDF 1.4 mínimo y válido del acuse, sin dependencias externas.
   * Los offsets del índice `xref` se calculan sobre los caracteres realmente
   * escritos: estimarlos produce un documento que los lectores rechazan.
   */
  private construirAcusePdf(notificacion: Notificacion, sello: Date): Blob {
    const lineas: string[] = [
      'ACUSE DE RECIBO ELECTRONICO',
      'Direccion General de Asuntos Ambientales Mineros (DGAAM)',
      'Ministerio de Energia y Minas',
      '',
      `Acto administrativo: ${notificacion.acto}`,
      `Numero de expediente: ${notificacion.numeroExpediente}`,
      `Proyecto: ${notificacion.nombreProyecto}`,
      `Emitido por: ${notificacion.emisor}`,
      `Fecha de emision: ${notificacion.emitido}`,
      '',
      'Constancia de recepcion',
      '',
      'El titular minero declara haber recibido el acto administrativo',
      'identificado en el presente documento a traves de la extranet de',
      'Registro de Instrumentos de Gestion Ambiental.',
      '',
      `Marca de tiempo de descarga: ${sello.toISOString()}`,
      `RUC: ${this.store.ruc()}`,
      '',
      'Documento generado electronicamente. Valido sin firma autografa.',
    ];

    const flujo = [
      'BT',
      '/F1 11 Tf',
      `${MARGEN_PDF} ${842 - MARGEN_PDF} Td`,
      '16 TL',
      ...lineas.map((linea) => `(${this.escaparPdf(linea)}) Tj T*`),
      'ET',
    ].join('\n');

    const objetos: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
        '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objetos.forEach((cuerpo, indice) => {
      offsets.push(pdf.length);
      pdf += `${indice + 1} 0 obj\n${cuerpo}\nendobj\n`;
    });

    const inicioXref = pdf.length;
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf +=
      `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${inicioXref}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  }

  /**
   * Escapa el contenido de cadena del PDF y lo recorta a ASCII, porque
   * Helvetica con WinAnsiEncoding no tolera el resto de Unicode.
   */
  private escaparPdf(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  /**
   * Costura común de las acciones de fila y del modal. Cada una se enlazará con
   * su módulo correspondiente de la consola en los próximos pasos.
   */
  private puntoDeIntegracion(accion: string, referencia: string): void {
    void accion;
    void referencia;
  }
}
