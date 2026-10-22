import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  desdeHistorico, desdeSistema, calcularKpis, agruparPorCorte, formatPct,
  CORTES, MESES, DIAS,
  type Registro, type Corte, type FilaCorte, type Fuente,
} from '../lib/estadisticas';

const COLORES = { Si: '#2E7D32', No: '#E32622', 'A confirmar': '#1A9DD7', 'Sin Respuesta': '#9AA0A6' };
const MAX_FILAS_GRAFICO = 20;

type ColumnaOrden = keyof FilaCorte;

const COLUMNAS: { clave: ColumnaOrden; etiqueta: string; pct?: boolean }[] = [
  { clave: 'actividades', etiqueta: 'Actividades' },
  { clave: 'si', etiqueta: 'Si' },
  { clave: 'no', etiqueta: 'No' },
  { clave: 'aConfirmar', etiqueta: 'A confirmar' },
  { clave: 'sinRespuesta', etiqueta: 'Sin Respuesta' },
  { clave: 'na', etiqueta: 'N/A' },
  { clave: 'tasaConfirmacion', etiqueta: 'Tasa confirmación', pct: true },
  { clave: 'check', etiqueta: '✅' },
  { clave: 'cross', etiqueta: '❌' },
  { clave: 'tasaEfectividad', etiqueta: 'Tasa efectividad', pct: true },
];

async function obtenerJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) {
    const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(data.error ?? `Error HTTP ${r.status}`);
  }
  return r.json();
}

