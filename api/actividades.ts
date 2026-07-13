import type { VercelRequest, VercelResponse } from '@vercel/node';
import { leerHojaComoObjetos, agregarFila, agregarFilas } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';

const RANGO = 'Actividades!A:H';
// Columnas de Respuestas, en el mismo orden físico que usa api/respuestas.ts
const RANGO_RESPUESTAS = 'Respuestas!A:N';

// GET  /api/actividades  -> catálogo completo (el frontend filtra "vigentes" con la hora actual)
// POST /api/actividades  -> alta de una actividad nueva + genera automáticamente
//                            una fila "Sin Respuesta" por cada compañerx activx
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
      body.hora_fin || '',
    ]);

    // Materializa una fila "Sin Respuesta" por cada compañerx activx, así
    // queda registrado sin que nadie tenga que cargarlo a mano. Si alguien
    // se da de alta en Compañerxs DESPUÉS de este momento, no va a tener
    // fila para esta actividad — queda cubierto igual porque /api/respuestas
    // crea la fila al vuelo la primera vez que se cargue una respuesta suya.
    const companerxs = await leerHojaComoObjetos('Compañerxs!A:C');
    const activos = companerxs.filter((c) => c.activo === '1');

    const filasSinRespuesta = activos.map((c) => [
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, // id_respuesta
      c.nombre, // compañerx
      body.nombre, // actividad
      c.área || '', // área (denormalizada desde Compañerxs)
      body.fecha,
      body.hora,
      'Sin Respuesta',
      '', // comentario
      '', // estado_post
      fecha_creacion, // fecha_carga
      'sistema', // cargado_por: generado automáticamente, no por una persona
      id_actividad,
      '', // horario_llegada
      '', // horario_salida
    ]);
    await agregarFilas(RANGO_RESPUESTAS, filasSinRespuesta);

    return res.status(201).json({ id_actividad, fecha_creacion, respuestas_generadas: filasSinRespuesta.length });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
