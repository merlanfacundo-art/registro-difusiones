import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

export function AltaActividad() {
  const { usuario } = useAuth();
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [area, setArea] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre || !fecha || !hora) {
      setError('Completá nombre, fecha y hora.');
      return;
    }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch('/api/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, fecha, hora, área: area, creada_por: usuario?.email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(data.error ?? 'Error desconocido');
      } else {
        setMensaje(`Actividad "${nombre}" creada. Ya está disponible para cargar respuestas.`);
        setNombre('');
        setFecha('');
        setHora('');
        setArea('');
      }
    } catch {
      setError('Fallo de red al guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ color: 'var(--color-primario)' }}>Nueva actividad</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input placeholder="Nombre de la actividad" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        <input placeholder="Área (opcional)" value={area} onChange={(e) => setArea(e.target.value)} />
        <button type="submit" disabled={guardando}>{guardando ? 'Creando...' : 'Crear actividad'}</button>
        {mensaje && <p className="badge-exito">{mensaje}</p>}
        {error && <p className="badge-acento">{error}</p>}
      </form>
    </div>
  );
}
