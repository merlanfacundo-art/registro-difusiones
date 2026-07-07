import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsClient, agregarFila, actualizarCelda } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';

const RANGO = 'Respuestas!A:K';
const COLUMNAS = [
  'id_respuesta',
  'compañerx',
  'actividad',
  'área',
  'fecha',
  'hora',
  'respuesta',
  'comentario',
  'estado_post',
  'fecha_carga',
  'cargado_por',
] as const;

// GET  /api/respuestas            -> todas las filas, con su número de fila real
// POST /api/respuestas            -> agrega una nueva respuesta
// PATCH /api/respuestas?fila=N    -> actualiza el estado_post (✅/❌) de la fila N
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { sheets, spreadsheetId } = getSheetsClient();
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: RANGO });
    const filas = result.data.values ?? [];
    const [, ...datos] = filas; // saltea encabezado

    const respuestas = datos.map((fila, i) => {
      const obj: Record<string, string> = {};
      COLUMNAS.forEach((col, j) => { obj[col] = fila[j] ?? ''; });
      // fila real en la hoja (fila 1 = encabezado, datos arrancan en fila 2)
      return { ...obj, _fila: i + 2 };
    });

    return res.status(200).json(respuestas);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const requeridos = ['compañerx', 'actividad', 'área', 'fecha', 'hora', 'respuesta', 'cargado_por'];
    const faltantes = requeridos.filter((campo) => !body[campo]);
    if (faltantes.length > 0) {
      return res.status(400).json({ error: `Faltan campos: ${faltantes.join(', ')}` });
    }

    // Validación server-side: cargado_por debe pertenecer a un rol con
    // permiso de escritura. No basta con que el frontend oculte el botón:
    // si alguien llama a este endpoint directo, igual queda bloqueado acá.
    const autorizado = await verificarPuedeEscribir(body.cargado_por);
    if (!autorizado) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para cargar respuestas' });
    }

    const id_respuesta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fecha_carga = new Date().toISOString();

    await agregarFila(RANGO, [
      id_respuesta,
      body.compañerx,
      body.actividad,
      body.área,
      body.fecha,
      body.hora,
      body.respuesta,
      body.comentario || '',
      '', // estado_post se completa después de la actividad
      fecha_carga,
      body.cargado_por,
    ]);

    return res.status(201).json({ id_respuesta, fecha_carga });
  }

  if (req.method === 'PATCH') {
    const fila = Number(req.query.fila);
    const { estado_post, actor_email } = req.body;
    if (!fila || !estado_post) {
      return res.status(400).json({ error: 'Faltan los parámetros fila o estado_post' });
    }

    const autorizado = await verificarPuedeEscribir(actor_email);
    if (!autorizado) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para editar el estado post-actividad' });
    }

    // Columna I = estado_post (novena columna: A=1..I=9)
    await actualizarCelda(`Respuestas!I${fila}`, estado_post);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
