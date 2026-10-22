# Registro de Difusiones — Patria Grande Quilmes

App para registrar respuestas a difusiones de actividades, reemplazando la carga manual en la planilla wide de "Organización 2026". Los datos ahora viven en formato *long* en la hoja "Respuestas" (misma planilla), consultables con filtros reales.

## Estado actual (qué está hecho y qué falta)

Hecho:
- Login por email contra la hoja "Usuarios" (sin contraseña, igual que la app del CC).
- Alta de actividades (`/actividades`), catálogo propio con fecha/hora, para poder elegirlas antes de que exista ninguna respuesta.
- Carga/edición de respuestas por par (actividad vigente, compañerx) (`/carga`): si ya existe una respuesta para ese par, la precarga y la actualiza en vez de duplicarla.
- Consulta con filtros combinables: compañerx, actividad, área, rango de fechas, estado de respuesta (`/consulta`).
- Generador de mensaje de WhatsApp por actividad, con conteo de confirmados + listado, y conteo de "otras respuestas" (No / A confirmar / Sin Respuesta) con listado opcional por tipo. Excluye `N/A` (no convocadxs) del mensaje.
- Endpoints `/api/usuarios`, `/api/companerxs`, `/api/actividades`, `/api/respuestas` (GET/POST/PATCH), con validación de rol server-side en las escrituras.
- Adaptación mobile: layouts responsive (se apilan en pantallas angostas, tablas con scroll horizontal, menú hamburguesa) + PWA instalable (ícono en pantalla de inicio, `manifest.json` + service worker mínimo). El mismo código sirve para desktop y mobile, se adapta solo según el ancho de pantalla.
- "Sin Respuesta" automático: al crear una actividad, se generan automáticamente filas "Sin Respuesta" para todxs lxs compañerxs activxs — nadie tiene que cargarlo a mano.
- Consulta no muestra nada hasta elegir compañerx, actividad o área en los filtros (evita mezclar todo sin contexto).
- Horario de llegada/salida (opcionales) por respuesta, validados contra la ventana de la actividad (hora de inicio / hora de fin si está definida).
- Mensaje de WhatsApp: listado uno por línea (no separado por coma), con horario entre paréntesis cuando está cargado.
- Filtro por área al elegir compañerx en Carga.
- Cierre post-actividad (`/cierre`): elegí una actividad ya pasada, marcá ✅/❌ por compañerx (independientemente de su respuesta original), guardado en bloque con manejo de errores por fila.
- Resumen / Estadísticas (`/resumen`): tablero con filtros combinables (fecha, área, actividad, compañerx), métricas generales (actividades, confirmados, tasa de confirmación, tasa de efectividad — % de quienes confirmaron que realmente asistieron), gráfico de barras por actividad, y una tabla de detalle que cambia según el filtro: compañerxs de una actividad puntual, actividades de un compañerx puntual, o resumen agregado por actividad si no se acota a ninguno de los dos.

## ⚠️ Nuevos pasos manuales pendientes en Google Sheets

1. **Agregar `hora_fin` en la celda H1 de la hoja "Actividades"** (columna nueva, opcional).
2. **Agregar `horario_llegada` en M1 y `horario_salida` en N1 de la hoja "Respuestas"** (columnas nuevas, opcionales).

Como siempre, las filas ya cargadas quedan con esas celdas vacías — no se pierde nada.

## Decisiones de diseño a tener presente

- Una actividad es "vigente" (aparece en el dropdown de carga) mientras su fecha+hora de inicio sea **estrictamente posterior** al momento actual. Una vez que arrancó, deja de poder cargarse o modificarse desde `/carga` — pasa a estar disponible en Cierre post-actividad (`/cierre`), que muestra exactamente las que ya no son vigentes.
- Cada respuesta se identifica por `id_actividad` (no por nombre de actividad), evitando ambigüedad si dos actividades comparten nombre en fechas distintas. `actividad`, `fecha`, `hora` y `área` se guardan igual en cada fila de Respuestas (denormalizados), para que Consulta y el generador de WhatsApp sigan funcionando sin cruzar datos.
- El campo `área` de cada respuesta se **copia automáticamente** desde la ficha de la persona en la hoja "Compañerxs" al momento de cargar la respuesta (denormalizado) — no se tipea a mano. Si una persona cambia de área más adelante, sus respuestas ya cargadas conservan el área que tenía en ese momento (es un dato histórico).
- El generador de WhatsApp trabaja sobre **una actividad puntual** (elegida en el filtro de actividad), y usa **todas** sus respuestas — no respeta el resto de los filtros activos en la tabla (compañerx/área/fecha), para evitar armar un mensaje con un listado de confirmados incompleto.
- **Gap conocido, solo de interfaz:** la restricción de "actividad vigente" para editar respuestas hoy se aplica únicamente en el frontend (el dropdown solo muestra vigentes). El endpoint `/api/respuestas` PATCH no valida server-side si la actividad ya empezó — alguien llamando la API directo podría editar una respuesta de una actividad ya pasada. Si esto te importa, avisame y lo cierro del mismo modo que la validación de rol.

