import { useEffect, useMemo, useState } from 'react';
import type { Respuesta, RespuestaValor } from '../types';

type RespuestaConFila = Respuesta & { _fila: number };

const ESTADOS: RespuestaValor[] = ['Si', 'No', 'A confirmar', 'N/A', 'Sin Respuesta'];

export function Consulta() {
  const [datos, setDatos] = useState<RespuestaConFila[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros combinables
  const [fCompanerx, setFCompanerx] = useState('');
  const [fActividad, setFActividad] = useState('');
  const [fArea, setFArea] = useState('');
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [fEstados, setFEstados] = useState<Set<RespuestaValor>>(new Set());

  // Checkboxes del generador de WhatsApp: qué listados de "otras respuestas" incluir
  const [incluirNo, setIncluirNo] = useState(false);
  const [incluirAConfirmar, setIncluirAConfirmar] = useState(false);
  const [incluirSinRespuesta, setIncluirSinRespuesta] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch('/api/respuestas')
      .then((r) => r.json())
      .then((data: RespuestaConFila[]) => setDatos(data))
      .finally(() => setCargando(false));
  }, []);

  // Listas únicas para poblar los selects de filtro, derivadas de los datos ya cargados
  const companerxs = useMemo(() => [...new Set(datos.map((d) => d.compañerx))].filter(Boolean).sort(), [datos]);
  const actividades = useMemo(() => [...new Set(datos.map((d) => d.actividad))].filter(Boolean).sort(), [datos]);
  const areas = useMemo(() => [...new Set(datos.map((d) => d.área))].filter(Boolean).sort(), [datos]);

  function toggleEstado(estado: RespuestaValor) {
    setFEstados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(estado)) nuevo.delete(estado); else nuevo.add(estado);
      return nuevo;
    });
  }

  const filtrados = useMemo(() => {
    return datos.filter((d) => {
      if (fCompanerx && d.compañerx !== fCompanerx) return false;
      if (fActividad && d.actividad !== fActividad) return false;
      if (fArea && d.área !== fArea) return false;
      if (fDesde && d.fecha < fDesde) return false;
      if (fHasta && d.fecha > fHasta) return false;
      if (fEstados.size > 0 && !fEstados.has(d.respuesta)) return false;
      return true;
    });
  }, [datos, fCompanerx, fActividad, fArea, fDesde, fHasta, fEstados]);

  // El generador de WhatsApp exige una actividad puntual seleccionada, y usa
  // TODAS las respuestas de esa actividad (no el resto de los filtros activos)
  // para no correr el riesgo de armar un mensaje con un listado incompleto.
  function generarMensaje() {
    if (!fActividad) {
      setMensaje('Elegí una actividad puntual en el filtro para generar el mensaje.');
      return;
    }
    const deLaActividad = datos.filter((d) => d.actividad === fActividad && d.respuesta !== 'N/A');
    const fecha = deLaActividad[0]?.fecha ?? '';
    const fechaFormateada = fecha ? fecha.split('-').reverse().slice(0, 2).join('/') : '';

    const porTipo = (tipo: RespuestaValor) => deLaActividad.filter((d) => d.respuesta === tipo);
    const confirmados = porTipo('Si');
    const no = porTipo('No');
    const aConfirmar = porTipo('A confirmar');
    const sinRespuesta = porTipo('Sin Respuesta');
    const totalOtras = no.length + aConfirmar.length + sinRespuesta.length;

    let texto = `📋 *${fActividad}*${fechaFormateada ? ` (${fechaFormateada})` : ''}\n\n`;
    texto += `✅ Confirmadxs: ${confirmados.length}\n`;
    texto += confirmados.map((c) => c.compañerx).join(', ') + '\n\n';

    texto += `📌 Otras respuestas: ${totalOtras}\n`;
    const agregarGrupo = (etiqueta: string, filas: RespuestaConFila[], incluirListado: boolean) => {
      if (filas.length === 0) return '';
      const nombres = incluirListado ? `: ${filas.map((f) => f.compañerx).join(', ')}` : '';
      return `${etiqueta} (${filas.length})${nombres}\n`;
    };
    texto += agregarGrupo('No', no, incluirNo);
    texto += agregarGrupo('A confirmar', aConfirmar, incluirAConfirmar);
    texto += agregarGrupo('Sin Respuesta', sinRespuesta, incluirSinRespuesta);

    setMensaje(texto.trim());
  }

  function copiarMensaje() {
    navigator.clipboard.writeText(mensaje);
  }

  if (cargando) return <p>Cargando respuestas...</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
      <div className="card">
        <h2 style={{ color: 'var(--color-primario)' }}>Consulta</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
          <select value={fCompanerx} onChange={(e) => setFCompanerx(e.target.value)}>
            <option value="">Todxs lxs compañerxs</option>
            {companerxs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fActividad} onChange={(e) => setFActividad(e.target.value)}>
            <option value="">Todas las actividades</option>
            {actividades.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={fArea} onChange={(e) => setFArea(e.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} title="Desde" />
          <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} title="Hasta" />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {ESTADOS.map((estado) => (
            <label key={estado} style={{ fontSize: '0.85rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={fEstados.has(estado)} onChange={() => toggleEstado(estado)} />
              {estado}
            </label>
          ))}
        </div>

        <p style={{ color: '#777', fontSize: '0.85rem' }}>{filtrados.length} resultados</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-borde)' }}>
              <th style={{ padding: '0.3rem' }}>Compañerx</th>
              <th>Actividad</th>
              <th>Área</th>
              <th>Fecha</th>
              <th>Respuesta</th>
              <th>Estado post</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d) => (
              <tr key={d._fila} style={{ borderBottom: '1px solid var(--color-borde)' }}>
                <td style={{ padding: '0.3rem' }}>{d.compañerx}</td>
                <td>{d.actividad}</td>
                <td style={{ color: '#777' }}>{d.área}</td>
                <td>{d.fecha}</td>
                <td>{d.respuesta}</td>
                <td>{d.estado_post}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card superficie" style={{ alignSelf: 'start' }}>
        <h3 style={{ color: 'var(--color-primario)', marginTop: 0 }}>Generar mensaje WhatsApp</h3>
        <p style={{ fontSize: '0.85rem', color: '#555' }}>
          Elegí una actividad puntual en el filtro de la izquierda. El mensaje usa todas sus
          respuestas, sin aplicar el resto de los filtros.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          <label><input type="checkbox" checked={incluirNo} onChange={(e) => setIncluirNo(e.target.checked)} /> Incluir listado de "No"</label>
          <label><input type="checkbox" checked={incluirAConfirmar} onChange={(e) => setIncluirAConfirmar(e.target.checked)} /> Incluir listado de "A confirmar"</label>
          <label><input type="checkbox" checked={incluirSinRespuesta} onChange={(e) => setIncluirSinRespuesta(e.target.checked)} /> Incluir listado de "Sin Respuesta"</label>
        </div>

        <button onClick={generarMensaje} style={{ width: '100%', marginBottom: '0.75rem' }}>
          Generar mensaje
        </button>

        {mensaje && (
          <>
            <textarea readOnly value={mensaje} style={{ width: '100%', height: 220, fontFamily: 'monospace', fontSize: '0.85rem' }} />
            <button className="secundario" onClick={copiarMensaje} style={{ width: '100%', marginTop: '0.5rem' }}>
              Copiar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
