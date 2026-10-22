import type { VercelRequest, VercelResponse } from '@vercel/node';
import { agregarFilas, actualizarRangos } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';
import {
  RANGO_RESPUESTAS, RESPUESTAS_VALIDAS, leerActividades, leerCompanerxs, leerRespuestas,
  esEliminada, esActivx, mismoNombre, vigenteEnServidor, filaRespuesta,
} from './_lib/dominio.js';

// POST /api/respuestas-area
// { id_actividad, areas: string[], respuesta, pisar: boolean, actor_email }
// Asigna la misma respuesta a todxs lxs compañerxs activxs de las áreas
// elegidas (área actual de la persona, según Compañerxs).
// - pisar = false: solo completa a quien está en "Sin Respuesta".
// - pisar = true: reemplaza también respuestas ya cargadas.
// Todo en una escritura de actualización + una de altas.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { id_actividad, areas, respuesta, pisar, actor_email } = req.body ?? {};
  if (!(await verificarPuedeEscribir(actor_email))) {
    return res.status(403).json({ error: 'El usuario no tiene permiso para cargar respuestas' });
  }
  if (!Array.isArray(areas) || areas.length === 0) return res.status(400).json({ error: 'Elegí al menos un área' });
  if (!RESPUESTAS_VALIDAS.includes(respuesta)) return res.status(400).json({ error: 'Respuesta inválida' });

  const [actividades, companerxs, respuestas] = await Promise.all([leerActividades(), leerCompanerxs(), leerRespuestas()]);
  const actividad = actividades.find((a) => a.id_actividad === id_actividad);
  if (!actividad || esEliminada(actividad)) return res.status(404).json({ error: 'La actividad no existe o fue eliminada' });
  // Misma regla que la carga individual: una vez que arrancó, no se carga más.
  if (!vigenteEnServidor(actividad)) return res.status(409).json({ error: 'La actividad ya empezó: no se pueden cargar respuestas' });

  const areasElegidas = areas.map((a: string) => a.trim().toLowerCase());
  const personas = companerxs.filter((c) => esActivx(c) && areasElegidas.includes(c['área'].trim().toLowerCase()));
  const deLaActividad = respuestas.filter((r) => r.id_actividad === id_actividad);
  const ahora = new Date().toISOString();

  const rangos: { rango: string; valores: string[][] }[] = [];
  const altas: string[][] = [];
  const omitidas: string[] = [];

  for (const p of personas) {
    const fila = deLaActividad.find((r) => mismoNombre(r['compañerx'], p.nombre));
    if (!fila) {
      altas.push(filaRespuesta({ compañerx: p.nombre, area: p['área'], actividad, respuesta, cargado_por: actor_email }));
      continue;
    }
    if (fila.respuesta === respuesta) continue; // ya tiene ese valor
    const sinRespuesta = !fila.respuesta || fila.respuesta === 'Sin Respuesta';
    if (!sinRespuesta && !pisar) {
      omitidas.push(`${p.nombre} (${fila.respuesta})`);
      continue;
    }
    rangos.push({ rango: `Respuestas!G${fila._fila}`, valores: [[respuesta]] });
    rangos.push({ rango: `Respuestas!J${fila._fila}:K${fila._fila}`, valores: [[ahora, actor_email]] });
  }

  await actualizarRangos(rangos);
  await agregarFilas(RANGO_RESPUESTAS, altas);
  return res.status(200).json({
    ok: true, personas: personas.length, actualizadas: rangos.length / 2, creadas: altas.length, omitidas,
  });
}
