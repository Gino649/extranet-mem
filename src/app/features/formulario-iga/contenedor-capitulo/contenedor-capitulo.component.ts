import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DaexStore } from '../../../state/daex.store';
import { CATALOGO_MICROSECCIONES, MicroSeccionConfig } from './catalogo-microsecciones';
import { ObservacionesEvaluadorComponent } from '../microcomponentes-comunes/observaciones-evaluador/observaciones-evaluador.component';

/**
 * Orquestador central del formulario DAEX.
 *
 * Es el único componente que decide qué se renderiza en la columna derecha:
 * toma el capítulo activo, filtra su catálogo de microcomponentes y los apila
 * en un scroll continuo, en lugar de enrutar una pantalla por sección.
 *
 * Al recibir el capítulo desde la ruta se sincroniza con el store, de modo que
 * el índice lateral, la barra de avance y el panel derecho comparten el mismo
 * estado. El filtrado se hace con un `computed`, así que cambiar de capítulo no
 * recrea la columna: solo cambia la proyección.
 */
@Component({
  selector: 'app-contenedor-capitulo',
  imports: [NgComponentOutlet, ObservacionesEvaluadorComponent],
  templateUrl: './contenedor-capitulo.component.html',
  styleUrls: ['./contenedor-capitulo.component.css'],
})
export class ContenedorCapituloComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Capítulo que debe apilarse, sincronizado con la ruta.
   *
   * El valor por defecto cubre el montaje directo sin parámetro; la ruta
   * `/formulario-iga/:capituloId` lo sobrescribe en cuanto resuelve.
   */
  readonly capituloId = input<string>('1');

  /**
   * Catálogo de microcomponentes.
   *
   * Es la misma lista que recorre el informe consolidado de impresión: vivir en
   * un módulo compartido garantiza que el PDF muestre exactamente las fichas
   * que el flujo interactivo apila. Mantener el catálogo como dato local y no
   * en el store evita que la capa de estado dependa de clases de componente.
   */
  protected readonly catalogo = signal<readonly MicroSeccionConfig[]>(CATALOGO_MICROSECCIONES);

  /**
   * Fichas del capítulo activo, en el orden del catálogo.
   *
   * `visible` se filtra aquí y no en el `@for` para que el estado vacío del
   * contenedor signifique «este capítulo todavía no tiene piezas», que es un
   * mensaje útil, y no «hay fichas pero están ocultas».
   */
  protected readonly microSecciones = computed(() =>
    this.catalogo().filter((ficha) => ficha.visible && ficha.capituloId === this.capituloId()),
  );

  constructor() {
    // La ruta es la fuente de verdad del capítulo: al resolverla se propaga al
    // store para que el índice lateral marque el capítulo y lo despliegue.
    effect(() => this.store.seleccionarCapitulo(this.capituloId()));
  }
}
