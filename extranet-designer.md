# 🚀 ESPECIFICACIÓN DAEX (SEAL ECOSYSTEM) - BLOQUE 1: REPOSITORIO Y ESTADO GLOBAL

## 📌 INSTRUCCIONES PARA EL AGENTE DE PROGRAMACIÓN
   **Framework:** Angular 18+ utilizando estrictamente Componentes Standalone.
   **Manejo de Estado:** Uso exclusivo de Angular Signals (`signal`, `computed`, `effect`) para reactividad centralizada. No usar librerías de terceros (NgRx/Akita).
   **Estructura:** Sintaxis moderna del New Control Flow (`@if`, `@for`, `@switch`).
   **Estilos:** Clases utilitarias de Tailwind 4 CSS.

***

## 📁 1. ARQUITECTURA DE ARCHIVOS DEL REPOSITORIO (MVP)

Estructura el proyecto siguiendo el patrón modular por características (*Features*):

```text
/daex-seal-mvp
├── /src
│   ├── /app
│   │   ├── /components
│   │   │   └── /ui
│   │   │       ├── smart-uploader.component.ts      # Componente transversal de carga múltiple (<50MB)
│   │   │       └── openlayers-map.component.ts      # Visor cartográfico interactivo encapsulado
│   │   ├── /features
│   │   │   ├── /login
│   │   │   │   └── login.component.ts               # Módulo 1: Autenticación Transaccional
│   │   │   ├── /seleccion-iga
│   │   │   │   └── seleccion-iga.component.ts       # Módulo 2: Catálogo de Selección de IGA
│   │   │   └── /workspace
│   │   │       ├── workspace.component.ts           # Módulo 3: Tablero Central de Trabajo (Dashboard)
│   │   │       └── /secciones
│   │   │           ├── delimitacion-mapa.component.ts # Formulario Cap. 2.4 y 5.2 con Visor
│   │   │           ├── plataformas.component.ts      # Formulario Cap. 2.4.1 (Plataformas y Sondajes)
│   │   │           ├── cronograma.component.ts       # Formulario Cap. 2.5 (Gantt Dinámico/Inversión)
│   │   │           └── insumos-agua.component.ts     # Formulario Cap. 2.2-2.3 (Llenado Express)
│   │   └── /state
│   │       └── daex.store.ts                        # Store Central basado en Angular Signals
```

***

## 🧠 2. ARQUITECTURA DEL ESTADO REACTIVO GLOBAL (`daex.store.ts`)

El sistema debe operar bajo un único flujo de datos controlado por un servicio provisto en la raíz (`providedIn: 'root'`) que exponga los siguientes tipos y Signals reactivos:

   **Metadatos de Identidad:** `ruc` (string), `tokenJwt` (string) y `razonSocial` (string), capturados de forma automatizada tras el login.
   **Información Geográfica Heredada (Efecto SEAL):** Variables reactivas para almacenar el `ubigeo` político (Departamento, Provincia, Distrito) y el listado de `concesionesAsociadas` (arreglo de strings) que devuelvan los paquetes espaciales de la base de datos centralizada al procesar los polígonos.
   **Índice Estructurado del Expediente:** Arreglo reactivo (`secciones`) que aloja los capítulos de la guía DAEX. Cada ítem debe registrar: ID, Título, Estado del Semáforo (`'GRIS' | 'AZUL' | 'VERDE' | 'AMBAR' | 'ROJO'`), e Indicadores de Alerta del Evaluador (`tieneObservacion: boolean`, `observacionTexto?: string`).
   **Guardián Transaccional Computado:** Un Signal Computado (`computed`) llamado `puedeEnviarAlMinem`. Evalúa constantemente el índice y devuelve `true` **únicamente** si el 100% de las secciones del expediente registran un estado estrictamente igual a `'VERDE'`. Si un solo capítulo está en gris, azul, ámbar o rojo, devuelve `false`.

# 🚀 ESPECIFICACIÓN DAEX (SEAL ECOSYSTEM) - BLOQUE 2: ACCESO Y CATÁLOGO DE TRÁMITES

## 🔑 1. PANTALLA 1: INICIO DE SESIÓN TRANSACCIONAL (LOGIN)

