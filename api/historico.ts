import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HISTORICO } from './_data/historico.js';

// GET /api/historico
// Devuelve la base histórica fija (solapas Enero-Julio cargadas a mano),
// generada por scripts/generar_historico.py. No cambia, así que se cachea
// en el borde de Vercel por un día.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  return res.status(200).json(HISTORICO);
}
