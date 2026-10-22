// Estructura de las hojas y reglas de negocio compartidas por los endpoints.
import { leerFilas } from './sheets.js';
import { normalizarHora } from '../../src/lib/horas.js';

export const COLS_RESPUESTAS = [
  'id_respuesta', 'compañerx', 'actividad', 'área', 'fecha', 'hora', 'respuesta', 'comentario',
  'estado_post', 'fecha_carga', 'cargado_por', 'id_actividad', 'horario_llegada', 'horario_salida',
] as const;
export const COLS_ACTIVIDADES = [
  'id_actividad', 'nombre', 'fecha', 'hora', 'área', 'creada_por', 'fecha_creacion', 'hora_fin', 'estado',
] as const;
export const COLS_COMPANERXS = ['nombre', 'área', 'activo', 'vacaciones_desde', 'vacaciones_hasta'] as const;

export const RANGO_RESPUESTAS = 'Respuestas!A:N';
export const RANGO_ACTIVIDADES = 'Actividades!A:I';
export const RANGO_COMPANERXS = 'Compañerxs!A:E';

// Letra de columna de cada campo editable de Respuestas (ver COLS_RESPUESTAS).
export const COL_RESPUESTA = {
  respuesta: 'G', comentario: 'H', estado_post: 'I', fecha_carga: 'J', cargado_por: 'K',
  horario_llegada: 'M', horario_salida: 'N',
} as const;

export const RESPUESTAS_VALIDAS = ['Si', 'No', 'A confirmar', 'N/A', 'Sin Respuesta'];
export const ESTADOS_POST_VALIDOS = ['✅', '❌', ''];

// Marca en cargado_por de las respuestas que la baja de un compañerx pasó
// a N/A. Permite revertir SOLO esas si la persona se reactiva, sin tocar
// los N/A cargados a mano por alguien.
export const MARCA_BAJA = 'sistema:baja';

export const leerRespuestas = () => leerFilas(RANGO_RESPUESTAS, COLS_RESPUESTAS);
export const leerActividades = () => leerFilas(RANGO_ACTIVIDADES, COLS_ACTIVIDADES);
export const leerCompanerxs = () => leerFilas(RANGO_COMPANERXS, COLS_COMPANERXS);

export function nuevoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function esEliminada(a: { estado: string }): boolean {
  return (a.estado ?? '').trim().toLowerCase() === 'eliminada';
}

export function esActivx(c: { activo: string }): boolean {
  return String(c.activo).trim() === '1';
}

export function mismoNombre(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Vigencia del lado del servidor. Vercel corre en UTC, y fecha/hora de la
// actividad son hora de Argentina: se fija el offset -03:00 (Argentina no
// usa horario de verano actualmente; si eso cambia, hay que revisar esto).
export function vigenteEnServidor(a: { fecha: string; hora: string }, ahora = Date.now()): boolean {
  const hora = normalizarHora(a.hora) ?? '00:00';
  const inicio = Date.parse(`${a.fecha}T${hora}:00-03:00`);
  return !Number.isNaN(inicio) && inicio > ahora;
}

// Arma una fila completa de Respuestas en el orden de COLS_RESPUESTAS.
export function filaRespuesta(p: {
  compañerx: string; area: string; actividad: { id_actividad: string; nombre: string; fecha: string; hora: string };
  respuesta: string; cargado_por: string; comentario?: string; horario_llegada?: string; horario_salida?: string;
}): string[] {
  return [
    nuevoId(), p.compañerx, p.actividad.nombre, p.area, p.actividad.fecha, p.actividad.hora,
    p.respuesta, p.comentario ?? '', '', new Date().toISOString(), p.cargado_por,
    p.actividad.id_actividad, p.horario_llegada ?? '', p.horario_salida ?? '',
  ];
}
