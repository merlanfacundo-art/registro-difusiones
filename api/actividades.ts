import type { VercelRequest, VercelResponse } from '@vercel/node';
import { leerHojaComoObjetos, agregarFila } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';

const RANGO = 'Actividades!A:G';

// GET  /api/actividades  -> catálogo completo (el frontend filtra "vigentes" con la hora actual)
// POST /api/actividades  -> alta de una actividad nueva
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const filas = await leerHojaComoObjetos(RANGO);
    return res.status(200).json(filas);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const requeridos = ['nombre', 'fecha', 'hora', 'creada_por'];
    const faltantes = requeridos.filter((campo) => !body[campo]);
    if (faltantes.length > 0) {
      return res.status(400).json({ error: `Faltan campos: ${faltantes.join(', ')}` });
    }

    const autorizado = await verificarPuedeEscribir(body.creada_por);
    if (!autorizado) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para crear actividades' });
    }

    const id_actividad = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fecha_creacion = new Date().toISOString();

    await agregarFila(RANGO, [
      id_actividad,
      body.nombre,
      body.fecha,
      body.hora,
      body.área || '',
      body.creada_por,
      fecha_creacion,
    ]);

    return res.status(201).json({ id_actividad, fecha_creacion });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
