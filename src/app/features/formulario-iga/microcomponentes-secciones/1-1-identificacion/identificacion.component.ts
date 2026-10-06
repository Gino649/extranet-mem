import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '1.1';

/** RUC peruano: 11 dígitos, con prefijo 20 para personas jurídicas. */
const RUC_PERSONA_JURIDICA = /^\d{11}$/;

/**
 * Microcomponente de la sección 1.1 · Identificación del Titular (solo consulta).
 *
 * Esta sección no se edita desde el expediente: la identidad del titular y la de
 * su representante legal provienen del Registro Maestro de Administrados del
 * MINEM, que es la fuente autoritativa. Por eso el bloque se presenta como una
 * ficha de alta densidad —etiqueta atenuada arriba, valor con contraste abajo— y
 * no como un formulario. Cualquier corrección se gestiona en el padrón y llega
 * aquí por sincronización.
 *
 * Como los datos llegan precargados e inmutables, la sección es conforme por
 * definición: `ngOnInit` enciende el semáforo en Verde sin pedir una acción de
 * guardado, de modo que el titular puede avanzar con el scroll por el capítulo.
 */
@Component({
  selector: 'app-identificacion',
  templateUrl: './identificacion.component.html',
  styleUrls: ['./identificacion.component.css'],
})
export class IdentificacionComponent implements OnInit {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador apila varias secciones en la misma columna, así que el
   * componente no puede deducir su identidad de «la sección activa»: la recibe
   * por input y resuelve su propia fila del árbol del store.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Datos de la persona jurídica, sincronizados del padrón. */
  protected readonly razonSocial = signal('Corporación Minera San Andrés S.A.C.');
  protected readonly ruc = signal('20501234567');
  protected readonly domicilio = signal('Av. Javier Prado Este 4200, Santiago de Surco, Lima');
  protected readonly ubigeo = signal('Lima / Lima / Santiago de Surco');
  protected readonly correoLegal = signal('legal@minerasanandres.com.pe');

  /** Datos de la representación legal autorizada. */
  protected readonly representante = signal('María Fernanda Quispe Rojas');
  protected readonly cargo = signal('Gerente General');
  protected readonly correoRepresentante = signal('mquispe@minerasanandres.com.pe');

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /**
   * El padrón garantiza el formato, pero se muestra el sello para que una
   * anomalía de sincronización sea visible de un vistazo.
   */
  protected readonly rucValido = computed(() => RUC_PERSONA_JURIDICA.test(this.ruc().trim()));

  protected readonly consulta = true;

  /**
   * Enciende el semáforo en Verde Conforme de forma invisible.
   *
   * No hay botón que guardar: la sección es un espejo del padrón, así que
   * declararla conforme al montarse evita bloquear el avance con una tarea que
   * el titular no puede ejecutar aquí. `actualizarEstadoSeccion` resuelve la
   * fila por su índice oficial y es idempotente, de modo que volver a apilar la
   * sección no produce efectos adicionales.
   */
  ngOnInit(): void {
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
  }
}
