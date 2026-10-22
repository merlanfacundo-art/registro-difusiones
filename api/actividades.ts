import type { VercelRequest, VercelResponse } from '@vercel/node';
import { agregarFila, agregarFilas, actualizarRangos } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';
import {
  RANGO_ACTIVIDADES, RANGO_RESPUESTAS, leerActividades, leerCompanerxs, leerRespuestas,
  nuevoId, esActivx, filaRespuesta,
} from './_lib/dominio.js';
import { normalizarHora } from '../src/lib/horas.js';
import { horarioValido } from '../src/types/index.js';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Valida y normaliza los datos editables de una actividad. Devuelve el
// error como texto, o los valores listos para escribir.
function validarDatos(body: Record<string, string>) {
  const nombre = (body.nombre ?? '').trim();
  const fecha = (body.fecha ?? '').trim();
  const hora = normalizarHora(body.hora);
  const horaFinTexto = (body.hora_fin ?? '').trim();
  const hora_fin = horaFinTexto ? normalizarHora(horaFinTexto) : '';
  if (!nombre) return { error: 'Falta el nombre' };
  if (!FECHA_ISO.test(fecha)) return { error: 'Fecha inválida (formato esperado aaaa-mm-dd)' };
  if (!hora) return { error: 'Hora de inicio inválida' };
  if (hora_fin === null) return { error: 'Hora de fin inválida' };
  return { nombre, fecha, hora, hora_fin, area: (body['área'] ?? body.area ?? '').trim() };
}

// GET   /api/actividades  -> catálogo completo, incluidas las eliminadas (con su estado)
// POST  /api/actividades  -> alta + "Sin Respuesta" para cada compañerx activx
// PATCH /api/actividades  -> { id_actividad, accion: 'editar' | 'eliminar' | 'restaurar', actor_email, ...datos }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const actividades = await leerActividades();
    return res.status(200).json(actividades.map(({ _fila, ...a }) => a));
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!(await verificarPuedeEscribir(body.creada_por))) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para crear actividades' });
    }
    const d = validarDatos(body);
    if ('error' in d) return res.status(400).json({ error: d.error });

    const actividad = { id_actividad: nuevoId(), nombre: d.nombre, fecha: d.fecha, hora: d.hora };
    const fecha_creacion = new Date().toISOString();
    await agregarFila(RANGO_ACTIVIDADES, [
      actividad.id_actividad, d.nombre, d.fecha, d.hora, d.area, body.creada_por, fecha_creacion, d.hora_fin, 'activa',
    ]);

    // Una fila "Sin Respuesta" por cada compañerx activx, en una sola escritura.
    const activos = (await leerCompanerxs()).filter(esActivx);
    const filas = activos.map((c) =>
      filaRespuesta({ compañerx: c.nombre, area: c['área'], actividad, respuesta: 'Sin Respuesta', cargado_por: 'sistema' })
    );
    await agregarFilas(RANGO_RESPUESTAS, filas);
    return res.status(201).json({ id_actividad: actividad.id_actividad, respuestas_generadas: filas.length });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    if (!(await verificarPuedeEscribir(body.actor_email))) {
      return res.status(403).json({ error: 'El usuario no tiene permiso para modificar actividades' });
    }
    const actividad = (await leerActividades()).find((a) => a.id_actividad === body.id_actividad);
    if (!actividad) return res.status(404).json({ error: 'La actividad no existe' });

    if (body.accion === 'eliminar' || body.accion === 'restaurar') {
      const estado = body.accion === 'eliminar' ? 'eliminada' : 'activa';
      await actualizarRangos([{ rango: `Actividades!I${actividad._fila}`, valores: [[estado]] }]);
      return res.status(200).json({ ok: true, estado });
    }

    if (body.accion !== 'editar') return res.status(400).json({ error: 'Acción no reconocida' });
    const d = validarDatos(body);
    if ('error' in d) return res.status(400).json({ error: d.error });

    // Nombre, fecha y hora están copiados en cada respuesta: se propagan en
    // la misma escritura. El área de Respuestas es la de la persona: no se toca.
    const respuestas = (await leerRespuestas()).filter((r) => r.id_actividad === actividad.id_actividad);
    const cambios = [
      { rango: `Actividades!B${actividad._fila}:E${actividad._fila}`, valores: [[d.nombre, d.fecha, d.hora, d.area]] },
      { rango: `Actividades!H${actividad._fila}`, valores: [[d.hora_fin]] },
      ...respuestas.map((r) => ({
        rango: `Respuestas!C${r._fila}:F${r._fila}`,
        valores: [[d.nombre, r['área'], d.fecha, d.hora]],
      })),
    ];
    await actualizarRangos(cambios);

    // Horarios ya cargados que quedaron fuera de la nueva ventana: no se
    // modifican, se informan para que alguien los revise.
    const ventana = { hora: d.hora, hora_fin: d.hora_fin };
    const fueraDeRango = respuestas
      .filter((r) => !horarioValido(r.horario_llegada, ventana) || !horarioValido(r.horario_salida, ventana))
      .map((r) => r['compañerx']);
    return res.status(200).json({ ok: true, respuestas_actualizadas: respuestas.length, horarios_fuera_de_rango: fueraDeRango });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