export function Resumen() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [fFuente, setFFuente] = useState<'' | Fuente>('');
  const [fMes, setFMes] = useState('');
  const [fDia, setFDia] = useState('');
  const [fArea, setFArea] = useState('');
  const [fActividad, setFActividad] = useState('');
  const [fCompanerx, setFCompanerx] = useState('');

  const [corte, setCorte] = useState<Corte>('mes');
  const [orden, setOrden] = useState<{ clave: ColumnaOrden; desc: boolean } | null>(null);

  useEffect(() => {
    // Histórico fijo + sistema en vivo: cada vez que se abre la página,
    // la parte nueva se recalcula con las respuestas cargadas hasta ese momento.
    Promise.all([obtenerJson('/api/historico'), obtenerJson('/api/respuestas')])
      .then(([historico, respuestas]) => setRegistros([...desdeHistorico(historico), ...desdeSistema(respuestas)]))
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'Error desconocido al cargar datos'))
      .finally(() => setCargando(false));
  }, []);

  const opciones = useMemo(() => {
    const unicos = (f: (r: Registro) => string | null) =>
      [...new Set(registros.map(f).filter((v): v is string => Boolean(v)))];
    const actividades = new Map<string, string>();
    registros.forEach((r) => actividades.set(r.actividadKey, r.actividadLabel));
    return {
      meses: unicos((r) => r.mes).sort((a, b) => MESES.indexOf(a) - MESES.indexOf(b)),
      dias: unicos((r) => r.diaSemana).sort((a, b) => DIAS.indexOf(a) - DIAS.indexOf(b)),
      areas: unicos((r) => r.area).sort(),
      companerxs: unicos((r) => r.companerx).sort(),
      actividades: [...actividades.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    };
  }, [registros]);

  const filtrados = useMemo(() => registros.filter((r) =>
    (!fFuente || r.fuente === fFuente) &&
    (!fMes || r.mes === fMes) &&
    (!fDia || r.diaSemana === fDia) &&
    (!fArea || r.area === fArea) &&
    (!fActividad || r.actividadKey === fActividad) &&
    (!fCompanerx || r.companerx === fCompanerx)
  ), [registros, fFuente, fMes, fDia, fArea, fActividad, fCompanerx]);

  const kpis = useMemo(() => calcularKpis(filtrados), [filtrados]);

  const filasCorte = useMemo(() => {
    const filas = agruparPorCorte(filtrados, corte);
    if (!orden) return filas;
    return [...filas].sort((a, b) => {
      const va = (a[orden.clave] ?? -1) as number, vb = (b[orden.clave] ?? -1) as number;
      return orden.desc ? vb - va : va - vb;
    });
  }, [filtrados, corte, orden]);

  function cambiarOrden(clave: ColumnaOrden) {
    setOrden((prev) => (prev?.clave === clave ? { clave, desc: !prev.desc } : { clave, desc: true }));
  }

  function limpiarFiltros() {
    setFFuente(''); setFMes(''); setFDia(''); setFArea(''); setFActividad(''); setFCompanerx('');
  }

  if (cargando) return <p>Cargando estadísticas...</p>;
  if (errorCarga) {
    return (
      <div className="card" style={{ borderColor: 'var(--color-acento)' }}>
        <p className="badge-acento">No se pudieron cargar los datos: {errorCarga}</p>
      </div>
    );
  }

  const tarjetas: { etiqueta: string; valor: string; nota?: string }[] = [
    { etiqueta: 'Actividades', valor: String(kpis.actividades) },
    { etiqueta: 'Si', valor: String(kpis.si) },
    { etiqueta: 'No', valor: String(kpis.no) },
    { etiqueta: 'A confirmar', valor: String(kpis.aConfirmar) },
    { etiqueta: 'Sin Respuesta', valor: String(kpis.sinRespuesta) },
    { etiqueta: 'N/A', valor: String(kpis.na) },
    { etiqueta: 'Tasa de confirmación', valor: formatPct(kpis.tasaConfirmacion), nota: 'Si / (Si + No + A confirmar + Sin Respuesta)' },
    { etiqueta: '✅', valor: String(kpis.check) },
    { etiqueta: '❌', valor: String(kpis.cross) },
    { etiqueta: 'Tasa de efectividad', valor: formatPct(kpis.tasaEfectividad), nota: '✅ / Si — puede superar 100%' },
  ];

  const select = (valor: string, onChange: (v: string) => void, opciones: [string, string][], todos: string) => (
    <select value={valor} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }}>
      <option value="">{todos}</option>
      {opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const pares = (lista: string[]): [string, string][] => lista.map((v) => [v, v]);

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ color: 'var(--color-primario)', margin: 0 }}>Estadísticas</h2>
          <button className="secundario" onClick={limpiarFiltros}>Limpiar filtros</button>
        </div>
        <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginTop: '1rem' }}>
          {select(fFuente, (v) => setFFuente(v as '' | Fuente), [['historico', 'Histórico (Ene-Jul, planilla)'], ['sistema', 'Sistema (app)']], 'Todas las fuentes')}
          {select(fMes, setFMes, pares(opciones.meses), 'Todos los meses')}
          {select(fDia, setFDia, pares(opciones.dias), 'Todos los días')}
          {select(fArea, setFArea, pares(opciones.areas), 'Todas las áreas')}
          {select(fActividad, setFActividad, opciones.actividades, 'Todas las actividades')}
          {select(fCompanerx, setFCompanerx, pares(opciones.companerxs), 'Todxs lxs compañerxs')}
        </div>
      </div>

      <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className="card superficie" style={{ padding: '0.8rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#555', margin: 0 }}>{t.etiqueta}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primario)', margin: 0 }}>{t.valor}</p>
            {t.nota && <p style={{ fontSize: '0.7rem', color: '#777', margin: 0 }}>{t.nota}</p>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h3 style={{ color: 'var(--color-primario)', margin: 0 }}>Ver por</h3>
          <select value={corte} onChange={(e) => { setCorte(e.target.value as Corte); setOrden(null); }}>
            {CORTES.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
          </select>
          <span style={{ fontSize: '0.8rem', color: '#777' }}>{filasCorte.length} filas · clic en un encabezado para ordenar</span>
        </div>

        {corte === 'horario' && (
          <p style={{ fontSize: '0.8rem', color: '#777' }}>
            Solo respuestas del sistema con horario de llegada cargado (el histórico no tiene ese dato). La tasa de
            confirmación ronda el 100% por construcción: el horario se carga casi siempre junto con un "Si".
          </p>
        )}

        {filasCorte.length > 0 && filasCorte.length <= MAX_FILAS_GRAFICO && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filasCorte} margin={{ top: 8, right: 8, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grupo" angle={-30} textAnchor="end" interval={0} height={70} fontSize={12} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="si" name="Si" stackId="a" fill={COLORES.Si} />
              <Bar dataKey="no" name="No" stackId="a" fill={COLORES.No} />
              <Bar dataKey="aConfirmar" name="A confirmar" stackId="a" fill={COLORES['A confirmar']} />
              <Bar dataKey="sinRespuesta" name="Sin Respuesta" stackId="a" fill={COLORES['Sin Respuesta']} />
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="tabla-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                <th style={{ padding: '0.3rem' }}>{CORTES.find((c) => c.valor === corte)?.etiqueta}</th>
                {COLUMNAS.map((c) => (
                  <th key={c.clave} onClick={() => cambiarOrden(c.clave)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {c.etiqueta}{orden?.clave === c.clave ? (orden.desc ? ' ▼' : ' ▲') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasCorte.map((f) => (
                <tr key={f.grupo} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                  <td style={{ padding: '0.3rem' }}>{f.grupo}</td>
                  {COLUMNAS.map((c) => (
                    <td key={c.clave}>{c.pct ? formatPct(f[c.clave] as number | null) : String(f[c.clave])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(fCompanerx || fActividad) && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ color: 'var(--color-primario)', marginTop: 0 }}>
            {fActividad ? 'Personas de la actividad' : `Actividades de ${fCompanerx}`}
          </h3>
          <div className="tabla-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                  <th style={{ padding: '0.3rem' }}>{fActividad ? 'Compañerx' : 'Actividad'}</th>
                  <th>{fActividad ? 'Área' : 'Mes'}</th>
                  <th>Respuesta</th>
                  <th>Asistencia</th>
                  <th>Horario</th>
                  <th>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i) => (
                  <tr key={`${r.actividadKey}-${r.companerx}-${i}`} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                    <td style={{ padding: '0.3rem' }}>{fActividad ? r.companerx : r.actividadLabel}</td>
                    <td style={{ color: '#777' }}>{fActividad ? r.area ?? '—' : r.mes ?? '—'}</td>
                    <td>{r.respuesta}</td>
                    <td>{[r.check ? '✅' : '', r.cross ? '❌' : ''].join(' ').trim()}</td>
                    <td style={{ color: '#777' }}>
                      {[r.horaLlegada && `desde ${r.horaLlegada}`, r.horaSalida && `hasta ${r.horaSalida}`].filter(Boolean).join('; ')}
                    </td>
                    <td style={{ color: '#555' }}>{r.comentario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card superficie" style={{ fontSize: '0.8rem', color: '#555' }}>
        <strong>Notas de lectura.</strong> El histórico (Ene-Jul) es una foto fija de las solapas cargadas a mano; el
        sistema se recalcula con cada respuesta nueva. En el histórico, ✅/❌ salen del comentario, así que la
        efectividad de esos meses puede estar subestimada. La tasa de efectividad puede superar 100% porque ✅ marca a
        quien asistió, haya confirmado o no. El área es la de la persona, no la de la actividad. Enero no tiene área
        registrada. 5 actividades históricas no tienen día de semana determinable.
      </div>
    </div>
  );
}
