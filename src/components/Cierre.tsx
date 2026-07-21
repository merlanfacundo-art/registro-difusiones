import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { actividadVigente } from '../types';
import type { Actividad, EstadoPost, Respuesta } from '../types';

type RespuestaConFila = Respuesta & { _fila: number };

export function Cierre() {
  const { usuario } = useAuth();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [respuestas, setRespuestas] = useState<RespuestaConFila[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [idActividad, setIdActividad] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  // Ediciones pendientes: fila -> nuevo estado_post, hasta que se guarden
  const [cambios, setCambios] = useState<Record<number, EstadoPost>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

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

  // Cierre trabaja sobre actividades que YA PASARON — lo opuesto de Carga,
  // que solo muestra vigentes. Ordenadas de la más reciente a la más vieja,
  // así lo más urgente de cerrar queda arriba.
  const actividadesPasadas = useMemo(
    () => actividades.filter((a) => !actividadVigente(a)).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [actividades]
  );

  const filasDeLaActividad = useMemo(
    () => respuestas.filter((r) => r.id_actividad === idActividad && (!filtroArea || r.área === filtroArea)),
    [respuestas, idActividad, filtroArea]
  );

  // Áreas disponibles para filtrar: solo las presentes en la actividad
  // elegida, así no aparecen opciones vacías sin sentido para esa actividad.
  const areasDeLaActividad = useMemo(
    () => [...new Set(respuestas.filter((r) => r.id_actividad === idActividad).map((r) => r.área))].filter(Boolean).sort(),
    [respuestas, idActividad]
  );

  function cambiarEstado(fila: number, valor: EstadoPost) {
    setCambios((prev) => ({ ...prev, [fila]: valor }));
  }

  async function guardarCambios() {
    const entradas = Object.entries(cambios);
    if (entradas.length === 0) {
      setMensaje('No hay cambios para guardar.');
      return;
    }
    setGuardando(true);
    setMensaje(null);
    setErrores([]);

    const erroresNuevos: string[] = [];
    let exitosos = 0;

    for (const [filaStr, estado_post] of entradas) {
      try {
        const res = await fetch(`/api/respuestas?fila=${filaStr}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado_post, actor_email: usuario?.email }),
        });
        if (res.ok) {
          exitosos++;
        } else {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          erroresNuevos.push(`Fila ${filaStr}: ${data.error ?? 'error desconocido'}`);
        }
      } catch {
        erroresNuevos.push(`Fila ${filaStr}: fallo de red`);
      }
    }

    setGuardando(false);
    setErrores(erroresNuevos);
    setMensaje(exitosos > 0 ? `Se guardaron ${exitosos} de ${entradas.length} cambios.` : null);

    if (erroresNuevos.length === 0) {
      setCambios({});
      const actualizado = await fetch('/api/respuestas').then((r) => r.json());
      setRespuestas(actualizado);
    }
  }

  if (cargando) return <p>Cargando...</p>;
  if (errorCarga) {
    return (
      <div className="card" style={{ borderColor: 'var(--color-acento)' }}>
        <p className="badge-acento">No se pudieron cargar los datos: {errorCarga}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ color: 'var(--color-primario)' }}>Cierre post-actividad</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Marcá ✅ para quien confirmó y participó, o ❌ para quien confirmó y no fue —
        independientemente de qué haya respondido originalmente.
      </p>

      <div style={{ marginBottom: '1rem', maxWidth: 420 }}>
        <label style={{ fontSize: '0.85rem', color: '#555' }}>Actividad (ya realizadas)</label>
        <select value={idActividad} onChange={(e) => { setIdActividad(e.target.value); setCambios({}); setFiltroArea(''); }} style={{ width: '100%' }}>
          <option value="">Elegí una actividad</option>
          {actividadesPasadas.map((a) => (
            <option key={a.id_actividad} value={a.id_actividad}>
              {a.nombre} — {a.fecha} {a.hora}
            </option>
          ))}
        </select>
        {actividadesPasadas.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: '#777' }}>Todavía no hay actividades que ya hayan pasado.</p>
        )}
      </div>

      {idActividad && (
        <>
          {areasDeLaActividad.length > 1 && (
            <div style={{ marginBottom: '1rem', maxWidth: 300 }}>
              <label style={{ fontSize: '0.85rem', color: '#555' }}>Filtrar por área</label>
              <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={{ width: '100%' }}>
                <option value="">Todas las áreas</option>
                {areasDeLaActividad.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          <div className="tabla-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                  <th style={{ padding: '0.3rem' }}>Compañerx</th>
                  <th>Respuesta original</th>
                  <th>Estado post</th>
                </tr>
              </thead>
              <tbody>
                {filasDeLaActividad.map((r) => (
                  <tr key={r._fila} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                    <td style={{ padding: '0.3rem' }}>{r.compañerx}</td>
                    <td style={{ color: '#777' }}>{r.respuesta}</td>
                    <td>
                      <select
                        value={cambios[r._fila] ?? r.estado_post ?? ''}
                        onChange={(e) => cambiarEstado(r._fila, e.target.value as EstadoPost)}
                      >
                        <option value="">—</option>
                        <option value="✅">✅</option>
                        <option value="❌">❌</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={guardarCambios} disabled={guardando} style={{ marginTop: '1rem' }}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </>
      )}

      {mensaje && <p className="badge-exito" style={{ marginTop: '0.75rem' }}>{mensaje}</p>}
      {errores.length > 0 && (
        <div className="card" style={{ marginTop: '0.75rem', borderColor: 'var(--color-acento)' }}>
          <p className="badge-acento" style={{ margin: 0 }}>No se guardaron {errores.length} cambio(s):</p>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
            {errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
