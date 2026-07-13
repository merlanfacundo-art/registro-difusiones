import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { puedeEscribir } from '../types';
import type { Actividad } from '../types';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function Resumen() {
  const { usuario } = useAuth();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(''); // "yyyy-mm"
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/actividades')
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(data.error ?? `Error HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setActividades)
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'Error desconocido'));
  }, []);

  // Meses disponibles: derivados de las fechas reales de actividades existentes,
  // así el selector solo ofrece meses que tienen algo para resumir.
  const periodosDisponibles = useMemo(() => {
    const set = new Set(actividades.map((a) => a.fecha.slice(0, 7)));
    return [...set].sort().reverse();
  }, [actividades]);

  async function generar() {
    if (!periodo) {
      setError('Elegí un mes.');
      return;
    }
    const [anio, mes] = periodo.split('-').map(Number);
    setGenerando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch('/api/resumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, actor_email: usuario?.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error desconocido');
      } else if (data.actividades === 0) {
        setResultado('No hay actividades cargadas para ese mes.');
      } else {
        setResultado(
          `Listo: hoja "${data.hoja}" actualizada con ${data.actividades} actividades y ${data.companerxs} compañerxs.`
        );
      }
    } catch {
      setError('Fallo de red al generar el resumen.');
    } finally {
      setGenerando(false);
    }
  }

  if (errorCarga) {
    return (
      <div className="card" style={{ borderColor: 'var(--color-acento)' }}>
        <p className="badge-acento">No se pudieron cargar las actividades: {errorCarga}</p>
      </div>
    );
  }

  if (usuario && !puedeEscribir(usuario)) {
    return (
      <div className="card superficie">
        <h2 style={{ color: 'var(--color-primario)' }}>Resumen mensual</h2>
        <p style={{ color: '#555' }}>Tu rol no tiene permiso para generar el resumen. Consultá con el equipo de Organización.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ color: 'var(--color-primario)' }}>Resumen mensual</h2>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>
        Genera (o regenera) una solapa nueva en la planilla, tipo "Julio (auto)", con la vista
        tradicional de compañerxs × actividades del mes elegido. Nunca toca las solapas cargadas
        a mano.
      </p>

      <label style={{ fontSize: '0.85rem', color: '#555' }}>Mes</label>
      <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ width: '100%', marginBottom: '0.75rem' }}>
        <option value="">Elegí un mes</option>
        {periodosDisponibles.map((p) => {
          const [anio, mes] = p.split('-').map(Number);
          return <option key={p} value={p}>{MESES[mes - 1]} {anio}</option>;
        })}
      </select>

      <button onClick={generar} disabled={generando} style={{ width: '100%' }}>
        {generando ? 'Generando...' : 'Generar / actualizar resumen'}
      </button>

      {resultado && <p className="badge-exito" style={{ marginTop: '0.75rem' }}>{resultado}</p>}
      {error && <p className="badge-acento" style={{ marginTop: '0.75rem' }}>{error}</p>}
    </div>
  );
}
