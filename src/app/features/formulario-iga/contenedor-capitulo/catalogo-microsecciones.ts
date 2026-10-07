import { Type } from '@angular/core';
import { IdentificacionComponent } from '../microcomponentes-secciones/1-1-identificacion/identificacion.component';
import { NotificacionComponent } from '../microcomponentes-secciones/1-2-notificacion/notificacion.component';
import { AdjuntarDocumentosComponent } from '../microcomponentes-secciones/1-3-adjuntar-documentos/adjuntar-documentos.component';
import { AntecedentesComponent } from '../microcomponentes-secciones/2-2-antecedentes/antecedentes.component';
import { DatosProyectoComponent } from '../microcomponentes-secciones/2-1-datos-proyecto/datos-proyecto.component';
import { DelimitacionComponent } from '../microcomponentes-secciones/2-5-delimitacion/delimitacion.component';
import { DelimitacionMapaComponent } from '../microcomponentes-secciones/2-5-delimitacion-mapa/delimitacion-mapa.component';
import { ObjetivosComponent } from '../microcomponentes-secciones/2-3-objetivos/objetivos.component';
import { LocalizacionComponent } from '../microcomponentes-secciones/2-4-localizacion/localizacion.component';
import { CronogramaComponent } from '../microcomponentes-secciones/2-6-cronograma/cronograma.component';
import { ComponentesComponent } from '../microcomponentes-secciones/2-7-componentes/componentes.component';
import { DemandaAguaComponent } from '../microcomponentes-secciones/2-8-demanda-agua/demanda-agua.component';
import { InsumosEquiposComponent } from '../microcomponentes-secciones/2-9-insumos-equipos/insumos-equipos.component';
import { PersonalComponent } from '../microcomponentes-secciones/2-10-personal/personal.component';
import { MedioFisicoComponent } from '../microcomponentes-secciones/3-1-medio-fisico/medio-fisico.component';
import { ArqueologiaComponent } from '../microcomponentes-secciones/3-3-arqueologia/arqueologia.component';
import { ParticipacionCiudadanaComponent } from '../microcomponentes-secciones/4-1-participacion-ciudadana/participacion-ciudadana.component';
import { ImpactosCierreComponent } from '../microcomponentes-secciones/5-1-impactos-cierre/impactos-cierre.component';
import { AreasInfluenciaComponent } from '../microcomponentes-secciones/5-2-areas-influencia/areas-influencia.component';
import { ConsultorasComponent } from '../microcomponentes-secciones/6-1-consultoras/consultoras.component';

/**
 * Ficha de un microcomponente de sección dentro del catálogo del orquestador.
 *
 * `id` es el índice oficial de la sección (`'1.1'`, `'5.2.2'`) y a la vez el
 * ancla estable del scroll. `capituloId` agrupa las fichas que el capítulo
 * correspondiente apila. `visible` permite retirar una sección del flujo sin
 * borrar su ficha, útil para dependencias que aún no están construidas.
 */
export interface MicroSeccionConfig {
  readonly id: string;
  readonly capituloId: string;
  readonly componenteRef: Type<unknown>;
  readonly visible: boolean;
}

/**
 * Catálogo compartido de microcomponentes de sección.
 *
 * Vive fuera del orquestador para que el informe consolidado de impresión
 * recorra exactamente las mismas fichas que el flujo interactivo. Mantener el
 * catálogo fuera del store evita que la capa de estado dependa de clases de
 * componente: el store sigue ignorando la capa visual.
 */
export const CATALOGO_MICROSECCIONES: readonly MicroSeccionConfig[] = [
  { id: '1.1', capituloId: '1', componenteRef: IdentificacionComponent, visible: true },
  { id: '1.2', capituloId: '1', componenteRef: NotificacionComponent, visible: true },
  { id: '1.3', capituloId: '1', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '2.1', capituloId: '2', componenteRef: DatosProyectoComponent, visible: true },
  { id: '2.2', capituloId: '2', componenteRef: AntecedentesComponent, visible: true },
  { id: '2.3', capituloId: '2', componenteRef: ObjetivosComponent, visible: true },
  { id: '2.4', capituloId: '2', componenteRef: LocalizacionComponent, visible: true },
  { id: '2.5', capituloId: '2', componenteRef: DelimitacionComponent, visible: true },
  { id: '2.6', capituloId: '2', componenteRef: CronogramaComponent, visible: true },
  { id: '2.7', capituloId: '2', componenteRef: ComponentesComponent, visible: true },
  { id: '2.8', capituloId: '2', componenteRef: DemandaAguaComponent, visible: true },
  {
    id: '2.9',
    capituloId: '2',
    componenteRef: InsumosEquiposComponent,
    visible: true,
  },
  {
    id: '2.10',
    capituloId: '2',
    componenteRef: PersonalComponent,
    visible: true,
  },
  { id: '2.11', capituloId: '2', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '3.1', capituloId: '3', componenteRef: MedioFisicoComponent, visible: true },
  { id: '3.2', capituloId: '3', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '3.3', capituloId: '3', componenteRef: ArqueologiaComponent, visible: true },
  { id: '3.4', capituloId: '3', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '4.1', capituloId: '4', componenteRef: ParticipacionCiudadanaComponent, visible: true },
  { id: '4.2', capituloId: '4', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '5.1', capituloId: '5', componenteRef: ImpactosCierreComponent, visible: true },
  {
    id: '5.2',
    capituloId: '5',
    componenteRef: AreasInfluenciaComponent,
    visible: true,
  },
  // Las sub-capas 5.2.1 y 5.2.2 quedan absorbidas por el inventario compuesto
  // de la 5.2, que declara ambos en un solo microcomponente. Se retiran del
  // flujo sin borrar su ficha: el `visible` existe para esto.
  { id: '5.2.1', capituloId: '5', componenteRef: DelimitacionMapaComponent, visible: false },
  { id: '5.2.2', capituloId: '5', componenteRef: DelimitacionMapaComponent, visible: false },
  { id: '5.3', capituloId: '5', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '6.1', capituloId: '6', componenteRef: ConsultorasComponent, visible: true },
  { id: '6.2', capituloId: '6', componenteRef: AdjuntarDocumentosComponent, visible: true },
  { id: '7.1', capituloId: '7', componenteRef: AdjuntarDocumentosComponent, visible: true },
];

/** Índice por número de sección para resolver una ficha sin recorrer el arreglo. */
export const FICHA_POR_NUMERO = new Map(CATALOGO_MICROSECCIONES.map((ficha) => [ficha.id, ficha]));
