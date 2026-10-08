export function numeroBoleta(venta) {
  return String(venta?.NUMERO || venta?.COMPROBANTE || venta?.IDVENTA || "S/N");
}

export function soles(valor) {
  const n = Number(valor);
  const monto = Number.isNaN(n) ? 0 : n;
  return `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function articulosBoleta(venta) {
  const detalle = Array.isArray(venta?.DETALLE) ? venta.DETALLE.filter((item) => item?.PRODUCTO) : [];
  if (detalle.length) return detalle;
  if (venta?.PRODUCTO) {
    return [{ PRODUCTO: venta.PRODUCTO, TALLA: venta.TALLA, PRECIO: venta.PRECIO }];
  }
  return [];
}