### 📐 Criterios de Layout y UI
 **Estructura:** Pantalla dividida en dos bloques (`Split Screen`) en resoluciones de escritorio. El bloque izquierdo (60%) actúa como una zona de inmersión institucional con una textura sutil basada en mapas de cuadrantes mineros; el bloque derecho (40%) es un contenedor limpio exclusivo para el formulario.

### 🛡️ Reglas de Validación y Comportamiento del RUC (UX)
 **Control de Entrada Estricto:** El campo RUC debe poseer una máscara de caracteres numéricos a nivel de cliente. Bloquear e impedir físicamente que el usuario digite letras, espacios o caracteres especiales.
 **Truncado Automático:** El input debe limitar la longitud máxima a exactamente 11 caracteres.
 **Mensaje de Asistencia Dinámico:** Al perder el foco el elemento de entrada (`blur`), si la longitud de la cadena es inferior a 11 dígitos, la interfaz debe pintar el borde del input en color rojo y desplegar un texto de asistencia inmediata que indique: 
   *"⚠️ El RUC institucional debe contener exactamente 11 dígitos numéricos."*
 **Comportamiento del Botón de Ingreso:** Permanecerá deshabilitado de forma nativa si los criterios sintácticos del RUC (11 números) o de la contraseña (mínimo 6 caracteres) no están satisfechos. Al accionarse de forma válida, mutará visualmente a un estado de carga (*loading spinner*) inhabilitando las entradas para evitar colisiones de múltiples clics.

### ⛓️ Gestión de Redirección Directa
 **Efecto Token JWT:** Al autenticar con éxito contra el servidor, el sistema procesa el Token JWT. A través del estado reactivo global del cliente (*Angular Signals*), se extrae la identidad única del Titular Minero y se almacena en la sesión.
 **Salto de Bandeja (Skip Backlog):** Al ser un usuario único por titular minero, el Frontend anula la navegación a consolas históricas genéricas o registros generales. Redirige de forma automática al usuario al catálogo de selección directa para optimizar tiempos de carga.

---

## 🗂️ 2. PANTALLA 2: SELECCIÓN DECLARATIVA DE TRÁMITE (CATÁLOGO IGA)

### 📐 Estructura e Indicadores Superiores
 **Cabecera de Progreso:** Muestra el título institucional del trámite. Se eliminan de forma absoluta los menús rígidos de enlaces de texto sueltos del SEAL tradicional (como "Etapa:1 Etapa:2...").
 **Organización Categórica:** Las opciones se agrupan en tres bloques colapsables (*Accordions*) para mitigar la sobrecarga visual del usuario:
  1. *Fase de Exploración Minera* (Abierto por defecto para esta solución).
  2. *Fase de Explotación y Beneficio* (Cerrado).
  3. *Modificaciones de Estudio e Informes Técnicos Sustentatorios (ITS)* (Cerrado, establecido como contexto operativo donde, si se selecciona, se exige vincular el trámite a un expediente base aprobado para heredar sus capas geográficas).

### 🎨 Tarjetas Visuales de Selección Directa (Interactive Option Cards)
 **Diseño de la Tarjeta DAEX:** El instrumento de menor complejidad se visualiza dentro de la cuadrícula como una tarjeta independiente con tipografía de alto impacto. Debe incluir viñetas explícitas que sirvan de **ayuda normativa directa** antes de que el usuario proceda:
   *✓ Soporta un máximo estricto de hasta 10 plataformas físicas de perforación.*
   *✓ Área efectiva total a disturbar menor a 5 hectáreas.*
 **Efectos de Interacción (Tailwind 4):**
   *Al pasar el cursor (Hover):* Elevar sutilmente la tarjeta mediante sombras suaves y cambiar el borde al color azul institucional del MINEM, modificando el cursor a tipo puntero para denotar interactividad.
   *Al hacer un solo Clic:* El Frontend actualiza el estado. La tarjeta seleccionada se ilumina con un fondo azul claro sutil, un borde de alta visibilidad y despliega un marcador circular de verificación en la esquina superior. Las tarjetas colindantes se opacan ligeramente para concentrar el enfoque del usuario.

### 🛡️ Lógica del Botón de Acción Principal (CTA)
 **Habilitación Condicionada:** El botón inferior *"Iniciar Registro de Expediente"* se renderiza bloqueado, en gris claro y con la propiedad `cursor-not-allowed` activada en el cliente.
 **Activación Reactiva:** En el instante en que el administrado declara su intención seleccionando una tarjeta válida (ej. DAEX), el botón muta dinámicamente a color verde brillante y se habilita para redirigir transaccionalmente al administrado directo a la Consola de Trabajo del Expediente.

