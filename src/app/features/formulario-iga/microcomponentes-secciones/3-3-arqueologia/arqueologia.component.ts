import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdjuntarDocumentosComponent } from '../1-3-adjuntar-documentos/adjuntar-documentos.component';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '3.3';

/** Estados que el titular puede declarar para su trámite PMA ante el MINCUL. */
const ESTADOS_PMA = ['APROBADO', 'EN_TRAMITE'] as const;

/**
 * Mínimo de caracteres para dar por escrito un número de trámite.
 *
 * Tanto una resolución CIRA (`RD N° 0123-2024-...`) como un expediente PMA
 * (`EXP-PMA-N° 2024-045`) superan con holgura las seis letras; el umbral solo
 * evita que un ruido de teclado cierre la sección.
 */
const MINIMO_CARACTERES_TRAMITE = 6;

/**
 * Microcomponente de la sección 3.3 · Arqueología y Patrimonio Cultural.
 *
 * La sección es una bifurcación excluyente: CIRA aprobado o Plan de Monitoreo
 * Arqueológico. Solo la rama activa participa de la validación, de modo que el
 * texto de una resolución CIRA nunca se coloca por error bajo el rótulo de un
 * expediente PMA (y al revés).
 */
@Component({
  selector: 'app-arqueologia',
  imports: [FormsModule, AdjuntarDocumentosComponent],
  templateUrl: './arqueologia.component.html',
  styleUrls: ['./arqueologia.component.css'],
})
export class ArqueologiaComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta en `inputs` al usar `ngComponentOutlet`, así que
   * el semáforo se confirma contra la fila correcta del árbol en lugar de
   * contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  /** Bifurcación: `null` sin responder, `true` CIRA aprobado, `false` PMA. */
  protected readonly tieneCira = signal<boolean | null>(null);

  /** Número de resolución CIRA o código de expediente PMA, según la rama. */
  protected readonly numResolucion = signal<string>('');

  /** Fecha de emisión oficial de la resolución CIRA. */
  protected readonly fechaEmision = signal<string>('');

  /** Estado declarado del trámite PMA ante el MINCUL. */
  protected readonly estadoTramitePma = signal<string>('');

  /** Marca de confirmación, para acusar recibo del guardado sin abrir un toast. */
  protected readonly guardado = signal(false);

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /**
   * Validador de la bifurcación.
   *
   * Cada rama exige sus propios campos. El número de trámite es compartido por
   * ambas pero siempre se interpreta según la rama activa, porque al cambiar la
   * bifurcación se descarta lo tecleado.
   */
  protected readonly formularioValido = computed(() => {
    const modo = this.tieneCira();
    const numero = this.numResolucion().trim();

    if (modo === true) {
      return numero.length >= MINIMO_CARACTERES_TRAMITE && this.fechaEmision().length > 0;
    }
    if (modo === false) {
      return (
        numero.length >= MINIMO_CARACTERES_TRAMITE &&
        (ESTADOS_PMA as readonly string[]).includes(this.estadoTramitePma())
      );
    }
    return false;
  });

  /**
   * Reinicia la rama al cambiar la bifurcación.
   *
   * Si se deja la resolución CIRA en el campo al pasar a PMA, sería un número
   * presentado con rótulo equivocado. La misma limpieza aplica para el PMA que
   * quedara a medias antes de declarar CIRA.
   */
  protected alCambiarOpcionBifurcacion(): void {
    this.numResolucion.set('');
    this.fechaEmision.set('');
    this.estadoTramitePma.set('');
    this.guardado.set(false);
  }

  /**
   * Publica la conformidad de la sección 3.3.
   *
   * El semáforo solo se muta cuando la validación de la rama activa pasa, de
   * modo que la conformidad nunca se anticipe al sustento documental.
   */
  protected guardarYValidarArqueologiaSeccion(): void {
    if (!this.formularioValido()) {
      return;
    }
    this.guardado.set(true);
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
  }
}
