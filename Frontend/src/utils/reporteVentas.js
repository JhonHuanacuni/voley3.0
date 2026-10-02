import { parseJsonResponse } from "./api";
import { dbToView } from "./fecha";
import {
  aplicarAnchosColumnas,
  crearWorkbookInforme,
  descargarBufferExcel,
  escribirEncabezadoInforme,
  escribirFilaDatos,
  escribirFilaEncabezados,
} from "./excelInformeFormato";

const COLUMNAS = [
  "Recibo",
  "Fecha",
  "Nombre",
  "Tipo",
  "Producto o servicio",
  "Turno",
  "Talla",
  "Precio",
  "Medio",
  "Estado",
];

function vistaInput(fecha) {
  const partes = String(fecha || "").split("-");
  if (partes.length !== 3) return "";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function ventasDelPeriodo({ desde, hasta, estado, buscar, extras = {} }) {
  const filas = [];
  let pagina = 1;
  let total = 0;
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

const WINANSI = {
  á: "\\341", é: "\\351", í: "\\355", ó: "\\363", ú: "\\372",
  Á: "\\301", É: "\\311", Í: "\\315", Ó: "\\323", Ú: "\\332",
  ñ: "\\361", Ñ: "\\321", ü: "\\374", Ü: "\\334",
};

export function pdfTexto(valor) {
  return String(valor ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => WINANSI[ch] || "");
}

export function recortar(valor, maximo) {
  const texto = String(valor || "");
  return texto.length > maximo ? `${texto.slice(0, maximo - 3)}...` : texto;
}

export function soles(valor) {
  const monto = Number(valor);
  const numero = Number.isNaN(monto) ? 0 : monto;
  return `S/ ${numero.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNAS_PDF = [
  { titulo: "Recibo", x: 28, max: 12, valor: (venta) => venta.NUMERO || venta.IDVENTA || "" },
  { titulo: "Fecha", x: 98, max: 10, valor: (venta) => dbToView(String(venta.FECHA || "")) },
  { titulo: "Nombre", x: 158, max: 26, valor: (venta) => venta.NOMBRE || "" },
  { titulo: "Tipo", x: 318, max: 14, valor: (venta) => venta.TIPO || "" },
  { titulo: "Producto", x: 400, max: 20, valor: (venta) => venta.PRODUCTO || "" },
  { titulo: "Turno", x: 520, max: 16, valor: (venta) => venta.TURNO || "" },
  { titulo: "Talla", x: 628, max: 5, valor: (venta) => venta.TALLA || "" },
  { titulo: "Precio", x: 662, max: 12, valor: (venta) => soles(venta.PRECIO) },
  { titulo: "Medio", x: 728, max: 12, valor: (venta) => venta.MEDIO || "" },
  { titulo: "Estado", x: 786, max: 10, valor: (venta) => venta.ESTADO_RECIBO || "" },
];

function paginaPdf(filas, tituloPeriodo, numero, totalPaginas) {
  const comandos = [];
  const texto = (contenido, tamano, x, y) => {
    comandos.push(`BT /F1 ${tamano} Tf ${x} ${y} Td (${pdfTexto(contenido)}) Tj ET`);
  };
  texto("ACADEMIA VITA", 14, 28, 560);
  texto("REPORTE DE VENTAS", 11, 28, 542);
  texto(tituloPeriodo, 9, 28, 526);
  texto(`Pagina ${numero} de ${totalPaginas}`, 8, 700, 526);
  let y = 504;
  COLUMNAS_PDF.forEach((columna) => texto(columna.titulo, 8, columna.x, y));
  y -= 14;
  filas.forEach((venta) => {
    COLUMNAS_PDF.forEach((columna) => {
      texto(recortar(columna.valor(venta), columna.max), 8, columna.x, y);
    });
    y -= 12;
  });
  return comandos.join("\n");
}

export function documentoPdf(contenidos) {
  const kids = contenidos.map((_, indice) => `${4 + indice * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${contenidos.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  contenidos.forEach((stream, indice) => {
    const pagina = 4 + indice * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents ${pagina + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, indice) => {
    offsets.push(pdf.length);
    pdf += `${indice + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export function descargarPdf(contenido, nombre) {
  const blob = new Blob([contenido], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

export async function descargarReporteVentas({ desde, hasta, estado, buscar, extras, formato = "excel" }) {
  const filas = await ventasDelPeriodo({ desde, hasta, estado, buscar, extras });
  const marca = `${String(desde).replace(/-/g, "")}-${String(hasta).replace(/-/g, "")}`;
  const tituloPeriodo = `Periodo: ${vistaInput(desde)} al ${vistaInput(hasta)}${estado ? `  |  Recibo: ${estado}` : ""}${buscar ? `  |  Busqueda: ${buscar}` : ""}  |  ${filas.length} ventas`;
  if (formato === "pdf") {
    const porPagina = 36;
    const paginas = [];
    const grupos = filas.length ? filas : [];
    const cantidad = Math.max(1, Math.ceil(grupos.length / porPagina));
    for (let indice = 0; indice < cantidad; indice += 1) {
      paginas.push(paginaPdf(grupos.slice(indice * porPagina, (indice + 1) * porPagina), tituloPeriodo, indice + 1, cantidad));
    }
    descargarPdf(documentoPdf(paginas), `Reporte-ventas-${marca}.pdf`);
    return filas.length;
  }
  const wb = await crearWorkbookInforme();
  const ws = wb.addWorksheet("Ventas");
  const metadatos = [`Periodo: ${vistaInput(desde)} al ${vistaInput(hasta)}`];
  if (estado) metadatos.push(`Recibo: ${estado}`);
  if (buscar) metadatos.push(`Búsqueda: ${buscar}`);
  const filaEncabezado = await escribirEncabezadoInforme(wb, ws, {
    titulo: "Reporte de ventas",
    metadatos,
    totalColumnas: COLUMNAS.length,
    totalRegistros: filas.length,
  });
  escribirFilaEncabezados(ws, filaEncabezado, COLUMNAS);
  filas.forEach((venta, indice) => {
    escribirFilaDatos(ws, [
      venta.NUMERO || venta.IDVENTA || "",
      dbToView(String(venta.FECHA || "")),
      venta.NOMBRE || "",
      venta.TIPO || "",
      venta.PRODUCTO || "",
      venta.TURNO || "",
      venta.TALLA || "",
      Number(venta.PRECIO || 0),
      venta.MEDIO || "",
      venta.ESTADO_RECIBO || "",
    ], indice);
  });
  aplicarAnchosColumnas(ws, [16, 14, 36, 18, 36, 28, 10, 12, 16, 14]);
  const buffer = await wb.xlsx.writeBuffer();
  descargarBufferExcel(buffer, `Reporte-ventas-${marca}.xlsx`);
  return filas.length;
}