# 🚀 ESPECIFICACIÓN DAEX (SEAL ECOSYSTEM) - BLOQUE 3: CONSOLA Y MÓDULOS GEOGRÁFICOS

## 🧭 1. PANTALLA 3: CONSOLA DE TRÁMITE CENTRALIZADA (WORKSPACE DASHBOARD)

### 📐 Criterios de Layout y UI
 **Estructura de Tres Columnas (`h-screen overflow-hidden`):**
   **Cabecera Superior Fija:** Muestra el nombre del proyecto, código temporal y aloja el botón principal **"Enviar al MINEM"**. Este botón está conectado directamente al guardián transaccional (`store.puedeEnviarAlMinem`). Si es `false`, se bloquea visualmente (gris, `cursor-not-allowed`). Solo muta a verde brillante y activo cuando el 100% de las secciones marcan `'VERDE'`.
   **Menú Lateral de Navegación (30% de ancho):** Árbol indexado que aloja los capítulos del estudio.
   **Contenedor Principal de Trabajo (70% de ancho):** Renderiza el formulario o componente cartográfico de la sección activa seleccionada en el menú.

### ⚙️ Comportamiento del Menú Responsivo Colapsable (UX)
 **Control de Repliegue (Drawer `[≡]`):** 
   En escritorio, incluye un botón flotante que repliega el menú hacia la izquierda, reduciendo su ancho a cero y expandiendo el contenedor de trabajo al 100% de la pantalla (ideal para tablas densas o mapas).
   En dispositivos móviles o tablets, el menú se oculta automáticamente tras un botón de hamburguesa y emerge de forma flotante (*Off-canvas Drawer*) al ser pulsado, protegiendo los datos digitados.
 **Semáforos Dinámicos por Estado en Base de Datos:** Cada fila del menú posee un icono y código de color alimentado en tiempo real:
   ⚪ *Gris (Círculo Vacío):* Capítulo pendiente de iniciar.
   🔵 *Azul (Icono de Carga/Reloj):* Capítulo en proceso de edición (Modo Borrador).
   🟢 *Verde (Icono de Check):* Capítulo completado al 100% y validado por el sistema.
   🟡 *Ámbar (Icono de Advertencia):* Alerta o sugerencia técnica de la IA.
 **Indicador Crítico de Observaciones (Libro Abierto `📖`):** Si el estudio proviene de un estado "Observado", las secciones afectadas se pintan en **Rojo** y acoplan un icono parpadeante de un **Libro Abierto (`📖`)**. 
   *Hover:* Despliega un *Tooltip* con un extracto del pliego de observaciones del evaluador.
   *Clic:* Carga el formulario correspondiente en la columna derecha y, en la cabecera del contenido, antepone un panel destacado en rojo sutil con la observación legal/técnica completa y el campo listo para que el titular ingrese el sustento de su levantamiento de observaciones.

---

## 🗺️ 2. MÓDULO A: CAPÍTULOS CON VISOR DE MAPAS ACTIVO (VISTA PARTIDA 45/55)

Esta interfaz dual opera **exclusivamente** para el **Capítulo 2.4 (Delimitación del Área Efectiva)** y el **Capítulo 5.2 (Área de Influencia)**. Las demás secciones del trámite prescinden del mapa para optimizar el rendimiento.

### 🎨 Panel de Control (Izquierda - 45%)
 **Cabecera de Parámetros:** Selectores obligatorios para definir el Datum (fijo en WGS84), la Zona UTM (17S, 18S, 19S) y el Tipo de Capa (Área Efectiva, Actividad Minera, AIAD, AIAI, AISD, AISI).
 **Mecanismo de Ingesta Dual:**
   *Pestaña Carga Masiva:* Caja de arrastre (*Dropzone*) para importar archivos Shapefile comprimidos (`.zip`) o CSV. Al procesar, la tabla manual de abajo se autocompleta sola.
   *Pestaña Registro Manual:* Tabla interactiva que inicia con **exactamente 10 filas numéricas en blanco** para digitar pares de coordenadas `Este (X)` y `Norte (Y)`. Incluye botones para añadir filas sobre la marcha o eliminarlas con un icono de tacho de basura en color rojo, recalculando la numeración automáticamente en el cliente.

