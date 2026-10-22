import type { VercelRequest, VercelResponse } from '@vercel/node';
import { agregarFila, agregarFilas, actualizarRangos } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';
import {
  RANGO_COMPANERXS, RANGO_RESPUESTAS, MARCA_BAJA, leerActividades, leerCompanerxs, leerRespuestas,
  esEliminada, esActivx, mismoNombre, vigenteEnServidor, filaRespuesta,
} from './_lib/dominio.js';

// Actividades vigentes (activas y todavía no empezadas): las únicas que
// alta y baja tocan. El pasado queda siempre intacto.
async function vigentes() {
  return (await leerActividades()).filter((a) => !esEliminada(a) && vigenteEnServidor(a));
}

// GET   /api/companerxs -> lista completa (el frontend filtra activxs)
// POST  /api/companerxs -> alta de una persona nueva: { nombre, area, actor_email }
// PATCH /api/companerxs -> baja o reactivación: { nombre, accion: 'baja' | 'alta', actor_email }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const filas = await leerCompanerxs();
    return res.status(200).json(filas.filter((f) => f.nombre).map((f) => ({
      nombre: f.nombre,
      area: f['área'],
      activo: esActivx(f),
      vacaciones_desde: f.vacaciones_desde || null,
      vacaciones_hasta: f.vacaciones_hasta || null,
    })));
  }

  const body = req.body ?? {};
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).json({ error: 'Método no permitido' });
  if (!(await verificarPuedeEscribir(body.actor_email))) {
    return res.status(403).json({ error: 'El usuario no tiene permiso para modificar compañerxs' });
  }
  const nombre = String(body.nombre ?? '').trim();
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
  const companerxs = await leerCompanerxs();
  const existente = companerxs.find((c) => mismoNombre(c.nombre, nombre));

  if (req.method === 'POST') {
    const area = String(body.area ?? '').trim();
    if (!area) return res.status(400).json({ error: 'Falta el área' });
    // El nombre es el identificador de la persona en todo el sistema: tiene que ser único.
    if (existente) {
      const estado = esActivx(existente) ? 'activx' : 'inactivx (podés reactivarlx)';
      return res.status(409).json({ error: `Ya existe "${existente.nombre}" (${estado})` });
    }
    await agregarFila(RANGO_COMPANERXS, [nombre, area, 1, '', '']);
    const filas = (await vigentes()).map((actividad) =>
      filaRespuesta({ compañerx: nombre, area, actividad, respuesta: 'Sin Respuesta', cargado_por: 'sistema' })
    );
    await agregarFilas(RANGO_RESPUESTAS, filas);
    return res.status(201).json({ ok: true, respuestas_generadas: filas.length });
  }

  // PATCH
  if (!existente) return res.status(404).json({ error: 'No existe esa persona' });
  if (body.accion !== 'baja' && body.accion !== 'alta') return res.status(400).json({ error: 'Acción no reconocida' });
  const [actividades, respuestas] = await Promise.all([vigentes(), leerRespuestas()]);
  const idsVigentes = new Set(actividades.map((a) => a.id_actividad));
  const suyas = respuestas.filter((r) => idsVigentes.has(r.id_actividad) && mismoNombre(r['compañerx'], existente.nombre));
  const ahora = new Date().toISOString();
  const rangos: { rango: string; valores: (string | number)[][] }[] = [
    { rango: `Compañerxs!C${existente._fila}`, valores: [[body.accion === 'baja' ? 0 : 1]] },
  ];

  if (body.accion === 'baja') {
    // Sus "Sin Respuesta" en vigentes pasan a N/A (no convocadx), con marca.
    const aConvertir = suyas.filter((r) => !r.respuesta || r.respuesta === 'Sin Respuesta');
    aConvertir.forEach((r) => {
      rangos.push({ rango: `Respuestas!G${r._fila}`, valores: [['N/A']] });
      rangos.push({ rango: `Respuestas!J${r._fila}:K${r._fila}`, valores: [[ahora, MARCA_BAJA]] });
    });
    await actualizarRangos(rangos);
    return res.status(200).json({ ok: true, pasadas_a_na: aConvertir.length });
  }

  // Reactivación: revierte solo los N/A que puso la baja y completa las vigentes que falten.
  const aRevertir = suyas.filter((r) => r.respuesta === 'N/A' && r.cargado_por === MARCA_BAJA);
  aRevertir.forEach((r) => {
    rangos.push({ rango: `Respuestas!G${r._fila}`, valores: [['Sin Respuesta']] });
    rangos.push({ rango: `Respuestas!J${r._fila}:K${r._fila}`, valores: [[ahora, 'sistema']] });
  });
  const conFila = new Set(suyas.map((r) => r.id_actividad));
  const altas = actividades.filter((a) => !conFila.has(a.id_actividad)).map((actividad) =>
    filaRespuesta({ compañerx: existente.nombre, area: existente['área'], actividad, respuesta: 'Sin Respuesta', cargado_por: 'sistema' })
  );
  await actualizarRangos(rangos);
  await agregarFilas(RANGO_RESPUESTAS, altas);
  return res.status(200).json({ ok: true, revertidas: aRevertir.length, respuestas_generadas: altas.length });
}
