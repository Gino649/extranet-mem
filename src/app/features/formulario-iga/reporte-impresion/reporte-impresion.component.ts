import { NgComponentOutlet } from '@angular/common';
import { Component, Type, computed, inject, input } from '@angular/core';

import { SoloLecturaDirective } from '../../../directivas/solo-lectura.directive';
import { DaexStore, EstadoSeccion, Expediente } from '../../../state/daex.store';
import { FICHA_POR_NUMERO } from '../contenedor-capitulo/catalogo-microsecciones';

/** Ficha de una sección dentro del informe impreso. */
interface SeccionReporte {
  readonly numero: string;
  readonly titulo: string;
  readonly estado: EstadoSeccion;
  readonly componenteRef: Type<unknown>;
}

/** Capítulo del informe con sus secciones proyectadas. */
interface CapituloReporte {
  readonly numero: string;
  readonly titulo: string;
  readonly estado: EstadoSeccion;
  readonly secciones: readonly SeccionReporte[];
}

/**
 * Informe consolidado del expediente para imprimir en PDF.
 *
 * Recorre los capítulos del store y monta con `NgComponentOutlet` las mismas
 * fichas que el orquestador apila en el flujo interactivo: el catálogo es
 * compartido, así que el documento refleja exactamente lo que el titular
 * registró. Vive oculto en pantalla y se expone solo en `@media print`; el
 * workspace lo monta un instante antes de abrir el diálogo nativo.
 */
@Component({
  selector: 'app-reporte-impresion',
  imports: [NgComponentOutlet, SoloLecturaDirective],
  templateUrl: './reporte-impresion.component.html',
  styleUrls: ['./reporte-impresion.component.css'],
})
export class ReporteImpresionComponent {
  protected readonly store = inject(DaexStore);

  /** Expediente cuyos metadatos encabezan el informe. */
  readonly expediente = input<Expediente | null>(null);

  /** Capítulos con sus secciones visibles, en el orden oficial del store. */
  protected readonly capitulosReporte = computed<readonly CapituloReporte[]>(() =>
    this.store.capitulos().map((capitulo) => ({
      numero: capitulo.numero,
      titulo: capitulo.titulo,
      estado: this.store.estadoCapitulo(capitulo.numero),
      secciones: capitulo.secciones.flatMap((seccion) => {
        const ficha = FICHA_POR_NUMERO.get(seccion.numero);
        if (!ficha?.visible) {
          // Las sub-capas 5.2.1 y 5.2.2 quedan absorbidas por la 5.2 y no se
          // imprimen por separado, igual que no se apilan en el orquestador.
          return [];
        }
        return [
          {
            numero: seccion.numero,
            titulo: seccion.titulo,
            estado: this.store.seccionPorNumero(seccion.numero)?.estado ?? 'Gris',
            componenteRef: ficha.componenteRef,
          },
        ];
      }),
    })),
  );

  /** Clases del semáforo. Se devuelve también la base porque `[class]` reemplaza el atributo. */
  protected claseSemaforo(estado: EstadoSeccion): string {
    switch (estado) {
      case 'Verde':
        return 'reporte-semaforo reporte-semaforo--verde';
      case 'Azul':
        return 'reporte-semaforo reporte-semaforo--azul';
      case 'Rojo':
        return 'reporte-semaforo reporte-semaforo--rojo';
      default:
        return 'reporte-semaforo reporte-semaforo--gris';
    }
  }
}