### 🗺️ Visor OpenLayers (Derecha - 55%)
 Ocupa todo el alto de la pantalla disponible. Se suscribe reactivamente a los cambios del panel izquierdo. 
 *Si el usuario digita:* Al completar un par válido de Este/Norte en la grilla, **aparece instantáneamente un pin visual en el mapa de OpenLayers**.
 *Si se carga un archivo:* El mapa ejecuta un auto-enfoque fluido (*Fly-to / Zoom pan*) hacia la ubicación del proyecto.
 *Cierre de Polígonos:* Une automáticamente con una línea continua el último punto registrado con el primero, aplicando un relleno con opacidad sutil.
 *Herramientas:* Conmutador flotante para alternar entre **Vista Satelital** (para verificar coberturas vegetales reales o desbroces) y **Vista Topográfica**.
 **El "Efecto SEAL" en el Frente:** Al presionar "Guardar Polígono", el sistema simula la ejecución satisfactoria del paquete espacial del backend. La interfaz se actualiza e **inyecta automáticamente en el store los valores del Ubigeo Político y las Concesiones Mineras asociadas del titular**, bloqueando dichos campos para solo-lectura en los formularios siguientes.

# 🚀 ESPECIFICACIÓN DAEX (SEAL ECOSYSTEM) - BLOQUE 4: REGLAS TÉCNICAS Y GESTOR DE CARGA

## 🛡️ 1. MÓDULO B: MÓDULOS DE VALIDACIÓN POR REGLAS DE NEGOCIO (SIN MAPA)

Para las secciones que no requieren mapa, el formulario ocupa el 100% del ancho de la pantalla, pero ejecuta un Motor de Validaciones Geométricas Invisibles en el cliente basado en los polígonos del Área Efectiva previamente guardados.

### Formulario Jerárquico de Plataformas y Sondajes (Sección 2.4.1)
 **Relación Estructural de 1 a Varios:** Una plataforma física comparte una única coordenada Este/Norte y Altitud, pero puede albergar múltiples perforaciones o sondajes (cada uno con su propia profundidad, inclinación y azimut).
 **Importación Masiva Simplificada:** Botón para cargar un archivo Excel o CSV desnormalizado (donde varias filas comparten los datos de una misma plataforma debido a sus múltiples sondajes). El Frontend agrupa automáticamente estos registros en el cliente.
 **Visualización en Tarjetas Anidadas:** Las plataformas importadas se muestran como tarjetas colapsables. El encabezado exhibe la coordenada y un *Badge* con el conteo de perforaciones (ej. `3 Sondajes`). Al expandir la tarjeta, revela una sub-tabla con el detalle de sus sondajes, permitiendo añadir o remover filas manualmente.
 **Controles Críticos del Cliente:**
  1. *Validación Cuantitativa:* Si el archivo contiene más de 10 coordenadas de plataformas físicas únicas, el sistema rechaza la importación alertando: *"La normativa DAEX permite un máximo de 10 plataformas de exploración"*.
  2. *Validación de Contención Estricta:* El sistema verifica de forma matemática que las coordenadas de las plataformas se encuentren **100% contenidas dentro del perímetro del Área Efectiva** del Capítulo 2.4. Si alguna excede el límite, la sección se bloquea, cambia a semáforo **Rojo** y dispara el aviso: *"La Plataforma [Nombre] excede los límites permitidos del Área Efectiva"*.

### Cronograma e Inversión del Proyecto (Sección 2.5)
 **Configuración Rápida:** Entrada de **Fecha de Inicio Proyectada** (con bloqueo nativo de fechas pasadas) y un control de alternancia (*Toggle Switch*) para elegir la escala temporal: **[ Meses ]** o **[ Años ]**.
 **Diagrama de Gantt Interactivo:** Al ingresar la duración, la grilla del cronograma se redibuja en el acto mostrando columnas con **meses calendario reales** (ej. *Abril 2027, Mayo 2027...*) o **años reales** (ej. *Año 2027, Año 2028...*), calculados desde la fecha de inicio.
   *Llenado Express:* El usuario pinta los horizontes temporales de las 4 etapas obligatorias (*Construcción, Operación, Cierre, Post-Cierre*) simplemente haciendo clic y arrastrando el cursor sobre los bloques de la cuadrícula. El sistema controla de forma lógica que no existan traslapes imposibles (ej. operar antes de construir).
 **Matriz de Inversión Vinculada:** Compuesta por 4 tarjetas financieras (una por etapa). Heredan de forma nativa el periodo de tiempo pintado arriba. Para maximizar la velocidad, el presupuesto se captura mediante un **único campo numérico global cerrado por cada etapa**, autocalculando la inversión total del proyecto con formato monetario nacional (`S/. 0.00`) en tiempo real.

