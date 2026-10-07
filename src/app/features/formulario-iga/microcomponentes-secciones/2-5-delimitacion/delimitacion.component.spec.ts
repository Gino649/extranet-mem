import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DelimitacionComponent } from './delimitacion.component';
import { MapaFacade, type ZonaUTM } from './mapa-facade';
import { construirShp, construirZip, construirZipMultiple } from './shapefile.pruebas';
import { DaexStore } from '../../../../state/daex.store';

/**
 * Ambito de busqueda.
 *
 * `panel` es el modal de delimitacion, donde ahora viven el visor y la grilla.
 * Los inventarios siguen en la raiz porque son lo unico que se ve con el modal
 * cerrado, y por eso mantienen ambito propio.
 */
type Ambito = 'raiz' | 'actividad' | 'uso' | 'panel';

/** Localiza un elemento o falla con un mensaje explicito, sin recurrir a `any`. */
function elemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) {
    throw new Error(`No se encontro el elemento requerido: ${selector}`);
  }
  return encontrado;
}

/** Bloque de inventario de una categoria, localizado por su rotulo. */
function bloqueInventario(raiz: HTMLElement, categoria: 'ACTIVIDAD' | 'USO'): HTMLElement {
  const rotulo = categoria === 'ACTIVIDAD' ? 'actividad minera' : 'uso minero';
  const bloque = [...raiz.querySelectorAll('.bloque')].find((candidato) =>
    (candidato.querySelector('.rotulo-bloque')?.textContent ?? '').includes(rotulo),
  );
  if (!bloque) {
    throw new Error(`No se encontro el bloque de inventario: ${categoria}`);
  }
  return bloque as HTMLElement;
}

/** Panel de delimitacion, abierto solo mientras se edita un area. */
function panel(raiz: HTMLElement): HTMLElement {
  const abierto = raiz.querySelector<HTMLElement>('.modalo');
  if (!abierto) {
    throw new Error('El panel de delimitacion no esta abierto');
  }
  return abierto;
}

