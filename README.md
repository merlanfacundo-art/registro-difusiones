# Registro de Difusiones — Patria Grande Quilmes

App para registrar respuestas a difusiones de actividades, reemplazando la carga manual en la planilla wide de "Organización 2026". Los datos ahora viven en formato *long* en la hoja "Respuestas" (misma planilla), consultables con filtros reales.

## Estado actual (qué está hecho y qué falta)

Hecho:
- Login por email contra la hoja "Usuarios" (sin contraseña, igual que la app del CC).
- Formulario de carga de respuestas por actividad (`/carga`).
- Endpoints `/api/usuarios`, `/api/companerxs`, `/api/respuestas` (GET/POST/PATCH).

Todavía no implementado (próximos pasos de la secuencia):
- Vista de consulta con filtros (`/consulta`).
- Carga de estado post-actividad ✅/❌ (`/cierre`).
- Regeneración de la vista wide / resumen mensual (`/resumen`).

Estas tres pantallas están como placeholder visible en la app ("Todavía no está implementado"), no simuladas ni con datos falsos.

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
