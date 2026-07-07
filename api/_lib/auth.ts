import { leerHojaComoObjetos } from './sheets.js';
import { puedeEscribir, type Usuario, type Rol } from '../../src/types/index.js';

// Repite la búsqueda que hace /api/usuarios, pero pensada para ser
// llamada internamente desde otros endpoints antes de aceptar una
// escritura. Separado en su propio módulo para no duplicar lógica
// de autorización en cada función.
export async function obtenerUsuarioPorEmail(email: string): Promise<Usuario | null> {
  const filas = await leerHojaComoObjetos('Usuarios!A:D');
  const fila = filas.find((f) => f.email?.trim().toLowerCase() === email.trim().toLowerCase());
  if (!fila) return null;

  return {
    email: fila.email,
    nombre: fila.nombre,
    roles: (fila.roles || '').split(',').map((r) => r.trim()).filter(Boolean) as Rol[],
    actividades_asignadas: (fila.actividades_asignadas || '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  };
}

// Devuelve true solo si el email existe en Usuarios Y su rol permite
// escribir (Responsable u Organización). Responsable Política y
// cualquier email no registrado devuelven false.
export async function verificarPuedeEscribir(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const usuario = await obtenerUsuarioPorEmail(email);
  if (!usuario) return false;
  return puedeEscribir(usuario);
}
