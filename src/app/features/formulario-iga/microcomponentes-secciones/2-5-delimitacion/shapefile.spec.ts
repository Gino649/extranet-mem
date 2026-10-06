import { extraerShapefileDeZip, leerEpsgDeZip, leerPoligonosShapefile } from './shapefile';
import { CUADRADO, construirShp, construirZip, construirZipMultiple } from './shapefile.pruebas';

/** Cuadrilátero cerrado, tal como lo escribe un shapefile real. */
const CERRADO = [...CUADRADO, CUADRADO[0]];

describe('leerPoligonosShapefile', () => {
  it('extrae el anillo exterior con sus coordenadas en el orden del archivo', () => {
    const lectura = leerPoligonosShapefile(construirShp(CERRADO));
    expect(lectura.error).toBeNull();
    expect(lectura.anillos).toHaveLength(1);
    expect(lectura.anillos[0]).toEqual([
      { x: 431_250, y: 8_674_100 },
      { x: 436_800, y: 8_674_100 },
      { x: 436_800, y: 8_679_400 },
      { x: 431_250, y: 8_679_400 },
      { x: 431_250, y: 8_674_100 },
    ]);
  });

  it('acepta tambien el tipo PolygonZ', () => {
    const lectura = leerPoligonosShapefile(construirShp(CERRADO, 15));
    expect(lectura.anillos[0]).toHaveLength(5);
  });

  it('rechaza un archivo que no es shapefile', () => {
    const lectura = leerPoligonosShapefile(new ArrayBuffer(200));
    expect(lectura.anillos).toHaveLength(0);
    expect(lectura.error).toContain('no es un shapefile');
  });

  it('rechaza un archivo truncado antes de la cabecera', () => {
    const lectura = leerPoligonosShapefile(new ArrayBuffer(40));
    expect(lectura.error).toContain('cabecera');
  });

  it('avisa cuando el shapefile no trae poligonos', () => {
    const lectura = leerPoligonosShapefile(construirShp(CERRADO, 1));
    expect(lectura.anillos).toHaveLength(0);
    expect(lectura.error).toContain('no contiene polígonos');
  });
});

describe('extraerShapefileDeZip', () => {
  it('devuelve el shapefile contenido en un zip almacenado', async () => {
    const salida = await extraerShapefileDeZip(construirZip('area.shp', construirShp(CERRADO)));
    expect(salida).not.toBeNull();

    const lectura = leerPoligonosShapefile(salida as ArrayBuffer);
    expect(lectura.anillos[0]).toHaveLength(5);
  });

  it('devuelve null si el zip no trae shapefile', async () => {
    const zip = construirZip('notas.txt', new TextEncoder().encode('hola').buffer as ArrayBuffer);
    expect(await extraerShapefileDeZip(zip)).toBeNull();
  });

  it('devuelve null si el archivo no es un zip', async () => {
    expect(await extraerShapefileDeZip(new ArrayBuffer(64))).toBeNull();
  });
});

describe('leerEpsgDeZip', () => {
  /** `.prj` de ESRI con el codigo en la forma AUTHORITY del formato. */
  const prjDe = (epsg: string): ArrayBuffer =>
    new TextEncoder().encode(
      `PROJCS["WGS 84 / UTM zone 18S",GEOGCS["WGS 84"],AUTHORITY["EPSG","${epsg}"]]`,
    ).buffer as ArrayBuffer;

  /** Zip con la capa y su `.prj`, que es como llega del catastro. */
  const zipConPrj = (epsg: string): ArrayBuffer =>
    construirZipMultiple([
      { nombre: 'area.shp', contenido: construirShp(CERRADO) },
      { nombre: 'area.prj', contenido: prjDe(epsg) },
    ]);

  it('recupera el EPSG declarado en el AUTHORITY del .prj', async () => {
    expect(await leerEpsgDeZip(zipConPrj('32718'))).toBe(32718);
  });

  it('acepta el .prj que declara el codigo sin la forma AUTHORITY', async () => {
    const zip = construirZipMultiple([
      { nombre: 'area.shp', contenido: construirShp(CERRADO) },
      {
        nombre: 'area.prj',
        contenido: new TextEncoder().encode('PROJCS["UTM 19S",EPSG:32719]').buffer as ArrayBuffer,
      },
    ]);

    expect(await leerEpsgDeZip(zip)).toBe(32719);
  });

  it('devuelve null cuando el zip no trae .prj', async () => {
    expect(await leerEpsgDeZip(construirZip('area.shp', construirShp(CERRADO)))).toBeNull();
  });

  it('devuelve null si el .prj no declara ningun codigo EPSG', async () => {
    const zip = construirZipMultiple([
      { nombre: 'area.shp', contenido: construirShp(CERRADO) },
      {
        nombre: 'area.prj',
        contenido: new TextEncoder().encode(
          'PROJCS["WGS 84 / UTM zone 18S",GEOGCS["WGS 84",DATUM["WGS_1984"]]]',
        ).buffer as ArrayBuffer,
      },
    ]);

    expect(await leerEpsgDeZip(zip)).toBeNull();
  });

  it('encuentra el .prj aunque venga antes que el .shp en el zip', async () => {
    const zip = construirZipMultiple([
      { nombre: 'area.prj', contenido: prjDe('32717') },
      { nombre: 'area.shp', contenido: construirShp(CERRADO) },
    ]);

    expect(await leerEpsgDeZip(zip)).toBe(32717);
  });
});
