export function dinero(valor) {
  const n = Number(valor || 0);
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Primer clic en una columna: ascendente; segundo clic: descendente. */
export function siguienteOrden(orden, campo) {
  if (orden?.campo === campo) return { campo, direccion: orden.direccion === "ASC" ? "DESC" : "ASC" };
  return { campo, direccion: "ASC" };
}
