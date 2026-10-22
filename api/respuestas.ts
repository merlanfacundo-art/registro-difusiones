import type { VercelRequest, VercelResponse } from '@vercel/node';
import { agregarFila, actualizarRangos } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';
import {
  RANGO_RESPUESTAS, COL_RESPUESTA, RESPUESTAS_VALIDAS, ESTADOS_POST_VALIDOS,
  leerRespuestas, leerActividades, esEliminada, mismoNombre, filaRespuesta,
} from './_lib/dominio.js';
import { normalizarHora } from '../src/lib/horas.js';

type Campo = keyof typeof COL_RESPUESTA;
const EDITABLES: Campo[] = ['respuesta', 'comentario', 'estado_post', 'horario_llegada', 'horario_salida'];

// Normaliza un horario opcional: '' borra; un valor ilegible es error.
function horarioOpcional(valor: unknown): { ok: true; valor: string } | { ok: false } {
  const texto = valor === undefined || valor === null ? '' : String(valor).trim();
  if (!texto) return { ok: true, valor: '' };
  const n = normalizarHora(texto);
  return n ? { ok: true, valor: n } : { ok: false };
}

// GET   /api/respuestas -> todas las filas, excluyendo las de actividades eliminadas
// POST  /api/respuestas -> alta de una respuesta (si ya existe para ese par, 409)
// PATCH /api/respuestas -> { cambios: [{ id_respuesta, ...campos }], actor_email }
//                          Ubica cada fila por su id justo antes de escribir y
//                          aplica todo en UNA escritura. Si algún id no existe,
//                          no escribe nada (todo o nada).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const [respuestas, actividades] = await Promise.all([leerRespuestas(), leerActividades()]);
    const eliminadas = new Set(actividades.filter(esEliminada).map((a) => a.id_actividad));
    return res.status(200).json(respuestas.filter((r) => !eliminadas.has(r.id_actividad)));
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const faltantes = ['id_actividad', 'compañerx', 'respuesta', 'cargado_por'].filter((c) => !body[c]);
    if (faltantes.length) return res.status(400).json({ error: `Faltan campos: ${faltantes.join(', ')}` });
    if (!(await verificarPuedeEscribir(body.cargado_por))) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para cargar respuestas' });
    }
    if (!RESPUESTAS_VALIDAS.includes(body.respuesta)) return res.status(400).json({ error: 'Respuesta inválida' });
    const llegada = horarioOpcional(body.horario_llegada);
    const salida = horarioOpcional(body.horario_salida);
    if (!llegada.ok || !salida.ok) return res.status(400).json({ error: 'Formato de horario inválido' });

    const [actividades, respuestas] = await Promise.all([leerActividades(), leerRespuestas()]);
    const actividad = actividades.find((a) => a.id_actividad === body.id_actividad);
    if (!actividad || esEliminada(actividad)) return res.status(404).json({ error: 'La actividad no existe o fue eliminada' });
    if (respuestas.some((r) => r.id_actividad === actividad.id_actividad && mismoNombre(r['compañerx'], body['compañerx']))) {
      return res.status(409).json({ error: 'Ya existe una respuesta para esa persona en esta actividad. Recargá la página.' });
    }

    // Nombre, fecha y hora se toman del catálogo (no del navegador), para
    // que la copia en Respuestas siempre coincida con la actividad.
    await agregarFila(RANGO_RESPUESTAS, filaRespuesta({
      compañerx: body['compañerx'], area: body['área'] ?? '', actividad,
      respuesta: body.respuesta, cargado_por: body.cargado_por, comentario: body.comentario ?? '',
      horario_llegada: llegada.valor, horario_salida: salida.valor,
    }));
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { cambios, actor_email } = req.body ?? {};
    if (!Array.isArray(cambios) || cambios.length === 0) return res.status(400).json({ error: 'No hay cambios para aplicar' });
    if (!(await verificarPuedeEscribir(actor_email))) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para editar respuestas' });
    }

    const porId = new Map((await leerRespuestas()).map((r) => [r.id_respuesta, r]));
    const rangos: { rango: string; valores: string[][] }[] = [];
    const ahora = new Date().toISOString();

    for (const cambio of cambios) {
      const fila = porId.get(cambio.id_respuesta)?._fila;
      if (!fila) return res.status(409).json({ error: 'Alguna respuesta ya no existe en la planilla. Recargá la página.' });

      for (const campo of EDITABLES) {
        if (cambio[campo] === undefined) continue;
        let valor = String(cambio[campo] ?? '');
        if (campo === 'respuesta' && !RESPUESTAS_VALIDAS.includes(valor)) return res.status(400).json({ error: 'Respuesta inválida' });
        if (campo === 'estado_post' && !ESTADOS_POST_VALIDOS.includes(valor)) return res.status(400).json({ error: 'Estado post inválido' });
        if (campo === 'horario_llegada' || campo === 'horario_salida') {
          const h = horarioOpcional(valor);
          if (!h.ok) return res.status(400).json({ error: 'Formato de horario inválido' });
          valor = h.valor;
        }
        rangos.push({ rango: `Respuestas!${COL_RESPUESTA[campo]}${fila}`, valores: [[valor]] });
      }
      // Si cambia la respuesta, queda registrado quién y cuándo (esto además
      // borra la marca de "baja" si la tenía: pasa a ser una carga manual).
      if (cambio.respuesta !== undefined) {
        rangos.push({ rango: `Respuestas!J${fila}:K${fila}`, valores: [[ahora, actor_email]] });
      }
    }

    await actualizarRangos(rangos);
    return res.status(200).json({ ok: true, actualizadas: cambios.length });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
