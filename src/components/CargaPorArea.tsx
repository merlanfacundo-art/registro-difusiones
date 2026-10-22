import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Actividad, Companerx, RespuestaValor } from '../types';

const OPCIONES: RespuestaValor[] = ['N/A', 'Sin Respuesta', 'Si', 'No', 'A confirmar'];

interface Props {
  actividades: Actividad[]; // ya filtradas: activas y vigentes
  companerxs: Companerx[]; // activxs
  respuestas: { id_actividad: string; compañerx: string; respuesta: string }[];
  onGuardado: () => void;
}

// Asigna la misma respuesta a todxs lxs activxs de las áreas elegidas.
// Caso típico: actividad solo para Educación -> N/A para el resto de las áreas.
export function CargaPorArea({ actividades, companerxs, respuestas, onGuardado }: Props) {
  const { usuario } = useAuth();
  const [idActividad, setIdActividad] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [respuesta, setRespuesta] = useState<RespuestaValor>('N/A');
  const [pisar, setPisar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todasLasAreas = useMemo(() => [...new Set(companerxs.map((c) => c.area).filter(Boolean))].sort(), [companerxs]);

  // Vista previa: a cuántas personas afectaría, con la misma regla que aplica el servidor.
  const previa = useMemo(() => {
    if (!idActividad || areas.length === 0) return null;
    const personas = companerxs.filter((c) => areas.includes(c.area));
    let afectadas = 0, protegidas = 0;
    for (const p of personas) {
      const actual = respuestas.find((r) => r.id_actividad === idActividad && r['compañerx'] === p.nombre)?.respuesta;
      if (actual === respuesta) continue;
      if (!actual || actual === 'Sin Respuesta' || pisar) afectadas++;
      else protegidas++;
    }
    return { personas: personas.length, afectadas, protegidas };
  }, [idActividad, areas, companerxs, respuestas, respuesta, pisar]);

  function alternarArea(a: string) {
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function aplicar() {
    if (!previa) return;
    const texto = `¿Asignar "${respuesta}" a ${previa.afectadas} persona(s) de ${areas.join(', ')}?` +
      (pisar ? '\n\nATENCIÓN: se van a reemplazar también respuestas ya cargadas.' : '');
    if (!window.confirm(texto)) return;
    setGuardando(true); setMensaje(null); setError(null);
    try {
      const res = await fetch('/api/respuestas-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_actividad: idActividad, areas, respuesta, pisar, actor_email: usuario?.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error HTTP ${res.status}`);
      const omit = data.omitidas?.length ? ` No se tocaron (ya tenían respuesta): ${data.omitidas.join(', ')}.` : '';
      setMensaje(`Listo: ${data.actualizadas} actualizada(s), ${data.creadas} creada(s).${omit}`);
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <h2 style={{ color: 'var(--color-primario)', marginTop: 0 }}>Carga por área</h2>
      <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <select value={idActividad} onChange={(e) => setIdActividad(e.target.value)}>
          <option value="">Elegí una actividad (vigentes)</option>
          {actividades.map((a) => <option key={a.id_actividad} value={a.id_actividad}>{a.nombre} — {a.fecha} {a.hora}</option>)}
        </select>
        <select value={respuesta} onChange={(e) => setRespuesta(e.target.value as RespuestaValor)}>
          {OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        {todasLasAreas.map((a) => (
          <label key={a}><input type="checkbox" checked={areas.includes(a)} onChange={() => alternarArea(a)} /> {a}</label>
        ))}
      </div>
      <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.75rem' }}>
        <input type="checkbox" checked={pisar} onChange={(e) => setPisar(e.target.checked)} /> Reemplazar también respuestas ya cargadas
        (por defecto solo se completan los "Sin Respuesta")
      </label>
      {previa && (
        <p style={{ fontSize: '0.85rem', color: '#555' }}>
          {previa.personas} persona(s) en las áreas elegidas · se van a modificar {previa.afectadas}
          {previa.protegidas > 0 && ` · ${previa.protegidas} quedan sin tocar porque ya tienen otra respuesta`}
        </p>
      )}
      <button onClick={aplicar} disabled={guardando || !previa || previa.afectadas === 0}>
        {guardando ? 'Aplicando...' : 'Aplicar'}
      </button>
      {mensaje && <p className="badge-exito" style={{ marginTop: '0.75rem' }}>{mensaje}</p>}
      {error && <p className="badge-acento" style={{ marginTop: '0.75rem' }}>{error}</p>}
    </div>
  );
}
