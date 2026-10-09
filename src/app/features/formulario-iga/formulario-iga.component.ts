import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { SoloLecturaDirective } from '../../directivas/solo-lectura.directive';
import { DaexStore, EstadoSeccion } from '../../state/daex.store';
import { esVentanaEstrecha } from '../../utilidades/ventana';
/**
 * Significado de cada color del semáforo.
 *
 * Vive en el componente y no en el store porque es texto de ayuda para leer la
 * pantalla, no una regla del expediente: el store decide el color y el titular
 * solo necesita saber qué esperar de él.
 */
interface EntradaLeyenda {
  estado: EstadoSeccion;
  texto: string;
}

const LEYENDA_SEMAFORO: readonly EntradaLeyenda[] = [
  { estado: 'Gris', texto: 'Sin completar' },
  { estado: 'Azul', texto: 'Subsanado, a la espera de revisión del MINEM' },
  { estado: 'Verde', texto: 'Validado' },
  { estado: 'Rojo', texto: 'Observado por el Evaluador Institucional' },
];

/**
 * Duración de la cortina de transmisión simulada hacia el MINEM.
 *
 * Es una constante del módulo y no una regla del store porque mide la
 * presentación: el expediente ya está en verde y el envío ya se autorizó, la
 * espera solo refuerza que la data salió entera antes de mostrar el acuse.
 */
const RETARDO_TRANSMISION_MS = 3500;

/**
 * Contenedor de edición de la DAEX.
 *
 * Se adueña de la pantalla completa: cabecera inmutable con los metadatos del
 * trámite, barra lateral con el índice de los 7 capítulos y un cuerpo derecho
 * con scroll propio que aloja el `ContenedorCapituloComponent`, único
 * responsable de apilar las microsecciones del capítulo activo.
 *
 * El aside es deliberadamente plano: lista solo los títulos de los 7 capítulos
 * y navega a `/formulario-iga/:capituloId`. No conoce las secciones, porque la
 * granularidad fina quedó a cargo del orquestador; mantener ambos niveles en el
 * índice era la fuente de la duplicación que se eliminó.
 */
@Component({
  selector: 'app-formulario-iga',
  imports: [RouterLink, RouterOutlet, SoloLecturaDirective],
  templateUrl: './formulario-iga.component.html',
  styleUrls: ['./formulario-iga.component.css'],
})
export class FormularioIgaComponent {
  protected readonly store = inject(DaexStore);

  private readonly router = inject(Router);

  /** Árbol de capítulos con el semáforo resuelto. */
  protected readonly capitulos = this.store.capitulos;

  /**
   * Etapa de la remisión y su rótulo.
   *
   * El botón general no es un único envío con un nombre fijo: manda el DAEX
   * nuevo, las subsanaciones o la respuesta a un pedido de documentación, según
   * en qué punto esté el expediente.
   */
  protected readonly etapaRemision = this.store.estadoRemision;

  protected readonly etiquetaRemision = this.store.etiquetaRemision;

  protected readonly puedeRemitir = this.store.puedeRemitir;

  /** Motivo legible del bloqueo; `null` cuando el botón está disponible. */
  protected readonly motivoRemision = this.store.motivoRemision;

  /** Avance porcentual del expediente. */
  protected readonly avance = this.store.avanceExpediente;

  /**
   * Colores del semáforo con su significado.
   *
   * El ámbar no aparece: no es un estado del expediente sino la marca de que el
   * capítulo abierto está en gris y por tanto en trabajo. Anotarlo en la leyenda
   * haría creer que hay una cuarta situación de validación que el sistema nunca
   * alcanza.
   */
  protected readonly leyendaSemaforo = LEYENDA_SEMAFORO;

  /**
   * Frase que resume la etapa bajo el progreso.
   *
   * Siempre dice algo: el motivo de bloqueo explica por qué no se puede
   * remitir, pero cuando el botón está disponible esa explicación sería un hueco
   * en el panel, y el titular necesita saber igual qué está a punto de mandar.
   */
  protected readonly resumenEtapa = computed(() => {
    const bloqueo = this.motivoRemision();
    if (bloqueo) {
      return bloqueo;
    }
    switch (this.etapaRemision()) {
      case 'NUEVO':
        return 'Las secciones están en verde. La DAEX puede remitirse al MINEM.';
      case 'OBSERVADO':
        return 'No quedan observaciones sin descargo. La subsanación puede remitirse.';
      case 'INFORMACION_COMPLEMENTARIA':
        return 'El MINEM pidió documentación adicional. Este envío la adjunta.';
    }
  });

  /**
   * Colapso del índice lateral.
   *
   * Arranca plegado por debajo de 768 px: en ese ancho el índice abierto se
   * comería buena parte del panel de edición, que es donde el titular trabaja. En
   * pantallas normales arranca abierto y el collapse queda a mano del usuario.
   */
  protected readonly menuColapsado = signal(esVentanaEstrecha());

