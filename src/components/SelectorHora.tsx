import { normalizarHora } from '../lib/horas';

// Selector de hora propio (hora 00-23 + minutos de a 5), en reemplazo de
// <input type="time">: ese campo se ve distinto según dispositivo y
// navegador (12 h / 24 h, o texto libre si no lo soporta). Este control
// muestra lo mismo en todos lados y siempre entrega "HH:mm" o "".

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface Props {
  valor: string;
  onChange: (valor: string) => void;
  permitirVacio?: boolean;
}

export function SelectorHora({ valor, onChange, permitirVacio = true }: Props) {
  const normalizado = normalizarHora(valor) ?? '';
  const [h, m] = normalizado ? normalizado.split(':') : ['', ''];
  // Si un dato viejo tiene minutos fuera de la grilla de 5 (ej. 19:07), se muestra igual.
  const minutos = m && !MINUTOS.includes(m) ? [...MINUTOS, m].sort() : MINUTOS;

  return (
    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
      <select
        value={h}
        aria-label="Hora"
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${m || '00'}` : '')}
      >
        <option value="">{permitirVacio ? '--' : 'hh'}</option>
        {HORAS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span>:</span>
      <select
        value={m}
        aria-label="Minutos"
        disabled={!h}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {!h && <option value="">--</option>}
        {minutos.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      {permitirVacio && h && (
        <button type="button" className="secundario" style={{ padding: '0.3rem 0.6rem' }} onClick={() => onChange('')}>
          ✕
        </button>
      )}
    </div>
  );
}