### Demanda de Agua, Insumos y Personal Express
 **Demanda de Agua:** Entrada configurada en Metros Cúbicos (m³). Restringe la fuente de abastecimiento exclusivamente a **Terceros** mediante *Radio Buttons* obligatorios (*Proveedor Autorizado Cisterna, Tercero con Derecho de Agua, EPS*), alineado con la guía DAEX.
 **Insumos, Maquinarias y Equipos (Catálogo Predictivo):** Al añadir una fila, los campos de texto implementan un autocompletado inteligente basado en un **Diccionario Técnico Minero**. Si el usuario digita *"Per"*, el sistema sugiere automáticamente `Perforadora Diamantina LF-70` y **autocompleta las especificaciones técnicas estándar**, obligando a usar unidades de medida homogéneas (ej. *Sacos de 25kg, Baldes, ud.*) para mantener la limpieza de los datos.
 **Personal (Sincronización Transversal):** El formulario detecta qué etapas fueron activadas en el Cronograma y **renderiza exclusivamente los campos numéricos de las etapas activas**, ocultando las secciones vacías para limpiar la interfaz del administrado.

---

## 📁 2. COMPONENTE REUTILIZABLE CORE: SMART UPLOADER

Este componente transversal empaqueta toda la lógica de carga de evidencias, planos, firmas, mapas y anexos de la plataforma.

 **Propiedades de Entrada (`@Input`):** Configura dinámicamente qué tipos de extensiones acepta (`.pdf, .zip, .shp, .xlsx, .csv`) y si admite selección múltiple.
 **Lógica de Control Estricto de Peso Máximo (50 MB):**
   Al arrastrar o seleccionar archivos, el componente calcula de inmediato el tamaño en bytes de cada elemento.
   **El peso máximo permitido por archivo individual o en cola acumulada es de exactamente 50 MB.**
   *Acción ante Excesos:* Si un archivo supera los 50 MB, el componente aborta la carga, resalta el contorno del contenedor en rojo vibrante y lanza una alerta flotante explícita con alto contraste: 
    * `"El archivo [Nombre] excede el límite máximo de 50 MB permitido por el sistema SEAL. Por favor, optimice o divida el documento antes de cargarlo para garantizar una transmisión ligera y rápida."`
 **Fila de Archivos y Flujo Liviano:** Los documentos aceptados se listan debajo de la zona de arrastre con su nombre, un indicador de su peso (ej. `12.4 MB`) y un **Botón de Eliminación Rápida (`✕`)** para que el usuario depure la lista de forma autónoma antes de consolidar el formulario. La carga hacia el servidor corre de forma asíncrona en un segundo plano para no congelar la pantalla.

 # 🚀 ESPECIFICACIÓN DAEX (SEAL ECOSYSTEM) - LÍNEA BASE: BLOQUE 1 (MEDIO FÍSICO Y BIÓTICO)

## 📌 INSTRUCCIONES PARA EL AGENTE DE PROGRAMACIÓN
   **Contexto Sectorial:** El administrado describe el entorno ambiental natural donde se ejecutará la exploración minera. La guía permite el uso de información cualitativa y secundaria oficial.
   **Enfoque de UX:** Evitar cajas de texto libres e infinitas. Estructurar la información mediante formularios guiados y selectores con ayudas dinámicas.

***

## ⛰️ 1. DESCRIPCIÓN DEL MEDIO FÍSICO Y BIOLÓGICO (FORMULARIO GUIADO)

Para agilizar el llenado, la descripción del entorno se fragmenta en tarjetas de expansión temática, forzando un orden lógico:

### A. Componente Clima y Meteorología
 **Campos de Entrada:** Un selector desplegable (*Dropdown*) para indicar el tipo de clima según la clasificación oficial (ej. *Frígido, Boreal, Seco, Lluvioso*). Cajas numéricas para registrar la Precipitación Promedio Anual (mm) y la Temperatura Media (°C).
 **Mensaje de Asistencia Contextual (Tooltip):** Al costado del campo se incluye un icono `[?]`. Al pasar el cursor, despliega: *"Ayuda: Puede extraer estos valores históricos de la estación del SENAMHI más cercana al polígono del proyecto."*

