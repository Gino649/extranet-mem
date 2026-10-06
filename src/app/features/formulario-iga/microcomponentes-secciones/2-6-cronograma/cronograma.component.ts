import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DaexStore,
  ETAPAS_BASE_CRONOGRAMA,
  type EtapaCronograma,
} from '../../../../state/daex.store';

/**
 * Una etapa del cronograma con su inversión asociada.
 *
 * Es el tipo del store con `editando` encima. La etapa vive en el store porque
 * la 2.10 la consume; `editando` es estado efímero de la vista y por eso no
 * forma parte de lo que se guarda.
 */
interface Etapa extends EtapaCronograma {
  /** Si la fila tiene abiertos los campos de edición en línea. */
  readonly editando: boolean;
}

/** Duración máxima por etapa, en meses: dos años caben holgados en el Gantt. */
const MESES_MAXIMOS = 240;

/** Inversión máxima por etapa, en soles. */
const INVERSION_MAXIMA = 1_000_000_000;

/** Abreviaturas de mes en castellano, tal como se escriben en el Perú. */
const MESES_ABREVIADOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Oct',
  'Nov',
  'Dic',
] as const;

/** Desplazamiento de un mes en índice absoluto, base 0. */
const MESES_POR_ANIO = 12;

/**
 * `YYYY-MM` a índice absoluto de mes (año × 12 + mes − 1), o `null` si no cuadra.
 *
 * Todo el cálculo de fechas es aritmética entera sobre el año y el mes. No se
 * pasa el texto por `new Date` porque una cadena `YYYY-MM` se interpreta como
 * UTC: en Lima (UTC−5) `new Date('2026-01')` es diciembre de 2025, y el
 * cronograma se iría un mes atrás respecto de lo que se ve en la pantalla.
 */
function aIndiceMes(anioMes: string): number | null {
  const coincide = /^(\d{4})-(\d{2})$/.exec(anioMes);
  if (!coincide) {
    return null;
  }
  const mes = Number(coincide[2]);
  if (mes < 1 || mes > MESES_POR_ANIO) {
    return null;
  }
  return Number(coincide[1]) * MESES_POR_ANIO + (mes - 1);
}