/** Texto aplanado de un elemento, sin depender de como lo parte la plantilla. */
function textoLimpio(nodo: Element | null): string {
  return (nodo?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Doble de la fachada de OpenLayers.
 *
 * `ol` construye canvas y llama a `getContext`, que jsdom no implementa: sin este
 * sustituto el runner de pruebas se cae al montar el mapa. El doble permite ademas
 * observar cuantas veces se monta y se libera, que es justo lo que hay que
 * comprobar al mover el visor dentro de un panel que aparece y desaparece.
 */
class MapaFalso extends MapaFacade {
  montadas = 0;
  destruidas = 0;
  montadoEn: HTMLElement | null = null;
  poligonos: {
    readonly vertices: { readonly este: number; readonly norte: number }[];
    readonly zona: string;
    readonly encuadro: boolean;
  }[] = [];
  basesCambiadas: string[] = [];
  poligonoVisibles: boolean[] = [];
  centradas = 0;

  override montar(destino: HTMLElement, zona?: ZonaUTM): boolean {
    this.montadas += 1;
    this.montadoEn = destino;
    void zona;
    return true;
  }

  override actualizarPoligono(
    pares: readonly { readonly este: number; readonly norte: number }[],
    zona?: ZonaUTM,
    encuadrar = false,
  ): void {
    this.poligonos.push({ vertices: [...pares], zona: zona ?? '18S', encuadro: encuadrar });
  }

  override pintarPoligono(
    pares: readonly { readonly este: number; readonly norte: number }[],
    zona?: ZonaUTM,
  ): void {
    this.poligonos.push({ vertices: [...pares], zona: zona ?? '18S', encuadro: false });
  }

  override cambiarCapaBase(clave: string): void {
    this.basesCambiadas.push(clave);
  }

  override alternarPoligono(visible: boolean): void {
    this.poligonoVisibles.push(visible);
  }

  override centrarEnPeru(): void {
    this.centradas += 1;
  }

  override destruir(): void {
    this.destruidas += 1;
    this.montadoEn = null;
  }

  /** Ultimo poligono entregado al mapa. */
  get ultimo(): { vertices: readonly { este: number; norte: number }[]; zona: string } | undefined {
    return this.poligonos.at(-1);
  }

  /** Ultimo poligono al que se le pidio encuadrar la vista. */
  get ultimoEncuadrado(): (typeof this.poligonos)[number] | undefined {
    return [...this.poligonos].reverse().find((poligono) => poligono.encuadro);
  }
}

/** Triangulo de control, en UTM 18S, que el store acepta como poligono. */
const POLIGONO = [
  [431_250, 8_674_100],
  [436_800, 8_674_100],
  [436_800, 8_679_400],
];

/**
 * Cuadrilatero en grados, como lo daría un shapefile cuyo `.prj` declara
 * EPSG:4326. No coincide con `CUADRADO` a propósito: sirve para comprobar que un
 * archivo en grados entra sin convertir y que el aviso salta, porque los
 * shapefiles llegan de varias fuentes.
 */
const GRADOS: readonly (readonly [number, number])[] = [
  [-73.752, -8.724],
  [-73.741, -8.724],
  [-73.741, -8.712],
  [-73.752, -8.712],
];

/**
 * Envoltorio de la ficha montada para los tests.
 *
 * Concentra en un unico sitio la regla que exige el runner: despues de cada
 * interaccion hay que pedir `detectChanges`, porque el proyecto no usa deteccion
 * automatica. Repitir la llamada en cada asercion es donde estos tests suelen
 * romperse al copiar una linea de otra suite.
 */
function crearVista(fixture: ComponentFixture<DelimitacionComponent>) {
  const raiz = fixture.nativeElement as HTMLElement;

  const ambito = (nombre: Ambito): HTMLElement => {
    if (nombre === 'actividad') {
      return bloqueInventario(raiz, 'ACTIVIDAD');
    }
    if (nombre === 'uso') {
      return bloqueInventario(raiz, 'USO');
    }
    if (nombre === 'panel') {
      return panel(raiz);
    }
    return raiz;
  };

  const botonEn = (etiqueta: string, donde: Ambito): HTMLButtonElement | undefined =>
    [...ambito(donde).querySelectorAll('button')].find(
      (candidato) =>
        textoLimpio(candidato).includes(etiqueta) ||
        candidato.getAttribute('aria-label') === etiqueta,
    );

  return {
    raiz,

    /** Texto del ambito indicado. */
    texto(nombre: Ambito = 'raiz'): string {
      return textoLimpio(ambito(nombre));
    },

    /** Texto del primer elemento que coincide con el selector. */
    textoDe(selector: string): string {
      return textoLimpio(raiz.querySelector(selector));
    },

    nodo(selector: string): HTMLElement | null {
      return raiz.querySelector<HTMLElement>(selector);
    },

    control<T extends HTMLInputElement | HTMLSelectElement>(selector: string): T {
      return elemento<T>(raiz, selector);
    },

    /** `true` mientras el panel de delimitacion siga en pantalla. */
    panelAbierto(): boolean {
      return raiz.querySelector('.modalo') !== null;
    },

    /** Controles numericos de la grilla de vertices, en orden Este/Norte. */
    vertices(): HTMLInputElement[] {
      if (!raiz.querySelector('.modalo')) {
        return [];
      }
      return [...panel(raiz).querySelectorAll<HTMLInputElement>('input.celda-coordenada')];
    },

    /** Numero de filas de la grilla, que es la mitad de sus controles. */
    filasVertices(): number {
      return this.vertices().length / 2;
    },

    /**
     * Boton por etiqueta, sin pulsarlo.
     *
     * Separate de `pulsa` a proposito: comprobar si un boton esta deshabilitado
     * no debe dispararlo. Con el grabador cerrar el panel, usar `pulsa` para
     * leer su estado dejaba el test midiendo otra cosa.
     */
    boton(etiqueta: string, donde: Ambito = 'raiz'): HTMLButtonElement {
      const boton = botonEn(etiqueta, donde);
      if (!boton) {
        throw new Error(`No se encontro el boton "${etiqueta}" en ${donde}`);
      }
      return boton;
    },

    /** `true` mientras el boton este deshabilitado. */
    bloqueado(etiqueta: string, donde: Ambito = 'raiz'): boolean {
      return this.boton(etiqueta, donde).disabled;
    },

    /**
     * Pulsa un boton buscandolo por su etiqueta dentro del ambito.
     *
     * Ni por indice ni por posicion: en cuanto la plantilla anade un boton los
     * indices se corren y el test acaba pulsando otra cosa. El ambito
     * desambigua y la etiqueta sobrevive a los cambios de markup.
     */
    pulsa(etiqueta: string, donde: Ambito = 'raiz'): HTMLButtonElement {
      const boton = this.boton(etiqueta, donde);
      boton.click();
      fixture.detectChanges();
      return boton;
    },

    /** Numero de filas de un inventario, sin contar la fila de estado vacio. */
    filasInventario(categoria: 'ACTIVIDAD' | 'USO'): number {
      return ambito(categoria === 'ACTIVIDAD' ? 'actividad' : 'uso').querySelectorAll('tbody tr')
        .length;
    },

    /** Escribe en un control y repinta. */
    escribe(control: HTMLInputElement | HTMLSelectElement, valor: string): void {
      control.value = valor;
      control.dispatchEvent(new Event('input'));
      control.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    },

    /** Escribe por selector, con repintado incluido. */
    escribeEn(selector: string, valor: string): void {
      this.escribe(elemento<HTMLInputElement | HTMLSelectElement>(raiz, selector), valor);
    },

    /** Adjunta un archivo a un input de tipo file y dispara su cambio. */
    async subir(selector: string, nombre: string, contenido: string): Promise<void> {
      const entrada = elemento<HTMLInputElement>(raiz, selector);
      const archivo = new File([contenido], nombre, { type: 'text/csv' });
      Object.defineProperty(entrada, 'files', { value: [archivo] });
      entrada.dispatchEvent(new Event('change'));
      await new Promise((resolver) => setTimeout(resolver));
      fixture.detectChanges();
    },

    /** Repinta a mano, para clic directo sobre un nodo que no es un boton. */
    repinta(): void {
      fixture.detectChanges();
    },

    /** Adjunta un shapefile en bruto o comprimido y dispara su cambio. */
    async subirShapefile(nombre: string, contenido: ArrayBuffer): Promise<void> {
      const entrada = elemento<HTMLInputElement>(raiz, 'input[accept*="shp"]');
      const archivo = new File([contenido], nombre);
      Object.defineProperty(entrada, 'files', { value: [archivo] });
      entrada.dispatchEvent(new Event('change'));
      await new Promise((resolver) => setTimeout(resolver));
      fixture.detectChanges();
    },

    /**
     * Abre el modal de área nueva y rellena sus datos.
     *
     * El alta se dibuja y se graba en una sola pantalla, de modo que este paso
     * deja el panel abierto y la geometría en su punto de partida: la grilla con
     * tres filas en blanco y el visor montado. El área no entra al inventario
     * hasta que se graba.
     */
    crearArea(
      categoria: 'ACTIVIDAD' | 'USO',
      descripcion: string,
      actividad = 'Explotacion minera',
    ): void {
      this.pulsa('Nueva área', categoria === 'ACTIVIDAD' ? 'actividad' : 'uso');
      this.escribeEn('#area-descripcion', descripcion);
      this.escribeEn('#area-actividad', actividad);
    },

    /** Pulsa el botón que graba el área consolidada y cierra el panel. */
    grabarArea(): void {
      this.pulsa('Grabar área validada');
    },

    /** Vuelca el triangulo de control en las filas que ya ofrece la grilla. */
    escribirPoligono(): void {
      const controles = this.vertices();
      POLIGONO.forEach(([este, norte], indice) => {
        this.escribe(controles[indice * 2] as HTMLInputElement, String(este));
        this.escribe(controles[indice * 2 + 1] as HTMLInputElement, String(norte));
      });
    },

    /** Cierra el panel por su boton de cabecera. */
    cerrarPanel(): void {
      this.pulsa('Cerrar', 'panel');
    },
  };
}

type Vista = ReturnType<typeof crearVista>;

describe('DelimitacionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelimitacionComponent],
    })
      .overrideComponent(DelimitacionComponent, {
        set: { providers: [{ provide: MapaFacade, useClass: MapaFalso }] },
      })
      .compileComponents();
  });

  async function montar(): Promise<{
    vista: Vista;
    store: DaexStore;
    mapa: MapaFalso;
    fixture: ComponentFixture<DelimitacionComponent>;
  }> {
    const store = TestBed.inject(DaexStore);
    const fixture = TestBed.createComponent(DelimitacionComponent);
    fixture.componentRef.setInput('numero', '2.5');
    fixture.detectChanges();
    // La fachada es provider del componente, asi que vive en su injector y no
    // en la raiz del TestBed.
    return {
      vista: crearVista(fixture),
      store,
      mapa: fixture.debugElement.injector.get(MapaFacade) as MapaFalso,
      fixture,
    };
  }

  /* ----------------------------------------------------------------
     CABECERA E INSTANCIACION
     ---------------------------------------------------------------- */
  describe('cabecera estandar', () => {
    it('expone el numero de seccion inyectado por el orquestador', async () => {
      const { vista } = await montar();
      expect(vista.texto()).toContain('Sección 2.5');
    });

    it('hereda el titulo del arbol de secciones', async () => {
      const { vista } = await montar();
      expect(vista.textoDe('.titulo')).toBe('Delimitación del Área Efectiva');
    });

    it('libera el mapa al destruirse la ficha', async () => {
      const { fixture, mapa } = await montar();
      const antes = mapa.destruidas;
      fixture.destroy();
      expect(mapa.destruidas).toBe(antes + 1);
    });
  });

  /* ----------------------------------------------------------------
     EL VISOR VIVE DENTRO DEL PANEL

     Es el cambio de estructura que motiva esta suite: el mapa ya no es un bloque
     mas de la seccion, sino parte del panel de delimitacion.
     ---------------------------------------------------------------- */
  describe('el visor pertenece al panel', () => {
    it('no monta el mapa mientras el panel esta cerrado', async () => {
      const { mapa } = await montar();
      expect(mapa.montadas).toBe(0);
      expect(mapa.montadoEn).toBeNull();
    });

    it('no muestra ni lienzo ni grilla con el panel cerrado', async () => {
      const { vista } = await montar();
      expect(vista.nodo('.lienzo-mapa')).toBeNull();
      expect(vista.vertices()).toEqual([]);
    });

    it('monta el visor en cuanto se abre el modal', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar Norte');

      expect(mapa.montadoEn).toBe(vista.nodo('.lienzo-mapa'));
      expect(mapa.montadas).toBe(1);
    });

    it('libera el mapa al cerrar el panel', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar Norte');
      vista.cerrarPanel();

      expect(mapa.destruidas).toBe(1);
      expect(mapa.montadoEn).toBeNull();
    });

    it('no vuelve a montar el mapa por cada vertice tecleado', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar Norte');
      vista.escribirPoligono();

      expect(mapa.montadas).toBe(1);
    });
  });

  /* ----------------------------------------------------------------
     INVENTARIO POR CATEGORIAS
     ---------------------------------------------------------------- */
  describe('inventario de areas', () => {
    it('arranca con las dos categorias vacias', async () => {
      const { vista } = await montar();
      expect(vista.texto('actividad')).toContain('No hay áreas registradas en actividad minera.');
      expect(vista.texto('uso')).toContain('No hay áreas registradas en uso minero.');
    });

    it('registra un area nueva en la categoria elegida', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar Norte');
      vista.escribirPoligono();
      vista.grabarArea();

      expect(vista.texto('actividad')).toContain('Tajamar Norte');
      expect(vista.texto('uso')).toContain('No hay áreas registradas');
    });

    it('separa las categorias sin mezclarlas', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Cantera Sur');
      vista.escribirPoligono();
      vista.grabarArea();
      vista.crearArea('USO', 'Planta de Beneficio', 'Molienda');
      vista.escribirPoligono();
      vista.grabarArea();

      expect(vista.texto('actividad')).toContain('Cantera Sur');
      expect(vista.texto('uso')).toContain('Planta de Beneficio');
      expect(vista.texto('actividad')).not.toContain('Planta de Beneficio');
    });

    it('elimina el area indicada', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Area temporal');
      vista.escribirPoligono();
      vista.grabarArea();
      vista.pulsa('Eliminar', 'actividad');

      expect(vista.texto('actividad')).toContain('No hay áreas registradas en actividad minera.');
    });

    it('conserva la geometria al editar el rotulo de un area', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.grabarArea();

      vista.pulsa('Editar', 'actividad');
      // La geometría viaja con el área: al reabrirla el triángulo está cargado.
      expect(vista.filasVertices()).toBe(3);
      expect(vista.bloqueado('Grabar área validada')).toBe(false);

      vista.escribeEn('#area-descripcion', 'Tajamar Sur');
      vista.grabarArea();

      expect(vista.texto('actividad')).toContain('Tajamar Sur');
      expect(vista.filasInventario('ACTIVIDAD')).toBe(1);
    });

    it('no crea un segundo area si se vuelve a guardar la misma', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.grabarArea();
      expect(vista.filasInventario('ACTIVIDAD')).toBe(1);

      vista.pulsa('Editar', 'actividad');
      vista.escribeEn('#area-actividad', 'Explotacion a cielo abierto');
      vista.grabarArea();

      expect(vista.filasInventario('ACTIVIDAD')).toBe(1);
      expect(vista.texto('actividad')).toContain('Explotacion a cielo abierto');
    });
  });

  /* ----------------------------------------------------------------
     PANEL DE DELIMITACION
     ---------------------------------------------------------------- */
  describe('panel de delimitacion', () => {
    it('no esta abierto por defecto', async () => {
      const { vista } = await montar();
      expect(vista.panelAbierto()).toBe(false);
    });

    it('abre el modal con los datos en blanco y el visor a la vista para un alta', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');

      expect(vista.panelAbierto()).toBe(true);
      expect(vista.control<HTMLInputElement>('#area-descripcion').value).toBe('');
      expect(vista.nodo('.lienzo-mapa')).not.toBeNull();
    });

    it('anuncia la categoria a la que pertenece el alta', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'uso');
      expect(vista.textoDe('.modalo-cabecera .etiqueta')).toBe('Uso minero');
    });

    it('titula distinto el alta y la edicion', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      expect(vista.textoDe('.modalo-cabecera .titulo')).toBe('Nueva área superficial');

      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.grabarArea();
      vista.pulsa('Editar', 'actividad');
      expect(vista.textoDe('.modalo-cabecera .titulo')).toBe('Editar área superficial');
    });

    it('carga los valores vigentes al editar', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar', 'Explotacion minera');
      vista.escribirPoligono();
      vista.grabarArea();
      vista.pulsa('Editar', 'actividad');

      expect(vista.control<HTMLInputElement>('#area-descripcion').value).toBe('Tajamar');
      expect(vista.control<HTMLInputElement>('#area-actividad').value).toBe('Explotacion minera');
    });

    it('bloquea el guardado mientras falten datos o geometria', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      expect(vista.bloqueado('Grabar área validada')).toBe(true);

      vista.escribeEn('#area-descripcion', 'Tajamar');
      expect(vista.bloqueado('Grabar área validada')).toBe(true);

      vista.escribeEn('#area-actividad', 'Explotacion');
      // Con los campos llenos aún falta el polígono: no se graba hasta tres vértices.
      expect(vista.bloqueado('Grabar área validada')).toBe(true);

      vista.escribirPoligono();
      expect(vista.bloqueado('Grabar área validada')).toBe(false);
    });

    it('presenta el datum fijo y bloqueado', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      expect(vista.control<HTMLInputElement>('#area-datum').value).toBe('WGS84');
      expect(vista.control<HTMLInputElement>('#area-datum').disabled).toBe(true);
    });

    it('ofrece las tres zonas UTM del pais', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      const opciones = vista.raiz.querySelectorAll('#area-zona option');
      expect([...opciones].map((opcion) => (opcion as HTMLOptionElement).value)).toEqual([
        '17S',
        '18S',
        '19S',
      ]);
    });

    it('cierra sin guardar al cancelar', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      vista.escribeEn('#area-descripcion', 'Descartada');
      vista.pulsa('Cancelar');

      expect(vista.panelAbierto()).toBe(false);
      expect(vista.texto('actividad')).not.toContain('Descartada');
    });

    it('cierra al pulsar el velo de fondo', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      vista.nodo('.velo')?.click();
      vista.repinta();
      expect(vista.panelAbierto()).toBe(false);
    });

    it('no cierra al pulsar dentro del panel', async () => {
      const { vista } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      vista.nodo('.modalo-cuerpo')?.click();
      expect(vista.panelAbierto()).toBe(true);
    });

    it('permite abandonar el trazado sin grabarlo', async () => {
      const { vista, store } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.cerrarPanel();

      expect(vista.panelAbierto()).toBe(false);
      expect(store.areaEfectivaRegistrada().length).toBe(0);
    });
  });

  /* ----------------------------------------------------------------
     VERTICES Y GEOMETRIA
     ---------------------------------------------------------------- */
  describe('edicion del poligono', () => {
    it('ofrece tres filas en blanco al llegar al trazado', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');

      expect(vista.filasVertices()).toBe(3);
      expect(vista.vertices().every((control) => control.value === '')).toBe(true);
    });

    it('arranca sin poligono valido porque las filas estan vacias', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');

      expect(vista.bloqueado('Grabar área validada')).toBe(true);
      expect(vista.textoDe('.leyenda-visor')).toContain('Mínimo 3 vértices requeridos');
    });

    it('agrega filas en blanco para su llenado manual', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.pulsa('Agregar vértice', 'panel');

      expect(vista.filasVertices()).toBe(4);
    });

    it('elimina la fila indicada sin tocar el inventario', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Eliminar', 'panel');

      expect(vista.filasVertices()).toBe(2);
      // El borrador aún no se ha grabado: el inventario sigue tal cual.
      expect(vista.texto('actividad')).toContain('No hay áreas registradas en actividad minera.');
    });

    it('permite vaciar la grilla del todo', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      for (let intento = 0; intento < 3; intento += 1) {
        vista.pulsa('Eliminar', 'panel');
      }

      expect(vista.filasVertices()).toBe(0);
      expect(vista.texto('panel')).toContain('Sin vértices');
    });

    it('rechaza una geometria de dos vertices porque no encierra area', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      const controles = vista.vertices();
      vista.escribe(controles[0] as HTMLInputElement, '431250');
      vista.escribe(controles[1] as HTMLInputElement, '8674100');
      vista.escribe(controles[2] as HTMLInputElement, '436800');
      vista.escribe(controles[3] as HTMLInputElement, '8674100');

      expect(vista.bloqueado('Grabar área validada')).toBe(true);
      expect(vista.textoDe('.leyenda-visor')).toContain('no encierra área');
    });

    it('acepta el poligono en cuanto alcanza tres vertices', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();

      expect(vista.bloqueado('Grabar área validada')).toBe(false);
      expect(vista.textoDe('.leyenda-visor')).toContain('Polígono en pantalla');
    });

    it('descarta un valor no numerico en lugar de propagarlo', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      const controles = vista.vertices();
      vista.escribe(controles[0] as HTMLInputElement, 'no-es-un-numero');

      expect(controles[0]!.value).toBe('');
      expect(vista.bloqueado('Grabar área validada')).toBe(true);
    });

    it('mantiene separados Este y Norte dentro de cada vertice', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      const controles = vista.vertices();

      expect(controles[0]!.value).toBe('431250');
      expect(controles[1]!.value).toBe('8674100');
    });

    it('conserva el resto del area tras una entrada invalida', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      const controles = vista.vertices();
      vista.escribe(controles[0] as HTMLInputElement, '');

      expect(controles[1]!.value).toBe('8674100');
      expect(vista.bloqueado('Grabar área validada')).toBe(true);
    });

    it('repone tres filas en blanco al limpiar el visor', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Limpiar vértices', 'panel');

      expect(vista.filasVertices()).toBe(3);
      expect(vista.vertices().every((control) => control.value === '')).toBe(true);
      expect(vista.bloqueado('Grabar área validada')).toBe(true);
    });

    it('borra el poligono del mapa en vez de dejarlo congelado', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Limpiar vértices', 'panel');

      expect(mapa.ultimo?.vertices.length).toBe(0);
    });

    it('retira el poligono del mapa en cuanto pierde el tercer vertice', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.escribe(vista.vertices()[0] as HTMLInputElement, '');

      expect(mapa.ultimo?.vertices.length).toBe(2);
    });

    it('entrega al mapa solo los vertices completos, en su zona', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();

      expect(mapa.ultimo?.vertices.length).toBe(3);
      expect(mapa.ultimo?.zona).toBe('18S');
    });

    it('dibuja en la zona UTM que se eligio para el area', async () => {
      const { vista, mapa } = await montar();
      vista.pulsa('Nueva área', 'actividad');
      vista.escribeEn('#area-zona', '19S');
      vista.escribeEn('#area-descripcion', 'Tajamar');
      vista.escribeEn('#area-actividad', 'Explotacion');
      vista.escribirPoligono();

      expect(mapa.ultimo?.zona).toBe('19S');
    });
  });

  /* ----------------------------------------------------------------
     IMPORTACION DE CSV
     ---------------------------------------------------------------- */
  describe('importacion de coordenadas', () => {
    it('incorpora los pares de un CSV separado por comas', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        '431250,8674100\n436800,8674100\n436800,8679400',
      );

      expect(vista.filasVertices()).toBe(3);
      expect(vista.bloqueado('Grabar área validada')).toBe(false);
    });

    it('acepta tambien el punto y coma', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        '431250;8674100\n436800;8674100\n436800;8679400',
      );

      const controles = vista.vertices();
      expect(controles[0]!.value).toBe('431250');
      expect(controles[1]!.value).toBe('8674100');
    });

    it('descarta la linea de encabezado por el filtro numerico', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        'ESTE,NORTE\n431250,8674100\n436800,8674100',
      );

      expect(vista.filasVertices()).toBe(2);
    });

    it('avisa y no altera la geometria si el archivo no trae pares', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir('input[accept*="csv"]', 'area.csv', 'columna_uno,columna_dos');

      expect(vista.textoDe('.aviso')).not.toBe('');
      expect(vista.filasVertices()).toBe(3);
      expect(vista.vertices().every((control) => control.value === '')).toBe(true);
    });

    /*
       El identificador de la primera columna es un numero de vertice, no una
       coordenada. Estas pruebas fijan que la fila de tres columnas entre por
       del Este y del Norte correctos y que ese numero se descarte.
    */
    it('salta la columna identificadora y lee Este y Norte de la fila', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        'vertice,este,norte\n1,431250,8674100\n2,436800,8674100\n3,436800,8679400',
      );

      const controles = vista.vertices();
      expect(vista.filasVertices()).toBe(3);
      expect(controles[0]!.value).toBe('431250');
      expect(controles[1]!.value).toBe('8674100');
      expect(controles[2]!.value).toBe('436800');
      expect(controles[3]!.value).toBe('8674100');
    });

    it('descarta el identificador aunque venga como texto no numerico', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        'id,este,norte\nV1,431250,8674100\nV2,436800,8674100\nV3,436800,8679400',
      );

      const controles = vista.vertices();
      expect(vista.filasVertices()).toBe(3);
      expect(controles[0]!.value).toBe('431250');
      expect(controles[1]!.value).toBe('8674100');
    });

    it('admite la cabecera de tres columnas sin perder ningun vertice', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        'vertice,este,norte\n1,431250,8674100\n2,436800,8674100\n3,436800,8679400',
      );

      expect(vista.filasVertices()).toBe(3);
      expect(vista.textoDe('.aviso')).toContain('3 vértices');
    });

    it('no pierde el primer vertice de un CSV que no trae cabecera', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        '431250,8674100\n436800,8674100\n436800,8679400',
      );

      expect(vista.filasVertices()).toBe(3);
      expect(vista.vertices()[0]!.value).toBe('431250');
    });

    it('tolera espacios alrededor de los separadores', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        ' 431250 , 8674100 \n 436800 , 8674100 \n 436800 , 8679400 ',
      );

      expect(vista.filasVertices()).toBe(3);
      expect(vista.vertices()[0]!.value).toBe('431250');
    });

    it('rechaza una celda que solo empieza por un numero', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        '431250abc,8674100\n436800,8674100\n436800,8679400',
      );

      // La fila corrupta se descarta y las dos sanas se importan igual.
      expect(vista.filasVertices()).toBe(2);
      expect(vista.textoDe('.aviso')).toContain('2 vértices');
    });

    it('ignora las lineas en blanco intermedias', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subir(
        'input[accept*="csv"]',
        'area.csv',
        '431250,8674100\n\n436800,8674100\n   \n436800,8679400\n',
      );

      expect(vista.filasVertices()).toBe(3);
    });
  });

  /* ----------------------------------------------------------------
     IMPORTACION DE SHAPEFILE
     ---------------------------------------------------------------- */
  describe('importacion de shapefile', () => {
    it('incorpora el anillo exterior leido del binario', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile('area.shp', construirShp());

      expect(vista.filasVertices()).toBe(4);
      expect(vista.bloqueado('Grabar área validada')).toBe(false);
      expect(vista.textoDe('.aviso')).toContain('4 vértices');
    });

    it('desempaqueta un zip antes de leer el shapefile', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile('area.zip', construirZip('area.shp', construirShp()));

      expect(vista.filasVertices()).toBe(4);
    });

    it('avisa en vez de fallar en silencio cuando el archivo no sirve', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile('basura.shp', new ArrayBuffer(200));

      expect(vista.textoDe('.aviso')).toContain('no es un shapefile');
      expect(vista.filasVertices()).toBe(3);
    });

    it('avisa cuando el zip no trae ningun shapefile', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile(
        'area.zip',
        construirZip('notas.txt', new TextEncoder().encode('hola').buffer as ArrayBuffer),
      );

      expect(vista.textoDe('.aviso')).toContain('no contiene un shapefile');
    });

    it('rechaza un archivo que no es shapefile ni zip antes de leerlo', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile(
        'area.txt',
        new TextEncoder().encode('hola').buffer as ArrayBuffer,
      );

      expect(vista.textoDe('.aviso')).toContain('.shp');
      expect(vista.filasVertices()).toBe(3);
    });

    it('toma los vertices tal cual y avisa si el .prj no es la zona del area', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile(
        'area.zip',
        construirZipMultiple([
          { nombre: 'area.shp', contenido: construirShp(GRADOS) },
          {
            nombre: 'area.prj',
            contenido: new TextEncoder().encode('GEOGCS["GCS_WGS_1984",AUTHORITY["EPSG","4326"]]')
              .buffer as ArrayBuffer,
          },
        ]),
      );

      /*
       * Los shapefiles se leen en la zona que declaro el titular: no se
       * reproyectan. Como llegan de varias fuentes, un .prj en grados tiene que
       * quedar avisado, porque si no los grados entran al expediente como si
       * fueran metros y nadie se entera hasta que la geometria sale corrupta.
       */
      expect(vista.control<HTMLInputElement>('.celda-coordenada').value).toBe('-73.752');
      expect(vista.textoDe('.aviso')).toContain('EPSG:4326');
      expect(vista.textoDe('.aviso')).toContain('revisarlos');
    });

    it('no avisa nada cuando el .prj declara la zona del area', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      await vista.subirShapefile(
        'area.zip',
        construirZipMultiple([
          { nombre: 'area.shp', contenido: construirShp() },
          {
            nombre: 'area.prj',
            contenido: new TextEncoder().encode(
              'PROJCS["WGS 84 / UTM zone 18S",AUTHORITY["EPSG","32718"]]',
            ).buffer as ArrayBuffer,
          },
        ]),
      );

      expect(vista.control<HTMLInputElement>('.celda-coordenada').value).toBe('431250');
      expect(vista.textoDe('.aviso')).not.toContain('Ojo');
    });
  });

  /* ----------------------------------------------------------------
     ENCUADRE DEL VISOR Y CONTROL DE CAPAS
     ---------------------------------------------------------------- */
  describe('visor: encuadre y capas', () => {
    it('encuadra la vista cada vez que cambia la geometria', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();

      expect(mapa.ultimoEncuadrado?.encuadro).toBe(true);
      expect(mapa.ultimoEncuadrado?.vertices).toHaveLength(3);

      // Mover un vertice vuelve a dibujar, y el encuadre tiene que seguir pidiendose
      // porque el poligono ya no esta donde estaba.
      vista.escribe(vista.vertices()[0] as HTMLInputElement, '432000');
      expect(mapa.ultimoEncuadrado?.encuadro).toBe(true);
    });

    it('no encuadra cuando no hay area que encuadrar', async () => {
      const { mapa } = await montar();

      expect(mapa.ultimoEncuadrado).toBeUndefined();
    });

    it('ofrece el satelital y el callejero como mapas base', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');

      expect(vista.textoDe('.selector-capas')).toContain('Satelital');
      expect(vista.textoDe('.selector-capas')).toContain('Callejero');
    });

    it('cambia de mapa base al marcar la otra opcion', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribeEn('.selector-capas input[value="osm"]', '');

      expect(mapa.basesCambiadas).toEqual(['osm']);
    });

    it('apaga la capa del poligono sin perder los vertices', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      const casilla = vista.nodo('.selector-capas input[type="checkbox"]') as HTMLInputElement;
      casilla.checked = false;
      casilla.dispatchEvent(new Event('change'));
      vista.repinta();

      expect(mapa.poligonoVisibles).toEqual([false]);
      expect(vista.filasVertices()).toBe(3);
    });
  });

  /* ----------------------------------------------------------------
     PERSISTENCIA DE LA GEOMETRIA EN WKT

     El campo `geometry` es lo que viaja a la base de datos, mientras que los
     vertices siguen siendo la moneda interna del store y del cruce catastral.
     ---------------------------------------------------------------- */
  describe('geometria en WKT', () => {
    /** WKT que produce el panel para el triangulo de control. */
    async function wktDelPanel(): Promise<string> {
      const { vista, fixture } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      return fixture.componentInstance.calcularWktGeometria();
    }

    it('serializa el poligono en OGC WKT con el anillo cerrado', async () => {
      expect(await wktDelPanel()).toBe(
        'POLYGON ((431250 8674100, 436800 8674100, 436800 8679400, 431250 8674100))',
      );
    });

    it('repite el primer punto al final porque OGC exige el anillo cerrado', async () => {
      const wkt = await wktDelPanel();
      const puntos = wkt.replace(/^POLYGON \(\((.*)\)\)$/, '$1').split(', ');

      expect(puntos).toHaveLength(4);
      expect(puntos[0]).toBe(puntos[3]);
    });

    it('no arrastra decimales de relleno en los ejes enteros', async () => {
      const wkt = await wktDelPanel();

      expect(wkt).not.toContain('.000');
    });

    it('devuelve cadena vacia mientras no haya poligono cerrado', async () => {
      const { vista, fixture } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');

      expect(fixture.componentInstance.calcularWktGeometria()).toBe('');
    });

    it('excluye del WKT las filas a medio rellenar', async () => {
      const { vista, fixture } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      // Una cuarta fila con solo el Este queda incompleta y no debe entrar al anillo.
      vista.pulsa('Agregar vértice', 'panel');
      const controles = vista.vertices();
      vista.escribe(controles[6] as HTMLInputElement, '440000');

      expect(fixture.componentInstance.calcularWktGeometria()).toBe(
        'POLYGON ((431250 8674100, 436800 8674100, 436800 8679400, 431250 8674100))',
      );
    });

    it('recalcula el WKT al mover un vertice para que no quede obsoleto', async () => {
      const { vista, fixture } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.escribe(vista.vertices()[0] as HTMLInputElement, '432000');

      expect(fixture.componentInstance.calcularWktGeometria()).toContain('432000');
    });

    it('conserva el WKT al reponer tres filas al limpiar el visor', async () => {
      const { vista, fixture } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Limpiar vértices', 'panel');

      // Las tres filas de repuesto estan en blanco: no hay poligono que serializar.
      expect(fixture.componentInstance.calcularWktGeometria()).toBe('');
    });
  });

  /* ----------------------------------------------------------------
     GRABADO Y PUBLICACION AL EXPEDIENTE
     ---------------------------------------------------------------- */
  describe('grabado en el expediente', () => {
    it('no graba mientras no haya poligono cerrado', async () => {
      const { vista, store } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');

      expect(vista.bloqueado('Grabar área validada')).toBe(true);
      expect(store.areaEfectivaRegistrada().length).toBe(0);
    });

    it('publica el area efectiva para que la 2.2 y la 2.4 la hereden', async () => {
      const { vista, store } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Grabar área validada');

      expect(store.areaEfectivaRegistrada()).toEqual([
        { este: 431_250, norte: 8_674_100 },
        { este: 436_800, norte: 8_674_100 },
        { este: 436_800, norte: 8_679_400 },
      ]);
    });

    it('confirma la seccion en verde al grabar', async () => {
      const { vista, store } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Grabar área validada');

      expect(store.seccionPorNumero('2.5')?.estado).toBe('Verde');
    });

    it('cierra el panel y suelta el area al grabar', async () => {
      const { vista, mapa } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();
      vista.pulsa('Grabar área validada');

      expect(vista.panelAbierto()).toBe(false);
      expect(mapa.montadoEn).toBeNull();
    });

    it('deja el area en el inventario despues de grabar', async () => {
      const { vista } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar Norte');
      vista.escribirPoligono();
      vista.pulsa('Grabar área validada');

      expect(vista.texto('actividad')).toContain('Tajamar Norte');
    });

    it('deja el expediente intacto si el titular nunca pulsa grabar', async () => {
      const { vista, store } = await montar();
      vista.crearArea('ACTIVIDAD', 'Tajamar');
      vista.escribirPoligono();

      expect(store.areaEfectivaRegistrada().length).toBe(0);
      expect(store.seccionPorNumero('2.5')?.estado).toBe('Gris');
    });
  });
});