  /**
   * Capítulo que el orquestador está apilando.
   *
   * Lo mantiene el `ContenedorCapituloComponent` al resolver la ruta, así que
   * el índice resalta el capítulo sin volver a leer los parámetros del router.
   */
  protected readonly capituloEnCurso = this.store.capituloSeleccionadoId;

  /**
   * Semáforo agregado del capítulo para el círculo del índice.
   *
   * El capítulo no tiene estado propio —el semáforo vive en sus secciones—, así
   * que el store lo resuelve con el árbol aplanado y gana el estado más
   * urgente de cualquiera de ellas.
   */
  protected estadoCapitulo(numero: string): EstadoSeccion {
    return this.store.estadoCapitulo(numero);
  }

  /** `true` si alguna sección del capítulo está en rojo: el círculo late. */
  protected capituloEnAlerta(numero: string): boolean {
    return this.store.capituloEnAlerta(numero);
  }

  protected readonly iniciales = computed(() => {
    const palabras = this.store.razonSocial().trim().split(/\s+/).filter(Boolean);
    const inicial = palabras[0]?.charAt(0) ?? '';
    const final = palabras.length > 1 ? (palabras.at(-1)?.charAt(0) ?? '') : '';
    return (inicial + final).toUpperCase() || '··';
  });

  /**
   * Abandona la edición y regresa al listado de solicitudes del workspace.
   *
   * No se vacía el store al volver: el expediente en curso es un borrador y el
   * titular puede regresar a la sección exacta donde lo dejó. El abandono real
   * —descartar el borrador— es una acción distinta y deliberada.
   */
  protected regresarAlWorkspace(): void {
    void this.router.navigate(['/workspace']);
  }

  /* ------------------------------------------------------------------
     CIERRE DEL EXPEDIENTE · CORTINA DE TRANSMISIÓN Y ACUSE DE RECIBO
     ------------------------------------------------------------------ */

  /** Cortina a pantalla completa mientras la transmisión está en curso. */
  protected readonly procesandoEnvio = signal(false);

  /** Visibilidad del acuse legal de recepción que devuelve el MINEM. */
  protected readonly acuseModalAbierto = signal(false);

  /**
   * Ficha técnica del acuse que el MINEM estampa al radicar la solicitud.
   *
   * Objeto plano y no una signal porque se rellena de una sola vez al concluir
   * la transmisión, justo antes de abrir el modal: la escritura de
   * `acuseModalAbierto` dispara el cambio de detección que pinta los datos.
   */
  protected readonly acuseDatos = {
    nroExpediente: '',
    fecha: '',
    hora: '',
    estado: 'EN EVALUACIÓN TÉCNICA',
  };

  /**
   * Remite el expediente al MINEM.
   *
   * El rótulo y el guardián cambian según la etapa del trámite, porque en cada
   * una se manda algo distinto: la DAEX nueva, la subsanación de lo observado o
   * la documentación complementaria que el MINEM pidió. La transmisión se
   * simula con una cortina de espera, y la remisión no se registra hasta que
   * esa cortina termina: si el titular abandona a mitad de envío, el store
   * sigue diciendo que nada se ha mandado.
   */
  protected transmitirEstudioAlMinem(): void {
    if (!this.store.puedeRemitir()) {
      return;
    }
    // Guardián contra el doble disparo: la segunda llamada se ignora mientras
    // la primera transmite.
    if (this.procesandoEnvio()) {
      return;
    }

    // 1. Levantar la cortina de espera y bloquear la pantalla.
    this.procesandoEnvio.set(true);

    // 2. Simular la transmisión masiva de planos, WKT y adjuntos.
    setTimeout(() => {
      this.store.registrarRemision();

      // 3. Estampar el acuse con marcas de tiempo físicas del servidor.
      const instante = new Date();
      const correlativo = Math.floor(100000 + Math.random() * 900000);
      this.acuseDatos.nroExpediente = `EXP-${correlativo}-${instante.getFullYear()}-DGAAM`;
      this.acuseDatos.fecha = instante.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      this.acuseDatos.hora = instante.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      this.acuseDatos.estado = 'EN EVALUACIÓN TÉCNICA';

      // 4. Retirar la cortina y desplegar el acuse de éxito.
      this.procesandoEnvio.set(false);
      this.acuseModalAbierto.set(true);
    }, RETARDO_TRANSMISION_MS);
  }

  /**
   * Cierre del ciclo: confirma el acuse y regresa a la bandeja de solicitudes.
   *
   * Es el mismo escape que `regresarAlWorkspace`: confirmar no descarta el
   * borrador, solo cierra la ventana del acuse y vuelve al listado.
   */
  protected confirmarAcuseYSalir(): void {
    this.acuseModalAbierto.set(false);
    this.regresarAlWorkspace();
  }
}
