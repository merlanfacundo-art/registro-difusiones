// Normalización de horas, compartida entre el navegador y las funciones /api.
// Todo horario se guarda y se compara como "HH:mm" (24 h). Las comparaciones
// se hacen en minutos, nunca como texto: "9:30" vs "12:00" comparado como
// texto da mal porque se compara carácter por carácter.

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

// Acepta las variantes que puede producir un navegador o un usuario:
// "9:30", "09:30:00", "9.30", "9,30", "9h30", "9hs", "21", "9:30 p. m.", "9 PM".
// Devuelve "HH:mm" o null si no se puede interpretar sin adivinar.
export function normalizarHora(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  let v = String(valor).trim().toLowerCase();
  if (!v) return null;

  const pm = /p\.?\s*m\.?/.test(v);
  const am = /a\.?\s*m\.?/.test(v);
  v = v.replace(/[ap]\.?\s*m\.?/g, '').trim();
  v = v.replace(/^(\d{1,2})\s*h(?:s|rs|oras)?\.?\s*(\d{2})$/, '$1:$2'); // 9h30 -> 9:30
  v = v.replace(/\s*h(?:s|rs|oras)?\.?$/, ''); // 9hs -> 9

  const m = /^(\d{1,2})(?:[:.,](\d{2}))?(?::\d{2})?$/.exec(v);
  if (!m) return null;

  let h = Number(m[1]);
  const min = m[2] !== undefined ? Number(m[2]) : 0;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${dosDigitos(h)}:${dosDigitos(min)}`;
}

export function aMinutos(valor: string | null | undefined): number | null {
  const n = normalizarHora(valor);
  if (!n) return null;
  const [h, m] = n.split(':').map(Number);
  return h * 60 + m;
}
