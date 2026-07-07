import type { VercelRequest, VercelResponse } from '@vercel/node';
import { leerHojaComoObjetos } from './_lib/sheets.js';

// GET /api/companerxs
// Devuelve la lista completa de compañerxs (para poblar el formulario
// de carga). El filtro de "vacaciones" o "activo" lo aplica el frontend,
// para poder mostrar igual el estado en la UI si hace falta.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const filas = await leerHojaComoObjetos('Compañerxs!A:E');
  const companerxs = filas.map((f) => ({
    nombre: f.nombre,
    area: f.área,
    activo: f.activo === '1',
    vacaciones_desde: f.vacaciones_desde || null,
    vacaciones_hasta: f.vacaciones_hasta || null,
  }));

  return res.status(200).json(companerxs);
}
