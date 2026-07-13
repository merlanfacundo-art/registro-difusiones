import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { actividadVigente, horarioValido } from '../types';
import type { Companerx, RespuestaValor, Actividad } from '../types';

const OPCIONES_RESPUESTA: RespuestaValor[] = ['Si', 'No', 'A confirmar', 'N/A', 'Sin Respuesta'];

interface RespuestaExistente {
  _fila: number;
  respuesta: RespuestaValor | '';
  comentario: string;
  horario_llegada: string;
  horario_salida: string;
}

export function CargaRespuestas() {
  const { usuario } = useAuth();
  const [companerxs, setCompanerxs] = useState<Companerx[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [respuestasExistentes, setRespuestasExistentes] = useState<
    { id_actividad: string; compañerx: string; _fila: number; respuesta: string; comentario: string; horario_llegada: string; horario_salida: string }[]
  >([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [idActividad, setIdActividad] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [compañerx, setCompañerx] = useState('');
  const [respuesta, setRespuesta] = useState<RespuestaValor | ''>('');
  const [comentario, setComentario] = useState('');
  const [horarioLlegada, setHorarioLlegada] = useState('');
  const [horarioSalida, setHorarioSalida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    async function cargarTodo() {
      try {
        const [rCompanerxs, rActividades, rRespuestas] = await Promise.all([
          fetch('/api/companerxs'),
          fetch('/api/actividades'),
          fetch('/api/respuestas'),
        ]);
        for (const r of [rCompanerxs, rActividades, rRespuestas]) {
          if (!r.ok) {
            const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
            throw new Error(data.error ?? `Error HTTP ${r.status}`);
          }
        }
        const [dCompanerxs, dActividades, dRespuestas] = await Promise.all([
          rCompanerxs.json(),
          rActividades.json(),
          rRespuestas.json(),
        ]);
        setCompanerxs(dCompanerxs.filter((c: Companerx) => c.activo));
        setActividades(dActividades);
        setRespuestasExistentes(dRespuestas);
      } catch (e) {
        setErrorCarga(e instanceof Error ? e.message : 'Error desconocido al cargar datos');
      }
    }
    cargarTodo();
  }, []);

  // Solo actividades vigentes (todavía no empezaron) pueden recibir carga/edición.
  const actividadesVigentes = useMemo(
    () => actividades.filter((a) => actividadVigente(a)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [actividades]
  );

  const actividadElegida = actividades.find((a) => a.id_actividad === idActividad);

  const areas = useMemo(() => [...new Set(companerxs.map((c) => c.area))].filter(Boolean).sort(), [companerxs]);

  const companerxsFiltrados = useMemo(
    () => companerxs.filter((c) => !filtroArea || c.area === filtroArea),
    [companerxs, filtroArea]
  );

  // Al elegir actividad + compañerx, busca si ya existe una respuesta para
  // ese par exacto (por id_actividad, no por nombre) y precarga sus valores.
  // Con la materialización automática de "Sin Respuesta" al crear la
  // actividad, esto casi siempre va a encontrar algo — el fallback de
  // creación sigue existiendo solo para compañerxs dados de alta después.
  const existente = useMemo((): RespuestaExistente | null => {
    if (!idActividad || !compañerx) return null;
    const fila = respuestasExistentes.find(
      (r) => r.id_actividad === idActividad && r.compañerx === compañerx
    );
    if (!fila) return null;
    return {
      _fila: fila._fila,
      respuesta: fila.respuesta as RespuestaValor,
      comentario: fila.comentario,
      horario_llegada: fila.horario_llegada || '',
      horario_salida: fila.horario_salida || '',
    };
  }, [idActividad, compañerx, respuestasExistentes]);

  useEffect(() => {
    if (existente) {
      setRespuesta(existente.respuesta);
      setComentario(existente.comentario);
      setHorarioLlegada(existente.horario_llegada);
      setHorarioSalida(existente.horario_salida);
    } else {
      setRespuesta('');
      setComentario('');
      setHorarioLlegada('');
      setHorarioSalida('');
    }
  }, [existente]);

  const erroresHorario = useMemo(() => {
    if (!actividadElegida) return [];
    const errores: string[] = [];
    if (!horarioValido(horarioLlegada, actividadElegida)) {
      errores.push(
        actividadElegida.hora_fin
          ? `El horario de llegada debe estar entre ${actividadElegida.hora} y ${actividadElegida.hora_fin}.`
          : `El horario de llegada debe ser ${actividadElegida.hora} o posterior.`
      );
    }
    if (!horarioValido(horarioSalida, actividadElegida)) {
      errores.push(
        actividadElegida.hora_fin
          ? `El horario de salida debe estar entre ${actividadElegida.hora} y ${actividadElegida.hora_fin}.`
          : `El horario de salida debe ser ${actividadElegida.hora} o posterior.`
      );
    }
    return errores;
  }, [horarioLlegada, horarioSalida, actividadElegida]);

  async function guardar() {
    if (!idActividad || !compañerx || !respuesta) {
      setMensaje('Elegí actividad, compañerx y respuesta antes de guardar.');
      return;
    }
    if (erroresHorario.length > 0) {
      setMensaje('Corregí los horarios antes de guardar.');
      return;
    }
    setGuardando(true);
    setMensaje(null);
    setErrorGuardado(null);

    const área = companerxs.find((c) => c.nombre === compañerx)?.area ?? '';

    try {
      let res: Response;
      if (existente) {
        res = await fetch(`/api/respuestas?fila=${existente._fila}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            respuesta,
            comentario,
            horario_llegada: horarioLlegada,
            horario_salida: horarioSalida,
            actor_email: usuario?.email,
          }),
        });
      } else {
        res = await fetch('/api/respuestas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_actividad: idActividad,
            compañerx,
            actividad: actividadElegida?.nombre,
            área,
            fecha: actividadElegida?.fecha,
            hora: actividadElegida?.hora,
            respuesta,
            comentario,
            horario_llegada: horarioLlegada,
            horario_salida: horarioSalida,
            cargado_por: usuario?.email,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setErrorGuardado(data.error ?? 'Error desconocido');
      } else {
        setMensaje(existente ? 'Respuesta actualizada.' : 'Respuesta guardada.');
        const actualizado = await fetch('/api/respuestas').then((r) => r.json());
        setRespuestasExistentes(actualizado);
      }
    } catch {
      setErrorGuardado('Fallo de red al guardar.');
    } finally {
      setGuardando(false);
    }
  }

  if (errorCarga) {
    return (
      <div className="card" style={{ borderColor: 'var(--color-acento)' }}>
        <p className="badge-acento">No se pudieron cargar los datos: {errorCarga}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ color: 'var(--color-primario)' }}>Cargar / modificar respuesta</h2>

      <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.85rem', color: '#555' }}>Actividad (vigentes)</label>
          <select value={idActividad} onChange={(e) => setIdActividad(e.target.value)} style={{ width: '100%' }}>
            <option value="">Elegí una actividad</option>
            {actividadesVigentes.map((a) => (
              <option key={a.id_actividad} value={a.id_actividad}>
                {a.nombre} — {a.fecha} {a.hora}
              </option>
            ))}
          </select>
          {actividadesVigentes.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#777' }}>
              No hay actividades vigentes. Creá una en "Nueva actividad".
            </p>
          )}
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', color: '#555' }}>Filtrar por área</label>
          <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={{ width: '100%' }}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.85rem', color: '#555' }}>Compañerx</label>
        <select value={compañerx} onChange={(e) => setCompañerx(e.target.value)} style={{ width: '100%' }}>
          <option value="">Elegí un compañerx</option>
          {companerxsFiltrados.map((c) => (
            <option key={c.nombre} value={c.nombre}>{c.nombre} ({c.area})</option>
          ))}
        </select>
      </div>

      {idActividad && compañerx && (
        <>
          {existente && (
            <p className="badge-exito" style={{ fontSize: '0.85rem' }}>
              Ya existe una respuesta para este par — se va a actualizar, no duplicar.
            </p>
          )}
          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <select value={respuesta} onChange={(e) => setRespuesta(e.target.value as RespuestaValor)}>
              <option value="">—</option>
              {OPCIONES_RESPUESTA.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            <input
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentario (opcional)"
            />
          </div>

          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>
                Horario de llegada (opcional){actividadElegida && ` — desde ${actividadElegida.hora}`}
                {actividadElegida?.hora_fin && ` hasta ${actividadElegida.hora_fin}`}
              </label>
              <input
                type="time"
                value={horarioLlegada}
                onChange={(e) => setHorarioLlegada(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>Horario de salida (opcional)</label>
              <input
                type="time"
                value={horarioSalida}
                onChange={(e) => setHorarioSalida(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          {erroresHorario.map((e, i) => <p key={i} className="badge-acento" style={{ fontSize: '0.8rem' }}>{e}</p>)}

          <button onClick={guardar} disabled={guardando || erroresHorario.length > 0}>
            {guardando ? 'Guardando...' : existente ? 'Actualizar respuesta' : 'Guardar respuesta'}
          </button>
        </>
      )}

      {mensaje && <p className="badge-exito" style={{ marginTop: '0.75rem' }}>{mensaje}</p>}
      {errorGuardado && <p className="badge-acento" style={{ marginTop: '0.75rem' }}>{errorGuardado}</p>}
    </div>
  );
}
