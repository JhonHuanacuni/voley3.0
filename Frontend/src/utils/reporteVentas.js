import { parseJsonResponse } from "./api";
import { dbToView } from "./fecha";
import { descargarPdfInforme } from "./pdfInforme";
import {
  aplicarAnchosColumnas,
  cerrarInforme,
  crearWorkbookInforme,
  descargarBufferExcel,
  escribirEncabezadoInforme,
  escribirFilaDatos,
  escribirFilaEncabezados,
  escribirFilaTotales,
} from "./excelInformeFormato";

const COLUMNAS = [
  { label: "Recibo", valor: (venta) => venta.NUMERO || venta.IDVENTA || "", ancho: 16 },
  { label: "Fecha", formato: "fecha", valor: (venta) => dbToView(String(venta.FECHA || "")), ancho: 13 },
  { label: "Nombre", valor: (venta) => venta.NOMBRE || "", ancho: 34 },
  { label: "Tipo", valor: (venta) => venta.TIPO || "", ancho: 14 },
  { label: "Producto o servicio", valor: (venta) => venta.PRODUCTO || "", ancho: 34 },
  { label: "Turno", valor: (venta) => venta.TURNO || "", ancho: 26 },
  { label: "Talla", valor: (venta) => venta.TALLA || "", ancho: 9 },
  { label: "Precio", formato: "moneda", valor: (venta) => Number(venta.PRECIO || 0), ancho: 13 },
  { label: "Medio", valor: (venta) => venta.MEDIO || "", ancho: 15 },
  { label: "Estado", valor: (venta) => venta.ESTADO_RECIBO || "", ancho: 13 },
];

function vistaInput(fecha) {
  const partes = String(fecha || "").split("-");
  if (partes.length !== 3) return "";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function ventasDelPeriodo({ desde, hasta, estado, buscar, extras = {} }) {
  const filas = [];
  let pagina = 1;
  let total;
  do {
    const params = new URLSearchParams({
      pagina: String(pagina),
      tamanio: "200",
      ordenarPor: "FECHA",
      direccion: "DESC",
    });
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (estado) params.set("estado", estado);
    if (buscar) params.set("buscar", buscar);
    Object.entries(extras).forEach(([clave, valor]) => {
      if (valor) params.set(clave, valor);
    });
    const res = await fetch(`/api/ventas/?${params}`);
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo armar el reporte");
    filas.push(...(data.data || []));
    total = Number(data.total || 0);
    pagina += 1;
  } while (filas.length < total && pagina <= 50);
  return filas;
}

export function soles(valor) {
  const monto = Number(valor);
  const numero = Number.isNaN(monto) ? 0 : monto;
  return `S/ ${numero.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function descargarReporteVentas({ desde, hasta, estado, buscar, extras, formato = "excel" }) {
  const filas = await ventasDelPeriodo({ desde, hasta, estado, buscar, extras });
  const marca = `${String(desde).replace(/-/g, "")}-${String(hasta).replace(/-/g, "")}`;
  const metadatos = [`Periodo: ${vistaInput(desde)} al ${vistaInput(hasta)}`];
  if (estado) metadatos.push(`Recibo: ${estado}`);
  if (buscar) metadatos.push(`Búsqueda: ${buscar}`);

  const emitidas = filas.filter((venta) => String(venta.ESTADO_RECIBO || "Emitido") === "Emitido");
  const totalEmitido = emitidas.reduce((suma, venta) => suma + Number(venta.PRECIO || 0), 0);
  const indicePrecio = COLUMNAS.findIndex((col) => col.formato === "moneda");
  const titulo = "Reporte de ventas";

  if (formato === "pdf") {
    await descargarPdfInforme({
      titulo,
      metadatos,
      columnas: COLUMNAS,
      filas: filas.map((venta) => COLUMNAS.map((col) => (col.formato === "moneda" ? soles(col.valor(venta)) : String(col.valor(venta))))),
      totales: COLUMNAS.map((_, i) => {
        if (i === 0) return "TOTAL EMITIDO";
        return i === indicePrecio ? soles(totalEmitido) : "";
      }),
      resumen: [
        { etiqueta: "Ventas", valor: String(filas.length) },
        { etiqueta: "Emitidas", valor: String(emitidas.length) },
        { etiqueta: "Anuladas o eliminadas", valor: String(filas.length - emitidas.length) },
        { etiqueta: "Total emitido", valor: soles(totalEmitido) },
      ],
      archivo: `Reporte-ventas-${marca}`,
    });
    return filas.length;
  }

  const formatos = COLUMNAS.map((col) => col.formato);
  const wb = await crearWorkbookInforme();
  const ws = wb.addWorksheet("Ventas");
  const filaEncabezado = await escribirEncabezadoInforme(wb, ws, {
    titulo,
    metadatos,
    totalColumnas: COLUMNAS.length,
    totalRegistros: filas.length,
  });
  escribirFilaEncabezados(ws, filaEncabezado, COLUMNAS.map((col) => col.label));
  filas.forEach((venta, indice) => {
    escribirFilaDatos(ws, COLUMNAS.map((col) => col.valor(venta)), indice, formatos);
  });
  escribirFilaTotales(ws, COLUMNAS.map((_, i) => {
    if (i === 0) return "TOTAL EMITIDO";
    return i === indicePrecio ? totalEmitido : null;
  }), formatos);
  aplicarAnchosColumnas(ws, COLUMNAS.map((col) => col.ancho));
  cerrarInforme(ws, { totalColumnas: COLUMNAS.length, filaEncabezado });
  const buffer = await wb.xlsx.writeBuffer();
  descargarBufferExcel(buffer, `Reporte-ventas-${marca}.xlsx`);
  return filas.length;
}