## Arquitectura

- **Frontend:** React + Vite + TypeScript.
- **Backend:** funciones serverless de Vercel (`/api`), porque las credenciales del service account no pueden exponerse en el navegador.
- **Datos:** Google Sheets API, spreadsheet "Organización 2026", hojas `Respuestas`, `Usuarios`, `Compañerxs`.

## Setup — Google Cloud (Service Account)

Si ya tenés un service account de la app del Centro Cultural, podés reutilizarlo (mismo proyecto de Google Cloud): solo hace falta compartir "Organización 2026" con su email de service account, con permiso de Editor.

Si necesitás crear uno nuevo:

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/).
2. Creá un proyecto (o reutilizá el existente).
3. Habilitá la "Google Sheets API" (Biblioteca de APIs → buscar "Google Sheets API" → Habilitar).
4. Credenciales → Crear credencial → Cuenta de servicio.
5. Una vez creada, entrá a la cuenta de servicio → pestaña "Claves" → Agregar clave → JSON. Se descarga un archivo con `client_email` y `private_key`.
6. Compartí la planilla "Organización 2026" con ese `client_email`, dándole permiso de Editor.

## Setup — proyecto local (Windows)

Requisitos: Node.js instalado (verificá con `node --version` en cmd; si no lo tenés, instalalo desde nodejs.org).

```cmd
cd registro-difusiones
npm install
copy .env.example .env
```

Editá `.env` y completá `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (con los `\n` literales tal como vienen en el JSON) y `SPREADSHEET_ID` (el ID que aparece en la URL de la planilla, entre `/d/` y `/edit`).

Para correr localmente con las funciones `/api` funcionando, hace falta la CLI de Vercel (las funciones serverless no corren con `npm run dev` solo):

```cmd
npm install -g vercel
vercel dev
```

Esto levanta la app completa (frontend + `/api`) en `http://localhost:3000`.

## Setup — Vercel (producción)

