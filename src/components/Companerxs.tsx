import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Companerx } from '../types';

async function enviar(method: string, body: unknown) {
  const res = await fetch('/api/companerxs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error HTTP ${res.status}`);
  return data;
}

export function Companerxs() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<Companerx[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('');
  const [areaNueva, setAreaNueva] = useState('');
  const [filtro, setFiltro] = useState<'activxs' | 'inactivxs' | 'todxs'>('activxs');
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch('/api/companerxs');
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      setLista(await res.json());
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error desconocido');
    }
  }
  useEffect(() => { cargar(); }, []);

  const areas = useMemo(() => [...new Set(lista.map((c) => c.area).filter(Boolean))].sort(), [lista]);
  const visibles = useMemo(() => lista
    .filter((c) => filtro === 'todxs' || (filtro === 'activxs' ? c.activo : !c.activo))
    .filter((c) => !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)), [lista, filtro, busqueda]);

  async function alta(e: FormEvent) {
    e.preventDefault();
    const areaFinal = area === '__nueva' ? areaNueva.trim() : area;
    if (!nombre.trim() || !areaFinal) { setError('Completá nombre y área.'); return; }
    setOcupado(true); setMensaje(null); setError(null);
    try {
      const r = await enviar('POST', { nombre, area: areaFinal, actor_email: usuario?.email });
      setMensaje(`${nombre.trim()} dadx de alta. Se agregó como "Sin Respuesta" en ${r.respuestas_generadas} actividad(es) vigente(s).`);
      setNombre(''); setArea(''); setAreaNueva('');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setOcupado(false);
    }
  }

  async function cambiar(c: Companerx, accion: 'baja' | 'alta') {
    const texto = accion === 'baja'
      ? `¿Dar de baja a ${c.nombre}?\n\nQueda inactivx. En las actividades vigentes, sus "Sin Respuesta" pasan a N/A. Las actividades pasadas no se tocan.`
      : `¿Reactivar a ${c.nombre}?\n\nVuelve a activx. Los N/A que puso la baja vuelven a "Sin Respuesta" y se agrega en las actividades vigentes que le falten.`;
    if (!window.confirm(texto)) return;
    setOcupado(true); setMensaje(null); setError(null);
    try {
      const r = await enviar('PATCH', { nombre: c.nombre, accion, actor_email: usuario?.email });
      setMensaje(accion === 'baja'
        ? `${c.nombre} dadx de baja (${r.pasadas_a_na} respuesta(s) vigente(s) pasadas a N/A).`
        : `${c.nombre} reactivadx (${r.revertidas} revertida(s), ${r.respuestas_generadas} agregada(s)).`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setOcupado(false);
    }
  }

  if (errorCarga) return <div className="card"><p className="badge-acento">No se pudo cargar la lista: {errorCarga}</p></div>;

  return (
    <div>
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.25rem' }}>
        <h2 style={{ color: 'var(--color-primario)', marginTop: 0 }}>Alta de compañerx</h2>
        <form onSubmit={alta} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input placeholder="Nombre (como figura en las convocatorias)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Elegí un área</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="__nueva">Otra área (nueva)</option>
          </select>
          {area === '__nueva' && <input placeholder="Nombre del área nueva" value={areaNueva} onChange={(e) => setAreaNueva(e.target.value)} />}
          <p style={{ fontSize: '0.8rem', color: '#777', margin: 0 }}>
            El nombre identifica a la persona en todo el sistema: tiene que ser único y no se puede cambiar desde la app.
            Si alguien estuvo y se fue, buscalx en "Inactivxs" y reactivalx en vez de darlx de alta de nuevo.
          </p>
          <button type="submit" disabled={ocupado}>{ocupado ? 'Guardando...' : 'Dar de alta'}</button>
          {mensaje && <p className="badge-exito" style={{ margin: 0 }}>{mensaje}</p>}
          {error && <p className="badge-acento" style={{ margin: 0 }}>{error}</p>}
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h3 style={{ color: 'var(--color-primario)', margin: 0 }}>Compañerxs</h3>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="activxs">Activxs</option>
            <option value="inactivxs">Inactivxs</option>
            <option value="todxs">Todxs</option>
          </select>
          <input placeholder="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <span style={{ fontSize: '0.8rem', color: '#777' }}>{visibles.length} personas</span>
        </div>
        <div className="tabla-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                <th style={{ padding: '0.3rem' }}>Nombre</th><th>Área</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.nombre} style={{ borderBottom: '1px solid var(--color-borde)', opacity: c.activo ? 1 : 0.6 }}>
                  <td style={{ padding: '0.3rem' }}>{c.nombre}</td>
                  <td style={{ color: '#777' }}>{c.area}</td>
                  <td className={c.activo ? 'badge-exito' : 'badge-acento'}>{c.activo ? 'Activx' : 'Inactivx'}</td>
                  <td>
                    <button className="secundario" style={{ padding: '0.25rem 0.6rem' }} disabled={ocupado}
                      onClick={() => cambiar(c, c.activo ? 'baja' : 'alta')}>
                      {c.activo ? 'Dar de baja' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
