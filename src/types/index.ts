// Tipos del dominio, reflejando exactamente las columnas de las 3 hojas
// en "Organización 2026". Los valores de los enums deben matchear
// EXACTO los menús desplegables configurados en Sheets (mayúscula inicial).

export type RespuestaValor = 'Si' | 'No' | 'A confirmar' | 'N/A' | 'Sin Respuesta';
export type EstadoPost = '✅' | '❌' | '';
export type Rol = 'Responsable' | 'Organización' | 'Responsable Política';

export interface Respuesta {
  id_respuesta: string;
  compañerx: string;
  actividad: string;
  área: string;
  fecha: string; // formato ISO yyyy-mm-dd
  hora: string;
  respuesta: RespuestaValor;
  comentario: string;
  estado_post: EstadoPost;
  fecha_carga: string; // timestamp ISO, lo completa el backend
  cargado_por: string; // email de quien carga
}

export interface Usuario {
  email: string;
  nombre: string;
  // Roles combinados, separados por coma en la hoja (ej: "Responsable,Organización")
  roles: Rol[];
  // Campo legacy: ya no lo usa ningún rol actual (Actividad fue eliminado).
  // Se conserva por si en el futuro vuelve a hacer falta un rol con alcance limitado.
  actividades_asignadas: string[];
}

export interface Companerx {
  nombre: string;
  area: string;
  activo: boolean; // booleano 0/1 en la hoja
  vacaciones_desde: string | null;
  vacaciones_hasta: string | null;
}

// Los 3 roles ven todo (no hay roles con alcance limitado a un subconjunto
// de actividades). La única distinción real es lectura vs. escritura:
// Responsable y Organización pueden cargar/editar; Responsable Política
// solo puede ver (consulta y resumen), no cargar ni cerrar actividades.
export function puedeEscribir(usuario: Usuario): boolean {
  return usuario.roles.includes('Responsable') || usuario.roles.includes('Organización');
}