### B. Componente Hidrografía y Cuerpos de Agua
 **Sincronización Inteligente:** La interfaz extrae de forma automática los nombres de los ríos o quebradas que el administrado digitó previamente en el cuadro de plataformas (Capítulo 2.4.1). 
 **Lógica de la Interfaz:** Genera automáticamente una pequeña lista de lectura con esos cuerpos de agua y le solicita al usuario describir brevemente la subcuenca a la que pertenecen mediante un área de texto limitada a 300 caracteres.

### C. Componente Flora, Fauna y Cobertura Vegetal
 **Campos de Entrada:** Cuestionario de selección múltiple (*Checkboxes*) estilizado con Tailwind 4 para marcar los tipos de cobertura vegetal detectados en el área efectiva: `[ ] Pajonal de Puna`, `[ ] Matorral Andaluz`, `[ ] Césped de Puna`, `[ ] Terreno Eriazo / Sin Vegetación`.
 **Lógica Condicional (UX Alerta):** Si el usuario selecciona opciones asociadas a ecosistemas sensibles (como "Bofedales" o "Bosques relictos"), el Frontend cambia inmediatamente el semáforo de esta sección a **ÁMBAR (🟡)** y despliega un banner preventivo: *"Aviso: Ha seleccionado un tipo de cobertura vegetal sensible. Asegúrese de que sus estrategias de manejo ambiental (Capítulo V) detallen medidas de mitigación estrictas para no alterar este entorno."*

---

## 📁 2. COMPONENTE DE ADJUNTOS: MAPAS TEMÁTICOS OBLIGATORIOS

La guía exige adjuntar los mapas temáticos en base topográfica WGS84 que muestren el área efectiva, el AIAD, los cuerpos de agua, ecosistemas frágiles y cobertura vegetal.

### ⚙️ Integración con el Smart Uploader Universal
 En esta sección se instancia el componente reutilizable `<app-smart-uploader>`.
 Se configura para aceptar estrictamente archivos en formato **PDF de alta resolución o carpetas comprimidas de planos (.zip)**.
 **Control de Peso y Multi-archivo:** Aplica la regla estricta analizada anteriormente: permite cargar varios mapas en simultáneo (Mapa Geológico, Mapa Hidrológico, Mapa de Cobertura Vegetal), pero restringe el peso de cada archivo a un **máximo absoluto de 50 MB**, bloqueando la carga y lanzando la alerta de optimización si se excede el límite.

# 🚀 ESPECIFICACIÓN DAEX (SEAL ECOSYSTEM) - BLOQUE 5: ARQUEOLOGÍA, PARTICIPACIÓN Y ANEXOS

## 🏛️ 1. SECCIÓN 3.3: ARQUEOLOGÍA Y PATRIMONIO CULTURAL

### ⚙️ Lógica Condicional de Interfaz (UX)
Para evitar errores de digitación o la omisión de requisitos legales que causen el rechazo del expediente, el Frontend guiará al usuario mediante una bifurcación obligatoria:
 **Pregunta Inicial (Botonera de Radio):** *¿El proyecto cuenta con un Certificado de Inexistencia de Restos Arqueológicos (CIRA) aprobado por el Ministerio de Cultura?*
   **Si el usuario selecciona [SÍ]:** Se despliega dinámicamente un campo de texto estructurado con máscara para registrar el `Número de Resolución de CIRA` y se activa el componente `<app-smart-uploader>` para adjuntar el PDF original de la resolución.
   **Si el usuario selecciona [NO]:** El formulario muta y le exige de forma obligatoria ingresar el `Número de Expediente de Trámite del Plan de Monitoreo Arqueológico (PMA)` y cargar el documento de cargo o resolución que demuestre que el plan está en proceso o aprobado.
 **Mensaje de Asistencia:** Si ambos campos se dejan vacíos, el sistema bloquea el paso de esta sección a semáforo conforme, mostrando un banner de advertencia: *"Aviso: Para obtener la autorización de inicio de actividades, es obligatorio declarar el sustento del CIRA o del PMA según la normativa sectorial vigente."*

---

## 💬 2. CAPÍTULO IV: PLAN DE PARTICIPACIÓN CIUDADANA

