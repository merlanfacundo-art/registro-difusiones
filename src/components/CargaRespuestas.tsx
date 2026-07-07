import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Companerx, RespuestaValor } from '../types';

const OPCIONES_RESPUESTA: RespuestaValor[] = ['Si', 'No', 'A confirmar', 'N/A', 'Sin Respuesta'];

interface FilaCarga {
  respuesta: RespuestaValor | '';
  comentario: string;
}

export function CargaRespuestas() {
  const { usuario } = useAuth();
  const [companerxs, setCompanerxs] = useState<Companerx[]>([]);
  const [actividad, setActividad] = useState('');
  const [area, setArea] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [filas, setFilas] = useState<Record<string, FilaCarga>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/companerxs')
      .then((r) => r.json())
      .then((data: Companerx[]) => setCompanerxs(data.filter((c) => c.activo)));
  }, []);

  function actualizarFila(nombre: string, cambios: Partial<FilaCarga>) {
    setFilas((prev) => ({
      ...prev,
      [nombre]: { respuesta: prev[nombre]?.respuesta ?? '', comentario: prev[nombre]?.comentario ?? '', ...cambios },
    }));
  }

  async function guardarTodo() {
    if (!actividad || !fecha || !hora) {
      setMensaje('Completá actividad, fecha y hora antes de guardar.');
      return;
    }
    setGuardando(true);
    setMensaje(null);
    const pendientes = Object.entries(filas).filter(([, f]) => f.respuesta !== '');

    for (const [compañerx, f] of pendientes) {
      await fetch('/api/respuestas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compañerx,
          actividad,
          área: area,
          fecha,
          hora,
          respuesta: f.respuesta,
          comentario: f.comentario,
          cargado_por: usuario?.email,
        }),
      });
    }

    setGuardando(false);
    setMensaje(`Se guardaron ${pendientes.length} respuestas.`);
    setFilas({});
  }

  return (
    <div className="card">
      <h2 style={{ color: 'var(--color-primario)' }}>Cargar respuestas de una actividad</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <input placeholder="Nombre de la actividad" value={actividad} onChange={(e) => setActividad(e.target.value)} />
        <input placeholder="Área (opcional)" value={area} onChange={(e) => setArea(e.target.value)} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
            <th style={{ padding: '0.4rem' }}>Compañerx</th>
            <th>Área</th>
            <th>Respuesta</th>
            <th>Comentario</th>
          </tr>
        </thead>
        <tbody>
          {companerxs.map((c) => (
            <tr key={c.nombre} style={{ borderBottom: '1px solid var(--color-borde)' }}>
              <td style={{ padding: '0.4rem' }}>{c.nombre}</td>
              <td style={{ color: '#777', fontSize: '0.85rem' }}>{c.area}</td>
              <td>
                <select
                  value={filas[c.nombre]?.respuesta ?? ''}
                  onChange={(e) => actualizarFila(c.nombre, { respuesta: e.target.value as RespuestaValor })}
                >
                  <option value="">—</option>
                  {OPCIONES_RESPUESTA.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  value={filas[c.nombre]?.comentario ?? ''}
                  onChange={(e) => actualizarFila(c.nombre, { comentario: e.target.value })}
                  placeholder="opcional"
                  style={{ width: '100%' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={guardarTodo} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar respuestas'}
        </button>
        {mensaje && <span className="badge-exito">{mensaje}</span>}
      </div>
    </div>
  );
}
