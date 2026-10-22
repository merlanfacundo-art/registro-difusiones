import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { actividadActiva, actividadVigente, type Actividad } from '../types';
import { SelectorHora } from './SelectorHora';

interface Formulario { id: string | null; nombre: string; fecha: string; hora: string; horaFin: string; area: string }
const VACIO: Formulario = { id: null, nombre: '', fecha: '', hora: '', horaFin: '', area: '' };

async function enviar(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error HTTP ${res.status}`);
  return data;
}

export function Actividades() {
  const { usuario } = useAuth();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verEliminadas, setVerEliminadas] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  async function cargar() {
    try {
      const res = await fetch('/api/actividades');
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      setActividades(await res.json());
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error desconocido');
    }
  }
  useEffect(() => { cargar(); }, []);

  const listado = useMemo(() => actividades
    .filter((a) => verEliminadas || actividadActiva(a))
    .filter((a) => !busqueda || a.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`)),
  [actividades, verEliminadas, busqueda]);

  function editar(a: Actividad) {
    setForm({ id: a.id_actividad, nombre: a.nombre, fecha: a.fecha, hora: a.hora, horaFin: a.hora_fin ?? '', area: a['área'] ?? '' });
    setMensaje(null); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.fecha || !form.hora) { setError('Completá nombre, fecha y hora de inicio.'); return; }
    setGuardando(true); setMensaje(null); setError(null);
    const datos = { nombre: form.nombre, fecha: form.fecha, hora: form.hora, hora_fin: form.horaFin, 'área': form.area };
    try {
      if (form.id) {
        const r = await enviar('/api/actividades', 'PATCH', { ...datos, id_actividad: form.id, accion: 'editar', actor_email: usuario?.email });
        const aviso = r.horarios_fuera_de_rango?.length
          ? ` Atención: quedaron horarios fuera del nuevo rango para ${r.horarios_fuera_de_rango.join(', ')}; revisalos en Cargar respuestas.`
          : '';
        setMensaje(`Actividad actualizada (${r.respuestas_actualizadas} respuestas sincronizadas).${aviso}`);
      } else {
        const r = await enviar('/api/actividades', 'POST', { ...datos, creada_por: usuario?.email });
        setMensaje(`Actividad "${form.nombre}" creada, con ${r.respuestas_generadas} respuestas en "Sin Respuesta".`);
      }
      setForm(VACIO);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(a: Actividad, accion: 'eliminar' | 'restaurar') {
    const texto = accion === 'eliminar'
      ? `¿Eliminar "${a.nombre}" (${a.fecha})?\n\nSe excluye de carga, cierre, consulta y estadísticas. Sus datos quedan en la planilla y se puede restaurar.`
      : `¿Restaurar "${a.nombre}" (${a.fecha})?`;
    if (!window.confirm(texto)) return;
    setMensaje(null); setError(null);
    try {
      await enviar('/api/actividades', 'PATCH', { id_actividad: a.id_actividad, accion, actor_email: usuario?.email });
      setMensaje(accion === 'eliminar' ? `"${a.nombre}" eliminada.` : `"${a.nombre}" restaurada.`);
      if (form.id === a.id_actividad) setForm(VACIO);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  if (errorCarga) return <div className="card"><p className="badge-acento">No se pudieron cargar las actividades: {errorCarga}</p></div>;

  return (
    <div>
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.25rem' }}>
        <h2 style={{ color: 'var(--color-primario)', marginTop: 0 }}>{form.id ? 'Editar actividad' : 'Nueva actividad'}</h2>
        <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input placeholder="Nombre de la actividad" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>Hora de inicio</label>
              <SelectorHora valor={form.hora} onChange={(v) => setForm({ ...form, hora: v })} permitirVacio={false} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>Hora de fin (opcional)</label>
              <SelectorHora valor={form.horaFin} onChange={(v) => setForm({ ...form, horaFin: v })} />
            </div>
          </div>
          <input placeholder="Área (opcional)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          {form.id && (
            <p style={{ fontSize: '0.8rem', color: '#777', margin: 0 }}>
              Nombre, fecha y hora se actualizan también en todas las respuestas de esta actividad.
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear actividad'}</button>
            {form.id && <button type="button" className="secundario" onClick={() => setForm(VACIO)}>Cancelar</button>}
          </div>
          {mensaje && <p className="badge-exito" style={{ margin: 0 }}>{mensaje}</p>}
          {error && <p className="badge-acento" style={{ margin: 0 }}>{error}</p>}
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h3 style={{ color: 'var(--color-primario)', margin: 0 }}>Actividades</h3>
          <input placeholder="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <label style={{ fontSize: '0.85rem' }}>
            <input type="checkbox" checked={verEliminadas} onChange={(e) => setVerEliminadas(e.target.checked)} /> Mostrar eliminadas
          </label>
        </div>
        <div className="tabla-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
                <th style={{ padding: '0.3rem' }}>Actividad</th><th>Fecha</th><th>Horario</th><th>Área</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {listado.map((a) => {
                const activa = actividadActiva(a);
                const estado = !activa ? 'Eliminada' : actividadVigente(a) ? 'Vigente' : 'Realizada';
                return (
                  <tr key={a.id_actividad} style={{ borderBottom: '1px solid var(--color-borde)', opacity: activa ? 1 : 0.55 }}>
                    <td style={{ padding: '0.3rem' }}>{a.nombre}</td>
                    <td>{a.fecha}</td>
                    <td>{a.hora}{a.hora_fin ? ` – ${a.hora_fin}` : ''}</td>
                    <td style={{ color: '#777' }}>{a['área']}</td>
                    <td className={estado === 'Eliminada' ? 'badge-acento' : estado === 'Vigente' ? 'badge-exito' : ''}>{estado}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {activa ? (
                        <>
                          <button className="secundario" style={{ padding: '0.25rem 0.6rem' }} onClick={() => editar(a)}>Editar</button>{' '}
                          <button className="secundario" style={{ padding: '0.25rem 0.6rem' }} onClick={() => cambiarEstado(a, 'eliminar')}>Eliminar</button>
                        </>
                      ) : (
                        <button className="secundario" style={{ padding: '0.25rem 0.6rem' }} onClick={() => cambiarEstado(a, 'restaurar')}>Restaurar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