1. Subí este repo a GitHub.
2. En [vercel.com](https://vercel.com), importá el repo.
3. En "Environment Variables" del proyecto, cargá las mismas 3 variables del `.env`.
4. Deploy. Vercel detecta Vite automáticamente.

## Adaptación mobile / PWA

- El service worker (`public/sw.js`) solo se registra en producción (`import.meta.env.PROD`), nunca en `vercel dev` — en desarrollo generaría confusión cacheando versiones viejas del código.
- Para instalarla desde el celular: abrir la URL de producción en Chrome (Android) o Safari (iOS), y usar "Agregar a pantalla de inicio" desde el menú del navegador. Chrome en Android también puede ofrecer un banner de instalación automático.
- Los datos de `/api` nunca se cachean (el service worker los excluye explícitamente) — siempre se piden en vivo a Google Sheets, para no mostrar información desactualizada.
- El ícono (`public/icon-192.png`, `public/icon-512.png`) es un placeholder simple con la paleta de marca ("RD" sobre fondo azul) — si en algún momento tenés un logo real de Patria Grande en el formato adecuado, se puede reemplazar fácilmente.

- **"Sin Respuesta" automático (Opción A, materializado):** se generan filas físicas reales en "Respuestas" al crear la actividad, con `cargado_por = "sistema"`. Trade-off aceptado conscientemente: si un compañerx se da de alta en "Compañerxs" DESPUÉS de creada una actividad, no va a tener su fila "Sin Respuesta" para esa actividad — pero sí se crea normalmente la primera vez que alguien cargue una respuesta suya (el fallback de creación en `/api/respuestas` POST sigue funcionando igual).

- `/resumen` reemplazó por completo el enfoque anterior de "escribir una solapa nueva en Sheets" — ahora es un tablero dentro de la app, sin tocar Sheets para nada. El endpoint `api/resumen.ts` y las funciones `crearHojaSiNoExiste`/`reescribirHoja` en `api/_lib/sheets.ts` quedaron en el código (no se usan desde la UI) por si en algún momento se retoma la idea de exportar a Sheets como función aparte.

## Convenciones importantes

- Los valores de `respuesta`, `estado_post` y `roles` deben coincidir EXACTO (mayúsculas incluidas) con los menús desplegables de la hoja de Sheets: `Si, No, A confirmar, N/A, Sin Respuesta` / `✅, ❌` / `Responsable, Organización, Responsable Política`.
- La columna `activo` en Compañerxs es booleana (`1`/`0`), no texto.

## Modelo de roles (actualizado)

| Rol | Ve todo | Puede cargar/editar |
|---|---|---|
| `Responsable` | Sí | Sí |
| `Organización` | Sí | Sí |
| `Responsable Política` | Sí | No (solo lectura: Consulta y Resumen) |

No existe ningún rol con alcance limitado a un subconjunto de actividades — los 3 roles ven todos los datos, la única diferencia es si pueden escribir o no. La columna `actividades_asignadas` en la hoja "Usuarios" quedó sin uso por este motivo; se conserva por si en el futuro hace falta un rol con ese alcance limitado.

**Validación de rol:** los endpoints `/api/respuestas` (POST y PATCH) verifican del lado del servidor que el email de quien escribe (`cargado_por` en POST, `actor_email` en PATCH) tenga rol `Responsable` u `Organización`. Si no, devuelven `403`. Esto es independiente de que el frontend además oculte los botones — aunque alguien llame a la API directo (por ejemplo con curl o Postman), el servidor rechaza la escritura si el rol no corresponde.


## Estadísticas (`/resumen`, menú "Estadísticas")

Combina dos fuentes con los mismos criterios que la planilla "Estadísticas combinadas":

- **Histórico (Ene-Jul):** foto fija de las solapas mensuales cargadas a mano, servida por `/api/historico` desde `api/_data/historico.ts`. Ese archivo lo genera `scripts/generar_historico.py`; solo hace falta regenerarlo si se corrige algún dato de esas solapas:

  ```cmd
  pip install openpyxl
  python scripts\generar_historico.py "C:\ruta\Organizacion 2026.xlsx"
  ```

  (la planilla se exporta desde Sheets con Archivo > Descargar > Microsoft Excel).
- **Sistema:** se calcula en vivo desde Actividades/Respuestas cada vez que se abre la página.

La lógica de cálculo vive en `src/lib/estadisticas.ts` (normalización de ambas fuentes a un registro único + KPIs por corte), separada del componente `src/components/Resumen.tsx`.

KPIs: Actividades, Si, No, A confirmar, Sin Respuesta, N/A, Tasa de confirmación (Si / Si+No+A confirmar+Sin Respuesta), ✅, ❌, Tasa de efectividad (✅ / Si, puede superar 100% porque ✅ marca a quien asistió aunque no haya confirmado). Cortes: actividad, compañerx, área, horario de llegada (solo sistema), mes, día de semana. Filtros combinables por fuente, mes, día, área, actividad y compañerx; con compañerx o actividad elegidos se muestra además el listado de detalle.

**Pendiente de seguridad:** los endpoints de lectura (`/api/respuestas`, `/api/historico`, etc.) no validan quién llama; el login es del lado del navegador. Con estadísticas por persona disponibles, conviene agregar validación server-side también en las lecturas.


## Gestión de actividades y compañerxs, carga por área (octubre 2026)

- **Actividades** (`/actividades`): alta, edición y eliminación. Eliminar es una **baja lógica**: la columna `estado` de la hoja Actividades pasa a `eliminada`, y la actividad se excluye de carga, cierre, consulta y estadísticas (el GET de `/api/respuestas` ya filtra sus filas). Se puede restaurar. Editar propaga nombre, fecha y hora a todas sus filas de Respuestas en una sola escritura, e informa los horarios cargados que quedaron fuera del rango nuevo (no los modifica).
- **Compañerxs** (`/companerxs`): alta de personas nuevas (activo = 1), baja (activo = 0) y reactivación (activo = 1). El nombre es el identificador en todo el sistema: tiene que ser único y no se edita desde la app. Efectos sobre actividades **vigentes** (activas y no empezadas), nunca sobre las pasadas:
  - alta y reactivación: se agrega "Sin Respuesta" donde falte;
  - baja: sus "Sin Respuesta" pasan a N/A, marcadas con `cargado_por = sistema:baja`;
  - reactivación: solo esos N/A marcados vuelven a "Sin Respuesta" (los N/A cargados a mano no se tocan).
- **Carga por área** (bloque en Cargar respuestas, `/api/respuestas-area`): misma respuesta para todxs lxs activxs de una o varias áreas, en actividades vigentes. Por defecto solo completa los "Sin Respuesta"; con la opción explícita reemplaza también respuestas ya cargadas.
- **Horarios**: selector propio de 24 h (`SelectorHora`), igual en todos los dispositivos. Todo horario se normaliza a `HH:mm` (`src/lib/horas.ts`, compartido entre navegador y servidor) y se compara en minutos, contemplando actividades que cruzan la medianoche.

### Escrituras en bloque y cuota de Sheets

La API de Sheets permite 60 escrituras por minuto por usuario, y toda la app escribe con la misma service account. Cierre, edición de actividades, carga por área y alta/baja escriben en **una sola request** (`actualizarRangos` en `api/_lib/sheets.ts`). Las ediciones ubican cada fila por su id (`id_respuesta`, `id_actividad`, nombre) justo antes de escribir, no por el número de fila que tenía el navegador.

### Pasos manuales en Sheets

1. Hoja **Actividades**, celda **I1**: escribir `estado`. (El código lee por posición, pero el encabezado deja la planilla legible.)
2. Hoja **Respuestas**, columna B (`compañerx`): la validación de datos apunta a `'Compañerxs'!A2:A66`. Ampliarla a `'Compañerxs'!A2:A1000` para que las personas nuevas queden dentro del rango.

### Pruebas

Los endpoints se probaron de punta a punta contra una planilla simulada en memoria (27 casos: normalización de horas, permisos, duplicados, carga por área con y sin reemplazo, propagación de ediciones, baja lógica, baja/reactivación con marca, alta en vigentes y no en pasadas).
