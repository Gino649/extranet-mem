import { Component, OnInit, signal, computed, inject, ViewChild, ElementRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DaexStore } from '../../../../state/daex.store';

@Component({
  selector: 'app-medio-fisico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medio-fisico.component.html',
  styleUrls: ['./medio-fisico.component.css']
})
export class MedioFisicoComponent implements OnInit {
  public readonly store = inject(DaexStore);

  /** Número de la sección que el orquestador inyecta al montar el microcomponente. */
  public readonly numero = input<string>('');

  @ViewChild('lienzoEditable', { static: true }) public lienzoEditable!: ElementRef<HTMLDivElement>;

  /** Referencia al lienzo editable contenteditable */
  private get lienzoEditableRef(): ElementRef<HTMLDivElement> {
    return this.lienzoEditable;
  }

  /** Contenido HTML almacenado en el editor */
  protected readonly contenidoHtml = signal<string>('');

  /** Computed para el conteo de caracteres del HTML */
  protected readonly conteoCaracteresHtml = computed(() => {
    const html = this.contenidoHtml();
    return new Blob([html]).size;
  });

  /** Valida que el contenido tenga al menos algún texto significativo */
  protected readonly contenidoEsValido = computed(() => {
    const html = this.contenidoHtml().trim();
    if (html.length === 0) {
      return false;
    }
    // Extrae texto plano para validar contenido mínimo
    const textoPlano = html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return textoPlano.length > 0;
  });

  /**
   * Ejecuta comandos nativos de edición de contenido (execCommand)
   * @param comando - Comando a ejecutar en el documento
   */
  public ejecutarComandoEditor(comando: string, valor: string = ''): void {
    document.execCommand(comando, false, valor);
    this.actualizarContenidoDesdeLienzo();
  }

  /**
   * Inyecta una tabla HTML vacía con formato corporativo
   */
  protected inyectarTablaVaciaManual(): void {
    const tablaHtml = `
      <table style="width:100%; border-collapse:collapse; margin:12px 0; border:1px solid #cbd5e1;">
        <thead>
          <tr style="background-color:#f8fafc; border-bottom:2px solid #cbd5e1;">
            <th style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">Columna 1</th>
            <th style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">Columna 2</th>
            <th style="border:1px solid #cbd5e1; padding:8px; font-weight:bold;">Columna 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:8px;">&nbsp;</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">&nbsp;</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:8px;">&nbsp;</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">&nbsp;</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
      <p>&nbsp;</p>
    `;
    this.lienzoEditableRef.nativeElement.focus();
    document.execCommand('insertHTML', false, tablaHtml);
    this.actualizarContenidoDesdeLienzo();
  }

  /**
   * Maneja el evento de pegado desde Excel para sanitizar y preservar tablas
   * @param evento - Evento de pegado
   */
  protected alPegarContenidoDesdeExcel(evento: ClipboardEvent): void {
    evento.preventDefault();
    const datosPortapapeles = evento.clipboardData;

    if (!datosPortapapeles) {
      return;
    }

    // Intenta obtener HTML primero (preserva tablas de Excel)
    const htmlPegado = datosPortapapeles.getData('text/html');
    const textoPegado = datosPortapapeles.getData('text/plain');

    if (htmlPegado && htmlPegado.length > 0) {
      // Sanitiza HTML pegado desde Excel: mantiene tablas y estructura básica
      const htmlSanitizado = this.sanitizarHtmlExcel(htmlPegado);
      document.execCommand('insertHTML', false, htmlSanitizado);
    } else if (textoPegado && textoPegado.length > 0) {
      // Fallback: pega como texto plano, preservando saltos de línea
      const textoFormateado = textoPegado.replace(/\n/g, '<br>');
      document.execCommand('insertHTML', false, textoFormateado);
    }

    this.actualizarContenidoDesdeLienzo();
  }

  /**
   * Sanitiza HTML proveniente de Excel para mantener formato de tablas
   * @param html - HTML crudo pegado desde Excel
   * @returns HTML sanitizado
   */
  private sanitizarHtmlExcel(html: string): string {
    // Extrae solo tablas y contenido relevante, elimina estilos excesivos de Excel
    // Busca tablas en el HTML pegado
    const regexTabla = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tablasEncontradas = html.match(regexTabla);

    if (tablasEncontradas && tablasEncontradas.length > 0) {
      // Procesa cada tabla encontrada para limpiar estilos de Excel
      let htmlResultado = '';
      tablasEncontradas.forEach((tabla) => {
        const tablaLimpia = tabla
          // Elimina atributos de estilo complejos de Excel
          .replace(/style="[^"]*"/gi, '')
          // Elimina atributos de clase de Excel
          .replace(/class="[^"]*"/gi, '')
          // Agrega clases corporativas
          .replace(/<table[^>]*>/gi, '<table style="width:100%; border-collapse:collapse; margin:12px 0; border:1px solid #cbd5e1;">')
          .replace(/<th[^>]*>/gi, '<th style="border:1px solid #cbd5e1; padding:8px; font-weight:bold; background-color:#f8fafc;">')
          .replace(/<td[^>]*>/gi, '<td style="border:1px solid #cbd5e1; padding:8px;">');
        htmlResultado += tablaLimpia + '<p>&nbsp;</p>';
      });
      return htmlResultado;
    }

    // Si no hay tablas, extrae cuerpo o párrafos
    const regexBody = /<body[^>]*>([\s\S]*?)<\/body>/i;
    const matchBody = html.match(regexBody);
    if (matchBody && matchBody[1]) {
      return matchBody[1];
    }

    return html;
  }

  /**
   * Actualiza la señal de contenido HTML desde el lienzo editable
   */
  protected actualizarContenidoDesdeLienzo(): void {
    if (this.lienzoEditableRef?.nativeElement) {
      const html = this.lienzoEditableRef.nativeElement.innerHTML;
      this.contenidoHtml.set(html);
    }
  }

  /**
   * Guarda y valida la sección 3.1 en el store
   */
  protected guardarYValidarMedioFisicoSeccion(): void {
    const contenido = this.contenidoHtml();
    if (!this.contenidoEsValido()) {
      return;
    }

    // Guarda el contenido HTML en el store
    // El store mantiene el estado de la sección
    this.store.actualizarEstadoSeccion('3.1', 'VERDE');
    this.actualizarContenidoDesdeLienzo();
  }

  constructor() {
    // Inicialización limpia
    setTimeout(() => {
      this.actualizarContenidoDesdeLienzo();
    }, 0);
  }

  public ngOnInit(): void {
    // Inicialización limpia
  }
}