import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '2.2';

/**
 * Concesión minera devuelta por el cruce catastral.
 *
 * `sunarp` es el número de partida registral que acredita la titularidad, no el
 * nombre del propietario: el catastro lo entrega por código de título.
 */
interface DerechoMinero {
  readonly codigo: string;
  readonly nombre: string;
  readonly tipo: string;
  readonly expediente: string;
  readonly sunarp: string;
  readonly participacion: number;
  readonly fechaFormulacion: string;
}

/** Concesiones del titular que se superponen al área efectiva. */
const DERECHOS_PROPIOS: readonly DerechoMinero[] = [
  {
    codigo: '01-AB-2021-0482917',
    nombre: 'Concesión Metálica Las Dunas',
    tipo: 'Metálica',
    expediente: '2021-0345217-RM',
    sunarp: 'SUNARP-2022-0045612',
    participacion: 100,
    fechaFormulacion: '14/03/2021',
  },
  {
    codigo: '01-AB-2021-0482921',
    nombre: 'Concesión de Explotación Dunas Norte',
    tipo: 'Metálica',
    expediente: '2021-0345231-RM',
    sunarp: 'SUNARP-2022-0045618',
    participacion: 60,
    fechaFormulacion: '14/03/2021',
  },
];

/**
 * Concesiones de terceros que invaden el polígono.
 *
 * Sirven de prueba de que la superposición se marca en rojo y de que la
 * sección exige análisis técnico, no solo confirmación.
 */
const DERECHOS_TERCEROS: readonly DerechoMinero[] = [
  {
    codigo: '01-AB-2019-0331874',
    nombre: 'Concesión Metálica Pampa del Sol',
    tipo: 'Metálica',
    expediente: '2019-0218745-RM',
    sunarp: 'SUNARP-2020-0031899',
    participacion: 100,
    fechaFormulacion: '02/08/2019',
  },
  {
    codigo: '01-AB-2020-0401122',
    nombre: 'Concesión No Metálica Cerro Blanco',
    tipo: 'No metálica',
    expediente: '2020-0298871-RM',
    sunarp: 'SUNARP-2021-0040233',
    participacion: 45,
    fechaFormulacion: '21/11/2020',
  },
];

/**
 * Microcomponente de la sección 2.2 · Antecedentes y Derechos Mineros.
 *
 * Toda la sección es de solo lectura: el titular no captura concessions, las
 * consulta. Por eso no expone botón de guardado y su semáforo no lo decide una
 * acción, sino la disponibilidad del cruce catastral.
 */
@Component({
  selector: 'app-antecedentes',
  templateUrl: './antecedentes.component.html',
  styleUrls: ['./antecedentes.component.css'],
})
export class AntecedentesComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta al apilar las fichas, de modo que el semáforo se
   * confirme contra la fila que corresponde en lugar de contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  protected readonly derechosPropios = signal<readonly DerechoMinero[]>([]);
  protected readonly derechosTerceros = signal<readonly DerechoMinero[]>([]);

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /**
   * Cruce catastral pendiente: no hay área efectiva registrada todavía.
   *
   * Cada grilla dice en su propio lenguaje qué falta, en vez de repetir un
   * aviso genérico arriba. `false` en cuanto la 2.5 publica su polígono.
   */
  protected readonly crucePendiente = computed(
    () => this.store.areaEfectivaRegistrada().length < 3,
  );

  constructor() {
    /*
     * El efecto hace, por ahora, de backend: escucha el polígono confirmado en
     * la 2.5 y, sin que el titular toque nada, inyecta el resultado del cruce y
     * pone la sección en verde.
     *
     * Es simétrico a propósito. Si el área efectiva se retira, las grillas se
     * vacían y el semáforo vuelve al gris neutro: mantener concessions de un
     * polígono que ya no existe, respaldadas por un check verde, es peor que
     * mostrar honestamente que el cruce está pendiente.
     *
     * Se declara en el constructor porque `effect` exige contexto de
     * inyección, y no en `ngOnInit`. Cuando el servicio de intersección
     * espacial entre, este cuerpo se sustituye por una suscripción al
     * resultado real sin tocar la plantilla.
     */
    effect(() => {
      if (this.crucePendiente()) {
        this.derechosPropios.set([]);
        this.derechosTerceros.set([]);
        this.store.actualizarEstadoSeccion(this.numero(), 'GRIS');
        return;
      }
      this.derechosPropios.set(DERECHOS_PROPIOS);
      this.derechosTerceros.set(DERECHOS_TERCEROS);
      this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    });
  }
}
