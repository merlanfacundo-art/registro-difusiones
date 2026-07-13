import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Actividad, Respuesta } from '../types';

type RespuestaConFila = Respuesta & { _fila: number };

const COLOR_SI = '#2E7D32';
const COLOR_NO = '#E32622';
const COLOR_A_CONFIRMAR = '#1A9DD7';
const COLOR_SIN_RESPUESTA = '#9AA0A6';

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function Resumen() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [respuestas, setRespuestas] = useState<RespuestaConFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [fArea, setFArea] = useState('');
  const [fIdActividad, setFIdActividad] = useState('');
  const [fCompanerx, setFCompanerx] = useState('');

  useEffect(() => {
    async function cargarTodo() {
      try {
        const [rActividades, rRespuestas] = await Promise.all([
          fetch('/api/actividades'),
          fetch('/api/respuestas'),
        ]);
        for (const r of [rActividades, rRespuestas]) {
          if (!r.ok) {
            const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
            throw new Error(data.error ?? `Error HTTP ${r.status}`);
          }
        }
        setActividades(await rActividades.json());
        setRespuestas(await rRespuestas.json());
      } catch (e) {
        setErrorCarga(e instanceof Error ? e.message : 'Error desconocido al cargar datos');
      } finally {
        setCargando(false);
      }
    }
    cargarTodo();
  }, []);

  const areas = useMemo(() => [...new Set(respuestas.map((r) => r.área))].filter(Boolean).sort(), [respuestas]);
  const companerxsOpciones = useMemo(() => [...new Set(respuestas.map((r) => r.compañerx))].filter(Boolean).sort(), [respuestas]);
  const actividadesOpciones = useMemo(
    () => [...actividades].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [actividades]
  );

  const filtradas = useMemo(() => {
    return respuestas.filter((r) => {
      if (fDesde && r.fecha < fDesde) return false;
      if (fHasta && r.fecha > fHasta) return false;
      if (fArea && r.área !== fArea) return false;
      if (fIdActividad && r.id_actividad !== fIdActividad) return false;
      if (fCompanerx && r.compañerx !== fCompanerx) return false;
      return true;
    });
  }, [respuestas, fDesde, fHasta, fArea, fIdActividad, fCompanerx]);

  const sinNA = useMemo(() => filtradas.filter((r) => r.respuesta !== 'N/A'), [filtradas]);

  const metricas = useMemo(() => {
    const actividadesDistintas = new Set(filtradas.map((r) => r.id_actividad)).size;
    const totalSi = sinNA.filter((r) => r.respuesta === 'Si').length;
    const totalCheck = sinNA.filter((r) => r.estado_post === '✅').length;
    return {
      actividadesDistintas,
      totalConfirmados: totalSi,
      tasaConfirmacion: sinNA.length > 0 ? totalSi / sinNA.length : 0,
      tasaEfectividad: totalSi > 0 ? totalCheck / totalSi : 0,
    };
  }, [filtradas, sinNA]);

  // Agrupa por actividad para el gráfico y la tabla-resumen (cuando no hay
  // una actividad o compañerx puntual elegido).
  const porActividad = useMemo(() => {
    const mapa = new Map<string, { id: string; nombre: string; fecha: string; Si: number; No: number; 'A confirmar': number; 'Sin Respuesta': number }>();
    filtradas.forEach((r) => {
      if (r.respuesta === 'N/A') return;
      if (!mapa.has(r.id_actividad)) {
        mapa.set(r.id_actividad, { id: r.id_actividad, nombre: r.actividad, fecha: r.fecha, Si: 0, No: 0, 'A confirmar': 0, 'Sin Respuesta': 0 });
      }
      const g = mapa.get(r.id_actividad)!;
      if (r.respuesta === 'Si' || r.respuesta === 'No' || r.respuesta === 'A confirmar' || r.respuesta === 'Sin Respuesta') {
        g[r.respuesta]++;
      }
    });
    return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filtradas]);

  const vistaCompanerx = Boolean(fCompanerx) && !fIdActividad;
  const vistaActividad = Boolean(fIdActividad);
  const vistaResumenPorActividad = !vistaCompanerx && !vistaActividad;

  if (cargando) return <p>Cargando...</p>;
  if (errorCarga) {
    return (
      <div className="card" style={{ borderColor: 'var(--color-acento)' }}>
        <p className="badge-acento">No se pudieron cargar los datos: {errorCarga}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--color-primario)', marginTop: 0 }}>Resumen / Estadísticas</h2>

        <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>Desde</label>
            <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>Hasta</label>
            <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>Área</label>
            <select value={fArea} onChange={(e) => setFArea(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>Actividad</label>
            <select value={fIdActividad} onChange={(e) => setFIdActividad(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todas</option>
              {actividadesOpciones.map((a) => (
                <option key={a.id_actividad} value={a.id_actividad}>{a.nombre} — {a.fecha}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>Compañerx</label>
            <select value={fCompanerx} onChange={(e) => setFCompanerx(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todxs</option>
              {companerxsOpciones.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card superficie">
          <p style={{ fontSize: '0.8rem', color: '#555', margin: 0 }}>Actividades</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', margin: 0 }}>{metricas.actividadesDistintas}</p>
        </div>
        <div className="card superficie">
          <p style={{ fontSize: '0.8rem', color: '#555', margin: 0 }}>Confirmados (Si)</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', margin: 0 }}>{metricas.totalConfirmados}</p>
        </div>
        <div className="card superficie">
          <p style={{ fontSize: '0.8rem', color: '#555', margin: 0 }}>Tasa de confirmación</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', margin: 0 }}>{formatPct(metricas.tasaConfirmacion)}</p>
        </div>
        <div className="card superficie">
          <p style={{ fontSize: '0.8rem', color: '#555', margin: 0 }}>
            Tasa de efectividad
          </p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', margin: 0 }}>{formatPct(metricas.tasaEfectividad)}</p>
          <p style={{ fontSize: '0.75rem', color: '#777', margin: 0 }}>de quienes confirmaron, % que realmente fue (✅)</p>
        </div>
      </div>

      {porActividad.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-primario)', marginTop: 0 }}>Respuestas por actividad</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={porActividad} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" angle={-30} textAnchor="end" interval={0} height={80} fontSize={12} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Si" stackId="a" fill={COLOR_SI} />
              <Bar dataKey="No" stackId="a" fill={COLOR_NO} />
              <Bar dataKey="A confirmar" stackId="a" fill={COLOR_A_CONFIRMAR} />
              <Bar dataKey="Sin Respuesta" stackId="a" fill={COLOR_SIN_RESPUESTA} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h3 style={{ color: 'var(--color-primario)', marginTop: 0 }}>
          {vistaActividad && 'Detalle de la actividad'}
          {vistaCompanerx && `Historial de ${fCompanerx}`}
          {vistaResumenPorActividad && 'Resumen por actividad'}
        </h3>

        <div className="tabla-scroll">
          {vistaActividad && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                  <th style={{ padding: '0.3rem' }}>Compañerx</th>
                  <th>Área</th>
                  <th>Respuesta</th>
                  <th>Comentario</th>
                  <th>Estado post</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r._fila} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                    <td style={{ padding: '0.3rem' }}>{r.compañerx}</td>
                    <td style={{ color: '#777' }}>{r.área}</td>
                    <td>{r.respuesta}</td>
                    <td style={{ color: '#555' }}>{r.comentario}</td>
                    <td>{r.estado_post}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {vistaCompanerx && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                  <th style={{ padding: '0.3rem' }}>Actividad</th>
                  <th>Fecha</th>
                  <th>Respuesta</th>
                  <th>Comentario</th>
                  <th>Estado post</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r._fila} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                    <td style={{ padding: '0.3rem' }}>{r.actividad}</td>
                    <td style={{ color: '#777' }}>{r.fecha}</td>
                    <td>{r.respuesta}</td>
                    <td style={{ color: '#555' }}>{r.comentario}</td>
                    <td>{r.estado_post}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {vistaResumenPorActividad && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                  <th style={{ padding: '0.3rem' }}>Actividad</th>
                  <th>Fecha</th>
                  <th>Si</th>
                  <th>No</th>
                  <th>A confirmar</th>
                  <th>Sin Respuesta</th>
                  <th>Tasa confirmación</th>
                  <th>Tasa efectividad</th>
                </tr>
              </thead>
              <tbody>
                {porActividad.map((a) => {
                  const total = a.Si + a.No + a['A confirmar'] + a['Sin Respuesta'];
                  const checks = filtradas.filter((r) => r.id_actividad === a.id && r.estado_post === '✅').length;
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                      <td style={{ padding: '0.3rem' }}>{a.nombre}</td>
                      <td style={{ color: '#777' }}>{a.fecha}</td>
                      <td>{a.Si}</td>
                      <td>{a.No}</td>
                      <td>{a['A confirmar']}</td>
                      <td>{a['Sin Respuesta']}</td>
                      <td>{total > 0 ? formatPct(a.Si / total) : '—'}</td>
                      <td>{a.Si > 0 ? formatPct(checks / a.Si) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
