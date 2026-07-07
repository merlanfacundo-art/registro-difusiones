// Tipos del dominio, reflejando exactamente las columnas de las 3 hojas
// en "Organización 2026". Los valores de los enums deben matchear
// EXACTO los menús desplegables configurados en Sheets (mayúscula inicial).

export type RespuestaValor = 'Si' | 'No' | 'A confirmar' | 'N/A' | 'Sin Respuesta';
export type EstadoPost = '✅' | '❌' | '';
export type Rol = 'Responsable' | 'Organización' | 'Responsable Política';

export interface Respuesta {
  id_respuesta: string;
  id_actividad: string; // referencia única a Actividades, evita ambigüedad por nombre repetido
  compañerx: string;
  actividad: string; // denormalizado desde Actividades, para no romper Consulta/WhatsApp
  área: string;
  fecha: string; // formato ISO yyyy-mm-dd
  hora: string;
  respuesta: RespuestaValor;
  comentario: string;
  estado_post: EstadoPost;
  fecha_carga: string; // timestamp ISO, lo completa el backend
  cargado_por: string; // email de quien carga
}

export interface Actividad {
  id_actividad: string;
  nombre: string;
  fecha: string;
  hora: string;
  área: string;
  creada_por: string;
  fecha_creacion: string;
}

// Vigente = todavía no empezó (fecha+hora de inicio en el futuro respecto de "ahora").
// Una vez que arrancó, ya no se puede cargar ni modificar respuestas — solo
// queda disponible el Cierre post-actividad (✅/❌).
export function actividadVigente(actividad: Actividad, ahora: Date = new Date()): boolean {
  const inicio = new Date(`${actividad.fecha}T${actividad.hora}`);
  return inicio.getTime() > ahora.getTime();
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
