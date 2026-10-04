export const OPERACIONES_AUDITORIA = {
  INSERT: "Alta",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
  EVENTO: "Evento",
  LOGIN: "Sesión",
};

export const TABLAS_AUDITORIA = [
  "ALUMNA",
  "ASISTENCIA",
  "MENSUALIDAD",
  "PAGO",
  "VENTA",
  "VENTA_DETALLE",
  "VENTA_ABONO",
  "EGRESO",
  "PROMOCION",
  "CICLO",
  "TURNO",
  "USUARIO",
  "USUARIO_FUNCION",
  "TIPOUSUARIO",
  "MODULO",
  "SUBMODULO",
  "TIPO_PERMISO",
  "GRUPO_MODULO",
  "GRUPO_SUBMODULO_EXCLUIDO",
  "USUARIO_MODULO",
  "USUARIO_MODULO_EXCLUIDO",
  "USUARIO_SUBMODULO_EXCLUIDO",
  "USUARIO_SUBMODULO_INCLUIDO",
];

export function etiquetaOperacion(valor) {
  const clave = String(valor || "").toUpperCase();
  return { clase: clave.toLowerCase(), label: OPERACIONES_AUDITORIA[clave] || valor || "—" };
}
