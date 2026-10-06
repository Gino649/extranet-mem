import { Component, computed, inject, input, signal } from '@angular/core';
import { DaexStore } from '../../../../state/daex.store';

/** Vértice del polígono del área efectiva, en UTM WGS84 (zona 18S). */
interface Vertice {
  readonly este: number;
  readonly norte: number;
}

/** Sistema de referencia de la capa, con su zona UTM. */
interface SistemaCoordenadas {
  readonly codigo: string;
  readonly zona: number;
  readonly datum: string;
}

/**
 * Microcomponente de la sección 2.5 · Delimitación del Área Efectiva.
 *
 * El visor de mapas OpenLayers queda encapsulado tras una API de vértices: el
 * formulario trabaja sobre el polígono y la capa de render se monta aparte,
 * de modo que añadir el visor no altera la lógica de validación.
 *
 * La misma pieza sirve para las dos sub-capas de influencia (5.2.1 y 5.2.2):
 * el orquestador instancia una copia por sección y le pasa su índice.
 */
@Component({
  selector: 'app-delimitacion-mapa',
  templateUrl: './delimitacion-mapa.component.html',
  styleUrls: ['./delimitacion-mapa.component.css'],
})
export class DelimitacionMapaComponent {
  protected readonly store = inject(DaexStore);

  /**
   * Índice de la sección que instancia este microcomponente.
   *
   * Necesario porque el mismo visor se apila para 2.5, 5.2.1 y 5.2.2: sin
   * este input las tres copias confirmarían contra la misma fila del store.
   */
  readonly numero = input<string>('2.5');

  private readonly poligono = signal<readonly Vertice[]>([
    { este: 431_250, norte: 8_674_100 },
    { este: 436_800, norte: 8_674_100 },
    { este: 436_800, norte: 8_679_400 },
    { este: 431_250, norte: 8_679_400 },
  ]);

  protected readonly sistema: SistemaCoordenadas = {
    codigo: 'EPSG:32718',
    zona: 18,
    datum: 'WGS84',
  };

  protected readonly vertices = this.poligono.asReadonly();

  /** Metadatos de la sección, resueltos contra el árbol del store. */
  protected readonly seccion = computed(() => this.store.seccionPorNumero(this.numero()));

  /** Un polígono de delimitación exige cuatro vértices o más. */
  protected readonly valido = computed(() => this.poligono().length >= 4);

  /**
   * Superficie por fórmula del cordón (shoelace) sobre coordenadas planas en
   * metros. Es la que se declara en el plano y se verifica contra el shapefile.
   */
  protected readonly superficieHa = computed(() => {
    const puntos = this.poligono();
    if (puntos.length < 3) {
      return 0;
    }
    let acumulado = 0;
    for (let indice = 0; indice < puntos.length; indice += 1) {
      const actual = puntos[indice];
      const siguiente = puntos[(indice + 1) % puntos.length];
      if (!actual || !siguiente) {
        continue;
      }
      acumulado += actual.este * siguiente.norte - siguiente.este * actual.norte;
    }
    return Math.abs(acumulado) / 2 / 10_000;
  });

  protected readonly mensaje = signal<string | null>(null);

  protected agregarVertice(este: string, norte: string): void {
    const valorEste = Number(este);
    const valorNorte = Number(norte);
    if (!Number.isFinite(valorEste) || !Number.isFinite(valorNorte)) {
      this.mensaje.set('Ingrese coordenadas numéricas en metros.');
      return;
    }
    this.poligono.update((actual) => [...actual, { este: valorEste, norte: valorNorte }]);
    this.mensaje.set(null);
  }

  protected quitarVertice(indice: number): void {
    this.poligono.update((actual) => actual.filter((_, posicion) => posicion !== indice));
  }

  protected confirmar(): void {
    if (!this.valido()) {
      this.mensaje.set('El polígono debe tener al menos cuatro vértices.');
      return;
    }
    this.store.actualizarEstadoSeccion(this.numero(), 'VERDE');
    // Publicar el polígono dispara el cruce catastral de la 2.2, que se
    // conforms sola: no es una segunda tarea que el titular deba recordar.
    this.store.registrarAreaEfectiva(this.poligono());
    this.mensaje.set(`Delimitación confirmada: ${this.superficieHa().toFixed(2)} ha.`);
  }
}
