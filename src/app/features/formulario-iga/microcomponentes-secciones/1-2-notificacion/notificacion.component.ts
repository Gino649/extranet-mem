import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AdjuntarDocumentosComponent } from '../1-3-adjuntar-documentos/adjuntar-documentos.component';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial por defecto; el orquestador lo sobreescribe al apilar. */
const NUMERO_SECCION = '1.2';

/** Un contacto autorizado para recibir alertas de la DGAAM. */
interface Contacto {
  readonly id: number;
  readonly nombres: string;
  readonly telefono: string;
  readonly email: string;
}

/** Campos editables de la fila, para no repetir el `switch` en la plantilla. */
type CampoContacto = 'nombres' | 'telefono' | 'email';

/** Correo institucional: debe tener dominio y punto antes de la TLD. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Celular peruano: nueve dígitos, opcionalmente precedido por +51. */
const TELEFONO_VALIDO = /^(?:\+51\s?)?9\d{8}$/;

/**
 * Microcomponente de la sección 1.2 · Suscripción y Contactos de Notificación.
 *
 * Dos responsabilidades: el padrón de personas autorizadas a recibir las alertas
 * de la DGAAM, y la evidencia de que aceptaron el cargo. La grilla es
 * transaccional —se declara, se valida y se confirma en bloque— y el formato
 * firmado se carga con el uploader compartido restringido a PDF.
 *
 * A diferencia de la 1.1, esta sección sí se edita aquí: el titular decide a
 * quién designa y hasta cuándo.
 */
@Component({
  selector: 'app-notificacion',
  templateUrl: './notificacion.component.html',
  styleUrls: ['./notificacion.component.css'],
  // El uploader se reutiliza por su segundo alias en lugar de duplicarlo: es el
  // único punto del proyecto donde se valida el tope de 50 MB, y dos copias
  // divergirían en cuanto cambiara la norma.
  imports: [AdjuntarDocumentosComponent],
})
export class NotificacionComponent implements OnInit {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador apila varias secciones en la misma columna, así que el
   * componente recibe su identidad por input en vez de deducirla de «la sección
   * activa», que en una columna apilada es ambigua.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Padrón de contactos autorizados; se declara con al menos una fila. */
  protected readonly contactos = signal<readonly Contacto[]>([]);

  private static correlativo = 0;

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /**
   * Alta de la primera fila.
   *
   * Una grilla vacía parece un formulario roto y esconde que ya hay un sitio
   * preparado para escribir; con una fila inicial el titular ve la estructura
   * desde el primer vistazo.
   */
  ngOnInit(): void {
    if (this.contactos().length === 0) {
      this.agregarFila();
    }
  }

  /** Añade una fila en blanco con identificador autoincremental. */
  protected agregarFila(): void {
    NotificacionComponent.correlativo += 1;
    const nueva: Contacto = {
      id: NotificacionComponent.correlativo,
      nombres: '',
      telefono: '',
      email: '',
    };
    this.contactos.update((actual) => [...actual, nueva]);
  }

  /**
   * Elimina una fila conservando el resto.
   *
   * Se filtra por identificador y no por posición: como el índice del `@for` se
   * recalcula tras cada borrado, borrar por índice dejaría el resto intacto solo
   * por casualidad del orden.
   */
  protected removerFila(id: number): void {
    this.contactos.update((actual) => actual.filter((contacto) => contacto.id !== id));
  }

  /**
   * Escribe en una celda y notifica el cambio.
   *
   * La fila es un objeto plano dentro de una señal, así que mutar
   * `contacto.nombres` no dispararía la notificación: el `computed` de
   * validación se quedaría congelado y la confirmación quedaría deshabilitada
   * para siempre. Por eso se reconstruye la fila y se reemplaza en el arreglo.
   */
  protected actualizarCampo(id: number, campo: CampoContacto, valor: string): void {
    this.contactos.update((actual) =>
      actual.map((contacto) => (contacto.id === id ? { ...contacto, [campo]: valor } : contacto)),
    );
  }

  /** Valor de una celda concreta; evita repetir `actualizarCampo` en el marcado. */
  protected valorDe(contacto: Contacto, campo: CampoContacto): string {
    return contacto[campo];
  }

  /** Reglas de la fila, para marcar solo la celda que falla. */
  protected filaCompleta(contacto: Contacto): boolean {
    return (
      contacto.nombres.trim().length > 2 &&
      TELEFONO_VALIDO.test(contacto.telefono.replace(/\s+/g, ' ').trim()) &&
      CORREO_VALIDO.test(contacto.email.trim())
    );
  }

  /** Errores de una fila concreta, en el orden en que se muestran. */
  protected erroresDe(contacto: Contacto): readonly string[] {
    const errores: string[] = [];
    if (contacto.nombres.trim().length <= 2) {
      errores.push('Nombres y apellidos incompletos');
    }
    if (!TELEFONO_VALIDO.test(contacto.telefono.replace(/\s+/g, ' ').trim())) {
      errores.push('Teléfono inválido');
    }
    if (!CORREO_VALIDO.test(contacto.email.trim())) {
      errores.push('Correo inválido');
    }
    return errores;
  }

  protected readonly contactsValidos = computed(() =>
    this.contactos().filter((c) => this.filaCompleta(c)),
  );

  /**
   * La sección es transaccional: se confirma cuando hay al menos un contacto
   * válido y ninguno a medias. Aceptar filas a medias dejaría direcciones que
   * la DGAAM no podría notificar.
   */
  protected readonly puedeConfirmar = computed(
    () => this.contactsValidos().length > 0 && this.erroresPendientes() === 0,
  );

  /** Filas con algún campo pendiente, para el contador de la cabecera. */
  protected readonly erroresPendientes = computed(
    () => this.contactos().filter((contacto) => !this.filaCompleta(contacto)).length,
  );

  protected readonly mensaje = signal<string | null>(null);

  /**
   * Confirma el padrón de contactos y enciende el semáforo.
   *
   * `actualizarEstadoSeccion` resuelve la fila por su índice oficial y es
   * idempotente, así que confirmar dos veces no produce efectos adicionales.
   */
  protected confirmar(): void {
    if (!this.puedeConfirmar()) {
      this.mensaje.set('Complete los datos de al menos un contacto y no deje filas a medias.');
      return;
    }
    const aplicado = this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.mensaje.set(
      aplicado
        ? `${this.contactsValidos().length} contacto(s) autorizado(s). Semáforo en Verde Conforme.`
        : `No se encontró la sección ${this.numero()} en el expediente.`,
    );
  }

  private static readonly CONTENIDO_TEMPLATE =
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF';

  /** Descarga el formato oficial de aceptación exigido por la DGAAM. */
  protected descargarTemplate(): void {
    const url = URL.createObjectURL(
      new Blob([NotificacionComponent.CONTENIDO_TEMPLATE], { type: 'application/pdf' }),
    );
    const ancla = document.createElement('a');
    ancla.href = url;
    ancla.download = 'formato-oficial-aceptacion-notificacion-DAEX.pdf';
    ancla.click();
    URL.revokeObjectURL(url);
    this.mensaje.set('Formato oficial descargado. Adjúntelo firmado en el bloque siguiente.');
  }
}
