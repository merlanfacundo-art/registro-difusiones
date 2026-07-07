import type { VercelRequest, VercelResponse } from '@vercel/node';
import { leerHojaComoObjetos } from './_lib/sheets.js';

// GET /api/usuarios?email=fulano@gmail.com
// Devuelve el usuario si el email está en la lista, o 404 si no.
// Este chequeo reemplaza el login de Google, no valida contraseña:
// el acceso está controlado por pertenecer a la hoja "Usuarios",
// igual que en la app del Centro Cultural.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Falta el parámetro email' });
  }

  const filas = await leerHojaComoObjetos('Usuarios!A:D');
  const fila = filas.find((f) => f.email?.trim().toLowerCase() === email);

  if (!fila) {
    return res.status(404).json({ error: 'Email no encontrado en la lista de Usuarios' });
  }

  return res.status(200).json({
    email: fila.email,
    nombre: fila.nombre,
    roles: (fila.roles || '').split(',').map((r) => r.trim()).filter(Boolean),
    actividades_asignadas: (fila.actividades_asignadas || '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  });
}
