import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Autenticación por Service Account: las credenciales viven SOLO en
// variables de entorno de Vercel, nunca en el repo. Este módulo se
// importa exclusivamente desde funciones en /api (lado servidor);
// el frontend nunca ve estas credenciales.
function getAuthClient(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      'Faltan las variables de entorno GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY'
    );
  }

  return new google.auth.JWT({
    email,
    // Vercel guarda los saltos de línea de la clave como "\n" literal;
    // hay que restaurarlos antes de usarla.
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export function getSheetsClient() {
  if (!SPREADSHEET_ID) {
    throw new Error('Falta la variable de entorno SPREADSHEET_ID');
  }
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, spreadsheetId: SPREADSHEET_ID };
}

// Lee un rango completo y lo devuelve como array de objetos,
// usando la primera fila como encabezados. Evita repetir este
// parseo en cada función de /api.
export async function leerHojaComoObjetos(rango: string): Promise<Record<string, string>[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rango,
  });
  const filas = res.data.values ?? [];
  if (filas.length === 0) return [];
  const [encabezados, ...datos] = filas;
  return datos.map((fila) => {
    const obj: Record<string, string> = {};
    encabezados.forEach((col: string, i: number) => {
      obj[col] = fila[i] ?? '';
    });
    return obj;
  });
}

// Agrega una fila nueva al final de la hoja indicada.
// Usa RAW (no USER_ENTERED) para que Sheets NO intente interpretar los
// valores como fecha/hora/número — los guarda tal cual como texto. Es
// necesario porque nuestro código siempre controla el formato exacto
// (fechas ISO, horas HH:mm) y una auto-conversión de Sheets rompe esos
// formatos al leerlos de vuelta.
export async function agregarFila(rango: string, valores: (string | number)[]): Promise<void> {
  await agregarFilas(rango, [valores]);
}

// Igual que agregarFila, pero para varias filas en una sola llamada a la
// API — necesario al crear una actividad, que genera una fila "Sin
// Respuesta" por cada compañerx activx (evita 60 llamadas individuales
// y el riesgo de pisar la cuota de escritura de Sheets).
export async function agregarFilas(rango: string, filas: (string | number)[][]): Promise<void> {
  if (filas.length === 0) return;
  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: rango,
    valueInputOption: 'RAW',
    requestBody: { values: filas },
  });
}

// Actualiza una celda puntual (usado por ej. para cargar el estado_post
// sobre una fila ya existente de Respuestas). Mismo motivo: RAW evita que
// Sheets reinterprete el valor.
export async function actualizarCelda(rango: string, valor: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: rango,
    valueInputOption: 'RAW',
    requestBody: { values: [[valor]] },
  });
}

// Crea una hoja (tab) nueva con el nombre indicado si todavía no existe.
// Usado por Resumen mensual para escribir en una solapa propia (ej. "Julio
// (auto)") en vez de tocar las solapas cargadas a mano — así no hay riesgo
// de pisar datos existentes por un error de alineación de filas/columnas.
export async function crearHojaSiNoExiste(nombreHoja: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existe = metadata.data.sheets?.some((s) => s.properties?.title === nombreHoja);
  if (existe) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: nombreHoja } } }],
    },
  });
}

// Borra todo el contenido de una hoja (para regenerarla desde cero) y
// escribe una grilla 2D completa a partir de A1. El nombre de hoja se
// encierra siempre entre comillas simples porque puede tener espacios
// o paréntesis (ej. "Julio (auto)"), que rompen la notación A1 si van sueltos.
export async function reescribirHoja(nombreHoja: string, filas: (string | number)[][]): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const rangoHoja = `'${nombreHoja}'`;

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: rangoHoja });

  if (filas.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${rangoHoja}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: filas },
  });
}
