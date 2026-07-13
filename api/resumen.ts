import type { VercelRequest, VercelResponse } from '@vercel/node';
import { leerHojaComoObjetos, crearHojaSiNoExiste, reescribirHoja } from './_lib/sheets.js';
import { verificarPuedeEscribir } from './_lib/auth.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface RespuestaFila {
  compañerx: string;
  actividad: string;
  fecha: string;
  respuesta: string;
  comentario: string;
  estado_post: string;
  id_actividad: string;
}

// POST /api/resumen  { anio, mes (1-12), actor_email }
// Pivotea las respuestas de las actividades de ese mes (compañerxs x
// actividades) y las escribe en una solapa nueva "<Mes> (auto)" — nunca
// toca las solapas cargadas a mano.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { anio, mes, actor_email } = req.body;
  if (!anio || !mes) {
    return res.status(400).json({ error: 'Faltan los parámetros anio y mes' });
  }

  const autorizado = await verificarPuedeEscribir(actor_email);
  if (!autorizado) {
    return res.status(403).json({ error: 'El usuario no tiene permiso para generar el resumen' });
  }

  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;

  const [actividades, respuestasRaw] = await Promise.all([
    leerHojaComoObjetos('Actividades!A:H'),
    leerHojaComoObjetos('Respuestas!A:N'),
  ]);

  const actividadesDelMes = actividades
    .filter((a) => a.fecha.startsWith(prefijo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (actividadesDelMes.length === 0) {
    return res.status(200).json({ ok: true, actividades: 0, companerxs: 0 });
  }

  const idsDelMes = new Set(actividadesDelMes.map((a) => a.id_actividad));
  const respuestas = (respuestasRaw as unknown as RespuestaFila[]).filter(
    (r) => idsDelMes.has(r.id_actividad) && r.respuesta !== 'N/A'
  );

  // Compañerxs incluidxs: quienes tengan al menos una respuesta (no N/A)
  // en alguna actividad de este mes.
  const companerxs = [...new Set(respuestas.map((r) => r.compañerx))].sort();

  // Header: Compañerx + 3 columnas por actividad (Respuesta/Comentario/Estado post)
  const header: string[] = ['Compañerx'];
  actividadesDelMes.forEach((a) => {
    header.push(`${a.nombre} - Respuesta`, `${a.nombre} - Comentario`, `${a.nombre} - Estado post`);
  });

  // Índice rápido: compañerx+id_actividad -> respuesta
  const indice = new Map<string, RespuestaFila>();
  respuestas.forEach((r) => indice.set(`${r.compañerx}|${r.id_actividad}`, r));

  const filasDatos: string[][] = companerxs.map((nombre) => {
    const fila = [nombre];
    actividadesDelMes.forEach((a) => {
      const r = indice.get(`${nombre}|${a.id_actividad}`);
      fila.push(r?.respuesta ?? '', r?.comentario ?? '', r?.estado_post ?? '');
    });
    return fila;
  });

  // Footer de conteos por actividad, alineado bajo la columna "Respuesta" de cada grupo.
  const contarPorTipo = (idActividad: string, tipo: string) =>
    respuestas.filter((r) => r.id_actividad === idActividad && r.respuesta === tipo).length;

  const filaConteo = (etiqueta: string, tipo: string): string[] => {
    const fila = [etiqueta];
    actividadesDelMes.forEach((a) => {
      fila.push(String(contarPorTipo(a.id_actividad, tipo)), '', '');
    });
    return fila;
  };

  const footer = [
    filaConteo('Confirmadxs', 'Si'),
    filaConteo('Ausentes', 'No'),
    filaConteo('A confirmar', 'A confirmar'),
    filaConteo('Sin Respuesta', 'Sin Respuesta'),
  ];

  const nombreHoja = `${MESES[mes - 1]} (auto)`;
  await crearHojaSiNoExiste(nombreHoja);
  await reescribirHoja(nombreHoja, [header, ...filasDatos, [], ...footer]);

  return res.status(200).json({
    ok: true,
    hoja: nombreHoja,
    actividades: actividadesDelMes.length,
    companerxs: companerxs.length,
  });
}