### 🎨 Llenado Express y Estructuración de Datos (UI)
En lugar de una caja de texto libre donde la consultora redacte un texto genérico, la interfaz estructurará el registro mediante una **Grilla Dinámica de Mecanismos ejecutados**:
1. **Tipo de Mecanismo (Dropdown):** Opciones cerradas (`Taller Participativo Presencial`, `Taller Virtual`, `Buzón de Sugerencias`, `Distribución de Material Informativo`).
2. **Fecha de Ejecución:** Selector de calendario (`input type="date"`). El Frontend validará en caliente que la fecha seleccionada sea estrictamente pasada (anterior a la fecha de creación del expediente).
3. **Número de Asistentes:** Entrada puramente numérica.

### 🛡️ Evidencias Vinculadas (Smart Uploader)
 Por cada fila o mecanismo registrado en la grilla, se acopla de forma obligatoria una instancia del componente `<app-smart-uploader>`.
 El usuario debe cargar los medios de verificación correspondientes: actas de asamblea, listas de asistencia escaneadas con firmas, o paneles fotográficos.
 Se aplica la regla estricta: multi-archivo permitido, pero con un **límite de peso máximo de exactamente 50 MB por archivo**.

---

## ✍️ 3. CAPÍTULO VI: DATOS DE LA CONSULTORA Y FIRMAS DE PROFESIONALES

### ⚙️ Control de Consistencia Declarativa (UX)
La guía estipula que todos los mapas, planos y diagramas de la DAEX deben estar suscritos por un Ingeniero Colegiado y Habilitado. Para facilitarle la validación al evaluador humano, el Frontend operará así:
 **Registro de Especialistas:** Una tabla dinámica donde se ingresa: `Nombre Completo`, `Especialidad / Profesión` (Dropdown: *Ingeniero de Minas, Ingeniero Geólogo, Arqueólogo, Sociólogo, Biólogo*), `Colegio Profesional` y `Número de Colegiatura`.
 **Sincronización Transversal (Signals):** Cuando el usuario se encuentre en los módulos geográficos (Capítulos 2.4 y 5.2) cargando los Shapefiles o planos, la interfaz desplegará un menú desplegable dinámico que dirá: *"Seleccione el Profesional Responsable de la Firma de este Plano"*. Las opciones de ese menú se alimentarán automáticamente de los nombres registrados en esta tabla, asegurando la trazabilidad del estudio.

---

## 📁 4. CAPÍTULO VII: SECCIÓN COMPLETA DE ANEXOS FINALES

Esta sección consolida todos los entregables complementarios y de cierre requeridos para que el botón "Enviar al MINEM" se active.

### 🎨 Layout de la Pantalla de Anexos
Organiza el contenedor principal en un catálogo de tarjetas de carga individuales por tipo de documento obligatorio. Cada tarjeta integra visualmente el componente `<app-smart-uploader>`:

 **Tarjeta A: Archivos Shapefile y KMZ Georreferenciados**
   *Filtro de Extensión:* Acepta estrictamente formatos `.zip` que contengan las capas del Área Efectiva, AIAD, AISD y los puntos de monitoreo ambiental.
   *Mensaje de Ayuda:* *"Asegúrese de que el archivo comprimido contenga las extensiones .shp, .shx, .dbf y .prj en sistema de coordenadas UTM WGS84."*
 **Tarjeta B: Estaciones o Puntos de Monitoreo Ambiental**
   *Filtro de Extensión:* `.csv` o `.xlsx` estructurado con las matrices de ruido, agua o aire.
 **Tarjeta C: Documentos Sustentatorios de Línea Base Social y Terrenos**
   *Filtro de Extensión:* `.pdf` que acredite la propiedad del terreno superficial o el carácter eriazo del predio estatal.

### 🛡️ Regla de Control de Cierre en Anexos
 El componente monitorea que cada una de las tarjetas obligatorias registre al menos un archivo válido en su fila de documentos aceptados.
 En el momento en que se completa la carga de todos los archivos y ninguno excede de forma individual los **50 MB**, el capítulo VII muta su estado en el store central a semáforo **VERDE (🟢)**. 
 Si este era el último capítulo pendiente, el Signal computado global reacciona de inmediato, cambia el estado del botón **"Enviar al MINEM"** en la cabecera a habilitado y el trámite queda listo para ser despachado oficialmente a las bases de datos del ministerio.