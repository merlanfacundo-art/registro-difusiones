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

Todavía no implementado (próximos pasos de la secuencia):
- Carga de estado post-actividad ✅/❌ (`/cierre`).
- Regeneración de la vista wide / resumen mensual (`/resumen`).

## ⚠️ Pasos manuales pendientes en Google Sheets (antes de correr esta versión)

No tengo edición de celdas sobre archivos ya existentes desde mi conector — estos 2 pasos los tenés que hacer vos, una sola vez:

1. **Migrar la hoja "Actividades"** (creada como archivo separado) a "Organización 2026", igual que hiciste con Respuestas/Usuarios/Compañerxs.
2. **Agregar la columna `id_actividad` en la celda L1 de la hoja "Respuestas"** ya existente (queda como columna nueva al final, las filas viejas quedan con esa celda vacía — no pasa nada, son respuestas cargadas antes de este cambio).

## Decisiones de diseño a tener presente

- Una actividad es "vigente" (aparece en el dropdown de carga) mientras su fecha+hora de inicio sea **estrictamente posterior** al momento actual. Una vez que arrancó, deja de poder cargarse o modificarse desde `/carga` — solo queda disponible el Cierre post-actividad (a implementar).
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
