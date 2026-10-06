import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
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

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.css'],
})
export class WorkspaceComponent {
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

  protected consultar(expediente: Expediente): void {
    this.puntoDeIntegracion('Consultar', expediente.numeroExpediente);
  }

  protected editar(expediente: Expediente): void {
    this.store.editarExpediente(expediente);
    void this.router.navigate(['/formulario-iga']);
  }

  protected imprimir(expediente: Expediente): void {
    this.puntoDeIntegracion('Imprimir', expediente.numeroExpediente);
  }

  protected comunicaciones(expediente: Expediente): void {
    this.puntoDeIntegracion('Comunicaciones', expediente.numeroExpediente);
  }

  protected modificacion(expediente: Expediente): void {
    this.puntoDeIntegracion('Modificación', expediente.numeroExpediente);
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
    void this.router.navigate(['/formulario-iga']);
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
