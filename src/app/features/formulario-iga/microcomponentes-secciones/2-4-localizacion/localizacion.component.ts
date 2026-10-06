import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Índice oficial de la sección dentro del expediente DAEX. */
const NUMERO_SECCION = '2.4';

/**
 * Envelope UTM admisible para un proyecto en territorio peruano.
 *
 * Toda la страны cae en el hemisferio sur, así que el norte lleva el desfase
 * de 10 000 000 m y nunca baja de 7 900 000. El este se mantiene dentro de las
 * tres zonas que ofrece el selector.
 *
 * Se validan los rangos y no solo la presencia del dato: un `250000` tecleado
 * en el norte o un `8850000` en el este son errores de columna frecuentes, y
 * producirían un expediente con coordenadas que no corresponden a ningún punto.
 */
const ESTE_MINIMO = 300_000;
const ESTE_MAXIMO = 700_000;
const NORTE_MINIMO = 7_900_000;
const NORTE_MAXIMO = 10_000_000;

/** Zonas UTM que atraviesan el territorio continental peruano. */
const ZONAS_UTM: readonly string[] = ['17S', '18S', '19S'];

/**
 * Microcomponente de la sección 2.4 · Localización Geográfica y Política.
 *
 * La sección tiene dos mitades con permisos distintos, como la 2.2: el ubigeo
 * político llega calculado y no se edita, mientras que el punto central de la
 * campaña sí lo declara el titular.
 */
@Component({
  selector: 'app-localizacion',
  templateUrl: './localizacion.component.html',
  styleUrls: ['./localizacion.component.css'],
})
export class LocalizacionComponent {
  protected readonly store = inject(DaexStore);

  /** Zonas ofrecidas en el selector. */
  protected readonly zonas = ZONAS_UTM;

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * El orquestador lo inyecta al apilar las fichas, de modo que el semáforo se
   * confirme contra la fila que corresponde en lugar de contra un literal.
   */
  readonly numero = input<string>(NUMERO_SECCION);

  protected readonly esteCentral = signal<number | null>(null);
  protected readonly norteCentral = signal<number | null>(null);
  protected readonly zonaCentral = signal<string>('');
  protected readonly nombrePoblado = signal<string>('');

  /** Marca de confirmación, para acusar recibo del guardado sin abrir un toast. */
  protected readonly guardado = signal(false);

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** El este tecleado cae fuera del envelope peruano. */
  protected readonly esteFueraDeRango = computed(() => {
    const este = this.esteCentral();
    return este !== null && (este < ESTE_MINIMO || este > ESTE_MAXIMO);
  });

  /** El norte tecleado cae fuera del envelope peruano. */
  protected readonly norteFueraDeRango = computed(() => {
    const norte = this.norteCentral();
    return norte !== null && (norte < NORTE_MINIMO || norte > NORTE_MAXIMO);
  });

  /**
   * Validador en caliente.
   *
   * Exige los cuatro campos con contenido real: coordenadas dentro del
   * envelope, zona elegida y poblado nombrado.
   */
  protected readonly formularioValido = computed(() => {
    const este = this.esteCentral();
    const norte = this.norteCentral();

    return (
      este !== null &&
      este >= ESTE_MINIMO &&
      este <= ESTE_MAXIMO &&
      norte !== null &&
      norte >= NORTE_MINIMO &&
      norte <= NORTE_MAXIMO &&
      ZONAS_UTM.includes(this.zonaCentral()) &&
      this.nombrePoblado().trim().length > 0
    );
  });

  /**
   * Restaura lo ya capturado al recuperar la ficha.
   *
   * El orquestador destruye las piezas al cambiar de capítulo, de modo que un
   * punto central guardado solo en memoria se perdería al navegar y volver,
   * mientras el semáforo seguiría en verde.
   */
  constructor() {
    const punto = this.store.formulario().puntoCentral;
    this.esteCentral.set(punto?.este ?? null);
    this.norteCentral.set(punto?.norte ?? null);
    this.zonaCentral.set(punto?.zona ?? '');
    this.nombrePoblado.set(punto?.poblado ?? '');
  }

  protected alEscribirEste(evento: Event): void {
    this.esteCentral.set(this.aNumero(evento));
    this.guardado.set(false);
  }

  protected alEscribirNorte(evento: Event): void {
    this.norteCentral.set(this.aNumero(evento));
    this.guardado.set(false);
  }

  protected alElegirZona(evento: Event): void {
    this.zonaCentral.set((evento.target as HTMLSelectElement).value);
    this.guardado.set(false);
  }

  protected alEscribirPoblado(evento: Event): void {
    this.nombrePoblado.set((evento.target as HTMLInputElement).value);
    this.guardado.set(false);
  }

  /** Texto explicativo del rango admitido en cada columna. */
  protected rangoEste(): string {
    return `${ESTE_MINIMO.toLocaleString('es-PE')} – ${ESTE_MAXIMO.toLocaleString('es-PE')}`;
  }

  protected rangoNorte(): string {
    return `${NORTE_MINIMO.toLocaleString('es-PE')} – ${NORTE_MAXIMO.toLocaleString('es-PE')}`;
  }

  /**
   * Interpreta el contenido de un input numérico.
   *
   * Se descarta cualquier valor no numérico en lugar de propagar `NaN`: un
   * `NaN` en la señal superaría las comparaciones del validador sin avisar.
   */
  private aNumero(evento: Event): number | null {
    const bruto = (evento.target as HTMLInputElement).value.trim();
    if (bruto === '') {
      return null;
    }
    const numero = Number(bruto);
    return Number.isFinite(numero) ? numero : null;
  }

  /**
   * Publica el punto central y pasa la sección a verde.
   *
   * El semáforo solo se muta cuando la validación pasa, de modo que el ícono de
   * conformidad nunca se anticipe a los datos que lo respaldan.
   */
  protected guardarYValidarSeccion(): void {
    const este = this.esteCentral();
    const norte = this.norteCentral();

    if (!this.formularioValido() || este === null || norte === null) {
      return;
    }

    this.store.actualizarFormulario({
      puntoCentral: {
        este,
        norte,
        zona: this.zonaCentral(),
        poblado: this.nombrePoblado().trim(),
      },
    });
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    this.guardado.set(true);
  }
}
