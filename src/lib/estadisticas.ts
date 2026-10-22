// Unifica la base histórica (solapas Ene-Jul) y el sistema nuevo
// (Actividades/Respuestas) en un mismo tipo de registro, y calcula los KPIs
// por cualquier corte. Mismos criterios que la planilla "Estadísticas combinadas".

export type Fuente = 'historico' | 'sistema';
export type RespuestaNorm = 'Si' | 'No' | 'A confirmar' | 'Sin Respuesta' | 'N/A';

export interface Registro {
  fuente: Fuente;
  actividadKey: string; // identifica la actividad sin ambigüedad entre fuentes
  actividad: string;
  actividadLabel: string; // "Nombre (Mes)"
  mes: string | null;
  diaSemana: string | null;
  area: string | null;
  companerx: string;
  respuesta: RespuestaNorm;
  check: boolean;
  cross: boolean;
  horaLlegada: string | null;
  horaSalida: string | null;
  comentario: string;
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CODIGOS_RESPUESTA: RespuestaNorm[] = ['Si', 'No', 'A confirmar', 'Sin Respuesta', 'N/A'];

// Las respuestas vienen de menús cerrados; la normalización solo absorbe
// diferencias de mayúsculas/espacios. Vacío = Sin Respuesta.
export function normalizarRespuesta(valor: string | null | undefined): RespuestaNorm {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'si' || v === 'sí') return 'Si';
  if (v === 'no') return 'No';
  if (v === 'a confirmar') return 'A confirmar';
  if (v === 'n/a') return 'N/A';
  return 'Sin Respuesta';
}

interface HistoricoRaw {
  compas: string[];
  areas: string[];
  actividades: { n: string; m: string; d: string | null }[];
  registros: [number, number, number, number, number][];
}

export function desdeHistorico(h: HistoricoRaw): Registro[] {
  return h.registros.map(([ci, ai, ar, r, flags]) => {
    const act = h.actividades[ai];
    return {
      fuente: 'historico',
      actividadKey: `h:${ai}`,
      actividad: act.n,
      actividadLabel: `${act.n} (${act.m})`,
      mes: act.m,
      diaSemana: act.d,
      area: ar >= 0 ? h.areas[ar] : null,
      companerx: h.compas[ci],
      respuesta: CODIGOS_RESPUESTA[r],
      check: (flags & 1) === 1,
      cross: (flags & 2) === 2,
      horaLlegada: null,
      horaSalida: null,
      comentario: '',
    };
  });
}

function mesYDia(fechaIso: string): { mes: string | null; dia: string | null } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso ?? '');
  if (!m) return { mes: null, dia: null };
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // getDay(): 0 = domingo; DIAS arranca en lunes
  return { mes: MESES[fecha.getMonth()], dia: DIAS[(fecha.getDay() + 6) % 7] };
}

export function desdeSistema(filas: Record<string, string>[]): Registro[] {
  return filas
    .filter((f) => f.id_actividad)
    .map((f) => {
      const { mes, dia } = mesYDia(f.fecha);
      return {
        fuente: 'sistema',
        actividadKey: `s:${f.id_actividad}`,
        actividad: (f.actividad ?? '').trim(),
        actividadLabel: `${(f.actividad ?? '').trim()} (${mes ?? 's/fecha'})`,
        mes,
        diaSemana: dia,
        area: f['área'] || null,
        companerx: f['compañerx'],
        respuesta: normalizarRespuesta(f.respuesta),
        check: f.estado_post === '✅',
        cross: f.estado_post === '❌',
        horaLlegada: f.horario_llegada || null,
        horaSalida: f.horario_salida || null,
        comentario: f.comentario ?? '',
      };
    });
}

export interface Kpis {
  actividades: number;
  si: number;
  no: number;
  aConfirmar: number;
  sinRespuesta: number;
  na: number;
  check: number;
  cross: number;
  tasaConfirmacion: number | null; // Si / (Si+No+A confirmar+Sin Respuesta)
  tasaEfectividad: number | null; // ✅ / Si — puede superar 100%, ver notas
}

export function calcularKpis(registros: Registro[]): Kpis {
  const acts = new Set<string>();
  let si = 0, no = 0, ac = 0, sr = 0, na = 0, check = 0, cross = 0;
  for (const r of registros) {
    acts.add(r.actividadKey);
    if (r.respuesta === 'Si') si++;
    else if (r.respuesta === 'No') no++;
    else if (r.respuesta === 'A confirmar') ac++;
    else if (r.respuesta === 'Sin Respuesta') sr++;
    else na++;
    if (r.check) check++;
    if (r.cross) cross++;
  }
  const base = si + no + ac + sr;
  return {
    actividades: acts.size, si, no, aConfirmar: ac, sinRespuesta: sr, na, check, cross,
    tasaConfirmacion: base ? si / base : null,
    tasaEfectividad: si ? check / si : null,
  };
}

export type Corte = 'actividad' | 'companerx' | 'area' | 'horario' | 'mes' | 'dia';

export const CORTES: { valor: Corte; etiqueta: string }[] = [
  { valor: 'actividad', etiqueta: 'Actividad' },
  { valor: 'companerx', etiqueta: 'Compañerx' },
  { valor: 'area', etiqueta: 'Área' },
  { valor: 'horario', etiqueta: 'Horario (llegada)' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'dia', etiqueta: 'Día de semana' },
];

function claveDeCorte(r: Registro, corte: Corte): string | null {
  switch (corte) {
    case 'actividad': return r.actividadLabel;
    case 'companerx': return r.companerx;
    case 'area': return r.area ?? '(sin área registrada)';
    case 'mes': return r.mes ?? '(sin fecha)';
    case 'dia': return r.diaSemana ?? '(fecha no determinada)';
    case 'horario': {
      // Solo el sistema nuevo tiene horario; los registros sin dato quedan fuera del corte.
      const m = /^(\d{1,2}):/.exec(r.horaLlegada ?? '');
      return m ? `${m[1].padStart(2, '0')}:00` : null;
    }
  }
}

export interface FilaCorte extends Kpis {
  grupo: string;
}

export function agruparPorCorte(registros: Registro[], corte: Corte): FilaCorte[] {
  const grupos = new Map<string, Registro[]>();
  for (const r of registros) {
    const k = claveDeCorte(r, corte);
    if (k === null) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(r);
  }
  const filas = [...grupos.entries()].map(([grupo, regs]) => ({ grupo, ...calcularKpis(regs) }));

  // Orden natural para mes y día; el resto, por cantidad de actividades.
  if (corte === 'mes') return filas.sort((a, b) => ordenEn(MESES, a.grupo) - ordenEn(MESES, b.grupo));
  if (corte === 'dia') return filas.sort((a, b) => ordenEn(DIAS, a.grupo) - ordenEn(DIAS, b.grupo));
  if (corte === 'horario') return filas.sort((a, b) => a.grupo.localeCompare(b.grupo));
  return filas.sort((a, b) => b.actividades - a.actividades || a.grupo.localeCompare(b.grupo));
}

function ordenEn(lista: string[], valor: string): number {
  const i = lista.indexOf(valor);
  return i === -1 ? 99 : i;
}

export function formatPct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`;
}