/** Índice absoluto de mes a `YYYY-MM`. */
function aAnioMes(indice: number): string {
  const anio = Math.floor(indice / MESES_POR_ANIO);
  const mes = (indice % MESES_POR_ANIO) + 1;
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

/** Mes actual en formato `YYYY-MM`. */
function mesActual(): string {
  const hoy = new Date();
  return aAnioMes(hoy.getFullYear() * MESES_POR_ANIO + hoy.getMonth());
}

/**
 * Microcomponente de la sección 2.6 · Cronograma e Inversión del Proyecto.
 *
 * El Gantt se dibuja por posición: cada barra es una fracción del ancho del
 * proyecto, de modo que agregar o mover una etapa no requiere recalcular el
 * gráfico entero. La posición de cada barra sale de `inicio`, que resuelve el
 * grafo de dependencias, y no del orden del arreglo: si el titular reordera las
 * filas, las barras se recolocan solas en vez de quedar desfasadas.
 */
@Component({
  selector: 'app-cronograma',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './cronograma.component.html',
  styleUrls: ['./cronograma.component.css'],
})
export class CronogramaComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta en `inputs` al usar `ngComponentOutlet`, así que
   * no se puede fijar a «2.6» en el código: la misma clase puede atender
   * cualquier sección del índice.
   */
  readonly numero = input<string>('2.6');

  private readonly etapas = signal<readonly Etapa[]>(
    ETAPAS_BASE_CRONOGRAMA.map((etapa) => ({ ...etapa, editando: false })),
  );

  protected readonly listaEtapas = this.etapas.asReadonly();

  /**
   * Rehidrata el Gantt con lo que el titular ya validó.
   *
   * El orquestador destruye los microcomponentes al cambiar de capítulo, así
   * que sin esto las duraciones editadas se perderían al volver a la 2.6. El
   * `editando` se fuerza a `false` porque una fila no puede volver a la vista
   * con el editor abierto.
   */
  constructor() {
    effect(() => {
      const guardadas = this.store.cronogramaRegistrado();
      if (guardadas.length === 0) {
        return;
      }
      this.etapas.set(guardadas.map((etapa) => ({ ...etapa, editando: false })));
    });
  }

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** Duración total del proyecto, base de la escala del Gantt. */
  protected readonly duracionTotal = computed(() =>
    this.etapas().reduce(
      (maximo, etapa) => Math.max(maximo, (this.inicios().get(etapa.id) ?? 0) + etapa.meses),
      0,
    ),
  );

  protected readonly inversionTotal = computed(() =>
    this.etapas().reduce((total, etapa) => total + etapa.inversion, 0),
  );

  /** Un cronograma es válido si no hay ciclos entre etapas. */
  protected readonly sinCiclos = computed(() => {
    const enCurso = new Set<string>();
    const terminado = new Set<string>();
    const visitar = (id: string): boolean => {
      if (terminado.has(id)) {
        return true;
      }
      if (enCurso.has(id)) {
        return false;
      }
      enCurso.add(id);
      const etapa = this.etapas().find((candidata) => candidata.id === id);
      if (etapa) {
        for (const previa of etapa.dependeDe) {
          if (!visitar(previa)) {
            return false;
          }
        }
      }
      enCurso.delete(id);
      terminado.add(id);
      return true;
    };
    return this.etapas().every((etapa) => visitar(etapa.id));
  });

  protected readonly mensaje = signal<string | null>(null);

  /**
   * Mes de inicio de cada etapa, resuelto una sola vez por etapa.
   *
   * La resolución lleva un conjunto de etapas «en curso» para no recruzar un
   * ciclo. Sin esa guardia, un cronograma circular reventaba la pila durante el
   * render, porque `duracionTotal` llama a `inicio` antes de que `sinCiclos`
   * tenga ocasión de avisar: el fallo era un `Maximum call stack size
   * exceeded` y no un mensaje. Un ciclo devuelve 0 de desplazamiento, ásí que el
   * Gantt queda raro pero se dibuja y el botón de validar sigue bloqueado.
   */
  protected readonly inicios = computed(() => {
    const lista = this.etapas();
    const resueltos = new Map<string, number>();
    const enCurso = new Set<string>();

    const resolver = (id: string): number => {
      const yaResuelto = resueltos.get(id);
      if (yaResuelto !== undefined) {
        return yaResuelto;
      }
      if (enCurso.has(id)) {
        return 0;
      }
      const etapa = lista.find((candidata) => candidata.id === id);
      if (!etapa) {
        return 0;
      }
      enCurso.add(id);
      let arranque = 0;
      for (const idPrevia of etapa.dependeDe) {
        const previa = lista.find((candidata) => candidata.id === idPrevia);
        if (previa) {
          arranque = Math.max(arranque, resolver(idPrevia) + previa.meses);
        }
      }
      enCurso.delete(id);
      resueltos.set(id, arranque);
      return arranque;
    };

    for (const etapa of lista) {
      resolver(etapa.id);
    }
    return resueltos;
  });

  /** Mes en que arranca la etapa dentro del proyecto. */
  protected inicio(etapa: Etapa): number {
    return this.inicios().get(etapa.id) ?? 0;
  }

  /* ------------------------------------------------------------------
     FECHAS CALENDARIO
     ------------------------------------------------------------------
     El ancla es la etapa sin predecesoras: la única cuyo mes de arranque fija
     el titular. Todo lo demás se deriva.

     Las fechas salen de `inicios()`, el mismo mapa que coloca las barras. Si
     se calcularan aparte, cascada por posición en el arreglo, la fila y la
     barra podrían discrepar en cuanto el orden dejara de coincidir con la
     topología: el Gantt marcaría un mes y la columna de fechas otro.
     ------------------------------------------------------------------ */

  /** `true` si la etapa ancla el cronograma y por tanto es editable en fecha. */
  protected esAncla(etapa: Etapa): boolean {
    return etapa.dependeDe.length === 0;
  }

  /** Mes absoluto (año × 12 + mes) en el que arranca cada etapa. */
  private readonly mesDeInicio = computed(() => {
    const anclaje = this.etapas().find((etapa) => this.esAncla(etapa));
    const base = aIndiceMes(anclaje?.fechaInicio ?? '') ?? aIndiceMes(mesActual()) ?? 0;
    const inicios = this.inicios();
    const posiciones = new Map<string, number>();
    for (const etapa of this.etapas()) {
      posiciones.set(etapa.id, base + (inicios.get(etapa.id) ?? 0));
    }
    return posiciones;
  });

  /** Mes de la etapa en formato `YYYY-MM`. */
  protected fechaInicioDe(etapa: Etapa): string {
    const indice = this.mesDeInicio().get(etapa.id);
    return indice === undefined ? '' : aAnioMes(indice);
  }

  /**
   * Mes en que termina el cronograma completo.
   *
   * Es la etapa más lejana por fecha de fin, no la última del arreglo: con el
   * Gantt ordenado como el grafo lo indique, la última fila puede no ser la que
   * cierra el proyecto.
   */
  protected readonly fechaFinProyecto = computed(() => {
    const lista = this.etapas();
    if (lista.length === 0) {
      return '';
    }
    return lista.reduce((masLejana, etapa) => {
      const fin = this.fechaFinDe(etapa);
      return fin > masLejana ? fin : masLejana;
    }, '');
  });

  /**
   * Mes de fin de la etapa, derivado: el de inicio más la duración menos uno.
   *
   * La duración cuenta meses naturales completos, así que una etapa de 18 meses
   * que arranca en enero acaba en junio del año siguiente. No se guarda en el
   * modelo sino que se calcula: guardado, cualquier edición de la duración lo
   * dejaría desfasado y la única manera de evitarlo sería un segundo
   * actualizador encargado de volver a escribirlo.
   */
  protected fechaFinDe(etapa: Etapa): string {
    const inicio = this.mesDeInicio().get(etapa.id);
    if (inicio === undefined || etapa.meses <= 0) {
      return '';
    }
    return aAnioMes(inicio + etapa.meses - 1);
  }

  /** Fija el mes de arranque del cronograma. Solo el ancla acepta fecha. */
  protected editarFechaInicio(id: string, fecha: string): void {
    if (aIndiceMes(fecha) === null) {
      return;
    }
    this.etapas.update((lista) =>
      lista.map((etapa) => (etapa.id === id ? { ...etapa, fechaInicio: fecha } : etapa)),
    );
  }

  /** Traduce `YYYY-MM` a «Ene 2026». */
  protected formatarFechaAnioMes(fecha: string): string {
    const indice = aIndiceMes(fecha);
    if (indice === null) {
      return 'Pendiente';
    }
    const mes = indice % MESES_POR_ANIO;
    const anio = Math.floor(indice / MESES_POR_ANIO);
    return `${MESES_ABREVIADOS[mes]} ${anio}`;
  }

  /** Desplazamiento de la barra, en porcentaje del ancho total. */
  protected desplazamiento(etapa: Etapa): number {
    const total = this.duracionTotal();
    return total === 0 ? 0 : (this.inicio(etapa) / total) * 100;
  }

  /**
   * Ancho de la barra, en porcentaje del ancho total.
   *
   * Se acota a 100 porque el desplazamiento y el ancho comparten el mismo
   * carril: sin este tope, una etapa larga sumada a un desplazamiento alto
   * empujaría la barra fuera de la pista y `overflow: hidden` la recortaría sin
   * dejar rastro.
   */
  protected ancho(etapa: Etapa): number {
    const total = this.duracionTotal();
    if (total === 0) {
      return 0;
    }
    return Math.min(100, (etapa.meses / total) * 100);
  }

  /**
   * Abre o cierra los campos de edición de una fila.
   *
   * Solo una fila a la vez: con dos editores abiertos la suma del encabezado
   * cambia dos veces por pulsación y es fácil leer el total de una etapa que ya
   * no se está mirando.
   */
  protected alternarEdicionEtapa(id: string): void {
    const abierta = this.etapas().find((etapa) => etapa.id === id)?.editando ?? false;
    this.etapas.update((lista) =>
      lista.map((etapa) =>
        etapa.id === id ? { ...etapa, editando: !abierta } : { ...etapa, editando: false },
      ),
    );
  }

  /**
   * Aplica la duración escrita en la caja en línea.
   *
   * Recibe el texto y no el número porque el valor de un `<input type="number">`
   * llega vacío mientras se borra, y `Number('')` es `0`: una etapa que se
   * despista en un campo pasaría a medir cero meses sin que nadie lo pidiera.
   */
  protected editarMeses(id: string, texto: string): void {
    this.editarEtapa(id, 'meses', this.aNumero(texto, 1, MESES_MAXIMOS));
  }

  /** Aplica la inversión escrita en la caja en línea. */
  protected editarInversion(id: string, texto: string): void {
    this.editarEtapa(id, 'inversion', this.aNumero(texto, 0, INVERSION_MAXIMA));
  }

  /** Sustituye un campo numérico de una etapa, conservando el resto. */
  private editarEtapa(id: string, campo: 'meses' | 'inversion', valor: number): void {
    if (!Number.isFinite(valor)) {
      return;
    }
    this.etapas.update((lista) =>
      lista.map((etapa) => (etapa.id === id ? { ...etapa, [campo]: valor } : etapa)),
    );
  }

  /** Convierte el texto de un campo a número acotado, con respaldo al declararse vacío. */
  private aNumero(texto: string, minimo: number, maximo: number): number {
    const valor = Number.parseFloat(texto);
    if (!Number.isFinite(valor)) {
      return minimo;
    }
    return Math.min(maximo, Math.max(minimo, valor));
  }

  protected formatearInversion(monto: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      maximumFractionDigits: 0,
    }).format(monto);
  }

  /** Cierra los editores abiertos y publica el cronograma. */
  protected confirmar(): void {
    if (!this.sinCiclos()) {
      this.mensaje.set('El cronograma contiene una dependencia circular.');
      return;
    }
    this.etapas.update((lista) => lista.map((etapa) => ({ ...etapa, editando: false })));
    this.store.registrarCronograma(this.etapas());
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.mensaje.set('Cronograma e inversión validados.');
  }
}
