import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/**
 * Motor de observaciones y subsanación del Evaluador Institucional.
 *
 * Es un microcomponente común y no una pieza de la sección 2.7: lo invoca el
 * orquestador sobre cualquier sección que tenga acta abierta, y por eso toma
 * el índice como entrada en vez de tenerlo escrito dentro. Añadir una
 * evaluación a otra sección es sembrarla en el store, no tocar este archivo.
 *
 * No lleva botón de remisión. Enviar es una sola acción para todo el
 * expediente y vive en la cabecera, donde el rótulo cambia según la etapa del
 * trámite: duplicar el botón aquí dejaría dos caminos distintos para mandar lo
 * mismo, y el que está dentro de la bandeja ni siquiera sabría si lo que
 * responde el titular es todo lo que hay pendiente.
 *
 * Varias instancias de este componente están vivas a la vez —una por sección
 * observada del capítulo—, y todas leen su propia bandeja del store mediante
 * el índice que reciben. Por eso la API del store no tiene un «sección activa»:
 * con una sola señal global, las cuatro tarjetas mostrarían la misma bandeja.
 */
@Component({
  selector: 'app-observaciones-evaluador',
  imports: [],
  templateUrl: './observaciones-evaluador.component.html',
  styleUrls: ['./observaciones-evaluador.component.css'],
})
export class ObservacionesEvaluadorComponent {
  private readonly store = inject(DaexStore);

  /** Índice oficial de la sección observada, p. ej. `2.7`. */
  readonly numero = input<string>('');

  /**
   * Ficha de la sección observada.
   *
   * Puede ser `null` si el índice no tiene bandeja: el orquestador solo monta
   * el motor cuando existe, pero el guardián evita que un índice vacío se
   * convierta en una tarjeta con el rótulo de «sección 0».
   */
  protected readonly micro = computed(() => this.store.microComponenteEvaluadoDe(this.numero()));

  /** Observaciones que esta sección tiene que resolver. */
  protected readonly observaciones = computed(() => this.store.observacionesDeSeccion(this.numero()));

  protected readonly totalObservaciones = computed(() => this.observaciones().length);

  protected readonly totalSubsanadas = computed(
    () => this.observaciones().filter((obs) => obs.estado === 'SUBSANADO').length,
  );

  /**
   * Aviso de la última acción sobre la bandeja, o `null`.
   *
   * Sustituye al `alert()` del diseño original: un `alert` congela la pantalla
   * y además rompe cualquier prueba que intente guardar el descargo vacío. El
   * mensaje vive en la propia tarjeta, que es donde el titular está mirando.
   */
  protected readonly aviso = signal<string | null>(null);

  /** Abre la caja de descargo de una fila pendiente. */
  protected abrirCaja(idAlerta: string): void {
    this.aviso.set(null);
    this.store.abrirCajaTextoSubsanarFila(this.numero(), idAlerta);
  }

  /**
   * Cierra la caja abierta sin guardar.
   *
   * Se busca la fila por su estado de vista y no por un id recibido desde la
   * plantilla, porque solo puede haber una caja abierta por bandeja: así el
   * botón «Cancelar» no depende de que el `@for` conserve el contexto de fila.
   */
  protected cerrarCaja(): void {
    const abierta = this.observaciones().find((obs) => obs.editandoDescargo);
    if (abierta) {
      this.store.cerrarCajaTextoSubsanarFila(this.numero(), abierta.id);
    }
    this.aviso.set(null);
  }

  /**
   * Guarda el descargo de una fila.
   *
   * El correlativo se lee antes de guardar porque, si el guardado prospera, la
   * fila deja de ser pendiente y el aviso tiene que seguir nombrándola.
   */
  protected guardar(idAlerta: string, descargo: string): void {
    const correlativo =
      this.observaciones().find((obs) => obs.id === idAlerta)?.numeroCorrelativo ?? idAlerta;
    const guardado = this.store.procesarGuardarSubsanacionFila(this.numero(), idAlerta, descargo);
    this.aviso.set(
      guardado
        ? `${correlativo} subsanada. La sección queda en azul hasta que el MINEM la revise.`
        : 'El descargo de sustento no puede quedar vacío.',
    );
  }
}